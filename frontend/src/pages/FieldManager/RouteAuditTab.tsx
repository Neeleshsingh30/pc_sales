/**
 * RouteAuditTab.tsx
 * ──────────────────────────────────────────────────────────────────────────
 * Tab 2: Planned vs. Executed Route Audit & Live GPS Map
 *
 * Left Pane (40% width):
 * - Plan Status & Revision Badges
 * - Amber Alert Box if plan was edited (with reason & timestamp)
 * - Side-by-Side Comparison Stepper / List:
 *   - Sequence matches (✅ On Sequence)
 *   - Out-of-sequence / skipped visits (⚠️ Out of Sequence)
 *   - Missed planned stops (❌ Missed)
 *   - Unplanned visits (Purple Ad-Hoc badge)
 * - "+ Inject Mandatory Visit / Follow-Up" modal dialog
 *
 * Right Pane (60% width):
 * - Interactive Leaflet Route Map:
 *   - Blue numbered pins (1, 2, 3...) for planned stops
 *   - Green pins for actual check-in, orange/red for check-out
 *   - Geofence drift warning if check-in vs check-out distance > 500m
 *   - Polyline trace from location_points
 */

import React, { useState, useEffect } from "react";
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Chip,
  Button,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Paper,
  Divider,
  Stack,
  Tooltip,
} from "@mui/material";
import {
  AddLocationAlt as InjectIcon,
  WarningAmber as WarningIcon,
  CheckCircle as SuccessIcon,
  Cancel as MissedIcon,
  Shuffle as SequenceWarningIcon,
  FiberManualRecord as DotIcon,
} from "@mui/icons-material";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { auraManagerAPI, type InjectStopPayload, FALLBACK_PC_OFFICERS } from "../../services/auraApi";
import type { RouteAudit, RoutePlanItem, ActualVisitStop, LocationPoint } from "../../types/aura";

interface Props {
  selectedFoEmail: string | "all";
  selectedDate: string; // "YYYY-MM-DD"
}

// ─── Distance Calculation (Haversine formula in meters) ────────────────────────

function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dp / 2) * Math.sin(dp / 2) +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ─── Custom Leaflet Pin Icons ─────────────────────────────────────────────────

const createPlannedIcon = (num: number) =>
  L.divIcon({
    className: "planned-pin",
    html: `<div style="background-color:#1976d2;color:#ffffff;border-radius:50%;width:26px;height:26px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.35);">${num}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });

const createCheckinIcon = () =>
  L.divIcon({
    className: "checkin-pin",
    html: `<div style="background-color:#2e7d32;color:#ffffff;border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:11px;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.35);">✓</div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });

