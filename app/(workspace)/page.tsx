"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertCircle, ArrowRight, CalendarDays, BarChart3, CircleDollarSign, Clock3, Package2, Plus, Truck, UsersRound, Wallet, Warehouse } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { dateLabel, money, titleCase } from "@/lib/format";
import { useAuth } from "@/components/app-shell";

type DashboardOrder = {
  id: number; booking_number: string; customer_name: string; booking_date: string; event_date: string;
  status: string; total_amount: string; paid_confirmed: boolean; supplied_confirmed: boolean; delivery_required: boolean;
};
type Dashboard = {
  business_date: string;
  inventory: { usable_on_hand: number; rented_out: number; damaged: number; missing: number; written_off: number };
  booking_status_counts: Record<string, number>;
  overdue_returns: number;
  upcoming_bookings: Array<{ id: number; booking_number: string; customer_name: string; scheduled_dispatch_date: string; expected_return_date: string; delivery_required: boolean; delivery_status: string; delivery_fee: string }>;
  recent_orders: DashboardOrder[];
  recent_catering_jobs: Array<{ id: number; job_number: string; customer_name: string; event_date: string; status: string; total_amount: string }>;
  pending_deliveries: { rental_bookings: number; catering_jobs: number };
  deposits_held: string;
  rental_payments_collected_today: string;
  catering_payments_collected_today: string;
  delivery_expenses_recorded_today: string;
  overview_stats: {
    active_bookings: number; bookings_created_this_month: number; bookings_value_this_month: string;
    collected_this_month: string; expenses_this_month: string; outstanding_for_this_months_bookings: string;
    customers: number; active_catalogue_items: number; delivery_fees_billed_this_month: string;
  };
};

