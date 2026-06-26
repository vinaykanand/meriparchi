"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { PlusIcon, PencilSquareIcon, MagnifyingGlassIcon, XMarkIcon, TrashIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";

interface InventoryItem {
  sku: string | number;
  name: string;
  description?: string;
  reorder_level: string | number;
  opening_balance?: string | number;
  current_balance: string | number;
}

export default function SkusPage() {
  const { session } = useAuth();

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [newSku, setNewSku] = useState("");
  const [newItemName, setNewItemName] = useState("");
  const [newItemDesc, setNewItemDesc] = useState("");
  const [newReorderLevel, setNewReorderLevel] = useState("0");
  const [itemSubmitting, setItemSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Edit states
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [editItemName, setEditItemName] = useState("");
  const [editItemDesc, setEditItemDesc] = useState("");
  const [editReorderLevel, setEditReorderLevel] = useState("0");
  const [editSubmitting, setEditSubmitting] = useState(false);

  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Location wise stock view states
  const [selectedStockItem, setSelectedStockItem] = useState<InventoryItem | null>(null);
  const [locationStocks, setLocationStocks] = useState<any[]>([]);
  const [loadingStocks, setLoadingStocks] = useState(false);

  // Delete states
  const [deleteTarget, setDeleteTarget] = useState<InventoryItem | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteBlockedMsg, setDeleteBlockedMsg] = useState("");

  const viewLocationStock = async (item: InventoryItem) => {
    setSelectedStockItem(item);
    setLoadingStocks(true);
    setLocationStocks([]);
    if (!session?.orgcode) return;
    try {
      const res = await fetch(`/api/inventory?orgcode=${session.orgcode}&sku=${item.sku}`);
      const data = await res.json();
      if (data.success && data.stock) {
        // Filter stock records to only match the selected SKU
        const matched = data.stock.filter((s: any) => String(s.sku) === String(item.sku));
        setLocationStocks(matched);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingStocks(false);
    }
  };

  useEffect(() => {
    if (session?.orgcode) {
      fetchItems();
    }
  }, [session]);

  const fetchItems = async () => {
    setLoading(true);
    if (!session?.orgcode) return;
    try {
      const res = await fetch(`/api/inventory/items?orgcode=${session.orgcode}`);
      const data = await res.json();
      if (data.success) {
        setItems(data.items);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSku.trim() || !newItemName.trim() || !session?.orgcode) return;
    try {
      setItemSubmitting(true);
      setErrorMsg("");
      setSuccessMsg("");
      const res = await fetch("/api/inventory/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgcode: session.orgcode,
          sku: newSku.trim(),
          name: newItemName.trim(),
          description: newItemDesc.trim(),
          reorder_level: parseFloat(newReorderLevel) || 0,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`SKU "${newSku}" created successfully!`);
        setNewSku("");
        setNewItemName("");
        setNewItemDesc("");
        setNewReorderLevel("0");
        fetchItems();
      } else {
        setErrorMsg(data.message || "Failed to create SKU");
      }
    } catch (e) {
      setErrorMsg("Error creating SKU");
    } finally {
      setItemSubmitting(false);
    }
  };

  const handleUpdateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem || !editItemName.trim() || !session?.orgcode) return;
    try {
      setEditSubmitting(true);
      setErrorMsg("");
      setSuccessMsg("");
      const res = await fetch("/api/inventory/items", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgcode: session.orgcode,
          sku: editingItem.sku,
          name: editItemName.trim(),
          description: editItemDesc.trim(),
          reorder_level: parseFloat(editReorderLevel) || 0,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`SKU "${editingItem.sku}" updated successfully!`);
        setEditingItem(null);
        setEditItemName("");
        setEditItemDesc("");
        setEditReorderLevel("0");
        fetchItems();
      } else {
        setErrorMsg(data.message || "Failed to update SKU");
      }
    } catch (e) {
      setErrorMsg("Error updating SKU");
    } finally {
      setEditSubmitting(false);
    }
  };

  const startEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setEditItemName(item.name);
    setEditItemDesc(item.description || "");
    setEditReorderLevel(item.reorder_level.toString());
    setErrorMsg("");
    setSuccessMsg("");
  };

  const cancelEdit = () => {
    setEditingItem(null);
    setEditItemName("");
    setEditItemDesc("");
    setEditReorderLevel("0");
  };

  const handleDeleteItem = async () => {
    if (!deleteTarget || !session?.orgcode) return;
    setDeleteSubmitting(true);
    try {
      const res = await fetch(
        `/api/inventory/items?orgcode=${session.orgcode}&sku=${deleteTarget.sku}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`SKU "${deleteTarget.sku}" deleted successfully.`);
        setDeleteTarget(null);
        fetchItems();
      } else {
        setDeleteTarget(null);
        setDeleteBlockedMsg(data.message || "Deletion failed.");
      }
    } catch (e) {
      setDeleteTarget(null);
      setDeleteBlockedMsg("An unexpected error occurred.");
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const filteredItems = items.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    String(item.sku).toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="flex flex-col gap-6 pb-12 text-slate-800 dark:text-slate-100 max-w-6xl mx-auto">
      <div>
        <h2 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-500 bg-clip-text text-transparent">
          Catalog & SKU Management
        </h2>
        <p className="text-slate-500 text-sm mt-1 font-semibold">
          Manage product catalog, define reorder thresholds, and check real-time stock balances.
        </p>
      </div>

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 dark:bg-rose-950/30 dark:border-rose-900/50 dark:text-rose-400 rounded-xl text-sm font-semibold">
          ⚠️ {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 dark:bg-emerald-950/30 dark:border-emerald-900/50 dark:text-emerald-400 rounded-xl text-sm font-semibold">
          ✅ {successMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Container: New or Edit */}
        <div className="lg:col-span-1">
          {editingItem ? (
            <div className="bg-white dark:bg-slate-800/50 border border-amber-200 dark:border-amber-900/50 rounded-3xl p-6 shadow-sm sticky top-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold flex items-center gap-2 text-amber-600 dark:text-amber-400">
                  <PencilSquareIcon className="w-5 h-5" /> Edit SKU
                </h3>
                <button
                  onClick={cancelEdit}
                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 transition-colors"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleUpdateItem} className="flex flex-col gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    SKU Code
                  </label>
                  <input
                    type="text"
                    disabled
                    value={editingItem.sku}
                    className="w-full p-3 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-mono text-sm text-slate-400 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Item Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Packing Box 10x10"
                    value={editItemName}
                    onChange={(e) => setEditItemName(e.target.value)}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Description
                  </label>
                  <textarea
                    placeholder="Optional details"
                    value={editItemDesc}
                    onChange={(e) => setEditItemDesc(e.target.value)}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold text-sm h-20 resize-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Reorder Level
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="0"
                    value={editReorderLevel}
                    onChange={(e) => setEditReorderLevel(e.target.value)}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold text-sm"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={editSubmitting || !editItemName.trim()}
                    className="flex-1 p-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl transition-colors text-sm disabled:opacity-50"
                  >
                    {editSubmitting ? "Saving..." : "Save Changes"}
                  </button>
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-355 font-bold rounded-xl transition-colors text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 rounded-3xl p-6 shadow-sm sticky top-6">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <PlusIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" /> Create SKU
              </h3>

              <form onSubmit={handleAddItem} className="flex flex-col gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    SKU Code
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. SKU001"
                    value={newSku}
                    onChange={(e) => setNewSku(e.target.value)}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Item Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Cardboard Packaging"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Description
                  </label>
                  <textarea
                    placeholder="Optional details"
                    value={newItemDesc}
                    onChange={(e) => setNewItemDesc(e.target.value)}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold text-sm h-20 resize-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Reorder Level
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="0"
                    value={newReorderLevel}
                    onChange={(e) => setNewReorderLevel(e.target.value)}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={itemSubmitting || !newSku.trim() || !newItemName.trim()}
                  className="w-full p-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors text-sm disabled:opacity-50"
                >
                  {itemSubmitting ? "Adding..." : "Add SKU"}
                </button>
              </form>
            </div>
          )}
        </div>

        {/* List & Search View */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 rounded-3xl p-6 shadow-sm flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h3 className="text-lg font-bold">SKU Catalog Registry</h3>
            <div className="relative w-full sm:w-72">
              <MagnifyingGlassIcon className="w-5 h-5 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="text"
                placeholder="Search catalog by SKU, name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold text-sm"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-10 h-10 border-4 border-slate-200 dark:border-slate-800 border-t-blue-600 rounded-full animate-spin"></div>
              <p className="text-slate-400 text-sm">Loading catalog...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800/60 text-slate-400 text-xs font-bold uppercase tracking-wider">
                    <th className="py-3 px-4 w-[12%]">SKU</th>
                    <th className="py-3 px-4 w-[48%]">Name / Description</th>
                    <th className="py-3 px-4 text-center w-[12%]">Reorder Level</th>
                    <th className="py-3 px-4 text-center w-[12%]">Opening Balance</th>
                    <th className="py-3 px-4 text-center w-[12%]">Current Balance</th>
                    <th className="py-3 px-4 text-right w-[4%]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40">
                  {filteredItems.map((item) => {
                    const isLowStock = parseFloat(item.current_balance as string) <= parseFloat(item.reorder_level as string);
                    return (
                      <tr
                        key={item.sku}
                        className="hover:bg-slate-50/40 dark:hover:bg-slate-900/10 transition-colors group"
                      >
                        <td 
                          onClick={() => viewLocationStock(item)}
                          className="py-3.5 px-4 text-sm font-mono font-bold text-blue-600 dark:text-blue-400 cursor-pointer hover:underline"
                        >
                          <span className="inline-flex items-center gap-1.5">
                            {item.sku}
                            <MagnifyingGlassIcon className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 opacity-60 group-hover:opacity-100 group-hover:text-blue-650 transition-all" />
                          </span>
                        </td>
                        <td 
                          onClick={() => viewLocationStock(item)}
                          className="py-3.5 px-4 text-sm cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 group"
                        >
                          <div className="font-bold text-slate-800 dark:text-slate-200 group-hover:underline">{item.name}</div>
                          {item.description && (
                            <div className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                              {item.description}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-sm text-center font-semibold text-slate-600 dark:text-slate-400">
                          {parseFloat(item.reorder_level as string).toLocaleString('en-IN')}
                        </td>
                        <td 
                          onClick={() => viewLocationStock(item)}
                          className="py-3.5 px-4 text-sm text-center font-semibold text-slate-600 dark:text-slate-400 cursor-pointer"
                        >
                          {Math.abs(parseFloat(item.opening_balance as string || "0")).toLocaleString('en-IN')}
                        </td>
                        <td 
                          onClick={() => viewLocationStock(item)}
                          className="py-3.5 px-4 text-sm text-center font-bold cursor-pointer"
                        >
                          <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                            isLowStock 
                              ? "bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 border border-rose-100 dark:border-rose-900/50" 
                              : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50"
                          }`}>
                            {Math.abs(parseFloat(item.current_balance as string)).toLocaleString('en-IN')}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="inline-flex gap-1.5 justify-end">
                            <button
                              onClick={() => startEdit(item)}
                              className="p-1.5 hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-950/30 dark:hover:text-amber-400 rounded-lg text-slate-400 transition-colors"
                              title="Edit SKU"
                            >
                              <PencilSquareIcon className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeleteTarget(item)}
                              className="p-1.5 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30 dark:hover:text-rose-400 rounded-lg text-slate-400 transition-colors"
                              title="Delete SKU"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredItems.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-slate-400 text-xs py-8 text-center">
                        No SKUs found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Location Stock Details Modal */}
      {selectedStockItem && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all duration-300">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-xl w-full p-6 flex flex-col gap-4 relative animate-scale-up">
            <button
              onClick={() => setSelectedStockItem(null)}
              className="absolute top-4 right-4 p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 dark:text-slate-500 transition-colors"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>

            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 font-mono mb-1">
                SKU: {selectedStockItem.sku}
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white">
                {selectedStockItem.name}
              </h3>
              {selectedStockItem.description && (
                <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">
                  {selectedStockItem.description}
                </p>
              )}
            </div>

            <div className="border-t border-slate-100 dark:border-slate-800 my-1"></div>

            <h4 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Location wise stock breakdown
            </h4>

            {loadingStocks ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <div className="w-8 h-8 border-4 border-slate-200 dark:border-slate-800 border-t-blue-600 rounded-full animate-spin"></div>
                <span className="text-xs text-slate-400">Fetching stock levels...</span>
              </div>
            ) : (
              <div className="overflow-hidden border border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-950/20">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100/80 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                      <th className="py-2.5 px-4">Location</th>
                      <th className="py-2.5 px-4 text-center">Opening</th>
                      <th className="py-2.5 px-4 text-center">Inward (+)</th>
                      <th className="py-2.5 px-4 text-center">Outward (-)</th>
                      <th className="py-2.5 px-4 text-right">Available Qty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40 text-xs font-semibold">
                    {locationStocks.map((stock: any) => {
                      const currentVal = parseFloat(stock.current_qty || "0");
                      const reorderVal = parseFloat(selectedStockItem.reorder_level as string || "0");
                      const isLow = currentVal <= reorderVal;
                      return (
                        <tr key={stock.location_id} className="hover:bg-slate-100/30 dark:hover:bg-slate-900/30">
                          <td className="py-3 px-4 font-bold text-slate-800 dark:text-slate-200">
                            {stock.location_name}
                          </td>
                          <td className="py-3 px-4 text-center text-slate-500">
                            {Math.abs(parseFloat(stock.opening_qty || "0")).toLocaleString('en-IN')}
                          </td>
                          <td className="py-3 px-4 text-center text-emerald-600 dark:text-emerald-400">
                            {Math.abs(parseFloat(stock.total_in || "0")).toLocaleString('en-IN')}
                          </td>
                          <td className="py-3 px-4 text-center text-rose-600 dark:text-rose-400">
                            {Math.abs(parseFloat(stock.total_out || "0")).toLocaleString('en-IN')}
                          </td>
                          <td className={`py-3 px-4 text-right font-black ${isLow ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                            {Math.abs(currentVal).toLocaleString('en-IN')}
                          </td>
                        </tr>
                      );
                    })}
                    {locationStocks.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400 text-xs">
                          No stock activity found for this SKU in any location.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedStockItem(null)}
                className="px-6 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl transition-colors text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-md w-full p-6 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/40 flex items-center justify-center flex-shrink-0">
                <TrashIcon className="w-6 h-6 text-rose-600 dark:text-rose-400" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">Delete SKU?</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">This action cannot be undone.</p>
              </div>
            </div>
            <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 rounded-2xl p-4">
              <p className="text-sm text-slate-700 dark:text-slate-300">
                You are about to permanently delete SKU{" "}
                <span className="font-black font-mono text-rose-700 dark:text-rose-400">{deleteTarget.sku}</span>{" "}
                &mdash; <span className="font-semibold">{deleteTarget.name}</span>.
              </p>
            </div>
            <div className="flex gap-3 pt-1">
              <button
                onClick={handleDeleteItem}
                disabled={deleteSubmitting}
                className="flex-1 py-3 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl transition-colors text-sm disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {deleteSubmitting ? (
                  <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Deleting...</>
                ) : (
                  <><TrashIcon className="w-4 h-4" />Yes, Delete</>
                )}
              </button>
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleteSubmitting}
                className="flex-1 py-3 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl transition-colors text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active Transaction Block Modal */}
      {deleteBlockedMsg && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800 rounded-3xl shadow-2xl max-w-md w-full p-6 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center flex-shrink-0">
                <ExclamationTriangleIcon className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">Deletion Blocked</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">Active transactions detected</p>
              </div>
            </div>
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 rounded-2xl p-4">
              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{deleteBlockedMsg}</p>
            </div>
            <button
              onClick={() => setDeleteBlockedMsg("")}
              className="w-full py-3 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl transition-colors text-sm"
            >
              Understood
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
