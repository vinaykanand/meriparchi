"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/components/providers/AuthProvider";

interface SlipItemInput {
  item: string;
  remarks: string;
  qty: string;
  rate: string;
}

interface Toast {
  id: number;
  message: string;
  type: "success" | "error" | "info";
}

export default function AdminSlipsPage() {
  const { session } = useAuth();
  
  const [slipPhone, setSlipPhone] = useState("");
  const [slipName, setSlipName] = useState("");
  const [slipAddress, setSlipAddress] = useState("");
  const [slipItems, setSlipItems] = useState<SlipItemInput[]>([{ item: "", remarks: "", qty: "", rate: "" }]);
  const itemRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [recentSlipsData, setRecentSlipsData] = useState<any[]>([]);
  const [savingSlip, setSavingSlip] = useState(false);
  const [previousBalance, setPreviousBalance] = useState<number>(0);
  const [paymentMade, setPaymentMade] = useState<string>("0");
  const [loadingCustomer, setLoadingCustomer] = useState(false);
  
  const [searchSuggestions, setSearchSuggestions] = useState<{phone: string, name: string, address: string}[]>([]);
  const [showSlipSuggestions, setShowSlipSuggestions] = useState(false);

  const [itemSuggestions, setItemSuggestions] = useState<any[]>([]);
  const [showItemSuggestions, setShowItemSuggestions] = useState(false);
  const [activeItemRow, setActiveItemRow] = useState<number | null>(null);

  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (message: string, type: "success" | "error" | "info") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  };

  useEffect(() => {
    if (!slipPhone.trim()) {
      setSearchSuggestions([]);
      return;
    }
    const fetchSugg = async () => {
      if (!session) return;
      try {
        const response = await fetch(`/api/ledger?orgcode=${session.orgcode}&search=${slipPhone.trim()}`);
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
  }, [slipPhone, session]);

  const handleSelectSlipSuggestion = (phone: string, name: string, address: string) => {
    setSlipPhone(phone);
    setSlipName(name || "");
    setSlipAddress(address || "");
    setShowSlipSuggestions(false);
    fetchCustomerDetails(phone);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setSlipItems(prev => {
          const newLength = prev.length;
          setTimeout(() => itemRefs.current[newLength]?.focus(), 50);
          return [...prev, { item: "", remarks: "", qty: "", rate: "" }];
        });
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        const form = document.getElementById('slip-form') as HTMLFormElement;
        if (form) form.requestSubmit();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const phoneParam = urlParams.get('phone');
    if (phoneParam && session && !slipPhone) {
      handleSelectSlipSuggestion(phoneParam, "", "");
    }
  }, [session]);

  const fetchCustomerDetails = async (phone: string) => {
    if (!phone.trim() || !session) return;
    setLoadingCustomer(true);
    setPreviousBalance(0);
    setRecentSlipsData([]);
    
    try {
      const response = await fetch(`/api/ledger?orgcode=${session.orgcode}&phone=${phone.trim()}`);
      const data = await response.json();
      if (response.ok && data.success) {
        setPreviousBalance(data.kpis?.outstanding || 0);

        if (data.customer) {
          if (data.customer.name) setSlipName(data.customer.name);
          if (data.customer.address) setSlipAddress(data.customer.address);
        }
        
        if (data.slips) {
          const uniqueSlipsMap = new Map();
          data.slips.forEach((s: any) => {
            if (!uniqueSlipsMap.has(s.no)) {
              uniqueSlipsMap.set(s.no, { ...s, totalAmt: parseFloat(s.amt) || 0 });
            } else {
              const existing = uniqueSlipsMap.get(s.no);
              existing.totalAmt += parseFloat(s.amt) || 0;
            }
          });
          setRecentSlipsData(Array.from(uniqueSlipsMap.values()).slice(0, 2));
        } else {
          setRecentSlipsData([]);
        }
        addToast("Customer history loaded", "success");
      }
    } catch (error: any) {
      addToast("Failed to fetch customer details", "error");
    } finally {
      setLoadingCustomer(false);
    }
  };

  const fetchItemSuggestions = async (search: string) => {
    if (!session || !slipPhone.trim() || search.trim().length < 1) {
      setItemSuggestions([]);
      setShowItemSuggestions(false);
      return;
    }
    try {
      const response = await fetch(`/api/items?orgcode=${session.orgcode}&phone=${slipPhone.trim()}&search=${search.trim()}`);
      const data = await response.json();
      if (response.ok && data.success) {
        setItemSuggestions(data.items || []);
        setShowItemSuggestions(data.items && data.items.length > 0);
      }
    } catch (e) {
      console.error("Error fetching item suggestions:", e);
    }
  };

  const applyItemSuggestion = (suggestion: any) => {
    if (activeItemRow === null) return;
    const updated = [...slipItems];
    updated[activeItemRow] = {
      ...updated[activeItemRow],
      item: suggestion.item,
      remarks: suggestion.remarks || "",
      rate: suggestion.rate || ""
    };
    setSlipItems(updated);
    setShowItemSuggestions(false);
  };

  const addSlipItemField = () => {
    setSlipItems(prev => {
      const newLength = prev.length;
      setTimeout(() => itemRefs.current[newLength]?.focus(), 50);
      return [...prev, { item: "", remarks: "", qty: "", rate: "" }];
    });
  };

  const removeSlipItemField = (index: number) => {
    if (slipItems.length > 1) {
      const updated = slipItems.filter((_, i) => i !== index);
      setSlipItems(updated);
    }
  };

  const updateSlipItemField = (index: number, field: keyof SlipItemInput, value: string) => {
    const updated = [...slipItems];
    updated[index][field] = value;
    
    if (field === 'qty') {
      const numValue = parseFloat(value);
      if (numValue < 0) {
        if (!updated[index].remarks.toLowerCase().includes("return")) {
          updated[index].remarks = updated[index].remarks ? updated[index].remarks + " - Return" : "Return";
        }
      } else if (numValue > 0) {
        if (updated[index].remarks === "Return") {
          updated[index].remarks = "";
        } else if (updated[index].remarks.endsWith(" - Return")) {
          updated[index].remarks = updated[index].remarks.slice(0, -9);
        }
      }
    }
    
    setSlipItems(updated);
    if (field === "item") {
      setActiveItemRow(index);
      fetchItemSuggestions(value);
    }
  };

  const getSlipTotals = () => {
    let total = 0;
    slipItems.forEach((it) => {
      const q = parseFloat(it.qty) || 0;
      const r = parseFloat(it.rate) || 0;
      total += q * r;
    });
    const net = total + previousBalance;
    return { total, net };
  };

  const handleSaveSlipAndPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !slipPhone.trim()) return;

    const cleanedItems = slipItems.filter(it => it.item.trim() !== "");
    if (cleanedItems.length === 0) {
      addToast("At least one item is required for a slip.", "error");
      return;
    }

    const hasNegativeRate = cleanedItems.some(
      (it) => (parseFloat(it.rate) || 0) < 0
    );
    if (hasNegativeRate) {
      addToast("Rate must be non-negative", "error");
      return;
    }

    const { total, net } = getSlipTotals();

    const payAmt = parseFloat(paymentMade) || 0;
    if (payAmt < 0) {
      addToast("Payment amount must be non-negative", "error");
      return;
    }

    setSavingSlip(true);

    const formattedItems = cleanedItems.map((it) => ({
      item: it.item.trim(),
      remarks: it.remarks ? it.remarks.trim() : "",
      qty: parseFloat(it.qty) || 0,
      rate: parseFloat(it.rate) || 0,
    }));

    try {
      const response = await fetch("/api/ledger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "slip",
          orgcode: session.orgcode,
          phone: slipPhone.trim(),
          name: slipName.trim(),
          address: slipAddress.trim(),
          totalamount: total,
          items: formattedItems,
        }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        addToast("Transaction committed successfully!", "success");

        if (payAmt > 0) {
          const payResponse = await fetch("/api/ledger", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "payment",
              orgcode: session.orgcode,
              phone: slipPhone.trim(),
              amount: payAmt,
              narration: `Payment made with Slip`.trim(),
            }),
          });
          const payData = await payResponse.json();
          if (payResponse.ok && payData.success) {
            addToast("Payment logged successfully", "success");
          } else {
            addToast("Slip created, but failed to log payment", "error");
          }
        }

        setSlipItems([{ item: "", remarks: "", qty: "0", rate: "0" }]);
        setPaymentMade("0");
        fetchCustomerDetails(slipPhone);
      } else {
        addToast(data.message || "Failed to commit transaction", "error");
      }
    } catch (error: any) {
      addToast(error.message || "An unexpected error occurred", "error");
    } finally {
      setSavingSlip(false);
    }
  };

  const { total: slipTotalSum, net: slipNetSum } = getSlipTotals();

  return (
    <div className="flex flex-col gap-6 animate-fade-in relative">
      <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Create New Slip</h2>
      <p className="text-slate-500 text-sm mt-1 mb-4">Log client transaction slips and billable items.</p>

      <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-md rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-5">
        <form id="slip-form" onSubmit={handleSaveSlipAndPayment} onKeyDown={(e) => { if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') e.preventDefault(); }} className="flex flex-col gap-6">
          {/* Customer Info Card */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="flex flex-col gap-1 relative" onClick={(e) => e.stopPropagation()}>
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Customer Phone Number*</label>
              <div className="flex gap-2 relative">
                <input 
                  type="text" 
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white/50 dark:bg-slate-900/50 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all dark:text-white" 
                  style={{ flex: 1 }}
                  placeholder="Phone, name, or address" 
                  value={slipPhone} 
                  onChange={(e) => {
                    setSlipPhone(e.target.value);
                    setPreviousBalance(0);
                    setRecentSlipsData([]);
                    setShowSlipSuggestions(true);
                  }}
                  onFocus={() => setShowSlipSuggestions(true)}
                />
                <button
                  type="button"
                  onClick={() => fetchCustomerDetails(slipPhone)}
                  disabled={loadingCustomer}
                  className="px-4 py-2 text-sm font-bold rounded-xl bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 transition-colors shadow-md shadow-blue-500/20"
                >
                  {loadingCustomer ? "..." : "Lookup"}
                </button>
                {showSlipSuggestions && searchSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 max-h-60 overflow-y-auto z-50 py-2" style={{ top: "100%", left: 0, right: 0 }}>
                    {searchSuggestions.map((item, idx) => (
                      <div 
                        key={idx} 
                        className="px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer border-b border-slate-100 dark:border-slate-800 last:border-0 transition-colors"
                        onClick={() => handleSelectSlipSuggestion(item.phone, item.name, item.address)}
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

            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Customer Name</label>
              <input 
                type="text" 
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white/50 dark:bg-slate-900/50 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all dark:text-white" 
                placeholder="e.g. John Doe" 
                value={slipName} 
                onChange={(e) => setSlipName(e.target.value)} 
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Customer Address</label>
              <input 
                type="text" 
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white/50 dark:bg-slate-900/50 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all dark:text-white" 
                placeholder="City, State" 
                value={slipAddress} 
                onChange={(e) => setSlipAddress(e.target.value)} 
              />
            </div>
          </div>

          {/* Items List Table */}
          <div className="mb-6">
            <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-700 pb-2 mb-3">
              <span className="font-semibold text-gray-900 dark:text-gray-100">Slip Items List</span>
            </div>

            <div className="w-full overflow-visible rounded-lg border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-black/20">
              <table className="w-full text-left text-sm min-w-[600px]">
                <thead className="bg-gray-50/50 dark:bg-white/5 text-gray-500 dark:text-gray-400 text-xs uppercase font-medium">
                  <tr>
                    <th className="px-4 py-2 w-[35%]">Item Name*</th>
                    <th className="px-4 py-2 w-[25%]">Remark (Optional)</th>
                    <th className="px-4 py-2 w-[15%]">Qty</th>
                    <th className="px-4 py-2 w-[15%]">Rate (₹)</th>
                    <th className="px-4 py-2 w-[10%]">Amount (₹)</th>
                    <th className="px-4 py-2 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {slipItems.map((itemInput, idx) => {
                    const qty = parseFloat(itemInput.qty) || 0;
                    const rate = parseFloat(itemInput.rate) || 0;
                    const amount = qty * rate;
                    return (
                      <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors">
                        <td className="px-3 py-2 relative">
                          <input 
                            type="text" 
                            ref={(el) => { itemRefs.current[idx] = el; }}
                            className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow" 
                            placeholder="e.g. Paint" 
                            value={itemInput.item} 
                            onChange={(e) => updateSlipItemField(idx, "item", e.target.value)}
                            onBlur={() => setTimeout(() => setShowItemSuggestions(false), 200)}
                            onFocus={(e) => { setActiveItemRow(idx); fetchItemSuggestions(e.target.value); }} 
                            required
                          />
                          {activeItemRow === idx && showItemSuggestions && itemSuggestions.length > 0 && (
                            <ul className="absolute z-50 left-3 top-full mt-1 w-[300px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg overflow-hidden text-sm">
                              {itemSuggestions.map((s, i) => (
                                <li 
                                  key={i} 
                                  className="px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer border-b border-slate-100 dark:border-slate-700/50 last:border-0 flex justify-between items-center"
                                  onMouseDown={(e) => { e.preventDefault(); applyItemSuggestion(s); }}
                                >
                                  <div className="flex flex-col">
                                    <span className="font-medium text-slate-800 dark:text-slate-200">{s.item}</span>
                                    <span className="text-xs text-slate-500">{s.remarks}</span>
                                  </div>
                                  <span className="text-blue-600 dark:text-blue-400 font-semibold">₹{s.rate}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <input 
                            type="text" 
                            className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow" 
                            placeholder="Remarks (Optional)" 
                            value={itemInput.remarks} 
                            onChange={(e) => updateSlipItemField(idx, "remarks", e.target.value)} 
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input 
                            type="number" 
                            step="any"
                            className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow" 
                            placeholder="1" 
                            value={itemInput.qty} 
                            onChange={(e) => updateSlipItemField(idx, "qty", e.target.value)} 
                            onKeyDown={(e) => {
                              if (["e", "E", "+"].includes(e.key)) {
                                e.preventDefault();
                              }
                            }}
                            required
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input 
                            type="number" 
                            min="0"
                            step="any"
                            className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow" 
                            placeholder="0" 
                            value={itemInput.rate} 
                            onChange={(e) => updateSlipItemField(idx, "rate", e.target.value)} 
                            onKeyDown={(e) => {
                              if (["e", "E", "+", "-"].includes(e.key)) {
                                e.preventDefault();
                              }
                              if (e.key === "Tab" && idx === slipItems.length - 1) {
                                if (itemInput.item.trim() !== "") {
                                  e.preventDefault();
                                  addSlipItemField();
                                }
                              }
                            }}
                            required
                          />
                        </td>
                        <td className="px-4 py-2 font-mono font-semibold text-gray-700 dark:text-gray-300">
                          ₹{amount.toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button 
                            type="button" 
                            disabled={slipItems.length === 1}
                            className="text-slate-400 hover:text-red-500 font-bold text-lg disabled:opacity-30 transition-colors" 
                            onClick={() => removeSlipItemField(idx)}
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex justify-between items-center">
              <span className="text-xs text-slate-500">Shortcut: <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">Alt</kbd> + <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">A</kbd> to add item</span>
              <button 
                type="button" 
                className="px-4 py-2 text-sm font-bold rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors shadow-sm"
                onClick={addSlipItemField}
              >
                + Add Item
              </button>
            </div>
          </div>

          {/* Calculations & Payment made panel */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start border-t border-gray-200 dark:border-gray-700 pt-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500 dark:text-gray-400">Total Amount (A)</span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">₹{slipTotalSum.toFixed(2)}</span>
              </div>
              
              <div className="flex justify-between items-center border-t border-dashed border-gray-200 dark:border-gray-700 pt-3">
                <span className="font-semibold text-gray-900 dark:text-gray-100">Net Receivable (B = A + Prev)</span>
                <span className="text-lg font-bold text-blue-600 dark:text-blue-400">₹{slipNetSum.toFixed(2)}</span>
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-gray-700/50 rounded-xl p-5 space-y-4 shadow-inner">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500 dark:text-gray-400">Previous Outstanding Balance</span>
                <span className={`font-semibold ${previousBalance < 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-gray-100'}`}>
                  ₹{previousBalance.toFixed(2)}
                </span>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Payment Made (₹)</label>
                <input 
                  type="number" 
                  min="0"
                  step="any"
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all dark:text-white" 
                  placeholder="Amount received (e.g. 500)" 
                  value={paymentMade} 
                  onChange={(e) => setPaymentMade(e.target.value)} 
                />
              </div>
            </div>
          </div>

          <button 
            type="submit" 
            className="w-full mt-2 py-3.5 px-4 rounded-xl text-white font-bold text-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_4px_15px_rgba(59,130,246,0.3)] hover:shadow-[0_6px_20px_rgba(59,130,246,0.4)]"
            disabled={savingSlip}
          >
            {savingSlip ? "Processing Transaction..." : "Commit Transaction Slip & Payment"}
          </button>
        </form>
      </div>

      {/* Recent Slips Preview */}
      {recentSlipsData.length > 0 && (
        <div className="mt-8 bg-white/70 dark:bg-slate-800/70 backdrop-blur-md rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="font-bold text-slate-900 dark:text-slate-100 mb-4 border-b border-slate-200 dark:border-slate-700 pb-2">Recent Slips for this Customer</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recentSlipsData.map((s: any, idx: number) => (
              <div key={idx} className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex flex-col justify-between bg-slate-50 dark:bg-slate-900/50">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="font-bold text-blue-600 dark:text-blue-400">Slip #{s.no}</div>
                    <div className="text-xs text-slate-500">{new Date(s.time).toLocaleDateString()} {new Date(s.time).toLocaleTimeString()}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-slate-900 dark:text-slate-100">₹{s.totalAmt.toFixed(2)}</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <a target="_blank" rel="noopener noreferrer" href={`/print/slip?phone=${slipPhone}&slipno=${s.no}&orgcode=${session?.orgcode}&format=compact`} className="flex-1 text-center py-2 text-sm font-bold bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-lg transition-colors shadow-sm">🖨️ Print Thermal</a>
                  <a target="_blank" rel="noopener noreferrer" href={`/print/slip?phone=${slipPhone}&slipno=${s.no}&orgcode=${session?.orgcode}&format=a4`} className="flex-1 text-center py-2 text-sm font-bold bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-lg transition-colors shadow-sm">📄 Print A4</a>
                </div>
              </div>
            ))}
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
