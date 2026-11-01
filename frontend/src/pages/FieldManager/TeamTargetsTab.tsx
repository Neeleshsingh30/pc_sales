/**
 * TeamTargetsTab.tsx
 * ──────────────────────────────────────────────────────────────────────────
 * Tab 1: Team Overview & Target Management
 * - 4 KPI summary cards (aggregated across all FOs)
 * - MUI DataGrid of assigned Field Officers
 * - SetTargetDialog modal for monthly target setting
 */

import { useState, useEffect } from "react";
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  CircularProgress,
  Alert,
  LinearProgress,
  Tooltip,
  IconButton,
} from "@mui/material";
import { DataGrid, type GridColDef, type GridRenderCellParams } from "@mui/x-data-grid";
import {
  TrackChanges as TargetIcon,
  DirectionsRun as ActiveIcon,
  VerifiedUser as VerifiedIcon,
  Discount as DiscountIcon,
  Edit as EditIcon,
  Map as MapIcon,
  History as HistoryIcon,
} from "@mui/icons-material";
import { auraManagerAPI, type SetTargetPayload } from "../../services/auraApi";
import type { FieldOfficer, TeamKPI } from "../../types/aura";
import { format } from "date-fns";

interface Props {
  selectedFoEmail: string | "all";
  selectedMonth: string; // "YYYY-MM"
  onViewRoute: (foEmail: string) => void;
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  title,
  value,
  sub,
  icon,
  color,
  progress,
}: {
  title: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  color: string;
  progress?: number;
}) {
  return (
    <Card sx={{ height: "100%", borderLeft: `4px solid ${color}` }}>
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
          <Typography variant="body2" color="text.secondary" fontWeight={600}>
            {title}
          </Typography>
          <Box sx={{ color }}>{icon}</Box>
        </Box>
        <Typography variant="h5" fontWeight={700} gutterBottom>
          {value}
        </Typography>
        {sub && (
          <Typography variant="caption" color="text.secondary">
            {sub}
          </Typography>
        )}
        {progress !== undefined && (
          <LinearProgress
            variant="determinate"
            value={Math.min(progress, 100)}
            sx={{ mt: 1, height: 6, borderRadius: 3, bgcolor: `${color}22`, "& .MuiLinearProgress-bar": { bgcolor: color } }}
          />
        )}
      </CardContent>
    </Card>
  );
}

// ─── Set Target Dialog ────────────────────────────────────────────────────────

