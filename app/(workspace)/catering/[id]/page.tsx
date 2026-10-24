"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, BadgeCheck, CheckCircle2, CircleAlert, FileText, PackageCheck,
  RefreshCw, Truck, Wallet, XCircle, ReceiptText, ChefHat, PackageOpen, Banknote,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { dateLabel, money, titleCase } from "@/lib/format";
import type { BankAccount, PaymentRecord, InvoiceRecord } from "@/lib/types";

type MaterialMovement = { id: number; kind: "dispatch" | "return_usable" | "return_damaged" | "mark_missing"; quantity: number; occurred_at: string; notes: string };
type MaterialAllocation = { id: number; item_id: number; item_name_snapshot: string; sku_snapshot: string; quantity: number; notes: string; movements: MaterialMovement[] };
type CateringLine = { id: number; description: string; quantity: string; unit_label: string; unit_price: string; line_total: string; notes: string };
type CateringJob = {
  id: number; job_number: string; customer: number; customer_name: string; customer_phone: string; status: string;
  event_date: string; scheduled_dispatch_date: string; expected_return_date: string; event_location: string; guest_count: number | null;
  subtotal: string; discount_amount: string; discount_reason: string; additional_charges: string; delivery_required: boolean;
  delivery_fee: string; delivery_status: string; delivery_address: string; delivery_contact_name: string; delivery_contact_phone: string;
  delivery_notes: string; delivered_at: string | null; total_amount: string; notes: string; lines: CateringLine[];
  material_allocations: MaterialAllocation[]; payments: PaymentRecord[]; financials: Record<string, string>;
};
type Expense = { id: number; category: string; description: string; amount: string; method: string; bank_account_label: string; expense_date: string; reference: string; notes: string };
type Quantities = { usable: string; damaged: string; missing: string };
const DELIVERY_STATUSES = ["pending", "scheduled", "out_for_delivery", "delivered", "failed", "cancelled"];
const EXPENSE_CATEGORIES = ["catering_supplies", "staff", "maintenance", "fuel", "delivery", "other"];
const n = (value: unknown) => Number(value ?? 0) || 0;
const errorMessage = (error: unknown) => error instanceof ApiError ? error.message : "The action could not be completed. Please check the details and try again.";

function allocationTotals(allocation: MaterialAllocation) {
  const dispatched = allocation.movements.filter((movement) => movement.kind === "dispatch").reduce((sum, movement) => sum + movement.quantity, 0);
  const usable = allocation.movements.filter((movement) => movement.kind === "return_usable").reduce((sum, movement) => sum + movement.quantity, 0);
  const damaged = allocation.movements.filter((movement) => movement.kind === "return_damaged").reduce((sum, movement) => sum + movement.quantity, 0);
  const missing = allocation.movements.filter((movement) => movement.kind === "mark_missing").reduce((sum, movement) => sum + movement.quantity, 0);
  return { dispatched, usable, damaged, missing, unresolved: Math.max(0, dispatched - usable - damaged - missing), remainingToDispatch: Math.max(0, allocation.quantity - dispatched) };
}

