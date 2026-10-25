"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarDays, Check, ChevronDown, CircleAlert, PackagePlus, Plus, ShieldCheck, Truck, Trash2, Wallet } from "lucide-react";
import { api, apiList, ApiError } from "@/lib/api";
import { money } from "@/lib/format";
import type { CatalogueItem, Customer, Booking, BankAccount } from "@/lib/types";
import { CustomerPicker } from "@/components/customer-picker";

type BookingRow = { key: string; itemId: string; quantity: string; unitPrice: string };
function localDate(daysFromToday = 0) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function NewBookingPage() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [items, setItems] = useState<CatalogueItem[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [createdBooking, setCreatedBooking] = useState<Booking | null>(null);
  const [customerId, setCustomerId] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [dispatchDate, setDispatchDate] = useState(localDate(1));
  const [returnDate, setReturnDate] = useState(localDate(2));
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<BookingRow[]>([{ key: "row-1", itemId: "", quantity: "1", unitPrice: "" }]);
  const [discountEnabled, setDiscountEnabled] = useState(false);
  const [discount, setDiscount] = useState("");
  const [discountReason, setDiscountReason] = useState("");
  const [deliveryEnabled, setDeliveryEnabled] = useState(false);
  const [deliveryFee, setDeliveryFee] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryContactName, setDeliveryContactName] = useState("");
  const [deliveryContactPhone, setDeliveryContactPhone] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [depositEnabled, setDepositEnabled] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [recordInitialPayment, setRecordInitialPayment] = useState(false);
  const [initialPaymentAmount, setInitialPaymentAmount] = useState("");
  const [initialPaymentMethod, setInitialPaymentMethod] = useState<"cash" | "bank">("cash");
  const [initialPaymentBank, setInitialPaymentBank] = useState("");
  const [bookingExpenseEnabled, setBookingExpenseEnabled] = useState(false);
  const [bookingExpenseAmount, setBookingExpenseAmount] = useState("");
  const [bookingExpenseDescription, setBookingExpenseDescription] = useState("");
  const [bookingExpenseCategory, setBookingExpenseCategory] = useState("other");
  const [bookingExpenseMethod, setBookingExpenseMethod] = useState<"cash" | "bank">("cash");
  const [bookingExpenseBank, setBookingExpenseBank] = useState("");

  useEffect(() => {
    let alive = true;
    Promise.all([apiList<Customer>("customers/"), apiList<CatalogueItem>("items/"), apiList<BankAccount>("bank-accounts/")])
      .then(([customersData, itemData, bankRows]) => { if (alive) { setCustomers(customersData); setItems(itemData.filter((item) => item.is_active)); setBankAccounts(bankRows.filter((row) => row.is_active)); } })
      .catch((err) => { if (alive) setError(err instanceof ApiError ? err.message : "Could not load the customer and item lists."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const chosenLines = useMemo(() => rows.map((row) => {
    const item = items.find((entry) => String(entry.id) === row.itemId);
    const quantity = Math.max(0, Number(row.quantity) || 0);
    const unitPrice = Math.max(0, Number(row.unitPrice) || 0);
    return { ...row, item, quantity, unitPrice, lineTotal: quantity * unitPrice };
  }).filter((row) => row.item && row.quantity > 0), [rows, items]);
  const subtotal = chosenLines.reduce((sum, row) => sum + row.lineTotal, 0);
  const appliedDiscount = discountEnabled ? Math.min(Math.max(0, Number(discount) || 0), subtotal) : 0;
  const deliveryAmount = deliveryEnabled ? Math.max(0, Number(deliveryFee) || 0) : 0;
  const total = Math.max(0, subtotal - appliedDiscount) + deliveryAmount;
  const isHistoricalEntry = Boolean(returnDate) && returnDate < localDate();

  function updateRow(key: string, patch: Partial<BookingRow>) {
    setRows((current) => current.map((row) => row.key === key ? { ...row, ...patch } : row));
  }
  function addRow() { setRows((current) => [...current, { key: `row-${Date.now()}-${current.length}`, itemId: "", quantity: "1", unitPrice: "" }]); }
  function selectItem(key: string, itemId: string) {
    const item = items.find((entry) => String(entry.id) === itemId);
    updateRow(key, { itemId, unitPrice: item?.default_rental_price ?? "" });
  }

  async function saveBooking(shouldConfirm: boolean) {
    if (!formRef.current?.reportValidity()) return;
    setError(""); setNotice(""); setCreatedBooking(null);
    if (!customers.some((customer) => String(customer.id) === customerId)) { setError("Select a customer before saving this booking."); return; }
    if (chosenLines.length === 0) { setError("Add at least one catalogue item and quantity."); return; }
    if (returnDate < dispatchDate) { setError("The expected return date cannot be before the dispatch date."); return; }
    if (discountEnabled && Number(discount) > subtotal) { setError("Discount cannot exceed the rental item subtotal."); return; }
    if (!deliveryEnabled && Number(deliveryFee) > 0) { setError("Enable delivery before adding a delivery fee."); return; }
    if (depositEnabled && !(Number(depositAmount) > 0)) { setError("Enter a refundable deposit amount, or turn off the optional deposit."); return; }
    if (recordInitialPayment && !(Number(initialPaymentAmount) > 0)) { setError("Enter the payment amount or turn off Record a payment now."); return; }
    if (recordInitialPayment && Number(initialPaymentAmount) > Math.max(0, total)) { setError("The initial payment cannot exceed the booking total. Record an approved additional charge first if needed."); return; }
    if (recordInitialPayment && initialPaymentMethod === "bank" && !initialPaymentBank) { setError("Choose which bank account received the payment."); return; }
    if (bookingExpenseEnabled && !(Number(bookingExpenseAmount) > 0)) { setError("Enter an expense amount or turn off the optional booking expense."); return; }
    if (bookingExpenseEnabled && bookingExpenseMethod === "bank" && !bookingExpenseBank) { setError("Choose the bank account used to pay this expense."); return; }

    setSaving(true);
    let booking: Booking;
    try {
      const payload: Record<string, unknown> = {
        customer_id: Number(customerId),
        event_date: eventDate || null,
        scheduled_dispatch_date: dispatchDate,
        expected_return_date: returnDate,
        items: chosenLines.map((row) => ({ item_id: row.item!.id, quantity: row.quantity, unit_price: row.unitPrice.toFixed(2) })),
        delivery_required: deliveryEnabled,
        notes: notes.trim(),
      };
      if (discountEnabled && appliedDiscount > 0) {
        payload.discount_amount = appliedDiscount.toFixed(2);
        if (discountReason.trim()) payload.discount_reason = discountReason.trim();
      }
      if (recordInitialPayment) {
        payload.initial_payment_amount = Number(initialPaymentAmount).toFixed(2);
        payload.initial_payment_method = initialPaymentMethod;
        if (initialPaymentMethod === "bank") payload.initial_bank_account_id = Number(initialPaymentBank);
      }
      if (bookingExpenseEnabled && Number(bookingExpenseAmount) > 0) {
        payload.booking_expense_amount = Number(bookingExpenseAmount).toFixed(2);
        payload.booking_expense_description = bookingExpenseDescription.trim() || "Booking-related expense";
        payload.booking_expense_category = bookingExpenseCategory;
        payload.booking_expense_method = bookingExpenseMethod;
        if (bookingExpenseMethod === "bank") payload.booking_expense_bank_account_id = Number(bookingExpenseBank);
      }
      if (deliveryEnabled) {
        payload.delivery_fee = deliveryAmount.toFixed(2);
        payload.delivery_address = deliveryAddress.trim();
        payload.delivery_contact_name = deliveryContactName.trim();
        payload.delivery_contact_phone = deliveryContactPhone.trim();
        payload.delivery_notes = deliveryNotes.trim();
      }
      booking = await api<Booking>("bookings/", { method: "POST", body: JSON.stringify(payload) });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create this booking.");
      setSaving(false);
      return;
    }

    const followUpIssues: string[] = [];
    if (depositEnabled) {
      try {
        await api(`bookings/${booking.id}/security-deposit/`, { method: "POST", body: JSON.stringify({ required_amount: Number(depositAmount).toFixed(2), notes: "Refundable security deposit" }) });
      } catch (err) {
        followUpIssues.push(`Booking saved as draft, but the deposit was not configured: ${err instanceof ApiError ? err.message : "unknown error"}`);
      }
    }

    if (shouldConfirm && followUpIssues.length === 0) {
      try {
        booking = await api<Booking>(`bookings/${booking.id}/confirm/`, { method: "POST", body: JSON.stringify({}) });
      } catch (err) {
        followUpIssues.push(`Booking saved as a draft, but confirmation failed: ${err instanceof ApiError ? err.message : "unknown error"}`);
      }
    } else if (!shouldConfirm && followUpIssues.length === 0) {
      followUpIssues.push("Booking saved as a draft. Confirm it when you are ready to reserve the stock.");
    }

    setCreatedBooking(booking);
    if (followUpIssues.length) {
      setNotice(followUpIssues.join(" "));
      setSaving(false);
      return;
    }
    router.push(`/bookings?created=${encodeURIComponent(booking.booking_number)}`);
    router.refresh();
    setSaving(false);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void saveBooking(false);
  }

  return <div className="page-stack">
    <section className="page-heading"><Link href="/bookings" className="back-link"><ArrowLeft size={16} /> Back to bookings</Link><div className="eyebrow"><span className="eyebrow-line" /> RENTAL WORKFLOW</div><h1>Create a booking</h1><p>Choose registered catalogue items, agree the rental details and keep every optional charge clearly separated.</p></section>
    {error && <div className="form-alert page-alert"><CircleAlert size={17} /> {error}</div>}
    {notice && <div className="form-success page-alert"><ShieldCheck size={17} /><div><strong>{createdBooking ? `Booking ${createdBooking.booking_number} was saved.` : "Saved with a note"}</strong><span>{notice}</span>{createdBooking && <div className="notice-actions"><Link href="/bookings" className="text-link">Open booking register →</Link></div>}</div></div>}
    {loading ? <div className="loading-card"><div className="loader-line" /><span>Loading customers and catalogue items…</span></div> : items.length === 0 ? <div className="empty-callout large-callout"><CircleAlert size={20} /><div><strong>Add catalogue items first</strong><span>Bookings must use the registered item catalogue so inventory and revenue can be tracked accurately. You can create customers directly on this page.</span></div><Link className="button button-primary button-small" href="/inventory">Open inventory</Link></div> : <form id="booking-form" className="booking-form-layout" ref={formRef} onSubmit={handleSubmit}>
      <div className="booking-form-main">
        <section className="panel form-section"><div className="form-section-heading"><div className="section-number">01</div><div><h2>Customer and dates</h2><p>When the rental goes out and when it should come back.</p></div></div><div className="form-two-col"><CustomerPicker idPrefix="booking-customer" customers={customers} value={customerId} onChange={setCustomerId} onCreated={(customer) => setCustomers((current) => [...current.filter((row) => row.id !== customer.id), customer].sort((a, b) => a.name.localeCompare(b.name)))} /><div><label htmlFor="event-date" className="field-label">Event date <span className="optional-label">Optional</span></label><input id="event-date" type="date" className="text-input" value={eventDate} onChange={(e) => setEventDate(e.target.value)} /></div><div><label htmlFor="dispatch-date" className="field-label">Dispatch / collection date *</label><input id="dispatch-date" type="date" className="text-input" value={dispatchDate} onChange={(e) => setDispatchDate(e.target.value)} required /></div><div><label htmlFor="return-date" className="field-label">Expected return date *</label><input id="return-date" type="date" className="text-input" value={returnDate} min={dispatchDate} onChange={(e) => setReturnDate(e.target.value)} required /></div></div></section>

        <section className="panel form-section"><div className="form-section-heading"><div className="section-number">02</div><div><h2>Rental items</h2><p>Items are selected from the catalogue. Prices are prefilled from their standard rates.</p></div></div><div className="rental-lines">{rows.map((row, index) => { const selected = items.find((item) => String(item.id) === row.itemId); const lineTotal = Math.max(0, Number(row.quantity) || 0) * Math.max(0, Number(row.unitPrice) || 0); return <div className="rental-line-card" key={row.key}><div className="rental-line-top"><span className="line-number">ITEM {String(index + 1).padStart(2, "0")}</span>{rows.length > 1 && <button type="button" className="line-remove" onClick={() => setRows((existing) => existing.filter((item) => item.key !== row.key))}><Trash2 size={14} /> Remove</button>}</div><div className="rental-line-grid"><div className="field-full"><label className="field-label" htmlFor={`item-select-${row.key}`}>Catalogue item *</label><select id={`item-select-${row.key}`} className="text-input" value={row.itemId} onChange={(e) => selectItem(row.key, e.target.value)} required><option value="">Choose an item</option>{items.map((item) => <option key={item.id} value={item.id}>{item.name} · {money(item.default_rental_price)} / {item.quantity_unit}</option>)}</select>{selected && <span className="field-hint">Category: {selected.category_name || "Uncategorised"}. Quantity and price are measured per {selected.quantity_unit}.</span>}</div><div><label className="field-label" htmlFor={`qty-${row.key}`}>Quantity ({selected?.quantity_unit || "unit"}) *</label><input id={`qty-${row.key}`} className="text-input" type="number" min="1" step="1" value={row.quantity} onChange={(e) => updateRow(row.key, { quantity: e.target.value })} required /></div><div><label className="field-label" htmlFor={`price-${row.key}`}>Price per {selected?.quantity_unit || "unit"} (₦) *</label><input id={`price-${row.key}`} className="text-input" type="number" min="0" step="0.01" value={row.unitPrice} onChange={(e) => updateRow(row.key, { unitPrice: e.target.value })} required /></div></div><div className="rental-line-total"><span>Line total</span><strong>{money(lineTotal)}</strong></div></div>; })}</div><button type="button" className="add-line-button" onClick={addRow}><Plus size={16} /> Add another item</button></section>

        <section className="panel form-section"><div className="form-section-heading"><div className="section-number">03</div><div><h2>Optional services and adjustments</h2><p>Leave these off when they do not apply to this booking.</p></div></div>
          <div className={`optional-feature ${discountEnabled ? "optional-feature-open" : ""}`}><label className="optional-feature-toggle"><input type="checkbox" checked={discountEnabled} onChange={(e) => setDiscountEnabled(e.target.checked)} /><span className="fake-check"><Check size={13} /></span><span className="optional-feature-icon discount-icon">%</span><span className="optional-feature-copy"><strong>Apply a discount</strong><small>Only add this when a discount has been agreed.</small></span><span className="feature-state">{discountEnabled ? "Enabled" : "Optional"}</span></label>{discountEnabled && <div className="optional-feature-fields"><div><label className="field-label" htmlFor="discount-amount">Discount amount (₦) *</label><input className="text-input" id="discount-amount" type="number" min="0.01" step="0.01" max={subtotal} value={discount} onChange={(e) => setDiscount(e.target.value)} required /></div><div><label className="field-label" htmlFor="discount-reason">Reason <span className="optional-label">Optional</span></label><input className="text-input" id="discount-reason" value={discountReason} onChange={(e) => setDiscountReason(e.target.value)} placeholder="e.g. Returning customer" /></div></div>}</div>
          <div className={`optional-feature ${deliveryEnabled ? "optional-feature-open" : ""}`}><label className="optional-feature-toggle"><input type="checkbox" checked={deliveryEnabled} onChange={(e) => setDeliveryEnabled(e.target.checked)} /><span className="fake-check"><Check size={13} /></span><span className="optional-feature-icon delivery-icon"><Truck size={19} /></span><span className="optional-feature-copy"><strong>Arrange delivery</strong><small>Track the address and optional fee separately.</small></span><span className="feature-state">{deliveryEnabled ? "Enabled" : "Optional"}</span></label>{deliveryEnabled && <div className="optional-feature-fields"><div><label className="field-label" htmlFor="delivery-fee">Delivery fee (₦)</label><input className="text-input" id="delivery-fee" type="number" min="0" step="0.01" value={deliveryFee} onChange={(e) => setDeliveryFee(e.target.value)} /></div><div><label className="field-label" htmlFor="delivery-contact">Contact person</label><input className="text-input" id="delivery-contact" value={deliveryContactName} onChange={(e) => setDeliveryContactName(e.target.value)} placeholder="Who will receive the items?" /></div><div><label className="field-label" htmlFor="delivery-phone">Contact phone</label><input className="text-input" id="delivery-phone" value={deliveryContactPhone} onChange={(e) => setDeliveryContactPhone(e.target.value)} placeholder="Phone number" /></div><div className="field-full"><label className="field-label" htmlFor="delivery-address">Delivery address</label><textarea className="text-input text-area" id="delivery-address" rows={2} value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} placeholder="Event venue or delivery address" /></div><div className="field-full"><label className="field-label" htmlFor="delivery-notes">Delivery instructions <span className="optional-label">Optional</span></label><input className="text-input" id="delivery-notes" value={deliveryNotes} onChange={(e) => setDeliveryNotes(e.target.value)} placeholder="Gate access, delivery timing, etc." /></div></div>}</div>
          <div className={`optional-feature ${depositEnabled ? "optional-feature-open" : ""}`}><label className="optional-feature-toggle"><input type="checkbox" checked={depositEnabled} onChange={(e) => setDepositEnabled(e.target.checked)} /><span className="fake-check"><Check size={13} /></span><span className="optional-feature-icon deposit-icon"><ShieldCheck size={19} /></span><span className="optional-feature-copy"><strong>Require refundable security deposit</strong><small>Track the deposit separately from rental revenue.</small></span><span className="feature-state">{depositEnabled ? "Enabled" : "Optional"}</span></label>{depositEnabled && <div className="optional-feature-fields single-field"><div><label className="field-label" htmlFor="deposit-amount">Required deposit (₦) *</label><input className="text-input" id="deposit-amount" type="number" min="0.01" step="0.01" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} required /></div><div className="field-hint deposit-hint"><Wallet size={15} /> This records the deposit requirement. Money received is recorded separately in the payment workflow.</div></div>}</div>
          <div className={`optional-feature ${bookingExpenseEnabled ? "optional-feature-open" : ""}`}><label className="optional-feature-toggle"><input type="checkbox" checked={bookingExpenseEnabled} onChange={(e) => setBookingExpenseEnabled(e.target.checked)} /><span className="fake-check"><Check size={13} /></span><span className="optional-feature-icon delivery-icon"><Wallet size={18} /></span><span className="optional-feature-copy"><strong>Record a booking expense</strong><small>Track a cost related to this booking, separately from the customer charge.</small></span><span className="feature-state">{bookingExpenseEnabled ? "Enabled" : "Optional"}</span></label>{bookingExpenseEnabled && <div className="optional-feature-fields"><div><label className="field-label" htmlFor="booking-expense-amount">Expense amount (₦) *</label><input className="text-input" id="booking-expense-amount" type="number" min="0.01" step="0.01" value={bookingExpenseAmount} onChange={(e) => setBookingExpenseAmount(e.target.value)} required /></div><div><label className="field-label" htmlFor="booking-expense-category">Expense category</label><select className="text-input" id="booking-expense-category" value={bookingExpenseCategory} onChange={(e) => setBookingExpenseCategory(e.target.value)}><option value="delivery">Delivery / transport</option><option value="fuel">Fuel</option><option value="staff">Staff / labour</option><option value="maintenance">Maintenance / repairs</option><option value="other">Other expense</option></select></div><div className="field-full"><label className="field-label" htmlFor="booking-expense-description">What was the expense for? <span className="optional-label">Optional</span></label><input className="text-input" id="booking-expense-description" value={bookingExpenseDescription} onChange={(e) => setBookingExpenseDescription(e.target.value)} placeholder="e.g. Truck hire, loading, fuel" /></div><div><label className="field-label" htmlFor="booking-expense-method">Paid using</label><select className="text-input" id="booking-expense-method" value={bookingExpenseMethod} onChange={(e) => setBookingExpenseMethod(e.target.value as "cash" | "bank")}><option value="cash">Cash</option><option value="bank">Bank transfer</option></select></div>{bookingExpenseMethod === "bank" && <div><label className="field-label" htmlFor="booking-expense-bank">Paid from bank destination *</label><select className="text-input" id="booking-expense-bank" value={bookingExpenseBank} onChange={(e) => setBookingExpenseBank(e.target.value)} required><option value="">Choose bank destination</option>{bankAccounts.map((account) => <option key={account.id} value={account.id}>{account.label} · {account.bank_name} · {account.account_number_masked}</option>)}</select></div>}<p className="field-hint field-full">This cost is excluded from the customer's booking total and appears in Financials → Expenses.</p></div>}</div>
        </section>

        <section className="panel form-section"><div className="form-section-heading"><div className="section-number">04</div><div><h2>Initial payment <span className="optional-label">Optional</span></h2><p>You can record money received at booking creation without making payment mandatory.</p></div></div>
          <div className={`optional-feature ${recordInitialPayment ? "optional-feature-open" : ""}`}><label className="optional-feature-toggle"><input type="checkbox" checked={recordInitialPayment} onChange={(e) => setRecordInitialPayment(e.target.checked)} /><span className="fake-check"><Check size={13} /></span><span className="optional-feature-icon deposit-icon"><Wallet size={19} /></span><span className="optional-feature-copy"><strong>Record a payment now</strong><small>Cash and bank transfer are supported.</small></span><span className="feature-state">{recordInitialPayment ? "Enabled" : "Optional"}</span></label>{recordInitialPayment && <div className="optional-feature-fields"><div><label className="field-label" htmlFor="initial-payment-amount">Amount received (₦) *</label><input className="text-input" id="initial-payment-amount" type="number" min="0.01" step="0.01" max={total} value={initialPaymentAmount} onChange={(e) => setInitialPaymentAmount(e.target.value)} required /></div><div><label className="field-label" htmlFor="initial-payment-method">Payment method *</label><select className="text-input" id="initial-payment-method" value={initialPaymentMethod} onChange={(e) => setInitialPaymentMethod(e.target.value as "cash" | "bank")}><option value="cash">Cash</option><option value="bank">Bank transfer</option></select></div>{initialPaymentMethod === "bank" && <div><label className="field-label" htmlFor="initial-payment-bank">Money paid to *</label><select className="text-input" id="initial-payment-bank" value={initialPaymentBank} onChange={(e) => setInitialPaymentBank(e.target.value)} required><option value="">Choose bank destination</option>{bankAccounts.map((account) => <option key={account.id} value={account.id}>{account.label} · {account.bank_name} · {account.account_number_masked}</option>)}</select>{bankAccounts.length === 0 && <span className="field-hint">No bank destinations are configured. <Link className="text-link" href="/bank-accounts">Add bank account</Link>.</span>}</div>}</div>}</div>
        </section>

        <section className="panel form-section"><div className="form-section-heading"><div className="section-number">05</div><div><h2>Internal notes</h2><p>Anything your team should know about this booking.</p></div></div><label className="field-label" htmlFor="booking-notes">Notes <span className="optional-label">Optional</span></label><textarea id="booking-notes" className="text-input text-area" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Special handling, customer agreement, etc." /></section>
      </div>

      <aside className="booking-summary-column"><section className="panel booking-summary-card"><div className="summary-card-heading"><div><span className="section-kicker">BOOKING SUMMARY</span><h2>Estimate</h2></div><div className="summary-icon"><Wallet size={19} /></div></div><div className="summary-lines"><div><span>Rental items</span><strong>{money(subtotal)}</strong></div>{discountEnabled && appliedDiscount > 0 && <div className="summary-discount"><span>Discount</span><strong>−{money(appliedDiscount)}</strong></div>}{deliveryEnabled && <div><span>Delivery fee</span><strong>{money(deliveryAmount)}</strong></div>}<div className="summary-total"><span>Estimated total</span><strong>{money(total)}</strong></div></div><div className="summary-note"><ShieldCheck size={15} /><span>Security deposits are tracked separately and are not included in rental revenue.</span></div><div className="summary-meta"><div><CalendarDays size={15} /><span>Dispatch</span><strong>{dispatchDate || "Choose date"}</strong></div><div><CalendarDays size={15} /><span>Expected return</span><strong>{returnDate || "Choose date"}</strong></div></div><button type="submit" form="booking-form" className="button button-primary button-full" disabled={saving}>{saving ? "Saving booking…" : "Save as draft"}</button><button type="button" className="button button-secondary button-full" disabled={saving} onClick={() => { if (formRef.current?.reportValidity()) void saveBooking(true); }}>{saving ? "Please wait…" : isHistoricalEntry ? "Save as historical record" : "Save & confirm booking"}</button><p className="summary-footnote">{isHistoricalEntry ? "This rental period has ended. Saving as historical records the agreed booking details without reserving or changing current inventory." : "Confirming checks availability and reserves stock for the booking dates."}</p></section><div className="side-tip"><div className="side-tip-icon"><PackagePlus size={17} /></div><div><strong>Catalogue-first records</strong><span>Selecting registered items keeps item names consistent for inventory reports and auditing.</span></div></div></aside>
    </form>}
  </div>;
}
