"use client";

import { useState, useEffect } from "react";
import styles from "./admin.module.css";

interface User {
  userid: string;
  isadmin: boolean;
  isactive: boolean;
  otp?: string | number;
  created_at: string;
}

interface SlipItemInput {
  item: string;
  remarks: string;
  qty: string;
  rate: string;
}

interface Toast {
  id: string;
  message: string;
  type: "success" | "error";
}

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [activeTab, setActiveTab] = useState<"overview" | "create" | "users" | "settings">("overview");

  // Session details
  const [session, setSession] = useState<{
    orgcode: string;
    userid: string;
    isadmin: boolean;
  } | null>(null);

  // Users state
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [newUserId, setNewUserId] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserIsAdmin, setNewUserIsAdmin] = useState(false);
  const [newUserIsActive, setNewUserIsActive] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [resettingOtp, setResettingOtp] = useState(false);

  // Company settings state
  const [orgname, setOrgname] = useState("");
  const [enableotp, setEnableotp] = useState(false);
  const [savingCompany, setSavingCompany] = useState(false);

  // Ledger: Slip entry state
  const [slipPhone, setSlipPhone] = useState("");
  const [slipName, setSlipName] = useState("");
  const [slipAddress, setSlipAddress] = useState("");
  const [slipDiscount, setSlipDiscount] = useState("0");
  const [slipItems, setSlipItems] = useState<SlipItemInput[]>([{ item: "", remarks: "", qty: "1", rate: "0" }]);
  const [savingSlip, setSavingSlip] = useState(false);

  // Ledger: Payment entry state
  const [payPhone, setPayPhone] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [payNarration, setPayNarration] = useState("");
  const [savingPayment, setSavingPayment] = useState(false);

  // Global Toast state
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (message: string, type: "success" | "error") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  useEffect(() => {
    // Determine theme
    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setTheme(isDark ? "dark" : "light");

    // Verify session via server
    const checkAuth = async () => {
      try {
        const res = await fetch("/api/auth/verify");
        const data = await res.json();
        if (res.ok && data.success) {
          if (!data.isadmin) {
            // Redirect operator to their dashboard
            window.location.href = "/dashboard/user";
            return;
          }
          const sessionObj = {
            orgcode: data.orgcode,
            userid: data.userid,
            isadmin: data.isadmin,
          };
          localStorage.setItem("parchi_session", JSON.stringify(sessionObj));
          setSession(sessionObj);
          setOrgname(data.orgcode + " Enterprise");
          setLoading(false);
        } else {
          // Unauthenticated, clear local storage and redirect
          localStorage.removeItem("parchi_session");
          document.cookie = "authtoken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
          document.cookie = "orgcode=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
          window.location.href = "/";
        }
      } catch (err) {
        localStorage.removeItem("parchi_session");
        window.location.href = "/";
      }
    };
    checkAuth();
  }, []);

  // Fetch users when on users tab
  useEffect(() => {
    if (activeTab === "users" && session) {
      fetchUsers();
    }
  }, [activeTab, session]);

  const fetchUsers = async () => {
    if (!session) return;
    setLoadingUsers(true);
    try {
      const response = await fetch(`/api/users?orgcode=${session.orgcode}`);
      const data = await response.json();
      if (response.ok && data.success) {
        setUsers(data.users || []);
      } else {
        addToast(data.message || "Failed to load users", "error");
      }
    } catch (err: any) {
      addToast(err.message || "Database connection error", "error");
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    if (!newUserId.trim() || !newUserPassword.trim()) {
      addToast("User ID and Password are required", "error");
      return;
    }

    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgcode: session.orgcode,
          userid: newUserId.trim(),
          password: newUserPassword.trim(),
          isadmin: newUserIsAdmin,
          isactive: newUserIsActive,
        }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        addToast(data.message || (isEditMode ? "User updated successfully" : "User created successfully"), "success");
        setNewUserId("");
        setNewUserPassword("");
        setNewUserIsAdmin(false);
        setNewUserIsActive(true);
        setIsEditMode(false);
        fetchUsers();
      } else {
        addToast(data.message || "Failed to create user", "error");
      }
    } catch (err: any) {
      addToast(err.message || "Network error", "error");
    }
  };

  const handleEditUser = (user: User) => {
    if (user.userid === 'admin') {
      addToast("The primary admin account cannot be edited.", "error");
      return;
    }
    setIsEditMode(true);
    setNewUserId(user.userid);
    setNewUserPassword(""); 
    setNewUserIsAdmin(user.isadmin);
    setNewUserIsActive(user.isactive);
  };

  const handleCancelEdit = () => {
    setIsEditMode(false);
    setNewUserId("");
    setNewUserPassword("");
    setNewUserIsAdmin(false);
    setNewUserIsActive(true);
  };

  const toggleUserSelection = (userid: string) => {
    setSelectedUsers(prev => 
      prev.includes(userid) ? prev.filter(id => id !== userid) : [...prev, userid]
    );
  };

  const handleResetSelectedOtps = async () => {
    if (selectedUsers.length === 0 || !session) return;
    setResettingOtp(true);
    try {
      const response = await fetch("/api/users-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgcode: session.orgcode,
          userids: selectedUsers,
        }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        addToast(data.message || "OTPs reset successfully", "success");
        setSelectedUsers([]);
        fetchUsers();
      } else {
        addToast(data.message || "Failed to reset OTPs", "error");
      }
    } catch (err: any) {
      addToast(err.message || "Network error", "error");
    } finally {
      setResettingOtp(false);
    }
  };

  const handleResetAllOtps = async () => {
    if (!session) return;
    if (!confirm("Are you sure you want to reset OTPs for all users?")) return;
    setResettingOtp(true);
    try {
      const response = await fetch("/api/users-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgcode: session.orgcode,
          userids: null,
        }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        addToast(data.message || "All OTPs reset successfully", "success");
        setSelectedUsers([]);
        fetchUsers();
      } else {
        addToast(data.message || "Failed to reset OTPs", "error");
      }
    } catch (err: any) {
      addToast(err.message || "Network error", "error");
    } finally {
      setResettingOtp(false);
    }
  };

  const handleUpdateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    setSavingCompany(true);

    try {
      const response = await fetch("/api/company", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgname: orgname.trim(),
          isactive: true,
          enableotp: enableotp,
        }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        addToast(data.message || "Company settings updated successfully", "success");
      } else {
        addToast(data.message || "Failed to update company settings", "error");
      }
    } catch (err: any) {
      addToast(err.message || "Network error", "error");
    } finally {
      setSavingCompany(false);
    }
  };

  // Slip Items management
  const addSlipItemField = () => {
    setSlipItems([...slipItems, { item: "", remarks: "", qty: "1", rate: "0" }]);
  };

  const removeSlipItemField = (index: number) => {
    if (slipItems.length === 1) return;
    setSlipItems(slipItems.filter((_, i) => i !== index));
  };

  const updateSlipItemField = (index: number, field: keyof SlipItemInput, value: string) => {
    const updated = slipItems.map((item, i) => {
      if (i === index) {
        return { ...item, [field]: value };
      }
      return item;
    });
    setSlipItems(updated);
  };

  const getSlipTotals = () => {
    let total = 0;
    slipItems.forEach((it) => {
      const q = parseFloat(it.qty) || 0;
      const r = parseFloat(it.rate) || 0;
      total += q * r;
    });
    const disc = parseFloat(slipDiscount) || 0;
    const net = Math.max(0, total - disc);
    return { total, net };
  };

  const handleSaveSlip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    if (!slipPhone.trim()) {
      addToast("Customer phone number is required", "error");
      return;
    }

    const invalidItem = slipItems.some((it) => !it.item.trim());
    if (invalidItem) {
      addToast("All item names must be specified", "error");
      return;
    }

    setSavingSlip(true);
    const { total } = getSlipTotals();
    const disc = parseFloat(slipDiscount) || 0;

    // Format items array into JSON elements matching database expectation
    const formattedItems = slipItems.map((it) => ({
      item: it.item.trim(),
      remarks: it.remarks.trim(),
      qty: parseFloat(it.qty) || 0,
      rate: parseFloat(it.rate) || 0,
    }));

    try {
      const response = await fetch("/api/ledger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "slip",
          orgcode: session.orgcode,
          phone: slipPhone.trim(),
          name: slipName.trim(),
          address: slipAddress.trim(),
          totalamount: total,
          discount: disc,
          items: formattedItems,
        }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        addToast(data.message || "Slip saved successfully", "success");
        setSlipPhone("");
        setSlipName("");
        setSlipAddress("");
        setSlipDiscount("0");
        setSlipItems([{ item: "", remarks: "", qty: "1", rate: "0" }]);
      } else {
        addToast(data.message || "Failed to save slip", "error");
      }
    } catch (err: any) {
      addToast(err.message || "Network error", "error");
    } finally {
      setSavingSlip(false);
    }
  };

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    if (!payPhone.trim() || !payAmount.trim()) {
      addToast("Customer phone and amount are required", "error");
      return;
    }

    setSavingPayment(true);

    try {
      const response = await fetch("/api/ledger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "payment",
          orgcode: session.orgcode,
          phone: payPhone.trim(),
          amount: parseFloat(payAmount) || 0,
          narration: payNarration.trim(),
        }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        addToast(data.message || "Payment logged successfully", "success");
        setPayPhone("");
        setPayAmount("");
        setPayNarration("");
      } else {
        addToast(data.message || "Failed to log payment", "error");
      }
    } catch (err: any) {
      addToast(err.message || "Network error", "error");
    } finally {
      setSavingPayment(false);
    }
  };

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  const handleLogout = () => {
    localStorage.removeItem("parchi_session");
    document.cookie = "authtoken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
    document.cookie = "orgcode=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
    window.location.href = "/";
  };

  if (loading) {
    return (
      <div className={`${styles.container} ${theme === "dark" ? styles.darkMode : ""}`} style={{ justifyContent: "center", alignItems: "center" }}>
        <div className={styles.spinner} style={{ width: "48px", height: "48px" }} />
      </div>
    );
  }

  const { total: slipTotalSum, net: slipNetSum } = getSlipTotals();

  return (
    <div className={`${styles.container} ${theme === "dark" ? styles.darkMode : ""}`}>
      {/* Background blobs */}
      <div className={styles.bgBlob1} />
      <div className={styles.bgBlob2} />

      {/* Toasts */}
      <div className={styles.toastContainer}>
        {toasts.map((toast) => (
          <div key={toast.id} className={`${styles.toast} ${toast.type === "success" ? styles.toastSuccess : styles.toastError}`}>
            <div className={styles.toastMessage}>{toast.message}</div>
            <button className={styles.toastClose} onClick={() => setToasts(toasts.filter((t) => t.id !== toast.id))}>×</button>
          </div>
        ))}
      </div>

      {/* Header controls */}
      <header className={styles.header}>
        <div className={styles.brand}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className={styles.logoSvg}>
            <rect x="3" y="3" width="18" height="18" rx="5" fill="url(#adminGrad)" />
            <path d="M7 8H17" stroke="white" strokeWidth="2" strokeLinecap="round" />
            <path d="M7 12H17" stroke="white" strokeWidth="2" strokeLinecap="round" />
            <path d="M7 16H13" stroke="white" strokeWidth="2" strokeLinecap="round" />
            <defs>
              <linearGradient id="adminGrad" x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">
                <stop stopColor="#ff453a" />
                <stop offset="1" stopColor="#ff9f0a" />
              </linearGradient>
            </defs>
          </svg>
          <span className={styles.brandName}>Parchi Admin</span>
        </div>

        <div className={styles.userInfo}>
          <div className={styles.sessionBadge}>
            <span className={styles.orgLabel}>Org Code:</span>
            <span className={styles.orgValue}>{session?.orgcode}</span>
          </div>
          <div className={styles.sessionBadge}>
            <span className={styles.orgLabel}>User:</span>
            <span className={styles.orgValue}>{session?.userid}</span>
          </div>
          <button className={styles.themeBtn} onClick={toggleTheme} aria-label="Toggle Theme">
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
          <button className={styles.logoutBtn} onClick={handleLogout}>
            Sign Out
          </button>
        </div>
      </header>

      <div className={styles.mainGrid}>
        {/* Sidebar Nav */}
        <aside className={styles.sidebar}>
          <nav className={styles.nav}>
            <button className={`${styles.navItem} ${activeTab === "overview" ? styles.navActive : ""}`} onClick={() => setActiveTab("overview")}>
              Overview
            </button>
            <button className={`${styles.navItem} ${activeTab === "create" ? styles.navActive : ""}`} onClick={() => setActiveTab("create")}>
              Create Record
            </button>
            <button className={`${styles.navItem} ${activeTab === "users" ? styles.navActive : ""}`} onClick={() => setActiveTab("users")}>
              Manage Users
            </button>
            <button className={`${styles.navItem} ${activeTab === "settings" ? styles.navActive : ""}`} onClick={() => setActiveTab("settings")}>
              Company Settings
            </button>
          </nav>
        </aside>

        {/* Content Container */}
        <main className={styles.content}>
          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" && (
            <div className={styles.tabContent}>
              <h2 className={styles.pageTitle}>Dashboard Overview</h2>
              <p className={styles.pageSubtitle}>High level summaries of database actions and ledger details.</p>

              <div className={styles.metricGrid}>
                <div className={styles.metricCard}>
                  <div className={styles.metricHeader}>
                    <span>Pending Accounts</span>
                    <span className={styles.metricIcon}>🧾</span>
                  </div>
                  <div className={styles.metricValue}>12</div>
                  <div className={styles.metricSubtext}>Across all organization phones</div>
                </div>

                <div className={styles.metricCard}>
                  <div className={styles.metricHeader}>
                    <span>Total Slips Generated</span>
                    <span className={styles.metricIcon}>📄</span>
                  </div>
                  <div className={styles.metricValue}>84</div>
                  <div className={styles.metricSubtext}>All-time bills issued</div>
                </div>

                <div className={styles.metricCard}>
                  <div className={styles.metricHeader}>
                    <span>Outstanding Ledger</span>
                    <span className={styles.metricIcon}>💰</span>
                  </div>
                  <div className={styles.metricValue}>₹48,250</div>
                  <div className={styles.metricSubtext}>Net debit balance receivable</div>
                </div>

                <div className={styles.metricCard}>
                  <div className={styles.metricHeader}>
                    <span>OTP Validation Setting</span>
                    <span className={styles.metricIcon}>🔒</span>
                  </div>
                  <div className={styles.metricValue}>Inactive</div>
                  <div className={styles.metricSubtext}>OTP check is disabled for users</div>
                </div>
              </div>

              <div className={styles.panel}>
                <h3>System Information</h3>
                <div className={styles.systemDetails}>
                  <div className={styles.detailRow}>
                    <span>Database Status</span>
                    <span className={styles.statusOnline}>Online</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span>Supabase Backend Server</span>
                    <span>AP-South-1 (Mumbai Pooler)</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span>Active Session Scope</span>
                    <span>Admin Stored Procedures</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CREATE RECORD */}
          {activeTab === "create" && (
            <div className={styles.tabContent}>
              <h2 className={styles.pageTitle}>Log Ledger Operations</h2>
              <p className={styles.pageSubtitle}>Log client transaction slips or records of credit payments.</p>

              <div className={styles.formSplitGrid}>
                {/* Form A: Log Slip */}
                <div className={styles.panel}>
                  <h3>Create Transaction Slip</h3>
                  <form onSubmit={handleSaveSlip} className={styles.form}>
                    <div className={styles.inputGroup}>
                      <label className={styles.label}>Customer Phone Number*</label>
                      <input type="text" className={styles.input} placeholder="e.g. 9876543210" value={slipPhone} onChange={(e) => setSlipPhone(e.target.value)} />
                    </div>

                    <div className={styles.inputGroupRow}>
                      <div className={styles.inputGroup}>
                        <label className={styles.label}>Customer Name</label>
                        <input type="text" className={styles.input} placeholder="e.g. John Doe" value={slipName} onChange={(e) => setSlipName(e.target.value)} />
                      </div>
                      <div className={styles.inputGroup}>
                        <label className={styles.label}>Address</label>
                        <input type="text" className={styles.input} placeholder="City, State" value={slipAddress} onChange={(e) => setSlipAddress(e.target.value)} />
                      </div>
                    </div>

                    <div className={styles.itemTitleRow}>
                      <span className={styles.label}>Slip Items List</span>
                      <button type="button" className={styles.addItemBtn} onClick={addSlipItemField}>+ Add Item</button>
                    </div>

                    {slipItems.map((itemInput, idx) => (
                      <div key={idx} className={styles.itemInputRow}>
                        <input type="text" className={styles.input} style={{ flex: 2 }} placeholder="Item Name" value={itemInput.item} onChange={(e) => updateSlipItemField(idx, "item", e.target.value)} />
                        <input type="text" className={styles.input} style={{ flex: 1.5 }} placeholder="Remarks" value={itemInput.remarks} onChange={(e) => updateSlipItemField(idx, "remarks", e.target.value)} />
                        <input type="number" className={styles.input} style={{ flex: 1 }} placeholder="Qty" value={itemInput.qty} onChange={(e) => updateSlipItemField(idx, "qty", e.target.value)} />
                        <input type="number" className={styles.input} style={{ flex: 1 }} placeholder="Rate" value={itemInput.rate} onChange={(e) => updateSlipItemField(idx, "rate", e.target.value)} />
                        <button type="button" className={styles.removeItemBtn} onClick={() => removeSlipItemField(idx)}>×</button>
                      </div>
                    ))}

                    <div className={styles.inputGroupRow} style={{ marginTop: "16px", alignItems: "flex-end" }}>
                      <div className={styles.inputGroup}>
                        <label className={styles.label}>Discount (₹)</label>
                        <input type="number" className={styles.input} value={slipDiscount} onChange={(e) => setSlipDiscount(e.target.value)} />
                      </div>
                      <div className={styles.slipSummaryText}>
                        <div>Subtotal: <strong>₹{slipTotalSum}</strong></div>
                        <div>Discount: <strong>₹{parseFloat(slipDiscount) || 0}</strong></div>
                        <div className={styles.netAmountVal}>Net Receivable: <strong>₹{slipNetSum}</strong></div>
                      </div>
                    </div>

                    <button type="submit" className={styles.submitBtn} disabled={savingSlip}>
                      {savingSlip ? "Saving Slip..." : "Publish Stored Slip"}
                    </button>
                  </form>
                </div>

                {/* Form B: Log Payment */}
                <div className={styles.panel} style={{ alignSelf: "flex-start" }}>
                  <h3>Log Cash Payment</h3>
                  <form onSubmit={handleSavePayment} className={styles.form}>
                    <div className={styles.inputGroup}>
                      <label className={styles.label}>Customer Phone Number*</label>
                      <input type="text" className={styles.input} placeholder="e.g. 9876543210" value={payPhone} onChange={(e) => setPayPhone(e.target.value)} />
                    </div>

                    <div className={styles.inputGroup}>
                      <label className={styles.label}>Payment Amount (₹)*</label>
                      <input type="number" className={styles.input} placeholder="e.g. 5000" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
                    </div>

                    <div className={styles.inputGroup}>
                      <label className={styles.label}>Narration / Notes</label>
                      <textarea className={styles.textarea} placeholder="Cash receipt, Bank transfer notes, etc." value={payNarration} onChange={(e) => setPayNarration(e.target.value)} />
                    </div>

                    <button type="submit" className={styles.submitBtn} style={{ background: "var(--accent-green)" }} disabled={savingPayment}>
                      {savingPayment ? "Recording Payment..." : "Record Payment Entry"}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: MANAGE USERS */}
          {activeTab === "users" && (
            <div className="flex flex-col gap-6 animate-[fadeIn_0.4s_ease-out_forwards]">
              <div>
                <h2 className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">Tenant User Profiles</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">List registered operator profiles or create new dashboard sessions.</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-6 items-start">
                {/* Users List */}
                <div className="bg-white/80 dark:bg-[#1c1c1e]/70 border border-white/50 dark:border-white/10 rounded-2xl p-6 shadow-[0_10px_30px_rgba(0,0,0,0.04)] dark:shadow-[0_15px_40px_rgba(0,0,0,0.5)] backdrop-blur-xl">
                  <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-700 pb-3 mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Organization Operators</h3>
                    <div className="flex gap-2">
                      <button 
                        onClick={handleResetAllOtps}
                        disabled={resettingOtp || users.length === 0}
                        className="px-3 py-1.5 text-sm font-medium rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Reset All OTPs
                      </button>
                      <button 
                        onClick={handleResetSelectedOtps}
                        disabled={selectedUsers.length === 0 || resettingOtp}
                        className="px-3 py-1.5 text-sm font-medium rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {resettingOtp ? "Resetting..." : `Reset Selected (${selectedUsers.length})`}
                      </button>
                    </div>
                  </div>
                  
                  {loadingUsers ? (
                    <div className="flex flex-col items-center justify-center p-10 gap-3 text-gray-500">
                      <div className="w-7 h-7 border-4 border-gray-200 dark:border-gray-800 border-t-blue-500 rounded-full animate-spin"></div>
                      <p>Loading operators...</p>
                    </div>
                  ) : (
                    <div className="w-full overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-black/20">
                      <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-gray-50/50 dark:bg-white/5 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider font-medium">
                          <tr>
                            <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 w-10"></th>
                            <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">User ID</th>
                            <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">Role</th>
                            <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">Status</th>
                            <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">OTP</th>
                            <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">Created At</th>
                            <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                          {users.map((user) => {
                            const isAdminUser = user.userid === 'admin';
                            const isSelected = selectedUsers.includes(user.userid);
                            return (
                            <tr 
                              key={user.userid}
                              className={`transition-colors ${isAdminUser ? 'opacity-70 cursor-not-allowed bg-gray-50 dark:bg-white/5' : 'hover:bg-blue-500/5 dark:hover:bg-white/5 cursor-pointer'}`}
                            >
                              <td className="px-4 py-3">
                                <input 
                                  type="checkbox"
                                  disabled={isAdminUser || user.isadmin}
                                  checked={isSelected}
                                  onChange={() => toggleUserSelection(user.userid)}
                                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                                />
                              </td>
                              <td className="px-4 py-3 font-semibold text-gray-900 dark:text-gray-100" onClick={() => !isAdminUser && handleEditUser(user)}>
                                {user.userid} {isAdminUser && <span title="Protected Account" className="ml-1.5">🔒</span>}
                              </td>
                              <td className="px-4 py-3" onClick={() => !isAdminUser && handleEditUser(user)}>
                                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide ${user.isadmin ? 'bg-red-500/10 text-red-600 dark:text-red-400' : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'}`}>
                                  {user.isadmin ? "Admin" : "Operator"}
                                </span>
                              </td>
                              <td className="px-4 py-3" onClick={() => !isAdminUser && handleEditUser(user)}>
                                <span className={`font-medium ${user.isactive ? 'text-green-500' : 'text-gray-500'}`}>
                                  {user.isactive ? "Active" : "Disabled"}
                                </span>
                              </td>
                              <td className="px-4 py-3 font-mono text-gray-700 dark:text-gray-300" onClick={() => !isAdminUser && handleEditUser(user)}>
                                {user.otp ? user.otp : '-'}
                              </td>
                              <td className="px-4 py-3 font-mono text-gray-500 dark:text-gray-400 text-xs" onClick={() => !isAdminUser && handleEditUser(user)}>
                                {new Date(user.created_at).toLocaleDateString()}
                              </td>
                              <td className="px-4 py-3" onClick={() => !isAdminUser && handleEditUser(user)}>
                                {isAdminUser ? (
                                  <span className="text-gray-500 italic text-xs">Locked</span>
                                ) : (
                                  <span className="text-blue-600 dark:text-blue-400 font-medium text-sm">✏️ Edit</span>
                                )}
                              </td>
                            </tr>
                          )})}
                          {users.length === 0 && (
                            <tr>
                              <td colSpan={7} className="text-center py-6 text-gray-500">
                                No registered user accounts found.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Add User Form */}
                <div className="bg-white/80 dark:bg-[#1c1c1e]/70 border border-white/50 dark:border-white/10 rounded-2xl p-6 shadow-[0_10px_30px_rgba(0,0,0,0.04)] dark:shadow-[0_15px_40px_rgba(0,0,0,0.5)] backdrop-blur-xl">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700 pb-3 mb-5">
                    {isEditMode ? "Edit User Account" : "Provision User Account"}
                  </h3>
                  <form onSubmit={handleCreateUser} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide ml-0.5">Username / Operator ID*</label>
                      <input 
                        type="text" 
                        placeholder="e.g. operator1" 
                        value={newUserId} 
                        onChange={(e) => setNewUserId(e.target.value)} 
                        disabled={isEditMode} 
                        className="bg-white/80 dark:bg-black/40 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100 px-3.5 py-3 rounded-xl text-sm outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15 disabled:opacity-60"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide ml-0.5">{isEditMode ? "New Password (Required)*" : "Account Password*"}</label>
                      <input 
                        type="password" 
                        placeholder="••••••••" 
                        value={newUserPassword} 
                        onChange={(e) => setNewUserPassword(e.target.value)} 
                        className="bg-white/80 dark:bg-black/40 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100 px-3.5 py-3 rounded-xl text-sm outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15"
                      />
                    </div>

                    <div className="flex items-center gap-2.5 mt-1">
                      <input 
                        type="checkbox" 
                        id="isAdminCheck" 
                        checked={newUserIsAdmin} 
                        onChange={(e) => setNewUserIsAdmin(e.target.checked)} 
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <label htmlFor="isAdminCheck" className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer select-none">Grant Administrator Access Rights</label>
                    </div>

                    {isEditMode && (
                      <div className="flex items-center gap-2.5">
                        <input 
                          type="checkbox" 
                          id="isActiveCheck" 
                          checked={newUserIsActive} 
                          onChange={(e) => setNewUserIsActive(e.target.checked)} 
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                        <label htmlFor="isActiveCheck" className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer select-none">Account is Active</label>
                      </div>
                    )}

                    <div className="flex gap-3 mt-4">
                      <button 
                        type="submit" 
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-xl shadow-[0_4px_10px_rgba(37,99,235,0.2)] transition-all hover:-translate-y-0.5 active:translate-y-px"
                      >
                        {isEditMode ? "Update Account" : "Register Operator"}
                      </button>
                      {isEditMode && (
                        <button 
                          type="button" 
                          onClick={handleCancelEdit}
                          className="flex-1 bg-gray-200 hover:bg-gray-300 dark:bg-white/10 dark:hover:bg-white/20 text-gray-900 dark:text-white font-medium py-3 px-4 rounded-xl transition-all"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: COMPANY SETTINGS */}
          {activeTab === "settings" && (
            <div className={styles.tabContent}>
              <h2 className={styles.pageTitle}>Company Profiles</h2>
              <p className={styles.pageSubtitle}>Configure organization metadata and validation rules.</p>

              <div className={styles.panel} style={{ maxWidth: "600px" }}>
                <h3>Organization Profile Settings</h3>
                <form onSubmit={handleUpdateCompany} className={styles.form}>
                  <div className={styles.inputGroup}>
                    <label className={styles.label}>Organization Name</label>
                    <input type="text" className={styles.input} value={orgname} onChange={(e) => setOrgname(e.target.value)} />
                  </div>

                  <div className={styles.toggleRow}>
                    <div>
                      <div className={styles.boldCell} style={{ marginBottom: "4px" }}>Enable Login OTP Code Verification</div>
                      <div className={styles.pageSubtitle} style={{ margin: 0 }}>
                        If enabled, standard operator accounts require entering a 4-digit code generated by the administrator.
                      </div>
                    </div>
                    <label className={styles.switch}>
                      <input type="checkbox" checked={enableotp} onChange={(e) => setEnableotp(e.target.checked)} />
                      <span className={styles.slider} />
                    </label>
                  </div>

                  <button type="submit" className={styles.submitBtn} disabled={savingCompany}>
                    {savingCompany ? "Saving Settings..." : "Commit Settings"}
                  </button>
                </form>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
