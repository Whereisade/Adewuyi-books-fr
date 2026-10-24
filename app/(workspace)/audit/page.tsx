"use client";

import { useEffect, useState } from "react";
import { AlertCircle, ClipboardList, RefreshCw } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { dateLabel, titleCase } from "@/lib/format";
import type { CatalogueAuditEvent } from "@/lib/types";

export default function CatalogueAuditPage() {
  const [events, setEvents] = useState<CatalogueAuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  async function load() {
    setLoading(true); setError("");
    try { setEvents(await api<CatalogueAuditEvent[]>("catalogue/audit/")); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Could not load catalogue audit history."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  return <div className="page-stack">
    <section className="page-heading heading-with-actions"><div><div className="eyebrow"><span className="eyebrow-line" /> CHANGE HISTORY</div><h1>Catalogue audit trail</h1><p>This page only records catalogue item and category creation, edits, and archiving. It does not show finance or customer activity.</p></div><button className="button button-secondary" onClick={() => void load()}><RefreshCw size={16} /> Refresh</button></section>
    {error && <div className="form-alert page-alert"><AlertCircle size={17} /> {error}</div>}
    <section className="panel inventory-panel"><div className="panel-heading"><div><h2>Recent catalogue changes</h2><p>Latest 250 entries for this division, newest first.</p></div></div>
      {loading ? <div className="loading-card"><div className="loader-line" /><span>Loading audit trail…</span></div> : events.length === 0 ? <div className="empty-state"><div className="empty-icon"><ClipboardList size={23} /></div><strong>No catalogue changes recorded yet</strong><span>Create, edit, or archive an item or category to see the first entry here.</span></div> : <div className="table-scroll"><table className="data-table"><thead><tr><th>Date / time</th><th>Action</th><th>Catalogue record</th><th>Changed by</th><th>Details</th></tr></thead><tbody>{events.map((event) => <tr key={event.id}><td>{dateLabel(event.created_at)}</td><td><span className="status-pill status-confirmed">{titleCase(event.action.replace("catalogue.", ""))}</span></td><td><strong>{event.summary}</strong><div className="table-secondary">{event.object_type} · #{event.object_id}</div></td><td>{event.actor || "Former user"}</td><td><details><summary>View values</summary><div className="audit-detail-grid">{Object.keys(event.before_data || {}).length > 0 && <div><strong>Before</strong><pre>{JSON.stringify(event.before_data, null, 2)}</pre></div>}{Object.keys(event.after_data || {}).length > 0 && <div><strong>After</strong><pre>{JSON.stringify(event.after_data, null, 2)}</pre></div>}</div></details></td></tr>)}</tbody></table></div>}
    </section>
  </div>;
}
