"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";

interface Toast {
  id: number;
  message: string;
  type: "success" | "error" | "info";
}

interface LookupData {
  customer: { name: string, phone: string, address: string };
  kpis: {
    outstanding: number;
    slipsCount: number;
    paymentsTotal: number;
    paymentsCount: number;
    returnsAmount: number;
    returnsCount: number;
  };
  availableDates: string[];
  slips: any[];
  payments: any[];
}

export default function AdminLookupPage() {
  const { session } = useAuth();

  const [lookupPhone, setLookupPhone] = useState("");
  const [searchedLookupPhone, setSearchedLookupPhone] = useState("");
  const [showReturnsOnly, setShowReturnsOnly] = useState(false);
  const [loadingLookupLedger, setLoadingLookupLedger] = useState(false);
  const [hasLookupSearched, setHasLookupSearched] = useState(false);
  
  const [lookupData, setLookupData] = useState<LookupData | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");

  const [closingAccount, setClosingAccount] = useState(false);

  const [searchSuggestions, setSearchSuggestions] = useState<{phone: string, name: string, address: string}[]>([]);
  const [showLookupSuggestions, setShowLookupSuggestions] = useState(false);

  const [loadingRecent, setLoadingRecent] = useState(false);
  const [recentAccounts, setRecentAccounts] = useState<any[]>([]);
  const [recentSlips, setRecentSlips] = useState<any[]>([]);
  const [recentPayments, setRecentPayments] = useState<any[]>([]);
  const [recentReturns, setRecentReturns] = useState<any[]>([]);

  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (message: string, type: "success" | "error" | "info") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  };

  const fetchRecentData = async (orgcode: string) => {
    setLoadingRecent(true);
    try {
      const res = await fetch(`/api/ledger?orgcode=${orgcode}&recent=true`);
      const data = await res.json();
      if (res.ok && data.success) {
        setRecentAccounts(data.recentAccounts || []);
        setRecentSlips(data.recentSlips || []);
        setRecentPayments(data.recentPayments || []);
        setRecentReturns(data.recentReturns || []);
      }
    } catch (e) {
      console.error("Failed to load recent data");
    } finally {
      setLoadingRecent(false);
    }
  };

  useEffect(() => {
    if (session && !hasLookupSearched) {
      fetchRecentData(session.orgcode);
    }
  }, [session, hasLookupSearched]);

  useEffect(() => {
    if (!lookupPhone.trim()) {
      setSearchSuggestions([]);
      return;
    }
    const fetchSugg = async () => {
      if (!session) return;
      try {
        const response = await fetch(`/api/ledger?orgcode=${session.orgcode}&search=${lookupPhone.trim()}`);
        const data = await response.json();
        if (response.ok && data.success && Array.isArray(data.accounts)) {
          setSearchSuggestions(data.accounts.map((s: any) => ({
            phone: s.phone,
            name: s.name,
            address: s.address
          })));
        } else {
          setSearchSuggestions([]);
        }
      } catch (e) {
        setSearchSuggestions([]);
      }
    };
    const timeout = setTimeout(fetchSugg, 300);
    return () => clearTimeout(timeout);
  }, [lookupPhone, session]);

  const handleSelectLookupSuggestion = (phone: string, name: string, address: string) => {
    setLookupPhone(phone);
    setShowLookupSuggestions(false);
    executeLookup(phone, "");
  };

  const handleLookupSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookupPhone.trim()) {
      addToast("Please enter a phone number to search", "info");
      return;
    }
    executeLookup(lookupPhone, "");
  };

  const executeLookup = async (phone: string, date: string) => {
    if (!session) return;
    setLoadingLookupLedger(true);
    try {
      let url = `/api/ledger?orgcode=${session.orgcode}&phone=${phone.trim()}`;
      if (date) url += `&date=${date}`;
      
      const response = await fetch(url);
      const data = await response.json();
      if (response.ok && data.success) {
        setLookupData(data);
        setSearchedLookupPhone(phone.trim());
        setHasLookupSearched(true);
        setSelectedDate(date);
      } else {
        addToast(data.message || "Failed to retrieve ledger", "error");
      }
    } catch (error) {
      addToast("Failed to search ledger", "error");
    } finally {
      setLoadingLookupLedger(false);
    }
  };

  const handleDateFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newDate = e.target.value;
    executeLookup(searchedLookupPhone, newDate);
  };

  const handleCloseAccount = async () => {
    if (!session || !searchedLookupPhone) return;
    
    const pwd = prompt(`DANGER: You are about to permanently close the account for ${searchedLookupPhone}.\n\nPlease enter your admin password to confirm this irreversible action:`);
    if (!pwd) return;

    setClosingAccount(true);
    try {
      const response = await fetch(
        `/api/ledger?orgcode=${session.orgcode}&phone=${searchedLookupPhone}`,
        { 
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: pwd })
        }
      );
      const data = await response.json();
      if (response.ok && data.success) {
        addToast(`Account closed. Deleted ${data.deleted_slips} slips and ${data.deleted_payments} payments.`, "success");
        setHasLookupSearched(false);
        setLookupPhone("");
        setSearchedLookupPhone("");
        fetchRecentData(session.orgcode);
      } else {
        addToast(data.message || "Failed to close account", "error");
      }
    } catch (e) {
      addToast("An error occurred while closing account", "error");
    } finally {
      setClosingAccount(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in relative">
      <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Look Up Ledger Account</h2>
      <p className="text-slate-500 text-sm mt-1 mb-4">Retrieve customer account statements, view invoice lists, and manage accounts.</p>

      {/* Search Panel */}
      <div className="bg-white/80 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm backdrop-blur-xl" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={handleLookupSearch} className="flex gap-3">
          <div className="relative flex-grow flex items-center">
            <span className="absolute left-4 text-slate-400">🔍</span>
            <input 
              type="text" 
              className="w-full pl-10 pr-4 py-3 text-sm border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900/50 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500 transition-all" 
              placeholder="Enter Client Phone Number, Name, or Address" 
              value={lookupPhone} 
              onChange={(e) => {
                setLookupPhone(e.target.value);
                setShowLookupSuggestions(true);
              }}
              onFocus={() => setShowLookupSuggestions(true)}
            />
            {showLookupSuggestions && searchSuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 max-h-60 overflow-y-auto z-50 py-2">
                {searchSuggestions.map((item, idx) => (
                  <div 
                    key={idx} 
                    className="px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer border-b border-slate-100 dark:border-slate-800 last:border-0 transition-colors"
                    onClick={() => handleSelectLookupSuggestion(item.phone, item.name, item.address)}
                  >
                    <div className="font-semibold text-slate-800 dark:text-slate-200">{item.name || "Unnamed Customer"}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-3">
                      <span className="flex items-center gap-1">📞 {item.phone}</span>
                      {item.address && <span className="flex items-center gap-1">📍 {item.address}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button 
            type="submit" 
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 rounded-xl shadow-[0_4px_10px_rgba(37,99,235,0.2)] disabled:opacity-50 transition-colors"
            disabled={loadingLookupLedger}
          >
            {loadingLookupLedger ? "Searching..." : "Retrieve Statement"}
          </button>
        </form>
      </div>

      {/* Recent activity when no search is performed yet */}
      {!hasLookupSearched && (
        <div className="flex flex-col gap-6 mt-6 animate-fade-in">
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Quick Lookup & Recent Transactions</h3>
          {loadingRecent ? (
            <div className="flex flex-col items-center justify-center p-12 gap-3 text-slate-500">
              <div className="w-8 h-8 border-4 border-slate-200 dark:border-slate-800 border-t-blue-500 rounded-full animate-spin"></div>
              <p>Loading recent activity...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Column 1: Recently Active Clients */}
              <div className="bg-white/80 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm">
                <h4 className="text-sm font-semibold border-b border-slate-200 dark:border-slate-700 pb-2">Recently Active Clients</h4>
                <div className="flex flex-col gap-2 mt-2 max-h-[400px] overflow-y-auto pr-1">
                  {recentAccounts.map((acc, idx) => (
                    <div 
                      key={idx} 
                      onClick={() => handleSelectLookupSuggestion(acc.phone, acc.name, acc.address)}
                      className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-black/20 hover:bg-blue-500/5 dark:hover:bg-white/5 cursor-pointer transition-all flex flex-col gap-1"
                    >
                      <div className="font-semibold text-sm text-slate-900 dark:text-slate-100">{acc.name || "Unnamed Client"}</div>
                      <div className="text-xs text-slate-500 flex justify-between">
                        <span>📞 {acc.phone}</span>
                        <span>{acc.address ? `📍 ${acc.address}` : ""}</span>
                      </div>
                    </div>
                  ))}
                  {recentAccounts.length === 0 && (
                    <div className="text-center py-6 text-xs text-slate-500">No active accounts found.</div>
                  )}
                </div>
              </div>

              {/* Column 2: Recently Generated Slips */}
              <div className="bg-white/80 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm lg:col-span-2">
                <h4 className="text-sm font-semibold border-b border-slate-200 dark:border-slate-700 pb-2">Recently Generated Slips</h4>
                <div className="w-full overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-black/20 mt-3">
                  <table className="w-full text-left text-sm min-w-[500px]">
                    <thead className="bg-slate-50/50 dark:bg-white/5 text-slate-500 dark:text-slate-400 text-xs uppercase font-medium">
                      <tr>
                        <th className="px-3 py-2">Slip No</th>
                        <th className="px-3 py-2">Date</th>
                        <th className="px-3 py-2">Client</th>
                        <th className="px-3 py-2">Phone</th>
                        <th className="px-3 py-2">Subtotal</th>
                        <th className="px-3 py-2">Net Amt</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                      {recentSlips.map((slip, idx) => (
                        <tr 
                          key={idx} 
                          onClick={() => {
                            handleSelectLookupSuggestion(slip.phone, slip.name, "");
                          }}
                          className="hover:bg-blue-500/5 dark:hover:bg-white/5 cursor-pointer transition-colors"
                        >
                          <td className="px-3 py-2 font-semibold">#{slip.slipno}</td>
                          <td className="px-3 py-2 text-xs text-slate-500">{new Date(slip.date).toLocaleDateString()}</td>
                          <td className="px-3 py-2">{slip.name || "—"}</td>
                          <td className="px-3 py-2 text-xs font-mono">{slip.phone}</td>
                          <td className="px-3 py-2 text-slate-500">₹{slip.totalamount}</td>
                          <td className="px-3 py-2 font-semibold text-blue-600 dark:text-blue-400">₹{slip.netamount}</td>
                        </tr>
                      ))}
                      {recentSlips.length === 0 && (
                        <tr>
                          <td colSpan={6} className="text-center py-8 text-xs text-slate-500">No transaction slips logged yet.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Column 3: Recently Logged Payments */}
              <div className="bg-white/80 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm lg:col-span-3">
                <h4 className="text-sm font-semibold border-b border-slate-200 dark:border-slate-700 pb-2">Recent Credit Payments</h4>
                <div className="w-full overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-black/20 mt-3">
                  <table className="w-full text-left text-sm min-w-[500px]">
                    <thead className="bg-slate-50/50 dark:bg-white/5 text-slate-500 dark:text-slate-400 text-xs uppercase font-medium">
                      <tr>
                        <th className="px-3 py-2">Txn Date</th>
                        <th className="px-3 py-2">Customer Phone</th>
                        <th className="px-3 py-2">Payment Amount</th>
                        <th className="px-3 py-2">Narration</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                      {recentPayments.map((pay, idx) => (
                        <tr 
                          key={idx}
                          onClick={() => {
                            handleSelectLookupSuggestion(pay.phone.toString(), "", "");
                          }}
                          className="hover:bg-blue-500/5 dark:hover:bg-white/5 cursor-pointer transition-colors"
                        >
                          <td className="px-3 py-2 text-xs text-slate-500">{new Date(pay.date).toLocaleDateString()}</td>
                          <td className="px-3 py-2 font-mono text-xs">{pay.phone}</td>
                          <td className="px-3 py-2 font-semibold text-green-600 dark:text-green-400">₹{pay.amount}</td>
                          <td className="px-3 py-2 text-xs text-slate-500">{pay.narration || "—"}</td>
                        </tr>
                      ))}
                      {recentPayments.length === 0 && (
                        <tr>
                          <td colSpan={4} className="text-center py-6 text-xs text-slate-500">No payment logs found.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Column 4: Recent Return Items */}
              <div className="bg-white/80 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm lg:col-span-3">
                <h4 className="text-sm font-semibold border-b border-slate-200 dark:border-slate-700 pb-2 text-red-600 dark:text-red-400">Recent Return Items</h4>
                <div className="w-full overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-black/20 mt-3">
                  <table className="w-full text-left text-sm min-w-[500px]">
                    <thead className="bg-slate-50/50 dark:bg-white/5 text-slate-500 dark:text-slate-400 text-xs uppercase font-medium">
                      <tr>
                        <th className="px-3 py-2">Date</th>
                        <th className="px-3 py-2">Customer</th>
                        <th className="px-3 py-2">Item Name</th>
                        <th className="px-3 py-2">Qty</th>
                        <th className="px-3 py-2">Rate</th>
                        <th className="px-3 py-2">Credit Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                      {recentReturns.map((ret, idx) => (
                        <tr 
                          key={idx}
                          onClick={() => {
                            handleSelectLookupSuggestion(ret.phone, ret.name, "");
                          }}
                          className="hover:bg-blue-500/5 dark:hover:bg-white/5 cursor-pointer transition-colors"
                        >
                          <td className="px-3 py-2 text-xs text-slate-500">{new Date(ret.date).toLocaleDateString()}</td>
                          <td className="px-3 py-2">
                            <div className="font-medium">{ret.name || "—"}</div>
                            <div className="text-xs font-mono text-slate-500">{ret.phone}</div>
                          </td>
                          <td className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-300">{ret.item}</td>
                          <td className="px-3 py-2 text-red-600 dark:text-red-400 font-medium">{ret.qty}</td>
                          <td className="px-3 py-2">₹{ret.rate}</td>
                          <td className="px-3 py-2 font-semibold text-green-600 dark:text-green-400">₹{Math.abs(ret.amount)}</td>
                        </tr>
                      ))}
                      {recentReturns.length === 0 && (
                        <tr>
                          <td colSpan={6} className="text-center py-6 text-xs text-slate-500">No recent return items found.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}
        </div>
      )}

      {/* Statement details view */}
      {hasLookupSearched && (
        <div className="flex flex-col gap-6 animate-fade-in">
          <div className="flex flex-col md:flex-row md:items-center gap-4 w-full">
            <div className="flex items-center gap-3 w-full md:w-auto">
              <button 
                type="button"
                onClick={() => {
                  setHasLookupSearched(false);
                  setLookupPhone("");
                  setSearchedLookupPhone("");
                  setLookupData(null);
                  setSelectedDate("");
                  setShowReturnsOnly(false);
                }}
                className="flex items-center justify-center shrink-0 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors text-sm font-semibold bg-white/80 dark:bg-slate-800/80 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm backdrop-blur-xl"
              >
                ← Back
              </button>
              <h3 className="text-lg md:text-xl font-bold text-slate-900 dark:text-slate-100 flex-1 truncate">
                {lookupData?.customer?.name || searchedLookupPhone}
              </h3>
            </div>
            
            {lookupData && (
              <div className="flex gap-2 w-full md:w-auto md:ml-auto">
                <a href={`/dashboard/admin/slips?phone=${searchedLookupPhone}`} className="flex-1 md:flex-none text-center px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm shadow-blue-500/20">
                  + Create Slip
                </a>
                <a href={`/dashboard/admin/payments?phone=${searchedLookupPhone}`} className="flex-1 md:flex-none text-center px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors shadow-sm shadow-green-500/20">
                  ₹ Log Payment
                </a>
              </div>
            )}
          </div>

          {loadingLookupLedger ? (
            <div className="flex flex-col items-center justify-center p-12 gap-3 text-slate-500">
              <div className="w-8 h-8 border-4 border-slate-200 dark:border-slate-800 border-t-blue-500 rounded-full animate-spin"></div>
              <p>Fetching statement data...</p>
            </div>
          ) : lookupData ? (
            <>
              {/* KPIs Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white/80 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Total Outstanding</div>
                  <div className={`text-2xl font-bold ${lookupData.kpis.outstanding > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                    ₹{lookupData.kpis.outstanding.toLocaleString()}
                  </div>
                </div>
                <div className="bg-white/80 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Total Slips</div>
                  <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">₹{lookupData.kpis.slipsTotal.toLocaleString()}</div>
                  <div className="text-xs text-slate-400 mt-1">{lookupData.kpis.slipsCount} slips generated</div>
                </div>
                <div className="bg-white/80 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Total Payments</div>
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">₹{lookupData.kpis.paymentsTotal.toLocaleString()}</div>
                  <div className="text-xs text-slate-400 mt-1">{lookupData.kpis.paymentsCount} payments made</div>
                </div>
                <div className="bg-white/80 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Total Returns</div>
                  <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">₹{lookupData.kpis.returnsAmount.toLocaleString()}</div>
                  <div className="text-xs text-slate-400 mt-1">{lookupData.kpis.returnsCount} items returned</div>
                </div>
              </div>

              {/* Date & Returns Filter Dropdown */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 bg-white/50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <span className="font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">Overview for:</span>
                  <select 
                    className="flex-1 sm:flex-none w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                    value={selectedDate}
                    onChange={handleDateFilterChange}
                  >
                    <option value="">All Time History</option>
                    {lookupData.availableDates.filter((d: any) => d).map((d: any) => {
                      const [y, m, day] = d.split('-');
                      const displayDate = new Date(Number(y), Number(m)-1, Number(day)).toLocaleDateString();
                      return <option key={d} value={d}>{displayDate}</option>;
                    })}
                  </select>
                </div>
                
                <label className="flex items-center gap-2 cursor-pointer w-full sm:w-auto sm:ml-auto bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 px-4 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  <input 
                    type="checkbox" 
                    checked={showReturnsOnly}
                    onChange={(e) => setShowReturnsOnly(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="font-semibold text-slate-700 dark:text-slate-300 text-sm">Return Orders Only</span>
                </label>
              </div>

              {/* SLIPS TABLE */}
              <div className="bg-white/80 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm overflow-hidden">
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4 border-b border-slate-200 dark:border-slate-700 pb-2">SLIPS</h3>
                <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold uppercase tracking-wider text-xs">
                      <tr>
                        <th className="px-4 py-3">Time</th>
                        <th className="px-4 py-3">No</th>
                        <th className="px-4 py-3">Item</th>
                        <th className="px-4 py-3 text-right">Qty</th>
                        <th className="px-4 py-3 text-right">Rate</th>
                        <th className="px-4 py-3 text-right">Amt</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-slate-900">
                      {(() => {
                        let displaySlips = lookupData.slips;
                        if (showReturnsOnly) {
                          displaySlips = displaySlips.filter((s: any) => parseFloat(s.qty) < 0);
                        }

                        const slipTotals: Record<string, number> = {};
                        displaySlips.forEach((s: any) => {
                          slipTotals[s.no] = (slipTotals[s.no] || 0) + (parseFloat(s.amt) || 0);
                        });

                        return displaySlips.map((s: any, i: number) => {
                          const isFirst = i === 0 || displaySlips[i - 1].no !== s.no;
                          const isLast = i === displaySlips.length - 1 || displaySlips[i + 1].no !== s.no;
                          
                          return (
                            <React.Fragment key={i}>
                              <tr 
                                className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${isFirst && i !== 0 ? 'border-t-2 border-slate-200 dark:border-slate-700' : ''}`}
                              >
                            <td className="px-4 py-3 text-slate-500">
                              {isFirst ? new Date(s.time).toLocaleDateString() : ""}
                            </td>
                            <td className="px-4 py-3 font-semibold text-blue-600 dark:text-blue-400">
                              {isFirst ? `#${s.no}` : ""}
                            </td>
                            <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{s.item}</td>
                            <td className={`px-4 py-3 font-semibold text-right ${parseFloat(s.qty) < 0 ? 'text-red-500' : 'text-slate-700 dark:text-slate-300'}`}>{s.qty}</td>
                            <td className="px-4 py-3 text-slate-500 text-right">₹{s.rate}</td>
                            <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100 text-right">₹{s.amt}</td>
                          </tr>
                          {isLast && (
                            <tr className="bg-slate-50 dark:bg-slate-800/30 group">
                              <td colSpan={5} className="px-4 py-2.5 text-right">
                                <div className="flex items-center justify-end gap-4">
                                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <a target="_blank" rel="noopener noreferrer" href={`/print/slip?phone=${searchedLookupPhone}&slipno=${s.no}&orgcode=${session.orgcode}&format=compact`} className="px-2 py-1 text-xs font-bold bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded transition-colors shadow-sm flex items-center gap-1">🖨️ Thermal</a>
                                    <a target="_blank" rel="noopener noreferrer" href={`/print/slip?phone=${searchedLookupPhone}&slipno=${s.no}&orgcode=${session.orgcode}&format=a4`} className="px-2 py-1 text-xs font-bold bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded transition-colors shadow-sm flex items-center gap-1">📄 A4</a>
                                  </div>
                                  <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                                    Slip #{s.no} Total
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-2.5 font-bold text-slate-900 dark:text-slate-100 border-t border-slate-200 dark:border-slate-700 text-right">
                                ₹{slipTotals[s.no].toFixed(2)}
                              </td>
                            </tr>
                          )}
                            </React.Fragment>
                          );
                        });
                      })()}
                      {(!lookupData.slips || lookupData.slips.length === 0) && (
                        <tr>
                          <td colSpan={6} className="text-center py-6 text-slate-500">No slip items found for this selection.</td>
                        </tr>
                      )}
                      {lookupData.slips && lookupData.slips.length > 0 && showReturnsOnly && !lookupData.slips.some((s: any) => parseFloat(s.qty) < 0) && (
                        <tr>
                          <td colSpan={6} className="text-center py-6 text-slate-500">No return orders found for this selection.</td>
                        </tr>
                      )}
                      {lookupData.slips && lookupData.slips.length > 0 && (
                        <tr className="bg-slate-100 dark:bg-slate-800 font-bold border-t-2 border-slate-300 dark:border-slate-600">
                          <td colSpan={5} className="px-4 py-4 text-right text-sm text-slate-700 dark:text-slate-300 uppercase tracking-widest">
                            Grand Total (Slips)
                          </td>
                          <td className="px-4 py-4 text-right text-lg text-slate-900 dark:text-slate-100">
                            ₹{(() => {
                              let displaySlips = lookupData.slips;
                              if (showReturnsOnly) {
                                displaySlips = displaySlips.filter((s: any) => parseFloat(s.qty) < 0);
                              }
                              const grandTotal = displaySlips.reduce((acc: number, s: any) => acc + (parseFloat(s.amt) || 0), 0);
                              return grandTotal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
                            })()}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* PAYMENTS TABLE */}
              <div className="bg-white/80 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm overflow-hidden mt-2">
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4 border-b border-slate-200 dark:border-slate-700 pb-2">PAYMENTS</h3>
                <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold uppercase tracking-wider text-xs">
                      <tr>
                        <th className="px-4 py-3">Time</th>
                        <th className="px-4 py-3">Narration</th>
                        <th className="px-4 py-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700 bg-white dark:bg-slate-900">
                      {lookupData.payments.map((p, i) => (
                        <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="px-4 py-3 text-slate-500">{new Date(p.time).toLocaleDateString()}</td>
                          <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{p.narration || "—"}</td>
                          <td className="px-4 py-3 font-bold text-green-600 dark:text-green-400 text-right">₹{p.amt}</td>
                        </tr>
                      ))}
                      {lookupData.payments.length === 0 && (
                        <tr>
                          <td colSpan={3} className="text-center py-6 text-slate-500">No payments found for this selection.</td>
                        </tr>
                      )}
                      {lookupData.payments && lookupData.payments.length > 0 && (
                        <tr className="bg-slate-100 dark:bg-slate-800 font-bold border-t-2 border-slate-300 dark:border-slate-600">
                          <td colSpan={2} className="px-4 py-4 text-right text-sm text-slate-700 dark:text-slate-300 uppercase tracking-widest">
                            Grand Total (Payments)
                          </td>
                          <td className="px-4 py-4 text-right text-lg text-green-600 dark:text-green-400">
                            ₹{(() => {
                              const grandTotal = lookupData.payments.reduce((acc: number, p: any) => acc + (parseFloat(p.amt) || 0), 0);
                              return grandTotal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
                            })()}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Danger Zone: Close Account */}
              <div className="bg-red-500/5 border border-red-500/20 dark:border-red-500/10 rounded-2xl p-4 sm:p-6 shadow-sm mt-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="flex-1">
                    <h4 className="text-base font-semibold text-red-600 dark:text-red-400">Danger Zone: Close Ledger Account</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Closing this account will permanently delete all transaction history, slips, and payments associated with this phone number. This action is irreversible.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCloseAccount}
                    disabled={closingAccount}
                    className="w-full sm:w-auto px-4 py-2.5 text-sm font-semibold rounded-xl text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 shadow-[0_4px_12px_rgba(220,38,38,0.2)] transition-all whitespace-nowrap"
                  >
                    {closingAccount ? "Closing Account..." : "Close Account"}
                  </button>
                </div>
              </div>

            </>
          ) : null}
        </div>
      )}

      {/* Toasts */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((toast) => (
          <div key={toast.id} className={`px-4 py-3 rounded shadow-lg text-white text-sm font-medium animate-slide-up ${toast.type === 'error' ? 'bg-red-500' : toast.type === 'success' ? 'bg-green-500' : 'bg-blue-500'}`}>
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
}
