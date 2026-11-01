/**
 * aura.ts
 * ──────────────────────────────────────────────────────────────────────────
 * Data models for AURA Manager & Caller Bridge APIs (v2.0.0).
 * Matches official PC-Sales API Integration Guide.
 */

// ─── Authentication ──────────────────────────────────────────────────────────

export interface ManagerAuthRequest {
  email: string;
  api_key: string;
}

export interface ManagerAuthResponse {
  valid: boolean;
  manager?: {
    email: string;
    name: string;
    role: string;
  };
  token?: string;
  expires_at?: string;
  error?: string;
  message?: string;
}

// ─── Core Entities ────────────────────────────────────────────────────────────

export interface AuraUser {
  user_id: string;
  email: string;
  name: string;
  mobile: string;
  role: "manager" | "field_officer" | "caller";
  is_active: boolean;
}

export interface AuraCustomer {
  customer_id: string;
  name: string;
  contact_person: string;
  mobile: string;
  alternate_mobile?: string;
  customer_type: "retailer" | "distributor";
  village: string;
  city: string;
  address?: string;
  gst_number?: string;
  last_visit_date?: string;
  last_order_date?: string;
  last_order_amount?: number;
  total_orders?: number;
  total_sales?: number;
}

export interface AuraOrderItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  catalog_price?: number;
  selling_price?: number;
  discount_per_unit?: number;
  line_total: number;
}

export interface AuraOrder {
  order_id: string;
  order_number: string;
  date: string;
  customer_id?: string;
  customer?: string;
  field_officer?: {
    email: string;
    name: string;
  };
  field_officer_email?: string;
  gross_amount?: number;
  discount_amount: number;
  net_amount?: number;
  order_total?: number;
  discount_percent: number;
  total_liters?: number;
  items?: AuraOrderItem[];
  needs_approval?: boolean;
  alert_level?: "warning" | "critical";
}

// ─── Dashboard Overview ───────────────────────────────────────────────────────

export interface DashboardKPIs {
  total_orders: number;
  total_sales: number;
  total_collections: number;
  total_visits: number;
  avg_order_value: number;
  conversion_rate: number;
  target_achievement?: {
    target_amount: number;
    achieved_amount: number;
    shortfall: number;
    achievement_percent: number;
  };
}

export interface DashboardAlerts {
  pending_verifications: number;
  high_discount_orders: number;
  plan_adherence_issues: number;
}

export interface RecentActivityItem {
  type: "order" | "visit";
  field_officer: string;
  customer: string;
  amount?: number;
  discount_percent?: number;
  status?: string;
  timestamp: string;
}

export interface DashboardOverviewResponse {
  month_year: string;
  kpis: DashboardKPIs;
  alerts: DashboardAlerts;
  recent_activity: RecentActivityItem[];
}

// ─── Team Summary ─────────────────────────────────────────────────────────────

export interface TeamMemberPerformance {
  field_officer: {
    email: string;
    name: string;
    mobile?: string;
  };
  stats: {
    total_visits: number;
    total_orders: number;
    total_sales: number;
    total_collections: number;
    conversion_rate: number;
    avg_order_value: number;
  };
  targets: {
    target_amount: number;
    achievement_percent: number;
    shortfall: number;
  };
}

export interface TeamSummaryResponse {
  month_year: string;
  team_performance: TeamMemberPerformance[];
  totals: {
    total_field_officers: number;
    total_visits: number;
    total_orders: number;
    total_sales: number;
    team_conversion_rate: number;
  };
}

// ─── Route Plan vs Actual ─────────────────────────────────────────────────────

export interface PlanItemDetail {
  sequence: number;
  customer: string;
  village: string;
  planned_time: string;
  status: "completed" | "skipped" | "pending";
  actual_visit?: {
    check_in_time: string;
    check_out_time: string;
    duration_minutes: number;
    deviation_minutes: number;
  } | null;
}

export interface UnplannedVisitItem {
  customer: string;
  village: string;
  check_in_time: string;
  check_out_time: string;
  reason: string;
}

export interface EditHistoryItem {
  timestamp: string;
  action: string;
  customer: string;
  reason: string;
}

export interface PlanVsActualResponse {
  date: string;
  field_officer: {
    email: string;
    name: string;
  };
  plan?: {
    plan_id: string;
    status: string;
    submission_time?: string;
    items: PlanItemDetail[];
  };
  unplanned_visits: UnplannedVisitItem[];
  summary: {
    planned_count: number;
    completed_count: number;
    skipped_count: number;
    unplanned_count: number;
    completion_rate: number;
    plan_adherence_rate: number;
  };
  edit_history: EditHistoryItem[];
}

