"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useRouter } from "next/navigation";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';

export default function AdminOverview() {
  const { session } = useAuth();
  const router = useRouter();

  const [initialLoading, setInitialLoading] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);
  const [trendLoading, setTrendLoading] = useState(false);
  const [dashboardData, setDashboardData] = useState<{
    hasInventory: boolean;
    kpis: {
      totalOutstanding: number;
      revenueToday: number;
      paymentsToday: number;
      returnsToday: number;
      slipsToday: number;
    };
    trend: any[];
    topDebtors: any[];
    topItems: any[];
    vouchers: any[];
    lowStockItems: any[];
    debtAgingSummary?: {
      aging_0_30: number;
      aging_31_60: number;
      aging_61_90: number;
      aging_90_plus: number;
      total: number;
    };
  }>({
    hasInventory: false,
    kpis: {
      totalOutstanding: 0,
      revenueToday: 0,
      paymentsToday: 0,
      returnsToday: 0,
      slipsToday: 0,
    },
    trend: [],
    topDebtors: [],
    topItems: [],
    vouchers: [],
    lowStockItems: []
  });

  const [selectedVoucherDetails, setSelectedVoucherDetails] = useState<any | null>(null);
  const [loadingVoucherDetails, setLoadingVoucherDetails] = useState(false);

  const handleVoucherClick = (voucherId: number) => {
    router.push(`/dashboard/admin/inventory/transactions?editVoucherId=${voucherId}`);
  };

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!session?.orgcode) return;
      try {
        setTrendLoading(true);
        const res = await fetch(`/api/dashboard?orgcode=${session.orgcode}&weekOffset=${weekOffset}`);
        const data = await res.json();
        if (res.ok && data.success) {
          setDashboardData({
            hasInventory: data.hasInventory,
            kpis: data.kpis,
            trend: data.trend,
            topDebtors: data.topDebtors,
            topItems: data.topItems,
            vouchers: data.vouchers || [],
            lowStockItems: data.lowStockItems || [],
            debtAgingSummary: data.debtAgingSummary
          });
        }
      } catch (err) {
        console.error("Failed to fetch dashboard data", err);
      } finally {
        setInitialLoading(false);
        setTrendLoading(false);
      }
    };

    fetchDashboardData();
  }, [session, weekOffset]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-md p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl">
          <p className="font-bold text-slate-800 dark:text-slate-100 mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }} className="text-sm font-semibold">
              {entry.name}: ₹{entry.value.toLocaleString()}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (initialLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="w-10 h-10 border-4 border-slate-200 dark:border-slate-700 border-t-blue-600 rounded-full animate-spin"></div>
        <p className="text-slate-500 font-medium animate-pulse">Aggregating organization data...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in pb-8">
      <div>
        <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Administrator Dashboard</h2>
        <p className="text-slate-500 text-sm mt-1">Welcome back. Here is a high-level summary of organization activities.</p>
      </div>

      {/* Row 1: KPI Widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white/80 dark:bg-slate-800/70 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-5 transition-transform hover:-translate-y-1 duration-300">
          <div className="flex justify-between items-center text-sm font-semibold text-slate-500 dark:text-slate-400 mb-2">
            <span>Total Outstanding</span>
            <span className="text-xl">💳</span>
          </div>
          <div className="text-3xl font-bold text-slate-900 dark:text-slate-100">₹{dashboardData.kpis.totalOutstanding.toLocaleString()}</div>
          <div className="text-xs text-slate-400 mt-2">Overall accounts receivable</div>
        </div>

        <div className="bg-white/80 dark:bg-slate-800/70 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-5 transition-transform hover:-translate-y-1 duration-300">
          <div className="flex justify-between items-center text-sm font-semibold text-slate-500 dark:text-slate-400 mb-2">
            <span>Today's Revenue</span>
            <span className="text-xl">📈</span>
          </div>
          <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">₹{dashboardData.kpis.revenueToday.toLocaleString()}</div>
          <div className="text-xs text-slate-400 mt-2">Value of {dashboardData.kpis.slipsToday} slips generated today</div>
        </div>

        <div className="bg-white/80 dark:bg-slate-800/70 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-5 transition-transform hover:-translate-y-1 duration-300">
          <div className="flex justify-between items-center text-sm font-semibold text-slate-500 dark:text-slate-400 mb-2">
            <span>Today's Payments</span>
            <span className="text-xl">💵</span>
          </div>
          <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">₹{dashboardData.kpis.paymentsToday.toLocaleString()}</div>
          <div className="text-xs text-slate-400 mt-2">Credit payments received today</div>
        </div>

        <div className="bg-white/80 dark:bg-slate-800/70 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-5 transition-transform hover:-translate-y-1 duration-300">
          <div className="flex justify-between items-center text-sm font-semibold text-slate-500 dark:text-slate-400 mb-2">
            <span>Today's Returns</span>
            <span className="text-xl">📉</span>
          </div>
          <div className="text-3xl font-bold text-red-600 dark:text-red-400">₹{dashboardData.kpis.returnsToday.toLocaleString()}</div>
          <div className="text-xs text-slate-400 mt-2">Value of items returned today</div>
        </div>
      </div>

      {/* Row 2: 7-Day Trend Chart */}
      <div className="bg-white/80 dark:bg-slate-800/70 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 relative">
        {trendLoading && (
          <div className="absolute inset-0 bg-white/40 dark:bg-slate-950/40 backdrop-blur-[1px] flex items-center justify-center z-10 rounded-2xl">
            <div className="w-8 h-8 border-4 border-slate-200 dark:border-slate-855 border-t-blue-600 rounded-full animate-spin"></div>
          </div>
        )}
        <div className="mb-6 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              7-Day Financial Trend
              {weekOffset !== 0 && (
                <span className="text-[10px] font-semibold bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full border border-blue-200/30">
                  {weekOffset < 0 ? `${Math.abs(weekOffset)} Wk Ago` : `${weekOffset} Wk Ahead`}
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-500">Compare Daily Revenue, Payments, and Returns</p>
          </div>

          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900/80 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setWeekOffset(prev => prev - 1)}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg hover:bg-white dark:hover:bg-slate-850 text-slate-700 dark:text-slate-300 transition-all hover:shadow-sm"
              aria-label="Previous Week"
            >
              ← Prev Week
            </button>
            <button
              onClick={() => setWeekOffset(0)}
              disabled={weekOffset === 0}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                weekOffset === 0
                  ? "bg-blue-650 text-white shadow-sm dark:bg-blue-600"
                  : "hover:bg-white dark:hover:bg-slate-850 text-slate-750 dark:text-slate-350"
              }`}
            >
              Current
            </button>
            <button
              onClick={() => setWeekOffset(prev => prev + 1)}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg hover:bg-white dark:hover:bg-slate-850 text-slate-700 dark:text-slate-300 transition-all hover:shadow-sm"
              aria-label="Next Week"
            >
              Next Week →
            </button>
          </div>
        </div>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dashboardData.trend} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#059669" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorPayment" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorReturns" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#dc2626" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#dc2626" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} dy={10} />
              <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} dx={-10} tickFormatter={(value) => `₹${value}`} />
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} opacity={0.2} />
              <RechartsTooltip content={<CustomTooltip />} />
              <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '12px' }} />
              <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#059669" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
              <Area type="monotone" dataKey="payment" name="Payments" stroke="#2563eb" strokeWidth={3} fillOpacity={1} fill="url(#colorPayment)" />
              <Area type="monotone" dataKey="returns" name="Returns" stroke="#dc2626" strokeWidth={3} fillOpacity={1} fill="url(#colorReturns)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 3: Split View for Debtors and Items */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Top Debtors */}
        <div className="bg-white/80 dark:bg-slate-800/70 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="mb-4 flex justify-between items-center">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Top Debtors</h3>
              <p className="text-xs text-slate-500">Customers with highest outstanding balances</p>
            </div>
            <span className="text-2xl">🚨</span>
          </div>

          <div className="flex flex-col gap-4 mt-6">
            {dashboardData.topDebtors.map((debtor, idx) => {
              const maxDebt = Math.max(...dashboardData.topDebtors.map(d => d.outstanding), 1);
              const percentage = Math.min(100, (debtor.outstanding / maxDebt) * 100);
              return (
                <div key={idx} className="flex flex-col gap-2">
                  <div className="flex justify-between items-end">
                    <div>
                      <div className="font-semibold text-sm text-slate-800 dark:text-slate-200">{debtor.name}</div>
                      <div className="text-xs text-slate-500 font-mono">{debtor.phone}</div>
                    </div>
                    <div className="font-bold text-red-600 dark:text-red-400">₹{debtor.outstanding.toLocaleString()}</div>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                    <div className="bg-red-500 h-2 rounded-full" style={{ width: `${percentage}%` }}></div>
                  </div>
                </div>
              )
            })}
            {dashboardData.topDebtors.length === 0 && (
              <div className="text-center py-6 text-sm text-slate-500">No outstanding debts found.</div>
            )}
          </div>
        </div>

        {/* Debt Aging Analysis */}
        <div 
          onClick={() => router.push("/dashboard/admin/reports?filter=debt_aging")}
          className="bg-white/80 dark:bg-slate-800/70 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 cursor-pointer hover:border-blue-500/50 transition-all group"
        >
          <div className="mb-4 flex justify-between items-center">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 group-hover:text-blue-650 dark:group-hover:text-blue-400 transition-colors">Debt Aging Summary</h3>
              <p className="text-xs text-slate-500">Unpaid balances categorized by date range. Click to view detailed report.</p>
            </div>
            <span className="text-2xl">⏳</span>
          </div>

          <div className="flex flex-col gap-3.5 mt-6">
            <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-100 dark:border-slate-800 font-bold uppercase tracking-wider text-slate-400">
              <span>Aging Period</span>
              <span className="text-right">Outstanding Amount</span>
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-slate-600 dark:text-slate-400">0 - 30 Days</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">₹{(dashboardData.debtAgingSummary?.aging_0_30 || 0).toLocaleString()}</span>
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-slate-600 dark:text-slate-400">31 - 60 Days</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">₹{(dashboardData.debtAgingSummary?.aging_31_60 || 0).toLocaleString()}</span>
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-slate-600 dark:text-slate-400">61 - 90 Days</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">₹{(dashboardData.debtAgingSummary?.aging_61_90 || 0).toLocaleString()}</span>
            </div>

            <div className="flex justify-between items-center text-xs pb-3 border-b border-slate-100 dark:border-slate-800">
              <span className="font-semibold text-slate-600 dark:text-slate-400">Over 90 Days</span>
              <span className="font-bold text-red-600 dark:text-red-400">₹{(dashboardData.debtAgingSummary?.aging_90_plus || 0).toLocaleString()}</span>
            </div>

            <div className="flex justify-between items-center text-xs pt-1.5 font-extrabold">
              <span className="text-slate-800 dark:text-slate-200">Total Outstanding</span>
              <span className="text-blue-650 dark:text-blue-400 text-sm">₹{(dashboardData.debtAgingSummary?.total || 0).toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>
      {dashboardData.hasInventory && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Last 20 Vouchers (2 cols width) */}
          <div className="lg:col-span-2 bg-white/80 dark:bg-slate-800/70 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Last 20 Voucher Summary</h3>
                <p className="text-xs text-slate-500">Quick review of recent inventory transactions. Click a row to view details.</p>
              </div>
              {loadingVoucherDetails && (
                <div className="w-5 h-5 border-2 border-slate-200 dark:border-slate-700 border-t-blue-600 rounded-full animate-spin"></div>
              )}
            </div>
            
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                    <th className="py-2.5 px-2">Date</th>
                    <th className="py-2.5 px-2">Transaction Type</th>
                    <th className="py-2.5 px-2">Inward / Outward</th>
                    <th className="py-2.5 px-2">Location / Source</th>
                    <th className="py-2.5 px-2 text-center">Unique Items</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {dashboardData.vouchers.map((v) => (
                    <tr 
                      key={v.id} 
                      onClick={() => handleVoucherClick(v.id)}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-700/20 transition-colors cursor-pointer"
                    >
                      <td className="py-2.5 px-2 text-slate-500 whitespace-nowrap">
                        {new Date(v.date).toLocaleDateString()}
                      </td>
                      <td className="py-2.5 px-2 font-bold text-slate-850 dark:text-slate-200">
                        {v.typeName}
                      </td>
                      <td className="py-2.5 px-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold ${
                          v.stockEffect === "INWARD"
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : v.stockEffect === "OUTWARD"
                              ? "bg-rose-500/10 text-rose-600 dark:text-rose-455"
                              : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                        }`}>
                          {v.stockEffect.toLowerCase()}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-slate-600 dark:text-slate-400 truncate max-w-[150px]">
                        {v.fromLocationName && v.toLocationName ? (
                          <span>{v.fromLocationName} ➔ {v.toLocationName}</span>
                        ) : v.fromLocationName ? (
                          <span>{v.fromLocationName}</span>
                        ) : v.toLocationName ? (
                          <span>{v.toLocationName}</span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="py-2.5 px-2 text-center text-slate-700 dark:text-slate-350 font-bold">{v.itemsCount}</td>
                    </tr>
                  ))}
                  {dashboardData.vouchers.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">No recent vouchers.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Items at Reorder Level (1 col width) */}
          <div className="bg-white/80 dark:bg-slate-800/70 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Low Stock Alerts</h3>
                <p className="text-xs text-slate-500">Items at or below reorder level</p>
              </div>
              <span className="text-xl">⚠️</span>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 max-h-[300px]">
              <div className="flex flex-col gap-3">
                {dashboardData.lowStockItems.map((item) => (
                  <div key={item.sku} className="p-3 bg-rose-500/5 dark:bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center justify-between text-xs">
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="font-bold text-slate-800 dark:text-slate-250 truncate">{item.name}</span>
                      <span className="text-slate-400 font-mono">SKU: {item.sku}</span>
                    </div>
                    <div className="text-right flex flex-col gap-0.5">
                      <span className="font-extrabold text-rose-600 dark:text-rose-450">{item.currentBalance.toLocaleString()} left</span>
                      <span className="text-[10px] text-slate-500">Reorder: {item.reorderLevel.toLocaleString()}</span>
                    </div>
                  </div>
                ))}
                {dashboardData.lowStockItems.length === 0 && (
                  <div className="text-center py-8 text-slate-400 text-xs">All inventory stocks are healthy.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Voucher Detail Modal Overlay */}
      {selectedVoucherDetails && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl flex flex-col gap-4 text-slate-950 dark:text-slate-100">
            <div className="flex justify-between items-start border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h4 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Voucher Detail: {selectedVoucherDetails.voucher.type_name}
                </h4>
                <p className="text-xs text-slate-500 font-semibold font-mono mt-0.5">
                  Voucher ID: #{selectedVoucherDetails.voucher.id} • Date: {new Date(selectedVoucherDetails.voucher.transaction_date).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={() => setSelectedVoucherDetails(null)}
                className="text-slate-400 hover:text-slate-655 dark:hover:text-slate-200 text-sm font-bold p-1 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-2.5 text-xs text-slate-700 dark:text-slate-300">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="font-bold text-slate-400 block text-[9px] uppercase">Stock Effect</span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold mt-0.5 ${
                    selectedVoucherDetails.voucher.stock_effect === "INWARD"
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-450"
                      : "bg-rose-500/10 text-rose-600 dark:text-rose-455"
                  }`}>
                    {selectedVoucherDetails.voucher.stock_effect.toLowerCase()}
                  </span>
                </div>
                <div>
                  <span className="font-bold text-slate-400 block text-[9px] uppercase">Ref No</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{selectedVoucherDetails.voucher.reference_no || "-"}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="font-bold text-slate-400 block text-[9px] uppercase">Party Name</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{selectedVoucherDetails.voucher.party_name || "-"}</span>
                </div>
                <div>
                  <span className="font-bold text-slate-400 block text-[9px] uppercase">Remarks</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{selectedVoucherDetails.voucher.remarks || "-"}</span>
                </div>
              </div>
            </div>

            <div className="border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden mt-2">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-2 px-3">Item Name (SKU)</th>
                    <th className="py-2 px-3 text-right">Quantity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {selectedVoucherDetails.details.map((d: any) => (
                    <tr key={d.id} className="hover:bg-slate-50/20 dark:hover:bg-slate-900/5">
                      <td className="py-2 px-3 font-semibold text-slate-800 dark:text-slate-200">
                        {d.item_name} <span className="text-[10px] text-slate-400 font-mono">({d.sku})</span>
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                        {parseFloat(d.qty).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end mt-2">
              <button
                onClick={() => setSelectedVoucherDetails(null)}
                className="px-4 py-2 bg-blue-650 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors text-xs"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
