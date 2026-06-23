"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { 
  BuildingOfficeIcon, 
  PlusIcon, 
  ArrowRightOnRectangleIcon,
  MagnifyingGlassIcon,
  CalendarDaysIcon,
  PencilSquareIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon
} from "@heroicons/react/24/outline";

interface Company {
  orgcode: string;
  orgname: string;
  subscription_type: string;
  subscription_start: string;
  subscription_end: string;
  isactive: boolean;
  email: string | null;
  remaining_days: number;
}

interface Toast {
  id: string;
  message: string;
  type: "success" | "error";
}

export default function SuperAdminPage() {
  const { session, logout } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Form states (Create Company)
  const [newOrgcode, setNewOrgcode] = useState("");
  const [newOrgname, setNewOrgname] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [newSubscriptionType, setNewSubscriptionType] = useState<string>("trial");
  const [creating, setCreating] = useState(false);

  // Edit Company states
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [editOrgname, setEditOrgname] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editSubscriptionType, setEditSubscriptionType] = useState<string>("trial");
  const [editSubscriptionEnd, setEditSubscriptionEnd] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [forceResetDate, setForceResetDate] = useState(false);
  const [pricingPlans, setPricingPlans] = useState<{ plan_key: string; plan_name: string; price: string; duration_months: number }[]>([]);



  const addToast = (message: string, type: "success" | "error") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const fetchCompanies = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/company/super-admin");
      const data = await res.json();
      if (res.ok && data.success) {
        setCompanies(data.companies || []);
      } else {
        addToast(data.message || "Failed to load companies", "error");
      }
    } catch (e: any) {
      addToast(e.message || "Network error loading companies", "error");
    } finally {
      setLoading(false);
    }
  };



  const fetchPricingPlans = async () => {
    try {
      const res = await fetch("/api/pricing-plans");
      const data = await res.json();
      if (res.ok && data.success) {
        setPricingPlans(data.plans || []);
      }
    } catch (e) {
      console.error("Failed to load plans", e);
    }
  };

  useEffect(() => {
    fetchCompanies();
    fetchPricingPlans();
  }, []);

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgcode.trim() || !newOrgname.trim()) {
      addToast("Org Code and Name are required", "error");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/company/super-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgcode: newOrgcode.trim().toUpperCase(),
          orgname: newOrgname.trim(),
          email: newEmail.trim() || undefined,
          adminPassword: newAdminPassword.trim() || undefined,
          subscriptionType: newSubscriptionType,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        addToast(data.message || "Company registered successfully", "success");
        setNewOrgcode("");
        setNewOrgname("");
        setNewEmail("");
        setNewAdminPassword("");
        setNewSubscriptionType("trial");
        fetchCompanies();
      } else {
        addToast(data.message || "Registration failed", "error");
      }
    } catch (e: any) {
      addToast(e.message || "Failed to connect to server", "error");
    } finally {
      setCreating(false);
    }
  };

  const handleStartEdit = (company: Company) => {
    setEditingCompany(company);
    setEditOrgname(company.orgname);
    setEditEmail(company.email || "");
    setEditSubscriptionType(company.subscription_type);
    setEditIsActive(company.isactive);
    setForceResetDate(false);
    
    // Format subscription_end to YYYY-MM-DD for date input
    const end = new Date(company.subscription_end);
    const yyyy = end.getFullYear();
    const mm = String(end.getMonth() + 1).padStart(2, '0');
    const dd = String(end.getDate()).padStart(2, '0');
    setEditSubscriptionEnd(`${yyyy}-${mm}-${dd}`);
  };

  const handleUpdateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCompany) return;
    setUpdating(true);
    try {
      const res = await fetch("/api/company/super-admin", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgcode: editingCompany.orgcode,
          orgname: editOrgname.trim(),
          email: editEmail.trim() || undefined,
          subscriptionType: editSubscriptionType,
          subscriptionEnd: editSubscriptionEnd,
          isactive: editIsActive,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        addToast(data.message || "Company updated successfully", "success");
        setEditingCompany(null);
        fetchCompanies();
      } else {
        addToast(data.message || "Failed to update company", "error");
      }
    } catch (e: any) {
      addToast(e.message || "Failed to connect to server", "error");
    } finally {
      setUpdating(false);
    }
  };

  const handleImpersonate = async (targetOrgcode: string) => {
    try {
      const res = await fetch("/api/company/super-admin/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetOrgcode }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        addToast(`Entering organization ${targetOrgcode}...`, "success");
        window.location.href = "/dashboard/admin";
      } else {
        addToast(data.message || "Failed to enter organization", "error");
      }
    } catch (e: any) {
      addToast(e.message || "Connection error", "error");
    }
  };

  const filteredCompanies = companies.filter(
    (c) =>
      c.orgcode.toLowerCase().includes(search.toLowerCase()) ||
      c.orgname.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="text-slate-900 dark:text-slate-100 flex flex-col relative">
      {/* Toast Notification Container */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-center p-4 rounded-xl shadow-2xl border backdrop-blur-md animate-slide-up ${
              toast.type === "success" 
                ? "bg-emerald-950/80 border-emerald-800 text-emerald-100" 
                : "bg-rose-950/80 border-rose-800 text-rose-100"
            }`}
          >
            <div className="flex-1 text-sm font-medium">{toast.message}</div>
            <button className="ml-3 opacity-70 hover:opacity-100" onClick={() => setToasts(t => t.filter(x => x.id !== toast.id))}>×</button>
          </div>
        ))}
      </div>

      {/* Header Panel */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-slate-250 dark:border-slate-800 mb-8">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">Clients & Pricing</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Manage client organizations, service pricing plans, and subscriptions.</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={fetchCompanies}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-300 transition-all shadow-sm"
          >
            <ArrowPathIcon className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Sync
          </button>
        </div>
      </header>

      {/* Main Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Create Company Form */}
        <div className="bg-white/80 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm backdrop-blur-xl h-fit">
          <h2 className="text-lg font-bold flex items-center gap-2 mb-4 text-slate-900 dark:text-slate-100">
            <PlusIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            Register New Company
          </h2>
          <form onSubmit={handleCreateCompany} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Organization Code</label>
              <input
                type="text"
                placeholder="e.g. CLI101"
                className="w-full px-4 py-2.5 bg-white dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm font-semibold uppercase text-slate-900 dark:text-white"
                value={newOrgcode}
                onChange={(e) => setNewOrgcode(e.target.value.toUpperCase())}
                disabled={creating}
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Organization Name</label>
              <input
                type="text"
                placeholder="e.g. Acme Corp"
                className="w-full px-4 py-2.5 bg-white dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm font-semibold text-slate-900 dark:text-white"
                value={newOrgname}
                onChange={(e) => setNewOrgname(e.target.value)}
                disabled={creating}
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Admin Email Address</label>
              <input
                type="email"
                placeholder="e.g. admin@acme.com"
                className="w-full px-4 py-2.5 bg-white dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm font-semibold text-slate-900 dark:text-white"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                disabled={creating}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Initial Admin Password</label>
              <input
                type="password"
                placeholder="Defaults to admin@123"
                className="w-full px-4 py-2.5 bg-white dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm font-semibold font-mono text-slate-900 dark:text-white"
                value={newAdminPassword}
                onChange={(e) => setNewAdminPassword(e.target.value)}
                disabled={creating}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Service Plan Model</label>
              <select
                className="w-full px-4 py-2.5 bg-white dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm font-semibold text-slate-700 dark:text-slate-200 mt-1"
                value={newSubscriptionType}
                onChange={(e) => setNewSubscriptionType(e.target.value)}
                disabled={creating}
              >
                <option value="trial" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">Trial Plan (10 Days)</option>
                {pricingPlans.map((p) => (
                  <option key={p.plan_key} value={p.plan_key} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">
                    {p.plan_name} (₹{p.price})
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={creating}
              className="w-full py-2.5 mt-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {creating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  <span>Registering...</span>
                </>
              ) : (
                <span>Register Company</span>
              )}
            </button>
          </form>
        </div>

        {/* Right Column: Listing Table */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {/* Search bar */}
          <div className="bg-white/80 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm flex items-center gap-3">
            <MagnifyingGlassIcon className="w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search companies by name or organization code..."
              className="flex-1 bg-transparent outline-none border-none text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 font-semibold"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Companies Grid */}
          <div className="bg-white/80 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-250 dark:border-slate-850 bg-slate-50/50 dark:bg-slate-900/30 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
                    <th className="py-4 px-6">Company</th>
                    <th className="py-4 px-6">Service Plan</th>
                    <th className="py-4 px-6">Expiry & Remaining</th>
                    <th className="py-4 px-6">Status</th>
                    <th className="py-4 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-750 text-sm">
                  {loading && companies.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-500">
                        <div className="flex flex-col items-center justify-center gap-2">
                           <ArrowPathIcon className="w-6 h-6 animate-spin text-blue-500" />
                          <span>Fetching companies...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredCompanies.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-500">
                        No client companies registered yet.
                      </td>
                    </tr>
                  ) : (
                    filteredCompanies.map((c) => {
                      const isExpired = c.remaining_days <= 0;
                      return (
                        <tr key={c.orgcode} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/10 transition-colors">
                          <td className="py-4 px-6">
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-900 dark:text-slate-100">{c.orgname}</span>
                              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono uppercase">Code: {c.orgcode}</span>
                              {c.email && <span className="text-xs text-slate-500">{c.email}</span>}
                              {c.subscription_start && (
                                <span className="text-xs text-slate-550 dark:text-slate-500">
                                  Registered: {new Date(c.subscription_start).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                              c.subscription_type === "trial"
                                ? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-350 dark:border-slate-700"
                                : "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 border-blue-200 dark:border-blue-800/30"
                            }`}>
                              {c.subscription_type === "trial" ? "Trial Plan" : (pricingPlans.find(p => p.plan_key === c.subscription_type)?.plan_name || c.subscription_type)}
                            </span>
                          </td>
                          <td className="py-4 px-6">
                            <div className="flex flex-col gap-0.5">
                              <span className={`font-semibold text-xs ${isExpired ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                                {isExpired ? "Expired" : `${Math.ceil(c.remaining_days)} days left`}
                              </span>
                              <span className="text-xs text-slate-500 flex items-center gap-1">
                                <CalendarDaysIcon className="w-3.5 h-3.5" />
                                {new Date(c.subscription_end).toLocaleDateString()}
                              </span>
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                              c.isactive && !isExpired
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-250 dark:border-emerald-900"
                                : "bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 border border-rose-250 dark:border-rose-900"
                            }`}>
                              {c.isactive && !isExpired ? (
                                <>
                                  <CheckCircleIcon className="w-3.5 h-3.5" />
                                  Active
                                </>
                              ) : (
                                <>
                                  <XCircleIcon className="w-3.5 h-3.5" />
                                  Suspended
                                </>
                              )}
                            </span>
                          </td>
                           <td className="py-4 px-6 text-right flex justify-end gap-2">
                             <button
                               onClick={() => handleImpersonate(c.orgcode)}
                               className="p-2 bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg transition-all border border-slate-200 dark:border-slate-700 shadow-sm"
                               title="Enter directly to Org Code as Admin"
                             >
                               <ArrowRightOnRectangleIcon className="w-4 h-4" />
                             </button>
                             <button
                               onClick={() => handleStartEdit(c)}
                               className="p-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg transition-all border border-slate-200 dark:border-slate-700 shadow-sm"
                               title="Edit settings or update subscription plan"
                             >
                               <PencilSquareIcon className="w-4 h-4" />
                             </button>
                           </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>

      {/* Edit Subscription Modal */}
      {editingCompany && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl animate-scale-up">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">Edit {editingCompany.orgname} Settings</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">Modify client details, suspend the account, or extend subscription duration.</p>
            
            <form onSubmit={handleUpdateCompany} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Company Name</label>
                <input
                  type="text"
                  className="w-full px-4 py-2 bg-white dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm font-semibold text-slate-900 dark:text-white"
                  value={editOrgname}
                  onChange={(e) => setEditOrgname(e.target.value)}
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Email Address</label>
                <input
                  type="email"
                  className="w-full px-4 py-2 bg-white dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm font-semibold text-slate-900 dark:text-white"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Subscription Plan Type</label>
                <select
                  className="w-full px-4 py-2.5 bg-white dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm font-semibold text-slate-700 dark:text-slate-200 mt-1"
                  value={editSubscriptionType}
                  onChange={(e) => {
                    const nextVal = e.target.value;
                    setEditSubscriptionType(nextVal);
                    if (nextVal !== "trial") {
                      const durationMonths = pricingPlans.find(p => p.plan_key === nextVal)?.duration_months || 1;
                      const currentEnd = new Date(editingCompany.subscription_end);
                      const baseDate = (!forceResetDate && currentEnd > new Date()) ? currentEnd : new Date();
                      const end = new Date(baseDate);
                      end.setMonth(end.getMonth() + durationMonths);
                      const yyyy = end.getFullYear();
                      const mm = String(end.getMonth() + 1).padStart(2, '0');
                      const dd = String(end.getDate()).padStart(2, '0');
                      setEditSubscriptionEnd(`${yyyy}-${mm}-${dd}`);
                    }
                  }}
                >
                  <option value="trial" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">Trial Plan (10 Days)</option>
                  {pricingPlans.map((p) => (
                    <option key={p.plan_key} value={p.plan_key} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">
                      {p.plan_name}
                    </option>
                  ))}
                </select>
              </div>
              {editSubscriptionType !== "trial" && (
                <div className="flex items-center gap-3 py-1 bg-slate-50 dark:bg-slate-900/30 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700/50">
                  <input
                    type="checkbox"
                    id="forceResetDate"
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/50 cursor-pointer"
                    checked={forceResetDate}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setForceResetDate(checked);
                      
                      const durationMonths = pricingPlans.find(p => p.plan_key === editSubscriptionType)?.duration_months || 1;
                      const currentEnd = new Date(editingCompany.subscription_end);
                      const baseDate = (!checked && currentEnd > new Date()) ? currentEnd : new Date();
                      
                      const end = new Date(baseDate);
                      end.setMonth(end.getMonth() + durationMonths);
                      const yyyy = end.getFullYear();
                      const mm = String(end.getMonth() + 1).padStart(2, '0');
                      const dd = String(end.getDate()).padStart(2, '0');
                      setEditSubscriptionEnd(`${yyyy}-${mm}-${dd}`);
                    }}
                  />
                  <label htmlFor="forceResetDate" className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none leading-normal">
                    Reset/Override end date starting from today (ignore remaining days)
                  </label>
                </div>
              )}
              {editSubscriptionType !== "trial" && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-550 dark:text-slate-400 font-sans">Subscription End Date</label>
                  <input
                    type="date"
                    className="w-full px-4 py-2 bg-white dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm font-semibold text-slate-900 dark:text-white"
                    value={editSubscriptionEnd}
                    onChange={(e) => setEditSubscriptionEnd(e.target.value)}
                    required
                  />
                </div>
              )}

              <div className="flex items-center gap-3 py-2">
                <input
                  type="checkbox"
                  id="editIsActive"
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/50"
                  checked={editIsActive}
                  onChange={(e) => setEditIsActive(e.target.checked)}
                />
                <label htmlFor="editIsActive" className="text-sm font-semibold text-slate-700 dark:text-slate-300">Organization Account Active</label>
              </div>

              <div className="flex gap-3 justify-end mt-4">
                <button
                  type="button"
                  onClick={() => setEditingCompany(null)}
                  className="px-4 py-2 rounded-xl text-slate-650 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 font-semibold text-sm transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm transition-all shadow-md shadow-blue-500/20"
                >
                  {updating ? "Saving..." : "Save Settings"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
