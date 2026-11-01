/**
 * FieldManagerWorkspace.tsx
 * ──────────────────────────────────────────────────────────────────────────
 * Main Workspace for MOD-16: Field Officer Management & Verification Console.
 * Powered by AURA Manager & Caller Bridge APIs (v2.0.0).
 */

import { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Grid,
  TextField,
  MenuItem,
  IconButton,
  Badge,
  Menu,
  MenuItem as MuiMenuItem,
  ListItemText,
  Chip,
  Paper,
} from "@mui/material";
import {
  Notifications as BellIcon,
  People as TeamIcon,
  Map as RouteIcon,
  VerifiedUser as VerifyIcon,
  Discount as DiscountIcon,
  History as AuditIcon,
  Inventory as StockIcon,
  Refresh as RefreshIcon,
} from "@mui/icons-material";
import { format } from "date-fns";

import TeamTargetsTab from "./TeamTargetsTab";
import RouteAuditTab from "./RouteAuditTab";
import VisitVerificationTab from "./VisitVerificationTab";
import DiscountAnalyticsTab from "./DiscountAnalyticsTab";
import EditAuditLogTab from "./EditAuditLogTab";
import StockApprovalTab from "./StockApprovalTab";

import { auraManagerAPI, FALLBACK_PC_OFFICERS } from "../../services/auraApi";
import type { FieldOfficerItem, RecentActivityItem } from "../../types/aura";

