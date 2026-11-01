"""
Tally Data Router
-----------------
Endpoints:
  POST /api/tally/ingest               → Machine-to-machine: receive vouchers from TallyConnector
  POST /api/tally/reconcile/cleanup    → Machine-to-machine: soft-delete vouchers removed from Tally
  GET  /api/tally/audit                → Returns active voucher IDs scoped to a company (paginated)
  GET  /api/tally/vouchers             → Paginated + filtered voucher list (requires view_tally_data)
  GET  /api/tally/stats                → Summary stats for the Tally Data page header

Authentication:
  - Ingest/cleanup endpoints: X-API-Key header validated against TALLY_API_KEY env var
  - Read endpoints: standard RBAC via x-user-email header (view_tally_data permission)
"""

import hmac
import os
import re
from datetime import datetime, timezone, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel

from supabase_db import SupabaseClient, get_db
from rbac_utils import verify_permission

IST = timezone(timedelta(hours=5, minutes=30))

router = APIRouter()

_TALLY_API_KEY = os.getenv("TALLY_API_KEY", "")

# Page size used when fetching all active IDs for the audit endpoint
_AUDIT_PAGE_SIZE = 1000


# ─── Auth helper ──────────────────────────────────────────────────────────────

def _verify_api_key(x_api_key: Optional[str] = Header(None, alias="x-api-key")) -> None:
    """Validates the X-API-Key header using timing-safe comparison (prevents timing attacks)."""
    expected_key = os.getenv("TALLY_API_KEY", "")
    if not expected_key:
        raise HTTPException(status_code=500, detail="TALLY_API_KEY is not configured on the server.")
    if not x_api_key:
        raise HTTPException(status_code=401, detail="Missing API key.")
    # hmac.compare_digest prevents timing side-channel attacks on key comparison
    if not hmac.compare_digest(x_api_key.encode(), expected_key.encode()):
        raise HTTPException(status_code=401, detail="Invalid API key.")


# ─── Pydantic models ──────────────────────────────────────────────────────────

class VoucherPayload(BaseModel):
    voucher_id:    str
    voucher_no:    Optional[str] = None
    voucher_type:  Optional[str] = None
    date:          Optional[str] = None
    customer_name: Optional[str] = None
    particulars:   Optional[str] = None
    debit:         Optional[float] = 0.0
    credit:        Optional[float] = 0.0
    narration:     Optional[str] = None
    items_summary: Optional[str] = None
    extra_fields:  Optional[dict] = {}
    alter_id:      Optional[str] = None
    company_name:  Optional[str] = None


class IngestRequest(BaseModel):
    vouchers:          List[VoucherPayload]
    connector_version: Optional[str] = None
    company_name:      Optional[str] = None   # top-level fallback if per-row company_name absent


class CleanupRequest(BaseModel):
    active_voucher_ids: List[str]
    company_name:       Optional[str] = None  # scopes cleanup to this company only


# ─── Health / Ping endpoint ──────────────────────────────────────────────────

@router.get("/ping")
def ping_backend(_: None = Depends(_verify_api_key)):
    """Lightweight health check endpoint for desktop connector to verify connection and API key."""
    return {"status": "ok", "message": "Backend is online and API key is valid."}


# ─── Audit endpoint ──────────────────────────────────────────────────────────

