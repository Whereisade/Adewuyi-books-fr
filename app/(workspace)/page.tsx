"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight, CalendarClock, CircleAlert, Clock3, PackageCheck, Plus, Truck, Wallet, WalletCards } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { dateLabel, money, titleCase } from "@/lib/format";
import type { Booking, DashboardData } from "@/lib/types";

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    Promise.all([api<DashboardData>("dashboard/"), api<Booking[]>("bookings/")])
      .then(([dashboard, rentalBookings]) => {
        if (!alive) return;
        setData(dashboard);
        setBookings(rentalBookings.slice(0, 5));
      })
      .catch((err) => { if (alive) setError(err instanceof ApiError ? err.message : "Could not load the dashboard."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const activeBookings = data ? Object.entries(data.booking_status_counts).filter(([key]) => !["returned", "cancelled"].includes(key)).reduce((total, [, count]) => total + count, 0) : 0;

  return (
    <div className="page-stack">
      <section className="page-heading heading-with-actions">
        <div><div className="eyebrow"><span className="eyebrow-line" /> BUSINESS OVERVIEW</div><h1>Good to see you.</h1><p>Here’s what’s happening across your rental business today.</p></div>
        <div className="heading-actions"><Link href="/bookings/new" className="button button-primary"><Plus size={17} /> New booking</Link><Link href="/inventory" className="button button-secondary"><PackageCheck size={17} /> Add inventory</Link></div>
      </section>

      {error && <div className="form-alert page-alert">{error}</div>}
      {loading ? <div className="loading-card"><div className="loader-line" /><span>Loading your business overview…</span></div> : data && <>
        <section className="stats-grid">
          <article className="stat-card stat-card-main"><div className="stat-top"><span className="stat-label">Collections today</span><span className="stat-icon stat-icon-green"><Wallet size={19} /></span></div><div className="stat-value">{money(Number(data.rental_payments_collected_today) + Number(data.catering_payments_collected_today))}</div><div className="stat-foot"><span className="stat-note">Recorded net payments</span><span className="stat-trend"><ArrowUpRight size={15} /> Live record</span></div></article>
          <article className="stat-card"><div className="stat-top"><span className="stat-label">Usable stock on hand</span><span className="stat-icon stat-icon-blue"><PackageCheck size={19} /></span></div><div className="stat-value">{Number(data.inventory.usable_on_hand).toLocaleString("en-NG")}</div><div className="stat-foot"><span className="stat-note">Physical usable units</span><span className="stat-sub">Excludes damaged stock</span></div></article>
          <article className="stat-card"><div className="stat-top"><span className="stat-label">Active bookings</span><span className="stat-icon stat-icon-purple"><CalendarClock size={19} /></span></div><div className="stat-value">{activeBookings}</div><div className="stat-foot"><span className="stat-note">All non-final bookings</span><span className="stat-sub">Across current records</span></div></article>
          <article className="stat-card"><div className="stat-top"><span className="stat-label">Security deposits held</span><span className="stat-icon stat-icon-amber"><WalletCards size={19} /></span></div><div className="stat-value">{money(data.deposits_held)}</div><div className="stat-foot"><span className="stat-note">Customer money held</span><span className="stat-sub">Not rental revenue</span></div></article>
        </section>

        <section className="dashboard-main-grid">
          <article className="panel upcoming-panel">
            <div className="panel-heading"><div><h2>Upcoming bookings</h2><p>Keep an eye on what is going out next.</p></div><Link href="/bookings" className="text-link">View all <ArrowRight size={15} /></Link></div>
            {data.upcoming_bookings.length === 0 ? <div className="empty-state compact-empty"><div className="empty-icon"><CalendarClock size={21} /></div><strong>No upcoming confirmed bookings</strong><span>New confirmed bookings will appear here.</span></div> : <div className="upcoming-list">{data.upcoming_bookings.map((booking) => <div className="upcoming-row" key={booking.id}><div className="date-tile"><strong>{new Date(`${booking.scheduled_dispatch_date}T00:00:00`).getDate()}</strong><span>{new Intl.DateTimeFormat("en-NG", { month: "short" }).format(new Date(`${booking.scheduled_dispatch_date}T00:00:00`))}</span></div><div className="upcoming-main"><strong>{booking.customer_name}</strong><span>{booking.booking_number} · Return {dateLabel(booking.expected_return_date)}</span></div><div className="upcoming-end">{booking.delivery_required ? <span className="mini-tag mini-tag-blue"><Truck size={12} /> Delivery</span> : <span className="mini-tag">Collection</span>}<span className="status-dot-line"><i /> {titleCase(booking.delivery_status || "confirmed")}</span></div></div>)}</div>}
            <div className="panel-bottom-link"><Link href="/bookings/new"><Plus size={15} /> Add another booking</Link></div>
          </article>

          <article className="panel attention-panel">
            <div className="panel-heading"><div><h2>Needs attention</h2><p>A quick check on today's operations.</p></div><span className="panel-heading-icon"><CircleAlert size={18} /></span></div>
            <div className="attention-list">
              <div className="attention-row"><div className="attention-icon attention-icon-red"><Clock3 size={17} /></div><div className="attention-copy"><strong>Overdue returns</strong><span>Items expected back after their due date.</span></div><div className={`attention-count ${data.overdue_returns > 0 ? "count-alert" : ""}`}>{data.overdue_returns}</div></div>
              <div className="attention-row"><div className="attention-icon attention-icon-blue"><Truck size={17} /></div><div className="attention-copy"><strong>Pending deliveries</strong><span>Rental and catering jobs needing delivery progress.</span></div><div className={`attention-count ${data.pending_deliveries.rental_bookings + data.pending_deliveries.catering_jobs > 0 ? "count-alert" : ""}`}>{data.pending_deliveries.rental_bookings + data.pending_deliveries.catering_jobs}</div></div>
              <div className="attention-row"><div className="attention-icon attention-icon-amber"><PackageCheck size={17} /></div><div className="attention-copy"><strong>Damaged units</strong><span>Keep unavailable items out of circulation.</span></div><div className="attention-count">{data.inventory.damaged}</div></div>
            </div>
            <div className="attention-footer"><ArrowDownRight size={15} /> Review these items before closing the day.</div>
          </article>
        </section>

        <section className="panel recent-panel"><div className="panel-heading"><div><h2>Recent rental records</h2><p>Latest bookings recorded in this division.</p></div><Link href="/bookings" className="text-link">All bookings <ArrowRight size={15} /></Link></div>
          {bookings.length === 0 ? <div className="empty-state compact-empty"><strong>No rental records yet</strong><span>Start by creating your first booking.</span><Link href="/bookings/new" className="button button-primary button-small"><Plus size={15} /> Create booking</Link></div> : <div className="table-scroll"><table className="data-table"><thead><tr><th>Booking / customer</th><th>Dispatch date</th><th>Expected return</th><th>Status</th><th className="align-right">Rental total</th></tr></thead><tbody>{bookings.map((booking) => <tr key={booking.id}><td><div className="table-primary">{booking.booking_number}</div><div className="table-secondary">{booking.customer_name}</div></td><td>{dateLabel(booking.scheduled_dispatch_date)}</td><td>{dateLabel(booking.expected_return_date)}</td><td><span className={`status-pill status-${booking.status}`}>{titleCase(booking.status)}</span></td><td className="align-right amount-cell">{money(booking.total_amount)}</td></tr>)}</tbody></table></div>}
        </section>
      </>}
    </div>
  );
}
