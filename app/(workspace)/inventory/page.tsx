"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Plus, Search, X, PackagePlus, Tags, Boxes, AlertCircle, RefreshCw, Pencil, Archive } from "lucide-react";
import { api, apiList, ApiError } from "@/lib/api";
import { money } from "@/lib/format";
import type { Category, CatalogueItem, InventoryBalance } from "@/lib/types";

const QUANTITY_UNITS = [
  { value: "unit", label: "Unit / each" },
  { value: "dozen", label: "Dozen (12 pieces)" },
  { value: "set", label: "Set" },
  { value: "trip", label: "Trip" },
  { value: "pack", label: "Pack" },
];

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
  const [editingItem, setEditingItem] = useState<CatalogueItem | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [saving, setSaving] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [categoryDescription, setCategoryDescription] = useState("");
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("0");
  const [quantityUnit, setQuantityUnit] = useState("unit");
  const [openingStock, setOpeningStock] = useState("0");

  async function loadData() {
    setLoading(true); setError("");
    try {
      const [nextItems, nextCategories, nextBalances] = await Promise.all([
        apiList<CatalogueItem>("items/"), apiList<Category>("categories/"), apiList<InventoryBalance>("inventory/balances/"),
      ]);
      setItems(nextItems); setCategories(nextCategories); setBalances(nextBalances);
      if (!categoryId && nextCategories.length) setCategoryId(String(nextCategories.find((c) => c.is_active)?.id ?? nextCategories[0].id));
    } catch (err) { setError(err instanceof ApiError ? err.message : "Could not load inventory."); }
    finally { setLoading(false); }
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

  function openNewCategory() {
    setEditingCategory(null); setCategoryName(""); setCategoryDescription(""); setShowCategoryForm(true); setError(""); setNotice("");
  }
  function openEditCategory(category: Category) {
    setEditingCategory(category); setCategoryName(category.name); setCategoryDescription(category.description || ""); setShowCategoryForm(true); setError(""); setNotice("");
  }
  function openNewItem() {
    setEditingItem(null); setSku(""); setName(""); setDescription(""); setPrice("0"); setQuantityUnit("unit"); setOpeningStock("0");
    const activeCategory = categories.find((c) => c.is_active); if (activeCategory) setCategoryId(String(activeCategory.id));
    setShowItemForm(true); setError(""); setNotice("");
  }
  function openEditItem(item: CatalogueItem) {
    setEditingItem(item); setSku(item.sku); setName(item.name); setDescription(item.description || ""); setPrice(item.default_rental_price || "0");
    setQuantityUnit(item.quantity_unit || "unit"); setCategoryId(String(item.category)); setOpeningStock("0"); setShowItemForm(true); setError(""); setNotice("");
  }

  async function saveCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      const payload = { name: categoryName.trim(), description: categoryDescription.trim(), is_active: true };
      if (editingCategory) await api<Category>(`categories/${editingCategory.id}/`, { method: "PATCH", body: JSON.stringify(payload) });
      else await api<Category>("categories/", { method: "POST", body: JSON.stringify(payload) });
      setShowCategoryForm(false); setEditingCategory(null); setNotice(editingCategory ? "Category updated. The change is in the audit trail." : "Category created."); await loadData();
    } catch (err) { setError(err instanceof ApiError ? err.message : "Could not save category."); }
    finally { setSaving(false); }
  }

  async function archiveCategory(category: Category) {
    if (!window.confirm(`Archive category “${category.name}”? Existing booking history is retained.`)) return;
    setError(""); setNotice("");
    try { await api(`categories/${category.id}/`, { method: "DELETE" }); setNotice(`Category “${category.name}” archived. The change is in the audit trail.`); await loadData(); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Could not archive category."); }
  }

  async function saveItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      const payload = { category: Number(categoryId), sku: sku.trim(), name: name.trim(), description: description.trim(), price_basis: "item_rental", quantity_unit: quantityUnit, default_rental_price: price || "0.00", is_active: true, notes: "" };
      let item: CatalogueItem;
      let stockWarning = "";
      if (editingItem) {
        item = await api<CatalogueItem>(`items/${editingItem.id}/`, { method: "PATCH", body: JSON.stringify(payload) });
      } else {
        item = await api<CatalogueItem>("items/", { method: "POST", body: JSON.stringify(payload) });
        const stockQty = Number(openingStock);
        if (Number.isInteger(stockQty) && stockQty > 0) {
          try { await api("inventory/stock-additions/", { method: "POST", body: JSON.stringify({ item_id: item.id, quantity: stockQty, opening: true, note: "Opening stock entered during catalogue setup" }) }); }
          catch (err) { stockWarning = `The item was saved, but opening stock was not recorded: ${err instanceof ApiError ? err.message : "please record stock separately."}`; }
        }
      }
      setShowItemForm(false); setEditingItem(null);
      setNotice(stockWarning || (editingItem ? "Item updated. The change is in the audit trail." : "Item created."));
      await loadData();
    } catch (err) { setError(err instanceof ApiError ? err.message : "Could not save item."); }
    finally { setSaving(false); }
  }

  async function archiveItem(item: CatalogueItem) {
    if (!window.confirm(`Archive “${item.name}”? It will disappear from new booking choices, while old bookings are retained.`)) return;
    setError(""); setNotice("");
    try { await api(`items/${item.id}/`, { method: "DELETE" }); setNotice(`Item “${item.name}” archived. The change is in the audit trail.`); await loadData(); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Could not archive item."); }
  }

  return <div className="page-stack">
    <section className="page-heading heading-with-actions"><div><div className="eyebrow"><span className="eyebrow-line" /> STOCK CONTROL</div><h1>Inventory catalogue</h1><p>Manage your catalogue, pricing and stock unit. Changes and archive actions appear in the catalogue audit trail.</p></div><div className="heading-actions"><button className="button button-secondary" onClick={openNewCategory}><Tags size={17} /> Add category</button><button className="button button-primary" onClick={openNewItem}><Plus size={17} /> Add item</button></div></section>
    {error && <div className="form-alert page-alert"><AlertCircle size={17} /> {error}</div>}
    {notice && <div className="form-success page-alert"><PackagePlus size={17} /> {notice}</div>}
    <section className="stats-grid inventory-stats">
      <article className="stat-card"><div className="stat-top"><span className="stat-label">Catalogue items</span><span className="stat-icon stat-icon-blue"><Boxes size={19} /></span></div><div className="stat-value">{items.length}</div><div className="stat-foot"><span className="stat-note">{activeCount} active</span></div></article>
      <article className="stat-card"><div className="stat-top"><span className="stat-label">Usable quantity</span><span className="stat-icon stat-icon-green"><PackagePlus size={19} /></span></div><div className="stat-value">{usableCount.toLocaleString("en-NG")}</div><div className="stat-foot"><span className="stat-note">Mixed item units</span></div></article>
      <article className="stat-card"><div className="stat-top"><span className="stat-label">Rented quantity</span><span className="stat-icon stat-icon-purple"><Boxes size={19} /></span></div><div className="stat-value">{rentedCount.toLocaleString("en-NG")}</div><div className="stat-foot"><span className="stat-note">Mixed item units</span></div></article>
      <article className="stat-card"><div className="stat-top"><span className="stat-label">Categories</span><span className="stat-icon stat-icon-amber"><Tags size={19} /></span></div><div className="stat-value">{categories.length}</div><div className="stat-foot"><span className="stat-note">Organize your catalogue</span></div></article>
    </section>
    <section className="panel inventory-panel"><div className="panel-heading inventory-toolbar"><div><h2>All items</h2><p>Prices and stock quantities use the selected item unit.</p></div><div className="toolbar-actions"><div className="search-field"><Search size={17} /><input aria-label="Search catalogue" placeholder="Search item, code, category…" value={query} onChange={(e) => setQuery(e.target.value)} /></div><button className="icon-button refresh-button" aria-label="Refresh catalogue" onClick={() => void loadData()}><RefreshCw size={17} /></button></div></div>
      {loading ? <div className="loading-card"><div className="loader-line" /><span>Loading catalogue…</span></div> : filtered.length === 0 ? <div className="empty-state"><div className="empty-icon"><Boxes size={23} /></div><strong>{query ? "No matching items" : "Your catalogue is ready to begin"}</strong><span>{query ? "Try a different search." : "Add your first category and item. You can enter opening stock at the same time."}</span>{!query && <button className="button button-primary button-small" onClick={openNewItem}><Plus size={15} /> Add first item</button>}</div> : <div className="table-scroll"><table className="data-table"><thead><tr><th>Item</th><th>Category</th><th>Price / unit</th><th>Usable</th><th>Rented out</th><th>Status</th><th>Actions</th></tr></thead><tbody>{filtered.map((item) => { const balance = balanceByItem.get(item.id); return <tr key={item.id}><td><div className="item-table-cell"><div className="item-mini-icon"><PackagePlus size={17} /></div><div><div className="table-primary">{item.name}</div><div className="table-secondary">{item.sku}</div></div></div></td><td>{item.category_name || categories.find((category) => category.id === item.category)?.name || "—"}</td><td className="amount-cell">{money(item.default_rental_price)} <div className="table-secondary">per {QUANTITY_UNITS.find((unit) => unit.value === item.quantity_unit)?.label.toLowerCase() || item.quantity_unit}</div></td><td><span className="stock-number">{balance?.usable_on_hand ?? 0}</span></td><td>{balance?.rented_out ?? 0}</td><td><span className={`status-pill ${item.is_active ? "status-confirmed" : "status-cancelled"}`}>{item.is_active ? "Active" : "Archived"}</span></td><td><div className="table-row-actions"><button className="button button-small button-secondary" onClick={() => openEditItem(item)}><Pencil size={13} /> Edit</button>{item.is_active && <button className="button button-small button-secondary" onClick={() => void archiveItem(item)} title="Archive item"><Archive size={13} /> Archive</button>}</div></td></tr>; })}</tbody></table></div>}
      <div className="table-footer"><span>Showing {filtered.length} of {items.length} catalogue items</span><span>Prices in NGN</span></div>
    </section>
    <section className="panel inventory-panel"><div className="panel-heading"><div><h2>Categories</h2><p>Edit or archive categories without removing historical item records.</p></div></div><div className="table-scroll"><table className="data-table"><thead><tr><th>Category</th><th>Description</th><th>Status</th><th>Actions</th></tr></thead><tbody>{categories.map((category) => <tr key={category.id}><td><strong>{category.name}</strong></td><td>{category.description || "—"}</td><td><span className={`status-pill ${category.is_active ? "status-confirmed" : "status-cancelled"}`}>{category.is_active ? "Active" : "Archived"}</span></td><td><div className="table-row-actions"><button className="button button-small button-secondary" onClick={() => openEditCategory(category)}><Pencil size={13} /> Edit</button>{category.is_active && <button className="button button-small button-secondary" onClick={() => void archiveCategory(category)}><Archive size={13} /> Archive</button>}</div></td></tr>)}</tbody></table></div></section>

    {showCategoryForm && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowCategoryForm(false); }}><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="category-modal-title"><div className="modal-header"><div><span className="section-kicker">CATALOGUE SETTINGS</span><h2 id="category-modal-title">{editingCategory ? "Edit category" : "Add a category"}</h2><p>Use categories to group similar rental items.</p></div><button className="icon-button" aria-label="Close" onClick={() => setShowCategoryForm(false)}><X size={18} /></button></div><form className="modal-form" onSubmit={saveCategory}><label className="field-label" htmlFor="category-name">Category name *</label><input id="category-name" className="text-input" value={categoryName} onChange={(e) => setCategoryName(e.target.value)} required autoFocus /><label className="field-label" htmlFor="category-description">Description</label><textarea id="category-description" className="text-input text-area" rows={3} value={categoryDescription} onChange={(e) => setCategoryDescription(e.target.value)} /><div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setShowCategoryForm(false)}>Cancel</button><button type="submit" className="button button-primary" disabled={saving}>{saving ? "Saving…" : editingCategory ? "Save changes" : "Create category"}</button></div></form></section></div>}
    {showItemForm && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowItemForm(false); }}><section className="modal-card modal-card-wide" role="dialog" aria-modal="true" aria-labelledby="item-modal-title"><div className="modal-header"><div><span className="section-kicker">INVENTORY CATALOGUE</span><h2 id="item-modal-title">{editingItem ? "Edit catalogue item" : "Add catalogue item"}</h2><p>The selected unit applies to booking quantities, stock counts and the default price.</p></div><button className="icon-button" aria-label="Close" onClick={() => setShowItemForm(false)}><X size={18} /></button></div>{categories.filter((c) => c.is_active).length === 0 ? <div className="empty-callout"><AlertCircle size={18} /> Add an active category first.</div> : <form className="modal-form" onSubmit={saveItem}><div className="form-two-col"><div><label className="field-label" htmlFor="item-sku">Item code / SKU *</label><input id="item-sku" className="text-input" value={sku} onChange={(e) => setSku(e.target.value)} required /></div><div><label className="field-label" htmlFor="item-name">Item name *</label><input id="item-name" className="text-input" value={name} onChange={(e) => setName(e.target.value)} required /></div><div><label className="field-label" htmlFor="item-category">Category *</label><select id="item-category" className="text-input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required><option value="">Choose category</option>{categories.filter((c) => c.is_active).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></div><div><label className="field-label" htmlFor="item-quantity-unit">Quantity / price unit *</label><select id="item-quantity-unit" className="text-input" value={quantityUnit} onChange={(e) => setQuantityUnit(e.target.value)}>{QUANTITY_UNITS.map((unit) => <option key={unit.value} value={unit.value}>{unit.label}</option>)}</select><span className="field-hint">For example, Plastic Chair priced per dozen should also be stocked and booked in dozens.</span></div><div><label className="field-label" htmlFor="item-price">Standard rental price (₦) *</label><input id="item-price" className="text-input" type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} required /></div>{!editingItem && <div><label className="field-label" htmlFor="item-opening-stock">Opening stock ({quantityUnit})</label><input id="item-opening-stock" className="text-input" type="number" min="0" step="1" value={openingStock} onChange={(e) => setOpeningStock(e.target.value)} /><span className="field-hint">Optional. Editing an item never changes stock automatically.</span></div>}<div className="field-full"><label className="field-label" htmlFor="item-description">Description / notes</label><textarea id="item-description" className="text-input text-area" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></div></div><div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setShowItemForm(false)}>Cancel</button><button type="submit" className="button button-primary" disabled={saving}>{saving ? "Saving…" : editingItem ? "Save changes" : "Create item"}</button></div></form>}</section></div>}
  </div>;
}
