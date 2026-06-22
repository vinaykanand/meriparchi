"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowPathIcon,
  TrashIcon,
  BuildingOfficeIcon
} from "@heroicons/react/24/outline";

interface AuditLog {
  id: number;
  orgcode: string;
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
  { value: "LOGIN_SUCCESS", label: "Login Success" },
  { value: "LOGIN_FAILED", label: "Login Failed" },
  { value: "LOGOUT", label: "Logout" },
  { value: "MANUAL_BACKUP_LOCAL", label: "Manual Local Backup" },
  { value: "MANUAL_BACKUP_GDRIVE", label: "Manual Drive Backup" },
  { value: "AUTO_BACKUP_GDRIVE", label: "Auto Drive Backup" },
  { value: "RESTORE_BACKUP_LOCAL", label: "Restore Local Backup" },
  { value: "RESTORE_BACKUP_GDRIVE", label: "Restore Drive Backup" },
  { value: "RESTORE_PARTIAL_LOCAL", label: "Restore Partial Local" },
  { value: "RESTORE_PARTIAL_GDRIVE", label: "Restore Partial Drive" },
];

interface CompanySuggestion {
  orgcode: string;
  orgname: string;
}

export default function SuperAdminAuditPage() {
  const { session } = useAuth();

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 1,
  });
  
  // Active search/filter states that trigger API requests
  const [search, setSearch] = useState("");
  const [filterOrg, setFilterOrg] = useState("");

  // Temporary input states
  const [searchInputVal, setSearchInputVal] = useState("");
  const [orgcodeInputVal, setOrgcodeInputVal] = useState("");
  const [showOrgSuggestions, setShowOrgSuggestions] = useState(false);
  const [availableCompanies, setAvailableCompanies] = useState<CompanySuggestion[]>([]);

  const [selectedActions, setSelectedActions] = useState<string[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null);
  const [isActionDropdownOpen, setIsActionDropdownOpen] = useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const orgSuggestionsRef = React.useRef<HTMLDivElement>(null);

  // Purging and Modal states
  const [isPurgeModalOpen, setIsPurgeModalOpen] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [purging, setPurging] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [exportingCsv, setExportingCsv] = useState(false);

  const addToast = (message: string, type: "success" | "error" | "info") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  };

  const handleExportCSV = async () => {
    if (!session) return;
    setExportingCsv(true);
    try {
      const url = `/api/company/super-admin/audit-logs?page=1&limit=5000&orgcode=${encodeURIComponent(filterOrg.trim())}&search=${encodeURIComponent(search.trim())}&action=${encodeURIComponent(selectedActions.join(","))}&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok && data.success && data.logs) {
        const exportLogs = data.logs;
        const headers = ["Timestamp", "Org Code", "Operator", "Action Type", "Activity Summary", "Details (JSON)"];
        const csvRows = exportLogs.map((log: any) => {
          const timestamp = new Date(log.timestamp).toLocaleString();
          const org = log.orgcode;
          const operator = log.userid;
          const actionType = log.action;
          const summary = formatSummary(log);
          const details = typeof log.details === "string" ? log.details : JSON.stringify(log.details);
          
          return [timestamp, org, operator, actionType, summary, details].map(field => {
            const escaped = String(field || "").replace(/"/g, '""');
            return `"${escaped}"`;
          }).join(",");
        });
        
        const csvContent = [headers.join(","), ...csvRows].join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const downloadUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        const timestampStr = new Date().toISOString().slice(0, 10);
        link.setAttribute("href", downloadUrl);
        link.setAttribute("download", `global_audit_log_${timestampStr}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        addToast("Audit logs exported to CSV successfully!", "success");
      } else {
        addToast(data.message || "Failed to fetch logs for export", "error");
      }
    } catch (e: any) {
      addToast("Failed to export CSV: " + (e.message || String(e)), "error");
    } finally {
      setExportingCsv(false);
    }
  };

  const fetchLogs = async (pageNum = 1) => {
    if (!session) return;
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: pageNum.toString(),
        limit: pagination.limit.toString(),
        orgcode: filterOrg.trim(),
        search: search.trim(),
        action: selectedActions.join(","),
        startDate: startDate,
        endDate: endDate,
      });

      const response = await fetch(`/api/company/super-admin/audit-logs?${queryParams.toString()}`);
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

  // Fetch available companies list on mount for suggestions
  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const res = await fetch("/api/company/super-admin");
        const data = await res.json();
        if (res.ok && data.success) {
          setAvailableCompanies(data.companies || []);
        }
      } catch (err) {
        console.error("Failed to load companies suggestions list", err);
      }
    };
    fetchCompanies();
  }, []);

  useEffect(() => {
    fetchLogs(1);
  }, [session, selectedActions, startDate, endDate, search, filterOrg]);

  useEffect(() => {
    const handleGlobalClick = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsActionDropdownOpen(false);
      }
      if (orgSuggestionsRef.current && !orgSuggestionsRef.current.contains(event.target as Node)) {
        setShowOrgSuggestions(false);
      }
    };
    document.addEventListener("click", handleGlobalClick);
    return () => document.removeEventListener("click", handleGlobalClick);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInputVal);
    setFilterOrg(orgcodeInputVal);
    setShowOrgSuggestions(false);
  };

  const handlePurgeLogs = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    setPurging(true);
    try {
      const url = filterOrg.trim() 
        ? `/api/company/super-admin/audit-logs?orgcode=${encodeURIComponent(filterOrg.trim())}`
        : `/api/company/super-admin/audit-logs`;

      const response = await fetch(url, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: confirmPassword }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        addToast(data.message || "Audit logs purged successfully", "success");
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
      case "LOGIN_SUCCESS":
        return "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 border border-green-200 dark:border-green-800/30";
      case "MANUAL_BACKUP_LOCAL":
        return "bg-cyan-50 text-cyan-700 dark:bg-cyan-900/20 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-800/30";
      case "MANUAL_BACKUP_GDRIVE":
        return "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/30";
      case "AUTO_BACKUP_GDRIVE":
        return "bg-teal-50 text-teal-700 dark:bg-teal-900/20 dark:text-teal-400 border border-teal-200 dark:border-teal-800/30";
      case "RESTORE_BACKUP_LOCAL":
        return "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/30";
      case "RESTORE_BACKUP_GDRIVE":
        return "bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400 border border-purple-200 dark:border-purple-800/30";
      case "RESTORE_PARTIAL_LOCAL":
        return "bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-400 border border-sky-200 dark:border-sky-800/30";
      case "RESTORE_PARTIAL_GDRIVE":
        return "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 border border-blue-200 dark:border-blue-800/30";
      case "DELETE_SLIP":
      case "DELETE_USER":
      case "CLOSE_ACCOUNT":
      case "LOGIN_FAILED":
        return "bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400 border border-rose-200 dark:border-rose-800/30";
      case "UPDATE_COMPANY_SETTINGS":
      case "UPDATE_USER":
        return "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 border border-amber-200 dark:border-amber-800/30";
      case "LOG_PAYMENT":
        return "bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-400 border border-violet-200 dark:border-violet-800/30";
      case "LOGOUT":
        return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700";
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
          return `Updated settings: ${parsed.orgname || ""}`;
        case "CREATE_USER":
          return `Created operator: ${parsed.targetUserid}`;
        case "UPDATE_USER":
          return `Updated user credentials: ${parsed.targetUserid}`;
        case "DELETE_USER":
          return `Deleted operator: ${parsed.targetUserid}`;
        case "LOGIN_SUCCESS":
          return `Successful login: ${parsed.username || log.userid}${parsed.ip ? ` from IP ${parsed.ip}` : ""}`;
        case "LOGIN_FAILED":
          return `Failed login: ${parsed.username || log.userid || "Unknown"}${parsed.message || parsed.reason ? ` (${parsed.message || parsed.reason})` : ""}`;
        case "LOGOUT":
          return `Logged out: ${parsed.username || log.userid}`;
        case "MANUAL_BACKUP_LOCAL":
          return `Manual local backup exported: ${parsed.filename || ""}`;
        case "MANUAL_BACKUP_GDRIVE":
          return parsed.success 
            ? `Backup uploaded to GDrive: ${parsed.filename || `File ID: ${parsed.fileId}`}` 
            : `Backup to GDrive failed: ${parsed.error || "Unknown error"}`;
        case "AUTO_BACKUP_GDRIVE":
          return parsed.success 
            ? `Auto backup completed to GDrive: ${parsed.filename || `File ID: ${parsed.fileId}`}` 
            : `Auto backup to GDrive failed: ${parsed.error || "Unknown error"}`;
        case "RESTORE_BACKUP_LOCAL":
          return `Database restored from local: ${parsed.filename || "local file"}`;
        case "RESTORE_BACKUP_GDRIVE":
          return `Database restored from GDrive: ${parsed.filename || `File ID: ${parsed.fileId}`}`;
        default:
          return JSON.stringify(parsed);
      }
    } catch (e) {
      return typeof log.details === "string" ? log.details : JSON.stringify(log.details);
    }
  };  return (
    <div className="flex flex-col gap-6 animate-fade-in relative max-w-7xl mx-auto p-2 text-slate-900 dark:text-slate-100">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">Global Audit Logs</h1>
          <p className="text-slate-500 text-sm mt-1">
            Monitor system activities, backup logs, and administrator activities across all client organizations.
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
      <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm relative z-20">
        <form onSubmit={handleSearchSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col lg:flex-row gap-4 items-end w-full">
            {/* Search Input */}
            <div className="flex-1 flex flex-col gap-1.5 w-full">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Search</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search by operator ID, action details, or logs description..."
                  value={searchInputVal}
                  onChange={(e) => setSearchInputVal(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white/50 dark:bg-slate-900/50 outline-none focus:ring-2 focus:ring-blue-500 transition-all dark:text-white text-sm"
                />
                <MagnifyingGlassIcon className="absolute left-3.5 top-3 w-5 h-5 text-slate-400" />
              </div>
            </div>

            {/* Orgcode Input with Suggestions */}
            <div ref={orgSuggestionsRef} className="w-full lg:w-48 flex flex-col gap-1.5 relative">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Org Code</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="All Orgs"
                  value={orgcodeInputVal}
                  onChange={(e) => {
                    setOrgcodeInputVal(e.target.value.toUpperCase());
                    setShowOrgSuggestions(true);
                  }}
                  onFocus={() => setShowOrgSuggestions(true)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white/50 dark:bg-slate-900/50 outline-none focus:ring-2 focus:ring-blue-500 transition-all dark:text-white text-sm uppercase"
                />
                <BuildingOfficeIcon className="absolute left-3.5 top-3 w-5 h-5 text-slate-400" />
                
                {showOrgSuggestions && availableCompanies.filter(c =>
                  c.orgcode.toLowerCase().includes(orgcodeInputVal.toLowerCase()) ||
                  c.orgname.toLowerCase().includes(orgcodeInputVal.toLowerCase())
                ).length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 max-h-60 overflow-y-auto z-50 py-1 divide-y divide-slate-100 dark:divide-slate-800">
                    {availableCompanies.filter(c =>
                      c.orgcode.toLowerCase().includes(orgcodeInputVal.toLowerCase()) ||
                      c.orgname.toLowerCase().includes(orgcodeInputVal.toLowerCase())
                    ).map((c) => (
                      <button
                        key={c.orgcode}
                        type="button"
                        onClick={() => {
                          setOrgcodeInputVal(c.orgcode);
                          setShowOrgSuggestions(false);
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors flex flex-col justify-center cursor-pointer"
                      >
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">
                          {c.orgname}
                        </span>
                        <span className="text-[10px] font-mono font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                          Code: {c.orgcode}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
              <button
                type="submit"
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors shadow-md shadow-blue-500/20 text-sm min-h-[46px] w-full sm:w-auto"
              >
                Apply Filters
              </button>
              <button
                type="button"
                onClick={handleExportCSV}
                disabled={exportingCsv}
                className="px-6 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold rounded-xl transition-all disabled:opacity-50 text-sm border border-slate-200 dark:border-slate-700 shadow-sm min-h-[46px] w-full sm:w-auto"
              >
                {exportingCsv ? "Exporting..." : "Export CSV"}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
            <div className="flex flex-col gap-1.5 w-full">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white/50 dark:bg-slate-900/50 outline-none focus:ring-2 focus:ring-blue-500 transition-all dark:text-white text-sm font-semibold min-h-[46px]"
              />
            </div>

            <div className="flex flex-col gap-1.5 w-full">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white/50 dark:bg-slate-900/50 outline-none focus:ring-2 focus:ring-blue-500 transition-all dark:text-white text-sm font-semibold min-h-[46px]"
              />
            </div>

            <div ref={dropdownRef} className="flex flex-col gap-1.5 w-full">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Filter Action</label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsActionDropdownOpen(!isActionDropdownOpen)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white/50 dark:bg-slate-900/50 outline-none focus:ring-2 focus:ring-blue-500 transition-all dark:text-white flex items-center justify-between cursor-pointer text-sm font-semibold min-h-[46px]"
                >
                  <span className="truncate flex items-center gap-1.5">
                    {selectedActions.length === 0 ? (
                      "All Actions"
                    ) : selectedActions.length === 1 ? (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide ${getActionBadgeColor(selectedActions[0])}`}>
                        {ACTION_TYPES.find(a => a.value === selectedActions[0])?.label || selectedActions[0].replace(/_/g, " ")}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-750 dark:bg-blue-900/20 dark:text-blue-400 border border-blue-200 dark:border-blue-800/30 uppercase tracking-wide">
                        {selectedActions.length} Actions
                      </span>
                    )}
                  </span>
                  <span className="text-slate-400 text-xs">▼</span>
                </button>
                <FunnelIcon className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400 pointer-events-none" />

                {isActionDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 max-h-64 overflow-y-auto z-50 py-1 divide-y divide-slate-100 dark:divide-slate-800">
                    {ACTION_TYPES.map((type) => {
                      const isChecked = type.value === "" 
                        ? selectedActions.length === 0 
                        : selectedActions.includes(type.value);

                      return (
                        <button
                          key={type.value}
                          type="button"
                          onClick={() => {
                            if (type.value === "") {
                              setSelectedActions([]);
                            } else {
                              setSelectedActions((prev) => {
                                if (prev.includes(type.value)) {
                                  return prev.filter((x) => x !== type.value);
                                } else {
                                  return [...prev, type.value];
                                }
                              });
                            }
                          }}
                          className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors flex items-center gap-3 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}} 
                            className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 pointer-events-none"
                          />
                          {type.value ? (
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide ${getActionBadgeColor(type.value)}`}>
                              {type.label}
                            </span>
                          ) : (
                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                              All Actions
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* Logs Table Card */}
      <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden relative z-10">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse table-fixed">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/20 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
                <th className="py-4 px-6 w-[18%] min-w-[120px]">Timestamp</th>
                <th className="py-4 px-6 w-[10%] min-w-[80px]">Org Code</th>
                <th className="py-4 px-6 w-[12%] min-w-[80px]">Operator</th>
                <th className="py-4 px-6 w-[18%] min-w-[110px]">Action Type</th>
                <th className="py-4 px-6 w-[32%]">Activity Summary</th>
                <th className="py-4 px-6 w-[10%] text-right min-w-[80px]">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {loading && logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <ArrowPathIcon className="w-8 h-8 animate-spin text-blue-500" />
                      <span>Loading logs...</span>
                    </div>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 dark:text-slate-500">
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
                        <td className="py-4 px-6 whitespace-nowrap font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wide font-mono">
                          {log.orgcode}
                        </td>
                        <td className="py-4 px-6 whitespace-nowrap font-semibold">
                          {log.userid}
                        </td>
                        <td className="py-4 px-6 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide ${getActionBadgeColor(log.action)}`}>
                            {log.action.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="py-4 px-6 whitespace-normal break-words">
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
                          <td colSpan={6} className="py-4 px-6 bg-slate-50/80 dark:bg-slate-900/50 border-t border-b border-slate-100 dark:border-slate-800">
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
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">Purge Action Audit Logs</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
              Warning: You are about to permanently delete action audit logs. This action cannot be undone.
              {filterOrg.trim() && (
                <span className="block mt-2 font-semibold text-rose-600 dark:text-rose-400">
                  Target Org Code: {filterOrg.trim().toUpperCase()} Only
                </span>
              )}
              <br />
              Please enter your super admin password to confirm:
            </p>
            <form onSubmit={handlePurgeLogs} className="flex flex-col gap-4">
              <input
                type="password"
                className="w-full px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900/50 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-rose-500 transition-all font-mono"
                placeholder="Super Admin Password"
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
