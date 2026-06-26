"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import {
  CreditCardIcon,
  TagIcon,
  PlusIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  PencilSquareIcon,
  TrashIcon
} from "@heroicons/react/24/outline";

interface PricingPlan {
  plan_key: string;
  plan_name: string;
  price: string;
  duration_months: number;
}

interface Coupon {
  code: string;
  discount: string;
  type: "percentage" | "flat";
  value: number;
  status: "active" | "inactive";
  start_date: string;
  expiry_date: string;
  total_usage: number;
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
  const [pricingTab, setPricingTab] = useState<"simple" | "inventory">("simple");
  
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loadingCoupons, setLoadingCoupons] = useState(true);
  const [isCouponModalOpen, setIsCouponModalOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Coupon form states
  const [couponCode, setCouponCode] = useState("");
  const [couponDiscount, setCouponDiscount] = useState("");
  const [couponType, setCouponType] = useState<"percentage" | "flat">("percentage");
  const [couponValue, setCouponValue] = useState("");
  const [couponStatus, setCouponStatus] = useState<"active" | "inactive">("active");
  const [couponStartDate, setCouponStartDate] = useState("");
  const [couponExpiryDate, setCouponExpiryDate] = useState("");
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [savingCoupon, setSavingCoupon] = useState(false);

  // Coupon usage states
  const [isUsageModalOpen, setIsUsageModalOpen] = useState(false);
  const [selectedCouponForUsage, setSelectedCouponForUsage] = useState<string | null>(null);
  const [usageLogs, setUsageLogs] = useState<{ orgcode: string; orgname: string; timestamp: string }[]>([]);
  const [loadingUsageLogs, setLoadingUsageLogs] = useState(false);

  const handleViewUsage = async (code: string) => {
    setSelectedCouponForUsage(code);
    setIsUsageModalOpen(true);
    setLoadingUsageLogs(true);
    try {
      const res = await fetch(`/api/coupons/usage?code=${encodeURIComponent(code)}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setUsageLogs(data.usage || []);
      } else {
        addToast(data.message || "Failed to load usage details", "error");
      }
    } catch {
      addToast("Failed to connect to server", "error");
    } finally {
      setLoadingUsageLogs(false);
    }
  };

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

  const fetchCoupons = async () => {
    setLoadingCoupons(true);
    try {
      const res = await fetch("/api/coupons");
      const data = await res.json();
      if (res.ok && data.success) {
        setCoupons(data.coupons || []);
      }
    } catch {
      addToast("Failed to load coupons list", "error");
    } finally {
      setLoadingCoupons(false);
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

  const handleOpenAddModal = () => {
    setCouponCode("");
    setCouponDiscount("");
    setCouponType("percentage");
    setCouponValue("");
    setCouponStatus("active");

    const now = new Date();
    const nextYear = new Date();
    nextYear.setFullYear(now.getFullYear() + 1);

    setCouponStartDate(now.toISOString().split("T")[0]);
    setCouponExpiryDate(nextYear.toISOString().split("T")[0]);
    setEditingCode(null);
    setIsCouponModalOpen(true);
  };

  const handleOpenEditModal = (coupon: Coupon) => {
    setCouponCode(coupon.code);
    setCouponDiscount(coupon.discount);
    setCouponType(coupon.type);
    setCouponValue(coupon.value.toString());
    setCouponStatus(coupon.status);
    setCouponStartDate(new Date(coupon.start_date).toISOString().split("T")[0]);
    setCouponExpiryDate(new Date(coupon.expiry_date).toISOString().split("T")[0]);
    setEditingCode(coupon.code);
    setIsCouponModalOpen(true);
  };

  const handleSaveCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponCode.trim() || !couponDiscount.trim() || !couponValue.trim() || !couponExpiryDate) {
      addToast("Please fill in all required fields", "error");
      return;
    }

    setSavingCoupon(true);
    try {
      const method = editingCode ? "PUT" : "POST";
      const res = await fetch("/api/coupons", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: couponCode.trim().toUpperCase(),
          discount: couponDiscount.trim(),
          type: couponType,
          value: parseFloat(couponValue),
          status: couponStatus,
          start_date: couponStartDate,
          expiry_date: couponExpiryDate
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        addToast(data.message || "Coupon saved successfully!", "success");
        setIsCouponModalOpen(false);
        fetchCoupons();
      } else {
        addToast(data.message || "Failed to save coupon", "error");
      }
    } catch (err: any) {
      addToast(err.message || "Failed to connect to server", "error");
    } finally {
      setSavingCoupon(false);
    }
  };

  const handleDeleteCoupon = async (code: string) => {
    if (!confirm(`Are you sure you want to permanently delete coupon ${code}?`)) return;

    try {
      const res = await fetch(`/api/coupons?code=${encodeURIComponent(code)}`, {
        method: "DELETE"
      });
      const data = await res.json();
      if (res.ok && data.success) {
        addToast("Coupon deleted successfully", "success");
        fetchCoupons();
      } else {
        addToast(data.message || "Failed to delete coupon", "error");
      }
    } catch {
      addToast("Failed to delete coupon", "error");
    }
  };

  useEffect(() => {
    fetchPlans();
    fetchCoupons();
  }, []);

  return (
    <div className="flex flex-col gap-6 animate-fade-in max-w-7xl mx-auto p-2 text-slate-900 dark:text-slate-100">
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

      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-slate-200 dark:border-slate-800 mb-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">Pricing & Coupons</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Configure client subscription rates and manage promotional discount codes.</p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Pricing Plans Form */}
        <div className="bg-white/80 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm backdrop-blur-xl h-fit">
          <h2 className="text-lg font-bold flex items-center gap-2 mb-2 text-slate-900 dark:text-slate-100">
            <CreditCardIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            Pricing Settings Model
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">Set pricing for client monthly and multi-month subscription plans.</p>

          {loadingPlans ? (
            <div className="text-center py-6 text-xs text-slate-500 animate-pulse flex flex-col items-center gap-2">
              <ArrowPathIcon className="w-5 h-5 animate-spin text-blue-500" />
              <span>Loading plans...</span>
            </div>
          ) : (
            <form onSubmit={handleSavePlans} className="flex flex-col gap-4">
              {/* Tab Selector */}
              <div className="flex border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden mb-2 p-0.5 bg-slate-150/40 dark:bg-slate-900/60">
                <button
                  type="button"
                  onClick={() => setPricingTab("simple")}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    pricingTab === "simple"
                      ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm"
                      : "text-slate-500 hover:text-slate-750 dark:hover:text-slate-350"
                  }`}
                >
                  Simple Parchi
                </button>
                <button
                  type="button"
                  onClick={() => setPricingTab("inventory")}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    pricingTab === "inventory"
                      ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm"
                      : "text-slate-500 hover:text-slate-750 dark:hover:text-slate-350"
                  }`}
                >
                  Parchi + Inventory
                </button>
              </div>

              {plans
                .filter((p) => {
                  const isInv = p.plan_key.endsWith("_inventory");
                  return pricingTab === "inventory" ? isInv : !isInv;
                })
                .map((p) => (
                  <div key={p.plan_key} className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {p.plan_name.replace(" with Inventory", "")}
                    </label>
                    <div className="relative flex items-center">
                      <span className="absolute left-3.5 text-slate-400 font-bold text-sm">₹</span>
                      <input
                        type="number"
                        step="1"
                        min="1"
                        className="w-full pl-8 pr-4 py-2 bg-white dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm font-semibold text-slate-900 dark:text-white"
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
                className="w-full py-2.5 mt-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
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
          <div className="bg-white/80 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm backdrop-blur-xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
                <TagIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                Active Coupon Codes
              </h2>
              <button
                onClick={handleOpenAddModal}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600/10 hover:bg-blue-600/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/30 text-xs font-bold transition-all"
              >
                <PlusIcon className="w-4 h-4" />
                New Coupon
              </button>
            </div>
            
            <p className="text-xs text-slate-550 dark:text-slate-400 mb-6">
              Create coupons and discount schemes that clients can apply during Checkout.
            </p>

            {loadingCoupons ? (
              <div className="text-center py-12 text-slate-500 animate-pulse">
                <ArrowPathIcon className="w-6 h-6 animate-spin text-blue-500 mx-auto mb-2" />
                <span>Loading coupons...</span>
              </div>
            ) : coupons.length === 0 ? (
              <div className="py-12 border border-dashed border-slate-350 dark:border-slate-700 rounded-xl text-center text-slate-500 dark:text-slate-400">
                No coupons configured yet. Click "New Coupon" to start.
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50/50 dark:bg-slate-900/30">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider bg-slate-100/50 dark:bg-slate-900/50">
                      <th className="py-3 px-4">Coupon Code</th>
                      <th className="py-3 px-4">Discount</th>
                      <th className="py-3 px-4">Validity Period</th>
                      <th className="py-3 px-4">Usage</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                    {coupons.map((coupon) => (
                      <tr key={coupon.code} className="hover:bg-slate-50/30 dark:hover:bg-slate-700/10 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold uppercase tracking-wide">
                          <button
                            onClick={() => handleViewUsage(coupon.code)}
                            className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer font-bold text-left"
                            title="View usage details"
                          >
                            {coupon.code}
                          </button>
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-750 dark:text-slate-200">
                          {coupon.discount} ({coupon.type === "percentage" ? `${coupon.value}%` : `₹${coupon.value}`})
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-500 font-medium">
                          {new Date(coupon.start_date).toLocaleDateString()} - {new Date(coupon.expiry_date).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 text-xs font-bold">
                          <button
                            onClick={() => handleViewUsage(coupon.code)}
                            className="text-slate-650 dark:text-slate-350 hover:text-blue-600 dark:hover:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer font-bold"
                            title="Click to see who used this coupon"
                          >
                            {coupon.total_usage} uses
                          </button>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                            coupon.status === "active"
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-250 dark:border-emerald-800/30"
                              : "bg-slate-100 text-slate-750 dark:bg-slate-800 dark:text-slate-400 border-slate-300 dark:border-slate-700"
                          }`}>
                            {coupon.status === "active" ? (
                              <>
                                <CheckCircleIcon className="w-3 h-3" />
                                Active
                              </>
                            ) : (
                              <>
                                <XCircleIcon className="w-3 h-3" />
                                Inactive
                              </>
                            )}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenEditModal(coupon)}
                              className="p-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-600 dark:text-slate-350 border border-slate-250 dark:border-slate-700 rounded-lg transition-all"
                              title="Edit Coupon"
                            >
                              <PencilSquareIcon className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteCoupon(coupon.code)}
                              className="p-1.5 bg-rose-50 dark:bg-rose-950/20 hover:bg-rose-100 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/50 rounded-lg transition-all"
                              title="Delete Coupon"
                            >
                              <TrashIcon className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-6 p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/20 text-center">
              <span className="text-xs text-slate-500 font-bold block mb-1">COUPON VALIDATION SYSTEM</span>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                Super Admins can create and modify coupon codes. Discounts will be calculated and applied securely on checkout order generation.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Coupon Creation / Editing Modal */}
      {isCouponModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl animate-scale-up">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">
              {editingCode ? `Edit Coupon: ${editingCode}` : "Create New Coupon"}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">Configure promotional codes and date-bound active discount thresholds.</p>
            
            <form onSubmit={handleSaveCoupon} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Coupon Code</label>
                <input
                  type="text"
                  placeholder="e.g. SAVE20"
                  className="w-full px-4 py-2 bg-white dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm font-semibold uppercase text-slate-900 dark:text-white"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  disabled={!!editingCode}
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Discount Description</label>
                <input
                  type="text"
                  placeholder="e.g. 20% Discount"
                  className="w-full px-4 py-2 bg-white dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm font-semibold text-slate-900 dark:text-white"
                  value={couponDiscount}
                  onChange={(e) => setCouponDiscount(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Discount Type</label>
                  <select
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm font-semibold text-slate-700 dark:text-slate-200"
                    value={couponType}
                    onChange={(e) => setCouponType(e.target.value as "percentage" | "flat")}
                  >
                    <option value="percentage" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">Percentage (%)</option>
                    <option value="flat" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">Flat Amount (₹)</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Discount Value</label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    placeholder="e.g. 20"
                    className="w-full px-4 py-2 bg-white dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm font-semibold text-slate-900 dark:text-white"
                    value={couponValue}
                    onChange={(e) => setCouponValue(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-550 dark:text-slate-400">Start Date</label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm font-semibold text-slate-900 dark:text-white"
                    value={couponStartDate}
                    onChange={(e) => setCouponStartDate(e.target.value)}
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-550 dark:text-slate-400">Expiry Date</label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm font-semibold text-slate-900 dark:text-white"
                    value={couponExpiryDate}
                    onChange={(e) => setCouponExpiryDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 py-2">
                <input
                  type="checkbox"
                  id="couponStatus"
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/50"
                  checked={couponStatus === "active"}
                  onChange={(e) => setCouponStatus(e.target.checked ? "active" : "inactive")}
                />
                <label htmlFor="couponStatus" className="text-sm font-semibold text-slate-750 dark:text-slate-300">Coupon Active</label>
              </div>

              <div className="flex gap-3 justify-end mt-4">
                <button
                  type="button"
                  onClick={() => setIsCouponModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-650 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 font-semibold text-sm transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingCoupon}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm transition-all shadow-md shadow-blue-500/20"
                >
                  {savingCoupon ? "Saving..." : "Save Coupon"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Coupon Usage Logs Modal */}
      {isUsageModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl animate-scale-up">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1">
              Coupon Usage: {selectedCouponForUsage}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">List of client organizations that successfully checked out with this coupon.</p>
            
            <div className="max-h-60 overflow-y-auto mb-6 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50/50 dark:bg-slate-900/30">
              {loadingUsageLogs ? (
                <div className="py-12 text-center text-slate-550 dark:text-slate-450 animate-pulse text-xs">
                  <ArrowPathIcon className="w-5 h-5 animate-spin mx-auto mb-1 text-blue-500" />
                  Fetching usage history...
                </div>
              ) : usageLogs.length === 0 ? (
                <div className="py-12 text-center text-slate-500 dark:text-slate-400 text-xs">
                  This coupon has not been used yet.
                </div>
              ) : (
                <div className="divide-y divide-slate-200 dark:divide-slate-800">
                  {usageLogs.map((log, idx) => (
                    <div key={idx} className="p-3 text-sm flex justify-between items-center hover:bg-slate-100/50 dark:hover:bg-slate-800/30 transition-colors">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900 dark:text-slate-100">
                          {log.orgname || "Acme Corp"}
                        </span>
                        <span className="text-[10px] font-mono font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                          Code: {log.orgcode}
                        </span>
                      </div>
                      <span className="text-xs text-slate-500 dark:text-slate-400 text-right">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setIsUsageModalOpen(false)}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm transition-all shadow-md shadow-blue-500/20"
              >
                Close Logs
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
