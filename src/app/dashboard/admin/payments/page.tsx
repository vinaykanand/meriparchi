"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/components/providers/AuthProvider";

interface Toast {
  id: number;
  message: string;
  type: "success" | "error" | "info";
}

export default function AdminPaymentsPage() {
  const { session } = useAuth();
  
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [amount, setAmount] = useState<string>("");
  const [narration, setNarration] = useState("");
  const [previousBalance, setPreviousBalance] = useState<number>(0);
  
  const [loadingCustomer, setLoadingCustomer] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  
  const [searchSuggestions, setSearchSuggestions] = useState<{phone: string, name: string, address: string}[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [recentPayments, setRecentPayments] = useState<{
    id: number;
    phone: string;
    date: string;
    amount: number;
    narration: string;
    name?: string;
    address?: string;
  }[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [selectedPaymentIds, setSelectedPaymentIds] = useState<number[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (message: string, type: "success" | "error" | "info") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  };

  const fetchRecentPayments = async () => {
    if (!session?.orgcode) return;
    setLoadingPayments(true);
    try {
      const res = await fetch(`/api/ledger?orgcode=${session.orgcode}&paymentsLimit=50`);
      const data = await res.json();
      if (res.ok && data.success) {
        setRecentPayments(data.payments || []);
      }
    } catch (e) {
      console.error("Failed to load recent payments:", e);
    } finally {
      setLoadingPayments(false);
    }
  };

  useEffect(() => {
    if (session?.orgcode) {
      fetchRecentPayments();
    }
  }, [session]);

  useEffect(() => {
    if (!phone.trim()) {
      setSearchSuggestions([]);
      return;
    }
    const fetchSugg = async () => {
      if (!session) return;
      try {
        const response = await fetch(`/api/ledger?orgcode=${session.orgcode}&search=${phone.trim()}`);
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
  }, [phone, session]);

  const handleSelectSuggestion = (p: string, n: string, a: string) => {
    setPhone(p);
    setName(n || "");
    setAddress(a || "");
    setShowSuggestions(false);
    fetchCustomerDetails(p);
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const phoneParam = urlParams.get('phone');
    if (phoneParam && session && !phone) {
      handleSelectSuggestion(phoneParam, "", "");
    }
  }, [session]);

  const fetchCustomerDetails = async (p: string) => {
    if (!p.trim() || !session) return;
    setLoadingCustomer(true);
    setPreviousBalance(0);
    
    try {
      const response = await fetch(`/api/ledger?orgcode=${session.orgcode}&phone=${p.trim()}`);
      const data = await response.json();
      if (response.ok && data.success) {
        setPreviousBalance(data.kpis?.outstanding || 0);

        if (data.customer) {
          if (data.customer.name) setName(data.customer.name);
          if (data.customer.address) setAddress(data.customer.address);
        }
        addToast("Customer details loaded", "success");
      }
    } catch (error: any) {
      addToast("Failed to fetch customer details", "error");
    } finally {
      setLoadingCustomer(false);
    }
  };

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !phone.trim()) {
      addToast("Phone number is required", "error");
      return;
    }

    const payAmt = parseFloat(amount);
    if (isNaN(payAmt) || payAmt <= 0) {
      addToast("Please enter a valid payment amount greater than 0", "error");
      return;
    }

    setSavingPayment(true);

    try {
      const payResponse = await fetch("/api/ledger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "payment",
          orgcode: session.orgcode,
          phone: phone.trim(),
          name: name.trim(),
          amount: payAmt,
          narration: narration.trim(),
        }),
      });
      const payData = await payResponse.json();
      if (payResponse.ok && payData.success) {
        addToast("Payment logged successfully", "success");
        setAmount("");
        setNarration("");
        fetchCustomerDetails(phone); // Refresh balance
        fetchRecentPayments(); // Refresh list
      } else {
        addToast(payData.message || "Failed to log payment", "error");
      }
    } catch (error: any) {
      addToast(error.message || "An unexpected error occurred", "error");
    } finally {
      setSavingPayment(false);
    }
  };

  const handleDeletePayments = async () => {
    if (!adminPassword) {
      setDeleteError("Admin password is required.");
      return;
    }
    setIsDeleting(true);
    setDeleteError("");
    try {
      const res = await fetch(`/api/ledger?orgcode=${session?.orgcode}&paymentIds=${selectedPaymentIds.join(",")}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: adminPassword })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        addToast("Payment(s) deleted successfully", "success");
        setSelectedPaymentIds([]);
        setAdminPassword("");
        setShowDeleteModal(false);
        fetchRecentPayments(); // Refresh list
        if (phone) fetchCustomerDetails(phone); // Refresh balance
      } else {
        setDeleteError(data.message || "Failed to delete payment(s)");
      }
    } catch (err: any) {
      setDeleteError(err.message || "An error occurred");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in relative max-w-6xl mx-auto pb-10">
      <div>
        <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Log Payment</h2>
        <p className="text-slate-500 text-sm mt-1">Record cash or bank payments received from a customer independently.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: Log Payment Form */}
        <div className="lg:col-span-1 bg-white/70 dark:bg-slate-800/70 backdrop-blur-md rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <form onSubmit={handleSavePayment} className="flex flex-col gap-6">
            
            {/* Customer Selection */}
            <div className="flex flex-col gap-1 relative" onClick={(e) => e.stopPropagation()}>
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Customer Phone Number*</label>
              <div className="flex gap-2 relative">
                <input 
                  type="text" 
                  className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-white/50 dark:bg-slate-900/50 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all dark:text-white" 
                  style={{ flex: 1 }}
                  placeholder="Search by Phone, Name, or Address" 
                  value={phone} 
                  onChange={(e) => {
                    setPhone(e.target.value);
                    setPreviousBalance(0);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                />
                <button
                  type="button"
                  onClick={() => fetchCustomerDetails(phone)}
                  disabled={loadingCustomer}
                  className="px-6 py-3 text-sm font-bold rounded-xl bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 transition-colors shadow-md shadow-blue-500/20"
                >
                  {loadingCustomer ? "..." : "Lookup"}
                </button>
                
                {showSuggestions && searchSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 max-h-60 overflow-y-auto z-50 py-2">
                    {searchSuggestions.map((item, idx) => (
                      <div 
                        key={idx} 
                        className="px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer border-b border-slate-100 dark:border-slate-800 last:border-0 transition-colors"
                        onClick={() => handleSelectSuggestion(item.phone, item.name, item.address)}
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
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Customer Name</label>
                <input 
                  type="text" 
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900/50 text-slate-600 dark:text-slate-400 cursor-not-allowed" 
                  value={name} 
                  disabled
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Outstanding Balance</label>
                <div className={`w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900/50 font-bold ${previousBalance > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                  ₹{previousBalance.toFixed(2)}
                </div>
              </div>
            </div>

            {/* Payment Details */}
            <div className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-slate-700/50 rounded-xl p-5 space-y-4 shadow-inner">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Payment Amount (₹)*</label>
                <input 
                  type="number" 
                  min="0"
                  step="any"
                  required
                  className="w-full px-4 py-3 text-lg font-bold border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all dark:text-white" 
                  placeholder="e.g. 1000" 
                  value={amount} 
                  onChange={(e) => setAmount(e.target.value)} 
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Narration (Optional)</label>
                <input 
                  type="text" 
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all dark:text-white" 
                  placeholder="e.g. Cash payment via John" 
                  value={narration} 
                  onChange={(e) => setNarration(e.target.value)} 
                />
              </div>
            </div>

            <button 
              type="submit" 
              className="w-full py-4 px-4 rounded-xl text-white font-bold text-lg bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-green-500/30"
              disabled={savingPayment}
            >
              {savingPayment ? "Logging Payment..." : "Record Payment"}
            </button>
          </form>
        </div>

        {/* Right Column: Recent Payments List (50 limit) */}
        <div className="lg:col-span-2 bg-white/70 dark:bg-slate-800/70 backdrop-blur-md rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex flex-col sm:flex-row gap-3 sm:justify-between sm:items-center">
            <div>
              <h3 className="font-bold text-slate-800 dark:text-slate-200">Recent Payments</h3>
              <p className="text-xs text-slate-500 mt-0.5">Last 50 payments logged</p>
            </div>
            
            {selectedPaymentIds.length > 0 && (
              <button
                onClick={() => {
                  setDeleteError("");
                  setAdminPassword("");
                  setShowDeleteModal(true);
                }}
                className="px-3.5 py-1.5 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition-all shadow-md shadow-rose-500/20"
              >
                Delete Selected ({selectedPaymentIds.length})
              </button>
            )}
          </div>

          <div className="overflow-x-auto max-h-[520px]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={recentPayments.length > 0 && selectedPaymentIds.length === recentPayments.length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedPaymentIds(recentPayments.map(p => p.id));
                        } else {
                          setSelectedPaymentIds([]);
                        }
                      }}
                      className="w-4 h-4 text-blue-600 border-slate-300 dark:border-slate-650 rounded focus:ring-blue-500 cursor-pointer"
                    />
                  </th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Narration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                {loadingPayments ? (
                  <tr>
                    <td colSpan={5} className="text-center py-10 text-slate-450 dark:text-slate-500">Loading recent payments...</td>
                  </tr>
                ) : recentPayments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-10 text-slate-450 dark:text-slate-500">No payment entries found.</td>
                  </tr>
                ) : (
                  recentPayments.map((p) => {
                    const isSelected = selectedPaymentIds.includes(p.id);
                    return (
                      <tr 
                        key={p.id}
                        className={`hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors ${
                          isSelected ? "bg-blue-50/30 dark:bg-blue-900/10" : ""
                        }`}
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedPaymentIds(prev => [...prev, p.id]);
                              } else {
                                setSelectedPaymentIds(prev => prev.filter(id => id !== p.id));
                              }
                            }}
                            className="w-4 h-4 text-blue-600 border-slate-350 dark:border-slate-650 rounded focus:ring-blue-500 cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-800 dark:text-slate-200">
                            {p.name || "Unknown"}
                          </div>
                          <div className="text-[10px] text-slate-550 font-mono dark:text-slate-300">{p.phone}</div>
                          {p.address && (
                            <div className="text-[10px] text-slate-450 dark:text-slate-350 italic mt-0.5">📍 {p.address}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-650 dark:text-slate-450 whitespace-nowrap">
                          {new Date(p.date).toLocaleDateString('en-IN')}
                        </td>
                        <td className="px-4 py-3 text-emerald-600 dark:text-emerald-400 font-bold">
                          ₹{parseFloat(p.amount.toString()).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400 max-w-[150px] truncate" title={p.narration}>
                          {p.narration || "-"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Admin Password Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 max-w-md w-full space-y-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Delete Payment Entries</h3>
              <p className="text-xs text-slate-500 mt-1">
                You are about to delete <span className="font-bold text-slate-850 dark:text-slate-200">{selectedPaymentIds.length}</span> payment entry/entries permanently. This will recalculate the customers' outstanding balances.
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-650 dark:text-slate-350">Enter Admin Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 text-slate-800 dark:text-slate-200"
              />
            </div>

            {deleteError && (
              <p className="text-xs font-semibold text-rose-600 dark:text-rose-455 bg-rose-50 dark:bg-rose-955/20 p-2.5 rounded-xl border border-rose-100 dark:border-rose-900/30">
                {deleteError}
              </p>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting || !adminPassword}
                onClick={handleDeletePayments}
                className="px-5 py-2.5 text-xs font-bold bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl transition-colors shadow-md shadow-rose-500/20 flex items-center gap-1.5"
              >
                {isDeleting ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    Deleting...
                  </>
                ) : (
                  "Confirm & Delete"
                )}
              </button>
            </div>
          </div>
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
