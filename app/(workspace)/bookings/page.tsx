"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Plus, Search, CalendarDays, Truck, RefreshCw, AlertCircle } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { dateLabel, money, titleCase } from "@/lib/format";
import type { Booking } from "@/lib/types";

const statuses = ["all", "draft", "confirmed", "dispatched", "partially_returned", "returned", "cancelled"];

export default function BookingsPage() {
  const [createdNumber, setCreatedNumber] = useState<string | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  async function load() {
    setLoading(true); setError("");
    try { const results = await api<Booking[]>("bookings/"); setBookings(results); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Could not load bookings."); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    void load();
    setCreatedNumber(new URLSearchParams(window.location.search).get("created"));
  }, []);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return bookings.filter((booking) => (status === "all" || booking.status === status) && (!needle || [booking.booking_number, booking.customer_name, booking.customer_phone].some((part) => part?.toLowerCase().includes(needle))));
  }, [bookings, query, status]);

  return <div className="page-stack">
    <section className="page-heading heading-with-actions"><div><div className="eyebrow"><span className="eyebrow-line" /> RENTAL WORKFLOW</div><h1>Bookings & rentals</h1><p>Manage upcoming bookings, dispatches and returns from one list.</p></div><Link href="/bookings/new" className="button button-primary"><Plus size={17} /> New booking</Link></section>
    {error && <div className="form-alert page-alert"><AlertCircle size={17} /> {error}</div>}
    {createdNumber && <div className="form-success page-alert">Booking {createdNumber} was saved successfully.</div>}
    <section className="panel inventory-panel"><div className="panel-heading inventory-toolbar"><div><h2>Rental register</h2><p>{bookings.length} booking record{bookings.length === 1 ? "" : "s"} loaded (latest 100 maximum from API).</p></div><div className="toolbar-actions"><div className="search-field"><Search size={17} /><input aria-label="Search bookings" placeholder="Search booking or customer…" value={query} onChange={(e) => setQuery(e.target.value)} /></div><button className="icon-button refresh-button" aria-label="Refresh bookings" onClick={() => void load()}><RefreshCw size={17} /></button></div></div>
      <div className="filter-row"><span className="filter-caption">Filter by status</span>{statuses.map((value) => <button key={value} className={`filter-chip ${status === value ? "filter-chip-active" : ""}`} onClick={() => setStatus(value)}>{titleCase(value)}</button>)}</div>
      {loading ? <div className="loading-card"><div className="loader-line" /><span>Loading bookings…</span></div> : filtered.length === 0 ? <div className="empty-state"><div className="empty-icon"><CalendarDays size={23} /></div><strong>{query || status !== "all" ? "No matching bookings" : "No rentals recorded yet"}</strong><span>{query || status !== "all" ? "Change the search or status filter." : "Create a booking to start tracking items, dates and payments."}</span>{!query && status === "all" && <Link href="/bookings/new" className="button button-primary button-small"><Plus size={15} /> Create booking</Link>}</div> : <div className="table-scroll"><table className="data-table"><thead><tr><th>Booking / customer</th><th>Dispatch date</th><th>Expected return</th><th>Items</th><th>Delivery</th><th>Status</th><th className="align-right">Rental total</th></tr></thead><tbody>{filtered.map((booking) => <tr key={booking.id}><td><div className="table-primary">{booking.booking_number}</div><div className="table-secondary">{booking.customer_name}{booking.customer_phone ? ` · ${booking.customer_phone}` : ""}</div></td><td>{dateLabel(booking.scheduled_dispatch_date)}</td><td>{dateLabel(booking.expected_return_date)}</td><td>{booking.items?.reduce((sum, line) => sum + line.quantity, 0) ?? 0} units</td><td>{booking.delivery_required ? <span className="mini-tag mini-tag-blue"><Truck size={12} /> {money(booking.delivery_fee)}</span> : <span className="muted-inline">Customer collection</span>}</td><td><span className={`status-pill status-${booking.status}`}>{titleCase(booking.status)}</span></td><td className="align-right amount-cell">{money(booking.total_amount)}</td></tr>)}</tbody></table></div>}
      <div className="table-footer"><span>Showing {filtered.length} matching record{filtered.length === 1 ? "" : "s"}</span><span>Totals include delivery fees when applicable.</span></div>
    </section>
  </div>;
}
