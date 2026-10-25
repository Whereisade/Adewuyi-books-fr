"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDownToLine, CalendarDays, BarChart3, CircleDollarSign, FileSpreadsheet, RefreshCw, ShieldCheck, TrendingDown, TrendingUp, Truck, Wallet } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { money } from "@/lib/format";

type AmountRow = { method: string; bank_account_id: number | null; bank_account_label: string; amount: string };
type FinancialReport = {
  date_range: { start_date: string; end_date: string };
  charges_recorded: {
    rental_bookings_count: number; rental_total_including_delivery: string; rental_total_excluding_delivery: string; rental_delivery_fees_billed: string;
    rental_order_discounts: string; rental_item_discounts: string; rental_additional_charges: string;
    catering_jobs_count: number; catering_total_including_delivery: string; catering_total_excluding_delivery: string; catering_delivery_fees_billed: string;
    catering_order_discounts: string; catering_additional_charges: string;
  };
  collections: {
    rental_receipts: string; rental_refunds: string; rental_net_collected: string;
    catering_receipts: string; catering_refunds: string; catering_net_collected: string; by_payment_destination: AmountRow[];
  };
  security_deposits: { received: string; refunded: string; net_cash_movement: string; note: string };
  expenses: { total: string; delivery: string; catering_supplies: string; other: string; count: number; by_payment_destination: AmountRow[]; by_category: Array<{ category: string; label: string; count: number; total: string }> };
  item_breakdown: Array<{ item_name: string; unit: string; quantity: number; gross: string; line_discounts: string; line_total: string }>;
  monthly_trend: Array<{ month: string; year: number; billed: string; collected: string; expenses: string; delivery_billed: string }>;
  outstanding_for_orders_in_period: { rental_bookings_live_only: string; catering_jobs: string; total: string; note: string };
  net_recorded_cash_movement_before_opening_balance: string;
  reporting_note: string;
};

