"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';

export default function AdminOverview() {
  const { session } = useAuth();

  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<{
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
  }>({
    kpis: {
      totalOutstanding: 0,
      revenueToday: 0,
      paymentsToday: 0,
      returnsToday: 0,
      slipsToday: 0,
    },
    trend: [],
    topDebtors: [],
    topItems: []
  });

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!session?.orgcode) return;
      try {
        setLoading(true);
        const res = await fetch(`/api/dashboard?orgcode=${session.orgcode}`);
        const data = await res.json();
        if (res.ok && data.success) {
          setDashboardData({
            kpis: data.kpis,
            trend: data.trend,
            topDebtors: data.topDebtors,
            topItems: data.topItems
          });
        }
      } catch (err) {
        console.error("Failed to fetch dashboard data", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [session]);

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

  if (loading) {
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
      <div className="bg-white/80 dark:bg-slate-800/70 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
        <div className="mb-6">
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">7-Day Financial Trend</h3>
          <p className="text-xs text-slate-500">Compare Daily Revenue, Payments, and Returns</p>
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

        {/* Top Selling Items */}
        <div className="bg-white/80 dark:bg-slate-800/70 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="mb-4 flex justify-between items-center">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Top Moving Items</h3>
              <p className="text-xs text-slate-500">Most popular products by volume sold</p>
            </div>
            <span className="text-2xl">📦</span>
          </div>

          <div className="h-[250px] w-full mt-4">
            {dashboardData.topItems.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dashboardData.topItems} layout="vertical" margin={{ top: 0, right: 30, left: 30, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="item" width={80} stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                  <RechartsTooltip
                    cursor={{ fill: 'transparent' }}
                    content={({ active, payload }: any) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700 shadow-lg text-sm">
                            <span className="font-bold text-slate-700 dark:text-slate-200">{payload[0].payload.item}</span>: {payload[0].value} units
                          </div>
                        )
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="total_qty" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">No item data available.</div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