const createCheckoutIcon = (isDrift: boolean) =>
  L.divIcon({
    className: "checkout-pin",
    html: `<div style="background-color:${isDrift ? "#d32f2f" : "#ed6c02"};color:#ffffff;border-radius:50%;width:18px;height:18px;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.35);"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });

// ─── Main Component ───────────────────────────────────────────────────────────

export default function RouteAuditTab({ selectedFoEmail, selectedDate }: Props) {
  const [audit, setAudit] = useState<RouteAudit | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Inject Stop Dialog State
  const [injectDialogOpen, setInjectDialogOpen] = useState(false);
  const [injectForm, setInjectForm] = useState<InjectStopPayload>({
    fo_user_id: "",
    date: selectedDate,
    customer_id: "",
    customer_name: "",
    village: "",
    taluka: "",
    notes: "",
  });
  const [injectLoading, setInjectLoading] = useState(false);
  const [injectSuccess, setInjectSuccess] = useState(false);

  const effectiveEmail =
    selectedFoEmail === "all"
      ? (FALLBACK_PC_OFFICERS[0]?.email || "solanki.sidhdharaj@paruchemicals.com")
      : selectedFoEmail;

  const effectiveOfficer = FALLBACK_PC_OFFICERS.find((o) => o.email === effectiveEmail);

  useEffect(() => {
    const fetchAudit = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await auraManagerAPI.getRouteAudit({
          fo_user_id: effectiveEmail,
          date: selectedDate,
        });
        setAudit(res.data?.audit ?? null);
      } catch (e: unknown) {
        const err = e as { message?: string };
        setError(err.message ?? "Failed to load route audit");
      } finally {
        setLoading(false);
      }
    };

    fetchAudit();
  }, [effectiveEmail, selectedDate]);

  // Handle Inject Stop
  const handleInjectSubmit = async () => {
    setInjectLoading(true);
    try {
      await auraManagerAPI.injectStop({
        ...injectForm,
        fo_user_id: effectiveEmail,
        date: selectedDate,
        source: "manager_assigned",
      });
      setInjectSuccess(true);
      setTimeout(() => {
        setInjectDialogOpen(false);
        setInjectSuccess(false);
      }, 1200);
      // Reload route audit
      const res = await auraManagerAPI.getRouteAudit({
        fo_user_id: effectiveEmail,
        date: selectedDate,
      });
      setAudit(res.data?.audit ?? null);
    } catch (e: unknown) {
      const err = e as { message?: string };
      setError(err.message ?? "Failed to inject stop");
    } finally {
      setInjectLoading(false);
    }
  };

  // Calculate default map center
  const defaultCenter: [number, number] = [22.3072, 73.1812]; // Vadodara, Gujarat center
  const mapCenter: [number, number] =
    audit?.planned_stops?.[0]?.lat && audit?.planned_stops?.[0]?.lng
      ? [audit.planned_stops[0].lat, audit.planned_stops[0].lng]
      : defaultCenter;

  const polylinePositions: [number, number][] =
    audit?.location_points?.map((p) => [p.lat, p.lng]) ?? [];

  return (
    <Box>
      {selectedFoEmail === "all" && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Showing default route audit for <strong>{effectiveOfficer?.name || effectiveEmail}</strong>. Select any specific officer from the top selector to inspect their route.
        </Alert>
      )}

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Grid container spacing={2}>
        {/* ── Left Pane: Side-by-Side Comparison Timeline (40% width) ──── */}
        <Grid item xs={12} md={5}>
          <Card sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
            <CardContent sx={{ flex: 1 }}>
              {/* Header Badges */}
              <Box display="flex" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1} mb={2}>
                <Box display="flex" gap={1} alignItems="center">
                  <Chip
                    label={audit?.plan_status ? `Plan: ${audit.plan_status.toUpperCase()}` : "Plan: PENDING"}
                    color={audit?.plan_status === "locked" ? "success" : "info"}
                    size="small"
                  />
                  {audit?.is_edited && (
                    <Chip
                      label={`Rev #${audit.edit_revision_number ?? 2} - Edited`}
                      color="warning"
                      size="small"
                    />
                  )}
                </Box>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<InjectIcon />}
                  onClick={() => {
                    setInjectForm({
                      fo_user_id: selectedFoEmail,
                      date: selectedDate,
                      customer_id: "",
                      customer_name: "",
                      village: "",
                      taluka: "",
                      notes: "",
                    });
                    setInjectDialogOpen(true);
                  }}
                >
                  + Inject Stop
                </Button>
              </Box>

              {/* Amber Alert Box if plan was edited */}
              {audit?.is_edited && (
                <Alert
                  severity="warning"
                  icon={<WarningIcon fontSize="inherit" />}
                  sx={{
                    mb: 2,
                    bgcolor: "rgba(237, 108, 2, 0.1)",
                    border: "1px solid rgba(237, 108, 2, 0.4)",
                  }}
                >
                  <Typography variant="body2" fontWeight={600}>
                    Plan Edited by FO {audit.edited_at ? `at ${new Date(audit.edited_at).toLocaleTimeString()}` : ""}
                  </Typography>
                  <Typography variant="caption" display="block">
                    Reason: &ldquo;{audit.edit_reason ?? "No reason specified"}&rdquo;
                  </Typography>
                </Alert>
              )}

              {/* Timeline List of Planned vs Actual Stops */}
              <Typography variant="subtitle2" fontWeight={700} textTransform="uppercase" color="text.secondary" mb={1}>
                Stops Execution Sequence
              </Typography>

              {loading ? (
                <Box display="flex" justifyContent="center" py={4}>
                  <CircularProgress size={30} />
                </Box>
              ) : (
                <Stack spacing={1.5}>
                  {/* Planned stops */}
                  {(audit?.planned_stops ?? []).map((planned, idx) => {
                    // Match with actual visit
                    const actualMatch = audit?.actual_stops?.find(
                      (a) => a.customer_id === planned.customer_id
                    );

                    return (
                      <Paper
                        key={planned.customer_id || idx}
                        variant="outlined"
                        sx={{
                          p: 1.5,
                          borderLeft: "4px solid",
                          borderLeftColor: !actualMatch
                            ? "error.main"
                            : actualMatch.status === "on_sequence"
                            ? "success.main"
                            : "warning.main",
                        }}
                      >
                        <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                          <Box>
                            <Typography variant="body2" fontWeight={700}>
                              Stop #{planned.stop_number}: {planned.customer_name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              📍 {planned.village}, {planned.taluka} · Planned: {planned.planned_time}
                            </Typography>
                          </Box>

                          {/* Status Badge */}
                          {actualMatch ? (
                            actualMatch.status === "on_sequence" ? (
                              <Chip
                                label="✅ On Sequence"
                                color="success"
                                size="small"
                                variant="outlined"
                              />
                            ) : (
                              <Chip
                                label="⚠️ Out of Sequence"
                                color="warning"
                                size="small"
                                variant="outlined"
                              />
                            )
                          ) : (
                            <Chip
                              label="❌ Missed"
                              color="error"
                              size="small"
                              variant="outlined"
                            />
                          )}
                        </Box>

                        {/* Actual visit details */}
                        {actualMatch && (
                          <Box mt={1} pt={1} borderTop="1px dashed" borderColor="divider">
                            <Typography variant="caption" color="text.secondary">
                              Checked In: {new Date(actualMatch.checkin_time).toLocaleTimeString()}
                              {actualMatch.checkout_time
                                ? ` - ${new Date(actualMatch.checkout_time).toLocaleTimeString()} (${actualMatch.duration_minutes ?? 0}m)`
                                : " (In Progress)"}
                            </Typography>
                          </Box>
                        )}
                      </Paper>
                    );
                  })}

                  {/* Ad-Hoc Unplanned Stops */}
                  {(audit?.actual_stops ?? [])
                    .filter((a) => a.status === "adhoc")
                    .map((adhoc, idx) => (
                      <Paper
                        key={adhoc.customer_id || idx}
                        variant="outlined"
                        sx={{
                          p: 1.5,
                          borderLeft: "4px solid #9c27b0",
                          bgcolor: "rgba(156, 39, 176, 0.04)",
                        }}
                      >
                        <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                          <Box>
                            <Typography variant="body2" fontWeight={700}>
                              {adhoc.customer_name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Checked In: {new Date(adhoc.checkin_time).toLocaleTimeString()} · {adhoc.duration_minutes ?? 0} mins
                            </Typography>
                          </Box>
                          <Chip
                            label="🟣 Ad-Hoc Visit"
                            size="small"
                            sx={{ bgcolor: "#9c27b0", color: "white" }}
                          />
                        </Box>
                      </Paper>
                    ))}

                  {(!audit?.planned_stops || audit.planned_stops.length === 0) && (
                    <Typography variant="body2" color="text.secondary" py={2}>
                      No route plan submitted for this date.
                    </Typography>
                  )}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* ── Right Pane: Interactive Leaflet Route Map (60% width) ───── */}
        <Grid item xs={12} md={7}>
          <Card sx={{ height: "100%", minHeight: 520, display: "flex", flexDirection: "column" }}>
            <CardContent sx={{ p: 1, flex: 1, display: "flex", flexDirection: "column" }}>
              <Box display="flex" justifyContent="space-between" alignItems="center" px={1} py={0.5}>
                <Typography variant="subtitle2" fontWeight={700}>
                  Live GPS Route &amp; Geofence Verification Map
                </Typography>
                <Box display="flex" gap={1}>
                  <Chip size="small" label="Blue: Planned" sx={{ bgcolor: "#1976d2", color: "white" }} />
                  <Chip size="small" label="Green: Checked-In" sx={{ bgcolor: "#2e7d32", color: "white" }} />
                </Box>
              </Box>

              <Box sx={{ flex: 1, minHeight: 460, borderRadius: 1.5, overflow: "hidden", mt: 1 }}>
                <MapContainer
                  center={mapCenter}
                  zoom={12}
                  style={{ height: "100%", minHeight: "460px", width: "100%" }}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />

                  {/* Polyline Breadcrumb Trail */}
                  {polylinePositions.length > 1 && (
                    <Polyline
                      positions={polylinePositions}
                      color="#1976d2"
                      weight={4}
                      opacity={0.7}
                      dashArray="4, 6"
                    />
                  )}

                  {/* Planned Pins */}
                  {(audit?.planned_stops ?? []).map((planned) => {
                    if (!planned.lat || !planned.lng) return null;
                    return (
                      <Marker
                        key={`planned-${planned.customer_id}`}
                        position={[planned.lat, planned.lng]}
                        icon={createPlannedIcon(planned.stop_number)}
                      >
                        <Popup>
                          <Typography variant="subtitle2" fontWeight={700}>
                            Stop #{planned.stop_number}: {planned.customer_name}
                          </Typography>
                          <Typography variant="caption" display="block">
                            Planned: {planned.planned_time} · {planned.village}
                          </Typography>
                        </Popup>
                      </Marker>
                    );
                  })}

                  {/* Actual Check-In and Check-Out Pins */}
                  {(audit?.actual_stops ?? []).map((actual) => {
                    if (!actual.checkin_lat || !actual.checkin_lng) return null;

                    // Geofence drift calculation
                    let isDrift = false;
                    let driftMeters = 0;
                    if (actual.checkout_lat && actual.checkout_lng) {
                      driftMeters = calculateDistanceMeters(
                        actual.checkin_lat,
                        actual.checkin_lng,
                        actual.checkout_lat,
                        actual.checkout_lng
                      );
                      if (driftMeters > 500) {
                        isDrift = true;
                      }
                    }

                    return (
                      <React.Fragment key={`actual-${actual.customer_id}`}>
                        {/* Check-In Pin */}
                        <Marker
                          position={[actual.checkin_lat, actual.checkin_lng]}
                          icon={createCheckinIcon()}
                        >
                          <Popup>
                            <Typography variant="subtitle2" fontWeight={700}>
                              Checked In: {actual.customer_name}
                            </Typography>
                            <Typography variant="caption" display="block">
                              Time: {new Date(actual.checkin_time).toLocaleTimeString()}
                            </Typography>
                            {isDrift && (
                              <Alert severity="error" sx={{ mt: 1, py: 0.2, px: 1 }}>
                                <Typography variant="caption" fontWeight={700}>
                                  ⚠️ Geofence Drift: {(driftMeters).toFixed(0)}m &gt; 500m
                                </Typography>
                              </Alert>
                            )}
                          </Popup>
                        </Marker>

                        {/* Check-Out Pin if available */}
                        {actual.checkout_lat && actual.checkout_lng && (
                          <Marker
                            position={[actual.checkout_lat, actual.checkout_lng]}
                            icon={createCheckoutIcon(isDrift)}
                          >
                            <Popup>
                              <Typography variant="subtitle2">
                                Checked Out: {actual.customer_name}
                              </Typography>
                              <Typography variant="caption" display="block">
                                Time: {actual.checkout_time ? new Date(actual.checkout_time).toLocaleTimeString() : ""}
                              </Typography>
                              {isDrift && (
                                <Typography variant="caption" color="error" fontWeight={700}>
                                  Distance from Check-in: {(driftMeters).toFixed(0)}m (Drift Alert)
                                </Typography>
                              )}
                            </Popup>
                          </Marker>
                        )}
                      </React.Fragment>
                    );
                  })}
                </MapContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Inject Mandatory Visit Modal */}
      <Dialog open={injectDialogOpen} onClose={() => setInjectDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Inject Mandatory Stop / Follow-Up</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} mt={1}>
            {injectSuccess && <Alert severity="success">Stop injected! Pushing alert to Field Officer…</Alert>}
            <TextField
              label="Customer ID / Code"
              value={injectForm.customer_id}
              onChange={(e) => setInjectForm((f) => ({ ...f, customer_id: e.target.value }))}
              fullWidth
              required
            />
            <TextField
              label="Customer Name"
              value={injectForm.customer_name}
              onChange={(e) => setInjectForm((f) => ({ ...f, customer_name: e.target.value }))}
              fullWidth
              required
            />
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  label="Village"
                  value={injectForm.village}
                  onChange={(e) => setInjectForm((f) => ({ ...f, village: e.target.value }))}
                  fullWidth
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="Taluka"
                  value={injectForm.taluka}
                  onChange={(e) => setInjectForm((f) => ({ ...f, taluka: e.target.value }))}
                  fullWidth
                />
              </Grid>
            </Grid>
            <TextField
              label="Manager Instructions / Reason"
              value={injectForm.notes}
              onChange={(e) => setInjectForm((f) => ({ ...f, notes: e.target.value }))}
              fullWidth
              multiline
              rows={2}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInjectDialogOpen(false)} disabled={injectLoading}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleInjectSubmit}
            disabled={injectLoading || !injectForm.customer_name || !injectForm.customer_id}
            startIcon={injectLoading ? <CircularProgress size={18} /> : null}
          >
            Inject Stop
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

