"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Plus, Search, CalendarDays, Truck, RefreshCw, AlertCircle, Pencil, ChevronLeft, ChevronRight } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { dateLabel, money, titleCase } from "@/lib/format";
import type { Booking } from "@/lib/types";

const statuses = ["all", "draft", "confirmed", "partially_dispatched", "dispatched", "partially_returned", "returned", "cancelled", "historical"];
const PAGE_SIZE = 50;
type BookingRegisterItem = Pick<Booking["items"][number], "id" | "item_id" | "item_name_snapshot" | "quantity_unit_snapshot" | "quantity">;
type BookingRegisterRow = Pick<Booking, "id" | "booking_number" | "customer_name" | "customer_phone" | "status" | "scheduled_dispatch_date" | "expected_return_date" | "delivery_required" | "delivery_fee" | "total_amount" | "is_legacy_import"> & { items: BookingRegisterItem[] };
type BookingPageResponse = {
  results: BookingRegisterRow[];
  count: number;
  page: number;
  page_size: number;
  num_pages: number;
  years: number[];
  selected_year: number | "all";
};

export default function BookingsPage() {
  const [createdNumber, setCreatedNumber] = useState<string | null>(null);
  const [bookings, setBookings] = useState<BookingRegisterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [years, setYears] = useState<number[]>([new Date().getFullYear()]);
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);
  const [numPages, setNumPages] = useState(1);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    setCreatedNumber(new URLSearchParams(window.location.search).get("created"));
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    const load = async () => {
      setLoading(true);
      setError("");
      const params = new URLSearchParams({
        include_history: "true",
        year,
        page: String(page),
        page_size: String(PAGE_SIZE),
        status,
      });
      if (query.trim()) params.set("q", query.trim());
      try {
        const response = await api<BookingPageResponse>(`bookings/?${params.toString()}`);
        if (cancelled) return;
        setBookings(response.results || []);
        setCount(response.count || 0);
        setNumPages(Math.max(1, response.num_pages || 1));
        if (Array.isArray(response.years)) setYears(response.years);
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Could not load bookings.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    // Debounce search input so each keystroke does not request another page.
    timer = window.setTimeout(() => { void load(); }, query.trim() ? 300 : 0);
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [year, page, status, query, refreshToken]);

  const pageStart = count === 0 ? 0 : ((page - 1) * PAGE_SIZE) + 1;
  const pageEnd = Math.min(page * PAGE_SIZE, count);

  function changeYear(nextYear: string) {
    setYear(nextYear);
    setPage(1);
  }

  function changeStatus(nextStatus: string) {
    setStatus(nextStatus);
    setPage(1);
  }

  return <div className="page-stack">
    <section className="page-heading heading-with-actions"><div><div className="eyebrow"><span className="eyebrow-line" /> RENTAL WORKFLOW</div><h1>Bookings & rentals</h1><p>Filter the register by year and search without loading the full booking history at once.</p></div><Link href="/bookings/new" className="button button-primary"><Plus size={17} /> New booking</Link></section>
    {error && <div className="form-alert page-alert"><AlertCircle size={17} /> {error}</div>}
    {createdNumber && <div className="form-success page-alert">Booking {createdNumber} was saved successfully.</div>}
    <section className="panel inventory-panel">
      <div className="panel-heading inventory-toolbar">
        <div><h2>Rental register</h2><p>{count.toLocaleString()} matching booking record{count === 1 ? "" : "s"}; showing up to {PAGE_SIZE} at a time.</p></div>
        <div className="toolbar-actions bookings-toolbar-actions">
          <label className="booking-year-filter"><span>Booking year</span><select aria-label="Filter bookings by year" value={year} onChange={(event) => changeYear(event.target.value)}><option value="all">All years (combined)</option>{years.map((value) => <option key={value} value={String(value)}>{value}</option>)}</select></label>
          <div className="search-field"><Search size={17} /><input aria-label="Search bookings" placeholder="Search booking or customer…" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} /></div>
          <button className="icon-button refresh-button" aria-label="Refresh bookings" onClick={() => setRefreshToken((value) => value + 1)}><RefreshCw size={17} /></button>
        </div>
      </div>
      <div className="filter-row"><span className="filter-caption">Filter by status</span>{statuses.map((value) => <button key={value} className={`filter-chip ${status === value ? "filter-chip-active" : ""}`} onClick={() => changeStatus(value)}>{titleCase(value)}</button>)}</div>
      {loading ? <div className="loading-card"><div className="loader-line" /><span>Loading this page of bookings…</span></div> : bookings.length === 0 ? <div className="empty-state"><div className="empty-icon"><CalendarDays size={23} /></div><strong>{query || status !== "all" ? "No matching bookings" : "No rentals found for this year"}</strong><span>{query || status !== "all" ? "Change the search or status filter." : year === "all" ? "No bookings have been recorded yet." : "Choose another year or select All years (combined)."}</span>{!query && status === "all" && <Link href="/bookings/new" className="button button-primary button-small"><Plus size={15} /> Create booking</Link>}</div> : <div className="table-scroll"><table className="data-table"><thead><tr><th>Booking / customer</th><th>Dispatch date</th><th>Expected return</th><th>Items</th><th>Delivery</th><th>Status</th><th className="align-right">Rental total</th><th>Actions</th></tr></thead><tbody>{bookings.map((booking) => <tr key={booking.id}><td><Link className="table-primary booking-number-link" href={`/bookings/${booking.id}`}>{booking.booking_number}</Link><div className="table-secondary">{booking.customer_name}{booking.customer_phone ? ` · ${booking.customer_phone}` : ""}</div></td><td>{dateLabel(booking.scheduled_dispatch_date)}</td><td>{dateLabel(booking.expected_return_date)}</td><td>{booking.items?.reduce((sum, line) => sum + line.quantity, 0) ?? 0} units</td><td>{booking.delivery_required ? <span className="mini-tag mini-tag-blue"><Truck size={12} /> {money(booking.delivery_fee)}</span> : <span className="muted-inline">Customer collection</span>}</td><td><span className={`status-pill status-${booking.status}`}>{titleCase(booking.status)}</span></td><td className="align-right amount-cell">{money(booking.total_amount)}</td><td>{(booking.status === "draft" || booking.status === "historical" || booking.is_legacy_import) ? <Link href={`/bookings/${booking.id}/edit`} className="button button-secondary button-small"><Pencil size={13} /> Edit</Link> : <Link href={`/bookings/${booking.id}`} className="text-link">Open</Link>}</td></tr>)}</tbody></table></div>}
      <div className="table-footer bookings-pagination">
        <span>Showing {pageStart.toLocaleString()}–{pageEnd.toLocaleString()} of {count.toLocaleString()} records</span>
        <div className="pagination-controls"><button className="button button-secondary button-small" disabled={loading || page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft size={15} /> Previous</button><span>Page {Math.min(page, numPages)} of {numPages}</span><button className="button button-secondary button-small" disabled={loading || page >= numPages} onClick={() => setPage((value) => Math.min(numPages, value + 1))}>Next <ChevronRight size={15} /></button></div>
      </div>
      <div className="bookings-list-note">Selecting “All years (combined)” searches across the complete register, but still loads only one page at a time.</div>
    </section>
  </div>;
}