@router.get("/audit")
def audit_vouchers(
    company: Optional[str] = Query(None, description="Scope audit to this company name"),
    db: SupabaseClient = Depends(get_db),
    _: None = Depends(_verify_api_key),
):
    """
    Returns all active voucher IDs and summary metrics scoped to a company.
    Paginates internally so it is not capped by Supabase's default 1 000-row limit.
    """
    try:
        all_rows = []
        offset = 0

        while True:
            q = (
                db.table("tally_vouchers")
                .select("voucher_id,voucher_no,customer_name,date,debit,credit,alter_id,company_name")
                .eq("is_deleted", False)
            )
            if company:
                q = q.eq("company_name", company)
            q = q.range(offset, offset + _AUDIT_PAGE_SIZE - 1)
            res = q.execute()
            page = res.data or []
            all_rows.extend(page)
            if len(page) < _AUDIT_PAGE_SIZE:
                break
            offset += _AUDIT_PAGE_SIZE

        # Build voucher_id set (prefer voucher_id, fall back to voucher_no)
        voucher_ids = [
            r.get("voucher_id") or r.get("voucher_no")
            for r in all_rows
            if r.get("voucher_id") or r.get("voucher_no")
        ]
        # Build alter_id map {voucher_id: alter_id} for delta detection
        alter_id_map = {
            (r.get("voucher_id") or r.get("voucher_no")): r.get("alter_id", "")
            for r in all_rows
            if r.get("voucher_id") or r.get("voucher_no")
        }

        return {
            "total_vouchers":   len(all_rows),
            "voucher_ids":      list(set(voucher_ids)),
            "alter_id_map":     alter_id_map,
            "customers_count":  len({r.get("customer_name") for r in all_rows if r.get("customer_name")}),
            "total_debit":      round(sum(float(r.get("debit") or 0.0) for r in all_rows), 2),
            "total_credit":     round(sum(float(r.get("credit") or 0.0) for r in all_rows), 2),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to query audit state: {e}")


# ─── Ingest endpoint ──────────────────────────────────────────────────────────

@router.post("/ingest")
def ingest_vouchers(
    payload: IngestRequest,
    db: SupabaseClient = Depends(get_db),
    _: None = Depends(_verify_api_key),
):
    """
    Upserts a batch of vouchers sent by the TallyConnector EXE.
    Idempotent: same (company_name, voucher_id) always overwrites cleanly.
    Uses a single bulk upsert call instead of a per-row loop for efficiency.
    """
    if not payload.vouchers:
        return {"upserted": 0, "message": "Empty batch — nothing to do."}

    connector_version   = payload.connector_version
    top_company         = (payload.company_name or "").strip()
    synced_at           = datetime.now(IST).isoformat()

    rows_by_key = {}
    for v in payload.vouchers:
        if not v.voucher_id:
            continue
        row_company = (v.company_name or top_company or "").strip()
        composite_key = (row_company, v.voucher_id)
        rows_by_key[composite_key] = {
            "voucher_id":        v.voucher_id,
            "voucher_no":        v.voucher_no or "",
            "voucher_type":      v.voucher_type or "",
            "date":              v.date or "",
            "customer_name":     v.customer_name or "",
            "particulars":       v.particulars or "",
            "debit":             v.debit or 0.0,
            "credit":            v.credit or 0.0,
            "narration":         v.narration or "",
            "items_summary":     v.items_summary or "",
            "extra_fields":      v.extra_fields or {},
            "alter_id":          v.alter_id or "",
            "company_name":      row_company,
            "synced_at":         synced_at,
            "connector_version": connector_version or "",
            "is_deleted":        False,
            "deleted_at":        None,
        }

    rows = list(rows_by_key.values())

    if not rows:
        return {"upserted": 0, "message": "No valid vouchers in batch."}

    try:
        db.table("tally_vouchers").upsert(
            rows,
            on_conflict="company_name,voucher_id",
        ).execute()
        return {"upserted": len(rows), "total_received": len(payload.vouchers)}
    except Exception as e:
        print(f"[tally_data] Bulk upsert failed: {e}")
        raise HTTPException(status_code=500, detail=f"Ingest failed: {e}")


# ─── Reconcile cleanup endpoint ───────────────────────────────────────────────

@router.post("/reconcile/cleanup")
def reconcile_cleanup(
    payload: CleanupRequest,
    db: SupabaseClient = Depends(get_db),
    _: None = Depends(_verify_api_key),
):
    """
    Soft-deletes any voucher in the DB whose voucher_id is NOT in the provided active list,
    scoped strictly to the given company_name.
    Uses a single bulk update call instead of a per-row loop.
    """
    company    = (payload.company_name or "").strip()
    active_ids = list(set(payload.active_voucher_ids))  # deduplicate

    if not active_ids:
        return {"soft_deleted": 0, "message": "Empty active list — no cleanup performed."}

    if not company:
        return {"soft_deleted": 0, "message": "company_name is required for cleanup — skipped."}

    deleted_at = datetime.now(IST).isoformat()

    try:
        # Fetch all currently active voucher_ids for this company (paginated past 1,000-row limit)
        db_active_ids = []
        offset = 0
        while True:
            result = (
                db.table("tally_vouchers")
                .select("voucher_id")
                .eq("is_deleted", False)
                .eq("company_name", company)
                .range(offset, offset + _AUDIT_PAGE_SIZE - 1)
                .execute()
            )
            rows = result.data or []
            for r in rows:
                vid = r.get("voucher_id")
                if vid:
                    db_active_ids.append(vid)
            if len(rows) < _AUDIT_PAGE_SIZE:
                break
            offset += _AUDIT_PAGE_SIZE

        active_set = set(active_ids)
        stale_ids  = [vid for vid in db_active_ids if vid not in active_set]

        if not stale_ids:
            return {
                "soft_deleted": 0,
                "active_ids_received": len(active_ids),
                "db_active_before_cleanup": len(db_active_ids),
            }

        # Batch update in chunks of 50 to prevent HTTP 414/500 URI Too Long errors in PostgREST
        _CLEANUP_BATCH = 50
        for i in range(0, len(stale_ids), _CLEANUP_BATCH):
            batch = stale_ids[i:i + _CLEANUP_BATCH]
            db.table("tally_vouchers").update({
                "is_deleted": True,
                "deleted_at": deleted_at,
            }).eq("company_name", company).in_("voucher_id", batch).execute()

        return {
            "soft_deleted": len(stale_ids),
            "active_ids_received": len(active_ids),
            "db_active_before_cleanup": len(db_active_ids),
        }

    except Exception as e:
        print(f"[tally_data] Reconcile cleanup error: {e}")
        raise HTTPException(status_code=500, detail=f"Cleanup failed: {e}")


# ─── Read endpoints (RBAC-protected) ─────────────────────────────────────────

@router.get("/vouchers")
def list_vouchers(
    page:         int   = Query(1, ge=1),
    page_size:    int   = Query(50, ge=1, le=5000),
    voucher_type: Optional[str] = Query(None),
    customer:     Optional[str] = Query(None),
    search:       Optional[str] = Query(None),
    date_from:    Optional[str] = Query(None),
    date_to:      Optional[str] = Query(None),
    company:      Optional[str] = Query(None),
    order:        Optional[str] = Query("desc"),
    db: SupabaseClient = Depends(get_db),
    user_email: str = Depends(verify_permission("view_tally_data")),
):
    """
    Returns paginated, filtered Tally vouchers.
    Only returns non-deleted records (is_deleted = false).
    """
    try:
        query = (
            db.table("tally_vouchers")
            .select("*", count="exact")
            .eq("is_deleted", False)
        )

        if company:
            query = query.eq("company_name", company.strip())
        if voucher_type:
            query = query.ilike("voucher_type", f"%{voucher_type.strip()}%")
        if customer:
            query = query.ilike("customer_name", f"%{customer.strip()}%")
        if date_from:
            query = query.gte("date", date_from)
        if date_to:
            query = query.lte("date", date_to)
        if search:
            # PostgREST or_() syntax breaks when search contains parentheses, commas, quotes or backslashes
            safe_search = re.sub(r'[,()"\\]', ' ', search.strip()).strip()
            safe_search = re.sub(r'\s+', ' ', safe_search)
            if safe_search:
                query = query.or_(
                    f"voucher_no.ilike.%{safe_search}%,"
                    f"customer_name.ilike.%{safe_search}%,"
                    f"narration.ilike.%{safe_search}%,"
                    f"particulars.ilike.%{safe_search}%"
                )

        desc_order = False if order and order.strip().lower() == "asc" else True
        offset = (page - 1) * page_size
        query  = query.order("date", desc=desc_order).order("created_at", desc=desc_order).range(offset, offset + page_size - 1)

        result = query.execute()
        total  = result.count if result.count is not None else len(result.data)

        return {
            "data":      result.data or [],
            "total":     total,
            "page":      page,
            "page_size": page_size,
            "pages":     (total + page_size - 1) // page_size if total > 0 else 1,
        }

    except Exception as e:
        print(f"[tally_data] list_vouchers error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats")
def get_stats(
    company: Optional[str] = Query(None),
    db: SupabaseClient = Depends(get_db),
    user_email: str = Depends(verify_permission("view_tally_data")),
):
    """
    Returns summary stats for the Tally Data page header:
    total active vouchers, soft-deleted count, and last synced timestamp.
    Optionally scoped to a company.
    """
    try:
        def scoped(q):
            return q.eq("company_name", company.strip()) if company else q

        active_result = scoped(
            db.table("tally_vouchers").select("id", count="exact").eq("is_deleted", False)
        ).execute()
        deleted_result = scoped(
            db.table("tally_vouchers").select("id", count="exact").eq("is_deleted", True)
        ).execute()
        last_sync_result = scoped(
            db.table("tally_vouchers")
            .select("synced_at")
            .eq("is_deleted", False)
            .order("synced_at", desc=True)
            .limit(1)
        ).execute()

        last_synced = None
        if last_sync_result.data:
            last_synced = last_sync_result.data[0].get("synced_at")

        return {
            "total_active":   active_result.count or 0,
            "total_deleted":  deleted_result.count or 0,
            "last_synced_at": last_synced,
        }

    except Exception as e:
        print(f"[tally_data] get_stats error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/filter-options")
def get_filter_options(
    company: Optional[str] = Query(None),
    db: SupabaseClient = Depends(get_db),
    user_email: str = Depends(verify_permission("view_tally_data")),
):
    """Returns distinct voucher types, customers, and companies for dropdown filters."""
    try:
        # Fetch all distinct companies across active vouchers (paginated past 1,000-row limit)
        companies_set = set()
        offset = 0
        page_size = 1000
        while True:
            co_res = (
                db.table("tally_vouchers")
                .select("company_name")
                .eq("is_deleted", False)
                .range(offset, offset + page_size - 1)
                .execute()
            )
            rows = co_res.data or []
            for r in rows:
                cname = r.get("company_name")
                if cname:
                    companies_set.add(cname)
            if len(rows) < page_size:
                break
            offset += page_size

        companies = sorted(companies_set)

        types_set = set()
        custs_set = set()
        offset = 0
        while True:
            q = (
                db.table("tally_vouchers")
                .select("voucher_type, customer_name")
                .eq("is_deleted", False)
            )
            if company:
                q = q.eq("company_name", company.strip())
            res = q.range(offset, offset + page_size - 1).execute()
            rows = res.data or []
            for r in rows:
                vt = r.get("voucher_type")
                if vt:
                    types_set.add(vt)
                cn = r.get("customer_name")
                if cn:
                    custs_set.add(cn)
            if len(rows) < page_size:
                break
            offset += page_size

        return {"voucher_types": sorted(types_set), "customers": sorted(custs_set), "companies": companies}
    except Exception as e:
        print(f"[tally_data] filter_options error: {e}")
        return {"voucher_types": [], "customers": [], "companies": []}