// ─── Discount Analytics ───────────────────────────────────────────────────────

export interface DiscountSummary {
  total_orders: number;
  total_discount_amount: number;
  avg_discount_percent: number;
  high_discount_orders: number;
  manager_approval_needed: number;
}

export interface DiscountByFO {
  field_officer: {
    email: string;
    name: string;
  };
  total_discount: number;
  avg_discount_percent: number;
  monthly_limit: number;
  utilization_percent: number;
}

export interface DiscountTrendPoint {
  date: string;
  total_discount: number;
  avg_percent: number;
}

export interface DiscountAnalyticsResponse {
  month_year: string;
  summary: DiscountSummary;
  high_discount_orders: AuraOrder[];
  discount_by_fo: DiscountByFO[];
  trend: DiscountTrendPoint[];
}

// ─── Verification (Second Pitch) ──────────────────────────────────────────────

export interface PendingVisit {
  visit_id: string;
  date: string;
  field_officer: {
    email: string;
    name: string;
  };
  customer: {
    customer_id: string;
    name: string;
    mobile: string;
    village: string;
  };
  visit_details: {
    check_in_time: string;
    check_out_time: string;
    duration_minutes: number;
    notes: string;
    photo_count: number;
  };
  gps: {
    latitude: number;
    longitude: number;
  };
  order_created: boolean;
  order_amount?: number | null;
  days_pending: number;
}

export interface VerifyVisitRequest {
  visit_id: string;
  manager_email: string;
  verified: boolean;
  call_notes: string;
  second_pitch_status: "not_pitched" | "pitched_interested" | "pitched_follow_up" | "pitched_converted";
}

export interface VerifyVisitResponse {
  success: boolean;
  visit_id: string;
  verification: {
    verified: boolean;
    verified_by: string;
    verified_at: string;
    call_notes: string;
    second_pitch_status: string;
  };
  notification_sent: boolean;
  follow_up_created: boolean;
  follow_up_id?: string;
}

export interface VisitPhoto {
  photo_id: string;
  url: string;
  timestamp?: string;
  upload_timestamp?: string;
  exif_timestamp?: string;
  caption?: string;
}

export interface VisitDetailsResponse {
  visit_id: string;
  date: string;
  field_officer: {
    email: string;
    name: string;
    mobile: string;
  };
  customer: {
    customer_id: string;
    name: string;
    contact_person?: string;
    mobile: string;
    village: string;
    city?: string;
  };
  visit_timeline: {
    check_in_time: string;
    check_out_time: string;
    duration_minutes: number;
  };
  gps_data: {
    check_in_lat: number;
    check_in_lon: number;
    check_out_lat?: number;
    check_out_lon?: number;
    distance_from_customer?: number;
  };
  visit_notes: string;
  photos: VisitPhoto[];
  orders: AuraOrder[];
  receipts: Array<{
    receipt_id: string;
    receipt_number: string;
    date: string;
    amount: number;
    payment_method: string;
    reference_number?: string;
  }>;
  verification?: {
    verified: boolean;
    verified_by?: string | null;
    verified_at?: string | null;
    call_notes?: string | null;
    second_pitch_status?: string | null;
  };
}

export interface VerificationSummaryResponse {
  month_year: string;
  summary: {
    total_visits: number;
    verified_visits: number;
    pending_verification: number;
    disputed_visits: number;
    verification_rate: number;
    avg_verification_time_hours: number;
  };
  second_pitch_results: {
    not_pitched: number;
    pitched_interested: number;
    pitched_follow_up: number;
    pitched_converted: number;
  };
  by_field_officer: Array<{
    field_officer: {
      email: string;
      name: string;
    };
    total_visits: number;
    verified: number;
    pending: number;
    verification_rate: number;
  }>;
}

// ─── Field Officers & Targets ─────────────────────────────────────────────────

export interface FieldOfficerItem {
  user_id: string;
  email: string;
  name: string;
  mobile?: string;
  role?: string;
  is_active?: boolean;
  status?: string;
  today_distance_km?: number;
  total_distance_km?: number;
  sessions_count_today?: number;
  total_sessions_count?: number;
  last_active_at?: string;
  latest_session_id?: string;
  last_location?: {
    latitude: number;
    longitude: number;
    recorded_at?: string;
    accuracy_m?: number;
    speed_mps?: number;
  };
  current_month_stats?: {
    total_visits: number;
    total_orders: number;
    total_sales: number;
    total_collections: number;
    conversion_rate: number;
  };
  targets?: {
    target_amount: number;
    target_liters: number;
    target_visits: number;
    achievement_percent: number;
  };
}

