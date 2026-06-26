"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { MagnifyingGlassIcon, CalendarIcon, MapPinIcon, PrinterIcon, ArrowDownTrayIcon } from "@heroicons/react/24/outline";

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

interface StatementLine {
  date: string;
  narration: string;
  inward: number;
  outward: number;
  balance: number;
}

export default function ItemStatementReportPage() {
  const { session } = useAuth();

  // Filter States
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  
  // Item Autocomplete Search States
  const [itemQuery, setItemQuery] = useState("");
  const [itemsList, setItemsList] = useState<Item[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  
  // Report Result States
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [openingBalance, setOpeningBalance] = useState<number>(0);
  const [closingBalance, setClosingBalance] = useState<number>(0);
  const [statement, setStatement] = useState<StatementLine[]>([]);
  const [searched, setSearched] = useState(false);

  const autocompleteRef = useRef<HTMLDivElement | null>(null);

  // Load Locations & Initial Items on Mount
  useEffect(() => {
    if (session?.orgcode) {
      fetchLocations();
      fetchInitialItems();
    }
  }, [session]);

  // Handle clicking outside autocomplete to close suggestions
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (autocompleteRef.current && !autocompleteRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchLocations = async () => {
    try {
      const res = await fetch(`/api/inventory/locations?orgcode=${session?.orgcode}`);
      const data = await res.json();
      if (data.success) {
        setLocations(data.locations || []);
      }
    } catch (e) {
      console.error("Failed to load locations", e);
    }
  };

  const fetchInitialItems = async () => {
    try {
      const res = await fetch(`/api/inventory/items?orgcode=${session?.orgcode}`);
      const data = await res.json();
      if (data.success) {
        setItemsList(data.items || []);
      }
    } catch (e) {
      console.error("Failed to load items", e);
    }
  };

  const handleSearchSuggestions = async (val: string) => {
    setItemQuery(val);
    if (!val.trim()) {
      setShowSuggestions(false);
      return;
    }
    setShowSuggestions(true);
  };

  const selectItem = (item: Item) => {
    setSelectedItem(item);
    setItemQuery(`${item.name} (SKU: ${item.sku})`);
    setShowSuggestions(false);
  };

  const filteredItems = itemsList.filter((item) =>
    item.name.toLowerCase().includes(itemQuery.toLowerCase()) ||
    String(item.sku).toLowerCase().includes(itemQuery.toLowerCase())
  );

  const generateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) {
      setErrorMsg("Please select an item from the registry list.");
      return;
    }
    
    setLoading(true);
    setErrorMsg("");
    setSearched(false);

    try {
      let url = `/api/inventory/reports/statement?orgcode=${session?.orgcode}&itemId=${selectedItem.id}`;
      if (selectedLocation !== "all") {
        url += `&locationId=${selectedLocation}`;
      }
      if (startDate) {
        url += `&startDate=${startDate}`;
      }
      if (endDate) {
        url += `&endDate=${endDate}`;
      }

      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setOpeningBalance(data.openingBalance);
        setClosingBalance(data.closingBalance);
        setStatement(data.statement || []);
        setSearched(true);
      } else {
        setErrorMsg(data.message || "Failed to generate report");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "An error occurred generating report");
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-col gap-6 pb-12 text-slate-800 dark:text-slate-100 max-w-6xl mx-auto print:p-0 print:pb-0">
      
      {/* Dynamic Print CSS override to satisfy user's criteria */}
      <style jsx global>{`
        @media print {
          /* Force white background and black text on all elements to prevent dark mode print issues */
          * {
            background: transparent !important;
            background-color: transparent !important;
            color: #000000 !important;
            box-shadow: none !important;
            text-shadow: none !important;
          }
          html, body {
            background-color: #ffffff !important;
            color: #000000 !important;
            font-family: "Segoe UI", Arial, sans-serif !important;
            font-size: 11px !important;
            margin: 15mm 10mm 15mm 10mm !important; /* Standard A4 margins */
            padding: 0 !important;
          }
          nav, aside, header, footer, button, .print\\:hidden, [class*="print:hidden"] {
            display: none !important;
          }
          .no-print {
            display: none !important;
          }
          .printable-batch-container {
            display: block !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          /* Condensed print layout to save paper */
          .print-item-block {
            margin-bottom: 25px !important;
          }
          .print-item-title {
            font-size: 15px !important;
            font-weight: bold !important;
            margin-bottom: 6px !important;
            border-bottom: 2px solid #000000 !important;
            padding-bottom: 4px !important;
          }
          .print-item-meta {
            font-size: 10px !important;
            margin-bottom: 12px !important;
            font-weight: 600 !important;
          }
          .print-table {
            width: 100% !important;
            border-collapse: collapse !important;
            font-size: 10px !important;
            line-height: 1.3 !important;
            border: 1px solid #000000 !important;
          }
          .print-table th {
            border: 1px solid #000000 !important;
            padding: 5px 8px !important;
            font-weight: bold !important;
            text-transform: uppercase !important;
          }
          .print-table td {
            border: 1px solid #000000 !important;
            padding: 5px 8px !important;
          }
          .print-table thead {
            display: table-header-group !important; /* Displays column header on each printed page */
          }
          .print-table tr {
            page-break-inside: avoid !important;
          }
        }
      `}</style>

      {/* Header Info */}
      <div className="flex justify-between items-start print:hidden">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-500 bg-clip-text text-transparent">
            Item Statement Ledger Report
          </h2>
          <p className="text-slate-500 text-sm mt-1 font-semibold">
            Track inward, outward, and running balance history for items in account statement format.
          </p>
        </div>
      </div>

      {/* Filter Options (Hidden on Print) */}
      <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 rounded-3xl p-6 shadow-sm print:hidden">
        <form onSubmit={generateReport} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          {/* Autocomplete Item Selector */}
          <div className="relative" ref={autocompleteRef}>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Select Item / SKU
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Search Item by SKU or Name..."
                value={itemQuery}
                onChange={(e) => handleSearchSuggestions(e.target.value)}
                onFocus={() => setShowSuggestions(true)}
                className="w-full pl-3 pr-8 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold text-sm"
              />
              <MagnifyingGlassIcon className="w-5 h-5 text-slate-400 absolute right-3 top-3 pointer-events-none" />
            </div>
            {showSuggestions && filteredItems.length > 0 && (
              <div className="absolute left-0 right-0 mt-2 bg-white dark:bg-slate-800 border border-slate-250 dark:border-slate-750 rounded-2xl shadow-xl max-h-60 overflow-y-auto z-40 divide-y divide-slate-100 dark:divide-slate-800">
                {filteredItems.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => selectItem(item)}
                    className="p-3 hover:bg-slate-50 dark:hover:bg-slate-900/50 cursor-pointer text-sm transition-colors"
                  >
                    <div className="font-bold text-slate-800 dark:text-slate-200">{item.name}</div>
                    <div className="text-xs text-slate-400 font-mono">SKU: {item.sku}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Location Selection */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1">
              <MapPinIcon className="w-3.5 h-3.5" /> Location Filter
            </label>
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold text-sm"
            >
              <option value="all">All Locations (Total Balance)</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1">
              <CalendarIcon className="w-3.5 h-3.5" /> Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold text-sm"
            />
          </div>

          {/* End Date & Generate Button */}
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1">
                <CalendarIcon className="w-3.5 h-3.5" /> End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors text-sm disabled:opacity-50 h-[46px] self-end flex-shrink-0"
            >
              {loading ? "Generating..." : "Generate"}
            </button>
          </div>
        </form>
      </div>

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 dark:bg-rose-950/30 dark:border-rose-900/50 dark:text-rose-400 rounded-xl text-sm font-semibold print:hidden">
          ⚠️ {errorMsg}
        </div>
      )}

      {/* Screen Report Output Content (Hidden on Print) */}
      {searched && (
        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 rounded-3xl p-6 shadow-sm flex flex-col gap-6 print:hidden">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-6">
            <div>
              <div className="text-[10px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400 font-mono">
                Item Statement
              </div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                {selectedItem?.name}
              </h3>
              <p className="text-slate-400 dark:text-slate-500 text-xs font-semibold mt-1">
                SKU: <span className="font-mono text-slate-800 dark:text-slate-200 font-bold">{selectedItem?.sku}</span>
                {selectedLocation !== "all" && (
                  <>
                    <span className="mx-2">|</span>
                    Location: <span className="font-bold text-slate-800 dark:text-slate-200">{locations.find(l => String(l.id) === selectedLocation)?.name}</span>
                  </>
                )}
                {startDate && (
                  <>
                    <span className="mx-2">|</span>
                    Period: <span className="font-bold text-slate-800 dark:text-slate-200">{startDate} to {endDate || "End of Year"}</span>
                  </>
                )}
              </p>
            </div>
            
            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              <button
                onClick={handlePrint}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors text-sm flex items-center gap-2"
              >
                <PrinterIcon className="w-4 h-4" /> Print / Export PDF
              </button>
            </div>
          </div>

          {/* Balance Cards Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 bg-slate-50 dark:bg-slate-900/30 rounded-2xl border border-slate-100 dark:border-slate-800">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Opening Balance</div>
              <div className="text-xl font-black text-slate-900 dark:text-white mt-1">
                {openingBalance.toLocaleString('en-IN')}
              </div>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-900/30 rounded-2xl border border-slate-100 dark:border-slate-800">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Inward</div>
              <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                {statement.reduce((sum, line) => sum + line.inward, 0).toLocaleString('en-IN')}
              </div>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-900/30 rounded-2xl border border-slate-100 dark:border-slate-800">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Outward</div>
              <div className="text-xl font-black text-rose-600 dark:text-rose-400 mt-1">
                {statement.reduce((sum, line) => sum + line.outward, 0).toLocaleString('en-IN')}
              </div>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-900/30 rounded-2xl border border-slate-150 dark:border-slate-800 bg-blue-50/20 dark:bg-blue-950/10">
              <div className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Closing Balance</div>
              <div className="text-xl font-black text-blue-650 dark:text-blue-400 mt-1">
                {closingBalance.toLocaleString('en-IN')}
              </div>
            </div>
          </div>

          {/* Statement Account Grid Table */}
          <div className="overflow-hidden border border-slate-200 dark:border-slate-800 rounded-3xl bg-white dark:bg-slate-900">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Narration</th>
                  <th className="py-3 px-4 text-center">Inward</th>
                  <th className="py-3 px-4 text-center">Outward</th>
                  <th className="py-3 px-4 text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40 text-sm font-semibold">
                
                {/* 1st Line: Opening Balance Line */}
                <tr className="bg-blue-50/10 dark:bg-blue-900/5 font-bold">
                  <td className="py-3.5 px-4 text-slate-500 font-mono">
                    {startDate || "FY Start"}
                  </td>
                  <td className="py-3.5 px-4 text-slate-800 dark:text-slate-200">
                    Opening Balance
                  </td>
                  <td className="py-3.5 px-4 text-center text-slate-400">-</td>
                  <td className="py-3.5 px-4 text-center text-slate-400">-</td>
                  <td className="py-3.5 px-4 text-right text-slate-900 dark:text-white">
                    {openingBalance.toLocaleString('en-IN')}
                  </td>
                </tr>

                {/* Ledger Movements */}
                {statement.map((line, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10 transition-colors">
                    <td className="py-3 px-4 text-slate-500 font-mono">
                      {new Date(line.date).toLocaleDateString('en-IN', {
                        year: 'numeric',
                        month: 'short',
                        day: '2-digit'
                      })}
                    </td>
                    <td className="py-3 px-4 text-slate-700 dark:text-slate-300 font-medium">
                      {line.narration}
                    </td>
                    <td className="py-3 px-4 text-center text-emerald-600 dark:text-emerald-400 font-bold">
                      {line.inward > 0 ? `+${line.inward.toLocaleString('en-IN')}` : "-"}
                    </td>
                    <td className="py-3 px-4 text-center text-rose-600 dark:text-rose-400 font-bold">
                      {line.outward > 0 ? `-${line.outward.toLocaleString('en-IN')}` : "-"}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-900 dark:text-white">
                      {line.balance.toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}

                {statement.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400 text-xs">
                      No transactions recorded within selected criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PRINT-ONLY AREA (Hidden on Screen, styled condensed on Print) */}
      {searched && (
        <div className="hidden printable-batch-container">
          <div className="print-item-block">
            <div className="print-item-title">
              Item Statement: {selectedItem?.name} (SKU: {selectedItem?.sku})
            </div>
            <div className="print-item-meta">
              Location: {selectedLocation === "all" ? "All Locations" : locations.find(l => String(l.id) === selectedLocation)?.name || "Unknown Location"} | Period: {startDate || "FY Start"} to {endDate || "FY End"} | Opening Balance: {openingBalance} | Closing Balance: {closingBalance}
            </div>
            <table className="print-table">
              <thead>
                <tr>
                  <th style={{ width: "80px", textAlign: "left" }}>Date</th>
                  <th style={{ textAlign: "left" }}>Narration</th>
                  <th style={{ width: "80px", textAlign: "center" }}>Inward</th>
                  <th style={{ width: "80px", textAlign: "center" }}>Outward</th>
                  <th style={{ width: "80px", textAlign: "right" }}>Balance</th>
                </tr>
              </thead>
              <tbody>
                {/* Opening Balance Row */}
                <tr style={{ fontWeight: "bold" }}>
                  <td>{startDate || "FY Start"}</td>
                  <td>Opening Balance</td>
                  <td style={{ textAlign: "center" }}>-</td>
                  <td style={{ textAlign: "center" }}>-</td>
                  <td style={{ textAlign: "right" }}>{openingBalance.toLocaleString('en-IN')}</td>
                </tr>
                {/* Movement rows */}
                {statement.map((line, lIdx) => (
                  <tr key={lIdx}>
                    <td>
                      {new Date(line.date).toLocaleDateString('en-IN', {
                        year: 'numeric',
                        month: 'short',
                        day: '2-digit'
                      })}
                    </td>
                    <td>{line.narration}</td>
                    <td style={{ textAlign: "center", color: "#16a34a" }}>
                      {line.inward > 0 ? `+${line.inward.toLocaleString('en-IN')}` : "-"}
                    </td>
                    <td style={{ textAlign: "center", color: "#dc2626" }}>
                      {line.outward > 0 ? `-${line.outward.toLocaleString('en-IN')}` : "-"}
                    </td>
                    <td style={{ textAlign: "right" }}>{line.balance.toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!searched && !loading && (
        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 rounded-3xl p-12 text-center text-slate-400 text-sm font-semibold flex flex-col items-center justify-center gap-2 print:hidden">
          <MagnifyingGlassIcon className="w-12 h-12 text-slate-300 dark:text-slate-700 mb-2" />
          <span>Please select an item SKU and click Generate to load the statement ledger report.</span>
        </div>
      )}
    </div>
  );
}
