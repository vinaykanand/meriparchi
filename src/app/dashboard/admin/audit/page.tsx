"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { 
  MagnifyingGlassIcon, 
  FunnelIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowPathIcon,
  TrashIcon
} from "@heroicons/react/24/outline";

interface AuditLog {
  id: number;
  userid: string;
  action: string;
  details: Record<string, any> | string;
  timestamp: string;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface Toast {
  id: number;
  message: string;
  type: "success" | "error" | "info";
}

const ACTION_TYPES = [
  { value: "", label: "All Actions" },
  { value: "CREATE_SLIP", label: "Create Slip" },
  { value: "DELETE_SLIP", label: "Delete Slip" },
  { value: "LOG_PAYMENT", label: "Log Payment" },
  { value: "CLOSE_ACCOUNT", label: "Close Account" },
  { value: "UPDATE_COMPANY_SETTINGS", label: "Update Settings" },
  { value: "CREATE_USER", label: "Create User" },
  { value: "UPDATE_USER", label: "Update User" },
  { value: "DELETE_USER", label: "Delete User" },
];

export default function AdminAuditPage() {
  const { session } = useAuth();
  
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    total: 0,
    page: 1,
    limit: 15,
    totalPages: 1,
  });
  const [search, setSearch] = useState("");
  const [selectedAction, setSelectedAction] = useState("");
  const [loading, setLoading] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null);

  // Purging and Modal states
  const [isPurgeModalOpen, setIsPurgeModalOpen] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [purging, setPurging] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (message: string, type: "success" | "error" | "info") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  };

  const fetchLogs = async (pageNum = 1) => {
    if (!session) return;
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        orgcode: session.orgcode,
        page: pageNum.toString(),
        limit: pagination.limit.toString(),
        search: search.trim(),
        action: selectedAction,
      });

      const response = await fetch(`/api/company/audit-logs?${queryParams.toString()}`);
      const data = await response.json();
      if (response.ok && data.success) {
        setLogs(data.logs || []);
        if (data.pagination) {
          setPagination(data.pagination);
        }
      }
    } catch (error) {
      console.error("Failed to load audit logs", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(1);
  }, [session, selectedAction]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLogs(1);
  };

  const handlePurgeLogs = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    setPurging(true);
    try {
      const response = await fetch(`/api/company/audit-logs?orgcode=${session.orgcode}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: confirmPassword }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        addToast("Audit logs purged successfully", "success");
        setIsPurgeModalOpen(false);
        setConfirmPassword("");
        fetchLogs(1);
      } else {
        addToast(data.message || "Failed to purge audit logs", "error");
      }
    } catch (error: any) {
      addToast(error.message || "Failed to connect to server", "error");
    } finally {
      setPurging(false);
    }
  };

  const getActionBadgeColor = (action: string) => {
    switch (action) {
      case "CREATE_SLIP":
      case "CREATE_USER":
        return "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 border border-green-200 dark:border-green-800/30";
      case "DELETE_SLIP":
      case "DELETE_USER":
      case "CLOSE_ACCOUNT":
        return "bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400 border border-rose-200 dark:border-rose-800/30";
      case "UPDATE_COMPANY_SETTINGS":
      case "UPDATE_USER":
        return "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 border border-amber-200 dark:border-amber-800/30";
      case "LOG_PAYMENT":
        return "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 border border-blue-200 dark:border-blue-800/30";
      default:
        return "bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700";
    }
  };

  const formatDetails = (details: any) => {
    if (!details) return "";
    try {
      const parsed = typeof details === "string" ? JSON.parse(details) : details;
      return JSON.stringify(parsed, null, 2);
    } catch (e) {
      return String(details);
    }
  };

  const formatSummary = (log: AuditLog) => {
    try {
      const parsed = typeof log.details === "string" ? JSON.parse(log.details) : log.details;
      switch (log.action) {
        case "CREATE_SLIP":
          return `Created slip for ${parsed.name || parsed.phone} (₹${parsed.totalamount})`;
        case "DELETE_SLIP":
          return `Deleted slip #${parsed.slipno} for ${parsed.name || parsed.phone}`;
        case "LOG_PAYMENT":
          return `Recorded payment of ₹${parsed.amount} from ${parsed.phone}`;
        case "CLOSE_ACCOUNT":
          return `Closed/cleared account for ${parsed.phone}`;
        case "UPDATE_COMPANY_SETTINGS":
          return `Updated organization name/settings: ${parsed.orgname || ""}`;
        case "CREATE_USER":
          return `Created operator account: ${parsed.targetUserid}`;
        case "UPDATE_USER":
          return `Updated user credentials/status: ${parsed.targetUserid}`;
        case "DELETE_USER":
          return `Deleted operator account: ${parsed.targetUserid}`;
        default:
          return JSON.stringify(parsed);
      }
    } catch (e) {
      return typeof log.details === "string" ? log.details : JSON.stringify(log.details);
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in relative max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Action Audit Logs</h2>
          <p className="text-slate-500 text-sm mt-1">
            Monitor system activities, operator actions, settings modifications, and financial changes.
          </p>
        </div>
        <div className="flex gap-2.5">
          <button
            onClick={() => fetchLogs(pagination.page)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
          >
            <ArrowPathIcon className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={() => setIsPurgeModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-rose-600 hover:bg-rose-700 text-white transition-colors shadow-md shadow-rose-500/20"
          >
            <TrashIcon className="w-4 h-4" />
            Purge Logs
          </button>
        </div>
      </div>

      {/* Filters Card */}
      <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm">
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1 flex flex-col gap-1.5 w-full">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Search</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Search by operator ID, details, or keywords..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white/50 dark:bg-slate-900/50 outline-none focus:ring-2 focus:ring-blue-500 transition-all dark:text-white"
              />
              <MagnifyingGlassIcon className="absolute left-3.5 top-3 w-5 h-5 text-slate-400" />
            </div>
          </div>

          <div className="w-full md:w-64 flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Filter Action</label>
            <div className="relative">
              <select
                value={selectedAction}
                onChange={(e) => setSelectedAction(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white/50 dark:bg-slate-900/50 outline-none focus:ring-2 focus:ring-blue-500 transition-all dark:text-white appearance-none cursor-pointer"
              >
                {ACTION_TYPES.map((type) => (
                  <option key={type.value} value={type.value} className="dark:bg-slate-800">
                    {type.label}
                  </option>
                ))}
              </select>
              <FunnelIcon className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
            </div>
          </div>

          <button
            type="submit"
            className="w-full md:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors shadow-md shadow-blue-500/20"
          >
            Apply Filters
          </button>
        </form>
      </div>

      {/* Logs Table Card */}
      <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/20 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
                <th className="py-4 px-6">Timestamp</th>
                <th className="py-4 px-6">Operator</th>
                <th className="py-4 px-6">Action Type</th>
                <th className="py-4 px-6">Activity Summary</th>
                <th className="py-4 px-6 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {loading && logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <ArrowPathIcon className="w-8 h-8 animate-spin text-blue-500" />
                      <span>Loading logs...</span>
                    </div>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400 dark:text-slate-500">
                    No matching audit logs found.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const isExpanded = expandedLogId === log.id;
                  return (
                    <React.Fragment key={log.id}>
                      <tr className="hover:bg-slate-50/30 dark:hover:bg-slate-700/10 transition-colors text-sm text-slate-700 dark:text-slate-200">
                        <td className="py-4 px-6 whitespace-nowrap font-medium text-slate-500 dark:text-slate-400">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="py-4 px-6 whitespace-nowrap font-semibold">
                          {log.userid}
                        </td>
                        <td className="py-4 px-6 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide ${getActionBadgeColor(log.action)}`}>
                            {log.action.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="py-4 px-6 max-w-md truncate">
                          {formatSummary(log)}
                        </td>
                        <td className="py-4 px-6 text-right whitespace-nowrap">
                          <button
                            onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                            className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            {isExpanded ? "Hide JSON" : "View JSON"}
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={5} className="py-4 px-6 bg-slate-50/80 dark:bg-slate-900/50 border-t border-b border-slate-100 dark:border-slate-800">
                            <pre className="text-xs font-mono text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 max-h-60 overflow-y-auto shadow-inner">
                              {formatDetails(log.details)}
                            </pre>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination bar */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/20">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Showing page <strong>{pagination.page}</strong> of <strong>{pagination.totalPages}</strong> ({pagination.total} total logs)
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => fetchLogs(pagination.page - 1)}
                disabled={pagination.page <= 1 || loading}
                className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeftIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => fetchLogs(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages || loading}
                className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRightIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {isPurgeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl animate-scale-up">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">Purge Action Audit Logs</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
              Warning: You are about to permanently delete all action audit logs for this organization. This action cannot be undone.
              <br/><br/>
              Please enter your admin password to confirm:
            </p>
            <form onSubmit={handlePurgeLogs} className="flex flex-col gap-4">
              <input
                type="password"
                className="w-full px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900/50 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-rose-500 transition-all font-mono"
                placeholder="Admin Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoFocus
                required
              />
              <div className="flex gap-3 justify-end mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsPurgeModalOpen(false);
                    setConfirmPassword("");
                  }}
                  className="px-4 py-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 font-medium text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={purging}
                  className="px-5 py-2 rounded-xl text-white font-semibold bg-rose-600 hover:bg-rose-700 disabled:opacity-50 transition-all text-sm shadow-md shadow-rose-500/20"
                >
                  {purging ? "Purging..." : "Confirm Purge"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toasts */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((toast) => (
          <div key={toast.id} className={`px-4 py-3 rounded shadow-lg text-white text-sm font-medium animate-slide-up ${toast.type === 'error' ? 'bg-red-500' : toast.type === 'success' ? 'bg-green-500' : 'bg-blue-500'}`}>
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
}
