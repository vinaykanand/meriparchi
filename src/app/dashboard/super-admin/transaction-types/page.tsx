"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { PlusIcon, PencilSquareIcon, MagnifyingGlassIcon, XMarkIcon, TrashIcon, LockClosedIcon } from "@heroicons/react/24/outline";

interface TransactionType {
  code: string | number;
  name: string;
  stock_effect: string;
  from_type: string;
  to_type: string;
  orgcode?: string;
}

export default function SuperAdminTransactionTypesPage() {
  const { session } = useAuth();

  const [types, setTypes] = useState<TransactionType[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newStockEffect, setNewStockEffect] = useState("INWARD");
  const [newFromType, setNewFromType] = useState("vendor");
  const [newToType, setNewToType] = useState("location");
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Edit states
  const [editingType, setEditingType] = useState<TransactionType | null>(null);
  const [editName, setEditName] = useState("");
  const [editStockEffect, setEditStockEffect] = useState("INWARD");
  const [editFromType, setEditFromType] = useState("vendor");
  const [editToType, setEditToType] = useState("location");
  const [editSubmitting, setEditSubmitting] = useState(false);

  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    if (session?.orgcode) {
      fetchTypes();
    }
  }, [session]);

  const fetchTypes = async () => {
    setLoading(true);
    if (!session?.orgcode) return;
    try {
      const res = await fetch(`/api/inventory/transaction-types?orgcode=${session.orgcode}`);
      const data = await res.json();
      if (data.success) {
        setTypes(data.transactionTypes);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !session?.orgcode) return;
    try {
      setSubmitting(true);
      setErrorMsg("");
      setSuccessMsg("");
      const res = await fetch("/api/inventory/transaction-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgcode: session.orgcode,
          name: newName.trim(),
          stock_effect: newStockEffect,
          from_type: newFromType,
          to_type: newToType,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`Transaction Type "${newName}" created successfully!`);
        setNewCode("");
        setNewName("");
        setNewStockEffect("INWARD");
        setNewFromType("vendor");
        setNewToType("location");
        fetchTypes();
      } else {
        setErrorMsg(data.message || "Failed to create transaction type");
      }
    } catch (e) {
      setErrorMsg("Error creating transaction type");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingType || !editName.trim() || !session?.orgcode) return;
    try {
      setEditSubmitting(true);
      setErrorMsg("");
      setSuccessMsg("");
      const res = await fetch("/api/inventory/transaction-types", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgcode: session.orgcode,
          code: editingType.code,
          name: editName.trim(),
          stock_effect: editStockEffect,
          from_type: editFromType,
          to_type: editToType,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`Transaction Type "${editingType.code}" updated successfully!`);
        setEditingType(null);
        setEditName("");
        fetchTypes();
      } else {
        setErrorMsg(data.message || "Failed to update transaction type");
      }
    } catch (e) {
      setErrorMsg("Error updating transaction type");
    } finally {
      setEditSubmitting(false);
    }
  };

  const startEdit = (type: TransactionType) => {
    setEditingType(type);
    setEditName(type.name);
    setEditStockEffect(type.stock_effect);
    setEditFromType(type.from_type);
    setEditToType(type.to_type);
    setErrorMsg("");
    setSuccessMsg("");
  };

  const cancelEdit = () => {
    setEditingType(null);
    setEditName("");
  };

  const handleDeleteType = async (code: string | number) => {
    if (!confirm("Are you sure you want to delete this transaction type?")) return;
    if (!session?.orgcode) return;
    try {
      setErrorMsg("");
      setSuccessMsg("");
      const res = await fetch(`/api/inventory/transaction-types?orgcode=${session.orgcode}&code=${code}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`Transaction type "${code}" deleted successfully!`);
        fetchTypes();
      } else {
        setErrorMsg(data.message || "Failed to delete transaction type");
      }
    } catch (e) {
      setErrorMsg("Error deleting transaction type");
    }
  };

  const filteredTypes = types.filter((type) =>
    type.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    String(type.code).toLowerCase().includes(searchQuery.toLowerCase()) ||
    type.stock_effect.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderListView = () => (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h3 className="text-lg font-bold">Global Transaction Type Registry</h3>
        <div className="relative w-full sm:w-72">
          <MagnifyingGlassIcon className="w-5 h-5 text-slate-400 absolute left-3.5 top-3.5" />
          <input type="text" placeholder="Search types..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold text-sm" />
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-10 h-10 border-4 border-slate-200 dark:border-slate-800 border-t-blue-600 rounded-full animate-spin"></div>
          <p className="text-slate-400 text-sm">Loading types...</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800/60 text-slate-400 text-xs font-bold uppercase tracking-wider">
                <th className="py-3 px-4">Code</th>
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4 text-center">Effect</th>
                <th className="py-3 px-4 text-center">Routing</th>
                {session?.orgcode === 'SUPER' && <th className="py-3 px-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40">
              {filteredTypes.map((t) => {
                const isGlobal = t.orgcode === "SUPER";
                const canManage = !isGlobal || session?.orgcode === "SUPER";
                return (
                  <tr key={t.code} className="hover:bg-slate-50/40 dark:hover:bg-slate-900/10 transition-colors">
                    <td className="py-3.5 px-4 text-sm font-mono font-bold text-blue-600 dark:text-blue-400">{t.code}</td>
                    <td className="py-3.5 px-4 text-sm font-semibold">
                      <div className="flex items-center gap-2">
                        <span>{t.name}</span>
                        {isGlobal && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50 uppercase tracking-wider">
                            Global
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-sm text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                        t.stock_effect === "INWARD"
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50"
                          : t.stock_effect === "OUTWARD"
                            ? "bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 border border-rose-100 dark:border-rose-900/50"
                            : "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-100 dark:border-blue-900/50"
                      }`}>
                        {t.stock_effect}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-center font-mono font-semibold text-slate-500">
                      {t.from_type.toUpperCase()} → {t.to_type.toUpperCase()}
                    </td>
                    {session?.orgcode === 'SUPER' && (
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {canManage ? (
                            <>
                              <button onClick={() => startEdit(t)} className="p-1.5 hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-950/30 dark:hover:text-amber-400 rounded-lg text-slate-400 transition-colors inline-flex items-center gap-1.5 text-xs font-bold">
                                <PencilSquareIcon className="w-4 h-4" /> Edit
                              </button>
                              <button onClick={() => handleDeleteType(t.code)} className="p-1.5 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30 dark:hover:text-rose-400 rounded-lg text-slate-400 transition-colors inline-flex items-center gap-1.5 text-xs font-bold">
                                <TrashIcon className="w-4 h-4" /> Delete
                              </button>
                            </>
                          ) : (
                            <span className="p-1.5 text-slate-400 dark:text-slate-500 inline-flex items-center gap-1.5 text-xs font-semibold">
                              <LockClosedIcon className="w-4 h-4 text-slate-400" /> Locked
                            </span>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
              {filteredTypes.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-slate-400 text-xs py-8 text-center">No transaction types defined.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );

  return (
    <div className="flex flex-col gap-6 pb-12 text-slate-800 dark:text-slate-100 max-w-6xl mx-auto">
      <div>
        <h2 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-500 bg-clip-text text-transparent">
          Global Transaction Types
        </h2>
        <p className="text-slate-500 text-sm mt-1 font-semibold">
          Manage system-wide transaction types, specify their stock behavior (Inward, Outward, Transfer), and routing rules.
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

      {session?.orgcode === 'SUPER' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form Card */}
          <div className="lg:col-span-1">
            {editingType ? (
              <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-3xl p-6 shadow-sm sticky top-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold flex items-center gap-2 text-amber-600 dark:text-amber-400">
                    <PencilSquareIcon className="w-5 h-5" /> {editingType.orgcode === 'SUPER' ? "Edit Global Type" : "Edit Transaction Type"}
                  </h3>
                  <button onClick={cancelEdit} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400">
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>

                {editingType.orgcode === 'SUPER' && (
                  <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-400 border border-amber-200/50 dark:border-amber-900/50 rounded-xl text-xs font-semibold">
                    ⚠️ This is a Global transaction type. Modifying it will affect all organizations using this default type.
                  </div>
                )}

                <form onSubmit={handleUpdateType} className="flex flex-col gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Code</label>
                    <input type="text" disabled value={editingType.code} className="w-full p-3 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-mono text-sm text-slate-400 cursor-not-allowed" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Name</label>
                    <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Stock Effect</label>
                    <select value={editStockEffect} onChange={(e) => setEditStockEffect(e.target.value)} className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold text-sm">
                      <option value="INWARD">Inward (+ Stock)</option>
                      <option value="OUTWARD">Outward (- Stock)</option>
                      <option value="TRANSFER">Transfer (Neutral)</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">From Type</label>
                      <select value={editFromType} onChange={(e) => setEditFromType(e.target.value)} className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold text-sm">
                        <option value="vendor">Vendor</option>
                        <option value="location">Location</option>
                        <option value="customer">Customer</option>
                        <option value="none">None</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">To Type</label>
                      <select value={editToType} onChange={(e) => setEditToType(e.target.value)} className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold text-sm">
                        <option value="vendor">Vendor</option>
                        <option value="location">Location</option>
                        <option value="customer">Customer</option>
                        <option value="none">None</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button type="submit" disabled={editSubmitting || !editName.trim()} className="flex-1 p-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl transition-colors text-sm">
                      {editSubmitting ? "Saving..." : "Save Changes"}
                    </button>
                    <button type="button" onClick={cancelEdit} className="px-4 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl transition-colors text-sm">
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 rounded-3xl p-6 shadow-sm sticky top-6">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <PlusIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" /> Create Global Type
                </h3>
                <div className="mb-4 p-3 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50 rounded-xl text-xs font-semibold">
                  ℹ️ You are logged in as SUPER. Newly created transaction types will be global and accessible by all companies.
                </div>

                <form onSubmit={handleAddType} className="flex flex-col gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Name</label>
                    <input type="text" placeholder="e.g. Warehouse Transfer" value={newName} onChange={(e) => setNewName(e.target.value)} className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Stock Effect</label>
                    <select value={newStockEffect} onChange={(e) => setNewStockEffect(e.target.value)} className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold text-sm">
                      <option value="INWARD">Inward (+ Stock)</option>
                      <option value="OUTWARD">Outward (- Stock)</option>
                      <option value="TRANSFER">Transfer (Neutral)</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">From Type</label>
                      <select value={newFromType} onChange={(e) => setNewFromType(e.target.value)} className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold text-sm">
                        <option value="vendor">Vendor</option>
                        <option value="location">Location</option>
                        <option value="customer">Customer</option>
                        <option value="none">None</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">To Type</label>
                      <select value={newToType} onChange={(e) => setNewToType(e.target.value)} className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold text-sm">
                        <option value="vendor">Vendor</option>
                        <option value="location">Location</option>
                        <option value="customer">Customer</option>
                        <option value="none">None</option>
                      </select>
                    </div>
                  </div>

                  <button type="submit" disabled={submitting || !newName.trim()} className="w-full p-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors text-sm disabled:opacity-50">
                    {submitting ? "Adding..." : "Add Transaction Type"}
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* List View */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 rounded-3xl p-6 shadow-sm flex flex-col gap-4">
            {renderListView()}
          </div>
        </div>
      ) : (
        <div className="w-full bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 rounded-3xl p-6 shadow-sm flex flex-col gap-4">
          {renderListView()}
        </div>
      )}
    </div>
  );
}
