"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  ArrowLeft, CalendarDays, CheckCircle2, CircleAlert, FileText, PackageCheck,
  Plus, RefreshCw, ShieldCheck, Truck, Wallet, XCircle, Pencil,
} from "lucide-react";
import { api, apiList, ApiError } from "@/lib/api";
import { dateLabel, money, titleCase } from "@/lib/format";
import type { BankAccount, Booking, ChargeAdjustment, InvoiceRecord } from "@/lib/types";

const DELIVERY_STATUSES = ["pending", "scheduled", "out_for_delivery", "delivered", "failed", "cancelled"];

type QuantityTriplet = { usable: string; damaged: string; missing: string };

function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : "The action could not be completed. Please check the form and try again.";
}

function inputNumber(value: string) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export default function BookingDetailPage() {
  const params = useParams<{ id: string }>();
  const bookingId = params.id;
  const [booking, setBooking] = useState<Booking | null>(null);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [paidConfirmedDraft, setPaidConfirmedDraft] = useState(false);
  const [suppliedConfirmedDraft, setSuppliedConfirmedDraft] = useState(false);

  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentKind, setPaymentKind] = useState<"receipt" | "refund">("receipt");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "bank">("cash");
  const [paymentBank, setPaymentBank] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");

  const [dispatchQty, setDispatchQty] = useState<Record<number, string>>({});
  const [dispatchNotes, setDispatchNotes] = useState("");
  const [returnQty, setReturnQty] = useState<Record<number, QuantityTriplet>>({});
  const [returnNotes, setReturnNotes] = useState("");

  const [deliveryStatus, setDeliveryStatus] = useState("pending");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryContactName, setDeliveryContactName] = useState("");
  const [deliveryContactPhone, setDeliveryContactPhone] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [depositNotes, setDepositNotes] = useState("");
  const [depositKind, setDepositKind] = useState<"received" | "refund" | "applied">("received");
  const [depositTxAmount, setDepositTxAmount] = useState("");
  const [depositMethod, setDepositMethod] = useState<"cash" | "bank">("cash");
  const [depositBank, setDepositBank] = useState("");
  const [depositReference, setDepositReference] = useState("");
  const [depositTxNotes, setDepositTxNotes] = useState("");
  const [depositChargeId, setDepositChargeId] = useState("");

  const [chargeKind, setChargeKind] = useState<"damage" | "loss" | "additional_fee" | "other">("damage");
  const [chargeAmount, setChargeAmount] = useState("");
  const [chargeReason, setChargeReason] = useState("");
  const [chargeItemId, setChargeItemId] = useState("");
  const [invoice, setInvoice] = useState<InvoiceRecord | null>(null);

  const load = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    setError("");
    try {
      const [record, accounts] = await Promise.all([
        api<Booking>(`bookings/${bookingId}/`),
        apiList<BankAccount>("bank-accounts/"),
      ]);
      setBooking(record);
      setPaidConfirmedDraft(Boolean(record.paid_confirmed));
      setSuppliedConfirmedDraft(Boolean(record.supplied_confirmed));
      setBankAccounts(accounts.filter((account) => account.is_active));
      setDeliveryStatus(record.delivery_status || "pending");
      setDeliveryAddress(record.delivery_address || "");
      setDeliveryContactName(record.delivery_contact_name || "");
      setDeliveryContactPhone(record.delivery_contact_phone || "");
      setDeliveryNotes(record.delivery_notes || "");
      setDispatchQty(Object.fromEntries((record.items || []).map((line) => [
        line.id,
        String(line.quantity_remaining_to_dispatch ?? Math.max(0, line.quantity - (line.quantity_dispatched || 0))),
      ])));
      setReturnQty(Object.fromEntries((record.items || []).map((line) => [line.id, { usable: "0", damaged: "0", missing: "0" }])));
      if (record.security_deposit) {
        setDepositChargeId((record.charges || []).find((charge) => charge.status === "posted")?.id?.toString() || "");
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => { void load(); }, [load]);

  const financials = booking?.financials || {};
  const postedCharges = useMemo(() => (booking?.charges || []).filter((charge) => charge.status === "posted"), [booking]);
  const totalUnits = booking?.items.reduce((sum, line) => sum + line.quantity, 0) || 0;
  const totalDispatched = booking?.items.reduce((sum, line) => sum + (line.quantity_dispatched || 0), 0) || 0;
  const unresolvedUnits = booking?.items.reduce((sum, line) => sum + (line.quantity_unresolved || 0), 0) || 0;
  const depositHeld = inputNumber(booking?.security_deposit?.totals.held || "0");
  const canDispatch = !!booking && ["confirmed", "partially_dispatched", "partially_returned"].includes(booking.status)
    && booking.items.some((line) => (line.quantity_remaining_to_dispatch ?? Math.max(0, line.quantity - (line.quantity_dispatched || 0))) > 0);
  const canReturn = !!booking && ["dispatched", "partially_dispatched", "partially_returned"].includes(booking.status) && unresolvedUnits > 0;
  const canCancel = !!booking && ["draft", "confirmed"].includes(booking.status);

  async function doAction(key: string, successMessage: string, action: () => Promise<unknown>, after?: (result: unknown) => void) {
    setBusy(key); setError(""); setNotice("");
    try {
      const result = await action();
      after?.(result);
      await load(false);
      setNotice(successMessage);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy("");
    }
  }

  async function confirmBooking() {
    await doAction("confirm", "Booking confirmed and stock availability checked.", () => api(`bookings/${bookingId}/confirm/`, { method: "POST", body: JSON.stringify({}) }));
  }

  async function saveManualOrderStatus() {
    await doAction("quick-status", "Paid and supply confirmations saved.", () => api<Booking>(`bookings/${bookingId}/quick-status/`, {
      method: "PATCH", body: JSON.stringify({ paid_confirmed: paidConfirmedDraft, supplied_confirmed: suppliedConfirmedDraft }),
    }), (result) => {
      const next = result as Booking; setPaidConfirmedDraft(Boolean(next.paid_confirmed)); setSuppliedConfirmedDraft(Boolean(next.supplied_confirmed));
    });
  }

  async function cancelBooking() {
    const reason = window.prompt("Why is this booking being cancelled? (optional)") || "";
    await doAction("cancel", "Booking cancelled.", () => api(`bookings/${bookingId}/cancel/`, { method: "POST", body: JSON.stringify({ reason }) }));
  }

  async function submitPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (paymentMethod === "bank" && !paymentBank) { setError("Choose the bank account that received or paid this money."); return; }
    await doAction("payment", paymentKind === "refund" ? "Refund recorded." : "Payment recorded.", () => api(`bookings/${bookingId}/payments/`, {
      method: "POST",
      body: JSON.stringify({
        amount: paymentAmount,
        kind: paymentKind,
        method: paymentMethod,
        bank_account_id: paymentMethod === "bank" ? Number(paymentBank) : null,
        transaction_reference: paymentReference,
        notes: paymentNotes,
      }),
    }), () => { setPaymentAmount(""); setPaymentReference(""); setPaymentNotes(""); });
  }

  async function submitDispatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const lines = (booking?.items || []).map((line) => ({ booking_item_id: line.id, quantity: inputNumber(dispatchQty[line.id] || "0") }))
      .filter((line) => line.quantity > 0);
    if (!lines.length) { setError("Enter at least one quantity to dispatch."); return; }
    await doAction("dispatch", "Dispatch recorded. Inventory has been updated.", () => api(`bookings/${bookingId}/dispatch/`, {
      method: "POST", body: JSON.stringify({ lines, notes: dispatchNotes }),
    }), () => setDispatchNotes(""));
  }

  async function submitReturn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const lines = (booking?.items || []).map((line) => ({
      booking_item_id: line.id,
      quantity_usable: inputNumber(returnQty[line.id]?.usable || "0"),
      quantity_damaged: inputNumber(returnQty[line.id]?.damaged || "0"),
      quantity_confirmed_missing: inputNumber(returnQty[line.id]?.missing || "0"),
      notes: returnNotes,
    })).filter((line) => line.quantity_usable + line.quantity_damaged + line.quantity_confirmed_missing > 0);
    if (!lines.length) { setError("Record at least one returned, damaged, or confirmed missing quantity."); return; }
    const invalidLine = lines.find((line) => {
      const source = booking?.items.find((candidate) => candidate.id === line.booking_item_id);
      return (line.quantity_usable + line.quantity_damaged + line.quantity_confirmed_missing) > (source?.quantity_unresolved || 0);
    });
    if (invalidLine) { setError("A return quantity exceeds the unresolved quantity shown for that item."); return; }
    await doAction("return", "Return recorded. Usable, damaged, and missing quantities have been updated.", () => api(`bookings/${bookingId}/returns/`, {
      method: "POST", body: JSON.stringify({ lines, notes: returnNotes }),
    }), () => setReturnNotes(""));
  }

  async function saveDelivery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await doAction("delivery", "Delivery status updated.", () => api(`bookings/${bookingId}/delivery/`, {
      method: "PATCH", body: JSON.stringify({
        delivery_status: deliveryStatus,
        delivery_address: deliveryAddress,
        delivery_contact_name: deliveryContactName,
        delivery_contact_phone: deliveryContactPhone,
        delivery_notes: deliveryNotes,
      }),
    }));
  }

  async function createDeposit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await doAction("deposit-create", "Security deposit requirement added.", () => api(`bookings/${bookingId}/security-deposit/`, {
      method: "POST", body: JSON.stringify({ required_amount: depositAmount, notes: depositNotes }),
    }), () => { setDepositAmount(""); setDepositNotes(""); });
  }

  async function submitDepositTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (depositKind !== "applied" && depositMethod === "bank" && !depositBank) { setError("Choose the bank destination for this deposit movement."); return; }
    if (depositKind === "applied" && !depositChargeId) { setError("Choose the charge being settled by this deposit."); return; }
    await doAction("deposit-transaction", "Security deposit movement recorded.", () => api(`bookings/${bookingId}/deposit-transactions/`, {
      method: "POST",
      body: JSON.stringify({
        amount: depositTxAmount,
        kind: depositKind,
        method: depositKind === "applied" ? "" : depositMethod,
        bank_account_id: depositKind !== "applied" && depositMethod === "bank" ? Number(depositBank) : null,
        charge_adjustment_id: depositKind === "applied" ? Number(depositChargeId) : null,
        transaction_reference: depositReference,
        notes: depositTxNotes,
      }),
    }), () => { setDepositTxAmount(""); setDepositReference(""); setDepositTxNotes(""); });
  }

  async function createCharge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await doAction("charge", "Additional charge recorded. You can now apply a deposit to this charge if appropriate.", () => api(`bookings/${bookingId}/charges/`, {
      method: "POST",
      body: JSON.stringify({ kind: chargeKind, amount: chargeAmount, reason: chargeReason, booking_item_id: chargeItemId ? Number(chargeItemId) : null }),
    }), () => { setChargeAmount(""); setChargeReason(""); });
  }

  async function issueInvoice() {
    await doAction("invoice", "Invoice record issued. PDF download is a separate document-generation step.", () => api<InvoiceRecord>(`bookings/${bookingId}/invoice/`, {
      method: "POST", body: JSON.stringify({ issue: true }),
    }), (result) => setInvoice(result as InvoiceRecord));
  }

  if (loading) return <div className="page-stack"><div className="loading-card"><div className="loader-line" /><span>Loading booking details…</span></div></div>;
  if (!booking) return <div className="page-stack"><Link href="/bookings" className="text-link"><ArrowLeft size={15} /> Back to bookings</Link><div className="form-alert page-alert">{error || "Booking not found."}</div></div>;

  return <div className="page-stack">
    <section className="page-heading heading-with-actions booking-detail-heading">
      <div><Link href="/bookings" className="back-link"><ArrowLeft size={15} /> Back to bookings</Link><div className="eyebrow"><span className="eyebrow-line" /> RENTAL RECORD</div><h1>{booking.booking_number}</h1><p>{booking.customer_name}{booking.customer_phone ? ` · ${booking.customer_phone}` : ""} · Created {dateLabel(booking.booking_date)}</p></div>
      <div className="heading-actions">
        {(booking.status === "draft" || booking.status === "historical" || booking.is_legacy_import) && <Link className="button button-secondary" href={`/bookings/${bookingId}/edit`}><Pencil size={16} /> Edit booking</Link>}
        <button className="button button-secondary" onClick={() => void load()} disabled={!!busy}><RefreshCw size={16} /> Refresh</button>
        {booking.status === "draft" && <button className="button button-primary" onClick={() => void confirmBooking()} disabled={!!busy}><CheckCircle2 size={16} /> Confirm booking</button>}
        {canCancel && <button className="button button-danger" onClick={() => void cancelBooking()} disabled={!!busy}><XCircle size={16} /> Cancel</button>}
      </div>
    </section>

    {error && <div className="form-alert page-alert"><CircleAlert size={16} /> {error}</div>}
    {notice && <div className="form-success page-alert"><CheckCircle2 size={16} /> {notice}</div>}
    {invoice && <div className="form-success page-alert">Latest invoice: <strong>{invoice.invoice_number || `Draft #${invoice.id}`}</strong> · Total {money(invoice.total_amount)} · Balance at issue {money(invoice.balance_at_issue)} <a className="inline-document-link" href={`/api/backend/documents/invoices/${invoice.id}/pdf/`}>Download invoice PDF</a></div>}

    <section className="panel detail-action-panel"><div className="panel-heading"><div><h2>Order confirmation</h2><p>Record the simple paid/supplied status used in the old order book.</p></div><PackageCheck size={18} /></div>
      {booking.is_legacy_import && <div className="detail-inline-info"><FileText size={16} /><div><strong>Imported historical order</strong><span>This record was imported from a spreadsheet. No old receipts or inventory movements were fabricated.</span></div></div>}
      <div className="form-two-col"><label className="checkbox-field"><input type="checkbox" checked={paidConfirmedDraft} onChange={(e) => setPaidConfirmedDraft(e.target.checked)} /> Paid / payment confirmed</label><label className="checkbox-field"><input type="checkbox" checked={suppliedConfirmedDraft} onChange={(e) => setSuppliedConfirmedDraft(e.target.checked)} /> Supplied to customer</label></div>
      <div className="detail-form-footer"><span>“Paid” is a manual confirmation only; record an actual payment below to update the financial ledger. Use Dispatch / Return to change inventory.</span><button className="button button-primary" type="button" onClick={() => void saveManualOrderStatus()} disabled={!!busy}>{busy === "quick-status" ? "Saving…" : "Save status"}</button></div>
    </section>

    <section className="booking-detail-stats">
      <article className="stat-card"><div className="stat-top"><span className="stat-label">Booking total</span><span className="stat-icon stat-icon-blue"><Wallet size={18} /></span></div><div className="stat-value">{money(booking.total_amount)}</div><div className="stat-foot"><span className="stat-note">{totalUnits} units on booking</span></div></article>
      <article className="stat-card"><div className="stat-top"><span className="stat-label">Outstanding balance</span><span className="stat-icon stat-icon-amber"><Wallet size={18} /></span></div><div className="stat-value">{booking.is_legacy_import ? "—" : money(financials.balance_due)}</div><div className="stat-foot"><span className="stat-note">{booking.is_legacy_import ? "Historic payment ledger not reconstructed" : "Including posted charges"}</span></div></article>
      <article className="stat-card"><div className="stat-top"><span className="stat-label">Items dispatched</span><span className="stat-icon stat-icon-purple"><Truck size={18} /></span></div><div className="stat-value">{totalDispatched} / {totalUnits}</div><div className="stat-foot"><span className="stat-note">{unresolvedUnits} unit{unresolvedUnits === 1 ? "" : "s"} still out after dispatch</span></div></article>
      <article className="stat-card"><div className="stat-top"><span className="stat-label">Deposit held</span><span className="stat-icon stat-icon-green"><ShieldCheck size={18} /></span></div><div className="stat-value">{money(depositHeld)}</div><div className="stat-foot"><span className="stat-note">Not rental revenue</span></div></article>
    </section>

    <section className="panel detail-overview-panel">
      <div className="panel-heading"><div><h2>Booking overview</h2><p>Dates, operational status and agreed services.</p></div><span className={`status-pill status-${booking.status}`}>{titleCase(booking.status)}</span></div>
      <div className="booking-overview-grid">
        <div><span>Event date</span><strong>{dateLabel(booking.event_date)}</strong></div>
        <div><span>Dispatch / collection</span><strong>{dateLabel(booking.scheduled_dispatch_date)}</strong></div>
        <div><span>Expected return</span><strong>{dateLabel(booking.expected_return_date)}</strong></div>
        <div><span>Delivery</span><strong>{booking.delivery_required ? `${money(booking.delivery_fee)} · ${titleCase(booking.delivery_status)}` : "Customer collection"}</strong></div>
        <div><span>Subtotal</span><strong>{money(booking.subtotal)}</strong></div>
        <div><span>Discount</span><strong>{money(booking.discount_amount)}</strong></div>
        <div><span>Delivery fee</span><strong>{money(booking.delivery_fee)}</strong></div>
        <div><span>Additional charges</span><strong>{money(booking.additional_charges)}</strong></div>
      </div>
      {booking.delivery_required && <div className="detail-inline-info"><Truck size={16} /><div><strong>{booking.delivery_address || "Delivery address not provided"}</strong><span>{[booking.delivery_contact_name, booking.delivery_contact_phone].filter(Boolean).join(" · ") || "No delivery contact added"}{booking.delivery_notes ? ` · ${booking.delivery_notes}` : ""}</span></div></div>}
      {booking.notes && <div className="detail-notes"><span>Internal notes</span><p>{booking.notes}</p></div>}
      <div className="detail-items-table table-scroll"><table className="data-table"><thead><tr><th>Catalogue item</th><th>Booked</th><th>Dispatched</th><th>Usable return</th><th>Damaged</th><th>Missing</th><th className="align-right">Line total</th></tr></thead><tbody>{booking.items.map((line) => <tr key={line.id}><td><div className="table-primary">{line.item_name_snapshot}</div><div className="table-secondary">{line.sku_snapshot}</div></td><td>{line.quantity} {line.quantity_unit_snapshot || "unit"}</td><td>{line.quantity_dispatched || 0}</td><td>{line.quantity_returned_usable || 0}</td><td>{line.quantity_returned_damaged || 0}</td><td>{line.quantity_confirmed_missing || 0}</td><td className="align-right amount-cell">{money(line.line_total)}</td></tr>)}</tbody></table></div>
      <div className="detail-panel-actions"><button className="button button-secondary" onClick={() => void issueInvoice()} disabled={!!busy}><FileText size={16} /> {busy === "invoice" ? "Issuing…" : "Issue invoice"}</button>{invoice && <a className="button button-secondary" href={`/api/backend/documents/invoices/${invoice.id}/pdf/`}><FileText size={16} /> Download PDF</a>}</div>
    </section>

    <div className="booking-workflow-grid">
      <section className="panel detail-action-panel"><div className="panel-heading"><div><h2>Record payment</h2><p>Rental charges and refunds; security deposits are recorded separately.</p></div><Wallet size={18} /></div>
        <form className="detail-form" onSubmit={submitPayment}>
          <div className="form-two-col"><div><label className="field-label" htmlFor="payment-kind">Transaction type *</label><select id="payment-kind" className="text-input" value={paymentKind} onChange={(e) => setPaymentKind(e.target.value as "receipt" | "refund")}><option value="receipt">Payment received</option><option value="refund">Refund to customer</option></select></div><div><label className="field-label" htmlFor="payment-amount">Amount (₦) *</label><input id="payment-amount" className="text-input" type="number" min="0.01" step="0.01" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} required /></div><div><label className="field-label" htmlFor="payment-method">Payment method *</label><select id="payment-method" className="text-input" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as "cash" | "bank")}><option value="cash">Cash</option><option value="bank">Bank transfer</option></select></div>{paymentMethod === "bank" && <div><label className="field-label" htmlFor="payment-bank">Destination bank account *</label><select id="payment-bank" className="text-input" value={paymentBank} onChange={(e) => setPaymentBank(e.target.value)} required><option value="">Select account</option>{bankAccounts.map((account) => <option value={account.id} key={account.id}>{account.label} · {account.bank_name}</option>)}</select>{bankAccounts.length === 0 && <span className="field-hint">No bank destinations configured. <Link href="/bank-accounts" className="text-link">Add a bank account</Link>.</span>}</div>}<div><label className="field-label" htmlFor="payment-reference">Transaction reference</label><input id="payment-reference" className="text-input" value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} placeholder="Optional transfer reference" /></div><div><label className="field-label" htmlFor="payment-notes">Notes</label><input id="payment-notes" className="text-input" value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} placeholder="Optional note" /></div></div>
          <div className="detail-form-footer"><span>{booking.is_legacy_import ? "Historic receipts were not imported. Only record a transaction here if money is received/refunded now." : <>Current balance: <strong>{money(financials.balance_due)}</strong></>}</span><button className="button button-primary" type="submit" disabled={!!busy}>{busy === "payment" ? "Saving…" : "Record transaction"}</button></div>
        </form>
        <div className="detail-history"><h3>Payment history</h3>{!booking.payments?.length ? <p className="muted-inline">No payments recorded yet.</p> : <div className="table-scroll"><table className="data-table"><thead><tr><th>Receipt / date</th><th>Type</th><th>Method</th><th className="align-right">Amount</th></tr></thead><tbody>{booking.payments.map((payment) => <tr key={payment.id}><td><div className="table-primary">{payment.receipt_number || `PAY-${payment.id}`}</div><div className="table-secondary">{dateLabel(payment.paid_at)}</div></td><td>{titleCase(payment.kind)}</td><td>{payment.method === "bank" ? payment.bank_account_label || "Bank transfer" : "Cash"}</td><td className="align-right amount-cell">{money(payment.amount)}<div><a className="inline-document-link" href={`/api/backend/documents/payments/${payment.id}/receipt.pdf/`}>{payment.kind === "refund" ? "Download refund record" : "Download receipt"}</a></div></td></tr>)}</tbody></table></div>}</div>
      </section>

      <section className="panel detail-action-panel"><div className="panel-heading"><div><h2>Dispatch items</h2><p>Record the actual quantities leaving the business.</p></div><PackageCheck size={18} /></div>
        {!canDispatch ? <div className="empty-state compact-empty"><strong>No dispatch action available</strong><span>Confirm the booking first, or all booked units have already been dispatched.</span></div> : <form className="detail-form" onSubmit={submitDispatch}><div className="quantity-entry-list">{booking.items.filter((line) => (line.quantity_remaining_to_dispatch ?? (line.quantity - (line.quantity_dispatched || 0))) > 0).map((line) => { const remaining = line.quantity_remaining_to_dispatch ?? Math.max(0, line.quantity - (line.quantity_dispatched || 0)); return <div className="quantity-entry-row" key={line.id}><div><strong>{line.item_name_snapshot}</strong><span>{remaining} remaining to dispatch</span></div><input aria-label={`Quantity to dispatch for ${line.item_name_snapshot}`} className="text-input quantity-small" type="number" min="0" max={remaining} step="1" value={dispatchQty[line.id] ?? String(remaining)} onChange={(e) => setDispatchQty((current) => ({ ...current, [line.id]: e.target.value }))} /></div>; })}</div><label className="field-label" htmlFor="dispatch-notes">Dispatch notes</label><textarea id="dispatch-notes" className="text-input text-area" rows={2} value={dispatchNotes} onChange={(e) => setDispatchNotes(e.target.value)} placeholder="Optional delivery or collection notes" /><div className="detail-form-footer"><span>Stock updates on save.</span><button className="button button-primary" type="submit" disabled={!!busy}>{busy === "dispatch" ? "Saving…" : "Record dispatch"}</button></div></form>}
      </section>

      <section className="panel detail-action-panel"><div className="panel-heading"><div><h2>Process return</h2><p>Separate usable, damaged, and confirmed missing quantities.</p></div><RefreshCw size={18} /></div>
        {!canReturn ? <div className="empty-state compact-empty"><strong>No items currently awaiting return</strong><span>Dispatch items first. Any outstanding quantities will appear here.</span></div> : <form className="detail-form" onSubmit={submitReturn}><div className="return-quantity-list">{booking.items.filter((line) => (line.quantity_unresolved || 0) > 0).map((line) => { const outstanding = line.quantity_unresolved || 0; const row = returnQty[line.id] || { usable: "0", damaged: "0", missing: "0" }; return <div className="return-entry" key={line.id}><div className="return-entry-heading"><strong>{line.item_name_snapshot}</strong><span>{outstanding} unresolved units</span></div><div className="return-entry-quantities"><div><label className="field-label" htmlFor={`usable-${line.id}`}>Usable</label><input id={`usable-${line.id}`} className="text-input" type="number" min="0" max={outstanding} step="1" value={row.usable} onChange={(e) => setReturnQty((current) => ({ ...current, [line.id]: { ...row, usable: e.target.value } }))} /></div><div><label className="field-label" htmlFor={`damaged-${line.id}`}>Damaged</label><input id={`damaged-${line.id}`} className="text-input" type="number" min="0" max={outstanding} step="1" value={row.damaged} onChange={(e) => setReturnQty((current) => ({ ...current, [line.id]: { ...row, damaged: e.target.value } }))} /></div><div><label className="field-label" htmlFor={`missing-${line.id}`}>Missing</label><input id={`missing-${line.id}`} className="text-input" type="number" min="0" max={outstanding} step="1" value={row.missing} onChange={(e) => setReturnQty((current) => ({ ...current, [line.id]: { ...row, missing: e.target.value } }))} /></div></div></div>; })}</div><label className="field-label" htmlFor="return-notes">Return / inspection notes</label><textarea id="return-notes" className="text-input text-area" rows={2} value={returnNotes} onChange={(e) => setReturnNotes(e.target.value)} placeholder="Required if any item is marked missing; useful for damage details too." /><div className="detail-form-footer"><span>Damaged items stay unavailable.</span><button className="button button-primary" type="submit" disabled={!!busy}>{busy === "return" ? "Saving…" : "Record return"}</button></div></form>}
      </section>

      <section className="panel detail-action-panel"><div className="panel-heading"><div><h2>Delivery tracking</h2><p>Update progress for optional delivery service.</p></div><Truck size={18} /></div>
        {!booking.delivery_required ? <div className="empty-state compact-empty"><strong>Customer collection</strong><span>Delivery is not enabled for this booking.</span></div> : <form className="detail-form" onSubmit={saveDelivery}><div className="form-two-col"><div><label className="field-label" htmlFor="delivery-status">Delivery status *</label><select id="delivery-status" className="text-input" value={deliveryStatus} onChange={(e) => setDeliveryStatus(e.target.value)}>{DELIVERY_STATUSES.map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}</select></div><div><label className="field-label" htmlFor="delivery-contact-name">Delivery contact</label><input id="delivery-contact-name" className="text-input" value={deliveryContactName} onChange={(e) => setDeliveryContactName(e.target.value)} /></div><div className="field-full"><label className="field-label" htmlFor="delivery-address">Delivery address</label><input id="delivery-address" className="text-input" value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} /></div><div><label className="field-label" htmlFor="delivery-contact-phone">Contact phone</label><input id="delivery-contact-phone" className="text-input" value={deliveryContactPhone} onChange={(e) => setDeliveryContactPhone(e.target.value)} /></div><div><label className="field-label" htmlFor="delivery-notes">Delivery notes</label><input id="delivery-notes" className="text-input" value={deliveryNotes} onChange={(e) => setDeliveryNotes(e.target.value)} /></div></div><div className="detail-form-footer"><span>Fee charged: <strong>{money(booking.delivery_fee)}</strong></span><button className="button button-primary" type="submit" disabled={!!busy}>{busy === "delivery" ? "Saving…" : "Update delivery"}</button></div></form>}
      </section>

      <section className="panel detail-action-panel"><div className="panel-heading"><div><h2>Security deposit</h2><p>Optional and tracked separately from rental income.</p></div><ShieldCheck size={18} /></div>
        {!booking.security_deposit ? <form className="detail-form" onSubmit={createDeposit}><p className="detail-help-text">No deposit is currently attached to this booking. Add one only if the customer is required to pay a refundable deposit.</p><label className="field-label" htmlFor="required-deposit">Required deposit (₦) *</label><input id="required-deposit" className="text-input" type="number" min="0.01" step="0.01" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} required /><label className="field-label" htmlFor="deposit-notes">Notes</label><textarea id="deposit-notes" className="text-input text-area" rows={2} value={depositNotes} onChange={(e) => setDepositNotes(e.target.value)} placeholder="Optional deposit terms" /><div className="detail-form-footer"><span>Deposit not required? Leave it untouched.</span><button className="button button-primary" type="submit" disabled={!!busy}>{busy === "deposit-create" ? "Saving…" : "Add deposit"}</button></div></form> : <>
          <div className="detail-panel-actions"><a className="button button-secondary" href={`/api/backend/bookings/${bookingId}/security-deposit/statement.pdf/`}><FileText size={16} /> Download deposit statement</a></div>
          <div className="deposit-summary-grid"><div><span>Required</span><strong>{money(booking.security_deposit.required_amount)}</strong></div><div><span>Received</span><strong>{money(booking.security_deposit.totals.received)}</strong></div><div><span>Refunded</span><strong>{money(booking.security_deposit.totals.refunded)}</strong></div><div><span>Applied to charges</span><strong>{money(booking.security_deposit.totals.applied)}</strong></div><div><span>Still held</span><strong>{money(booking.security_deposit.totals.held)}</strong></div></div>
          <form className="detail-form" onSubmit={submitDepositTransaction}><div className="form-two-col"><div><label className="field-label" htmlFor="deposit-kind">Deposit movement *</label><select id="deposit-kind" className="text-input" value={depositKind} onChange={(e) => setDepositKind(e.target.value as "received" | "refund" | "applied")}><option value="received">Deposit received</option><option value="refund">Refund deposit</option><option value="applied">Apply to approved charge</option></select></div><div><label className="field-label" htmlFor="deposit-tx-amount">Amount (₦) *</label><input id="deposit-tx-amount" className="text-input" type="number" min="0.01" step="0.01" max={depositKind === "received" ? Math.max(0, inputNumber(booking.security_deposit.required_amount) - inputNumber(booking.security_deposit.totals.received)) : depositHeld} value={depositTxAmount} onChange={(e) => setDepositTxAmount(e.target.value)} required /></div>{depositKind !== "applied" && <div><label className="field-label" htmlFor="deposit-method">Method *</label><select id="deposit-method" className="text-input" value={depositMethod} onChange={(e) => setDepositMethod(e.target.value as "cash" | "bank")}><option value="cash">Cash</option><option value="bank">Bank transfer</option></select></div>}{depositKind !== "applied" && depositMethod === "bank" && <div><label className="field-label" htmlFor="deposit-bank">Bank destination *</label><select id="deposit-bank" className="text-input" value={depositBank} onChange={(e) => setDepositBank(e.target.value)} required><option value="">Select account</option>{bankAccounts.map((account) => <option value={account.id} key={account.id}>{account.label} · {account.bank_name}</option>)}</select></div>}{depositKind === "applied" && <div className="field-full"><label className="field-label" htmlFor="deposit-charge">Approved charge *</label><select id="deposit-charge" className="text-input" value={depositChargeId} onChange={(e) => setDepositChargeId(e.target.value)} required><option value="">Select charge</option>{postedCharges.map((charge) => <option value={charge.id} key={charge.id}>{titleCase(charge.kind)} · {money(charge.amount)} · {charge.reason}</option>)}</select></div>}<div><label className="field-label" htmlFor="deposit-reference">Transaction reference</label><input id="deposit-reference" className="text-input" value={depositReference} onChange={(e) => setDepositReference(e.target.value)} /></div><div><label className="field-label" htmlFor="deposit-tx-notes">Notes</label><input id="deposit-tx-notes" className="text-input" value={depositTxNotes} onChange={(e) => setDepositTxNotes(e.target.value)} /></div></div><div className="detail-form-footer"><span>{depositKind === "applied" ? "Internal allocation; no cash movement." : "Record the actual cash or bank movement."}</span><button className="button button-primary" type="submit" disabled={!!busy}>{busy === "deposit-transaction" ? "Saving…" : "Record deposit movement"}</button></div></form>
          <div className="detail-history"><h3>Deposit history</h3>{!booking.security_deposit.transactions.length ? <p className="muted-inline">No deposit movements recorded yet.</p> : <div className="table-scroll"><table className="data-table"><thead><tr><th>Reference / date</th><th>Movement</th><th>Method</th><th className="align-right">Amount</th></tr></thead><tbody>{booking.security_deposit.transactions.map((tx) => <tr key={tx.id}><td><div className="table-primary">{tx.receipt_number || `DEP-${tx.id}`}</div><div className="table-secondary">{dateLabel(tx.occurred_at)}</div></td><td>{titleCase(tx.kind)}</td><td>{tx.kind === "applied" ? "Internal allocation" : tx.method === "bank" ? tx.bank_account_label || "Bank transfer" : "Cash"}</td><td className="align-right amount-cell">{money(tx.amount)}</td></tr>)}</tbody></table></div>}</div>
        </>}
      </section>

      <section className="panel detail-action-panel"><div className="panel-heading"><div><h2>Additional charges</h2><p>Record agreed damage, loss, or other charges separately.</p></div><Plus size={18} /></div>
        <form className="detail-form" onSubmit={createCharge}><div className="form-two-col"><div><label className="field-label" htmlFor="charge-kind">Charge type *</label><select id="charge-kind" className="text-input" value={chargeKind} onChange={(e) => setChargeKind(e.target.value as typeof chargeKind)}><option value="damage">Damage charge</option><option value="loss">Missing / lost item</option><option value="additional_fee">Additional fee</option><option value="other">Other</option></select></div><div><label className="field-label" htmlFor="charge-amount">Amount (₦) *</label><input id="charge-amount" className="text-input" type="number" min="0.01" step="0.01" value={chargeAmount} onChange={(e) => setChargeAmount(e.target.value)} required /></div><div className="field-full"><label className="field-label" htmlFor="charge-item">Related item</label><select id="charge-item" className="text-input" value={chargeItemId} onChange={(e) => setChargeItemId(e.target.value)}><option value="">Not tied to one item</option>{booking.items.map((line) => <option value={line.id} key={line.id}>{line.item_name_snapshot}</option>)}</select></div><div className="field-full"><label className="field-label" htmlFor="charge-reason">Reason *</label><textarea id="charge-reason" className="text-input text-area" rows={2} value={chargeReason} onChange={(e) => setChargeReason(e.target.value)} required /></div></div><div className="detail-form-footer"><span>Current posted charges: <strong>{money(postedCharges.reduce((sum, charge) => sum + inputNumber(charge.amount), 0))}</strong></span><button className="button button-primary" type="submit" disabled={!!busy}>{busy === "charge" ? "Saving…" : "Add charge"}</button></div></form>
        <div className="detail-history"><h3>Charge history</h3>{!booking.charges?.length ? <p className="muted-inline">No additional charges recorded.</p> : <div className="table-scroll"><table className="data-table"><thead><tr><th>Type / reason</th><th>Status</th><th className="align-right">Amount</th></tr></thead><tbody>{booking.charges.map((charge: ChargeAdjustment) => <tr key={charge.id}><td><div className="table-primary">{titleCase(charge.kind)}</div><div className="table-secondary">{charge.reason}</div></td><td>{titleCase(charge.status)}</td><td className="align-right amount-cell">{money(charge.amount)}</td></tr>)}</tbody></table></div>}</div>
      </section>
    </div>
  </div>;
}
