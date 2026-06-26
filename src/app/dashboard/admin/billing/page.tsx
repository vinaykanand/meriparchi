"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { CreditCardIcon, CalendarIcon, ArrowPathIcon, TagIcon, ArrowDownTrayIcon, CheckIcon } from "@heroicons/react/24/outline";

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

interface PaymentRecord {
  id: number;
  order_id: string;
  payment_id: string;
  plan_key: string;
  amount: string;
  coupon_code: string | null;
  timestamp: string;
  invoice_url: string | null;
  points_redeemed?: string | null;
}

interface ReferralReward {
  id: number;
  date: string;
  referredCompany: string;
  referredOrgname: string;
  paymentAmount: number;
  rewardPoints: number;
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
  const [billingPlanTab, setBillingPlanTab] = useState<"simple" | "inventory">("simple");

  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Coupon states
  const [couponCode, setCouponCode] = useState("");
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [appliedCouponInfo, setAppliedCouponInfo] = useState<{
    code: string;
    discountDescription: string;
    discountVal: number;
    discountType: string;
    appliedPrice: number;
  } | null>(null);

  // Payment history states
  const [history, setHistory] = useState<PaymentRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Referral states
  const [referralCodeVal, setReferralCodeVal] = useState("");
  const [referralPointsVal, setReferralPointsVal] = useState(0);
  const [redeemPoints, setRedeemPoints] = useState(false);
  const [copiedReferral, setCopiedReferral] = useState(false);
  const [showReferralHistory, setShowReferralHistory] = useState(false);
  const [referralHistory, setReferralHistory] = useState<ReferralReward[]>([]);
  const [referralHistoryMeta, setReferralHistoryMeta] = useState<{ referredCount: number; totalEarned: number; totalRedeemed: number } | null>(null);
  const [loadingReferralHistory, setLoadingReferralHistory] = useState(false);