export interface OfficerSession {
  id: string;
  session_number: number;
  session_label?: string;
  started_at: string;
  ended_at?: string | null;
  duration_seconds?: number;
  total_distance_km?: number;
  status: "active" | "completed" | "paused" | string;
}

export interface SessionRoutePoint {
  id?: string;
  latitude: number;
  longitude: number;
  recorded_at: string;
  accuracy_m?: number;
  speed_mps?: number;
  altitude_m?: number;
}

export interface SessionRouteResponse {
  session_id: string;
  started_at: string;
  ended_at?: string | null;
  total_distance_km: number;
  stored_distance_km?: number;
  computed_distance_km?: number;
  status: string;
  point_count: number;
  points: SessionRoutePoint[];
}

export interface SetTargetRequest {
  user_email: string;
  month_year: string; // YYYY-MM
  target_amount: number;
  target_liters: number;
  target_visits: number;
  set_by_manager_email: string;
}

export interface TargetAchievementResponse {
  user_email: string;
  month_year: string;
  targets: {
    target_amount: number;
    target_liters: number;
    target_visits: number;
  };
  achievement: {
    achieved_amount: number;
    achieved_liters: number;
    achieved_visits: number;
    amount_shortfall: number;
    liters_shortfall: number;
    visits_shortfall: number;
    amount_percent: number;
    liters_percent: number;
    visits_percent: number;
  };
  days_remaining: number;
  set_by: string;
  set_at: string;
}

// ─── Top Products ─────────────────────────────────────────────────────────────

export interface TopProduct {
  product_id: string;
  product_name: string;
  total_quantity: number;
  total_liters: number;
  total_revenue: number;
  order_count: number;
  avg_price_per_unit: number;
}

// ─── Sales Summary ────────────────────────────────────────────────────────────

export interface SalesSummaryResponse {
  period: string;
  start_date: string;
  end_date: string;
  summary: {
    total_orders: number;
    total_sales: number;
    total_collections: number;
    total_visits: number;
    total_customers: number;
    avg_order_value: number;
    conversion_rate: number;
    collection_efficiency: number;
  };
  by_payment_method: Record<string, number>;
  daily_breakdown: Array<{
    date: string;
    orders: number;
    sales: number;
    collections: number;
  }>;
}

// ─── Caller APIs ──────────────────────────────────────────────────────────────

export interface CallLogRequest {
  customer_id: string;
  caller_email: string;
  call_date: string;
  call_outcome: "interested" | "not_interested" | "call_later" | "wrong_number" | "not_reachable";
  call_notes: string;
  follow_up_required: boolean;
  follow_up_date?: string;
}

export interface TodayCallingItem {
  customer_id: string;
  name: string;
  mobile: string;
  village: string;
  last_visit_date: string | null;
  days_since_visit: number;
  last_order_amount: number | null;
  last_call_date: string | null;
  last_call_outcome?: string | null;
  priority: "high" | "medium" | "low";
  reason: string;
}

// ─── Complementary & Legacy Support Models ───────────────────────────────────

export interface FieldOfficer {
  fo_user_id: string;
  name: string;
  phone: string;
  email?: string;
  assigned_districts?: string[];
  assigned_talukas?: string[];
  today_status: "plan_locked" | "in_visit" | "on_break" | "idle" | "off";
  monthly_target_amount?: number;
  monthly_target_liters?: number;
  monthly_target_visits?: number;
  achieved_sales_amount?: number;
  achieved_liters?: number;
  target_shortfall?: number;
  kms_this_month?: number;
  total_duration_hours?: number;
  discounts_given?: number;
  active_visit_customer?: string;
  today_distance_km?: number;
  total_distance_km?: number;
  sessions_count_today?: number;
  total_sessions_count?: number;
  last_active_at?: string;
  latest_session_id?: string;
  last_location?: {
    latitude: number;
    longitude: number;
    recorded_at?: string;
    accuracy_m?: number;
    speed_mps?: number;
  };
}

export interface TeamKPI {
  total_target_amount: number;
  total_achieved_amount: number;
  team_shortfall_amount: number;
  team_shortfall_pct: number;
  officers_submitted_plan: number;
  officers_active_in_field: number;
  total_visits_today: number;
  total_officers: number;
  verified_visits: number;
  pending_verification: number;
  disputed_visits: number;
  total_discounts_given: number;
  discount_pct_of_gross: number;
}

export interface LocationPoint {
  lat: number;
  lng: number;
  timestamp: string;
  speed_kmh?: number;
}

export interface RoutePlanItem {
  stop_number: number;
  customer_id: string;
  customer_name: string;
  village: string;
  taluka: string;
  lat?: number;
  lng?: number;
  planned_time?: string;
  status: "completed" | "skipped" | "pending";
}