export default function OverviewPage() {
  const { user } = useAuth();
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    api<Dashboard>("dashboard/")
      .then((result) => { if (alive) setData(result); })
      .catch((err) => { if (alive) setError(err instanceof ApiError ? err.message : "Could not load your business overview."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const stats = data?.overview_stats;
  const inventory = data?.inventory;
  const isCateringDivision = !!user?.division.has_catering_services;

  return <div className="page-stack dashboard-page">
    <section className="page-heading dashboard-heading">
      <div><div className="eyebrow"><span className="eyebrow-line" /> BUSINESS OVERVIEW</div><h1>Good business starts with a clear picture.</h1><p>{user?.division.name || "Your division"} · Snapshot for {dateLabel(data?.business_date)}.</p></div>
      <div className="dashboard-quick-actions"><Link href={isCateringDivision ? "/catering" : "/bookings/new"} className="button button-primary"><Plus size={16} /> {isCateringDivision ? "New catering job" : "Create booking"}</Link><Link href="/financials" className="button button-secondary"><BarChart3 size={16} /> View financials</Link></div>
    </section>

    {error && <div className="form-alert page-alert"><AlertCircle size={17} /> {error}</div>}
    {loading && <div className="loading-card"><div className="loader-line" /><span>Loading business performance…</span></div>}
    {!loading && data && <>
      <section className="stats-grid dashboard-stats">
        <article className="stat-card"><div className="stat-top"><span className="stat-label">Bookings value this month</span><span className="stat-icon stat-icon-green"><CircleDollarSign size={19} /></span></div><div className="stat-value stat-currency">{money(stats?.bookings_value_this_month)}</div><div className="stat-foot"><span className="stat-note">{stats?.bookings_created_this_month ?? 0} new bookings/jobs</span></div></article>
        <article className="stat-card"><div className="stat-top"><span className="stat-label">Actually collected this month</span><span className="stat-icon stat-icon-blue"><Wallet size={19} /></span></div><div className="stat-value stat-currency">{money(stats?.collected_this_month)}</div><div className="stat-foot"><span className="stat-note">Posted receipts less refunds</span></div></article>
        <article className="stat-card"><div className="stat-top"><span className="stat-label">Expenses this month</span><span className="stat-icon stat-icon-purple"><BarChart3 size={19} /></span></div><div className="stat-value stat-currency">{money(stats?.expenses_this_month)}</div><div className="stat-foot"><span className="stat-note">Posted operating expenses</span></div></article>
        <article className="stat-card"><div className="stat-top"><span className="stat-label">Outstanding on this month's bookings</span><span className="stat-icon stat-icon-amber"><Clock3 size={19} /></span></div><div className="stat-value stat-currency">{money(stats?.outstanding_for_this_months_bookings)}</div><div className="stat-foot"><span className="stat-note">Based on recorded payments and charges</span></div></article>
      </section>

      <section className="dashboard-quick-grid">
        <Link href="/bookings" className="dashboard-shortcut"><span className="shortcut-icon shortcut-icon-teal"><CalendarDays size={19} /></span><span><strong>Bookings & rentals</strong><small>{stats?.active_bookings ?? 0} open or in-progress records</small></span><ArrowRight size={16} /></Link>
        <Link href="/customers" className="dashboard-shortcut"><span className="shortcut-icon shortcut-icon-blue"><UsersRound size={19} /></span><span><strong>Customer directory</strong><small>{stats?.customers ?? 0} saved customers</small></span><ArrowRight size={16} /></Link>
        <Link href="/inventory" className="dashboard-shortcut"><span className="shortcut-icon shortcut-icon-purple"><Warehouse size={19} /></span><span><strong>Inventory catalogue</strong><small>{stats?.active_catalogue_items ?? 0} active catalogue items</small></span><ArrowRight size={16} /></Link>
        <Link href="/financials" className="dashboard-shortcut"><span className="shortcut-icon shortcut-icon-amber"><BarChart3 size={19} /></span><span><strong>Financial reports</strong><small>Annual, item, delivery and expense totals</small></span><ArrowRight size={16} /></Link>
      </section>

      <section className="dashboard-lower-grid">
        <div className="panel dashboard-orders-panel">
          <div className="panel-heading"><div><h2>Recent orders</h2><p>Latest live rental bookings, excluding imported legacy history.</p></div><Link href="/bookings" className="panel-action-link">All bookings <ArrowRight size={14} /></Link></div>
          {data.recent_orders.length === 0 ? <div className="empty-state"><CalendarDays size={25} /><strong>No recent bookings yet</strong><span>New bookings will appear here once saved.</span><Link href="/bookings/new" className="button button-primary button-small"><Plus size={14} /> Create first booking</Link></div> : <div className="table-scroll"><table className="data-table dashboard-orders-table"><thead><tr><th>Booking / customer</th><th>Booking date</th><th>Status</th><th className="align-right">Amount</th></tr></thead><tbody>{data.recent_orders.map((order) => <tr key={order.id}><td><Link className="table-primary booking-number-link" href={`/bookings/${order.id}`}>{order.booking_number}</Link><div className="table-secondary">{order.customer_name}</div>{order.delivery_required && <span className="mini-tag mini-tag-blue"><Truck size={11} /> Delivery</span>}</td><td>{dateLabel(order.booking_date)}</td><td><span className={`status-pill status-${order.status}`}>{titleCase(order.status)}</span><div className="dashboard-order-flags">{order.paid_confirmed && <span>Paid</span>}{order.supplied_confirmed && <span>Supplied</span>}</div></td><td className="align-right amount-cell">{money(order.total_amount)}</td></tr>)}</tbody></table></div>}
          {data.recent_orders.length > 0 && <div className="table-footer"><span>Showing the latest {data.recent_orders.length} live bookings</span><Link href="/bookings" className="text-link">Open register</Link></div>}
        </div>

        <div className="dashboard-side-column">
          <section className="panel dashboard-health-panel"><div className="panel-heading"><div><h2>Inventory health</h2><p>Current quantities across recorded stock.</p></div><Package2 size={18} /></div><div className="inventory-health-list"><div><span>Usable on hand</span><strong>{inventory?.usable_on_hand ?? 0}</strong></div><div><span>Rented out</span><strong>{inventory?.rented_out ?? 0}</strong></div><div><span>Damaged</span><strong>{inventory?.damaged ?? 0}</strong></div><div><span>Missing</span><strong>{inventory?.missing ?? 0}</strong></div><div><span>Written off</span><strong>{inventory?.written_off ?? 0}</strong></div></div><Link href="/inventory" className="panel-bottom-link">Review stock balances <ArrowRight size={14} /></Link></section>
          <section className="panel dashboard-alert-panel"><div className="panel-heading"><div><h2>Needs attention</h2><p>Operational items that may need follow-up.</p></div><AlertCircle size={18} /></div><div className="dashboard-alert-row"><span>Overdue returns</span><strong className={(data.overdue_returns || 0) > 0 ? "text-warning" : ""}>{data.overdue_returns || 0}</strong></div><div className="dashboard-alert-row"><span>Pending deliveries</span><strong>{(data.pending_deliveries?.rental_bookings || 0) + (data.pending_deliveries?.catering_jobs || 0)}</strong></div><div className="dashboard-alert-row"><span>Delivery fees billed this month</span><strong>{money(stats?.delivery_fees_billed_this_month)}</strong></div><div className="dashboard-alert-row"><span>Deposits currently held</span><strong>{money(data.deposits_held)}</strong></div><Link href="/financials" className="panel-bottom-link">Check the numbers <ArrowRight size={14} /></Link></section>
        </div>
      </section>

      {isCateringDivision && data.recent_catering_jobs?.length > 0 && <section className="panel"><div className="panel-heading"><div><h2>Recent catering jobs</h2><p>Service work and reusable material jobs.</p></div><Link className="panel-action-link" href="/catering">All catering jobs <ArrowRight size={14} /></Link></div><div className="table-scroll"><table className="data-table"><thead><tr><th>Job / customer</th><th>Event date</th><th>Status</th><th className="align-right">Amount</th></tr></thead><tbody>{data.recent_catering_jobs.map((job) => <tr key={job.id}><td><Link className="table-primary booking-number-link" href={`/catering/${job.id}`}>{job.job_number}</Link><div className="table-secondary">{job.customer_name}</div></td><td>{dateLabel(job.event_date)}</td><td><span className={`status-pill status-${job.status}`}>{titleCase(job.status)}</span></td><td className="align-right amount-cell">{money(job.total_amount)}</td></tr>)}</tbody></table></div></section>}
    </>}
  </div>;
}
