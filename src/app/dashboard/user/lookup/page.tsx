"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";

interface Toast {
  id: number;
  message: string;
  type: "success" | "error" | "info";
}

interface LedgerSummaryRow {
  txn_date: string;
  totalamount: string;
  netamount: string;
  paymentmade: string;
}

interface SlipDetailItem {
  slipno: string;
  slip_date: string;
  item: string;
  remarks: string;
  qty: string;
  rate: string;
  itemamount: string;
  totalamount: string;
  netamount: string;
}

export default function UserLookupPage() {
  const { session } = useAuth();

  const [lookupPhone, setLookupPhone] = useState("");
  const [searchedLookupPhone, setSearchedLookupPhone] = useState("");
  const [loadingLookupLedger, setLoadingLookupLedger] = useState(false);
  const [lookupLedgerSummary, setLookupLedgerSummary] = useState<LedgerSummaryRow[]>([]);
  const [hasLookupSearched, setHasLookupSearched] = useState(false);
  const [lookupDetailDate, setLookupDetailDate] = useState<string | null>(null);
  const [loadingLookupDetails, setLoadingLookupDetails] = useState(false);
  const [lookupSlipDetails, setLookupSlipDetails] = useState<SlipDetailItem[]>([]);

  const [searchSuggestions, setSearchSuggestions] = useState<{phone: string, name: string, address: string}[]>([]);
  const [showLookupSuggestions, setShowLookupSuggestions] = useState(false);

  const [loadingRecent, setLoadingRecent] = useState(false);
  const [recentAccounts, setRecentAccounts] = useState<any[]>([]);
  const [recentSlips, setRecentSlips] = useState<any[]>([]);
  const [recentPayments, setRecentPayments] = useState<any[]>([]);

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
        if (response.ok && data.success && Array.isArray(data.summary)) {
          setSearchSuggestions(data.summary.map((s: any) => ({
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
    executeLookup(phone);
  };

  const handleLookupSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookupPhone.trim()) {
      addToast("Please enter a phone number to search", "info");
      return;
    }
    executeLookup(lookupPhone);
  };

  const executeLookup = async (phone: string) => {
    if (!session) return;
    setLoadingLookupLedger(true);
    try {
      const response = await fetch(`/api/ledger?orgcode=${session.orgcode}&phone=${phone.trim()}`);
      const data = await response.json();
      if (response.ok && data.success) {
        setLookupLedgerSummary(data.summary || []);
        setSearchedLookupPhone(phone.trim());
        setHasLookupSearched(true);
        setLookupDetailDate(null);
        setLookupSlipDetails([]);
      } else {
        addToast(data.message || "Failed to retrieve ledger", "error");
      }
    } catch (error) {
      addToast("Failed to search ledger", "error");
    } finally {
      setLoadingLookupLedger(false);
    }
  };

  const loadLookupSlipDetails = async (date: string) => {
    if (!session || !searchedLookupPhone) return;
    setLoadingLookupDetails(true);
    setLookupDetailDate(date);
    try {
      const dateObj = new Date(date);
      const formattedDate = dateObj.toISOString().split('T')[0];
      const response = await fetch(
        `/api/ledger?orgcode=${session.orgcode}&phone=${searchedLookupPhone}&date=${formattedDate}`
      );
      const data = await response.json();
      if (response.ok && data.success) {
        setLookupSlipDetails(data.details || []);
      } else {
        addToast("Failed to load slip details", "error");
        setLookupSlipDetails([]);
      }
    } catch (e) {
      addToast("Error fetching details", "error");
      setLookupSlipDetails([]);
    } finally {
      setLoadingLookupDetails(false);
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
                            setSearchedLookupPhone(slip.phone);
                            loadLookupSlipDetails(slip.date);
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

            </div>
          )}
        </div>
      )}

      {/* Statement details view */}
      {hasLookupSearched && (
        <div className="flex flex-col gap-6 animate-fade-in">
          {loadingLookupLedger ? (
            <div className="flex flex-col items-center justify-center p-12 gap-3 text-slate-500">
              <div className="w-8 h-8 border-4 border-slate-200 dark:border-slate-800 border-t-blue-500 rounded-full animate-spin"></div>
              <p>Fetching statement data...</p>
            </div>
          ) : (
            <>
              {/* Account Metrics Grid */}
              {(() => {
                let slipSum = 0;
                let paySum = 0;
                lookupLedgerSummary.forEach((row) => {
                  slipSum += parseFloat(row.netamount) || 0;
                  paySum += parseFloat(row.paymentmade) || 0;
                });
                const outstanding = Math.max(0, slipSum - paySum);
                return (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white/80 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm">
                      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Total Debit Slips</div>
                      <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">₹{slipSum.toFixed(2)}</div>
                    </div>
                    <div className="bg-white/80 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm">
                      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Total Payments Logged</div>
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400">₹{paySum.toFixed(2)}</div>
                    </div>
                    <div className="bg-white/80 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm border-l-4 border-l-red-500">
                      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Outstanding Receivable</div>
                      <div className="text-2xl font-bold text-red-600 dark:text-red-400">₹{outstanding.toFixed(2)}</div>
                    </div>
                  </div>
                );
              })()}

              {/* Statement log table */}
              <div className="bg-white/80 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm">
                <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-700 pb-3 mb-4">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Account Statement Log</h3>
                  <span className="text-xs text-slate-500">Click a row to view item details</span>
                </div>

                <div className="w-full overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-black/20">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-slate-50/50 dark:bg-white/5 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider font-medium">
                      <tr>
                        <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">Transaction Date</th>
                        <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">Slip Subtotal</th>
                        <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">Net Slip Debit</th>
                        <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">Credit Payment</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                      {lookupLedgerSummary.map((row, idx) => (
                        <React.Fragment key={idx}>
                          <tr 
                            onClick={() => loadLookupSlipDetails(row.txn_date)}
                            className="hover:bg-blue-500/5 dark:hover:bg-white/5 cursor-pointer transition-colors"
                          >
                            <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-400">
                              {new Date(row.txn_date).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                              ₹{parseFloat(row.totalamount) || 0}
                            </td>
                            <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">
                              ₹{parseFloat(row.netamount) || 0}
                            </td>
                            <td className="px-4 py-3 font-semibold text-green-600 dark:text-green-400">
                              {parseFloat(row.paymentmade) > 0 ? `₹${parseFloat(row.paymentmade)}` : "—"}
                            </td>
                          </tr>
                          {lookupDetailDate === row.txn_date && (
                            <tr className="bg-slate-50 dark:bg-slate-900/30">
                              <td colSpan={4} className="p-4 border-b border-slate-200 dark:border-slate-700">
                                <div className="pl-8 border-l-2 border-blue-500">
                                  {loadingLookupDetails ? (
                                    <div className="text-sm text-slate-500">Loading slip items...</div>
                                  ) : (
                                    <table className="w-full text-sm">
                                      <thead>
                                        <tr className="text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                                          <th className="py-2 text-left">Item Name</th>
                                          <th className="py-2 text-left">Remarks</th>
                                          <th className="py-2 text-left">Qty</th>
                                          <th className="py-2 text-left">Rate</th>
                                          <th className="py-2 text-left">Amount</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {lookupSlipDetails.map((det, didx) => (
                                          <tr key={didx} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                                            <td className="py-2 text-slate-800 dark:text-slate-200 font-medium">{det.item}</td>
                                            <td className="py-2 text-slate-500">{det.remarks}</td>
                                            <td className="py-2 text-slate-700 dark:text-slate-300">{det.qty}</td>
                                            <td className="py-2 text-slate-700 dark:text-slate-300">₹{det.rate}</td>
                                            <td className="py-2 font-mono text-slate-900 dark:text-slate-100">₹{det.itemamount}</td>
                                          </tr>
                                        ))}
                                        {lookupSlipDetails.length === 0 && (
                                          <tr>
                                            <td colSpan={5} className="py-4 text-center text-slate-500">No slip items found for this date.</td>
                                          </tr>
                                        )}
                                      </tbody>
                                    </table>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                      {lookupLedgerSummary.length === 0 && (
                        <tr>
                          <td colSpan={4} className="text-center py-8 text-slate-500">
                            No ledger transaction records found for this phone number.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </>
          )}
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
