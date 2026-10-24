export type Division = {
  id: number;
  code: string;
  name: string;
  has_catering_services: boolean;
};

export type UserProfile = {
  id: number;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  role: string;
  division: Division;
};

export type Customer = {
  id: number;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  notes?: string;
};

export type Category = {
  id: number;
  name: string;
  description?: string;
  is_active: boolean;
};

export type CatalogueItem = {
  id: number;
  category: number;
  category_name: string;
  sku: string;
  name: string;
  description: string;
  price_basis: string;
  quantity_unit: string;
  default_rental_price: string;
  is_active: boolean;
  notes: string;
};

export type InventoryBalance = {
  id: number;
  item: number;
  item_name: string;
  sku: string;
  usable_on_hand: number;
  rented_out: number;
  damaged: number;
  missing: number;
  written_off: number;
  usable_pool: number;
  total_accounted_for: number;
};

export type BookingItem = {
  id: number;
  item_id: number;
  item_name_snapshot: string;
  sku_snapshot: string;
  quantity_unit_snapshot: string;
  quantity: number;
  unit_price: string;
  line_subtotal: string;
  discount_amount: string;
  line_total: string;
  notes?: string;
  quantity_dispatched?: number;
  quantity_returned_usable?: number;
  quantity_returned_damaged?: number;
  quantity_confirmed_missing?: number;
  quantity_unresolved?: number;
  quantity_remaining_to_dispatch?: number;
};

export type Booking = {
  id: number;
  booking_number: string;
  customer: number;
  customer_name: string;
  customer_phone: string;
  status: string;
  booking_date: string;
  event_date: string | null;
  scheduled_dispatch_date: string;
  expected_return_date: string;
  subtotal: string;
  discount_amount: string;
  additional_charges: string;
  discount_reason?: string;
  delivery_required: boolean;
  delivery_fee: string;
  delivery_status: string;
  delivery_address: string;
  delivery_contact_name?: string;
  delivery_contact_phone?: string;
  delivery_notes?: string;
  total_amount: string;
  notes: string;
  is_legacy_import: boolean;
  paid_confirmed: boolean;
  supplied_confirmed: boolean;
  items: BookingItem[];
  payments?: PaymentRecord[];
  charges?: ChargeAdjustment[];
  security_deposit?: SecurityDepositRecord | null;
  financials?: Record<string, string>;
};

export type DashboardData = {
  business_date: string;
  inventory: {
    usable_on_hand: number;
    rented_out: number;
    damaged: number;
    missing: number;
    written_off: number;
  };
  booking_status_counts: Record<string, number>;
  overdue_returns: number;
  upcoming_bookings: Array<{
    id: number;
    booking_number: string;
    customer_name: string;
    scheduled_dispatch_date: string;
    expected_return_date: string;
    delivery_required: boolean;
    delivery_status: string;
    delivery_fee: string;
  }>;
  catering_job_status_counts: Record<string, number>;
  upcoming_catering_jobs: Array<{
    id: number;
    job_number: string;
    customer_name: string;
    event_date: string;
    delivery_required: boolean;
    delivery_status: string;
    delivery_fee: string;
  }>;
  pending_deliveries: { rental_bookings: number; catering_jobs: number };
  deposits_held: string;
  rental_payments_collected_today: string;
  catering_payments_collected_today: string;
  delivery_fees_billed_for_rentals_created_today: string;
  delivery_fees_billed_for_catering_jobs_created_today: string;
  delivery_expenses_recorded_today: string;
};

export type BankAccount = {
  id: number;
  label: string;
  bank_name: string;
  account_name: string;
  account_number_masked: string;
  is_active: boolean;
  notes?: string;
};

export type CatalogueAuditEvent = {
  id: number; action: string; object_type: string; object_id: string; summary: string;
  before_data: Record<string, unknown>; after_data: Record<string, unknown>; actor: string; created_at: string;
};


/** A posted or voided customer receipt/refund returned by the finance API. */
export type PaymentRecord = {
  id: number;
  booking?: number | null;
  catering_job?: number | null;
  receipt_number?: string | null;
  kind: "receipt" | "refund" | string;
  amount: string;
  method: "cash" | "bank" | string;
  bank_account?: number | null;
  bank_account_label?: string;
  transaction_reference?: string;
  paid_at: string;
  notes?: string;
  status?: string;
  created_at?: string;
};

/** Additional, damage, or missing-item charge recorded against a booking. */
export type ChargeAdjustment = {
  id: number;
  kind: string;
  amount: string;
  reason: string;
  status: string;
  booking_item?: number | null;
  created_at?: string;
};

/** Immutable issued invoice or invoice draft returned by the finance API. */
export type InvoiceRecord = {
  id: number;
  invoice_number?: string | null;
  status?: string;
  booking?: number | null;
  catering_job?: number | null;
  subtotal?: string;
  discount_amount?: string;
  additional_charges?: string;
  delivery_fee?: string;
  total_amount: string;
  amount_paid_at_issue?: string;
  balance_at_issue?: string;
  snapshot?: Record<string, unknown>;
  issued_at?: string | null;
  created_at?: string;
};

export type DepositTransactionRecord = {
  id: number;
  receipt_number?: string | null;
  kind: string;
  amount: string;
  method?: string;
  bank_account?: number | null;
  bank_account_label?: string;
  charge_adjustment?: number | null;
  transaction_reference?: string;
  occurred_at: string;
  notes?: string;
  status?: string;
  created_at?: string;
};

export type SecurityDepositRecord = {
  required_amount: string;
  status: string;
  notes?: string;
  totals: {
    received: string;
    refunded: string;
    applied: string;
    held: string;
    [key: string]: string;
  };
  transactions: DepositTransactionRecord[];
  created_at?: string;
  updated_at?: string;
};
