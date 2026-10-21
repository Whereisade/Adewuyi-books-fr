"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AlertCircle, ChefHat, Plus, Search, ShieldCheck, Truck, X, Trash2, PackagePlus } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { dateLabel, money, titleCase } from "@/lib/format";
import { useAuth } from "@/components/app-shell";
import type { CatalogueItem, Customer } from "@/lib/types";

type ServiceLine = { key: string; description: string; quantity: string; unitLabel: string; unitPrice: string };
type MaterialLine = { key: string; itemId: string; quantity: string };
type CateringJob = {
  id: number; job_number: string; customer_name: string; status: string; event_date: string; scheduled_dispatch_date: string;
  expected_return_date: string; event_location: string; guest_count: number | null; total_amount: string; delivery_required: boolean;
  delivery_fee: string; material_allocations: Array<{ id: number; item_name_snapshot: string; quantity: number }>;
};
function localDate(days = 0) { const date = new Date(); date.setDate(date.getDate() + days); return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`; }

export default function CateringPage() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<CateringJob[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [items, setItems] = useState<CatalogueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [eventDate, setEventDate] = useState(localDate(7));
  const [dispatchDate, setDispatchDate] = useState(localDate(7));
  const [returnDate, setReturnDate] = useState(localDate(8));
  const [location, setLocation] = useState("");
  const [guestCount, setGuestCount] = useState("");
  const [notes, setNotes] = useState("");
  const [serviceLines, setServiceLines] = useState<ServiceLine[]>([{ key: "service-1", description: "Catering service", quantity: "1", unitLabel: "job", unitPrice: "" }]);
  const [materials, setMaterials] = useState<MaterialLine[]>([]);
  const [discountOn, setDiscountOn] = useState(false);
  const [discount, setDiscount] = useState("");
  const [deliveryOn, setDeliveryOn] = useState(false);
  const [deliveryFee, setDeliveryFee] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryContact, setDeliveryContact] = useState("");
  const [deliveryPhone, setDeliveryPhone] = useState("");
  const [confirmAfterCreate, setConfirmAfterCreate] = useState(false);

  async function load() {
    setLoading(true); setError("");
    try {
      const [jobRows, customerRows, itemRows] = await Promise.all([
        api<CateringJob[]>("catering/jobs/"), api<Customer[]>("customers/"), api<CatalogueItem[]>("items/"),
      ]);
      setJobs(jobRows); setCustomers(customerRows); setItems(itemRows.filter((item) => item.is_active));
    } catch (err) { setError(err instanceof ApiError ? err.message : "Could not load catering jobs."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => { const needle = search.trim().toLowerCase(); return needle ? jobs.filter((job) => [job.job_number, job.customer_name, job.event_location].some((part) => part?.toLowerCase().includes(needle))) : jobs; }, [jobs, search]);
  const serviceTotal = serviceLines.reduce((total, line) => total + Math.max(0, Number(line.quantity) || 0) * Math.max(0, Number(line.unitPrice) || 0), 0);
  const deliveryTotal = deliveryOn ? Math.max(0, Number(deliveryFee) || 0) : 0;
  const discountTotal = discountOn ? Math.min(Math.max(0, Number(discount) || 0), serviceTotal) : 0;
  const estimatedTotal = Math.max(0, serviceTotal - discountTotal) + deliveryTotal;

  function updateService(key: string, patch: Partial<ServiceLine>) { setServiceLines((rows) => rows.map((row) => row.key === key ? { ...row, ...patch } : row)); }
  function updateMaterial(key: string, patch: Partial<MaterialLine>) { setMaterials((rows) => rows.map((row) => row.key === key ? { ...row, ...patch } : row)); }

  async function createJob(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setNotice("");
    if (returnDate < dispatchDate) { setError("The expected return date cannot be before the dispatch date."); return; }
    if (discountOn && !(Number(discount) > 0)) { setError("Enter a discount amount or turn off the optional discount."); return; }
    if (discountOn && Number(discount) > serviceTotal) { setError("Discount cannot exceed the catering service subtotal."); return; }
    if (serviceLines.some((line) => !line.description.trim() || !(Number(line.quantity) > 0) || !(Number(line.unitPrice) >= 0))) { setError("Complete each service line with a description, quantity and price."); return; }
    setSaving(true);
    let job: CateringJob;
    try {
      const payload: Record<string, unknown> = {
        customer_id: Number(customerId), event_date: eventDate, scheduled_dispatch_date: dispatchDate, expected_return_date: returnDate,
        event_location: location.trim(), guest_count: guestCount ? Number(guestCount) : null,
        lines: serviceLines.map((line) => ({ description: line.description.trim(), quantity: Number(line.quantity), unit_label: line.unitLabel.trim(), unit_price: Number(line.unitPrice).toFixed(2) })),
        material_allocations: Array.from(materials.filter((line) => line.itemId && Number(line.quantity) > 0).reduce((total, line) => {
          const itemId = Number(line.itemId);
          total.set(itemId, (total.get(itemId) ?? 0) + Number(line.quantity));
          return total;
        }, new Map<number, number>()).entries()).map(([item_id, quantity]) => ({ item_id, quantity })),
        delivery_required: deliveryOn, notes: notes.trim(),
      };
      if (discountOn && discountTotal > 0) payload.discount_amount = discountTotal.toFixed(2);
      if (deliveryOn) {
        payload.delivery_fee = deliveryTotal.toFixed(2); payload.delivery_address = deliveryAddress.trim();
        payload.delivery_contact_name = deliveryContact.trim(); payload.delivery_contact_phone = deliveryPhone.trim();
      }
      job = await api<CateringJob>("catering/jobs/", { method: "POST", body: JSON.stringify(payload) });
    } catch (err) { setError(err instanceof ApiError ? err.message : "Could not create the catering job."); setSaving(false); return; }

    if (confirmAfterCreate) {
      try { job = await api<CateringJob>(`catering/jobs/${job.id}/confirm/`, { method: "POST", body: JSON.stringify({}) }); }
      catch (err) { setNotice(`Catering job ${job.job_number} was saved as a draft, but confirmation failed: ${err instanceof ApiError ? err.message : "check stock availability and try again."}`); setJobs((existing) => [job, ...existing.filter((row) => row.id !== job.id)]); setShowForm(false); setSaving(false); return; }
    }
    setJobs((existing) => [job, ...existing.filter((row) => row.id !== job.id)]);
    setShowForm(false); setNotice(`Catering job ${job.job_number} was ${confirmAfterCreate ? "created and confirmed" : "saved as a draft"}.`); setSaving(false);
    setServiceLines([{ key: `service-${Date.now()}`, description: "Catering service", quantity: "1", unitLabel: "job", unitPrice: "" }]); setMaterials([]); setDiscountOn(false); setDiscount(""); setDeliveryOn(false); setDeliveryFee("");
    void load();
  }

  if (!user?.division.has_catering_services) return <div className="page-stack"><section className="page-heading"><div className="eyebrow"><span className="eyebrow-line" /> CATERING SERVICES</div><h1>Not enabled for this division</h1><p>This workspace is configured for rental bookings only.</p></section></div>;

  return <div className="page-stack">
    <section className="page-heading heading-with-actions"><div><div className="eyebrow"><span className="eyebrow-line" /> CATERING SERVICES</div><h1>Catering jobs</h1><p>Track catering service charges and reusable materials separately from equipment rentals.</p></div><button className="button button-primary" onClick={() => { setShowForm(true); setError(""); setNotice(""); }}><Plus size={17} /> New catering job</button></section>
    {error && <div className="form-alert page-alert"><AlertCircle size={17} /> {error}</div>}{notice && <div className="form-success page-alert"><ShieldCheck size={17} /> {notice}</div>}
    <section className="stats-grid inventory-stats"><article className="stat-card"><div className="stat-top"><span className="stat-label">Catering jobs</span><span className="stat-icon stat-icon-green"><ChefHat size={19} /></span></div><div className="stat-value">{jobs.length}</div><div className="stat-foot"><span className="stat-note">Latest records</span></div></article><article className="stat-card"><div className="stat-top"><span className="stat-label">Upcoming events</span><span className="stat-icon stat-icon-blue"><ChefHat size={19} /></span></div><div className="stat-value">{jobs.filter((job) => job.event_date >= localDate() && !["cancelled", "completed"].includes(job.status)).length}</div><div className="stat-foot"><span className="stat-note">Not yet completed</span></div></article><article className="stat-card"><div className="stat-top"><span className="stat-label">Confirmed</span><span className="stat-icon stat-icon-purple"><ShieldCheck size={19} /></span></div><div className="stat-value">{jobs.filter((job) => job.status === "confirmed").length}</div><div className="stat-foot"><span className="stat-note">Scheduled events</span></div></article><article className="stat-card"><div className="stat-top"><span className="stat-label">Delivery required</span><span className="stat-icon stat-icon-amber"><Truck size={19} /></span></div><div className="stat-value">{jobs.filter((job) => job.delivery_required && !["cancelled", "completed"].includes(job.status)).length}</div><div className="stat-foot"><span className="stat-note">Catering jobs with delivery</span></div></article></section>
    <section className="panel inventory-panel"><div className="panel-heading inventory-toolbar"><div><h2>Catering register</h2><p>Service orders and material allocations for your events.</p></div><div className="toolbar-actions"><div className="search-field"><Search size={17} /><input aria-label="Search catering jobs" placeholder="Search job, customer or venue…" value={search} onChange={(e) => setSearch(e.target.value)} /></div></div></div>
      {loading ? <div className="loading-card"><div className="loader-line" /><span>Loading catering jobs…</span></div> : filtered.length === 0 ? <div className="empty-state"><div className="empty-icon"><ChefHat size={23} /></div><strong>{search ? "No matching catering jobs" : "No catering jobs recorded yet"}</strong><span>Record an event's service package, fees, and any reusable materials sent out.</span><button className="button button-primary button-small" onClick={() => setShowForm(true)}><Plus size={15} /> Add catering job</button></div> : <div className="table-scroll"><table className="data-table"><thead><tr><th>Job / customer</th><th>Event date</th><th>Venue</th><th>Materials allocated</th><th>Delivery</th><th>Status</th><th className="align-right">Total</th></tr></thead><tbody>{filtered.map((job) => <tr key={job.id}><td><div className="table-primary">{job.job_number}</div><div className="table-secondary">{job.customer_name}</div></td><td>{dateLabel(job.event_date)}</td><td>{job.event_location || "—"}</td><td>{job.material_allocations?.reduce((sum, row) => sum + row.quantity, 0) ?? 0} units</td><td>{job.delivery_required ? <span className="mini-tag mini-tag-blue"><Truck size={12} /> {money(job.delivery_fee)}</span> : <span className="muted-inline">No delivery</span>}</td><td><span className={`status-pill status-${job.status}`}>{titleCase(job.status)}</span></td><td className="align-right amount-cell">{money(job.total_amount)}</td></tr>)}</tbody></table></div>}
      <div className="table-footer"><span>Showing {filtered.length} of {jobs.length} catering jobs</span><span>Reusable materials share the existing inventory catalogue.</span></div>
    </section>

    {showForm && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setShowForm(false); }}><section className="modal-card modal-card-wide" role="dialog" aria-modal="true" aria-labelledby="catering-modal-title"><div className="modal-header"><div><span className="section-kicker">NEW CATERING SERVICE</span><h2 id="catering-modal-title">Create catering job</h2><p>Record the service price and optionally reserve reusable catering materials.</p></div><button className="icon-button" aria-label="Close" disabled={saving} onClick={() => setShowForm(false)}><X size={18} /></button></div>
      {customers.length === 0 || items.length === 0 ? <div className="empty-callout"><AlertCircle size={18} /><span>{customers.length === 0 ? "Add a customer before creating a catering job." : "Add catalogue items before allocating reusable materials."}</span></div> : <form className="modal-form" onSubmit={createJob}><div className="form-two-col"><div className="field-full"><label className="field-label" htmlFor="catering-customer">Customer *</label><select id="catering-customer" className="text-input" value={customerId} onChange={(e) => setCustomerId(e.target.value)} required><option value="">Select customer</option>{customers.map((customer) => <option value={customer.id} key={customer.id}>{customer.name}{customer.phone ? ` · ${customer.phone}` : ""}</option>)}</select></div><div><label className="field-label" htmlFor="catering-event-date">Event date *</label><input className="text-input" id="catering-event-date" type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} required /></div><div><label className="field-label" htmlFor="catering-guests">Guest count <span className="optional-label">Optional</span></label><input className="text-input" id="catering-guests" type="number" min="1" value={guestCount} onChange={(e) => setGuestCount(e.target.value)} /></div><div><label className="field-label" htmlFor="catering-dispatch">Material dispatch date *</label><input className="text-input" id="catering-dispatch" type="date" value={dispatchDate} onChange={(e) => setDispatchDate(e.target.value)} required /></div><div><label className="field-label" htmlFor="catering-return">Material return date *</label><input className="text-input" id="catering-return" type="date" min={dispatchDate} value={returnDate} onChange={(e) => setReturnDate(e.target.value)} required /></div><div className="field-full"><label className="field-label" htmlFor="catering-location">Event venue / location</label><input className="text-input" id="catering-location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Venue or delivery location" /></div></div>
      <div className="modal-subsection"><div className="modal-subsection-heading"><strong>Service charges</strong><span>Amount billed to the customer.</span></div>{serviceLines.map((line, index) => <div className="service-line-editor" key={line.key}><div className="service-line-label"><span>Service {index + 1}</span>{serviceLines.length > 1 && <button type="button" className="line-remove" onClick={() => setServiceLines((rows) => rows.filter((row) => row.key !== line.key))}><Trash2 size={13} /> Remove</button>}</div><div className="service-line-fields"><div className="service-description"><label className="field-label" htmlFor={`service-description-${line.key}`}>Description *</label><input id={`service-description-${line.key}`} className="text-input" value={line.description} onChange={(e) => updateService(line.key, { description: e.target.value })} required /></div><div><label className="field-label" htmlFor={`service-quantity-${line.key}`}>Qty *</label><input id={`service-quantity-${line.key}`} className="text-input" type="number" min="0.01" step="0.01" value={line.quantity} onChange={(e) => updateService(line.key, { quantity: e.target.value })} required /></div><div><label className="field-label" htmlFor={`service-unit-${line.key}`}>Unit</label><input id={`service-unit-${line.key}`} className="text-input" value={line.unitLabel} onChange={(e) => updateService(line.key, { unitLabel: e.target.value })} placeholder="job" /></div><div><label className="field-label" htmlFor={`service-price-${line.key}`}>Unit price (₦) *</label><input id={`service-price-${line.key}`} className="text-input" type="number" min="0" step="0.01" value={line.unitPrice} onChange={(e) => updateService(line.key, { unitPrice: e.target.value })} required /></div></div></div>)}<button type="button" className="add-line-button" onClick={() => setServiceLines((lines) => [...lines, { key: `service-${Date.now()}`, description: "", quantity: "1", unitLabel: "", unitPrice: "" }])}><Plus size={15} /> Add service line</button></div>
      <div className="modal-subsection"><div className="modal-subsection-heading"><strong>Reusable materials <span className="optional-label">Optional</span></strong><span>Use items from the existing catalogue; they'll be tracked and returned.</span></div>{materials.map((line, index) => <div className="material-line-editor" key={line.key}><div className="material-select"><label className="field-label" htmlFor={`material-item-${line.key}`}>Catalogue item</label><select id={`material-item-${line.key}`} className="text-input" value={line.itemId} onChange={(e) => updateMaterial(line.key, { itemId: e.target.value })}><option value="">Choose material</option>{items.map((item) => <option value={item.id} key={item.id}>{item.name} · {item.sku}</option>)}</select></div><div><label className="field-label" htmlFor={`material-qty-${line.key}`}>Quantity</label><input className="text-input" id={`material-qty-${line.key}`} type="number" min="1" step="1" value={line.quantity} onChange={(e) => updateMaterial(line.key, { quantity: e.target.value })} /></div><button type="button" className="icon-button material-remove" aria-label={`Remove material ${index+1}`} onClick={() => setMaterials((rows) => rows.filter((row) => row.key !== line.key))}><Trash2 size={16} /></button></div>)}<button type="button" className="add-line-button" onClick={() => setMaterials((rows) => [...rows, { key: `material-${Date.now()}`, itemId: "", quantity: "1" }])}><PackagePlus size={15} /> Allocate reusable material</button></div>
      <div className="modal-subsection"><div className="modal-subsection-heading"><strong>Optional adjustments and delivery</strong><span>No discount or delivery is required to save a catering job.</span></div><div className="form-two-col"><div><label className="checkbox-field"><input type="checkbox" checked={discountOn} onChange={(e) => setDiscountOn(e.target.checked)} /> Apply discount</label>{discountOn && <input className="text-input inline-field" aria-label="Catering discount amount" type="number" min="0.01" step="0.01" max={serviceTotal} value={discount} onChange={(e) => setDiscount(e.target.value)} required placeholder="Discount in ₦" />}</div><div><label className="checkbox-field"><input type="checkbox" checked={deliveryOn} onChange={(e) => setDeliveryOn(e.target.checked)} /> Delivery required</label>{deliveryOn && <input className="text-input inline-field" aria-label="Delivery fee" type="number" min="0" step="0.01" value={deliveryFee} onChange={(e) => setDeliveryFee(e.target.value)} placeholder="Delivery fee in ₦" />}</div>{deliveryOn && <><div><label className="field-label" htmlFor="catering-delivery-contact">Delivery contact</label><input className="text-input" id="catering-delivery-contact" value={deliveryContact} onChange={(e) => setDeliveryContact(e.target.value)} /></div><div><label className="field-label" htmlFor="catering-delivery-phone">Delivery phone</label><input className="text-input" id="catering-delivery-phone" value={deliveryPhone} onChange={(e) => setDeliveryPhone(e.target.value)} /></div><div className="field-full"><label className="field-label" htmlFor="catering-delivery-address">Delivery address</label><input className="text-input" id="catering-delivery-address" value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} /></div></>}</div></div>
      <div className="catering-estimate"><span>Estimated job total</span><strong>{money(estimatedTotal)}</strong></div><label className="checkbox-field confirmation-checkbox"><input type="checkbox" checked={confirmAfterCreate} onChange={(e) => setConfirmAfterCreate(e.target.checked)} /> Confirm this job now and reserve allocated materials</label><div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setShowForm(false)} disabled={saving}>Cancel</button><button type="submit" className="button button-primary" disabled={saving}>{saving ? "Saving…" : confirmAfterCreate ? "Create & confirm job" : "Save job as draft"}</button></div></form>}
    </section></div>}
  </div>;
}
