"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, FileSpreadsheet, Upload } from "lucide-react";
import { api, ApiError } from "@/lib/api";

type ImportResult = { imported_bookings: number; skipped_existing_or_empty: number; customers_created: number; inactive_catalogue_placeholders_created: number; issues: string[]; note: string };
export default function LegacyImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setResult(null);
    if (!file) { setError("Choose a CSV file exported from Excel first."); return; }
    if (!file.name.toLowerCase().endsWith(".csv")) { setError("Please export the worksheet as CSV UTF-8 before importing. The original XLSX file cannot be uploaded here directly."); return; }
    setLoading(true);
    try {
      const form = new FormData(); form.append("file", file);
      const response = await api<ImportResult>("legacy-import/bookings/", { method: "POST", body: form });
      setResult(response); setFile(null);
      const input = document.getElementById("legacy-booking-file") as HTMLInputElement | null; if (input) input.value = "";
    } catch (err) { setError(err instanceof ApiError ? err.message : "Could not import the booking history."); }
    finally { setLoading(false); }
  }
  return <div className="page-stack">
    <section className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> DATA MIGRATION</div><h1>Import historical bookings</h1><p>Import the cleaned ADE history in one batch: customers, approved rental items, delivery fees, discounts, and eligible historical extras. The WUNMI sheet is excluded.</p></div></section>
    {error && <div className="form-alert page-alert"><AlertCircle size={17} /> {error}</div>}
    {result && <section className="panel import-result"><div className="panel-heading"><div><h2><CheckCircle2 size={18} /> Import finished</h2><p>{result.note}</p></div></div><div className="stats-grid"><article className="stat-card"><span className="stat-label">Bookings imported</span><div className="stat-value">{result.imported_bookings}</div></article><article className="stat-card"><span className="stat-label">Customers created</span><div className="stat-value">{result.customers_created}</div></article><article className="stat-card"><span className="stat-label">Catalogue placeholders created</span><div className="stat-value">{result.inactive_catalogue_placeholders_created}</div></article><article className="stat-card"><span className="stat-label">Skipped</span><div className="stat-value">{result.skipped_existing_or_empty}</div></article></div>{result.issues?.length > 0 && <div className="detail-notes"><strong>Items to review</strong><ul>{result.issues.map((issue, i) => <li key={`${i}-${issue}`}>{issue}</li>)}</ul></div>}</section>}
    <section className="panel form-section"><div className="form-section-heading"><div className="section-number"><FileSpreadsheet size={18} /></div><div><h2>Upload CSV</h2><p>Upload the single cleaned CSV supplied with this update. Do not upload the original workbook or the review workbook.</p></div></div><form className="modal-form" onSubmit={submit}><label className="field-label" htmlFor="legacy-booking-file">CSV file *</label><input id="legacy-booking-file" type="file" className="text-input" accept=".csv,text/csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} required /><p className="field-hint">Before importing, run the approved catalogue seed command. Booking references already present are skipped; unknown item names are rejected rather than added as catalogue placeholders.</p><button className="button button-primary" type="submit" disabled={loading || !file}><Upload size={16} /> {loading ? "Importing records…" : "Import cleaned history"}</button></form></section>
    <section className="panel detail-overview-panel"><div className="panel-heading"><div><h2>Before you import</h2><p>Important behavior for safe historical migration.</p></div></div><div className="booking-overview-grid"><div><span>Historical prices</span><strong>Preserved per booking line</strong></div><div><span>Customer directory</span><strong>Missing customers are created</strong></div><div><span>Paid / supplied status</span><strong>Stored as manual confirmations</strong></div><div><span>Old payment receipts</span><strong>Not fabricated</strong></div></div><div className="detail-notes"><p>Old entries will not consume current inventory or create fake cash/bank transactions. Transport/logistics is stored as a booking delivery fee, not an inventory item. Eligible non-catalogue historic charges are stored as additional charges. Unknown item names stop the import so the file can be corrected; no inactive placeholder items are created.</p><p>Import into the <strong>Party Rentals</strong> division. Customer names are matched without regard to case, spaces, and punctuation where possible. The companion review workbook is for checking only; only upload the one cleaned CSV. Bank destinations can be configured on the <Link href="/bank-accounts" className="text-link">Bank destinations</Link> page.</p></div></section>
  </div>;
}
