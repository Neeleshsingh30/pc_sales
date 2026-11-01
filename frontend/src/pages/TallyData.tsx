import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  TextField,
  MenuItem,
  Button,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Tooltip,
  ToggleButtonGroup,
  ToggleButton,
  InputAdornment,
  CircularProgress,
  useTheme,
  Paper,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  TablePagination,
} from "@mui/material";
import {
  Refresh as RefreshIcon,
  Search as SearchIcon,
  FilterList as FilterListIcon,
  Clear as ClearIcon,
  ReceiptLong as ReceiptLongIcon,
  DeleteSweep as DeleteSweepIcon,
  Sync as SyncIcon,
  Visibility as VisibilityIcon,
  AccountBalanceWallet as WalletIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  ArrowForward as ArrowForwardIcon,
} from "@mui/icons-material";
import { DataGrid, GridColDef, GridRenderCellParams } from "@mui/x-data-grid";
import { tallyAPI } from "../services/api";
import type { TallyVoucher, TallyStats, TallyFilterOptions } from "../types";
import { TableSkeleton } from "../components/Skeletons";

export default function TallyData() {
  const theme = useTheme();

  // Stats state
  const [stats, setStats] = useState<TallyStats>({
    total_active: 0,
    total_deleted: 0,
    last_synced_at: null,
  });

  // Filter options state
  const [filterOptions, setFilterOptions] = useState<TallyFilterOptions>({
    voucher_types: [],
    customers: [],
  });

  // Filters state
  const [search, setSearch] = useState("");
  const [selectedCompany, setSelectedCompany] = useState<string>("");
  const [voucherType, setVoucherType] = useState<string>("");
  const [selectedCustomer, setSelectedCustomer] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  // View mode: 'all' | 'customer'
  const [viewMode, setViewMode] = useState<"all" | "customer">("all");

  // Grid / Data state
  const [vouchers, setVouchers] = useState<TallyVoucher[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [page, setPage] = useState(0); // 0-indexed for DataGrid
  const [pageSize, setPageSize] = useState(50);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Selected voucher dialog
  const [selectedVoucher, setSelectedVoucher] = useState<TallyVoucher | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Customer Breakdown State
  const [customerVouchers, setCustomerVouchers] = useState<TallyVoucher[]>([]);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [customerPage, setCustomerPage] = useState(0);
  const [customerRowsPerPage, setCustomerRowsPerPage] = useState(50);

  // Load stats & filter options on mount
  const fetchMetadata = useCallback(async () => {
    try {
      const [statsData, optionsData] = await Promise.all([
        tallyAPI.getStats(selectedCompany ? { company: selectedCompany } : undefined),
        tallyAPI.getFilterOptions(selectedCompany ? { company: selectedCompany } : undefined),
      ]);
      setStats(statsData);
      setFilterOptions(optionsData);
    } catch (err) {
      console.error("Failed to load Tally metadata", err);
    }
  }, [selectedCompany]);

  // Check if any filter is active (search, company, voucherType, customer, or dates)
  const hasActiveFilters = Boolean(
    search.trim() || selectedCompany || voucherType || selectedCustomer || dateFrom || dateTo
  );

  // Date handlers with automatic boundary correction
  const handleDateFromChange = (newFrom: string) => {
    setDateFrom(newFrom);
    setPage(0);
    if (newFrom && dateTo && newFrom > dateTo) {
      setDateTo(newFrom);
    }
  };

  const handleDateToChange = (newTo: string) => {
    setDateTo(newTo);
    setPage(0);
    if (newTo && dateFrom && newTo < dateFrom) {
      setDateFrom(newTo);
    }
  };

  // Fetch paginated vouchers
  const fetchVouchers = useCallback(async () => {
    // Keep initial page clean until user selects/enters any filter
    if (!search.trim() && !selectedCompany && !voucherType && !selectedCustomer && !dateFrom && !dateTo) {
      setVouchers([]);
      setTotalRows(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const params: any = {
        page: page + 1, // 1-indexed for backend
        page_size: pageSize,
      };
      if (search.trim()) params.search = search.trim();
      if (selectedCompany) params.company = selectedCompany;
      if (voucherType) params.voucher_type = voucherType;
      if (selectedCustomer) params.customer = selectedCustomer;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;

      const res = await tallyAPI.getVouchers(params);
      setVouchers(res.data || []);
      setTotalRows(res.total || 0);
    } catch (err) {
      console.error("Failed to fetch vouchers", err);
      setVouchers([]);
      setTotalRows(0);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, selectedCompany, voucherType, selectedCustomer, dateFrom, dateTo]);

  // Fetch full customer statement for Customer Breakdown view
  const fetchCustomerBreakdown = useCallback(async (custName: string) => {
    if (!custName) {
      setCustomerVouchers([]);
      return;
    }
    setCustomerLoading(true);
    setCustomerPage(0);
    try {
      const params: any = {
        customer: custName,
        page: 1,
        page_size: 5000, // Load full customer ledger so true running balance & grand totals calculate accurately
        order: "asc",
      };
      if (selectedCompany) params.company = selectedCompany;
      const res = await tallyAPI.getVouchers(params);
      setCustomerVouchers(res.data || []);
    } catch (err) {
      console.error("Failed to load customer breakdown", err);
      setCustomerVouchers([]);
    } finally {
      setCustomerLoading(false);
    }
  }, [selectedCompany]);

  useEffect(() => {
    fetchMetadata();
  }, [fetchMetadata]);

  useEffect(() => {
    if (viewMode === "all") {
      fetchVouchers();
    }
  }, [fetchVouchers, viewMode]);

  useEffect(() => {
    if (viewMode === "customer" && selectedCustomer) {
      fetchCustomerBreakdown(selectedCustomer);
    }
  }, [viewMode, selectedCustomer, fetchCustomerBreakdown]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchMetadata(),
      viewMode === "all" ? fetchVouchers() : fetchCustomerBreakdown(selectedCustomer),
    ]);
    setRefreshing(false);
  };

  const handleResetFilters = () => {
    setSearch("");
    setSelectedCompany("");
    setVoucherType("");
    setSelectedCustomer("");
    setDateFrom("");
    setDateTo("");
    setPage(0);
  };

  // Helper for Voucher Type Color Chip
  const getVchTypeColor = (type?: string): "success" | "info" | "warning" | "secondary" | "error" | "default" => {
    if (!type) return "default";
    const lower = type.toLowerCase();
    if (lower.includes("sales")) return "success";
    if (lower.includes("receipt")) return "info";
    if (lower.includes("payment")) return "warning";
    if (lower.includes("contra")) return "secondary";
    if (lower.includes("journal")) return "secondary";
    if (lower.includes("purchase")) return "error";
    return "default";
  };

  // Format datetime into Indian Standard Time (Asia/Kolkata)
  const formatISTDateTime = (dateStr: string | null | undefined): string => {
    if (!dateStr) return "-";
    let s = dateStr.trim();
    if (!s.endsWith("Z") && !/[+-]\d{2}:\d{2}$/.test(s)) {
      s += "Z";
    }
    try {
      return new Date(s).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });
    } catch {
      return dateStr;
    }
  };

  // Format INR currency
  const formatINR = (val?: number) => {
    if (val === undefined || val === null) return "₹0.00";
    return `₹${Number(val).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  // Customer Breakdown Totals & Running Balance matching Mock DB Viewer
  const customerSummary = useMemo(() => {
    // Check if any voucher contains customer metadata / opening balance
    const firstWithExtra = customerVouchers.find(
      (v) =>
        v.extra_fields &&
        (v.extra_fields._opening_balance !== undefined ||
          v.extra_fields["Opening Balance"] !== undefined)
    );
    const rawOpBal = firstWithExtra?.extra_fields?._opening_balance ?? 0;
    const openingBalance = Number(rawOpBal) || 0;
    const openingBalanceType =
      firstWithExtra?.extra_fields?._opening_balance_type ||
      (openingBalance >= 0 ? "Dr" : "Cr");
    const customerGroup =
      firstWithExtra?.extra_fields?._customer_group ||
      firstWithExtra?.extra_fields?.["Customer Group"] ||
      "Sundry Debtors";

    // Filter customer vouchers by any additional active filters (voucherType, search, dates)
    let filtered = [...customerVouchers];

    if (voucherType) {
      const vt = voucherType.toLowerCase().trim();
      filtered = filtered.filter(
        (v) => (v.voucher_type || "").toLowerCase().trim() === vt
      );
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter(
        (v) =>
          (v.voucher_no || "").toLowerCase().includes(q) ||
          (v.customer_name || "").toLowerCase().includes(q) ||
          (v.particulars || "").toLowerCase().includes(q) ||
          (v.narration || "").toLowerCase().includes(q) ||
          (v.items_summary || "").toLowerCase().includes(q)
      );
    }

    if (dateFrom) {
      filtered = filtered.filter((v) => (v.date || "") >= dateFrom);
    }

    if (dateTo) {
      filtered = filtered.filter((v) => (v.date || "") <= dateTo);
    }

    let totalDebit = 0;
    let totalCredit = 0;

    // Vouchers sorted chronologically for statement
    const sorted = filtered.sort((a, b) => {
      const d1 = a.date || "";
      const d2 = b.date || "";
      return d1.localeCompare(d2);
    });

    let runningBalance = openingBalance;
    const withRunningBalance = sorted.map((v) => {
      const deb = Number(v.debit || 0);
      const cred = Number(v.credit || 0);
      totalDebit += deb;
      totalCredit += cred;
      runningBalance += deb - cred;
      return {
        ...v,
        running_balance: runningBalance,
        running_balance_str:
          runningBalance > 0
            ? `${formatINR(runningBalance)} Dr`
            : runningBalance < 0
            ? `${formatINR(Math.abs(runningBalance))} Cr`
            : "₹0.00",
      };
    });

    const closingBalance = openingBalance + totalDebit - totalCredit;

    return {
      openingBalance,
      openingBalanceType,
      customerGroup,
      totalDebit,
      totalCredit,
      closingBalance,
      closingBalanceType: closingBalance >= 0 ? "Dr" : "Cr",
      records: withRunningBalance,
    };
  }, [customerVouchers, voucherType, search, dateFrom, dateTo]);

  // Reset customer page when any filter changes
  useEffect(() => {
    setCustomerPage(0);
  }, [voucherType, search, dateFrom, dateTo, selectedCustomer]);

  // Sliced records for smooth table pagination
  const pagedCustomerRecords = useMemo(() => {
    const start = customerPage * customerRowsPerPage;
    return customerSummary.records.slice(start, start + customerRowsPerPage);
  }, [customerSummary.records, customerPage, customerRowsPerPage]);

  // Columns for DataGrid in "All Vouchers"
  const columns: GridColDef[] = useMemo(
    () => [
      {
        field: "date",
        headerName: "Date",
        width: 110,
        renderCell: (params: GridRenderCellParams) => (
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            {params.value || "-"}
          </Typography>
        ),
      },
      {
        field: "voucher_no",
        headerName: "Vch No",
        width: 140,
        renderCell: (params: GridRenderCellParams) => (
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              fontFamily: "monospace",
              color: theme.palette.mode === "dark" ? "#90caf9" : "#1565c0",
            }}
          >
            {params.value || "-"}
          </Typography>
        ),
      },
      {
        field: "voucher_type",
        headerName: "Type",
        width: 120,
        renderCell: (params: GridRenderCellParams) => (
          <Chip
            label={params.value || "Other"}
            size="small"
            color={getVchTypeColor(params.value)}
            variant="outlined"
            sx={{ fontWeight: 600, textTransform: "capitalize" }}
          />
        ),
      },
      {
        field: "company_name",
        headerName: "Company",
        width: 150,
        renderCell: (params: GridRenderCellParams) => (
          <Typography variant="body2" color="text.secondary" noWrap>
            {params.value || "-"}
          </Typography>
        ),
      },
      {
        field: "customer_name",
        headerName: "Customer / Party",
        flex: 1,
        minWidth: 180,
        renderCell: (params: GridRenderCellParams) => (
          <Typography variant="body2" sx={{ fontWeight: 500 }} noWrap>
            {params.value || "-"}
          </Typography>
        ),
      },
      {
        field: "particulars",
        headerName: "Particulars",
        flex: 1,
        minWidth: 160,
        renderCell: (params: GridRenderCellParams) => (
          <Typography variant="body2" color="text.secondary" noWrap>
            {params.value || "-"}
          </Typography>
        ),
      },
      {
        field: "narration",
        headerName: "Narration / Items",
        flex: 1,
        minWidth: 200,
        renderCell: (params: GridRenderCellParams) => {
          const text = params.row.items_summary || params.row.narration || "-";
          return (
            <Tooltip title={text} arrow>
              <Typography variant="body2" color="text.secondary" noWrap>
                {text}
              </Typography>
            </Tooltip>
          );
        },
      },
      {
        field: "debit",
        headerName: "Debit (₹)",
        width: 120,
        align: "right",
        headerAlign: "right",
        renderCell: (params: GridRenderCellParams) => (
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              color: params.value > 0 ? "error.main" : "text.secondary",
            }}
          >
            {params.value > 0 ? formatINR(params.value) : "-"}
          </Typography>
        ),
      },
      {
        field: "credit",
        headerName: "Credit (₹)",
        width: 120,
        align: "right",
        headerAlign: "right",
        renderCell: (params: GridRenderCellParams) => (
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              color: params.value > 0 ? "success.main" : "text.secondary",
            }}
          >
            {params.value > 0 ? formatINR(params.value) : "-"}
          </Typography>
        ),
      },
      {
        field: "actions",
        headerName: "",
        width: 70,
        sortable: false,
        align: "center",
        renderCell: (params: GridRenderCellParams) => (
          <IconButton
            size="small"
            color="primary"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedVoucher(params.row as TallyVoucher);
              setDetailsOpen(true);
            }}
          >
            <VisibilityIcon fontSize="small" />
          </IconButton>
        ),
      },
    ],
    [theme.palette.mode]
  );

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, display: "flex", flexDirection: "column", gap: 3 }}>
      {/* Header & Stats Banner */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 2,
        }}
      >
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 1.5 }}>
            <ReceiptLongIcon sx={{ fontSize: 36, color: "primary.main" }} />
            Tally Data
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Synchronized financial accounting transactions and ledger statements from TallyPrime
          </Typography>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(_, val) => val && setViewMode(val)}
            size="small"
            color="primary"
          >
            <ToggleButton value="all" sx={{ px: 2, fontWeight: 600 }}>
              Master DB
            </ToggleButton>
            <ToggleButton value="customer" sx={{ px: 2, fontWeight: 600 }}>
              Ledger Breakdown
            </ToggleButton>
          </ToggleButtonGroup>

          <Button
            variant="outlined"
            startIcon={
              <RefreshIcon
                sx={{
                  animation: refreshing ? "spin 1s linear infinite" : "none",
                  "@keyframes spin": {
                    "0%": { transform: "rotate(0deg)" },
                    "100%": { transform: "rotate(360deg)" },
                  },
                }}
              />
            }
            onClick={handleRefresh}
            disabled={refreshing || loading}
            sx={{ textTransform: "none", fontWeight: 600 }}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={2}>
        <Grid item xs={12} sm={4}>
          <Card
            elevation={0}
            sx={{
              p: 2,
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 2,
              background:
                theme.palette.mode === "dark"
                  ? "linear-gradient(135deg, rgba(25,118,210,0.12) 0%, rgba(13,71,161,0.05) 100%)"
                  : "linear-gradient(135deg, rgba(227,242,253,0.8) 0%, rgba(255,255,255,0.9) 100%)",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <Box
                sx={{
                  p: 1.2,
                  borderRadius: 1.5,
                  bgcolor: "primary.main",
                  color: "white",
                  display: "flex",
                }}
              >
                <ReceiptLongIcon />
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: "uppercase" }}>
                  Active Vouchers
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  {stats.total_active.toLocaleString()}
                </Typography>
              </Box>
            </Box>
          </Card>
        </Grid>

        <Grid item xs={12} sm={4}>
          <Card
            elevation={0}
            sx={{
              p: 2,
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 2,
              background:
                theme.palette.mode === "dark"
                  ? "linear-gradient(135deg, rgba(237,108,2,0.12) 0%, rgba(230,81,0,0.05) 100%)"
                  : "linear-gradient(135deg, rgba(255,243,224,0.8) 0%, rgba(255,255,255,0.9) 100%)",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <Box
                sx={{
                  p: 1.2,
                  borderRadius: 1.5,
                  bgcolor: "warning.main",
                  color: "white",
                  display: "flex",
                }}
              >
                <DeleteSweepIcon />
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: "uppercase" }}>
                  Soft Deleted in Tally
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  {stats.total_deleted.toLocaleString()}
                </Typography>
              </Box>
            </Box>
          </Card>
        </Grid>

        <Grid item xs={12} sm={4}>
          <Card
            elevation={0}
            sx={{
              p: 2,
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 2,
              background:
                theme.palette.mode === "dark"
                  ? "linear-gradient(135deg, rgba(46,125,50,0.12) 0%, rgba(27,94,32,0.05) 100%)"
                  : "linear-gradient(135deg, rgba(232,245,233,0.8) 0%, rgba(255,255,255,0.9) 100%)",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <Box
                sx={{
                  p: 1.2,
                  borderRadius: 1.5,
                  bgcolor: "success.main",
                  color: "white",
                  display: "flex",
                }}
              >
                <SyncIcon />
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: "uppercase" }}>
                  Last Synced At
                </Typography>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  {stats.last_synced_at
                    ? formatISTDateTime(stats.last_synced_at)
                    : "Not yet synced"}
                </Typography>
              </Box>
            </Box>
          </Card>
        </Grid>
      </Grid>

      {/* Filter Toolbar */}
      <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
        <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
          <Grid container spacing={2} alignItems="center">
            {/* Search Input */}
            <Grid item xs={12} sm={6} md={2.5}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search voucher, party, items..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" color="action" />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>

            {/* Company Dropdown */}
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                select
                fullWidth
                size="small"
                label="Company"
                value={selectedCompany}
                onChange={(e) => {
                  setSelectedCompany(e.target.value);
                  setPage(0);
                }}
              >
                <MenuItem value="">
                  <em>All Companies</em>
                </MenuItem>
                {(filterOptions.companies || []).map((co) => (
                  <MenuItem key={co} value={co}>
                    {co}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            {/* Voucher Type Dropdown */}
            <Grid item xs={12} sm={6} md={1.8}>
              <TextField
                select
                fullWidth
                size="small"
                label="Voucher Type"
                value={voucherType}
                onChange={(e) => {
                  setVoucherType(e.target.value);
                  setPage(0);
                }}
              >
                <MenuItem value="">
                  <em>All Types</em>
                </MenuItem>
                {filterOptions.voucher_types.map((t) => (
                  <MenuItem key={t} value={t}>
                    {t}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            {/* Customer Dropdown */}
            <Grid item xs={12} sm={6} md={2.2}>
              <TextField
                select
                fullWidth
                size="small"
                label="Customer / Party"
                value={selectedCustomer}
                onChange={(e) => {
                  setSelectedCustomer(e.target.value);
                  setPage(0);
                }}
              >
                <MenuItem value="">
                  <em>All Customers</em>
                </MenuItem>
                {filterOptions.customers.map((c) => (
                  <MenuItem key={c} value={c}>
                    {c}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            {/* Date From */}
            <Grid item xs={6} sm={3} md={1.25}>
              <TextField
                fullWidth
                size="small"
                type="date"
                label="From Date"
                InputLabelProps={{ shrink: true }}
                inputProps={{ max: dateTo || undefined }}
                value={dateFrom}
                onChange={(e) => handleDateFromChange(e.target.value)}
              />
            </Grid>

            {/* Date To */}
            <Grid item xs={6} sm={3} md={1.25}>
              <TextField
                fullWidth
                size="small"
                type="date"
                label="To Date"
                InputLabelProps={{ shrink: true }}
                inputProps={{ min: dateFrom || undefined }}
                value={dateTo}
                onChange={(e) => handleDateToChange(e.target.value)}
              />
            </Grid>

            {/* Clear Filters Button */}
            <Grid item xs={12} md={1} sx={{ display: "flex", justifyContent: "flex-end" }}>
              <Tooltip title="Reset Filters">
                <Button
                  variant="outlined"
                  color="inherit"
                  onClick={handleResetFilters}
                  sx={{ minWidth: 40, p: 1 }}
                >
                  <ClearIcon fontSize="small" />
                </Button>
              </Tooltip>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Main Content: Mode View */}
      {viewMode === "all" ? (
        !hasActiveFilters ? (
          <Paper
            elevation={0}
            sx={{
              p: 6,
              textAlign: "center",
              border: "1px dashed",
              borderColor: "divider",
              borderRadius: 2,
              bgcolor: "background.paper",
              my: 2,
            }}
          >
            <FilterListIcon sx={{ fontSize: 48, color: "text.secondary", mb: 2 }} />
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
              Select Any Filter to View Records
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 520, mx: "auto" }}>
              Choose a Customer / Party, select a Voucher Type, pick a Date range, or type a search query above to display transactions. All filters can be used individually or combined together.
            </Typography>
          </Paper>
        ) : (
          <Card
            elevation={0}
            sx={{
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 2,
              minHeight: 520,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <Box sx={{ flex: 1, height: 600, width: "100%" }}>
              {loading && vouchers.length === 0 ? (
                <Box sx={{ p: 3 }}>
                  <TableSkeleton rows={10} columns={7} />
                </Box>
              ) : (
                <DataGrid
                  rows={vouchers}
                  columns={columns}
                  getRowId={(row) => row.id}
                  rowCount={totalRows}
                  loading={loading}
                  paginationMode="server"
                  paginationModel={{ page, pageSize }}
                  onPaginationModelChange={(model) => {
                    setPage(model.page);
                    setPageSize(model.pageSize);
                  }}
                  pageSizeOptions={[25, 50, 100]}
                  disableRowSelectionOnClick
                  onRowClick={(params) => {
                    setSelectedVoucher(params.row as TallyVoucher);
                    setDetailsOpen(true);
                  }}
                  sx={{
                    border: "none",
                    "& .MuiDataGrid-row:hover": {
                      cursor: "pointer",
                    },
                  }}
                />
              )}
            </Box>
          </Card>
        )
      ) : (
        /* Customer Breakdown View - 1-to-1 Parity with Desktop Mock DB Viewer */
        <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {selectedCustomer ? (
            <>
              {/* Customer Ledger Info & Opening Balance Header */}
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  bgcolor: "background.paper",
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 2,
                  display: "flex",
                  flexWrap: "wrap",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 2,
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    Ledger: {selectedCustomer}
                  </Typography>
                  <Divider orientation="vertical" flexItem sx={{ height: 18, my: "auto" }} />
                  <Typography variant="body2" color="text.secondary">
                    Group: {customerSummary.customerGroup}
                  </Typography>
                </Box>
                <Chip
                  label={`Opening Balance: ${formatINR(Math.abs(customerSummary.openingBalance))} ${customerSummary.openingBalanceType}`}
                  color="warning"
                  variant="outlined"
                  sx={{ fontWeight: 700, fontFamily: "monospace", px: 1 }}
                />
              </Paper>

              {/* 4 Financial Metric Cards */}
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2,
                      border: "1px solid",
                      borderColor: "divider",
                      borderRadius: 2,
                      display: "flex",
                      alignItems: "center",
                      gap: 2,
                    }}
                  >
                    <WalletIcon color="warning" sx={{ fontSize: 32 }} />
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        OPENING BALANCE
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 700, color: "warning.main" }}>
                        {formatINR(Math.abs(customerSummary.openingBalance))}{" "}
                        {customerSummary.openingBalanceType}
                      </Typography>
                    </Box>
                  </Paper>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2,
                      border: "1px solid",
                      borderColor: "divider",
                      borderRadius: 2,
                      display: "flex",
                      alignItems: "center",
                      gap: 2,
                    }}
                  >
                    <TrendingDownIcon color="error" sx={{ fontSize: 32 }} />
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        TOTAL INVOICED (DEBIT)
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 700, color: "error.main" }}>
                        {formatINR(customerSummary.totalDebit)}
                      </Typography>
                    </Box>
                  </Paper>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2,
                      border: "1px solid",
                      borderColor: "divider",
                      borderRadius: 2,
                      display: "flex",
                      alignItems: "center",
                      gap: 2,
                    }}
                  >
                    <TrendingUpIcon color="success" sx={{ fontSize: 32 }} />
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        TOTAL RECEIVED (CREDIT)
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 700, color: "success.main" }}>
                        {formatINR(customerSummary.totalCredit)}
                      </Typography>
                    </Box>
                  </Paper>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2,
                      border: "1px solid",
                      borderColor: "divider",
                      borderRadius: 2,
                      display: "flex",
                      alignItems: "center",
                      gap: 2,
                    }}
                  >
                    <WalletIcon color="primary" sx={{ fontSize: 32 }} />
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        CLOSING BALANCE
                      </Typography>
                      <Typography
                        variant="h6"
                        sx={{
                          fontWeight: 700,
                          color:
                            customerSummary.closingBalance >= 0
                              ? "error.main"
                              : "success.main",
                        }}
                      >
                        {formatINR(Math.abs(customerSummary.closingBalance))}{" "}
                        {customerSummary.closingBalanceType}
                      </Typography>
                    </Box>
                  </Paper>
                </Grid>
              </Grid>

              {/* Statement Table matching Mock DB Viewer 1-to-1 */}
              <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
                <TableContainer>
                  {customerLoading ? (
                    <Box sx={{ p: 4 }}>
                      <TableSkeleton rows={8} columns={10} />
                    </Box>
                  ) : (
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ bgcolor: "action.hover" }}>
                          <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Particulars (Contra)</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Vch Type</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Vch No.</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Items / Narration</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Custom Fields</TableCell>
                          <TableCell sx={{ fontWeight: 700 }} align="right">
                            Debit (₹)
                          </TableCell>
                          <TableCell sx={{ fontWeight: 700 }} align="right">
                            Credit (₹)
                          </TableCell>
                          <TableCell sx={{ fontWeight: 700 }} align="right">
                            Balance (₹)
                          </TableCell>
                          <TableCell align="center"></TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {customerSummary.records.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={10} align="center" sx={{ py: 4, color: "text.secondary" }}>
                              No transactions found for this customer.
                            </TableCell>
                          </TableRow>
                        ) : (
                          pagedCustomerRecords.map((row) => {
                            const items = row.items_summary || "";
                            const narr = row.narration || "";
                            const itemDisplay = items && narr ? `${items} — ${narr}` : items || narr || "—";

                            const extra = row.extra_fields || {};
                            const extraKeys = Object.keys(extra).filter(
                              (k) => !k.startsWith("_") && k !== "Customer Group" && k !== "Opening Balance"
                            );
                            const extraSummary =
                              extraKeys.length > 0
                                ? extraKeys.map((k) => `${k}: ${extra[k]}`).join("; ")
                                : "—";

                            const isDr = (row as any).running_balance >= 0;

                            return (
                              <TableRow
                                key={row.id}
                                hover
                                sx={{ cursor: "pointer" }}
                                onClick={() => {
                                  setSelectedVoucher(row);
                                  setDetailsOpen(true);
                                }}
                              >
                                <TableCell sx={{ whiteSpace: "nowrap" }}>{row.date || "-"}</TableCell>
                                <TableCell>{row.particulars || "-"}</TableCell>
                                <TableCell>
                                  <Chip
                                    label={row.voucher_type || "Other"}
                                    size="small"
                                    color={getVchTypeColor(row.voucher_type)}
                                    variant="outlined"
                                  />
                                </TableCell>
                                <TableCell sx={{ fontFamily: "monospace", fontWeight: 600, whiteSpace: "nowrap" }}>
                                  {row.voucher_no || "-"}
                                </TableCell>
                                <TableCell sx={{ maxWidth: 240 }}>
                                  <Typography
                                    variant="body2"
                                    sx={{ fontSize: "0.82rem" }}
                                    noWrap
                                    title={itemDisplay}
                                  >
                                    {itemDisplay}
                                  </Typography>
                                </TableCell>
                                <TableCell sx={{ maxWidth: 160 }}>
                                  <Typography
                                    variant="caption"
                                    sx={{
                                      fontFamily: "monospace",
                                      fontSize: "0.75rem",
                                      color: extraKeys.length > 0 ? "text.primary" : "text.secondary",
                                    }}
                                    noWrap
                                    title={extraSummary}
                                  >
                                    {extraSummary}
                                  </Typography>
                                </TableCell>
                                <TableCell align="right" sx={{ color: "error.main", fontWeight: 600, whiteSpace: "nowrap" }}>
                                  {row.debit > 0 ? formatINR(row.debit) : "-"}
                                </TableCell>
                                <TableCell align="right" sx={{ color: "success.main", fontWeight: 600, whiteSpace: "nowrap" }}>
                                  {row.credit > 0 ? formatINR(row.credit) : "-"}
                                </TableCell>
                                <TableCell
                                  align="right"
                                  sx={{
                                    fontWeight: 700,
                                    fontFamily: "monospace",
                                    color: isDr ? "error.main" : "success.main",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {formatINR(Math.abs((row as any).running_balance))}{" "}
                                  {isDr ? "Dr" : "Cr"}
                                </TableCell>
                                <TableCell align="center">
                                  <IconButton size="small">
                                    <VisibilityIcon fontSize="small" />
                                  </IconButton>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  )}
                </TableContainer>

                {/* Pagination Controls */}
                {customerSummary.records.length > 0 && (
                  <TablePagination
                    component="div"
                    count={customerSummary.records.length}
                    page={customerPage}
                    onPageChange={(_, newPage) => setCustomerPage(newPage)}
                    rowsPerPage={customerRowsPerPage}
                    onRowsPerPageChange={(e) => {
                      setCustomerRowsPerPage(parseInt(e.target.value, 10));
                      setCustomerPage(0);
                    }}
                    rowsPerPageOptions={[25, 50, 100, 200]}
                    sx={{ borderTop: "1px solid", borderColor: "divider" }}
                  />
                )}

                {/* Footer Totals Bar matching Mock DB Viewer */}
                <Box
                  sx={{
                    p: 2,
                    bgcolor: "action.hover",
                    borderTop: "1px solid",
                    borderColor: "divider",
                    display: "flex",
                    flexWrap: "wrap",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 2,
                  }}
                >
                  <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                    {customerSummary.records.length} Voucher(s) for {selectedCustomer}
                  </Typography>
                  <Typography variant="body2" sx={{ fontFamily: "monospace", fontWeight: 700 }}>
                    Current Total: Debit{" "}
                    <span style={{ color: theme.palette.error.main }}>
                      {formatINR(customerSummary.totalDebit)}
                    </span>
                    {"  │  "}
                    Credit{" "}
                    <span style={{ color: theme.palette.success.main }}>
                      {formatINR(customerSummary.totalCredit)}
                    </span>
                    {"  │  "}
                    Closing Balance:{" "}
                    <span
                      style={{
                        color:
                          customerSummary.closingBalance >= 0
                            ? theme.palette.error.main
                            : theme.palette.success.main,
                      }}
                    >
                      {formatINR(Math.abs(customerSummary.closingBalance))}{" "}
                      {customerSummary.closingBalanceType}
                    </span>
                  </Typography>
                </Box>
              </Card>
            </>
          ) : (
            <Paper
              elevation={0}
              sx={{
                p: 4,
                textAlign: "center",
                border: "1px dashed",
                borderColor: "divider",
                borderRadius: 2,
              }}
            >
              <Typography variant="subtitle1" color="text.secondary">
                Please select a Customer / Party from the dropdown above to view their chronological ledger statement.
              </Typography>
            </Paper>
          )}
        </Box>
      )}

      {/* Voucher Detail Modal */}
      <Dialog
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <ReceiptLongIcon color="primary" />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Voucher Details
            </Typography>
          </Box>
          {selectedVoucher && (
            <Chip
              label={selectedVoucher.voucher_type}
              color={getVchTypeColor(selectedVoucher.voucher_type)}
              size="small"
            />
          )}
        </DialogTitle>
        <DialogContent dividers>
          {selectedVoucher && (
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">
                  VOUCHER NO
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 600, fontFamily: "monospace" }}>
                  {selectedVoucher.voucher_no || "-"}
                </Typography>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">
                  DATE
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                  {selectedVoucher.date || "-"}
                </Typography>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">
                  CUSTOMER / PARTY NAME
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                  {selectedVoucher.customer_name || "-"}
                </Typography>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">
                  PARTICULARS (CONTRA)
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                  {selectedVoucher.particulars || "-"}
                </Typography>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">
                  DEBIT AMOUNT
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 700, color: "error.main" }}>
                  {formatINR(selectedVoucher.debit)}
                </Typography>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">
                  CREDIT AMOUNT
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 700, color: "success.main" }}>
                  {formatINR(selectedVoucher.credit)}
                </Typography>
              </Grid>

              <Grid item xs={12}>
                <Divider sx={{ my: 1 }} />
              </Grid>

              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary">
                  NARRATION / DESCRIPTION
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  {selectedVoucher.narration || "No narration provided."}
                </Typography>
              </Grid>

              {selectedVoucher.items_summary && (
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary">
                    ITEMS / ALLOCATION SUMMARY
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 0.5, fontFamily: "monospace", bgcolor: "action.hover", p: 1, borderRadius: 1 }}>
                    {selectedVoucher.items_summary}
                  </Typography>
                </Grid>
              )}

              {selectedVoucher.extra_fields && Object.keys(selectedVoucher.extra_fields).length > 0 && (
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary">
                    EXTRA / CUSTOM TALLY FIELDS
                  </Typography>
                  <Box
                    component="pre"
                    sx={{
                      m: 0,
                      mt: 0.5,
                      p: 1.5,
                      bgcolor: "action.hover",
                      borderRadius: 1,
                      fontSize: 12,
                      fontFamily: "monospace",
                      overflowX: "auto",
                    }}
                  >
                    {JSON.stringify(selectedVoucher.extra_fields, null, 2)}
                  </Box>
                </Grid>
              )}

              <Grid item xs={12}>
                <Divider sx={{ my: 1 }} />
              </Grid>

              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">
                  VOUCHER ID (TALLY MASTER ID)
                </Typography>
                <Typography variant="caption" display="block" sx={{ fontFamily: "monospace" }}>
                  {selectedVoucher.voucher_id}
                </Typography>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">
                  SYNCED AT / CONNECTOR
                </Typography>
                <Typography variant="caption" display="block">
                  {selectedVoucher.synced_at ? formatISTDateTime(selectedVoucher.synced_at) : "-"} (
                  {selectedVoucher.connector_version || "v1.0"})
                </Typography>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsOpen(false)} sx={{ fontWeight: 600 }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
