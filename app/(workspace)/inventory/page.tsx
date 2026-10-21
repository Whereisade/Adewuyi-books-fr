"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Plus, Search, X, PackagePlus, Tags, Boxes, AlertCircle, RefreshCw } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { money } from "@/lib/format";
import type { Category, CatalogueItem, InventoryBalance } from "@/lib/types";

export default function InventoryPage() {
  const [items, setItems] = useState<CatalogueItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [balances, setBalances] = useState<InventoryBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [showItemForm, setShowItemForm] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [categoryDescription, setCategoryDescription] = useState("");
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("0");
  const [openingStock, setOpeningStock] = useState("0");

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [nextItems, nextCategories, nextBalances] = await Promise.all([
        api<CatalogueItem[]>("items/"), api<Category[]>("categories/"), api<InventoryBalance[]>("inventory/balances/"),
      ]);
      setItems(nextItems);
      setCategories(nextCategories);
      setBalances(nextBalances);
      if (!categoryId && nextCategories.length) setCategoryId(String(nextCategories[0].id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load inventory.");
    } finally { setLoading(false); }
  }

  useEffect(() => { void loadData(); /* initial load only */ }, []);

  const balanceByItem = useMemo(() => new Map(balances.map((row) => [row.item, row])), [balances]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) => [item.name, item.sku, item.category_name].some((value) => value?.toLowerCase().includes(needle)));
  }, [items, query]);
  const activeCount = items.filter((item) => item.is_active).length;
  const usableCount = balances.reduce((sum, row) => sum + row.usable_on_hand, 0);
  const rentedCount = balances.reduce((sum, row) => sum + row.rented_out, 0);

  async function createCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      const category = await api<Category>("categories/", { method: "POST", body: JSON.stringify({ name: categoryName.trim(), description: categoryDescription.trim(), is_active: true }) });
      setCategories((existing) => [...existing, category].sort((a, b) => a.name.localeCompare(b.name)));
      setCategoryId(String(category.id)); setCategoryName(""); setCategoryDescription(""); setShowCategoryForm(false); setNotice("Category created.");
    } catch (err) { setError(err instanceof ApiError ? err.message : "Could not create category."); }
    finally { setSaving(false); }
  }

  async function createItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      const item = await api<CatalogueItem>("items/", {
        method: "POST",
        body: JSON.stringify({ category: Number(categoryId), sku: sku.trim(), name: name.trim(), description: description.trim(), price_basis: "item_rental", default_rental_price: price || "0.00", is_active: true, notes: "" }),
      });
      let stockNotice = "";
      const stockQty = Number(openingStock);
      if (Number.isInteger(stockQty) && stockQty > 0) {
        try {
          await api("inventory/stock-additions/", { method: "POST", body: JSON.stringify({ item_id: item.id, quantity: stockQty, opening: true, note: "Opening stock entered during catalogue setup" }) });
        } catch (err) {
          stockNotice = ` The item was created, but opening stock was not recorded: ${err instanceof ApiError ? err.message : "please record stock separately."}`;
        }
      }
      setItems((existing) => [...existing, item].sort((a, b) => a.name.localeCompare(b.name)));
      setSku(""); setName(""); setDescription(""); setPrice("0"); setOpeningStock("0"); setShowItemForm(false);
      setNotice(`Item created successfully.${stockNotice}`);
      await loadData();
    } catch (err) { setError(err instanceof ApiError ? err.message : "Could not create item."); }
    finally { setSaving(false); }
  }

  return (
    <div className="page-stack">
      <section className="page-heading heading-with-actions"><div><div className="eyebrow"><span className="eyebrow-line" /> STOCK CONTROL</div><h1>Inventory catalogue</h1><p>Keep one standard list of items, prices and stock quantities.</p></div><div className="heading-actions"><button className="button button-secondary" onClick={() => setShowCategoryForm(true)}><Tags size={17} /> Add category</button><button className="button button-primary" onClick={() => setShowItemForm(true)}><Plus size={17} /> Add item</button></div></section>

      {error && <div className="form-alert page-alert"><AlertCircle size={17} /> {error}</div>}
      {notice && <div className="form-success page-alert"><PackagePlus size={17} /> {notice}</div>}

      <section className="stats-grid inventory-stats">
        <article className="stat-card"><div className="stat-top"><span className="stat-label">Catalogue items</span><span className="stat-icon stat-icon-blue"><Boxes size={19} /></span></div><div className="stat-value">{items.length}</div><div className="stat-foot"><span className="stat-note">{activeCount} active</span></div></article>
        <article className="stat-card"><div className="stat-top"><span className="stat-label">Usable units on hand</span><span className="stat-icon stat-icon-green"><PackagePlus size={19} /></span></div><div className="stat-value">{usableCount.toLocaleString("en-NG")}</div><div className="stat-foot"><span className="stat-note">Physical usable stock</span></div></article>
        <article className="stat-card"><div className="stat-top"><span className="stat-label">Units rented out</span><span className="stat-icon stat-icon-purple"><Boxes size={19} /></span></div><div className="stat-value">{rentedCount.toLocaleString("en-NG")}</div><div className="stat-foot"><span className="stat-note">Awaiting resolution or return</span></div></article>
        <article className="stat-card"><div className="stat-top"><span className="stat-label">Categories</span><span className="stat-icon stat-icon-amber"><Tags size={19} /></span></div><div className="stat-value">{categories.length}</div><div className="stat-foot"><span className="stat-note">Organize your catalogue</span></div></article>
      </section>

      <section className="panel inventory-panel"><div className="panel-heading inventory-toolbar"><div><h2>All items</h2><p>Rental items registered for this division.</p></div><div className="toolbar-actions"><div className="search-field"><Search size={17} /><input aria-label="Search catalogue" placeholder="Search item, code, category…" value={query} onChange={(e) => setQuery(e.target.value)} /></div><button className="icon-button refresh-button" aria-label="Refresh catalogue" onClick={() => void loadData()}><RefreshCw size={17} /></button></div></div>
        {loading ? <div className="loading-card"><div className="loader-line" /><span>Loading catalogue…</span></div> : filtered.length === 0 ? <div className="empty-state"><div className="empty-icon"><Boxes size={23} /></div><strong>{query ? "No matching items" : "Your catalogue is ready to begin"}</strong><span>{query ? "Try a different search." : "Add your first category and item. You can enter opening stock at the same time."}</span>{!query && <button className="button button-primary button-small" onClick={() => setShowItemForm(true)}><Plus size={15} /> Add first item</button>}</div> : <div className="table-scroll"><table className="data-table"><thead><tr><th>Item</th><th>Category</th><th>Unit rental price</th><th>Usable</th><th>Rented out</th><th>Status</th></tr></thead><tbody>{filtered.map((item) => { const balance = balanceByItem.get(item.id); return <tr key={item.id}><td><div className="item-table-cell"><div className="item-mini-icon"><PackagePlus size={17} /></div><div><div className="table-primary">{item.name}</div><div className="table-secondary">{item.sku}</div></div></div></td><td>{item.category_name || categories.find((category) => category.id === item.category)?.name || "—"}</td><td className="amount-cell">{money(item.default_rental_price)}</td><td><span className="stock-number">{balance?.usable_on_hand ?? 0}</span></td><td>{balance?.rented_out ?? 0}</td><td><span className={`status-pill ${item.is_active ? "status-confirmed" : "status-cancelled"}`}>{item.is_active ? "Active" : "Inactive"}</span></td></tr>; })}</tbody></table></div>}
        <div className="table-footer"><span>Showing {filtered.length} of {items.length} catalogue items</span><span>Prices in NGN</span></div>
      </section>

      {showCategoryForm && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowCategoryForm(false); }}><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="category-modal-title"><div className="modal-header"><div><span className="section-kicker">CATALOGUE SETTINGS</span><h2 id="category-modal-title">Add a category</h2><p>Use categories to group similar rental items.</p></div><button className="icon-button" aria-label="Close" onClick={() => setShowCategoryForm(false)}><X size={18} /></button></div><form className="modal-form" onSubmit={createCategory}><label className="field-label" htmlFor="category-name">Category name *</label><input className="text-input" id="category-name" value={categoryName} onChange={(e) => setCategoryName(e.target.value)} placeholder="e.g. Chairs and seating" required autoFocus /><label className="field-label" htmlFor="category-description">Description <span className="optional-label">Optional</span></label><textarea className="text-input text-area" id="category-description" value={categoryDescription} onChange={(e) => setCategoryDescription(e.target.value)} placeholder="A short description" rows={2} /><div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setShowCategoryForm(false)}>Cancel</button><button className="button button-primary" disabled={saving}>{saving ? "Saving…" : "Create category"}</button></div></form></section></div>}

      {showItemForm && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowItemForm(false); }}><section className="modal-card modal-card-wide" role="dialog" aria-modal="true" aria-labelledby="item-modal-title"><div className="modal-header"><div><span className="section-kicker">NEW CATALOGUE ITEM</span><h2 id="item-modal-title">Add rental item</h2><p>Set up the standard item name and price once, then reuse it in every booking.</p></div><button className="icon-button" aria-label="Close" onClick={() => setShowItemForm(false)}><X size={18} /></button></div>
        {categories.length === 0 ? <div className="empty-callout"><AlertCircle size={18} /><span>Create a category first, then add the item.</span><button type="button" className="text-link" onClick={() => { setShowItemForm(false); setShowCategoryForm(true); }}>Add category</button></div> : <form className="modal-form" onSubmit={createItem}><div className="form-two-col"><div><label className="field-label" htmlFor="item-name">Item name *</label><input className="text-input" id="item-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. White plastic chair" required autoFocus /></div><div><label className="field-label" htmlFor="item-sku">Item code / SKU *</label><input className="text-input" id="item-sku" value={sku} onChange={(e) => setSku(e.target.value)} placeholder="e.g. CHAIR-WHT-01" required /></div><div><label className="field-label" htmlFor="item-category">Category *</label><select className="text-input" id="item-category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required><option value="" disabled>Select category</option>{categories.filter((category) => category.is_active).map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></div><div><label className="field-label" htmlFor="item-price">Default rental price (₦) *</label><input className="text-input" id="item-price" inputMode="decimal" type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} required /></div><div className="field-full"><label className="field-label" htmlFor="item-description">Description <span className="optional-label">Optional</span></label><textarea className="text-input text-area" id="item-description" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Colour, size or other useful details" /></div><div className="field-full stock-entry-callout"><div className="stock-entry-icon"><Boxes size={18} /></div><div className="stock-entry-copy"><strong>Opening stock</strong><span>Enter how many usable units you physically have today. You can leave this at zero and add stock later.</span></div><div className="stock-quantity"><label className="sr-only" htmlFor="opening-stock">Opening stock quantity</label><input className="text-input" id="opening-stock" type="number" min="0" step="1" value={openingStock} onChange={(e) => setOpeningStock(e.target.value)} /></div></div></div><div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setShowItemForm(false)}>Cancel</button><button type="submit" className="button button-primary" disabled={saving || !categoryId}>{saving ? "Saving item…" : "Save catalogue item"}</button></div></form>}
      </section></div>}
    </div>
  );
}
