"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/components/providers/AuthProvider";

interface FinancialYear {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  is_closed: boolean;
}

interface Location {
  id: number;
  name: string;
}

interface InventoryItem {
  sku: string;
  name: string;
}

interface StockItem {
  sku: string;
  item_name: string;
  location_id: number;
  location_name: string;
  opening_qty: number | string;
  total_in: number | string;
  total_out: number | string;
  current_qty: number | string;
}

interface Transaction {
  id: string;
  transaction_date: string;
  transaction_type: string;
  sku: string | number;
  qty: string;
  party_name?: string;
  reference_no?: string;
  remarks?: string;
  from_location_name?: string;
  to_location_name?: string;
  item_name?: string;
  from_location_id?: number;
  to_location_id?: number;
  transaction_type_name?: string;
  transaction_type_code?: string | number;
  stock_effect?: string;
}

export default function InventoryOverviewPage() {
  const { session } = useAuth();
  
  // Data State
  const [financialYears, setFinancialYears] = useState<FinancialYear[]>([]);
  const [selectedFyId, setSelectedFyId] = useState<string>("");
  const [locations, setLocations] = useState<Location[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [matrixSearch, setMatrixSearch] = useState("");
  const [selectedMatrixItem, setSelectedMatrixItem] = useState<InventoryItem | null>(null);
  const [matrixStockData, setMatrixStockData] = useState<StockItem[]>([]);
  const [matrixLoading, setMatrixLoading] = useState(false);
  const [showMatrixSuggestions, setShowMatrixSuggestions] = useState(false);

  // Report Filter State
  const [reportSku, setReportSku] = useState("");
  const [reportLoc, setReportLoc] = useState("");
  const [reportStartDate, setReportStartDate] = useState("");
  const [reportEndDate, setReportEndDate] = useState("");
  const [ledgerResults, setLedgerResults] = useState<Transaction[]>([]);
  const [showLedgerReport, setShowLedgerReport] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);

  const selectedFy = financialYears.find(f => f.id.toString() === selectedFyId);

  useEffect(() => {
    if (session?.orgcode) {
      fetchLocations();
      fetchItems();
      fetchInventoryData();
    }
  }, [session, selectedFyId]);

  const fetchLocations = async () => {
    if (!session?.orgcode) return;
    try {
      const res = await fetch(`/api/inventory/locations?orgcode=${session.orgcode}`);
      const data = await res.json();
      if (data.success) setLocations(data.locations);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchItems = async () => {
    if (!session?.orgcode) return;
    try {
      const res = await fetch(`/api/inventory/items?orgcode=${session.orgcode}`);
      const data = await res.json();
      if (data.success) setItems(data.items);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchInventoryData = async () => {
    if (!session?.orgcode) return;
    try {
      setLoading(true);
      setErrorMsg("");
      let url = `/api/inventory?orgcode=${session.orgcode}`;
      if (selectedFyId) {
        url += `&financialYearId=${selectedFyId}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setFinancialYears(data.financialYears);
        if (!selectedFyId) {
          setSelectedFyId(data.selectedFyId.toString());
        }
        setTransactions(data.transactions);
      } else {
        setErrorMsg(data.message || "Failed to load inventory");
      }
    } catch (e) {
      setErrorMsg("Failed to connect to server");
    } finally {
      setLoading(false);
    }
  };

  const fetchStockForSku = async (sku: string | number) => {
    if (!session?.orgcode) return;
    try {
      setMatrixLoading(true);
      let url = `/api/inventory?orgcode=${session.orgcode}&sku=${sku}`;
      if (selectedFyId) {
        url += `&financialYearId=${selectedFyId}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setMatrixStockData(data.stock || []);
      } else {
        alert(data.message || "Failed to load stock levels for the selected item");
      }
    } catch (e) {
      console.error(e);
      alert("Error connecting to server to load stock levels");
    } finally {
      setMatrixLoading(false);
    }
  };

  // Generate SKU Stock Ledger Report
  const generateLedgerReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportSku) {
      alert("Please select a SKU first");
      return;
    }
    setReportLoading(true);
    
    // Client-side filtering of loaded transactions for dynamic report builder
    let filtered = transactions.filter(t => String(t.sku) === String(reportSku));

    if (reportLoc) {
      const locId = parseInt(reportLoc, 10);
      filtered = filtered.filter(t => t.from_location_id === locId || t.to_location_id === locId);
    }

    if (reportStartDate) {
      filtered = filtered.filter(t => t.transaction_date >= reportStartDate);
    }

    if (reportEndDate) {
      filtered = filtered.filter(t => t.transaction_date <= reportEndDate);
    }

    // Sort ascending for chronological ledger sequence
    filtered.sort((a, b) => a.transaction_date.localeCompare(b.transaction_date) || parseInt(a.id) - parseInt(b.id));

    setLedgerResults(filtered);
    setShowLedgerReport(true);
    setReportLoading(false);
  };

  const formatTxnType = (type: string) => {
    switch (type) {
      case "vendor_to_location": return "Receive from Vendor";
      case "location_to_vendor": return "Return to Vendor";
      case "location_to_location": return "Transfer";
      case "location_to_customer": return "Issue to Customer";
      case "customer_to_location": return "Customer Return";
      default: return type;
    }
  };

  useEffect(() => {
    if (selectedMatrixItem && session?.orgcode) {
      fetchStockForSku(selectedMatrixItem.sku);
    }
  }, [selectedFyId]);

  const getMatrixSuggestions = () => {
    if (!matrixSearch.trim() || selectedMatrixItem) return [];
    return items.filter(item =>
      String(item.sku).toLowerCase().includes(matrixSearch.toLowerCase()) ||
      item.name.toLowerCase().includes(matrixSearch.toLowerCase())
    ).slice(0, 8);
  };

  const handleSelectMatrixItem = (item: InventoryItem) => {
    setSelectedMatrixItem(item);
    setMatrixSearch(`${item.name} (${item.sku})`);
    setShowMatrixSuggestions(false);
    fetchStockForSku(item.sku);
  };

  return (
    <div className="flex flex-col gap-6 pb-12 text-slate-800 dark:text-slate-100">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-500 bg-clip-text text-transparent">
            Inventory Stock &amp; Reports
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            Real-time multi-location stocks status and ledger records.
          </p>
        </div>

        {/* FY Selector */}
        <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2 rounded-xl shadow-sm">
          <label className="text-xs font-bold uppercase text-slate-400">FY:</label>
          <select
            value={selectedFyId}
            onChange={(e) => setSelectedFyId(e.target.value)}
            className="bg-transparent font-semibold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
          >
            {financialYears.map((fy) => (
              <option key={fy.id} value={fy.id.toString()} className="bg-white dark:bg-slate-800">
                {fy.name} {fy.is_closed ? "(Closed)" : "(Active)"}
              </option>
            ))}
          </select>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 dark:bg-rose-950/30 dark:border-rose-900/50 dark:text-rose-400 rounded-xl text-sm font-semibold">
          ⚠️ {errorMsg}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <div className="w-10 h-10 border-4 border-slate-200 dark:border-slate-800 border-t-blue-600 rounded-full animate-spin"></div>
          <p className="text-slate-400 text-sm animate-pulse">Loading stock database...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {/* Main Balances */}
          <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 rounded-3xl p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-5 border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <span>📊</span> Stock Levels Matrix
              </h3>
              <div className="relative w-full sm:w-80">
                <input
                  type="text"
                  placeholder="Search item name or SKU..."
                  value={matrixSearch}
                  onChange={(e) => {
                    setMatrixSearch(e.target.value);
                    setSelectedMatrixItem(null);
                    setMatrixStockData([]);
                    setShowMatrixSuggestions(e.target.value.trim().length > 0);
                  }}
                  onFocus={() => {
                    setShowMatrixSuggestions(matrixSearch.trim().length > 0);
                  }}
                  onBlur={() => {
                    // Slight delay to allow clicks on suggestion list
                    setTimeout(() => setShowMatrixSuggestions(false), 200);
                  }}
                  className="w-full pl-9 pr-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs font-semibold"
                />
                <svg className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>

                {/* Suggestions list */}
                {showMatrixSuggestions && getMatrixSuggestions().length > 0 && (
                  <ul className="absolute left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto text-xs">
                    {getMatrixSuggestions().map((item) => (
                      <li
                        key={item.sku}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleSelectMatrixItem(item);
                        }}
                        className="px-3 py-2.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer border-b border-slate-100 dark:border-slate-700/60 last:border-0 flex justify-between items-center text-slate-800 dark:text-slate-200"
                      >
                        <div className="flex flex-col text-left">
                          <span className="font-bold">{item.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">SKU: {item.sku}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {matrixLoading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <div className="w-6 h-6 border-2 border-slate-200 dark:border-slate-800 border-t-blue-600 rounded-full animate-spin"></div>
                <p className="text-slate-400 text-xs">Loading stock levels...</p>
              </div>
            ) : !selectedMatrixItem ? (
              <p className="text-slate-400 text-sm text-center py-12">Search and select an item above to retrieve and view its multi-location stock matrix levels.</p>
            ) : matrixStockData.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-12">No stock records found for the selected item.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-450 font-bold uppercase tracking-wider text-xs">
                      <th className="py-3 px-4">SKU / Item</th>
                      <th className="py-3 px-4">Location</th>
                      <th className="py-3 px-4 text-right">Opening</th>
                      <th className="py-3 px-4 text-right">Receipts (+)</th>
                      <th className="py-3 px-4 text-right">Issues (-)</th>
                      <th className="py-3 px-4 text-right font-black text-blue-600 dark:text-blue-400">Current Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matrixStockData.map((item, idx) => (
                      <tr
                        key={item.location_id}
                        className="border-b border-slate-100 dark:border-slate-800/80 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors text-xs"
                      >
                        {idx === 0 && (
                          <td className="py-4 px-4 font-bold align-middle" rowSpan={matrixStockData.length}>
                            <div>{selectedMatrixItem.name}</div>
                            <div className="text-xs font-mono text-slate-400">{selectedMatrixItem.sku}</div>
                          </td>
                        )}
                        <td className="py-4 px-4 font-medium text-slate-600 dark:text-slate-350">
                          {item.location_name}
                        </td>
                        <td className="py-4 px-4 text-right font-mono">
                          {parseFloat(item.opening_qty as string).toLocaleString()}
                        </td>
                        <td className="py-4 px-4 text-right font-mono text-emerald-600 dark:text-emerald-400">
                          +{parseFloat(item.total_in as string).toLocaleString()}
                        </td>
                        <td className="py-4 px-4 text-right font-mono text-rose-600 dark:text-rose-400">
                          -{parseFloat(item.total_out as string).toLocaleString()}
                        </td>
                        <td className="py-4 px-4 text-right font-mono font-bold text-blue-600 dark:text-blue-400">
                          {parseFloat(item.current_qty as string).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Ledger Movement Report Form */}
          <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 rounded-3xl p-6 shadow-sm">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-blue-600 dark:text-blue-400">
              <span>📈</span> Generate SKU Stock Ledger Report
            </h3>

            <form onSubmit={generateLedgerReport} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 items-end mb-6">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase text-slate-400">Select Item</label>
                <select
                  value={reportSku}
                  onChange={(e) => setReportSku(e.target.value)}
                  className="p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select SKU...</option>
                  {items.map(i => (
                    <option key={i.sku} value={i.sku}>{i.name} ({i.sku})</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase text-slate-400">Select Location</label>
                <select
                  value={reportLoc}
                  onChange={(e) => setReportLoc(e.target.value)}
                  className="p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Locations</option>
                  {locations.map(l => (
                    <option key={l.id} value={l.id.toString()}>{l.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase text-slate-400">From Date</label>
                <input
                  type="date"
                  value={reportStartDate}
                  onChange={(e) => setReportStartDate(e.target.value)}
                  className="p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-semibold text-sm focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase text-slate-400">To Date</label>
                <input
                  type="date"
                  value={reportEndDate}
                  onChange={(e) => setReportEndDate(e.target.value)}
                  className="p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-semibold text-sm focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={reportLoading || !reportSku}
                className="py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl text-sm transition-all shadow-md disabled:opacity-50"
              >
                {reportLoading ? "Building..." : "Build Ledger"}
              </button>
            </form>

            {showLedgerReport && (
              <div className="mt-6 border-t border-slate-200 dark:border-slate-700 pt-6 animate-fade-in">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-bold text-base text-slate-850 dark:text-slate-200">
                    Ledger: <span className="text-blue-600 dark:text-blue-400 font-extrabold">{reportSku}</span>
                    {reportLoc && ` @ ${locations.find(l => l.id.toString() === reportLoc)?.name}`}
                  </h4>
                  <span className="text-xs text-slate-500 font-mono">Found {ledgerResults.length} transaction entries</span>
                </div>

                {ledgerResults.length === 0 ? (
                  <p className="text-slate-400 text-sm text-center py-8">No matching transaction logs inside the selected scope.</p>
                ) : (
                  <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/20">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          <th className="py-3 px-4">Date</th>
                          <th className="py-3 px-4">Transaction Type</th>
                          <th className="py-3 px-4">Stock Effect</th>
                          <th className="py-3 px-4 text-right">Qty</th>
                          <th className="py-3 px-4">From Location</th>
                          <th className="py-3 px-4">To Location</th>
                          <th className="py-3 px-4">Party</th>
                          <th className="py-3 px-4">Ref/Slip No</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ledgerResults.map((t) => {
                          const isInc = t.stock_effect === "INWARD";
                          const isDec = t.stock_effect === "OUTWARD";
                          return (
                            <tr key={t.id} className="border-b border-slate-100 dark:border-slate-800/80 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                              <td className="py-3.5 px-4 font-mono text-xs whitespace-nowrap text-slate-600 dark:text-slate-400">
                                {new Date(t.transaction_date).toLocaleDateString("en-IN")}
                              </td>
                              <td className="py-3.5 px-4 font-bold text-xs text-slate-800 dark:text-slate-250">
                                {t.transaction_type_name || t.transaction_type_code || "Unknown"}
                              </td>
                              <td className="py-3.5 px-4">
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold ${
                                  isInc 
                                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-450 border border-emerald-100/50" 
                                    : isDec 
                                      ? "bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-455 border border-rose-100/50" 
                                      : "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-450 border border-blue-100/50"
                                }`}>
                                  {t.stock_effect || "INWARD"}
                                </span>
                              </td>
                              <td className={`py-3.5 px-4 text-right font-mono font-bold text-xs ${
                                isInc 
                                  ? "text-emerald-600 dark:text-emerald-400" 
                                  : isDec 
                                    ? "text-rose-600 dark:text-rose-400" 
                                    : "text-slate-600 dark:text-slate-350"
                              }`}>
                                {isInc ? "+" : isDec ? "-" : ""}{parseFloat(t.qty).toLocaleString()}
                              </td>
                              <td className="py-3.5 px-4 text-xs text-slate-600 dark:text-slate-400 font-medium">{t.from_location_name || "-"}</td>
                              <td className="py-3.5 px-4 text-xs text-slate-600 dark:text-slate-400 font-medium">{t.to_location_name || "-"}</td>
                              <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 font-semibold">{t.party_name || "-"}</td>
                              <td className="py-3.5 px-4 font-mono text-xs text-slate-500 dark:text-slate-500">{t.reference_no || "-"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