function amount(value?: string | number | null) { return Number(value || 0); }
function toCsvCell(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}
function downloadCsv(report: FinancialReport) {
  const rows: unknown[][] = [
    ["RentLedger financial report", report.date_range.start_date, report.date_range.end_date],
    [], ["SUMMARY", "Amount"],
    ["Rental bookings total including delivery", report.charges_recorded.rental_total_including_delivery],
    ["Catering jobs total including delivery", report.charges_recorded.catering_total_including_delivery],
    ["Rental delivery fees billed", report.charges_recorded.rental_delivery_fees_billed],
    ["Catering delivery fees billed", report.charges_recorded.catering_delivery_fees_billed],
    ["Rental collections net of refunds", report.collections.rental_net_collected],
    ["Catering collections net of refunds", report.collections.catering_net_collected],
    ["Operating expenses", report.expenses.total],
    ["Current outstanding for live orders placed in period", report.outstanding_for_orders_in_period.total],
    ["Security deposits received (not revenue)", report.security_deposits.received],
    ["Security deposits refunded", report.security_deposits.refunded],
    [], ["ITEM TOTALS", "Unit", "Quantity", "Gross line amount", "Line discounts", "Net line total"],
    ...report.item_breakdown.map((row) => [row.item_name, row.unit, row.quantity, row.gross, row.line_discounts, row.line_total]),
    [], ["EXPENSES BY CATEGORY", "Expense count", "Total"],
    ...report.expenses.by_category.map((row) => [row.label, row.count, row.total]),
    [], ["MONTHLY TREND", "Billed", "Collected", "Expenses", "Delivery fees billed"],
    ...report.monthly_trend.map((row) => [`${row.month} ${row.year}`, row.billed, row.collected, row.expenses, row.delivery_billed]),
    [], ["Reporting note", report.reporting_note], ["Outstanding note", report.outstanding_for_orders_in_period.note],
  ];
  const content = `\uFEFF${rows.map((row) => row.map(toCsvCell).join(",")).join("\r\n")}`;
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `rentledger-financials-${report.date_range.start_date}-to-${report.date_range.end_date}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function FinancialsPage() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const isoToday = `${currentYear}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const [startDate, setStartDate] = useState(`${currentYear}-01-01`);
  const [endDate, setEndDate] = useState(isoToday);
  const [yearPreset, setYearPreset] = useState(String(currentYear));
  const [requestRange, setRequestRange] = useState({ start: `${currentYear}-01-01`, end: isoToday, nonce: 0 });
  const [report, setReport] = useState<FinancialReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true); setError("");
    const query = new URLSearchParams({ start_date: requestRange.start, end_date: requestRange.end });
    api<FinancialReport>(`reports/financial-summary/?${query.toString()}`)
      .then((result) => { if (alive) setReport(result); })
      .catch((err) => { if (alive) setError(err instanceof ApiError ? err.message : "Could not load financials for this period."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [requestRange]);

  function chooseYear(year: number) {
    const start = `${year}-01-01`;
    const end = year === currentYear ? isoToday : `${year}-12-31`;
    setStartDate(start); setEndDate(end); setYearPreset(String(year));
    setRequestRange((old) => ({ start, end, nonce: old.nonce + 1 }));
  }
  function applyDates() {
    if (!startDate || !endDate || startDate > endDate) { setError("Choose a valid start and end date."); return; }
    setYearPreset(startDate === `${currentYear}-01-01` && endDate === isoToday ? String(currentYear) : (startDate.slice(0, 4) === endDate.slice(0, 4) && startDate === `${startDate.slice(0, 4)}-01-01` && endDate === `${startDate.slice(0, 4)}-12-31` ? startDate.slice(0, 4) : "custom"));
    setRequestRange((old) => ({ start: startDate, end: endDate, nonce: old.nonce + 1 }));
  }

  const totals = useMemo(() => {
    if (!report) return null;
    const charges = report.charges_recorded;
    const totalBilled = amount(charges.rental_total_including_delivery) + amount(charges.catering_total_including_delivery);
    const collections = amount(report.collections.rental_net_collected) + amount(report.collections.catering_net_collected);
    const deliveryBilled = amount(charges.rental_delivery_fees_billed) + amount(charges.catering_delivery_fees_billed);
    const deliveryMarginEstimate = deliveryBilled - amount(report.expenses.delivery);
    return { totalBilled, collections, deliveryBilled, deliveryMarginEstimate, netCollectionsAfterExpenses: collections - amount(report.expenses.total) };
  }, [report]);

  const maxTrendValue = useMemo(() => Math.max(1, ...(report?.monthly_trend || []).flatMap((row) => [amount(row.billed), amount(row.collected), amount(row.expenses)])), [report]);

  return <div className="page-stack financials-page">
    <section className="page-heading heading-with-actions"><div><div className="eyebrow"><span className="eyebrow-line" /> FINANCE & REPORTING</div><h1>Financials</h1><p>Review customer charges, real money collected, item performance, delivery fees, expenses and deposits separately.</p></div><div className="financial-heading-actions">{report && <button className="button button-secondary" onClick={() => downloadCsv(report)}><ArrowDownToLine size={16} /> Export CSV</button>}<button className="button button-primary" onClick={applyDates} disabled={loading}><RefreshCw size={16} /> Run report</button></div></section>

    <section className="panel finance-filter-panel"><div className="finance-filter-title"><CalendarDays size={17} /><div><strong>Reporting period</strong><span>Choose a full year or any custom date range.</span></div></div><div className="finance-filter-controls"><div><label className="field-label" htmlFor="financial-year">Quick-select year</label><select id="financial-year" className="text-input" value={yearPreset} onChange={(event) => { if (event.target.value !== "custom") chooseYear(Number(event.target.value)); else setYearPreset("custom"); }}><option value="custom">Custom date range</option>{Array.from({ length: Math.max(6, currentYear - 2020 + 1) }, (_, index) => currentYear - index).map((year) => <option key={year} value={year}>{year}{year === currentYear ? " · year to date" : " · full year"}</option>)}</select></div><div><label className="field-label" htmlFor="financial-start">Start date</label><input className="text-input" id="financial-start" type="date" value={startDate} max={endDate} onChange={(event) => { setStartDate(event.target.value); setYearPreset("custom"); }} /></div><div><label className="field-label" htmlFor="financial-end">End date</label><input className="text-input" id="financial-end" type="date" value={endDate} min={startDate} onChange={(event) => { setEndDate(event.target.value); setYearPreset("custom"); }} /></div></div><div className="finance-range-caption">Showing <strong>{requestRange.start}</strong> through <strong>{requestRange.end}</strong>. Booking charges use booking date; collections and expenses use their transaction dates.</div></section>

    {error && <div className="form-alert page-alert">{error}</div>}
    {loading && <div className="loading-card"><div className="loader-line" /><span>Calculating your financial report…</span></div>}

    {!loading && report && totals && <>
      <section className="stats-grid finance-stats-grid">
        <article className="stat-card"><div className="stat-top"><span className="stat-label">Total customer charges</span><span className="stat-icon stat-icon-green"><CircleDollarSign size={19} /></span></div><div className="stat-value stat-currency">{money(totals.totalBilled)}</div><div className="stat-foot"><span className="stat-note">Billed rental and catering totals</span></div></article>
        <article className="stat-card"><div className="stat-top"><span className="stat-label">Net collections</span><span className="stat-icon stat-icon-blue"><Wallet size={19} /></span></div><div className="stat-value stat-currency">{money(totals.collections)}</div><div className="stat-foot"><span className="stat-note">Posted receipts less refunds</span></div></article>
        <article className="stat-card"><div className="stat-top"><span className="stat-label">Operating expenses</span><span className="stat-icon stat-icon-purple"><TrendingDown size={19} /></span></div><div className="stat-value stat-currency">{money(report.expenses.total)}</div><div className="stat-foot"><span className="stat-note">{report.expenses.count} posted expense entries</span></div></article>
        <article className="stat-card"><div className="stat-top"><span className="stat-label">Outstanding live orders</span><span className="stat-icon stat-icon-amber"><ClockIcon /></span></div><div className="stat-value stat-currency">{money(report.outstanding_for_orders_in_period.total)}</div><div className="stat-foot"><span className="stat-note">Current balance on orders placed in period</span></div></article>
        <article className="stat-card"><div className="stat-top"><span className="stat-label">Delivery fees billed</span><span className="stat-icon stat-icon-blue"><Truck size={19} /></span></div><div className="stat-value stat-currency">{money(totals.deliveryBilled)}</div><div className="stat-foot"><span className="stat-note">Estimated delivery margin {money(totals.deliveryMarginEstimate)}</span></div></article>
        <article className="stat-card"><div className="stat-top"><span className="stat-label">Collections after expenses</span><span className="stat-icon stat-icon-green"><TrendingUp size={19} /></span></div><div className="stat-value stat-currency">{money(totals.netCollectionsAfterExpenses)}</div><div className="stat-foot"><span className="stat-note">Cash-based view; not an accounting profit statement</span></div></article>
      </section>

      <section className="panel finance-monthly-panel"><div className="panel-heading"><div><h2>Monthly performance</h2><p>Compare customer charges, collections and expenses across the reporting period.</p></div><BarChart3 size={19} /></div>{report.monthly_trend.length === 0 ? <div className="empty-state"><FileSpreadsheet size={24} /><strong>No transactions for this period</strong><span>Choose another date range to view a different period.</span></div> : <div className="finance-trend-list">{report.monthly_trend.map((row) => <div className="finance-trend-row" key={`${row.year}-${row.month}`}><div className="finance-trend-month">{row.month}<small>{row.year}</small></div><div className="finance-trend-bars"><div className="finance-trend-bar-line"><span>Billed</span><div className="finance-trend-track"><span className="trend-bar trend-bar-billed" style={{ width: `${Math.max(amount(row.billed) > 0 ? 1.5 : 0, amount(row.billed) / maxTrendValue * 100)}%` }} /></div><strong>{money(row.billed)}</strong></div><div className="finance-trend-bar-line"><span>Collected</span><div className="finance-trend-track"><span className="trend-bar trend-bar-collected" style={{ width: `${Math.max(amount(row.collected) > 0 ? 1.5 : 0, amount(row.collected) / maxTrendValue * 100)}%` }} /></div><strong>{money(row.collected)}</strong></div><div className="finance-trend-bar-line"><span>Expenses</span><div className="finance-trend-track"><span className="trend-bar trend-bar-expense" style={{ width: `${Math.max(amount(row.expenses) > 0 ? 1.5 : 0, amount(row.expenses) / maxTrendValue * 100)}%` }} /></div><strong>{money(row.expenses)}</strong></div></div><div className="finance-trend-delivery"><span>Delivery billed</span><strong>{money(row.delivery_billed)}</strong></div></div>)}</div>}</section>

      <section className="panel finance-items-panel"><div className="panel-heading"><div><h2>Rental item performance</h2><p>Totals use the saved item name on each booking, so old records remain readable after catalogue edits. Plastic Chair quantities are combined into dozens (12 individual chairs = 1 dozen) to avoid separate unit and dozen rows; saved money totals are unchanged.</p></div><PackageIcon /></div>{report.item_breakdown.length === 0 ? <div className="empty-state"><FileSpreadsheet size={24} /><strong>No rental item lines in this period</strong><span>There are no non-cancelled rental lines matching these dates.</span></div> : <div className="table-scroll"><table className="data-table finance-items-table"><thead><tr><th>Item</th><th>Unit</th><th className="align-right">Qty</th><th className="align-right">Gross line total</th><th className="align-right">Line discounts</th><th className="align-right">Net line total</th></tr></thead><tbody>{report.item_breakdown.map((row, index) => <tr key={`${row.item_name}-${row.unit}-${index}`}><td><span className="table-primary">{row.item_name}</span></td><td>{row.unit}</td><td className="align-right">{row.quantity.toLocaleString("en-NG", { maximumFractionDigits: 4 })}</td><td className="align-right">{money(row.gross)}</td><td className="align-right">{money(row.line_discounts)}</td><td className="align-right amount-cell">{money(row.line_total)}</td></tr>)}</tbody></table></div>}{report.item_breakdown.length > 0 && <div className="table-footer"><span>Item line totals exclude order-level discounts shown below. Plastic Chair quantity is shown in dozen-equivalents.</span><span>{report.item_breakdown.length} item/unit groups</span></div>}</section>

      <section className="finance-detail-grid">
        <section className="panel"><div className="panel-heading"><div><h2>Charges & discounts</h2><p>Amounts recorded on rental bookings and catering jobs.</p></div><CircleDollarSign size={18} /></div><div className="finance-breakdown-list"><div className="finance-breakdown-group"><strong>Rental bookings</strong><div><span>Bookings</span><b>{report.charges_recorded.rental_bookings_count.toLocaleString("en-NG")}</b></div><div><span>Rental total incl. delivery</span><b>{money(report.charges_recorded.rental_total_including_delivery)}</b></div><div><span>Rental charges before delivery</span><b>{money(report.charges_recorded.rental_total_excluding_delivery)}</b></div><div><span>Item discounts</span><b>−{money(report.charges_recorded.rental_item_discounts)}</b></div><div><span>Transport Expenses/External Rentals/Discount</span><b>−{money(report.charges_recorded.rental_order_discounts)}</b></div><div><span>Damages Refund/Additional charges</span><b>{money(report.charges_recorded.rental_additional_charges)}</b></div><div><span>Delivery billed</span><b>{money(report.charges_recorded.rental_delivery_fees_billed)}</b></div></div><div className="finance-breakdown-group"><strong>Catering jobs</strong><div><span>Jobs</span><b>{report.charges_recorded.catering_jobs_count.toLocaleString("en-NG")}</b></div><div><span>Catering total incl. delivery</span><b>{money(report.charges_recorded.catering_total_including_delivery)}</b></div><div><span>Charges before delivery</span><b>{money(report.charges_recorded.catering_total_excluding_delivery)}</b></div><div><span>Order discounts</span><b>−{money(report.charges_recorded.catering_order_discounts)}</b></div><div><span>Additional charges</span><b>{money(report.charges_recorded.catering_additional_charges)}</b></div><div><span>Delivery billed</span><b>{money(report.charges_recorded.catering_delivery_fees_billed)}</b></div></div></div></section>

        

        <section className="panel"><div className="panel-heading"><div><h2>Collections & refunds</h2><p>Only actual recorded payment ledger transactions.</p></div><Wallet size={18} /></div><div className="finance-breakdown-list"><div className="finance-breakdown-group"><strong>Rental bookings</strong><div><span>Receipts</span><b>{money(report.collections.rental_receipts)}</b></div><div><span>Refunds</span><b>−{money(report.collections.rental_refunds)}</b></div><div className="finance-breakdown-total"><span>Net collected</span><b>{money(report.collections.rental_net_collected)}</b></div></div><div className="finance-breakdown-group"><strong>Catering jobs</strong><div><span>Receipts</span><b>{money(report.collections.catering_receipts)}</b></div><div><span>Refunds</span><b>−{money(report.collections.catering_refunds)}</b></div><div className="finance-breakdown-total"><span>Net collected</span><b>{money(report.collections.catering_net_collected)}</b></div></div><div className="finance-breakdown-group"><strong>By payment destination</strong>{report.collections.by_payment_destination.length === 0 ? <p className="finance-empty-note">No collections recorded for this period.</p> : report.collections.by_payment_destination.map((row, index) => <div key={`${row.method}-${row.bank_account_id ?? "cash"}-${index}`}><span>{row.bank_account_label}<small>{row.method === "cash" ? "Cash" : "Bank transfer"}</small></span><b>{money(row.amount)}</b></div>)}</div></div></section>

        <section className="panel"><div className="panel-heading"><div><h2>Security deposits</h2><p>Tracked separately from revenue.</p></div><ShieldCheck size={18} /></div><div className="finance-breakdown-list"><div className="finance-breakdown-group"><div><span>Deposits received</span><b>{money(report.security_deposits.received)}</b></div><div><span>Deposits refunded</span><b>−{money(report.security_deposits.refunded)}</b></div><div className="finance-breakdown-total"><span>Net deposit cash movement</span><b>{money(report.security_deposits.net_cash_movement)}</b></div><p className="finance-explanation">{report.security_deposits.note}</p></div><div className="finance-breakdown-group"><strong>Balances on live orders created in this period</strong><div><span>Rental bookings</span><b>{money(report.outstanding_for_orders_in_period.rental_bookings_live_only)}</b></div><div><span>Catering jobs</span><b>{money(report.outstanding_for_orders_in_period.catering_jobs)}</b></div><div className="finance-breakdown-total"><span>Total current outstanding</span><b>{money(report.outstanding_for_orders_in_period.total)}</b></div><p className="finance-explanation">{report.outstanding_for_orders_in_period.note}</p></div></div></section>
      </section>

      
    </>}
  </div>;
}

function ClockIcon() { return <CircleDollarSign size={19} />; }
function PackageIcon() { return <FileSpreadsheet size={18} />; }
