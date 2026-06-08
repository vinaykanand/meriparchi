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

  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (message: string, type: "success" | "error" | "info") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  };

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

  const fetchCustomerDetails = async (p: string) => {
    if (!p.trim() || !session) return;
    setLoadingCustomer(true);
    try {
      const response = await fetch(`/api/ledger?orgcode=${session.orgcode}&phone=${p.trim()}`);
      const data = await response.json();
      if (response.ok && data.success) {
        let slipSum = 0;
        let paySum = 0;
        if (data.summary && Array.isArray(data.summary)) {
          data.summary.forEach((row: any) => {
            slipSum += parseFloat(row.netamount) || 0;
            paySum += parseFloat(row.paymentmade) || 0;
          });
        }
        setPreviousBalance(slipSum - paySum);

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
      } else {
        addToast(payData.message || "Failed to log payment", "error");
      }
    } catch (error: any) {
      addToast(error.message || "An unexpected error occurred", "error");
    } finally {
      setSavingPayment(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in relative max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Log Payment</h2>
      <p className="text-slate-500 text-sm mt-1 mb-4">Record cash or bank payments received from a customer independently.</p>

      <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-md rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          <div className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-slate-700/50 rounded-xl p-5 space-y-4 shadow-inner mt-4">
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
            className="w-full mt-4 py-4 px-4 rounded-xl text-white font-bold text-lg bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-green-500/30"
            disabled={savingPayment}
          >
            {savingPayment ? "Logging Payment..." : "Record Payment"}
          </button>
        </form>
      </div>

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
