"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { SkuInputWithPicker } from "@/components/inventory/SkuPicker";
import {
  MagnifyingGlassIcon,
  MapPinIcon,
  PrinterIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  CubeIcon,
} from "@heroicons/react/24/outline";

interface Location {
  id: number;
  name: string;
}

interface Item {
  id: number;
  sku: number;
  name: string;
  description?: string;
}

interface StockRow {
  item_id: number;
  sku: number;
  item_name: string;
  description?: string;
  reorder_level: number;
  location_id: number | null;
  location_name: string;
  opening_qty: number;
  total_in: number;
  total_out: number;
  current_qty: number;
}

interface Summary {
  totalItems: number;
  belowReorder: number;
  totalStock: number;
}

export default function StockInHandReportPage() {
  const { session } = useAuth();

  const [locations, setLocations] = useState<Location[]>([]);
  const [allItems, setAllItems] = useState<Item[]>([]);

  // Filters
  const [selectedLocation, setSelectedLocation] = useState<string>("all");
  const [itemSearch, setItemSearch] = useState<string>("");
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [showItemSuggestions, setShowItemSuggestions] = useState(false);
  const [stockBalances, setStockBalances] = useState<any[]>([]);

  // Report state
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<StockRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [financialYear, setFinancialYear] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [hasLoaded, setHasLoaded] = useState(false);

  // Client-side search filter on the result table
  const [tableSearch, setTableSearch] = useState<string>("");

  // Load master data on mount
  useEffect(() => {
    if (session?.orgcode) {
      fetchLocations();
      fetchItems();
      fetchStockBalances();
      // Auto-load on mount with no filters
      fetchReport("all", null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const fetchLocations = async () => {
    try {
      const res = await fetch(`/api/inventory/locations?orgcode=${session?.orgcode}`);
      const data = await res.json();
      if (data.success) setLocations(data.locations || []);
    } catch (e) { console.error(e); }
  };

  const fetchItems = async () => {
    try {
      const res = await fetch(`/api/inventory/items?orgcode=${session?.orgcode}`);
      const data = await res.json();
      if (data.success) setAllItems(data.items || []);
    } catch (e) { console.error(e); }
  };

  const fetchStockBalances = async () => {
    try {
      const res = await fetch(`/api/inventory?orgcode=${session?.orgcode}`);
      const data = await res.json();
      if (data.success) setStockBalances(data.stock || []);
    } catch (e) { console.error(e); }
  };

  const fetchReport = useCallback(async (locationVal: string, item: Item | null) => {
    if (!session?.orgcode) return;
    setLoading(true);
    setErrorMsg("");
    try {
      let url = `/api/inventory/reports/stock-in-hand?orgcode=${session.orgcode}`;
      if (locationVal !== "all") url += `&locationId=${locationVal}`;
      if (item) url += `&itemId=${item.id}`;

      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setRows(data.rows || []);
        setSummary(data.summary || null);
        setFinancialYear(data.financialYear || "");
        setHasLoaded(true);
      } else {
        setErrorMsg(data.message || "Failed to load report");
      }
    } catch (e: any) {
      setErrorMsg(e.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [session?.orgcode]);

  // Re-fetch when filters change
  const handleApplyFilters = () => {
    fetchReport(selectedLocation, selectedItem);
  };

  // Item autocomplete helpers
  const filteredSuggestions = allItems.filter(
    (i) =>
      i.name.toLowerCase().includes(itemSearch.toLowerCase()) ||
      String(i.sku).includes(itemSearch)
  );

  const handleSelectItem = (item: Item) => {
    setSelectedItem(item);
    setItemSearch(`${item.name} (SKU: ${item.sku})`);
    setShowItemSuggestions(false);
  };

  const handleClearItem = () => {
    setSelectedItem(null);
    setItemSearch("");
  };

  // Table-level search filter (client-side)
  const displayedRows = rows.filter(
    (r) =>
      r.item_name.toLowerCase().includes(tableSearch.toLowerCase()) ||
      String(r.sku).includes(tableSearch) ||
      r.location_name.toLowerCase().includes(tableSearch.toLowerCase())
  );

  const handlePrint = () => window.print();

  const isLow = (r: StockRow) => r.current_qty <= r.reorder_level;

  return (
    <div className="flex flex-col gap-6 pb-12 text-slate-800 dark:text-slate-100 max-w-6xl mx-auto print:p-0 print:pb-0">

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          * { background: transparent !important; background-color: transparent !important; color: #000 !important; box-shadow: none !important; }
          html, body { background-color: #fff !important; color: #000 !important; font-family: Arial, sans-serif !important; font-size: 11px !important; margin: 15mm 10mm !important; padding: 0 !important; }
          nav, aside, header, footer, button, .no-print { display: none !important; }
          .print-area { display: block !important; }
          .print-table { width: 100% !important; border-collapse: collapse !important; font-size: 10px !important; }
          .print-table th, .print-table td { border: 1px solid #000 !important; padding: 4px 7px !important; }
          .print-table thead { display: table-header-group !important; }
          .print-table tr { page-break-inside: avoid !important; }
        }
      `}</style>

      {/* Page Header */}
      <div className="flex justify-between items-start no-print">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-500 bg-clip-text text-transparent">
            Stock in Hand Report
          </h2>
          <p className="text-slate-500 text-sm mt-1 font-semibold">
            View current stock balances, opening quantities, movements, and reorder levels across all SKUs.
          </p>
        </div>
        {financialYear && (
          <span className="text-xs font-bold bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border border-blue-100 dark:border-blue-900/50 px-3 py-1.5 rounded-full">
            {financialYear}
          </span>
        )}
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 rounded-3xl p-5 shadow-sm no-print">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">

          {/* Location Filter */}
          <div>
            <label className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              <MapPinIcon className="w-3.5 h-3.5" /> Location
            </label>
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold text-sm"
            >
              <option value="all">All Locations (Total)</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </select>
          </div>

          {/* Item Autocomplete */}
          <div>
            <label className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              <CubeIcon className="w-3.5 h-3.5" /> Item / SKU
            </label>
            <SkuInputWithPicker
              value={itemSearch}
              onChange={(val) => {
                setItemSearch(val);
                if (!val.trim()) setSelectedItem(null);
              }}
              onPick={(item) => {
                setSelectedItem(item as any);
                setItemSearch(`${item.name} (SKU: ${item.sku})`);
              }}
              items={allItems as any}
              stockBalances={stockBalances}
              fromLocationId={selectedLocation !== "all" ? selectedLocation : null}
              fromLocationName={locations.find(l => String(l.id) === selectedLocation)?.name}
              placeholder="Search item SKU or Name..."
              inputClassName="py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm"
            />
          </div>

          {/* Apply Button */}
          <div className="flex gap-2">
            <button
              onClick={handleApplyFilters}
              disabled={loading}
              className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors text-sm disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Generating...</>
              ) : (
                <><ArrowPathIcon className="w-4 h-4" />Apply Filters</>
              )}
            </button>
            <button
              onClick={handlePrint}
              className="px-4 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl transition-colors text-sm flex items-center gap-2"
              title="Print / Export PDF"
            >
              <PrinterIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Error */}
      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 dark:bg-rose-950/30 dark:border-rose-900/50 dark:text-rose-400 rounded-xl text-sm font-semibold no-print">
          ⚠️ {errorMsg}
        </div>
      )}

      {/* Summary Cards */}
      {hasLoaded && summary && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 no-print">
          <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-5 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center flex-shrink-0">
              <CubeIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total SKUs</div>
              <div className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">
                {summary.totalItems.toLocaleString("en-IN")}
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-5 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-rose-50 dark:bg-rose-950/30 flex items-center justify-center flex-shrink-0">
              <ExclamationTriangleIcon className="w-6 h-6 text-rose-600 dark:text-rose-400" />
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Below Reorder</div>
              <div className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-0.5">
                {summary.belowReorder.toLocaleString("en-IN")}
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-5 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" /></svg>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Stock (Qty)</div>
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                {summary.totalStock.toLocaleString("en-IN")}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Report Table */}
      {hasLoaded && (
        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 rounded-3xl shadow-sm overflow-hidden flex flex-col">

          {/* Table Header with inline search */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 border-b border-slate-100 dark:border-slate-800 no-print">
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Stock in Hand
                {selectedItem && <span className="text-blue-600 dark:text-blue-400"> — {selectedItem.name}</span>}
                {selectedLocation !== "all" && (
                  <span className="text-indigo-600 dark:text-indigo-400">
                    {" "}@ {locations.find((l) => String(l.id) === selectedLocation)?.name}
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400 font-semibold mt-0.5">
                {displayedRows.length} row(s) · FY: {financialYear}
              </p>
            </div>
            <div className="relative w-full sm:w-64">
              <MagnifyingGlassIcon className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
              <input
                type="text"
                placeholder="Search in results..."
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold text-sm"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-10 h-10 border-4 border-slate-200 dark:border-slate-800 border-t-blue-600 rounded-full animate-spin" />
              <p className="text-slate-400 text-sm font-semibold">Loading stock data...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse print-table">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                    <th className="py-3 px-4">SKU</th>
                    <th className="py-3 px-4">Item Name</th>
                    <th className="py-3 px-4">Location</th>
                    <th className="py-3 px-4 text-center">Opening Qty</th>
                    <th className="py-3 px-4 text-center text-emerald-600 dark:text-emerald-400">Total In (+)</th>
                    <th className="py-3 px-4 text-center text-rose-600 dark:text-rose-400">Total Out (-)</th>
                    <th className="py-3 px-4 text-center">Reorder Level</th>
                    <th className="py-3 px-4 text-right">Stock in Hand</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40 text-sm">
                  {displayedRows.map((r, idx) => {
                    const low = isLow(r);
                    return (
                      <tr
                        key={`${r.item_id}-${r.location_id ?? "all"}-${idx}`}
                        className={`transition-colors ${
                          low
                            ? "bg-rose-50/30 dark:bg-rose-950/10 hover:bg-rose-50/60 dark:hover:bg-rose-950/20"
                            : "hover:bg-slate-50/40 dark:hover:bg-slate-900/10"
                        }`}
                      >
                        <td className="py-3.5 px-4 font-mono font-bold text-blue-600 dark:text-blue-400 text-xs">
                          {r.sku}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-800 dark:text-slate-200">{r.item_name}</div>
                          {r.description && (
                            <div className="text-xs text-slate-400 font-medium mt-0.5">{r.description}</div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-sm font-semibold text-slate-500 dark:text-slate-400">
                          <span className="inline-flex items-center gap-1">
                            <MapPinIcon className="w-3 h-3 opacity-60" />
                            {r.location_name}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center font-semibold text-slate-600 dark:text-slate-400">
                          {Math.abs(r.opening_qty).toLocaleString("en-IN")}
                        </td>
                        <td className="py-3.5 px-4 text-center font-bold text-emerald-600 dark:text-emerald-400">
                          {r.total_in > 0 ? r.total_in.toLocaleString("en-IN") : "—"}
                        </td>
                        <td className="py-3.5 px-4 text-center font-bold text-rose-600 dark:text-rose-400">
                          {r.total_out > 0 ? r.total_out.toLocaleString("en-IN") : "—"}
                        </td>
                        <td className="py-3.5 px-4 text-center text-slate-500 font-semibold">
                          {r.reorder_level.toLocaleString("en-IN")}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <span
                            className={`inline-block px-2.5 py-1 rounded-full text-xs font-black ${
                              low
                                ? "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50"
                                : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50"
                            }`}
                          >
                            {low && "⚠ "}
                            {Math.abs(r.current_qty).toLocaleString("en-IN")}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {displayedRows.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400 text-sm">
                        No stock data found for the selected filters.
                      </td>
                    </tr>
                  )}
                </tbody>
                {/* Totals footer */}
                {displayedRows.length > 0 && (
                  <tfoot>
                    <tr className="bg-slate-100 dark:bg-slate-800/60 font-black text-sm border-t-2 border-slate-200 dark:border-slate-700">
                      <td colSpan={3} className="py-3 px-4 text-slate-600 dark:text-slate-400 uppercase text-xs tracking-wider">
                        Totals ({displayedRows.length} rows)
                      </td>
                      <td className="py-3 px-4 text-center text-slate-700 dark:text-slate-300">
                        {Math.abs(displayedRows.reduce((s, r) => s + r.opening_qty, 0)).toLocaleString("en-IN")}
                      </td>
                      <td className="py-3 px-4 text-center text-emerald-700 dark:text-emerald-400">
                        {displayedRows.reduce((s, r) => s + r.total_in, 0).toLocaleString("en-IN")}
                      </td>
                      <td className="py-3 px-4 text-center text-rose-700 dark:text-rose-400">
                        {displayedRows.reduce((s, r) => s + r.total_out, 0).toLocaleString("en-IN")}
                      </td>
                      <td className="py-3 px-4 text-center" />
                      <td className="py-3 px-4 text-right text-slate-900 dark:text-white">
                        {Math.abs(displayedRows.reduce((s, r) => s + r.current_qty, 0)).toLocaleString("en-IN")}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </div>
      )}

      {/* Print-only area */}
      {hasLoaded && (
        <div className="hidden print-area">
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 16, fontWeight: "bold", borderBottom: "2px solid #000", paddingBottom: 4, marginBottom: 6 }}>
              Stock in Hand Report — {financialYear}
            </div>
            <div style={{ fontSize: 10, fontWeight: 600, marginBottom: 10 }}>
              Location: {selectedLocation === "all" ? "All Locations" : locations.find((l) => String(l.id) === selectedLocation)?.name || "—"}
              {selectedItem ? ` | Item: ${selectedItem.name} (SKU: ${selectedItem.sku})` : " | All Items"}
              {" | "}Printed on: {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
            </div>
          </div>
          <table className="print-table">
            <thead>
              <tr>
                <th style={{ textAlign: "left", width: 50 }}>SKU</th>
                <th style={{ textAlign: "left" }}>Item</th>
                <th style={{ textAlign: "left" }}>Location</th>
                <th style={{ textAlign: "center", width: 70 }}>Opening</th>
                <th style={{ textAlign: "center", width: 70 }}>Total In (+)</th>
                <th style={{ textAlign: "center", width: 70 }}>Total Out (-)</th>
                <th style={{ textAlign: "center", width: 70 }}>Reorder</th>
                <th style={{ textAlign: "right", width: 80 }}>Stock in Hand</th>
              </tr>
            </thead>
            <tbody>
              {displayedRows.map((r, idx) => (
                <tr key={idx} style={isLow(r) ? { fontWeight: "bold" } : {}}>
                  <td>{r.sku}</td>
                  <td>{r.item_name}</td>
                  <td>{r.location_name}</td>
                  <td style={{ textAlign: "center" }}>{Math.abs(r.opening_qty).toLocaleString("en-IN")}</td>
                  <td style={{ textAlign: "center" }}>{r.total_in > 0 ? r.total_in.toLocaleString("en-IN") : "—"}</td>
                  <td style={{ textAlign: "center" }}>{r.total_out > 0 ? r.total_out.toLocaleString("en-IN") : "—"}</td>
                  <td style={{ textAlign: "center" }}>{r.reorder_level.toLocaleString("en-IN")}</td>
                  <td style={{ textAlign: "right", fontWeight: "bold" }}>
                    {isLow(r) ? "⚠ " : ""}{Math.abs(r.current_qty).toLocaleString("en-IN")}
                  </td>
                </tr>
              ))}
              <tr style={{ fontWeight: "bold", borderTop: "2px solid #000" }}>
                <td colSpan={3}>Totals ({displayedRows.length} rows)</td>
                <td style={{ textAlign: "center" }}>{Math.abs(displayedRows.reduce((s, r) => s + r.opening_qty, 0)).toLocaleString("en-IN")}</td>
                <td style={{ textAlign: "center" }}>{displayedRows.reduce((s, r) => s + r.total_in, 0).toLocaleString("en-IN")}</td>
                <td style={{ textAlign: "center" }}>{displayedRows.reduce((s, r) => s + r.total_out, 0).toLocaleString("en-IN")}</td>
                <td />
                <td style={{ textAlign: "right" }}>{Math.abs(displayedRows.reduce((s, r) => s + r.current_qty, 0)).toLocaleString("en-IN")}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
