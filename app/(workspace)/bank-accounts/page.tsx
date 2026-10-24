"use client";

import { FormEvent, useEffect, useState } from "react";
import { AlertCircle, Archive, Landmark, Pencil, Plus, RefreshCw, X } from "lucide-react";
import { api, apiList, ApiError } from "@/lib/api";
import type { BankAccount } from "@/lib/types";

export default function BankAccountsPage() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<BankAccount | null>(null);
  const [label, setLabel] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [notes, setNotes] = useState("");

  async function load() {
    setLoading(true); setError("");
    try { setAccounts(await apiList<BankAccount>("bank-accounts/")); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Could not load bank destinations."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  function openCreate() {
    setEditing(null); setLabel(""); setBankName(""); setAccountName(""); setAccountNumber(""); setNotes(""); setError(""); setNotice(""); setShowForm(true);
  }
  function openEdit(account: BankAccount) {
    setEditing(account); setLabel(account.label); setBankName(account.bank_name); setAccountName(account.account_name); setAccountNumber(""); setNotes(account.notes || ""); setError(""); setNotice(""); setShowForm(true);
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      const payload: Record<string, unknown> = { label: label.trim(), bank_name: bankName.trim(), account_name: accountName.trim(), notes: notes.trim(), is_active: true };
      // The API deliberately never returns full account numbers. Leave this blank on edit to keep the saved value.
      if (accountNumber.trim()) payload.account_number = accountNumber.trim();
      const saved = editing
        ? await api<BankAccount>(`bank-accounts/${editing.id}/`, { method: "PATCH", body: JSON.stringify(payload) })
        : await api<BankAccount>("bank-accounts/", { method: "POST", body: JSON.stringify(payload) });
      setAccounts((rows) => [...rows.filter((row) => row.id !== saved.id), { ...saved, account_number_masked: saved.account_number_masked || editing?.account_number_masked || "" }].sort((a, b) => a.label.localeCompare(b.label)));
      setShowForm(false); setEditing(null); setNotice(editing ? "Bank destination updated." : "Bank destination added.");
      await load();
    } catch (err) { setError(err instanceof ApiError ? err.message : "Could not save bank destination."); }
    finally { setSaving(false); }
  }
  async function archive(account: BankAccount) {
    if (!window.confirm(`Archive ${account.label}? Existing payment history will remain intact.`)) return;
    setError(""); setNotice("");
    try { await api(`bank-accounts/${account.id}/`, { method: "DELETE" }); setNotice(`${account.label} was archived.`); await load(); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Could not archive bank destination."); }
  }

  return <div className="page-stack">
    <section className="page-heading heading-with-actions"><div><div className="eyebrow"><span className="eyebrow-line" /> PAYMENT SETTINGS</div><h1>Bank destinations</h1><p>Configure the accounts that can be selected when a customer pays by bank transfer. Cash remains available as a separate method.</p></div><div className="heading-actions"><button className="button button-secondary" aria-label="Refresh bank destinations" onClick={() => void load()}><RefreshCw size={16} /> Refresh</button><button className="button button-primary" onClick={openCreate}><Plus size={17} /> Add bank account</button></div></section>
    {error && <div className="form-alert page-alert"><AlertCircle size={17} /> {error}</div>}{notice && <div className="form-success page-alert">{notice}</div>}
    <section className="panel inventory-panel"><div className="panel-heading"><div><h2>Configured destinations</h2><p>These options are scoped to the current division.</p></div></div>
      {loading ? <div className="loading-card"><div className="loader-line" /><span>Loading bank destinations…</span></div> : accounts.length === 0 ? <div className="empty-state"><div className="empty-icon"><Landmark size={23} /></div><strong>No bank accounts configured yet</strong><span>You can still record cash payments. Add your first bank account to enable bank transfer choices.</span><button className="button button-primary button-small" onClick={openCreate}><Plus size={15} /> Add bank account</button></div> : <div className="table-scroll"><table className="data-table"><thead><tr><th>Payment label</th><th>Bank</th><th>Account name</th><th>Account number</th><th>Status</th><th>Actions</th></tr></thead><tbody>{accounts.map((account) => <tr key={account.id}><td><strong>{account.label}</strong>{account.notes && <div className="table-secondary">{account.notes}</div>}</td><td>{account.bank_name}</td><td>{account.account_name}</td><td>{account.account_number_masked || "Not provided"}</td><td><span className={`status-pill ${account.is_active ? "status-confirmed" : "status-cancelled"}`}>{account.is_active ? "Active" : "Archived"}</span></td><td><div className="table-row-actions"><button className="button button-small button-secondary" onClick={() => openEdit(account)}><Pencil size={13} /> Edit</button>{account.is_active && <button className="button button-small button-secondary" onClick={() => void archive(account)}><Archive size={13} /> Archive</button>}</div></td></tr>)}</tbody></table></div>}
    </section>
    {showForm && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setShowForm(false); }}><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="bank-modal-title"><div className="modal-header"><div><span className="section-kicker">PAYMENT SETTINGS</span><h2 id="bank-modal-title">{editing ? "Edit bank destination" : "Add bank destination"}</h2><p>Use a friendly label such as “Zenith business account”.</p></div><button className="icon-button" aria-label="Close" onClick={() => setShowForm(false)} disabled={saving}><X size={18} /></button></div><form className="modal-form" onSubmit={save}><label className="field-label" htmlFor="bank-label">Payment label *</label><input id="bank-label" className="text-input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Zenith business account" required /><div className="form-two-col"><div><label className="field-label" htmlFor="bank-name">Bank name *</label><input id="bank-name" className="text-input" value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="e.g. Zenith Bank" required /></div><div><label className="field-label" htmlFor="account-name">Account name *</label><input id="account-name" className="text-input" value={accountName} onChange={(e) => setAccountName(e.target.value)} required /></div><div className="field-full"><label className="field-label" htmlFor="account-number">Account number {editing ? <span className="optional-label">Leave blank to keep saved number</span> : <span className="optional-label">Optional</span>}</label><input id="account-number" className="text-input" inputMode="numeric" autoComplete="off" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder={editing ? "Leave blank to keep existing number" : "Account number"} /></div><div className="field-full"><label className="field-label" htmlFor="bank-notes">Notes <span className="optional-label">Optional</span></label><input id="bank-notes" className="text-input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Internal note, if needed" /></div></div><div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setShowForm(false)} disabled={saving}>Cancel</button><button type="submit" className="button button-primary" disabled={saving}>{saving ? "Saving…" : editing ? "Save changes" : "Add bank account"}</button></div></form></section></div>}
  </div>;
}