export default function CateringJobDetailPage() {
  const params = useParams<{ id: string }>();
  const jobId = params.id;
  const [job, setJob] = useState<CateringJob | null>(null);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [invoice, setInvoice] = useState<InvoiceRecord | null>(null);
  const [dispatchQuantities, setDispatchQuantities] = useState<Record<number, string>>({});
  const [dispatchNotes, setDispatchNotes] = useState("");
  const [returnQuantities, setReturnQuantities] = useState<Record<number, Quantities>>({});
  const [returnNotes, setReturnNotes] = useState("");
  const [paymentKind, setPaymentKind] = useState<"receipt" | "refund">("receipt");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "bank">("cash");
  const [paymentBank, setPaymentBank] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [deliveryStatus, setDeliveryStatus] = useState("pending");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryContact, setDeliveryContact] = useState("");
  const [deliveryPhone, setDeliveryPhone] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [expenseCategory, setExpenseCategory] = useState("catering_supplies");
  const [expenseDescription, setExpenseDescription] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseMethod, setExpenseMethod] = useState<"cash" | "bank">("cash");
  const [expenseBank, setExpenseBank] = useState("");
  const [expenseReference, setExpenseReference] = useState("");
  const [expenseNotes, setExpenseNotes] = useState("");

  const load = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    setError("");
    try {
      const [jobResult, bankRows, expenseRows] = await Promise.all([
        api<CateringJob>(`catering/jobs/${jobId}/`),
        api<BankAccount[]>("bank-accounts/"),
        api<Expense[]>(`expenses/?catering_job=${jobId}`),
      ]);
      setJob(jobResult);
      setBankAccounts(bankRows.filter((account) => account.is_active));
      setExpenses(expenseRows);
      setDeliveryStatus(jobResult.delivery_status === "not_required" ? "pending" : jobResult.delivery_status);
      setDeliveryAddress(jobResult.delivery_address || "");
      setDeliveryContact(jobResult.delivery_contact_name || "");
      setDeliveryPhone(jobResult.delivery_contact_phone || "");
      setDeliveryNotes(jobResult.delivery_notes || "");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => { void load(); }, [load]);

  const materialStats = useMemo(() => (job?.material_allocations || []).map((allocation) => ({
    allocation, ...allocationTotals(allocation),
  })), [job]);
  const expenseTotal = expenses.reduce((sum, expense) => sum + n(expense.amount), 0);
  const serviceBalance = n(job?.financials?.balance_due);
  const totalUnits = (job?.material_allocations || []).reduce((sum, allocation) => sum + allocation.quantity, 0);
  const dispatchedUnits = materialStats.reduce((sum, row) => sum + row.dispatched, 0);
  const unresolvedUnits = materialStats.reduce((sum, row) => sum + row.unresolved, 0);

  async function runAction(key: string, success: string, action: () => Promise<unknown>, after?: () => void) {
    setBusy(key); setError(""); setNotice("");
    try {
      await action();
      after?.();
      await load(false);
      setNotice(success);
    } catch (err) { setError(errorMessage(err)); }
    finally { setBusy(""); }
  }

  async function confirmJob() {
    await runAction("confirm", "Catering job confirmed and reusable stock availability checked.", () => api(`catering/jobs/${jobId}/confirm/`, { method: "POST", body: JSON.stringify({}) }));
  }

  async function cancelJob() {
    const reason = window.prompt("Why is this catering job being cancelled? (optional)") || "";
    await runAction("cancel", "Catering job cancelled.", () => api(`catering/jobs/${jobId}/cancel/`, { method: "POST", body: JSON.stringify({ reason }) }));
  }

  async function dispatchMaterials(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const lines = materialStats.map(({ allocation, remainingToDispatch }) => ({
      allocation_id: allocation.id, quantity: Math.min(remainingToDispatch, Math.max(0, Math.floor(n(dispatchQuantities[allocation.id])))),
    })).filter((line) => line.quantity > 0);
    if (!lines.length) { setError("Enter a quantity to dispatch for at least one material."); return; }
    await runAction("dispatch", "Reusable materials dispatch recorded.", () => api(`catering/jobs/${jobId}/dispatch-materials/`, {
      method: "POST", body: JSON.stringify({ lines, notes: dispatchNotes }),
    }), () => { setDispatchQuantities({}); setDispatchNotes(""); });
  }

  async function returnMaterials(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const lines = materialStats.map(({ allocation, unresolved }) => {
      const row = returnQuantities[allocation.id] || { usable: "", damaged: "", missing: "" };
      return { allocation_id: allocation.id, quantity_usable: Math.max(0, Math.floor(n(row.usable))),
        quantity_damaged: Math.max(0, Math.floor(n(row.damaged))), quantity_confirmed_missing: Math.max(0, Math.floor(n(row.missing))), notes: returnNotes,
        allowed: unresolved };
    }).filter((line) => line.quantity_usable + line.quantity_damaged + line.quantity_confirmed_missing > 0);
    if (!lines.length) { setError("Enter returned, damaged, or confirmed missing quantities."); return; }
    if (lines.some((line) => line.quantity_usable + line.quantity_damaged + line.quantity_confirmed_missing > line.allowed)) {
      setError("A return quantity exceeds the unresolved quantity currently out on this job."); return;
    }
    await runAction("return", "Material return recorded. Usable, damaged and missing quantities have been updated.", () => api(`catering/jobs/${jobId}/return-materials/`, {
      method: "POST", body: JSON.stringify({ lines: lines.map(({ allowed: _allowed, ...line }) => line), notes: returnNotes }),
    }), () => { setReturnQuantities({}); setReturnNotes(""); });
  }

  async function submitPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (paymentMethod === "bank" && !paymentBank) { setError("Select the bank account used for this payment."); return; }
    await runAction("payment", paymentKind === "refund" ? "Catering payment refund recorded." : "Catering payment recorded.", () => api(`catering/jobs/${jobId}/payments/`, {
      method: "POST", body: JSON.stringify({ amount: paymentAmount, method: paymentMethod, kind: paymentKind,
        bank_account_id: paymentMethod === "bank" ? Number(paymentBank) : null,
        transaction_reference: paymentReference, notes: paymentNotes }),
    }), () => { setPaymentAmount(""); setPaymentReference(""); setPaymentNotes(""); });
  }

  async function saveDelivery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runAction("delivery", "Catering delivery details updated.", () => api(`catering/jobs/${jobId}/delivery/`, {
      method: "PATCH", body: JSON.stringify({ delivery_status: deliveryStatus, delivery_address: deliveryAddress,
        delivery_contact_name: deliveryContact, delivery_contact_phone: deliveryPhone, delivery_notes: deliveryNotes }),
    }));
  }

  async function submitExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (expenseMethod === "bank" && !expenseBank) { setError("Select the bank account used to pay this expense."); return; }
    await runAction("expense", "Catering job expense recorded.", () => api("expenses/", {
      method: "POST", body: JSON.stringify({ catering_job_id: Number(jobId), category: expenseCategory,
        description: expenseDescription, amount: expenseAmount, method: expenseMethod,
        bank_account_id: expenseMethod === "bank" ? Number(expenseBank) : null,
        reference: expenseReference, notes: expenseNotes }),
    }), () => { setExpenseDescription(""); setExpenseAmount(""); setExpenseReference(""); setExpenseNotes(""); });
  }

  async function issueInvoice() {
    setBusy("invoice"); setError(""); setNotice("");
    try {
      const result = await api<InvoiceRecord>(`catering/jobs/${jobId}/invoice/`, { method: "POST", body: JSON.stringify({ issue: true }) });
      setInvoice(result);
      setNotice("Catering invoice issued. Download the PDF below.");
    } catch (err) { setError(errorMessage(err)); }
    finally { setBusy(""); }
  }

  async function completeJob() {
    await runAction("complete", "Catering job marked completed.", () => api(`catering/jobs/${jobId}/complete/`, { method: "POST", body: JSON.stringify({}) }));
  }

  if (loading) return <div className="page-stack"><div className="loading-card"><div className="loader-line" /><span>Loading catering job…</span></div></div>;
  if (!job) return <div className="page-stack"><Link href="/catering" className="back-link"><ArrowLeft size={15} /> Back to catering jobs</Link><div className="form-alert page-alert">{error || "Catering job not found."}</div></div>;

  const canCancel = ["draft", "confirmed"].includes(job.status);
  const canDispatch = ["confirmed", "in_progress"].includes(job.status) && materialStats.some((row) => row.remainingToDispatch > 0);
  const canReturn = ["confirmed", "in_progress"].includes(job.status) && materialStats.some((row) => row.unresolved > 0);

  return <div className="page-stack">
    <section className="page-heading heading-with-actions booking-detail-heading">
      <div><Link href="/catering" className="back-link"><ArrowLeft size={15} /> Back to catering jobs</Link><div className="eyebrow"><span className="eyebrow-line" /> CATERING SERVICE RECORD</div><h1>{job.job_number}</h1><p>{job.customer_name}{job.customer_phone ? ` · ${job.customer_phone}` : ""}</p></div>
      <div className="heading-actions"><button className="button button-secondary" onClick={() => void load()} disabled={!!busy}><RefreshCw size={16} /> Refresh</button>{job.status === "draft" && <button className="button button-primary" onClick={() => void confirmJob()} disabled={!!busy}><BadgeCheck size={16} /> Confirm job</button>}{["confirmed", "in_progress"].includes(job.status) && <button className="button button-primary" onClick={() => void completeJob()} disabled={!!busy}><CheckCircle2 size={16} /> Complete job</button>}{canCancel && <button className="button button-danger" onClick={() => void cancelJob()} disabled={!!busy}><XCircle size={16} /> Cancel</button>}</div>
    </section>
    {error && <div className="form-alert page-alert"><CircleAlert size={16} /> {error}</div>}{notice && <div className="form-success page-alert"><CheckCircle2 size={16} /> {notice}</div>}
    {invoice && <div className="form-success page-alert">Invoice <strong>{invoice.invoice_number || `Draft #${invoice.id}`}</strong> · Total {money(invoice.total_amount)} · <a className="inline-document-link" href={`/api/backend/documents/invoices/${invoice.id}/pdf/`}>Download invoice PDF</a></div>}

    <section className="booking-detail-stats">
      <article className="stat-card"><div className="stat-top"><span className="stat-label">Catering job total</span><span className="stat-icon stat-icon-green"><ChefHat size={18} /></span></div><div className="stat-value">{money(job.total_amount)}</div><div className="stat-foot"><span className="stat-note">Service and delivery charges</span></div></article>
      <article className="stat-card"><div className="stat-top"><span className="stat-label">Outstanding</span><span className="stat-icon stat-icon-amber"><Wallet size={18} /></span></div><div className="stat-value">{money(serviceBalance)}</div><div className="stat-foot"><span className="stat-note">After recorded payments</span></div></article>
      <article className="stat-card"><div className="stat-top"><span className="stat-label">Reusable materials out</span><span className="stat-icon stat-icon-purple"><Truck size={18} /></span></div><div className="stat-value">{unresolvedUnits}</div><div className="stat-foot"><span className="stat-note">{dispatchedUnits} dispatched / {totalUnits} allocated</span></div></article>
      <article className="stat-card"><div className="stat-top"><span className="stat-label">Recorded expenses</span><span className="stat-icon stat-icon-blue"><Banknote size={18} /></span></div><div className="stat-value">{money(expenseTotal)}</div><div className="stat-foot"><span className="stat-note">Job costs entered so far</span></div></article>
    </section>

    <section className="panel detail-overview-panel">
      <div className="panel-heading"><div><h2>Catering job overview</h2><p>Event information, service charges and reusable materials.</p></div><span className={`status-pill status-${job.status}`}>{titleCase(job.status)}</span></div>
      <div className="booking-overview-grid"><div><span>Event date</span><strong>{dateLabel(job.event_date)}</strong></div><div><span>Guests</span><strong>{job.guest_count ?? "Not specified"}</strong></div><div><span>Venue</span><strong>{job.event_location || "Not specified"}</strong></div><div><span>Materials dispatch</span><strong>{dateLabel(job.scheduled_dispatch_date)}</strong></div><div><span>Expected material return</span><strong>{dateLabel(job.expected_return_date)}</strong></div><div><span>Subtotal</span><strong>{money(job.subtotal)}</strong></div><div><span>Discount</span><strong>{money(job.discount_amount)}</strong></div><div><span>Delivery fee</span><strong>{job.delivery_required ? money(job.delivery_fee) : "Not required"}</strong></div></div>
      {job.notes && <div className="detail-notes"><span>Internal notes</span><p>{job.notes}</p></div>}
      <div className="detail-items-table table-scroll"><table className="data-table"><thead><tr><th>Service</th><th>Qty</th><th>Unit price</th><th className="align-right">Line total</th></tr></thead><tbody>{job.lines.map((line) => <tr key={line.id}><td><div className="table-primary">{line.description}</div>{line.notes && <div className="table-secondary">{line.notes}</div>}</td><td>{line.quantity} {line.unit_label}</td><td>{money(line.unit_price)}</td><td className="align-right amount-cell">{money(line.line_total)}</td></tr>)}</tbody></table></div>
      <div className="detail-panel-actions"><button className="button button-secondary" onClick={() => void issueInvoice()} disabled={!!busy}><FileText size={16} /> {busy === "invoice" ? "Issuing…" : "Issue invoice"}</button>{invoice && <a className="button button-secondary" href={`/api/backend/documents/invoices/${invoice.id}/pdf/`}><FileText size={16} /> Download PDF</a>}</div>
    </section>

    <div className="booking-workflow-grid">
      <section className="panel detail-action-panel"><div className="panel-heading"><div><h2>Record service payment</h2><p>Record installments or refunds against this catering job.</p></div><Wallet size={18} /></div>
        <form className="detail-form" onSubmit={submitPayment}><div className="form-two-col"><div><label className="field-label" htmlFor="catering-payment-kind">Transaction type *</label><select id="catering-payment-kind" className="text-input" value={paymentKind} onChange={(event) => setPaymentKind(event.target.value as "receipt" | "refund")}><option value="receipt">Payment received</option><option value="refund">Refund to customer</option></select></div><div><label className="field-label" htmlFor="catering-payment-amount">Amount (NGN) *</label><input id="catering-payment-amount" className="text-input" type="number" min="0.01" step="0.01" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} required /></div><div><label className="field-label" htmlFor="catering-payment-method">Method *</label><select id="catering-payment-method" className="text-input" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as "cash" | "bank")}><option value="cash">Cash</option><option value="bank">Bank transfer</option></select></div>{paymentMethod === "bank" && <div><label className="field-label" htmlFor="catering-payment-bank">Bank destination *</label><select id="catering-payment-bank" className="text-input" value={paymentBank} onChange={(event) => setPaymentBank(event.target.value)} required><option value="">Choose bank account</option>{bankAccounts.map((account) => <option value={account.id} key={account.id}>{account.label} · {account.bank_name}</option>)}</select></div>}<div><label className="field-label" htmlFor="catering-payment-reference">Transfer reference</label><input id="catering-payment-reference" className="text-input" value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} /></div><div><label className="field-label" htmlFor="catering-payment-notes">Notes</label><input id="catering-payment-notes" className="text-input" value={paymentNotes} onChange={(event) => setPaymentNotes(event.target.value)} /></div></div><div className="detail-form-footer"><span>Outstanding: <strong>{money(serviceBalance)}</strong></span><button className="button button-primary" type="submit" disabled={!!busy}>{busy === "payment" ? "Saving…" : "Record payment"}</button></div></form>
        <div className="detail-history"><h3>Payment history</h3>{!job.payments.length ? <p className="muted-inline">No payments recorded yet.</p> : <div className="table-scroll"><table className="data-table"><thead><tr><th>Reference / date</th><th>Type</th><th>Method</th><th className="align-right">Amount / document</th></tr></thead><tbody>{job.payments.map((payment) => <tr key={payment.id}><td><div className="table-primary">{payment.receipt_number || `PAY-${payment.id}`}</div><div className="table-secondary">{dateLabel(payment.paid_at)}</div></td><td>{titleCase(payment.kind)}</td><td>{payment.method === "bank" ? payment.bank_account_label || "Bank transfer" : "Cash"}</td><td className="align-right amount-cell">{money(payment.amount)}<div><a className="inline-document-link" href={`/api/backend/documents/payments/${payment.id}/receipt.pdf/`}>{payment.kind === "refund" ? "Download refund record" : "Download receipt"}</a></div></td></tr>)}</tbody></table></div>}</div>
      </section>

      <section className="panel detail-action-panel"><div className="panel-heading"><div><h2>Reusable materials</h2><p>These items use the same inventory as rental bookings.</p></div><PackageOpen size={18} /></div>
        {!job.material_allocations.length ? <div className="empty-state compact-empty"><strong>No reusable materials allocated</strong><span>This job is tracking catering services only.</span></div> : <div className="detail-items-table table-scroll"><table className="data-table"><thead><tr><th>Item</th><th>Allocated</th><th>Out now</th><th>Usable back</th><th>Damaged</th><th>Missing</th><th>Not dispatched</th></tr></thead><tbody>{materialStats.map(({ allocation, dispatched, usable, damaged, missing, unresolved, remainingToDispatch }) => <tr key={allocation.id}><td><div className="table-primary">{allocation.item_name_snapshot}</div><div className="table-secondary">{allocation.sku_snapshot}</div></td><td>{allocation.quantity}</td><td>{unresolved}</td><td>{usable}</td><td>{damaged}</td><td>{missing}</td><td>{remainingToDispatch}</td></tr>)}</tbody></table></div>}
        {canDispatch && <form className="detail-form" onSubmit={dispatchMaterials}><h3>Dispatch materials</h3><div className="material-workflow-grid">{materialStats.filter((row) => row.remainingToDispatch > 0).map(({ allocation, remainingToDispatch }) => <div className="material-workflow-row" key={allocation.id}><label className="field-label" htmlFor={`dispatch-${allocation.id}`}>{allocation.item_name_snapshot} · up to {remainingToDispatch}</label><input className="text-input" id={`dispatch-${allocation.id}`} type="number" min="0" max={remainingToDispatch} step="1" value={dispatchQuantities[allocation.id] || ""} onChange={(event) => setDispatchQuantities((rows) => ({ ...rows, [allocation.id]: event.target.value }))} /></div>)}</div><label className="field-label" htmlFor="catering-dispatch-notes">Dispatch notes</label><input className="text-input" id="catering-dispatch-notes" value={dispatchNotes} onChange={(event) => setDispatchNotes(event.target.value)} /><div className="detail-form-footer"><span>Only actual issued quantities should be entered.</span><button className="button button-primary" type="submit" disabled={!!busy}>{busy === "dispatch" ? "Recording…" : "Record dispatch"}</button></div></form>}
        {canReturn && <form className="detail-form material-return-form" onSubmit={returnMaterials}><h3>Process material returns</h3><p className="detail-help-text">For each item out on this job, separate usable, damaged and confirmed missing quantities.</p>{materialStats.filter((row) => row.unresolved > 0).map(({ allocation, unresolved }) => { const row = returnQuantities[allocation.id] || { usable: "", damaged: "", missing: "" }; return <div className="material-return-line" key={allocation.id}><strong>{allocation.item_name_snapshot}</strong><span className="muted-inline">{unresolved} currently unresolved</span><div className="material-return-inputs"><label>Usable<input className="text-input" type="number" min="0" max={unresolved} value={row.usable} onChange={(event) => setReturnQuantities((rows) => ({ ...rows, [allocation.id]: { ...(rows[allocation.id] || { usable: "", damaged: "", missing: "" }), usable: event.target.value } }))} /></label><label>Damaged<input className="text-input" type="number" min="0" max={unresolved} value={row.damaged} onChange={(event) => setReturnQuantities((rows) => ({ ...rows, [allocation.id]: { ...(rows[allocation.id] || { usable: "", damaged: "", missing: "" }), damaged: event.target.value } }))} /></label><label>Missing<input className="text-input" type="number" min="0" max={unresolved} value={row.missing} onChange={(event) => setReturnQuantities((rows) => ({ ...rows, [allocation.id]: { ...(rows[allocation.id] || { usable: "", damaged: "", missing: "" }), missing: event.target.value } }))} /></label></div></div>; })}<label className="field-label" htmlFor="catering-return-notes">Return notes</label><input className="text-input" id="catering-return-notes" value={returnNotes} onChange={(event) => setReturnNotes(event.target.value)} /><div className="detail-form-footer"><span>Damaged items stay unavailable in inventory.</span><button className="button button-primary" type="submit" disabled={!!busy}>{busy === "return" ? "Recording…" : "Record return"}</button></div></form>}
        <div className="detail-history"><h3>Material movement history</h3>{!job.material_allocations.some((allocation) => allocation.movements.length) ? <p className="muted-inline">No material movements yet.</p> : job.material_allocations.flatMap((allocation) => allocation.movements.map((movement) => ({ ...movement, item_name: allocation.item_name_snapshot }))).sort((a, b) => b.occurred_at.localeCompare(a.occurred_at)).map((movement) => <div className="movement-history-row" key={movement.id}><div><strong>{movement.item_name} · {titleCase(movement.kind)}</strong><span>{dateLabel(movement.occurred_at)}{movement.notes ? ` · ${movement.notes}` : ""}</span></div><b>{movement.quantity}</b></div>)}</div>
      </section>

      <section className="panel detail-action-panel"><div className="panel-heading"><div><h2>Delivery</h2><p>Delivery is optional and is billed separately from service charges.</p></div><Truck size={18} /></div>
        {!job.delivery_required ? <div className="empty-state compact-empty"><strong>Delivery not required</strong><span>This customer will arrange collection or delivery independently.</span></div> : <form className="detail-form" onSubmit={saveDelivery}><div className="form-two-col"><div><label className="field-label" htmlFor="catering-delivery-status">Delivery status *</label><select id="catering-delivery-status" className="text-input" value={deliveryStatus} onChange={(event) => setDeliveryStatus(event.target.value)}>{DELIVERY_STATUSES.map((status) => <option value={status} key={status}>{titleCase(status)}</option>)}</select></div><div><label className="field-label" htmlFor="catering-delivery-contact">Contact name</label><input className="text-input" id="catering-delivery-contact" value={deliveryContact} onChange={(event) => setDeliveryContact(event.target.value)} /></div><div><label className="field-label" htmlFor="catering-delivery-phone">Contact phone</label><input className="text-input" id="catering-delivery-phone" value={deliveryPhone} onChange={(event) => setDeliveryPhone(event.target.value)} /></div><div className="field-full"><label className="field-label" htmlFor="catering-delivery-address">Delivery address</label><textarea className="text-input text-area" id="catering-delivery-address" rows={2} value={deliveryAddress} onChange={(event) => setDeliveryAddress(event.target.value)} /></div><div className="field-full"><label className="field-label" htmlFor="catering-delivery-notes">Delivery notes</label><input className="text-input" id="catering-delivery-notes" value={deliveryNotes} onChange={(event) => setDeliveryNotes(event.target.value)} /></div></div><div className="detail-form-footer"><span>Delivery fee: <strong>{money(job.delivery_fee)}</strong></span><button className="button button-primary" type="submit" disabled={!!busy}>{busy === "delivery" ? "Saving…" : "Update delivery"}</button></div></form>}
      </section>

      <section className="panel detail-action-panel"><div className="panel-heading"><div><h2>Job expenses</h2><p>Record supplies, labour, transport and other costs to estimate the job margin.</p></div><Banknote size={18} /></div>
        <form className="detail-form" onSubmit={submitExpense}><div className="form-two-col"><div><label className="field-label" htmlFor="job-expense-category">Category *</label><select id="job-expense-category" className="text-input" value={expenseCategory} onChange={(event) => setExpenseCategory(event.target.value)}>{EXPENSE_CATEGORIES.map((category) => <option key={category} value={category}>{titleCase(category)}</option>)}</select></div><div><label className="field-label" htmlFor="job-expense-amount">Amount (NGN) *</label><input id="job-expense-amount" className="text-input" type="number" min="0.01" step="0.01" value={expenseAmount} onChange={(event) => setExpenseAmount(event.target.value)} required /></div><div className="field-full"><label className="field-label" htmlFor="job-expense-description">Description *</label><input id="job-expense-description" className="text-input" value={expenseDescription} onChange={(event) => setExpenseDescription(event.target.value)} required placeholder="e.g. food ingredients, hired server, fuel" /></div><div><label className="field-label" htmlFor="job-expense-method">Paid using *</label><select id="job-expense-method" className="text-input" value={expenseMethod} onChange={(event) => setExpenseMethod(event.target.value as "cash" | "bank")}><option value="cash">Cash</option><option value="bank">Bank transfer</option></select></div>{expenseMethod === "bank" && <div><label className="field-label" htmlFor="job-expense-bank">Bank account *</label><select id="job-expense-bank" className="text-input" value={expenseBank} onChange={(event) => setExpenseBank(event.target.value)} required><option value="">Select bank account</option>{bankAccounts.map((account) => <option key={account.id} value={account.id}>{account.label} · {account.bank_name}</option>)}</select></div>}<div><label className="field-label" htmlFor="job-expense-reference">Reference</label><input id="job-expense-reference" className="text-input" value={expenseReference} onChange={(event) => setExpenseReference(event.target.value)} /></div><div><label className="field-label" htmlFor="job-expense-notes">Notes</label><input id="job-expense-notes" className="text-input" value={expenseNotes} onChange={(event) => setExpenseNotes(event.target.value)} /></div></div><div className="detail-form-footer"><span>Total recorded costs: <strong>{money(expenseTotal)}</strong></span><button className="button button-primary" type="submit" disabled={!!busy}>{busy === "expense" ? "Saving…" : "Record expense"}</button></div></form>
        <div className="detail-history"><h3>Expense history</h3>{!expenses.length ? <p className="muted-inline">No expenses recorded for this job.</p> : <div className="table-scroll"><table className="data-table"><thead><tr><th>Expense</th><th>Paid using</th><th className="align-right">Amount</th></tr></thead><tbody>{expenses.map((expense) => <tr key={expense.id}><td><div className="table-primary">{expense.description}</div><div className="table-secondary">{titleCase(expense.category)} · {dateLabel(expense.expense_date)}</div></td><td>{expense.method === "bank" ? expense.bank_account_label || "Bank transfer" : "Cash"}</td><td className="align-right amount-cell">{money(expense.amount)}</td></tr>)}</tbody></table></div>}</div>
      </section>
    </div>
  </div>;
}