export interface ActualVisitStop {
  visit_id: string;
  customer_id: string;
  customer_name: string;
  village: string;
  checkin_time: string;
  checkout_time?: string;
  duration_minutes?: number;
  checkin_lat: number;
  checkin_lng: number;
  checkout_lat?: number;
  checkout_lng?: number;
  geofence_drift_meters?: number;
  is_unplanned?: boolean;
  status: "verified" | "disputed" | "pending" | "unreachable" | "on_sequence" | "out_of_sequence" | "adhoc" | string;
}

export interface RouteAudit {
  fo_user_id: string;
  date: string;
  plan_status: "locked" | "draft" | "submitted" | "completed";
  is_edited: boolean;
  edit_revision_number?: number;
  edit_reason?: string;
  edit_timestamp?: string;
  edited_at?: string;
  planned_stops: RoutePlanItem[];
  actual_stops: ActualVisitStop[];
  location_points: LocationPoint[];
  completion_pct: number;
  sequence_adherence_pct: number;
}

export interface CustomerVisit {
  visit_id: string;
  fo_user_id: string;
  fo_name?: string;
  customer_id: string;
  customer_name: string;
  customer_phone?: string;
  phone?: string;
  village: string;
  taluka?: string;
  checkin_time: string;
  checkout_time?: string;
  duration_minutes?: number;
  checkin_lat: number;
  checkin_lng: number;
  checkout_lat?: number;
  checkout_lng?: number;
  geofence_drift_meters?: number;
  notes?: string;
  photos: VisitPhoto[];
  orders?: AuraOrder[];
  verification_status: "pending" | "verified" | "disputed" | "unreachable";
  second_pitch_outcome?: string;
  manager_call_notes?: string;
  follow_up_at?: string;
}

export interface OfficerDiscountSummary {
  fo_user_id: string;
  name?: string;
  fo_name?: string;
  total_orders: number;
  gross_sales: number;
  net_sales: number;
  total_discount: number;
  avg_discount_pct: number;
  discount_pct?: number;
  max_discount_pct: number;
  flagged_orders_count: number;
}

export interface OrderDiscountItem {
  sku: string;
  qty: number;
  unit_price: number;
  discount_amount: number;
  net_amount: number;
}

export interface OrderDiscount {
  order_id: string;
  order_number?: string;
  order_date?: string;
  fo_user_id: string;
  fo_name: string;
  customer_name: string;
  date?: string;
  gross_amount: number;
  discount_amount: number;
  net_amount: number;
  discount_pct?: number;
  discount_reason?: string;
  is_edited: boolean;
  edit_reason?: string;
  line_items?: OrderDiscountItem[];
  items?: Array<{
    item_id?: string;
    product_name: string;
    quantity: number;
    catalog_price: number;
    selling_price: number;
    discount_pct: number;
  }>;
}

export interface PaymentReceipt {
  receipt_id: string;
  receipt_number?: string;
  customer_name: string;
  field_officer_name?: string;
  fo_name?: string;
  date: string;
  amount: number;
  payment_method?: string;
  mode?: string;
  pdf_url?: string;
}

export interface DiscountAnalytics {
  gross_sales: number;
  net_sales: number;
  total_discount_amount?: number;
  total_discount?: number;
  avg_discount_pct: number;
  summary?: {
    gross_sales: number;
    net_sales: number;
    total_discount: number;
    avg_discount_pct: number;
  };
  officers: OfficerDiscountSummary[];
  by_officer?: OfficerDiscountSummary[];
  orders?: OrderDiscount[];
}

export interface EditAuditLog {
  audit_id?: string;
  log_id?: string;
  field_officer?: {
    user_id: string;
    name: string;
    email: string;
  };
  fo_name?: string;
  entity_type: "daily_plan" | "order" | "visit" | "receipt" | "route_plan" | string;
  entity_id: string;
  timestamp?: string;
  edited_at?: string;
  mandatory_reason?: string;
  edit_reason?: string;
  before_state?: Record<string, unknown>;
  after_state?: Record<string, unknown>;
  before_snapshot?: Record<string, unknown>;
  after_snapshot?: Record<string, unknown>;
  ip_address?: string;
  app_version?: string;
}

export interface StockRequest {
  request_id: string;
  field_officer?: {
    user_id: string;
    name: string;
    email: string;
  };
  fo_name?: string;
  sku_name?: string;
  sku?: string;
  requested_qty: number;
  approved_qty?: number;
  status: "pending" | "approved" | "modified" | "dispatched" | "rejected";
  request_date?: string;
  requested_at?: string;
  decision_date?: string;
  notes?: string;
  manager_notes?: string;
  rejection_reason?: string;
}

export interface AuraNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  fo_name?: string;
}
