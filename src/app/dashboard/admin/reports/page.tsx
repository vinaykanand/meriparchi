"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

interface ReportCustomer {
  phone: string;
  name: string;
  address: string;
  outstanding?: number;
  last_activity?: string;
  last_slip_date?: string;
  last_payment_date?: string;
  aging_0_30?: number;
  aging_31_60?: number;
  aging_61_90?: number;
  aging_90_plus?: number;
}

function AdminReportsPageContent() {
  const { session } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const filterParam = searchParams?.get("filter");

  const [filterType, setFilterType] = useState<string>("zero_outstanding");
  const [days, setDays] = useState<number | "">(30);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ReportCustomer[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState("");
  const [sortCol, setSortCol] = useState<string>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  useEffect(() => {
    if (filterParam && session?.orgcode) {
      setFilterType(filterParam);
      const fetchDirectly = async () => {
        setLoading(true);
        setError("");
        setHasSearched(false);
        try {
          const res = await fetch(`/api/reports?orgcode=${session.orgcode}&filter=${filterParam}`);
          const data = await res.json();
          if (res.ok && data.success) {
            setResults(data.data || []);
            setHasSearched(true);
          } else {
            setError(data.message || "Failed to fetch report data");
          }
        } catch (err: any) {
          setError(err.message || "An error occurred");
        } finally {
          setLoading(false);
        }
      };
      fetchDirectly();
    }
  }, [filterParam, session]);

  // Selection & Close Account States
  const [selectedPhones, setSelectedPhones] = useState<string[]>([]);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [isClosing, setIsClosing] = useState(false);
  const [closeError, setCloseError] = useState("");

  const totalBalance = results.reduce((sum, cust) => sum + parseFloat(cust.outstanding?.toString() || "0"), 0);
  const totalAging0_30 = results.reduce((sum, cust: any) => sum + parseFloat(cust.aging_0_30?.toString() || "0"), 0);
  const totalAging31_60 = results.reduce((sum, cust: any) => sum + parseFloat(cust.aging_31_60?.toString() || "0"), 0);
  const totalAging61_90 = results.reduce((sum, cust: any) => sum + parseFloat(cust.aging_61_90?.toString() || "0"), 0);
  const totalAging90Plus = results.reduce((sum, cust: any) => sum + parseFloat(cust.aging_90_plus?.toString() || "0"), 0);

  const sortedResults = [...results].sort((a: any, b: any) => {
    let valA = a[sortCol];
    let valB = b[sortCol];

    if (valA === undefined || valA === null) valA = "";
    if (valB === undefined || valB === null) valB = "";

    if (
      sortCol === "outstanding" ||
      sortCol === "aging_0_30" ||
      sortCol === "aging_31_60" ||
      sortCol === "aging_61_90" ||
      sortCol === "aging_90_plus"
    ) {
      valA = parseFloat(valA) || 0;
      valB = parseFloat(valB) || 0;
    } else if (sortCol === "last_activity") {
      valA = new Date(valA).getTime() || 0;
      valB = new Date(valB).getTime() || 0;
    } else {
      valA = String(valA).toLowerCase();
      valB = String(valB).toLowerCase();
    }

    if (valA < valB) return sortDir === "asc" ? -1 : 1;
    if (valA > valB) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  const handleFetchReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.orgcode) return;

    setLoading(true);
    setError("");
    setHasSearched(false);
    setSelectedPhones([]); // Clear selection on new report

    try {
      let url = `/api/reports?orgcode=${session.orgcode}&filter=${filterType}`;
      if (filterType === "no_activity") {
        url += `&days=${days || 0}`;
      }

      const res = await fetch(url);
      const data = await res.json();

      if (res.ok && data.success) {
        setResults(data.data || []);
        setHasSearched(true);
      } else {
        setError(data.message || "Failed to fetch report data");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleCloseSelectedAccounts = async () => {
    if (!adminPassword) {
      setCloseError("Admin password is required.");
      return;
    }
    setIsClosing(true);
    setCloseError("");

    let successCount = 0;
    let failCount = 0;
    let lastErr = "";

    try {
      for (const phone of selectedPhones) {
        try {
          const res = await fetch(`/api/ledger?orgcode=${session?.orgcode}&phone=${phone}`, {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ password: adminPassword }),
          });
          const data = await res.json();
          if (res.ok && data.success) {
            successCount++;
          } else {
            failCount++;
            lastErr = data.message || "Failed to close account";
          }
        } catch (e: any) {
          failCount++;
          lastErr = e.message || "Network error";
        }
      }

      if (failCount > 0) {
        setCloseError(`Successfully closed ${successCount} account(s). Failed to close ${failCount} account(s): ${lastErr}`);
      } else {
        setSelectedPhones([]);
        setShowConfirmModal(false);
        // Refresh report
        const mockEvent = { preventDefault: () => {} } as React.FormEvent;
        handleFetchReport(mockEvent);
      }
    } catch (err: any) {
      setCloseError(err.message || "An unexpected error occurred");
    } finally {
      setIsClosing(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in relative max-w-6xl mx-auto pb-10">
      <div>
        <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Reports & Filters</h2>
        <p className="text-slate-500 text-sm mt-1 mb-4">Generate custom lists of customers based on their account activity.</p>
      </div>

      <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-md rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
        <form onSubmit={handleFetchReport} className="flex flex-col sm:flex-row gap-4 items-end">

          <div className="flex flex-col gap-1 w-full sm:w-1/2">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Select Filter Type</label>
            <select
              value={filterType}
              onChange={(e) => {
                setFilterType(e.target.value);
                setHasSearched(false);
                setResults([]);
                setSelectedPhones([]); // Clear selection when switching filters
              }}
              className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-white/50 dark:bg-slate-900/50 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all dark:text-white"
            >
              <option value="zero_outstanding">Customers with Zero Outstanding Balance</option>
              <option value="no_activity">Customers with No Activity (Inactive)</option>
              <option value="debt_aging">Debt Aging Analysis & Financial Insights</option>
            </select>
          </div>

          {filterType === "no_activity" && (
            <div className="flex flex-col gap-1 w-full sm:w-1/4 animate-fade-in">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Inactive For (Days)</label>
              <input
                type="number"
                min="1"
                value={days}
                onChange={(e) => {
                  const val = e.target.value;
                  setDays(val === "" ? "" : parseInt(val));
                }}
                className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-white/50 dark:bg-slate-900/50 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all dark:text-white"
              />
            </div>
          )}

          <div className="w-full sm:w-auto">
            <button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto px-8 py-3 text-sm font-bold rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-md shadow-blue-500/20"
            >
              {loading ? "Generating..." : "Generate Report"}
            </button>
          </div>
        </form>

        {error && (
          <div className="mt-4 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 text-sm">
            {error}
          </div>
        )}
      </div>

      {/* Financial Insights Summary Cards */}
      {hasSearched && filterType === "debt_aging" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 animate-fade-in">
          <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-md p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between min-h-[100px]">
            <div className="h-8 flex items-center">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider leading-tight">Total Outstanding</span>
            </div>
            <span className="text-lg sm:text-xl font-extrabold text-slate-800 dark:text-slate-100 leading-none truncate">
              ₹{totalBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-md p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between min-h-[100px]">
            <div className="h-8 flex items-center">
              <span className="text-[11px] font-bold text-emerald-500 dark:text-emerald-400 uppercase tracking-wider leading-tight">0–30 Days (Current)</span>
            </div>
            <span className="text-lg sm:text-xl font-extrabold text-emerald-600 dark:text-emerald-400 leading-none truncate">
              ₹{totalAging0_30.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-md p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between min-h-[100px]">
            <div className="h-8 flex items-center">
              <span className="text-[11px] font-bold text-blue-500 dark:text-blue-400 uppercase tracking-wider leading-tight">31–60 Days</span>
            </div>
            <span className="text-lg sm:text-xl font-extrabold text-blue-600 dark:text-blue-400 leading-none truncate">
              ₹{totalAging31_60.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-md p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between min-h-[100px]">
            <div className="h-8 flex items-center">
              <span className="text-[11px] font-bold text-amber-500 dark:text-amber-400 uppercase tracking-wider leading-tight">61–90 Days</span>
            </div>
            <span className="text-lg sm:text-xl font-extrabold text-amber-600 dark:text-amber-400 leading-none truncate">
              ₹{totalAging61_90.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-md p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between min-h-[100px]">
            <div className="h-8 flex items-center">
              <span className="text-[11px] font-bold text-rose-500 dark:text-rose-400 uppercase tracking-wider leading-tight">90+ Days (High Risk)</span>
            </div>
            <span className="text-lg sm:text-xl font-extrabold text-rose-600 dark:text-rose-400 leading-none truncate">
              ₹{totalAging90Plus.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      )}

      {hasSearched && (
        <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-md rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden animate-fade-in">
          <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex flex-col sm:flex-row gap-4 sm:justify-between sm:items-center">
            <div>
              <h3 className="font-bold text-slate-800 dark:text-slate-200">
                {filterType === "zero_outstanding"
                  ? "Fully Paid Customers"
                  : filterType === "debt_aging"
                    ? "Debt Aging Analysis"
                    : `Inactive Customers (> ${days} days)`}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {results.length} customer(s) found
              </p>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              {filterType === "zero_outstanding" && selectedPhones.length > 0 && (
                <button
                  onClick={() => {
                    setCloseError("");
                    setAdminPassword("");
                    setShowConfirmModal(true);
                  }}
                  className="px-4 py-2 text-xs font-bold bg-rose-605 hover:bg-rose-700 text-white dark:bg-rose-600 rounded-xl transition-all shadow-md shadow-rose-500/20"
                >
                  Close Selected ({selectedPhones.length})
                </button>
              )}
              {filterType !== "zero_outstanding" && (
                <span className="font-bold text-slate-800 dark:text-slate-200 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-3 py-1.5 rounded-xl text-sm">
                  Total Balance: ₹{totalBalance.toFixed(2)}
                </span>
              )}
            </div>
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">
                  {filterType === "zero_outstanding" && (
                    <th className="px-6 py-4 font-semibold border-b border-slate-200 dark:border-slate-700 w-12">
                      <input
                        type="checkbox"
                        checked={results.length > 0 && selectedPhones.length === results.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedPhones(results.map(r => r.phone));
                          } else {
                            setSelectedPhones([]);
                          }
                        }}
                        className="w-4 h-4 text-blue-600 border-slate-300 dark:border-slate-600 rounded focus:ring-blue-500 cursor-pointer"
                      />
                    </th>
                  )}
                  <th
                    className="px-6 py-4 font-semibold border-b border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    onClick={() => {
                      if (sortCol === "name") setSortDir(sortDir === "asc" ? "desc" : "asc");
                      else { setSortCol("name"); setSortDir("asc"); }
                    }}
                  >
                    Name {sortCol === "name" && (sortDir === "asc" ? "↑" : "↓")}
                  </th>
                  <th
                    className="px-6 py-4 font-semibold border-b border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    onClick={() => {
                      if (sortCol === "phone") setSortDir(sortDir === "asc" ? "desc" : "asc");
                      else { setSortCol("phone"); setSortDir("asc"); }
                    }}
                  >
                    Phone {sortCol === "phone" && (sortDir === "asc" ? "↑" : "↓")}
                  </th>
                  <th
                    className="px-6 py-4 font-semibold border-b border-slate-200 dark:border-slate-700 text-right cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    onClick={() => {
                      if (sortCol === "outstanding") setSortDir(sortDir === "asc" ? "desc" : "asc");
                      else { setSortCol("outstanding"); setSortDir("asc"); }
                    }}
                  >
                    Outstanding {sortCol === "outstanding" && (sortDir === "asc" ? "↑" : "↓")}
                  </th>
                  {filterType === "no_activity" && (
                    <th
                      className="px-6 py-4 font-semibold border-b border-slate-200 dark:border-slate-700 text-right cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                      onClick={() => {
                        if (sortCol === "last_activity") setSortDir(sortDir === "asc" ? "desc" : "asc");
                        else { setSortCol("last_activity"); setSortDir("asc"); }
                      }}
                    >
                      Last Activity {sortCol === "last_activity" && (sortDir === "asc" ? "↑" : "↓")}
                    </th>
                  )}
                  {filterType === "debt_aging" && (
                    <>
                      <th
                        className="px-6 py-4 font-semibold border-b border-slate-200 dark:border-slate-700 text-right cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-emerald-600 dark:text-emerald-400"
                        onClick={() => {
                          if (sortCol === "aging_0_30") setSortDir(sortDir === "asc" ? "desc" : "asc");
                          else { setSortCol("aging_0_30"); setSortDir("asc"); }
                        }}
                      >
                        0-30 Days {sortCol === "aging_0_30" && (sortDir === "asc" ? "↑" : "↓")}
                      </th>
                      <th
                        className="px-6 py-4 font-semibold border-b border-slate-200 dark:border-slate-700 text-right cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-blue-600 dark:text-blue-400"
                        onClick={() => {
                          if (sortCol === "aging_31_60") setSortDir(sortDir === "asc" ? "desc" : "asc");
                          else { setSortCol("aging_31_60"); setSortDir("asc"); }
                        }}
                      >
                        31-60 Days {sortCol === "aging_31_60" && (sortDir === "asc" ? "↑" : "↓")}
                      </th>
                      <th
                        className="px-6 py-4 font-semibold border-b border-slate-200 dark:border-slate-700 text-right cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-amber-600 dark:text-amber-400"
                        onClick={() => {
                          if (sortCol === "aging_61_90") setSortDir(sortDir === "asc" ? "desc" : "asc");
                          else { setSortCol("aging_61_90"); setSortDir("asc"); }
                        }}
                      >
                        61-90 Days {sortCol === "aging_61_90" && (sortDir === "asc" ? "↑" : "↓")}
                      </th>
                      <th
                        className="px-6 py-4 font-semibold border-b border-slate-200 dark:border-slate-700 text-right cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-rose-600 dark:text-rose-400"
                        onClick={() => {
                          if (sortCol === "aging_90_plus") setSortDir(sortDir === "asc" ? "desc" : "asc");
                          else { setSortCol("aging_90_plus"); setSortDir("asc"); }
                        }}
                      >
                        90+ Days {sortCol === "aging_90_plus" && (sortDir === "asc" ? "↑" : "↓")}
                      </th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {sortedResults.length === 0 ? (
                  <tr>
                    <td colSpan={filterType === "debt_aging" ? 7 : filterType === "zero_outstanding" ? 5 : filterType === "no_activity" ? 4 : 3} className="px-6 py-8 text-center text-slate-500 dark:text-slate-400 text-sm">
                      No customers match this filter.
                    </td>
                  </tr>
                ) : (
                  sortedResults.map((customer, idx) => {
                    const isSelected = selectedPhones.includes(customer.phone);
                    return (
                      <tr
                        key={idx}
                        onClick={() => router.push(`/dashboard/admin/lookup?phone=${customer.phone}`)}
                        className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer ${
                          isSelected ? "bg-blue-50/30 dark:bg-blue-900/10" : ""
                        }`}
                      >
                        {filterType === "zero_outstanding" && (
                          <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedPhones(prev => [...prev, customer.phone]);
                                } else {
                                  setSelectedPhones(prev => prev.filter(p => p !== customer.phone));
                                }
                              }}
                              className="w-4 h-4 text-blue-600 border-slate-300 dark:border-slate-600 rounded focus:ring-blue-500 cursor-pointer"
                            />
                          </td>
                        )}
                        <td className="px-6 py-4">
                          <div className="font-semibold text-slate-800 dark:text-slate-200">
                            {customer.name || "Unknown"}
                          </div>
                          {customer.address && <div className="text-xs text-slate-500">{customer.address}</div>}
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-slate-600 dark:text-slate-300">
                          {customer.phone}
                        </td>
                        <td className="px-6 py-4 text-sm font-bold text-emerald-600 dark:text-emerald-400 text-right">
                          ₹{parseFloat((customer.outstanding || 0).toString()).toFixed(2)}
                        </td>
                        {filterType === "no_activity" && (
                          <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300 text-right">
                            {customer.last_activity ? new Date(customer.last_activity).toLocaleDateString('en-IN') : "Never"}
                          </td>
                        )}
                        {filterType === "debt_aging" && (
                          <>
                            <td className="px-6 py-4 text-sm text-emerald-600 dark:text-emerald-400 text-right font-medium">
                              ₹{parseFloat((customer.aging_0_30 || 0).toString()).toFixed(2)}
                            </td>
                            <td className="px-6 py-4 text-sm text-blue-600 dark:text-blue-400 text-right font-medium">
                              ₹{parseFloat((customer.aging_31_60 || 0).toString()).toFixed(2)}
                            </td>
                            <td className="px-6 py-4 text-sm text-amber-600 dark:text-amber-400 text-right font-medium">
                              ₹{parseFloat((customer.aging_61_90 || 0).toString()).toFixed(2)}
                            </td>
                            <td className="px-6 py-4 text-sm text-rose-600 dark:text-rose-400 text-right font-medium">
                              ₹{parseFloat((customer.aging_90_plus || 0).toString()).toFixed(2)}
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Stacked Card View */}
          <div className="block md:hidden p-4 space-y-3">
            {sortedResults.length === 0 ? (
              <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-sm bg-white dark:bg-slate-800/30 rounded-2xl border border-slate-200 dark:border-slate-800">
                No customers match this filter.
              </div>
            ) : (
              sortedResults.map((customer, idx) => {
                const isSelected = selectedPhones.includes(customer.phone);
                return (
                  <div
                    key={idx}
                    onClick={() => router.push(`/dashboard/admin/lookup?phone=${customer.phone}`)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-sm space-y-3 flex items-start ${
                      isSelected 
                        ? "bg-blue-50/40 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800" 
                        : "bg-white dark:bg-slate-800/30 border-slate-200 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    }`}
                  >
                    {filterType === "zero_outstanding" && (
                      <div className="mr-3 pt-1" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedPhones(prev => [...prev, customer.phone]);
                            } else {
                              setSelectedPhones(prev => prev.filter(p => p !== customer.phone));
                            }
                          }}
                          className="w-5 h-5 text-blue-600 border-slate-300 dark:border-slate-600 rounded focus:ring-blue-500 cursor-pointer"
                        />
                      </div>
                    )}
                    <div className="flex-1 space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm leading-tight">
                            {customer.name || "Unknown"}
                          </h4>
                          <p className="text-[11px] text-slate-500 mt-0.5">📞 {customer.phone}</p>
                          {customer.address && <p className="text-[10px] text-slate-400 mt-0.5">📍 {customer.address}</p>}
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-semibold text-slate-400 block uppercase">Outstanding</span>
                          <span className="font-bold text-sm text-emerald-600 dark:text-emerald-400">
                            ₹{parseFloat((customer.outstanding || 0).toString()).toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {filterType === "no_activity" && (
                        <div className="flex justify-between items-center text-xs pt-2 border-t border-slate-100 dark:border-slate-700/50 text-slate-500">
                          <span>Last Activity:</span>
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {customer.last_activity ? new Date(customer.last_activity).toLocaleDateString('en-IN') : "Never"}
                          </span>
                        </div>
                      )}

                      {filterType === "debt_aging" && (
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-700/50 space-y-2">
                          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Debt Aging buckets:</span>
                          <div className="grid grid-cols-4 gap-1.5 text-center">
                            <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/10">
                              <span className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 block">0-30d</span>
                              <span className="text-[10px] font-mono font-bold text-slate-800 dark:text-slate-200">
                                ₹{parseFloat((customer.aging_0_30 || 0).toString()).toFixed(0)}
                              </span>
                            </div>
                            <div className="p-1.5 rounded-lg bg-blue-500/10 border border-blue-500/10">
                              <span className="text-[9px] font-semibold text-blue-600 dark:text-blue-400 block">31-60d</span>
                              <span className="text-[10px] font-mono font-bold text-slate-800 dark:text-slate-200">
                                ₹{parseFloat((customer.aging_31_60 || 0).toString()).toFixed(0)}
                              </span>
                            </div>
                            <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/10">
                              <span className="text-[9px] font-semibold text-amber-600 dark:text-amber-400 block">61-90d</span>
                              <span className="text-[10px] font-mono font-bold text-slate-800 dark:text-slate-200">
                                ₹{parseFloat((customer.aging_61_90 || 0).toString()).toFixed(0)}
                              </span>
                            </div>
                            <div className="p-1.5 rounded-lg bg-rose-500/10 border border-rose-500/10">
                              <span className="text-[9px] font-semibold text-rose-600 dark:text-rose-400 block">90d+</span>
                              <span className="text-[10px] font-mono font-bold text-slate-800 dark:text-slate-200">
                                ₹{parseFloat((customer.aging_90_plus || 0).toString()).toFixed(0)}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Admin Password Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 max-w-md w-full space-y-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Confirm Account Closure</h3>
              <p className="text-xs text-slate-500 mt-1">
                You are about to close <span className="font-bold text-slate-850 dark:text-slate-200">{selectedPhones.length}</span> account(s) permanently. This action deletes all slips, payments, and settles balances to zero.
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

            {closeError && (
              <p className="text-xs font-semibold text-rose-600 dark:text-rose-450 bg-rose-50 dark:bg-rose-950/20 p-2.5 rounded-xl border border-rose-100 dark:border-rose-900/30">
                {closeError}
              </p>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isClosing}
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isClosing || !adminPassword}
                onClick={handleCloseSelectedAccounts}
                className="px-5 py-2.5 text-xs font-bold bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl transition-colors shadow-md shadow-rose-500/20 flex items-center gap-1.5"
              >
                {isClosing ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    Closing...
                  </>
                ) : (
                  "Confirm & Close"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminReportsPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="w-10 h-10 border-4 border-slate-200 dark:border-slate-700 border-t-blue-600 rounded-full animate-spin"></div>
        <p className="text-slate-500 font-medium animate-pulse">Loading reports...</p>
      </div>
    }>
      <AdminReportsPageContent />
    </Suspense>
  );
}
