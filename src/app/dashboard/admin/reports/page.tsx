"use client";

import React, { useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface ReportCustomer {
  phone: string;
  name: string;
  address: string;
  outstanding?: number;
  last_activity?: string;
  last_slip_date?: string;
  last_payment_date?: string;
}

export default function AdminReportsPage() {
  const { session } = useAuth();
  const router = useRouter();
  
  const [filterType, setFilterType] = useState<string>("zero_outstanding");
  const [days, setDays] = useState<number | "">(30);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ReportCustomer[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState("");
  const [sortCol, setSortCol] = useState<string>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const totalBalance = results.reduce((sum, cust) => sum + parseFloat(cust.outstanding?.toString() || "0"), 0);

  const sortedResults = [...results].sort((a: any, b: any) => {
    let valA = a[sortCol];
    let valB = b[sortCol];

    if (valA === undefined || valA === null) valA = "";
    if (valB === undefined || valB === null) valB = "";

    if (sortCol === "outstanding") {
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
              }}
              className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-white/50 dark:bg-slate-900/50 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all dark:text-white"
            >
              <option value="zero_outstanding">Customers with Zero Outstanding Balance</option>
              <option value="no_activity">Customers with No Activity (Inactive)</option>
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

      {hasSearched && (
        <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-md rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden animate-fade-in">
          <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center">
            <h3 className="font-bold text-slate-800 dark:text-slate-200">
              {filterType === "zero_outstanding" ? "Fully Paid Customers" : `Inactive Customers (> ${days} days)`}
            </h3>
            <div className="flex items-center gap-4">
              <span className="font-bold text-slate-800 dark:text-slate-200 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-3 py-1 rounded-lg">
                Total Balance: ₹{totalBalance.toFixed(2)}
              </span>
              <span className="text-xs font-semibold bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 px-3 py-1 rounded-full">
                {results.length} found
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">
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
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {sortedResults.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-slate-500 dark:text-slate-400 text-sm">
                      No customers match this filter.
                    </td>
                  </tr>
                ) : (
                  sortedResults.map((customer, idx) => (
                    <tr 
                      key={idx} 
                      onClick={() => router.push(`/dashboard/admin/lookup?phone=${customer.phone}`)}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                    >
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
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
