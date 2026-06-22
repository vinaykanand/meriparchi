"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { CreditCardIcon, CalendarIcon, ArrowPathIcon } from "@heroicons/react/24/outline";

interface Toast {
  id: number;
  message: string;
  type: "success" | "error" | "info";
}

interface Plan {
  plan_key: string;
  plan_name: string;
  price: string;
  duration_months: number;
}

export default function AdminBillingPage() {
  const { session } = useAuth();
  const [subscription, setSubscription] = useState<{
    type: string;
    start: string;
    end: string;
    remaining_days: number;
  } | null>(null);

  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlanKey, setSelectedPlanKey] = useState<string>("monthly");

  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (message: string, type: "success" | "error" | "info") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  };

  const fetchSubscription = async () => {
    if (!session?.orgcode) return;
    try {
      const res = await fetch(`/api/company?orgcode=${session.orgcode}`);
      const data = await res.json();
      if (res.ok && data.success && data.company?.subscription) {
        const sub = data.company.subscription;
        let remaining = 0;
        if (sub.end) {
          const diff = new Date(sub.end).getTime() - new Date().getTime();
          remaining = diff / (1000 * 60 * 60 * 24);
        }
        setSubscription({
          type: sub.type,
          start: sub.start,
          end: sub.end,
          remaining_days: remaining,
        });
      } else {
        addToast("Failed to load subscription details", "error");
      }
    } catch {
      addToast("Failed to connect to backend", "error");
    }
  };

  const fetchPlans = async () => {
    try {
      const res = await fetch("/api/pricing-plans");
      const data = await res.json();
      if (res.ok && data.success) {
        setPlans(data.plans || []);
        if (data.plans && data.plans.length > 0) {
          setSelectedPlanKey(data.plans[0].plan_key);
        }
      }
    } catch {
      addToast("Failed to fetch pricing plans", "error");
    }
  };

  useEffect(() => {
    const initData = async () => {
      setLoading(true);
      await Promise.all([fetchSubscription(), fetchPlans()]);
      setLoading(false);
    };
    initData();
  }, [session]);

  const loadRazorpayScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if ((window as any).Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleUpgradePayment = async () => {
    if (!session) return;
    setPaying(true);
    try {
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        addToast("Failed to load Razorpay checkout script. Please check your internet connection.", "error");
        setPaying(false);
        return;
      }

      // Create order with planKey
      const res = await fetch("/api/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planKey: selectedPlanKey }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        addToast(data.message || "Failed to initiate payment order.", "error");
        setPaying(false);
        return;
      }

      const keyId = "rzp_live_T4gRvLc5YGFC66";
      const options = {
        key: keyId,
        amount: data.amount,
        currency: data.currency,
        name: "Parchi Subscription",
        description: `Upgrade/Renew to Premium ${selectedPlanKey.replace("_", " ")} Plan`,
        order_id: data.order_id,
        handler: async function (response: any) {
          console.log("Razorpay payment success handler triggered!", response);
          addToast("Payment successful! Verifying signature...", "info");
          try {
            const verifyRes = await fetch("/api/verify-payment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                planKey: selectedPlanKey
              }),
            });

            const verifyData = await verifyRes.json();
            console.log("Verify API payment verification result:", verifyData);
            if (verifyRes.ok && verifyData.success) {
              addToast("Payment verified! Subscription upgraded.", "success");
              fetchSubscription();
              window.dispatchEvent(new Event("company-settings-updated"));
            } else {
              addToast(verifyData.message || "Payment verification failed.", "error");
            }
          } catch (e: any) {
            console.error("Error verifying payment signature:", e);
            addToast("Error verifying payment signature.", "error");
          }
        },
        prefill: {
          name: session.userid,
        },
        theme: {
          color: "#2563eb",
        },
        modal: {
          ondismiss: function () {
            addToast("Payment checkout cancelled by user.", "info");
          }
        }
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on("payment.failed", function (response: any) {
        addToast(response.error.description || "Payment failed. Please try again.", "error");
      });
      rzp.open();
    } catch (err: any) {
      addToast(err.message || "An error occurred during checkout.", "error");
    } finally {
      setPaying(false);
    }
  };

  const isExpired = subscription && subscription.remaining_days <= 0;

  return (
    <div className="flex flex-col gap-6 animate-fade-in relative max-w-2xl">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
          <CreditCardIcon className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Billing & Subscription</h2>
          <p className="text-slate-500 text-sm mt-1">Manage and renew your client organization plan.</p>
        </div>
      </div>

      {loading ? (
        <div className="bg-white/80 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-2xl p-12 text-center shadow-sm backdrop-blur-xl">
          <ArrowPathIcon className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Fetching subscription details...</p>
        </div>
      ) : subscription ? (
        <div className="flex flex-col gap-6">
          {/* Status Panel */}
          <div className="bg-white/80 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm backdrop-blur-xl">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-700 pb-3 mb-5">Subscription Information</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Current Plan</div>
                <div className="font-bold text-lg text-slate-950 dark:text-slate-100 capitalize">
                  {subscription.type === "trial" ? "10-Day Trial" : `${subscription.type.replace("_", " ")} plan`}
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Status</div>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                  isExpired 
                    ? "bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400" 
                    : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
                }`}>
                  {isExpired ? "Expired" : "Active"}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-3 py-2 text-sm text-slate-600 dark:text-slate-400">
              {subscription.start && (
                <div className="flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4 text-slate-400" />
                  <span>Plan Start Date: {new Date(subscription.start).toLocaleDateString()}</span>
                </div>
              )}
              {subscription.end && (
                <div className="flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4 text-slate-400" />
                  <span>
                    {isExpired ? "Expired Date" : "Expiry Date"}: {new Date(subscription.end).toLocaleDateString()} 
                    {!isExpired && ` (${Math.ceil(subscription.remaining_days)} days left)`}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Checkout Panel */}
          <div className="bg-white/80 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm backdrop-blur-xl">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-700 pb-3 mb-4">Choose Pricing Plan & Checkout</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
              {plans.map((p) => {
                const isSelected = selectedPlanKey === p.plan_key;
                return (
                  <button
                    key={p.plan_key}
                    type="button"
                    onClick={() => setSelectedPlanKey(p.plan_key)}
                    className={`p-4 rounded-xl text-left border transition-all flex flex-col gap-1.5 ${
                      isSelected 
                        ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/20 text-blue-900 dark:text-blue-300 ring-2 ring-blue-500/20"
                        : "border-slate-200 dark:border-slate-700 bg-slate-50/30 dark:bg-slate-900/30 text-slate-700 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900"
                    }`}
                  >
                    <span className="font-bold text-slate-900 dark:text-slate-100">{p.plan_name}</span>
                    <span className="text-xs text-slate-500">{p.duration_months} Month(s) Validity</span>
                    <span className="font-extrabold text-lg mt-1 text-blue-600 dark:text-blue-400">₹{p.price}</span>
                  </button>
                );
              })}
            </div>

            <div className="bg-blue-50 dark:bg-blue-950/20 p-5 rounded-xl border border-blue-200 dark:border-blue-900 text-sm flex flex-col gap-4">
              <div>
                <div className="font-bold text-blue-950 dark:text-blue-300 text-base">Extend Pro Subscription</div>
                <div className="text-xs text-blue-700 dark:text-blue-400 mt-1">
                  Enjoy unlimited slips, payments logs, backup automation, and access to the AI Assistant.
                </div>
              </div>

              <button
                type="button"
                onClick={handleUpgradePayment}
                disabled={paying || plans.length === 0}
                className="w-full py-3 px-4 rounded-xl text-white font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 transition-all shadow-[0_4px_12px_rgba(37,99,235,0.3)] flex items-center justify-center gap-2"
              >
                {paying ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    <span>Processing Payment Checkout...</span>
                  </>
                ) : (
                  <>
                    <CreditCardIcon className="w-5 h-5" />
                    <span>Pay & Upgrade Plan</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white/80 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 text-center text-slate-500 shadow-sm">
          Failed to load company registration information.
        </div>
      )}

      {/* Toasts container */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((toast) => (
          <div 
            key={toast.id} 
            className={`px-4 py-3 rounded-xl shadow-xl text-white text-sm font-semibold animate-slide-up flex items-center gap-2 ${
              toast.type === "error" 
                ? "bg-red-500" 
                : toast.type === "success" 
                  ? "bg-green-500" 
                  : "bg-blue-500"
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
}
