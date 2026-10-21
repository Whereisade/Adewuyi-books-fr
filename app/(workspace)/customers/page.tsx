"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Plus, Search, UsersRound, X, Phone, Mail, MapPin, AlertCircle } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { Customer } from "@/lib/types";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");

  async function loadCustomers() {
    setLoading(true); setError("");
    try { setCustomers(await api<Customer[]>("customers/")); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Could not load customers."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void loadCustomers(); }, []);

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    return value ? customers.filter((customer) => [customer.name, customer.phone, customer.email].some((part) => part?.toLowerCase().includes(value))) : customers;
  }, [customers, query]);

  async function createCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      const customer = await api<Customer>("customers/", { method: "POST", body: JSON.stringify({ name: name.trim(), phone: phone.trim(), email: email.trim(), address: address.trim(), notes: notes.trim() }) });
      setCustomers((list) => [...list, customer].sort((a, b) => a.name.localeCompare(b.name)));
      setName(""); setPhone(""); setEmail(""); setAddress(""); setNotes(""); setShowForm(false); setNotice(`${customer.name} was added to your customer list.`);
    } catch (err) { setError(err instanceof ApiError ? err.message : "Could not save the customer."); }
    finally { setSaving(false); }
  }

  return <div className="page-stack">
    <section className="page-heading heading-with-actions"><div><div className="eyebrow"><span className="eyebrow-line" /> CUSTOMER RECORDS</div><h1>Customers</h1><p>Keep contact details in one place for quicker booking entry.</p></div><button className="button button-primary" onClick={() => setShowForm(true)}><Plus size={17} /> Add customer</button></section>
    {error && <div className="form-alert page-alert"><AlertCircle size={17} /> {error}</div>}{notice && <div className="form-success page-alert">{notice}</div>}
    <section className="panel inventory-panel"><div className="panel-heading inventory-toolbar"><div><h2>Customer directory</h2><p>{customers.length} saved customer{customers.length === 1 ? "" : "s"} in this business book.</p></div><div className="toolbar-actions"><div className="search-field"><Search size={17} /><input aria-label="Search customers" placeholder="Search name or phone…" value={query} onChange={(e) => setQuery(e.target.value)} /></div></div></div>
      {loading ? <div className="loading-card"><div className="loader-line" /><span>Loading customers…</span></div> : filtered.length === 0 ? <div className="empty-state"><div className="empty-icon"><UsersRound size={23} /></div><strong>{query ? "No matching customers" : "Start your customer directory"}</strong><span>{query ? "Try searching by another name or phone number." : "Saved customers can be reused for future rentals and catering jobs."}</span>{!query && <button className="button button-primary button-small" onClick={() => setShowForm(true)}><Plus size={15} /> Add first customer</button>}</div> : <div className="customer-grid">{filtered.map((customer) => <article className="customer-card" key={customer.id}><div className="customer-card-top"><div className="customer-avatar">{customer.name.slice(0, 1).toUpperCase()}</div><span className="customer-id">CUS-{String(customer.id).padStart(4, "0")}</span></div><h3>{customer.name}</h3><div className="customer-detail"><Phone size={14} /><span>{customer.phone || "No phone added"}</span></div>{customer.email && <div className="customer-detail"><Mail size={14} /><span>{customer.email}</span></div>}{customer.address && <div className="customer-detail"><MapPin size={14} /><span>{customer.address}</span></div>}</article>)}</div>}
      <div className="table-footer"><span>Showing {filtered.length} of {customers.length} customers</span><span>Customer records are kept within this division.</span></div>
    </section>
    {showForm && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowForm(false); }}><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="customer-modal-title"><div className="modal-header"><div><span className="section-kicker">CUSTOMER DIRECTORY</span><h2 id="customer-modal-title">Add customer</h2><p>Enter the customer's contact details for future bookings.</p></div><button className="icon-button" aria-label="Close" onClick={() => setShowForm(false)}><X size={18} /></button></div><form className="modal-form" onSubmit={createCustomer}><label className="field-label" htmlFor="customer-name">Customer name *</label><input id="customer-name" className="text-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name or business name" required autoFocus /><div className="form-two-col"><div><label className="field-label" htmlFor="customer-phone">Phone number</label><input id="customer-phone" className="text-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="080…" /></div><div><label className="field-label" htmlFor="customer-email">Email <span className="optional-label">Optional</span></label><input id="customer-email" type="email" className="text-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" /></div><div className="field-full"><label className="field-label" htmlFor="customer-address">Address <span className="optional-label">Optional</span></label><textarea id="customer-address" className="text-input text-area" rows={2} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Customer or business address" /></div><div className="field-full"><label className="field-label" htmlFor="customer-notes">Notes <span className="optional-label">Optional</span></label><textarea id="customer-notes" className="text-input text-area" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Helpful internal notes" /></div></div><div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setShowForm(false)}>Cancel</button><button type="submit" className="button button-primary" disabled={saving}>{saving ? "Saving…" : "Save customer"}</button></div></form></section></div>}
  </div>;
}
