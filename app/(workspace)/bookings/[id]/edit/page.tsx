"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { ArrowLeft, CalendarDays, CircleAlert, Plus, Save, Trash2 } from "lucide-react";
import { api, apiList, ApiError } from "@/lib/api";
import { money, titleCase } from "@/lib/format";
import type { Booking, CatalogueItem, Customer } from "@/lib/types";

type EditLine = {
  key: string;
  itemId: string;
  quantity: string;
  unitPrice: string;
  discountAmount: string;
  notes: string;
};

function dateOnly(value?: string | null) {
  if (!value) return "";
  // Model DateFields arrive as YYYY-MM-DD; booking timestamps are converted to the browser's local date.
  if (value.includes("T")) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      const year = parsed.getFullYear();
      const month = String(parsed.getMonth() + 1).padStart(2, "0");
      const day = String(parsed.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
  }
  return value.slice(0, 10);
}
function n(value: string) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
function makeLine(line?: Booking["items"][number]): EditLine {
  return {
    key: line ? `existing-${line.id}` : `new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    itemId: line ? String(line.item_id) : "",
    quantity: line ? String(line.quantity) : "1",
    unitPrice: line ? String(line.unit_price) : "",
    discountAmount: line ? String(line.discount_amount || "0") : "0",
    notes: line?.notes || "",
  };
}

export default function EditBookingPage() {
  const params = useParams<{ id: string }>();
  const bookingId = params.id;
  const router = useRouter();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [items, setItems] = useState<CatalogueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [recordDate, setRecordDate] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [dispatchDate, setDispatchDate] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [rows, setRows] = useState<EditLine[]>([]);
  const [orderDiscount, setOrderDiscount] = useState("0");
  const [discountReason, setDiscountReason] = useState("");
  const [additionalCharges, setAdditionalCharges] = useState("0");
  const [deliveryEnabled, setDeliveryEnabled] = useState(false);
  const [deliveryFee, setDeliveryFee] = useState("0");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryContactName, setDeliveryContactName] = useState("");
  const [deliveryContactPhone, setDeliveryContactPhone] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [notes, setNotes] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [record, customerRows, itemRows] = await Promise.all([
        api<Booking>(`bookings/${bookingId}/`),
        apiList<Customer>("customers/"),
        apiList<CatalogueItem>("items/"),
      ]);
      const isEditable = record.status === "draft" || record.status === "historical" || record.is_legacy_import;
      if (!isEditable) {
        setBooking(record);
        setError("This booking cannot be commercially edited because it has an operational status. Use its payment, delivery, dispatch, or return workflows instead.");
        return;
      }
      setBooking(record);
      setCustomers(customerRows);
      setItems(itemRows);
      setCustomerId(String(record.customer));
      const customer = customerRows.find((candidate) => candidate.id === record.customer);
      setCustomerSearch(customer ? customer.name : record.customer_name);
      setRecordDate(dateOnly(record.booking_date));
      setEventDate(dateOnly(record.event_date));
      setDispatchDate(dateOnly(record.scheduled_dispatch_date));
      setReturnDate(dateOnly(record.expected_return_date));
      setRows((record.items || []).map((line) => makeLine(line)));
      setOrderDiscount(String(record.discount_amount || "0"));
      setDiscountReason(record.discount_reason || "");
      setAdditionalCharges(String(record.additional_charges || "0"));
      setDeliveryEnabled(Boolean(record.delivery_required));
      setDeliveryFee(String(record.delivery_fee || "0"));
      setDeliveryAddress(record.delivery_address || "");
      setDeliveryContactName(record.delivery_contact_name || "");
      setDeliveryContactPhone(record.delivery_contact_phone || "");
      setDeliveryNotes(record.delivery_notes || "");
      setNotes(record.notes || "");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load this booking and its catalogue.");
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => { void load(); }, [load]);

  const isHistorical = !!booking && (booking.status === "historical" || booking.is_legacy_import);
  const filteredCustomers = useMemo(() => {
    const query = customerSearch.trim().toLowerCase();
    if (!query) return customers;
    return customers.filter((customer) => [customer.name, customer.phone, customer.email, customer.address]
      .some((value) => value?.toLowerCase().includes(query)));
  }, [customers, customerSearch]);

  const lineSummaries = useMemo(() => rows.map((row) => {
    const item = items.find((candidate) => String(candidate.id) === row.itemId);
    const quantity = Math.max(0, Math.trunc(n(row.quantity)));
    const unitPrice = Math.max(0, n(row.unitPrice));
    const subtotal = quantity * unitPrice;
    const discount = Math.min(subtotal, Math.max(0, n(row.discountAmount)));
    return { ...row, item, quantity, unitPrice, subtotal, discount, total: subtotal - discount };
  }), [rows, items]);
  const subtotal = lineSummaries.reduce((sum, row) => sum + row.subtotal, 0);
  const lineDiscountTotal = lineSummaries.reduce((sum, row) => sum + row.discount, 0);
  const total = Math.max(0, subtotal - lineDiscountTotal - Math.max(0, n(orderDiscount)))
    + Math.max(0, n(additionalCharges)) + (deliveryEnabled ? Math.max(0, n(deliveryFee)) : 0);

  function updateLine(key: string, patch: Partial<EditLine>) {
    setRows((current) => current.map((row) => row.key === key ? { ...row, ...patch } : row));
  }
  function addLine() { setRows((current) => [...current, makeLine()]); }
  function selectItem(key: string, itemId: string) {
    const chosen = items.find((item) => String(item.id) === itemId);
    updateLine(key, { itemId, unitPrice: chosen?.default_rental_price || "0", discountAmount: "0" });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    if (!customerId || !customers.some((customer) => String(customer.id) === customerId)) {
      setError("Select a registered customer before saving."); return;
    }
    if (!dispatchDate || !returnDate || returnDate < dispatchDate) {
      setError("Choose valid dispatch and return dates. The return date cannot be before dispatch."); return;
    }
    if (rows.some((row) => !row.itemId)) {
      setError("Choose a catalogue item for every item row, or remove any blank rows."); return;
    }
    const selected = lineSummaries.filter((row) => row.item && row.itemId && row.quantity > 0);
    const duplicateIds = selected.map((row) => row.itemId).filter((id, index, all) => all.indexOf(id) !== index);
    if (duplicateIds.length) { setError("Each catalogue item can only appear once. Combine quantities for duplicate items."); return; }
    if (rows.some((row) => row.itemId && (!Number.isInteger(n(row.quantity)) || n(row.quantity) < 1))) {
      setError("Item quantities must be whole numbers greater than zero."); return;
    }
    if (rows.some((row) => row.itemId && n(row.discountAmount) > n(row.quantity) * n(row.unitPrice))) {
      setError("A line discount cannot exceed that line's subtotal."); return;
    }
    if (n(orderDiscount) > subtotal - lineDiscountTotal) {
      setError("The booking-level discount cannot exceed the remaining item subtotal after line discounts."); return;
    }
    if (!deliveryEnabled && n(deliveryFee) > 0) {
      setError("Enable delivery or set the delivery fee to zero."); return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        customer_id: Number(customerId),
        event_date: eventDate || null,
        scheduled_dispatch_date: dispatchDate,
        expected_return_date: returnDate,
        items: selected.map((row) => ({
          item_id: Number(row.itemId), quantity: row.quantity,
          unit_price: row.unitPrice.toString(), discount_amount: row.discountAmount || "0",
          notes: row.notes,
        })),
        discount_amount: Math.max(0, n(orderDiscount)).toFixed(2),
        discount_reason: discountReason.trim(),
        additional_charges: Math.max(0, n(additionalCharges)).toFixed(2),
        delivery_required: deliveryEnabled,
        delivery_fee: (deliveryEnabled ? Math.max(0, n(deliveryFee)) : 0).toFixed(2),
        delivery_address: deliveryAddress.trim(),
        delivery_contact_name: deliveryContactName.trim(),
        delivery_contact_phone: deliveryContactPhone.trim(),
        delivery_notes: deliveryNotes.trim(),
        notes: notes.trim(),
      };
      if (isHistorical && recordDate) payload.booking_date = recordDate;
      await api<Booking>(`bookings/${bookingId}/`, { method: "PATCH", body: JSON.stringify(payload) });
      router.push(`/bookings/${bookingId}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save the booking changes.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="page-stack"><div className="loading-card"><div className="loader-line" /><span>Loading booking editor…</span></div></div>;
  if (!booking) return <div className="page-stack"><Link href="/bookings" className="back-link"><ArrowLeft size={15} /> Back to bookings</Link><div className="form-alert page-alert">{error || "Booking not found."}</div></div>;
  if (!(booking.status === "draft" || booking.status === "historical" || booking.is_legacy_import)) {
    return <div className="page-stack"><Link href={`/bookings/${bookingId}`} className="back-link"><ArrowLeft size={15} /> Back to booking</Link><div className="form-alert page-alert"><CircleAlert size={17} />{error}</div></div>;
  }

  return <div className="page-stack">
    <section className="page-heading"><Link href={`/bookings/${bookingId}`} className="back-link"><ArrowLeft size={15} /> Back to booking</Link><div className="eyebrow"><span className="eyebrow-line" /> BOOKING CORRECTION</div><h1>Edit {booking.booking_number}</h1><p>Correct historical dates, catalogue lines, agreed prices, discounts and delivery without rewriting historical payment receipts or stock movements.</p></section>
    {error && <div className="form-alert page-alert"><CircleAlert size={17} />{error}</div>}
    {isHistorical && <div className="detail-inline-info"><CalendarDays size={16} /><div><strong>Historical record mode</strong><span>This editor changes the commercial record only. It does not create or reverse payments, dispatches, returns, expenses or inventory movements.</span></div></div>}

    <form className="page-stack" onSubmit={submit}>
      <section className="panel form-section">
        <div className="form-section-heading"><div className="section-number">01</div><div><h2>Customer and dates</h2><p>Correct the customer and dates recorded against this booking.</p></div></div>
        <label className="field-label" htmlFor="customer-search">Find customer</label>
        <input id="customer-search" className="text-input" value={customerSearch} onChange={(event) => { setCustomerSearch(event.target.value); setCustomerId(""); }} placeholder="Search name, phone, email or address" />
        <label className="field-label" htmlFor="customer-choice">Select customer *</label>
        <select id="customer-choice" className="text-input" value={customerId} onChange={(event) => { setCustomerId(event.target.value); const chosen = customers.find((customer) => String(customer.id) === event.target.value); if (chosen) setCustomerSearch(chosen.name); }} required>
          <option value="">Select a customer</option>{filteredCustomers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}{customer.phone ? ` · ${customer.phone}` : ""}</option>)}
        </select>
        <div className="form-two-col">
          {isHistorical && <div><label className="field-label" htmlFor="record-date">Booking record date</label><input id="record-date" className="text-input" type="date" value={recordDate} onChange={(event) => setRecordDate(event.target.value)} /></div>}
          <div><label className="field-label" htmlFor="event-date">Event date</label><input id="event-date" className="text-input" type="date" value={eventDate} onChange={(event) => setEventDate(event.target.value)} /></div>
          <div><label className="field-label" htmlFor="dispatch-date">Dispatch / collection date *</label><input id="dispatch-date" className="text-input" type="date" value={dispatchDate} onChange={(event) => setDispatchDate(event.target.value)} required /></div>
          <div><label className="field-label" htmlFor="return-date">Expected return date *</label><input id="return-date" className="text-input" type="date" value={returnDate} onChange={(event) => setReturnDate(event.target.value)} required /></div>
        </div>
      </section>

      <section className="panel form-section">
        <div className="form-section-heading"><div className="section-number">02</div><div><h2>Catalogue items and agreed prices</h2><p>Add, remove or change items and correct the unit price/discount used on this booking.</p></div><button className="button button-secondary button-small" type="button" onClick={addLine}><Plus size={15} /> Add item</button></div>
        {rows.length === 0 ? <div className="empty-state compact-empty"><strong>No catalogue items on this booking</strong><span>This is allowed for historical booking-only entries. Add an item if the original booking should include one.</span><button className="button button-secondary button-small" type="button" onClick={addLine}><Plus size={15} /> Add item</button></div> : <div className="edit-booking-lines">
          {rows.map((row, index) => {
            const chosen = items.find((item) => String(item.id) === row.itemId);
            const lineSubtotal = Math.max(0, n(row.quantity) * n(row.unitPrice));
            const lineTotal = Math.max(0, lineSubtotal - Math.min(lineSubtotal, Math.max(0, n(row.discountAmount))));
            return <div className="edit-booking-line" key={row.key}>
              <div className="edit-line-heading"><strong>Item {index + 1}</strong><button type="button" className="icon-button danger-icon-button" aria-label={`Remove item ${index + 1}`} onClick={() => setRows((current) => current.filter((candidate) => candidate.key !== row.key))}><Trash2 size={16} /></button></div>
              <div className="form-two-col">
                <div className="field-full"><label className="field-label" htmlFor={`item-${row.key}`}>Catalogue item *</label><select id={`item-${row.key}`} className="text-input" value={row.itemId} onChange={(event) => selectItem(row.key, event.target.value)}><option value="">Select catalogue item</option>{items.filter((item) => item.is_active || String(item.id) === row.itemId).map((item) => <option key={item.id} value={item.id}>{item.name}{!item.is_active ? " (archived)" : ""} · {titleCase(item.quantity_unit)}{item.is_active ? "" : " — existing line only"}</option>)}</select></div>
                <div><label className="field-label" htmlFor={`qty-${row.key}`}>Quantity{chosen ? ` (${titleCase(chosen.quantity_unit)})` : ""} *</label><input id={`qty-${row.key}`} className="text-input" type="number" min="1" step="1" value={row.quantity} onChange={(event) => updateLine(row.key, { quantity: event.target.value })} disabled={!row.itemId} /></div>
                <div><label className="field-label" htmlFor={`price-${row.key}`}>Agreed unit price (₦{chosen ? ` / ${titleCase(chosen.quantity_unit)}` : ""}) *</label><input id={`price-${row.key}`} className="text-input" type="number" min="0" step="0.01" value={row.unitPrice} onChange={(event) => updateLine(row.key, { unitPrice: event.target.value })} disabled={!row.itemId} /></div>
                <div><label className="field-label" htmlFor={`line-discount-${row.key}`}>Line discount (₦)</label><input id={`line-discount-${row.key}`} className="text-input" type="number" min="0" step="0.01" value={row.discountAmount} onChange={(event) => updateLine(row.key, { discountAmount: event.target.value })} disabled={!row.itemId} /></div>
                <div><label className="field-label" htmlFor={`line-notes-${row.key}`}>Line notes</label><input id={`line-notes-${row.key}`} className="text-input" value={row.notes} onChange={(event) => updateLine(row.key, { notes: event.target.value })} /></div>
              </div>
              <div className="edit-line-totals"><span>{chosen?.name || "No item selected"}</span><span>Subtotal <strong>{money(lineSubtotal)}</strong></span><span>Line total <strong>{money(lineTotal)}</strong></span></div>
            </div>;
          })}
        </div>}
      </section>

      <section className="panel form-section">
        <div className="form-section-heading"><div className="section-number">03</div><div><h2>Discounts and charges</h2><p>These amounts change the booking's commercial total, not recorded receipts.</p></div></div>
        <div className="form-two-col">
          <div><label className="field-label" htmlFor="order-discount">Booking-level discount (₦)</label><input id="order-discount" className="text-input" type="number" min="0" step="0.01" value={orderDiscount} onChange={(event) => setOrderDiscount(event.target.value)} /></div>
          <div><label className="field-label" htmlFor="additional-charges">Additional agreed charges (₦)</label><input id="additional-charges" className="text-input" type="number" min="0" step="0.01" value={additionalCharges} onChange={(event) => setAdditionalCharges(event.target.value)} /></div>
          <div className="field-full"><label className="field-label" htmlFor="discount-reason">Discount reason</label><input id="discount-reason" className="text-input" value={discountReason} onChange={(event) => setDiscountReason(event.target.value)} placeholder="Optional explanation" /></div>
        </div>
      </section>

      <section className="panel form-section">
        <div className="form-section-heading"><div className="section-number">04</div><div><h2>Delivery</h2><p>Correct whether delivery was required and its recorded fee.</p></div></div>
        <label className="checkbox-field"><input type="checkbox" checked={deliveryEnabled} onChange={(event) => setDeliveryEnabled(event.target.checked)} /> Delivery was required for this booking</label>
        {deliveryEnabled && <div className="form-two-col">
          <div><label className="field-label" htmlFor="delivery-fee">Delivery fee charged (₦)</label><input id="delivery-fee" className="text-input" type="number" min="0" step="0.01" value={deliveryFee} onChange={(event) => setDeliveryFee(event.target.value)} /></div>
          <div><label className="field-label" htmlFor="delivery-contact-name">Delivery contact</label><input id="delivery-contact-name" className="text-input" value={deliveryContactName} onChange={(event) => setDeliveryContactName(event.target.value)} /></div>
          <div className="field-full"><label className="field-label" htmlFor="delivery-address">Delivery address</label><input id="delivery-address" className="text-input" value={deliveryAddress} onChange={(event) => setDeliveryAddress(event.target.value)} /></div>
          <div><label className="field-label" htmlFor="delivery-contact-phone">Delivery phone</label><input id="delivery-contact-phone" className="text-input" value={deliveryContactPhone} onChange={(event) => setDeliveryContactPhone(event.target.value)} /></div>
          <div><label className="field-label" htmlFor="delivery-notes">Delivery notes</label><input id="delivery-notes" className="text-input" value={deliveryNotes} onChange={(event) => setDeliveryNotes(event.target.value)} /></div>
        </div>}
      </section>

      <section className="panel form-section"><div className="form-section-heading"><div className="section-number">05</div><div><h2>Internal notes</h2><p>Notes retained with this booking.</p></div></div><label className="field-label" htmlFor="booking-notes">Notes</label><textarea id="booking-notes" className="text-input text-area" rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} /></section>

      <section className="panel booking-summary-card"><div className="summary-card-heading"><div><span className="section-kicker">UPDATED BOOKING TOTAL</span><h2>Review before saving</h2></div><div className="summary-icon"><CalendarDays size={19} /></div></div><div className="summary-lines"><div><span>Item subtotal</span><strong>{money(subtotal)}</strong></div><div><span>Item discounts</span><strong>−{money(lineDiscountTotal)}</strong></div><div><span>Booking discount</span><strong>−{money(Math.max(0, n(orderDiscount)))}</strong></div><div><span>Additional charges</span><strong>{money(Math.max(0, n(additionalCharges)))}</strong></div><div><span>Delivery fee</span><strong>{money(deliveryEnabled ? Math.max(0, n(deliveryFee)) : 0)}</strong></div><div className="summary-total"><span>New commercial total</span><strong>{money(total)}</strong></div></div><p className="summary-footnote">Saving changes the booking total. Existing receipts, expenses, security deposits and inventory movements are not changed.</p><div className="detail-form-footer"><Link href={`/bookings/${bookingId}`} className="button button-secondary">Cancel</Link><button className="button button-primary" type="submit" disabled={saving}><Save size={16} />{saving ? "Saving changes…" : "Save booking changes"}</button></div></section>
    </form>
  </div>;
}
