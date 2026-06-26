"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/components/providers/AuthProvider";

interface FinancialYear {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  is_closed: boolean;
}

export default function CloseYearPage() {
  const { session } = useAuth();

  const [financialYears, setFinancialYears] = useState<FinancialYear[]>([]);
  const [selectedFyId, setSelectedFyId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  // Closing year state
  const [closeSubmitting, setCloseSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const selectedFy = financialYears.find(f => f.id.toString() === selectedFyId);

  useEffect(() => {
    if (session?.orgcode) {
      fetchInventoryData();
    }
  }, [session, selectedFyId]);

  const fetchInventoryData = async () => {
    if (!session?.orgcode) return;
    try {
      setLoading(true);
      setErrorMsg("");
      let url = `/api/inventory?orgcode=${session.orgcode}`;
      if (selectedFyId) {
        url += `&financialYearId=${selectedFyId}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setFinancialYears(data.financialYears);
        if (!selectedFyId) {
          setSelectedFyId(data.selectedFyId.toString());
        }
      } else {
        setErrorMsg(data.message || "Failed to load active details");
      }
    } catch (e) {
      setErrorMsg("Failed to connect to server");
    } finally {
      setLoading(false);
    }
  };

  const handleCloseFinancialYear = async () => {
    if (!session?.orgcode || !selectedFyId) return;
    
    const confirmText = `Are you absolutely sure you want to close ${selectedFy?.name}? This action is permanent and will roll forward all closing balances as the opening balances for the next Financial Year.`;
    if (!confirm(confirmText)) return;

    try {
      setCloseSubmitting(true);
      setErrorMsg("");
      setSuccessMsg("");
      const res = await fetch("/api/inventory/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgcode: session.orgcode,
          financial_year_id: parseInt(selectedFyId, 10),
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSuccessMsg(data.message);
        // Refresh completely
        setSelectedFyId("");
        fetchInventoryData();
      } else {
        setErrorMsg(data.message || "Failed to close Financial Year");
      }
    } catch (e) {
      setErrorMsg("Error closing financial year");
    } finally {
      setCloseSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-12 text-slate-800 dark:text-slate-100">
      <div>
        <h2 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-500 bg-clip-text text-transparent">
          Close Financial Year
        </h2>
        <p className="text-slate-500 text-sm mt-1 font-semibold">
          Finalize starting stocks, close active ledgers, and open new accounts.
        </p>
      </div>

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 dark:bg-rose-950/30 dark:border-rose-900/50 dark:text-rose-400 rounded-xl text-sm font-semibold">
          ⚠️ {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 dark:bg-emerald-950/30 dark:border-emerald-900/50 dark:text-emerald-400 rounded-xl text-sm font-semibold">
          ✅ {successMsg}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <div className="w-10 h-10 border-4 border-slate-200 dark:border-slate-800 border-t-blue-600 rounded-full animate-spin"></div>
          <p className="text-slate-400 text-sm">Checking financial year configuration...</p>
        </div>
      ) : (
        <div className="max-w-xl bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 rounded-3xl p-6 shadow-sm">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-rose-600 dark:text-rose-400">
            <span>🔒</span> Year-End Freezing &amp; Carryover
          </h3>

          <div className="flex flex-col gap-4 text-sm text-slate-600 dark:text-slate-350">
            <p className="leading-relaxed">
              Selecting this operation permanent freezes transactions inside this financial period. The computed closing quantities of every catalog SKU at all warehouses will automatically form the starting opening quantities for the newly generated Financial Year.
            </p>
            
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-850 p-3 rounded-2xl">
              <label className="text-xs font-bold uppercase text-slate-400">Select Year to Close:</label>
              <select
                value={selectedFyId}
                onChange={(e) => setSelectedFyId(e.target.value)}
                className="bg-transparent font-bold text-slate-750 dark:text-slate-100 focus:outline-none cursor-pointer"
              >
                {financialYears.map((fy) => (
                  <option key={fy.id} value={fy.id.toString()} className="bg-white dark:bg-slate-850">
                    {fy.name} {fy.is_closed ? "(Closed)" : "(Active)"}
                  </option>
                ))}
              </select>
            </div>

            <div className="p-4 bg-amber-50/60 dark:bg-amber-950/15 border border-amber-250/50 dark:border-amber-900/50 rounded-2xl flex flex-col gap-1.5">
              <div className="font-bold text-amber-800 dark:text-amber-400">Selected Year Summary:</div>
              <div><strong>Name:</strong> {selectedFy?.name}</div>
              <div><strong>Active Duration:</strong> {selectedFy ? new Date(selectedFy.start_date).toLocaleDateString("en-IN") : "-"} to {selectedFy ? new Date(selectedFy.end_date).toLocaleDateString("en-IN") : "-"}</div>
              <div><strong>State:</strong> {selectedFy?.is_closed ? "Closed" : "Active"}</div>
            </div>

            <div className="p-4 bg-rose-50/50 dark:bg-rose-950/15 border border-rose-250/50 dark:border-rose-900/50 rounded-2xl text-xs flex flex-col gap-1 text-rose-800 dark:text-rose-450">
              <span className="font-bold uppercase tracking-wider">⚠️ Critical Warning:</span>
              <span>This operation cannot be reversed. You will be locked out from logging new stock receipts/transfers inside the closed period.</span>
            </div>

            <button
              onClick={handleCloseFinancialYear}
              disabled={closeSubmitting || selectedFy?.is_closed}
              className="w-full py-4 mt-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-bold rounded-xl shadow-lg transition-transform hover:-translate-y-0.5 duration-200 disabled:opacity-50 disabled:pointer-events-none"
            >
              {closeSubmitting ? "Processing Year Close..." : selectedFy?.is_closed ? "Year Already Closed" : `Freeze & Close ${selectedFy?.name}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
