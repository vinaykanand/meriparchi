"use client";

import React, { useEffect, useState } from "react";
import { 
  ChartBarIcon, 
  ArrowPathIcon, 
  CurrencyRupeeIcon, 
  GiftIcon, 
  BuildingOfficeIcon,
  MagnifyingGlassIcon
} from "@heroicons/react/24/outline";

interface SummaryData {
  totalRevenue: number;
  totalReferralsRewarded: number;
  clientCount: number;
}

interface SubscriptionReportRow {
  orgcode: string;
  orgname: string;
  total_paid: string | number;
  payments_count: number;
}

interface ReferralReportRow {
  orgcode: string;
  orgname: string;
  total_earned: string | number;
  referrals_count: number;
}

interface UsageReportRow {
  orgcode: string;
  orgname: string;
  slips_count: string | number;
  payments_count: string | number;
}

export default function ReportsPage() {
  const [summary, setSummary] = useState<SummaryData>({ totalRevenue: 0, totalReferralsRewarded: 0, clientCount: 0 });
  const [subscriptionsReport, setSubscriptionsReport] = useState<SubscriptionReportRow[]>([]);
  const [referralsReport, setReferralsReport] = useState<ReferralReportRow[]>([]);
  const [usageReport, setUsageReport] = useState<UsageReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"subscriptions" | "referrals" | "usage">("subscriptions");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchReports = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/company/super-admin/reports");
      const data = await res.json();
      if (res.ok && data.success) {
        setSummary(data.summary);
        setSubscriptionsReport(data.subscriptionsReport || []);
        setReferralsReport(data.referralsReport || []);
        setUsageReport(data.usageReport || []);
      }
    } catch (error) {
      console.error("Failed to fetch reports:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const getFilteredData = () => {
    const q = searchQuery.toLowerCase().trim();
    if (activeTab === "subscriptions") {
      return subscriptionsReport.filter(r => r.orgname.toLowerCase().includes(q) || r.orgcode.toLowerCase().includes(q));
    } else if (activeTab === "referrals") {
      return referralsReport.filter(r => r.orgname.toLowerCase().includes(q) || r.orgcode.toLowerCase().includes(q));
    } else {
      return usageReport.filter(r => r.orgname.toLowerCase().includes(q) || r.orgcode.toLowerCase().includes(q));
    }
  };

  const maxSubValue = Math.max(...subscriptionsReport.map(r => parseFloat(String(r.total_paid)) || 1), 1);
  const maxRefValue = Math.max(...referralsReport.map(r => parseFloat(String(r.total_earned)) || 1), 1);
  const maxUsageValue = Math.max(...usageReport.map(r => (parseInt(String(r.slips_count)) || 0) + (parseInt(String(r.payments_count)) || 0)), 1);

  return (
    <div className="flex flex-col gap-6 animate-fade-in relative text-slate-900 dark:text-slate-100 max-w-6xl mx-auto">
      {/* Title */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
            <ChartBarIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100">System Analytics & Reports</h2>
            <p className="text-slate-500 text-sm mt-1">Cross-organization subscription revenue, referral performance, and software usage leaderboards.</p>
          </div>
        </div>
        <button
          onClick={fetchReports}
          disabled={loading}
          className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-650 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm disabled:opacity-50 flex items-center gap-1.5 text-xs font-bold"
        >
          <ArrowPathIcon className={`w-4 h-4 ${loading ? "animate-spin text-blue-500" : ""}`} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="bg-white/80 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-2xl p-12 text-center shadow-sm backdrop-blur-xl">
          <ArrowPathIcon className="w-8 h-8 animate-spin text-blue-605 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Aggregating analytical databases...</p>
        </div>
      ) : (
        <>
          {/* Summary Widgets */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white/80 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 backdrop-blur-xl p-6 rounded-2xl shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">Total System Revenue</span>
                <span className="text-3xl font-extrabold text-blue-600 dark:text-blue-405">₹{summary.totalRevenue.toLocaleString()}</span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <CurrencyRupeeIcon className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white/80 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 backdrop-blur-xl p-6 rounded-2xl shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">Referral Rewards Issued</span>
                <span className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-450">₹{summary.totalReferralsRewarded.toLocaleString()}</span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <GiftIcon className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white/80 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 backdrop-blur-xl p-6 rounded-2xl shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">Active Client Orgs</span>
                <span className="text-3xl font-extrabold text-slate-800 dark:text-slate-100">{summary.clientCount}</span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center">
                <BuildingOfficeIcon className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Main reports dashboard card */}
          <div className="bg-white/80 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm backdrop-blur-xl">
            {/* Tabs & Search controls */}
            <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center border-b border-slate-200 dark:border-slate-700 pb-4 mb-6 gap-4">
              <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl w-fit">
                <button
                  onClick={() => { setActiveTab("subscriptions"); setSearchQuery(""); }}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
                    activeTab === "subscriptions"
                      ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm"
                      : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-350"
                  }`}
                >
                  Subscription Payments
                </button>
                <button
                  onClick={() => { setActiveTab("referrals"); setSearchQuery(""); }}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
                    activeTab === "referrals"
                      ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm"
                      : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-350"
                  }`}
                >
                  Referral Points Earned
                </button>
                <button
                  onClick={() => { setActiveTab("usage"); setSearchQuery(""); }}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
                    activeTab === "usage"
                      ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm"
                      : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-350"
                  }`}
                >
                  Usage Leaderboard
                </button>
              </div>

              {/* Search */}
              <div className="relative">
                <MagnifyingGlassIcon className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search client organization..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full md:w-64 pl-9 pr-4 py-2 bg-slate-100 dark:bg-slate-900 border border-transparent focus:border-blue-500 rounded-xl text-xs font-semibold outline-none transition-all text-slate-900 dark:text-white"
                />
              </div>
            </div>

            {/* Tables Container */}
            <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50/50 dark:bg-slate-900/30">
              <table className="w-full text-left border-collapse table-auto">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-550 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider bg-slate-100/50 dark:bg-slate-900/50">
                    <th className="py-3.5 px-4">Organization</th>
                    <th className="py-3.5 px-4">Code</th>
                    {activeTab === "subscriptions" && (
                      <>
                        <th className="py-3.5 px-4 text-right">Payments count</th>
                        <th className="py-3.5 px-4 text-right">Total Contributed</th>
                        <th className="py-3.5 px-4 w-1/3">Share of Revenue</th>
                      </>
                    )}
                    {activeTab === "referrals" && (
                      <>
                        <th className="py-3.5 px-4 text-right">Referral Count</th>
                        <th className="py-3.5 px-4 text-right">Points Earned</th>
                        <th className="py-3.5 px-4 w-1/3">Earned Share</th>
                      </>
                    )}
                    {activeTab === "usage" && (
                      <>
                        <th className="py-3.5 px-4 text-right">Slips Created</th>
                        <th className="py-3.5 px-4 text-right">Payments Taken</th>
                        <th className="py-3.5 px-4 text-right">Activity Score</th>
                        <th className="py-3.5 px-4 w-1/3">Usage Level</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                  {getFilteredData().length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-450 font-medium">
                        No report entries match your search filters.
                      </td>
                    </tr>
                  ) : (
                    getFilteredData().map((row) => {
                      return (
                        <tr key={row.orgcode} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/10 transition-colors">
                          <td className="py-3 px-4 font-bold text-slate-800 dark:text-slate-200">
                            {row.orgname}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold uppercase text-slate-500">
                            {row.orgcode}
                          </td>
                          
                          {/* SUBSCRIPTIONS TAB VIEW */}
                          {activeTab === "subscriptions" && (
                            <>
                              <td className="py-3 px-4 text-right font-semibold text-slate-600 dark:text-slate-350">
                                {(row as SubscriptionReportRow).payments_count}
                              </td>
                              <td className="py-3 px-4 text-right font-extrabold text-blue-600 dark:text-blue-400">
                                ₹{parseFloat(String((row as SubscriptionReportRow).total_paid)).toLocaleString()}
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                    <div 
                                      className="bg-blue-650 h-full rounded-full" 
                                      style={{ width: `${Math.min(100, (parseFloat(String((row as SubscriptionReportRow).total_paid)) / maxSubValue) * 100)}%` }}
                                    />
                                  </div>
                                  <span className="font-bold text-[10px] text-slate-450 min-w-[28px] text-right">
                                    {Math.round((parseFloat(String((row as SubscriptionReportRow).total_paid)) / maxSubValue) * 100)}%
                                  </span>
                                </div>
                              </td>
                            </>
                          )}

                          {/* REFERRALS TAB VIEW */}
                          {activeTab === "referrals" && (
                            <>
                              <td className="py-3 px-4 text-right font-semibold text-slate-600 dark:text-slate-350">
                                {(row as ReferralReportRow).referrals_count}
                              </td>
                              <td className="py-3 px-4 text-right font-extrabold text-emerald-600 dark:text-emerald-400">
                                ₹{parseFloat(String((row as ReferralReportRow).total_earned)).toLocaleString()}
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                    <div 
                                      className="bg-emerald-650 h-full rounded-full" 
                                      style={{ width: `${Math.min(100, (parseFloat(String((row as ReferralReportRow).total_earned)) / maxRefValue) * 100)}%` }}
                                    />
                                  </div>
                                  <span className="font-bold text-[10px] text-slate-450 min-w-[28px] text-right">
                                    {Math.round((parseFloat(String((row as ReferralReportRow).total_earned)) / maxRefValue) * 100)}%
                                  </span>
                                </div>
                              </td>
                            </>
                          )}

                          {/* USAGE TAB VIEW */}
                          {activeTab === "usage" && (() => {
                            const slips = parseInt(String((row as UsageReportRow).slips_count)) || 0;
                            const pymts = parseInt(String((row as UsageReportRow).payments_count)) || 0;
                            const score = slips + pymts;
                            return (
                              <>
                                <td className="py-3 px-4 text-right font-semibold text-slate-600 dark:text-slate-350">
                                  {slips.toLocaleString()}
                                </td>
                                <td className="py-3 px-4 text-right font-semibold text-slate-600 dark:text-slate-350">
                                  {pymts.toLocaleString()}
                                </td>
                                <td className="py-3 px-4 text-right font-extrabold text-violet-600 dark:text-violet-400">
                                  {score.toLocaleString()}
                                </td>
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                      <div 
                                        className="bg-violet-650 h-full rounded-full" 
                                        style={{ width: `${Math.min(100, (score / maxUsageValue) * 100)}%` }}
                                      />
                                    </div>
                                    <span className="font-bold text-[10px] text-slate-450 min-w-[28px] text-right">
                                      {Math.round((score / maxUsageValue) * 100)}%
                                    </span>
                                  </div>
                                </td>
                              </>
                            );
                          })()}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
