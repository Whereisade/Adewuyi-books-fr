export type Division = {
  id: number;
  code: string;
  name: string;
  has_catering_services: boolean;
};

export type UserProfile = {
  id: number;
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
  quantity: number;
  unit_price: string;
  line_subtotal: string;
  discount_amount: string;
  line_total: string;
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
  delivery_required: boolean;
  delivery_fee: string;
  delivery_status: string;
  delivery_address: string;
  total_amount: string;
  notes: string;
  items: BookingItem[];
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