  const addToast = (message: string, type: "success" | "error" | "info") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  };

  const fetchSubscription = async () => {
    if (!session?.orgcode) return null;
    try {
      const res = await fetch(`/api/company?orgcode=${session.orgcode}`);
      const data = await res.json();
      if (res.ok && data.success && data.company?.subscription) {
        const sub = data.company.subscription;
        setReferralCodeVal(data.company.referral_code || "");
        setReferralPointsVal(parseFloat(data.company.referral_points || "0"));
        const subInfo = {
          type: sub.type,
          start: sub.start,
          end: sub.end,
          remaining_days: sub.remaining_days || 0,
        };
        setSubscription(subInfo);
        return subInfo;
      } else {
        addToast("Failed to load subscription details", "error");
      }
    } catch {
      addToast("Failed to connect to backend", "error");
    }
    return null;
  };

  const fetchPlans = async () => {
    try {
      const res = await fetch("/api/pricing-plans");
      const data = await res.json();
      if (res.ok && data.success) {
        const plansList = data.plans || [];
        setPlans(plansList);
        return plansList;
      } else {
        addToast("Failed to fetch pricing plans", "error");
      }
    } catch {
      addToast("Failed to fetch pricing plans", "error");
    }
    return [];
  };

  const fetchPaymentHistory = async () => {
    if (!session?.orgcode) return;
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/company/payment-history?orgcode=${session.orgcode}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setHistory(data.history || []);
      }
    } catch {
      console.error("Failed to load payment history");
    } finally {
      setLoadingHistory(false);
    }
  };

  const fetchReferralHistory = async () => {
    if (!session?.orgcode) return;
    setLoadingReferralHistory(true);
    try {
      const res = await fetch(`/api/company/referral-history?orgcode=${session.orgcode}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setReferralHistory(data.rewards || []);
        setReferralHistoryMeta({
          referredCount: data.referredCount || 0,
          totalEarned: data.totalEarned || 0,
          totalRedeemed: data.totalRedeemed || 0,
        });
        // Sync the summary card balance from this API — it's the authoritative fresh value
        setReferralPointsVal(parseFloat(data.referralPoints || "0"));
      }
    } catch {
      console.error("Failed to load referral history");
    } finally {
      setLoadingReferralHistory(false);
    }
  };

  useEffect(() => {
    const initData = async () => {
      setLoading(true);
      // Fetch referral history alongside other data so the points balance is always fresh
      const [subData, plansData] = await Promise.all([
        fetchSubscription(),
        fetchPlans(),
        fetchPaymentHistory(),
        fetchReferralHistory()
      ]);

      if (subData && plansData && plansData.length > 0) {
        const activePlanExists = plansData.some((p: Plan) => p.plan_key === subData.type);
        const isSubExpired = subData.remaining_days <= 0;

        if (activePlanExists && !isSubExpired) {
          setSelectedPlanKey(subData.type);
          if (subData.type.includes("inventory")) {
            setBillingPlanTab("inventory");
          } else {
            setBillingPlanTab("simple");
          }
        } else {
          // If trial or expired, default tab
          const hasInv = subData.type.includes("inventory") || subData.type === "trial";
          const defaultTab = hasInv ? "inventory" : "simple";
          setBillingPlanTab(defaultTab);
          
          const match = plansData.find((p: Plan) => {
            const isPlanInv = p.plan_key.endsWith("_inventory");
            return defaultTab === "inventory" ? isPlanInv : !isPlanInv;
          });
          if (match) {
            setSelectedPlanKey(match.plan_key);
          } else {
            setSelectedPlanKey(plansData[0].plan_key);
          }
        }
      } else if (plansData && plansData.length > 0) {
        setSelectedPlanKey(plansData[0].plan_key);
      }
      
      setLoading(false);
    };
    initData();
  }, [session]);

  const handleTabChange = (tab: "simple" | "inventory") => {
    setBillingPlanTab(tab);
    
    // Check if the active plan (if any) matches the clicked tab
    const isSubInv = subscription && subscription.type.includes("inventory");
    const isSubActive = subscription && subscription.remaining_days > 0;
    const activePlanMatchesTab = isSubActive && ((tab === "inventory" && isSubInv) || (tab === "simple" && !isSubInv));
    
    if (activePlanMatchesTab && subscription) {
      setSelectedPlanKey(subscription.type);
    } else {
      // Otherwise select the first plan in the new tab
      const match = plans.find(p => {
        const isInv = p.plan_key.endsWith("_inventory");
        return tab === "inventory" ? isInv : !isInv;
      });
      if (match) setSelectedPlanKey(match.plan_key);
    }
  };

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

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setApplyingCoupon(true);
    try {
      const res = await fetch("/api/coupons");
      const data = await res.json();
      if (res.ok && data.success) {
        const coupon = data.coupons.find(
          (c: any) => c.code === couponCode.trim().toUpperCase() && c.status === "active"
        );
        if (coupon) {
          const now = new Date();
          const start = new Date(coupon.start_date);
          const expiry = new Date(coupon.expiry_date);
          if (now >= start && now <= expiry) {
            const selectedPlan = plans.find(p => p.plan_key === selectedPlanKey);
            if (selectedPlan) {
              const price = parseFloat(selectedPlan.price);

              if (price <= 1.00) {
                addToast("Minimum transaction amount is ₹1.00. Coupon cannot be applied to this plan.", "error");
                setApplyingCoupon(false);
                return;
              }

              const value = parseFloat(coupon.value);
              let discount = 0;
              if (coupon.type === "percentage") {
                discount = (price * value) / 100;
              } else {
                discount = value;
              }

              if (price - discount < 1.00) {
                discount = price - 1.00;
                addToast("Coupon discount adjusted to maintain the minimum payment of ₹1.00.", "info");
              }

              const appliedPrice = price - discount;
              setAppliedCouponInfo({
                code: coupon.code,
                discountDescription: coupon.discount,
                discountVal: discount,
                discountType: coupon.type,
                appliedPrice
              });
              addToast("Coupon applied successfully!", "success");
            }
          } else {
            addToast("This coupon is expired or not active yet", "error");
          }
        } else {
          addToast("Invalid or inactive coupon code", "error");
        }
      } else {
        addToast("Failed to fetch coupons", "error");
      }
    } catch {
      addToast("Failed to validate coupon", "error");
    } finally {
      setApplyingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCouponInfo(null);
    setCouponCode("");
    addToast("Coupon removed", "info");
  };

  // Reset coupon when changing plan
  useEffect(() => {
    setAppliedCouponInfo(null);
    setCouponCode("");
  }, [selectedPlanKey]);

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

      // Create order with planKey and optional couponCode
      const res = await fetch("/api/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          planKey: selectedPlanKey,
          couponCode: appliedCouponInfo ? appliedCouponInfo.code : undefined,
          redeemPoints: redeemPoints
        }),
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
                planKey: selectedPlanKey,
                couponCode: appliedCouponInfo ? appliedCouponInfo.code : undefined,
                redeemPoints: redeemPoints
              }),
            });

            const verifyData = await verifyRes.json();
            console.log("Verify API payment verification result:", verifyData);
            if (verifyRes.ok && verifyData.success) {
              addToast("Payment verified! Subscription upgraded.", "success");
              setAppliedCouponInfo(null);
              setCouponCode("");
              setRedeemPoints(false);
              fetchSubscription();
              fetchPaymentHistory();
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
    <div className="flex flex-col gap-6 animate-fade-in relative max-w-4xl text-slate-900 dark:text-slate-100">
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-w-0">
          <div className="lg:col-span-2 flex flex-col gap-6 min-w-0">
            {/* Status Panel */}
            <div className="bg-white/80 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm backdrop-blur-xl animate-fade-in">
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

            {/* Referral Info Panel */}
            <div className="bg-white/80 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm backdrop-blur-xl animate-fade-in">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-700 pb-3 mb-5">Refer &amp; Earn Program</h3>

              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
                Invite other organizations to join Parchi. Share your unique referral code below.
                When they sign up and make <strong className="text-slate-700 dark:text-slate-300">any successful payment</strong>, you earn <strong className="text-emerald-600 dark:text-emerald-400">10%</strong> of their payment amount as referral points!
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                {/* Referral Code */}
                <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col gap-1.5 justify-center">
                  <div className="text-xs text-slate-500 uppercase font-bold tracking-wider">Your Referral Code</div>
                  <div className="flex gap-2 items-center">
                    <span className="font-mono font-extrabold text-lg text-slate-950 dark:text-slate-100 uppercase select-all bg-white dark:bg-slate-950 px-2.5 py-1 rounded border border-slate-250 dark:border-slate-750">
                      {referralCodeVal || "Generating..."}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(referralCodeVal);
                        setCopiedReferral(true);
                        setTimeout(() => setCopiedReferral(false), 2000);
                      }}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                    >
                      {copiedReferral ? "Copied!" : "Copy"}
                    </button>
                  </div>
                </div>

                {/* Points Balance — always shown, clickable to toggle history */}
                <button
                  type="button"
                  onClick={() => {
                    if (!showReferralHistory) fetchReferralHistory();
                    setShowReferralHistory((v) => !v);
                  }}
                  className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 text-left transition-all hover:border-emerald-400 hover:ring-2 hover:ring-emerald-400/20 group"
                >
                  <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1 flex items-center justify-between">
                    Referral Points Balance
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold group-hover:underline">
                      {showReferralHistory ? "Hide History ↑" : "View History →"}
                    </span>
                  </div>
                  <div className="font-mono font-extrabold text-3xl text-emerald-600 dark:text-emerald-400">
                    ₹{referralPointsVal.toFixed(2)}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">1 point = ₹1 discount on payments</p>
                </button>
              </div>

              {/* Referral History Panel */}
              {showReferralHistory && (
                <div className="mt-2 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden animate-fade-in">
                  {/* Stats bar — 3 columns showing full Earned → Redeemed → Balance breakdown */}
                  {referralHistoryMeta && (
                    <div className="grid grid-cols-3 divide-x divide-slate-200 dark:divide-slate-700 bg-emerald-50 dark:bg-emerald-950/20 border-b border-slate-200 dark:border-slate-700">
                      <div className="p-3 flex flex-col gap-0.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Orgs Referred</span>
                        <span className="text-lg font-extrabold text-slate-800 dark:text-slate-100">{referralHistoryMeta.referredCount}</span>
                      </div>
                      <div className="p-3 flex flex-col gap-0.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Earned</span>
                        <span className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">+₹{referralHistoryMeta.totalEarned.toFixed(2)}</span>
                        <span className="text-[10px] text-slate-400">all time</span>
                      </div>
                      <div className="p-3 flex flex-col gap-0.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Used as Discount</span>
                        <span className="text-lg font-extrabold text-rose-500 dark:text-rose-400">−₹{referralHistoryMeta.totalRedeemed.toFixed(2)}</span>
                        <span className="text-[10px] text-slate-400">= ₹{referralPointsVal.toFixed(2)} balance</span>
                      </div>
                    </div>
                  )}

                  {loadingReferralHistory ? (
                    <div className="py-8 flex items-center justify-center gap-2 text-sm text-slate-400">
                      <ArrowPathIcon className="w-4 h-4 animate-spin text-emerald-500" />
                      Loading referral history...
                    </div>
                  ) : referralHistory.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 text-xs">
                      <div className="text-2xl mb-2">🎯</div>
                      No referral rewards yet. Share your code to start earning!
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[500px] text-left text-sm">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            <th className="py-2.5 px-4">Date</th>
                            <th className="py-2.5 px-4">Referred Org</th>
                            <th className="py-2.5 px-4 text-right">Their Payment</th>
                            <th className="py-2.5 px-4 text-right">Points Earned</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {referralHistory.map((r) => (
                            <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/10 transition-colors">
                              <td className="py-2.5 px-4 text-xs text-slate-500 whitespace-nowrap">
                                {new Date(r.date).toLocaleDateString()} {new Date(r.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </td>
                              <td className="py-2.5 px-4">
                                <div className="flex flex-col gap-0.5">
                                  <span className="font-semibold text-xs text-slate-800 dark:text-slate-200">
                                    {r.referredOrgname || r.referredCompany}
                                  </span>
                                  <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500">
                                    {r.referredCompany}
                                  </span>
                                </div>
                              </td>
                              <td className="py-2.5 px-4 text-right font-semibold text-xs text-slate-700 dark:text-slate-300">
                                ₹{r.paymentAmount.toFixed(2)}
                              </td>
                              <td className="py-2.5 px-4 text-right">
                                <span className="inline-flex items-center gap-1 font-bold text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded-full">
                                  +₹{r.rewardPoints.toFixed(2)}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-slate-50 dark:bg-slate-900/30 border-t border-slate-200 dark:border-slate-700">
                            <td colSpan={3} className="py-2.5 px-4 text-xs font-bold text-slate-600 dark:text-slate-400 text-right">Current Balance:</td>
                            <td className="py-2.5 px-4 text-right">
                              <span className="font-extrabold text-sm text-emerald-600 dark:text-emerald-400">₹{referralPointsVal.toFixed(2)}</span>
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Invoices List */}
            <div className="bg-white/80 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm backdrop-blur-xl animate-fade-in">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-700 pb-3 mb-4">Past Invoices & Receipts</h3>
              
              {loadingHistory ? (
                <div className="py-6 text-center text-slate-400 animate-pulse text-xs">
                  <ArrowPathIcon className="w-5 h-5 animate-spin mx-auto mb-1 text-blue-500" />
                  Loading payment logs...
                </div>
              ) : history.length === 0 ? (
                <div className="py-8 text-center text-slate-500 border border-dashed border-slate-250 dark:border-slate-700 rounded-xl text-xs">
                  No subscription invoice records found.
                </div>
              ) : (
                <div className="border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50/50 dark:bg-slate-900/30 overflow-hidden">
                  <table className="w-full text-left border-collapse table-auto">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider bg-slate-100/50 dark:bg-slate-900/50">
                        <th className="py-3 px-2 whitespace-nowrap">Date</th>
                        <th className="py-3 px-2 whitespace-nowrap">Plan</th>
                        <th className="py-3 px-2 whitespace-nowrap">Amount Paid</th>
                        <th className="py-3 px-2 whitespace-nowrap">Coupon</th>
                        <th className="py-3 px-2 whitespace-nowrap">Points Redeemed</th>
                        <th className="py-3 px-2 text-right whitespace-nowrap">Invoice</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                      {history.map((record) => (
                        <tr key={record.id} className="hover:bg-slate-50/30 dark:hover:bg-slate-700/10 transition-colors">
                          <td className="py-2.5 px-2 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                            {new Date(record.timestamp).toLocaleDateString()}
                          </td>
                          <td className="py-2.5 px-2 font-bold capitalize whitespace-nowrap">
                            {record.plan_key.replace("_", " ")}
                          </td>
                          <td className="py-2.5 px-2 font-extrabold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                            ₹{record.amount}
                          </td>
                          <td className="py-2.5 px-2 whitespace-nowrap">
                            {record.coupon_code ? (
                              <span className="inline-flex px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 text-[9px] font-bold uppercase font-mono">
                                {record.coupon_code}
                              </span>
                            ) : (
                              <span className="text-slate-450 text-[11px]">-</span>
                            )}
                          </td>
                          <td className="py-2.5 px-2 whitespace-nowrap">
                            {record.points_redeemed && parseFloat(record.points_redeemed) > 0 ? (
                              <span className="inline-flex px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 text-[9px] font-bold">
                                -₹{parseFloat(record.points_redeemed).toFixed(2)}
                              </span>
                            ) : (
                              <span className="text-slate-450 text-[11px]">-</span>
                            )}
                          </td>
                          <td className="py-2.5 px-2 text-right whitespace-nowrap">
                            {record.invoice_url ? (
                              <a
                                href={record.invoice_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-750 text-[10px] font-bold text-blue-600 dark:text-blue-400 rounded hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
                              >
                                <ArrowDownTrayIcon className="w-3 h-3" />
                                Receipt
                              </a>
                            ) : (
                              <span className="text-slate-400 text-[10px] font-medium whitespace-nowrap">Standard</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Checkout Column */}
          <div className="bg-white/80 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm backdrop-blur-xl h-fit">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-700 pb-3 mb-4">Pricing Plans</h3>
            
             {/* Tabs for Simple vs Inventory */}
            <div className="flex border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden mb-4 p-0.5 bg-slate-150/40 dark:bg-slate-900/60">
              <button
                type="button"
                onClick={() => handleTabChange("simple")}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  billingPlanTab === "simple"
                    ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm"
                    : "text-slate-500 hover:text-slate-750 dark:hover:text-slate-350"
                }`}
              >
                Simple Parchi
              </button>
              <button
                type="button"
                onClick={() => handleTabChange("inventory")}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  billingPlanTab === "inventory"
                    ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm"
                    : "text-slate-500 hover:text-slate-750 dark:hover:text-slate-350"
                }`}
              >
                Parchi + Inventory
              </button>
            </div>

            <div className="flex flex-col gap-3 mb-5">
              {plans
                .filter((p) => {
                  const isInv = p.plan_key.endsWith("_inventory");
                  return billingPlanTab === "inventory" ? isInv : !isInv;
                })
                .map((p) => {
                  const isSelected = selectedPlanKey === p.plan_key;
                  const isActivePlan = subscription && subscription.type === p.plan_key && !isExpired;
                  return (
                    <button
                      key={p.plan_key}
                      type="button"
                      onClick={() => setSelectedPlanKey(p.plan_key)}
                      className={`p-4 rounded-xl text-left border transition-all flex flex-col gap-1 ${
                        isSelected 
                          ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/20 text-blue-900 dark:text-blue-300 ring-2 ring-blue-500/20"
                          : "border-slate-200 dark:border-slate-700 bg-slate-50/30 dark:bg-slate-900/30 text-slate-700 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900"
                      }`}
                    >
                      <div className="flex justify-between items-center w-full">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 dark:text-slate-100">
                            {p.plan_name.replace(" with Inventory", "")}
                          </span>
                          {isActivePlan && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                              Active
                              <CheckIcon className="w-3 h-3 stroke-[3]" />
                            </span>
                          )}
                        </div>
                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                          isSelected 
                            ? "border-blue-600 bg-blue-50 dark:bg-blue-900/30" 
                            : "border-slate-300 dark:border-slate-700 bg-transparent"
                        }`}>
                          {isSelected && (
                            <div className="w-2.5 h-2.5 rounded-full bg-blue-600 dark:bg-blue-400"></div>
                          )}
                        </div>
                      </div>
                      <span className="text-xs text-slate-500">{p.duration_months} Month(s) Validity</span>
                      <span className="font-extrabold text-lg mt-1 text-blue-600 dark:text-blue-400">₹{p.price}</span>
                    </button>
                  );
                })}
            </div>

            {/* Coupon Application Box */}
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-250 dark:border-slate-700 mb-5 flex flex-col gap-3">
              <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-350 text-xs font-bold uppercase tracking-wider">
                <TagIcon className="w-4 h-4 text-blue-500" />
                Promo / Coupon Code
              </div>

              {!appliedCouponInfo ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. WELCOME50"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    className="flex-1 min-w-0 px-3 py-1.5 text-sm uppercase bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-650 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={handleApplyCoupon}
                    disabled={applyingCoupon || !couponCode.trim()}
                    className="px-3.5 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 transition-colors whitespace-nowrap"
                  >
                    {applyingCoupon ? "Applying..." : "Apply"}
                  </button>
                </div>
              ) : (
                <div className="flex justify-between items-center bg-blue-50 dark:bg-blue-950/30 p-2.5 rounded-lg border border-blue-200 dark:border-blue-900/50 text-xs">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-mono font-bold text-blue-700 dark:text-blue-400 uppercase">{appliedCouponInfo.code}</span>
                    <span className="text-slate-500 dark:text-slate-400 font-semibold">{appliedCouponInfo.discountDescription} applied</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveCoupon}
                    className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>

            {/* Referral Points Application Box */}
            {referralPointsVal > 0 && (
              <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-250 dark:border-slate-700 mb-5 flex items-center justify-between">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-350 uppercase tracking-wider">Redeem Referral Points</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">Available: ₹{referralPointsVal.toFixed(2)}</span>
                </div>
                <input
                  type="checkbox"
                  checked={redeemPoints}
                  onChange={(e) => setRedeemPoints(e.target.checked)}
                  className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
              </div>
            )}

            {/* Total Pricing calculation */}
            <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-xl border border-blue-200 dark:border-blue-900 text-sm flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-xs text-slate-500 font-bold">
                  <span>PLAN PRICE:</span>
                  <span>₹{plans.find(p => p.plan_key === selectedPlanKey)?.price}</span>
                </div>
                {appliedCouponInfo && (
                  <div className="flex justify-between text-xs text-rose-600 dark:text-rose-450 font-bold">
                    <span>COUPON DISCOUNT:</span>
                    <span>-₹{appliedCouponInfo.discountVal.toFixed(2)}</span>
                  </div>
                )}
                {(() => {
                  const planPrice = parseFloat(plans.find(p => p.plan_key === selectedPlanKey)?.price || "0");
                  const couponDiscount = appliedCouponInfo ? appliedCouponInfo.discountVal : 0;
                  const priceAfterCoupon = planPrice - couponDiscount;
                  let pointsDiscountApplied = 0;
                  if (redeemPoints && referralPointsVal > 0) {
                    const maxRedeemable = Math.max(0, priceAfterCoupon - 1.00);
                    pointsDiscountApplied = Math.min(referralPointsVal, maxRedeemable);
                  }
                  const finalTotal = priceAfterCoupon - pointsDiscountApplied;
                  return (
                    <>
                      {pointsDiscountApplied > 0 && (
                        <div className="flex justify-between text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                          <span>POINTS APPLIED:</span>
                          <span>-₹{pointsDiscountApplied.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between border-t border-slate-200 dark:border-blue-900 pt-2 font-bold text-blue-950 dark:text-blue-300 text-base">
                        <span>TOTAL DUE:</span>
                        <span>₹{finalTotal.toFixed(2)}</span>
                      </div>
                    </>
                  );
                })()}
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
                    <span>Processing...</span>
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