export default function FieldManagerWorkspace() {
  const [tabIndex, setTabIndex] = useState<number>(0);
  const [selectedFoEmail, setSelectedFoEmail] = useState<string | "all">("all");
  const [selectedMonth, setSelectedMonth] = useState<string>(format(new Date(), "yyyy-MM"));
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));

  const [officers, setOfficers] = useState<FieldOfficerItem[]>(FALLBACK_PC_OFFICERS);
  const [recentActivities, setRecentActivities] = useState<RecentActivityItem[]>([]);
  const [notifAnchor, setNotifAnchor] = useState<null | HTMLElement>(null);
  const [alertsCount, setAlertsCount] = useState<number>(0);

  // Fetch officers for selector dropdown
  const loadOfficers = async () => {
    try {
      const res = await auraManagerAPI.getOfficersList(selectedMonth);
      const data: FieldOfficerItem[] = res.data?.field_officers ?? [];
      setOfficers(data.length > 0 ? data : FALLBACK_PC_OFFICERS);
    } catch (e) {
      console.warn("Could not load officers for dropdown", e);
      setOfficers(FALLBACK_PC_OFFICERS);
    }
  };

  // Fetch dashboard overview for alerts
  const loadOverview = async () => {
    try {
      const res = await auraManagerAPI.getDashboardOverview(selectedMonth);
      if (res.data) {
        const totalAlerts =
          (res.data.alerts?.pending_verifications || 0) +
          (res.data.alerts?.high_discount_orders || 0) +
          (res.data.alerts?.plan_adherence_issues || 0);
        setAlertsCount(totalAlerts);
        setRecentActivities(res.data.recent_activity || []);
      }
    } catch (e) {
      console.warn("Could not load dashboard alerts", e);
    }
  };

  useEffect(() => {
    loadOfficers();
    loadOverview();
  }, [selectedMonth]);

  const handleNavigateToRoute = (foEmail: string) => {
    setSelectedFoEmail(foEmail);
    setTabIndex(1); // Jump to Route Audit Tab
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      {/* ── Top Bar ──────────────────────────────────────────────────────── */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          mb: 3,
          borderRadius: 2,
          border: "1px solid",
          borderColor: "divider",
          bgcolor: "background.paper",
        }}
      >
        <Grid container spacing={2} alignItems="center">
          {/* Title & Subtitle */}
          <Grid item xs={12} md={4}>
            <Box display="flex" alignItems="center" gap={1}>
              <Typography variant="h5" fontWeight={700}>
                Field Officer Console
              </Typography>
              <Chip label="v2.0.0" size="small" color="primary" variant="outlined" />
            </Box>
            <Typography variant="caption" color="text.secondary">
              AURA Management, Route Audit &amp; Verification Terminal
            </Typography>
          </Grid>

          {/* Controls: FO Selector, Month, Date, Notifications */}
          <Grid item xs={12} md={8}>
            <Box display="flex" gap={1.5} justifyContent={{ xs: "flex-start", md: "flex-end" }} flexWrap="wrap" alignItems="center">
              {/* Field Officer 1:N Selector */}
              <TextField
                select
                size="small"
                label="Select Officer"
                value={selectedFoEmail}
                onChange={(e) => setSelectedFoEmail(e.target.value)}
                sx={{ minWidth: 220 }}
              >
                <MenuItem value="all">
                  <em>All My Officers ({officers.length})</em>
                </MenuItem>
                {officers.map((fo) => (
                  <MenuItem key={fo.email} value={fo.email}>
                    {fo.name} ({fo.email})
                  </MenuItem>
                ))}
              </TextField>

              {/* Month Picker */}
              <TextField
                type="month"
                size="small"
                label="Month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{ width: 145 }}
              />

              {/* Date Picker */}
              <TextField
                type="date"
                size="small"
                label="Date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{ width: 155 }}
              />

              {/* Refresh Button */}
              <IconButton onClick={() => { loadOfficers(); loadOverview(); }} title="Refresh Data">
                <RefreshIcon />
              </IconButton>

              {/* Notification Bell */}
              <IconButton
                onClick={(e) => setNotifAnchor(e.currentTarget)}
                color={alertsCount > 0 ? "primary" : "default"}
              >
                <Badge badgeContent={alertsCount} color="error">
                  <BellIcon />
                </Badge>
              </IconButton>

              {/* Notification Popover Menu */}
              <Menu
                anchorEl={notifAnchor}
                open={Boolean(notifAnchor)}
                onClose={() => setNotifAnchor(null)}
                PaperProps={{ sx: { width: 350, maxHeight: 420 } }}
              >
                <Box p={1.5} borderBottom="1px solid" borderColor="divider">
                  <Typography variant="subtitle2" fontWeight={700}>
                    Recent Activity &amp; Live Alerts
                  </Typography>
                </Box>
                {recentActivities.length === 0 ? (
                  <Box p={2} textAlign="center">
                    <Typography variant="body2" color="text.secondary">
                      No recent alerts for this period
                    </Typography>
                  </Box>
                ) : (
                  recentActivities.map((act, i) => (
                    <MuiMenuItem key={i} sx={{ alignItems: "flex-start", py: 1 }}>
                      <ListItemText
                        primary={
                          <Typography variant="body2" fontWeight={600}>
                            {act.type.toUpperCase()}: {act.field_officer}
                          </Typography>
                        }
                        secondary={
                          <Box>
                            <Typography variant="caption" color="text.secondary">
                              Customer: {act.customer}
                              {act.amount !== undefined ? ` · ₹${act.amount.toLocaleString()}` : ""}
                              {act.discount_percent !== undefined ? ` (${act.discount_percent}% off)` : ""}
                            </Typography>
                            <Typography variant="caption" color="text.disabled" display="block">
                              {new Date(act.timestamp).toLocaleTimeString()}
                            </Typography>
                          </Box>
                        }
                      />
                    </MuiMenuItem>
                  ))
                )}
              </Menu>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* ── Operational Tabs ────────────────────────────────────────────── */}
      <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 3 }}>
        <Tabs
          value={tabIndex}
          onChange={(_, idx) => setTabIndex(idx)}
          variant="scrollable"
          scrollButtons="auto"
          textColor="primary"
          indicatorColor="primary"
        >
          <Tab icon={<TeamIcon />} iconPosition="start" label="Team &amp; Targets" />
          <Tab icon={<RouteIcon />} iconPosition="start" label="Route Audit &amp; GPS" />
          <Tab icon={<VerifyIcon />} iconPosition="start" label="Visit Verification" />
          <Tab icon={<DiscountIcon />} iconPosition="start" label="Discount Ledger" />
          <Tab icon={<AuditIcon />} iconPosition="start" label="Edit Audit Log" />
          <Tab icon={<StockIcon />} iconPosition="start" label="Stock Approvals" />
        </Tabs>
      </Box>

      {/* ── Tab Views ───────────────────────────────────────────────────── */}
      {tabIndex === 0 && (
        <TeamTargetsTab
          selectedFoEmail={selectedFoEmail}
          selectedMonth={selectedMonth}
          onViewRoute={handleNavigateToRoute}
        />
      )}

      {tabIndex === 1 && (
        <RouteAuditTab
          selectedFoEmail={selectedFoEmail}
          selectedDate={selectedDate}
        />
      )}

      {tabIndex === 2 && (
        <VisitVerificationTab
          selectedFoEmail={selectedFoEmail}
          selectedDate={selectedDate}
        />
      )}

      {tabIndex === 3 && (
        <DiscountAnalyticsTab
          selectedFoEmail={selectedFoEmail}
          selectedMonth={selectedMonth}
        />
      )}

      {tabIndex === 4 && (
        <EditAuditLogTab
          selectedFoEmail={selectedFoEmail}
        />
      )}

      {tabIndex === 5 && (
        <StockApprovalTab
          selectedFoEmail={selectedFoEmail}
        />
      )}
    </Box>
  );
}