function SetTargetDialog({
  open,
  onClose,
  officers,
  preselectedFoId,
  currentMonth,
}: {
  open: boolean;
  onClose: () => void;
  officers: FieldOfficer[];
  preselectedFoId?: string;
  currentMonth: string;
}) {
  const [form, setForm] = useState<SetTargetPayload>({
    fo_user_id: preselectedFoId ?? "",
    month_year: currentMonth,
    target_amount: 0,
    target_liters: 0,
    target_visits: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (open) {
      setForm((f: SetTargetPayload) => ({ ...f, fo_user_id: preselectedFoId ?? "", month_year: currentMonth }));
      setError(null);
      setSuccess(false);
    }
  }, [open, preselectedFoId, currentMonth]);

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      await auraManagerAPI.setTarget(form);
      setSuccess(true);
      setTimeout(onClose, 1200);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } }; message?: string };
      setError(err.response?.data?.detail ?? err.message ?? "Failed to set target");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Set / Update Monthly Target</DialogTitle>
      <DialogContent>
        <Box display="flex" flexDirection="column" gap={2} mt={1}>
          {error && <Alert severity="error">{error}</Alert>}
          {success && <Alert severity="success">Target saved! Notifying Field Officer…</Alert>}
          <TextField
            select
            label="Field Officer"
            value={form.fo_user_id}
            onChange={(e) => setForm((f: SetTargetPayload) => ({ ...f, fo_user_id: e.target.value }))}
            fullWidth
          >
            {officers.map((o) => (
              <MenuItem key={o.fo_user_id} value={o.fo_user_id}>
                {o.name} ({o.phone})
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Month (YYYY-MM)"
            type="month"
            value={form.month_year}
            onChange={(e) => setForm((f: SetTargetPayload) => ({ ...f, month_year: e.target.value }))}
            fullWidth
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="Monthly Revenue Target (₹)"
            type="number"
            value={form.target_amount}
            onChange={(e) => setForm((f: SetTargetPayload) => ({ ...f, target_amount: Number(e.target.value) }))}
            fullWidth
            inputProps={{ min: 0 }}
          />
          <TextField
            label="Monthly Volume Target (Liters of F.S. Calcival)"
            type="number"
            value={form.target_liters}
            onChange={(e) => setForm((f: SetTargetPayload) => ({ ...f, target_liters: Number(e.target.value) }))}
            fullWidth
            inputProps={{ min: 0 }}
          />
          <TextField
            label="Monthly Visit Count Target"
            type="number"
            value={form.target_visits}
            onChange={(e) => setForm((f: SetTargetPayload) => ({ ...f, target_visits: Number(e.target.value) }))}
            fullWidth
            inputProps={{ min: 0 }}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={loading || !form.fo_user_id}
          startIcon={loading ? <CircularProgress size={18} /> : null}
        >
          Save Target
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Status Chip ──────────────────────────────────────────────────────────────

function StatusChip({ status }: { status: FieldOfficer["today_status"] }) {
  const map: Record<FieldOfficer["today_status"], { label: string; color: "success" | "warning" | "info" | "default" | "error" }> = {
    plan_locked: { label: "Plan Locked", color: "info" },
    in_visit: { label: "In Visit", color: "success" },
    on_break: { label: "On Break", color: "warning" },
    idle: { label: "Idle", color: "default" },
    off: { label: "Off", color: "error" },
  };
  const { label, color } = map[status] ?? { label: status, color: "default" };
  return <Chip label={label} color={color} size="small" />;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TeamTargetsTab({ selectedFoEmail, selectedMonth, onViewRoute }: Props) {
  const [officers, setOfficers] = useState<FieldOfficer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [targetDialogOpen, setTargetDialogOpen] = useState(false);
  const [targetDialogFoId, setTargetDialogFoId] = useState<string | undefined>();

  useEffect(() => {
    const fetchOfficers = async () => {
      setLoading(true);
      setError(null);
      try {
        const params: { month?: string; manager_email?: string } = { month: selectedMonth };
        const res = await auraManagerAPI.getOfficers(params);
        const data: FieldOfficer[] = res.data?.officers ?? [];
        setOfficers(data);
      } catch (e: unknown) {
        const err = e as { message?: string };
        setError(err.message ?? "Failed to load officers from AURA");
      } finally {
        setLoading(false);
      }
    };
    fetchOfficers();
  }, [selectedMonth, selectedFoEmail]);

  // Compute team KPI from officers
  const kpi: TeamKPI = {
    total_target_amount: officers.reduce((s, o) => s + (o.monthly_target_amount ?? 0), 0),
    total_achieved_amount: officers.reduce((s, o) => s + (o.achieved_sales_amount ?? 0), 0),
    team_shortfall_amount: officers.reduce((s, o) => s + (o.target_shortfall ?? 0), 0),
    team_shortfall_pct: 0,
    officers_submitted_plan: officers.filter((o) => o.today_status !== "idle" && o.today_status !== "off").length,
    officers_active_in_field: officers.filter((o) => o.today_status === "in_visit").length,
    total_visits_today: 0,
    total_officers: officers.length,
    verified_visits: 0,
    pending_verification: 0,
    disputed_visits: 0,
    total_discounts_given: officers.reduce((s, o) => s + (o.discounts_given ?? 0), 0),
    discount_pct_of_gross: 0,
  };
  kpi.team_shortfall_pct =
    kpi.total_target_amount > 0
      ? (kpi.team_shortfall_amount / kpi.total_target_amount) * 100
      : 0;
  const achievedPct =
    kpi.total_target_amount > 0
      ? (kpi.total_achieved_amount / kpi.total_target_amount) * 100
      : 0;

  const displayedOfficers =
    selectedFoEmail === "all" ? officers : officers.filter((o) => o.fo_user_id === selectedFoEmail);

  const columns: GridColDef[] = [
    {
      field: "name",
      headerName: "Officer",
      flex: 1.2,
      renderCell: (p: GridRenderCellParams<FieldOfficer>) => (
        <Box>
          <Typography variant="body2" fontWeight={600}>
            {p.row.name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {p.row.phone}
          </Typography>
        </Box>
      ),
    },
    {
      field: "assigned_talukas",
      headerName: "Districts / Talukas",
      flex: 1,
      renderCell: (p: GridRenderCellParams<FieldOfficer>) => (
        <Box display="flex" gap={0.5} flexWrap="wrap">
          {(p.row.assigned_talukas ?? []).slice(0, 3).map((t: string) => (
            <Chip key={t} label={t} size="small" variant="outlined" />
          ))}
        </Box>
      ),
    },
    {
      field: "today_status",
      headerName: "Today's Status",
      width: 130,
      renderCell: (p: GridRenderCellParams<FieldOfficer>) => (
        <StatusChip status={p.row.today_status} />
      ),
    },
    {
      field: "monthly_target_amount",
      headerName: "Target (₹)",
      width: 120,
      renderCell: (p: GridRenderCellParams<FieldOfficer>) => (
        <Typography variant="body2">₹{(p.row.monthly_target_amount ?? 0).toLocaleString("en-IN")}</Typography>
      ),
    },
    {
      field: "achieved_sales_amount",
      headerName: "Achieved (₹)",
      width: 130,
      renderCell: (p: GridRenderCellParams<FieldOfficer>) => (
        <Typography variant="body2" color="success.main">
          ₹{(p.row.achieved_sales_amount ?? 0).toLocaleString("en-IN")}
        </Typography>
      ),
    },
    {
      field: "target_shortfall",
      headerName: "Shortfall (₹)",
      width: 130,
      renderCell: (p: GridRenderCellParams<FieldOfficer>) => (
        <Typography variant="body2" color={(p.row.target_shortfall ?? 0) > 0 ? "error.main" : "success.main"}>
          ₹{Math.abs(p.row.target_shortfall ?? 0).toLocaleString("en-IN")}
        </Typography>
      ),
    },
    {
      field: "kms_this_month",
      headerName: "KMs",
      width: 90,
      renderCell: (p: GridRenderCellParams<FieldOfficer>) => (
        <Typography variant="body2">{(p.row.kms_this_month ?? 0).toFixed(1)} km</Typography>
      ),
    },
    {
      field: "discounts_given",
      headerName: "Discounts (₹)",
      width: 120,
      renderCell: (p: GridRenderCellParams<FieldOfficer>) => (
        <Typography variant="body2" color="warning.main">
          ₹{(p.row.discounts_given ?? 0).toLocaleString("en-IN")}
        </Typography>
      ),
    },
    {
      field: "actions",
      headerName: "Actions",
      width: 140,
      sortable: false,
      renderCell: (p: GridRenderCellParams<FieldOfficer>) => (
        <Box display="flex" gap={0.5}>
          <Tooltip title="Set Target">
            <IconButton
              size="small"
              color="primary"
              onClick={() => {
                setTargetDialogFoId(p.row.fo_user_id);
                setTargetDialogOpen(true);
              }}
            >
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="View Route">
            <IconButton size="small" color="secondary" onClick={() => onViewRoute(p.row.fo_user_id)}>
              <MapIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Audit Edits">
            <IconButton size="small" onClick={() => {}}>
              <HistoryIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ];

  return (
    <Box>
      {/* KPI Cards */}
      <Grid container spacing={2} mb={3}>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard
            title="Team Target vs Achieved"
            value={`₹${(kpi.total_achieved_amount / 100000).toFixed(1)}L / ₹${(kpi.total_target_amount / 100000).toFixed(1)}L`}
            sub={`Shortfall: ₹${(kpi.team_shortfall_amount / 100000).toFixed(1)}L (${kpi.team_shortfall_pct.toFixed(1)}%)`}
            icon={<TargetIcon />}
            color="#1976d2"
            progress={achievedPct}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard
            title="Today's Route Compliance"
            value={`${kpi.officers_submitted_plan} / ${kpi.total_officers} Officers`}
            sub={`${kpi.officers_active_in_field} Active in Field Now`}
            icon={<ActiveIcon />}
            color="#2e7d32"
            progress={kpi.total_officers > 0 ? (kpi.officers_submitted_plan / kpi.total_officers) * 100 : 0}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard
            title="Verification Progress"
            value={`${kpi.verified_visits} Verified`}
            sub={`${kpi.pending_verification} Pending · ${kpi.disputed_visits} Disputed`}
            icon={<VerifiedIcon />}
            color="#ed6c02"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard
            title="Monthly Team Discounts"
            value={`₹${(kpi.total_discounts_given).toLocaleString("en-IN")}`}
            sub={`${kpi.discount_pct_of_gross.toFixed(1)}% of Gross Sales`}
            icon={<DiscountIcon />}
            color="#9c27b0"
          />
        </Grid>
      </Grid>

      {/* Error / Loading */}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* DataGrid */}
      <Card>
        <CardContent sx={{ p: 0, "&:last-child": { pb: 0 } }}>
          <Box display="flex" alignItems="center" justifyContent="space-between" px={2} py={1.5}>
            <Typography variant="subtitle1" fontWeight={600}>
              Assigned Field Officers — {format(new Date(selectedMonth + "-01"), "MMMM yyyy")}
            </Typography>
            <Button
              variant="contained"
              size="small"
              startIcon={<EditIcon />}
              onClick={() => {
                setTargetDialogFoId(undefined);
                setTargetDialogOpen(true);
              }}
            >
              Set Target
            </Button>
          </Box>
          <DataGrid
            rows={displayedOfficers}
            getRowId={(r) => r.fo_user_id}
            columns={columns}
            loading={loading}
            autoHeight
            initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
            pageSizeOptions={[10, 25]}
            disableRowSelectionOnClick
            density="comfortable"
            sx={{ border: "none" }}
          />
        </CardContent>
      </Card>

      {/* Set Target Dialog */}
      <SetTargetDialog
        open={targetDialogOpen}
        onClose={() => setTargetDialogOpen(false)}
        officers={officers}
        preselectedFoId={targetDialogFoId}
        currentMonth={selectedMonth}
      />
    </Box>
  );
}

