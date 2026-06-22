"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import {
  CreditCardIcon,
  TagIcon,
  PlusIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon
} from "@heroicons/react/24/outline";

interface PricingPlan {
  plan_key: string;
  plan_name: string;
  price: string;
  duration_months: number;
}

interface Toast {
  id: string;
  message: string;
  type: "success" | "error";
}

export default function PricingAndCouponsPage() {
  const { session } = useAuth();
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [savingPlans, setSavingPlans] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Coupon placeholders
  const [coupons, setCoupons] = useState([
    { code: "WELCOME50", discount: "50% Off", type: "percentage", status: "active", expiry: "2026-12-31" },
    { code: "FLAT100", discount: "₹100 Off", type: "flat", status: "active", expiry: "2026-08-15" }
  ]);

  const addToast = (message: string, type: "success" | "error") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const fetchPlans = async () => {
    setLoadingPlans(true);
    try {
      const res = await fetch("/api/pricing-plans");
      const data = await res.json();
      if (res.ok && data.success) {
        setPlans(data.plans || []);
      }
    } catch {
      addToast("Failed to load pricing plans", "error");
    } finally {
      setLoadingPlans(false);
    }
  };

  const handleSavePlans = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPlans(true);
    try {
      const res = await fetch("/api/pricing-plans", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plans }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        addToast("Pricing plans updated successfully!", "success");
        fetchPlans();
      } else {
        addToast(data.message || "Failed to update pricing plans", "error");
      }
    } catch (err: any) {
      addToast(err.message || "Failed to save pricing plans", "error");
    } finally {
      setSavingPlans(false);
    }
  };

  const handlePriceChange = (planKey: string, newPrice: string) => {
    setPlans(prev => prev.map(p => p.plan_key === planKey ? { ...p, price: newPrice } : p));
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  return (
    <div className="flex flex-col gap-6 animate-fade-in max-w-7xl mx-auto p-2">
      {/* Toast Notification Container */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-center p-4 rounded-xl shadow-2xl border backdrop-blur-md animate-slide-up ${
              toast.type === "success" 
                ? "bg-emerald-950/80 border-emerald-800 text-emerald-100" 
                : "bg-rose-950/80 border-rose-800 text-rose-100"
            }`}
          >
            <div className="flex-1 text-sm font-medium">{toast.message}</div>
            <button className="ml-3 opacity-70 hover:opacity-100" onClick={() => setToasts(t => t.filter(x => x.id !== toast.id))}>×</button>
          </div>
        ))}
      </div>

      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-slate-800 mb-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-100">Pricing & Coupons</h1>
          <p className="text-sm text-slate-400">Configure client subscription rates and manage promotional discount codes.</p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Pricing Plans Form */}
        <div className="bg-slate-800/50 backdrop-blur-md border border-slate-800 rounded-2xl p-6 shadow-sm h-fit">
          <h2 className="text-lg font-bold flex items-center gap-2 mb-2 text-slate-100">
            <CreditCardIcon className="w-5 h-5 text-violet-500" />
            Pricing Settings Model
          </h2>
          <p className="text-xs text-slate-400 mb-5">Set pricing for client monthly and multi-month subscription plans.</p>

          {loadingPlans ? (
            <div className="text-center py-6 text-xs text-slate-500 animate-pulse flex flex-col items-center gap-2">
              <ArrowPathIcon className="w-5 h-5 animate-spin text-violet-500" />
              <span>Loading plans...</span>
            </div>
          ) : (
            <form onSubmit={handleSavePlans} className="flex flex-col gap-4">
              {plans.map((p) => (
                <div key={p.plan_key} className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">{p.plan_name}</label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3.5 text-slate-400 font-bold text-sm">₹</span>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      className="w-full pl-8 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-violet-500 text-sm font-semibold text-slate-100"
                      value={p.price}
                      onChange={(e) => handlePriceChange(p.plan_key, e.target.value)}
                      required
                    />
                  </div>
                </div>
              ))}
              <button
                type="submit"
                disabled={savingPlans}
                className="w-full py-2.5 mt-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {savingPlans ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    <span>Saving Prices...</span>
                  </>
                ) : (
                  <span>Commit Pricing Model</span>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Right Column: Coupon Code Management Placeholders */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="bg-slate-800/50 backdrop-blur-md border border-slate-800 rounded-2xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold flex items-center gap-2 text-slate-100">
                <TagIcon className="w-5 h-5 text-violet-500" />
                Active Coupon Codes
              </h2>
              <button
                disabled
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-violet-600/20 text-violet-400 border border-violet-850 hover:bg-violet-650/30 text-xs font-bold transition-all opacity-50 cursor-not-allowed"
              >
                <PlusIcon className="w-4 h-4" />
                New Coupon
              </button>
            </div>
            
            <p className="text-xs text-slate-400 mb-6">
              Create coupons and discount schemes that clients can apply during Checkout.
            </p>

            <div className="overflow-x-auto border border-slate-850 rounded-xl bg-slate-900/30">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-850 text-slate-400 text-xs font-bold uppercase tracking-wider bg-slate-900/50">
                    <th className="py-3 px-4">Coupon Code</th>
                    <th className="py-3 px-4">Discount Value</th>
                    <th className="py-3 px-4">Expiry Date</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850 text-sm">
                  {coupons.map((coupon) => (
                    <tr key={coupon.code} className="hover:bg-slate-800/10 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-violet-400 uppercase tracking-wide">
                        {coupon.code}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-200">
                        {coupon.discount}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-500 font-medium">
                        {new Date(coupon.expiry).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-950/40 text-emerald-400 border border-emerald-800/30">
                          <CheckCircleIcon className="w-3 h-3" />
                          {coupon.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 p-4 rounded-xl border border-dashed border-slate-700 bg-slate-900/20 text-center">
              <span className="text-xs text-slate-500 font-bold block mb-1">COUPON VALIDATION SYSTEM</span>
              <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                The core coupon engine is ready for implementation. You will soon be able to issue custom coupons and auto-calculate checkout totals in the billing terminal.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
