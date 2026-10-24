"use client";

import { KeyboardEvent, useMemo, useState } from "react";
import { Check, Plus, Search, UserPlus, X } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { Customer } from "@/lib/types";

type CustomerPickerProps = {
  customers: Customer[];
  value: string;
  onChange: (value: string) => void;
  onCreated: (customer: Customer) => void;
  label?: string;
  idPrefix: string;
  required?: boolean;
  disabled?: boolean;
};

export function CustomerPicker({ customers, value, onChange, onCreated, label = "Customer", idPrefix, required = true, disabled = false }: CustomerPickerProps) {
  const [query, setQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState({ name: "", phone: "", email: "", address: "", notes: "" });
  const selected = customers.find((customer) => String(customer.id) === value);
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    const rows = needle ? customers.filter((customer) => [customer.name, customer.phone, customer.email, customer.address]
      .some((part) => (part || "").toLocaleLowerCase().includes(needle))) : customers;
    return rows.slice(0, 250);
  }, [customers, query]);

  function searchChanged(next: string) {
    setQuery(next);
    setError("");
    if (next.trim()) onChange("");
  }

  async function createCustomer() {
    if (!draft.name.trim()) { setError("Enter the customer's name."); return; }
    if (draft.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())) { setError("Enter a valid email address or leave email blank."); return; }
    setSaving(true); setError("");
    try {
      const customer = await api<Customer>("customers/", {
        method: "POST",
        body: JSON.stringify({
          name: draft.name.trim(), phone: draft.phone.trim(), email: draft.email.trim(),
          address: draft.address.trim(), notes: draft.notes.trim(),
        }),
      });
      onCreated(customer);
      onChange(String(customer.id));
      setQuery("");
      setDraft({ name: "", phone: "", email: "", address: "", notes: "" });
      setShowCreate(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create this customer.");
    } finally { setSaving(false); }
  }

  function handleCreateKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter" && (event.target as HTMLElement).tagName === "INPUT") {
      event.preventDefault();
      if (!saving) void createCustomer();
    }
  }

  return <div className="customer-picker field-full">
    <label className="field-label" htmlFor={`${idPrefix}-search`}>{label} {required ? "*" : ""}</label>
    <div className="customer-picker-toolbar">
      <div className="customer-search-box">
        <Search size={16} aria-hidden="true" />
        <input
          id={`${idPrefix}-search`}
          className="text-input"
          value={query}
          onChange={(event) => searchChanged(event.target.value)}
          placeholder="Search by name, phone or email"
          autoComplete="off"
          disabled={disabled}
          aria-label={`Search ${label.toLocaleLowerCase()}s`}
        />
        {query && <button type="button" className="customer-search-clear" aria-label="Clear search" onClick={() => setQuery("")}><X size={14} /></button>}
      </div>
      <button type="button" className="button button-secondary customer-add-button" disabled={disabled} onClick={() => { setShowCreate((open) => !open); setError(""); }}>
        {showCreate ? <X size={15} /> : <UserPlus size={15} />}
        {showCreate ? "Cancel" : "Quick create"}
      </button>
    </div>
    <select
      id={`${idPrefix}-select`}
      className="text-input customer-select"
      value={value}
      onChange={(event) => { onChange(event.target.value); setQuery(""); setError(""); }}
      required={required}
      disabled={disabled}
      aria-label={label}
    >
      <option value="">{query ? (filtered.length ? "Choose a matching customer" : "No matching customer") : "Select customer"}</option>
      {filtered.map((customer) => <option value={customer.id} key={customer.id}>
        {customer.name}{customer.phone ? ` · ${customer.phone}` : ""}{customer.email ? ` · ${customer.email}` : ""}
      </option>)}
    </select>
    {selected && !query && <div className="customer-selected-chip"><Check size={14} /><span><strong>{selected.name}</strong>{selected.phone ? ` · ${selected.phone}` : ""}</span><button type="button" className="text-link" onClick={() => { onChange(""); setQuery(""); }}>Change</button></div>}
    {query && filtered.length === 0 && <p className="customer-picker-help">No customer matches that search. You can create a new customer without leaving this form.</p>}
    {showCreate && <div className="customer-quick-form" role="group" aria-label="Quick-create customer" onKeyDown={handleCreateKeyDown}>
      <div className="customer-quick-heading"><div><strong>Quick-create customer</strong><span>The customer will be saved to this division's directory.</span></div><Plus size={16} /></div>
      <div className="customer-quick-fields">
        <div className="field-full"><label className="field-label" htmlFor={`${idPrefix}-new-name`}>Customer name *</label><input id={`${idPrefix}-new-name`} className="text-input" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} required maxLength={160} autoComplete="name" /></div>
        <div><label className="field-label" htmlFor={`${idPrefix}-new-phone`}>Phone</label><input id={`${idPrefix}-new-phone`} className="text-input" value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} maxLength={40} autoComplete="tel" /></div>
        <div><label className="field-label" htmlFor={`${idPrefix}-new-email`}>Email</label><input id={`${idPrefix}-new-email`} type="email" className="text-input" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} autoComplete="email" /></div>
        <div className="field-full"><label className="field-label" htmlFor={`${idPrefix}-new-address`}>Address <span className="optional-label">Optional</span></label><input id={`${idPrefix}-new-address`} className="text-input" value={draft.address} onChange={(event) => setDraft({ ...draft, address: event.target.value })} maxLength={1000} autoComplete="street-address" /></div>
      </div>
      {error && <p className="customer-picker-error" role="alert">{error}</p>}
      <div className="customer-quick-actions"><span className="customer-picker-help">You can complete other details later in Customers.</span><button type="button" className="button button-primary button-small" disabled={saving} onClick={() => void createCustomer()}>{saving ? "Saving…" : <><Plus size={14} /> Create & select</>}</button></div>
    </div>}
    {error && !showCreate && <p className="customer-picker-error" role="alert">{error}</p>}
  </div>;
}
