"use client";

import { useState, useEffect } from "react";
import styles from "./admin.module.css";

interface User {
  userid: string;
  isadmin: boolean;
  isactive: boolean;
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
  const [mounted, setMounted] = useState(false);
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
    setMounted(true);
    // Determine theme
    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setTheme(isDark ? "dark" : "light");

    // Load session
    const savedSession = localStorage.getItem("parchi_session");
    if (savedSession) {
      try {
        const data = JSON.parse(savedSession);
        setSession(data);
        setOrgname(data.orgcode + " Enterprise");
      } catch (e) {
        setSession({ orgcode: "DEMO123", userid: "admin", isadmin: true });
        setOrgname("DEMO123 Enterprise");
      }
    } else {
      setSession({ orgcode: "DEMO123", userid: "admin", isadmin: true });
      setOrgname("DEMO123 Enterprise");
    }
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
          isactive: true,
        }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        addToast(data.message || "User created successfully", "success");
        setNewUserId("");
        setNewUserPassword("");
        setNewUserIsAdmin(false);
        fetchUsers();
      } else {
        addToast(data.message || "Failed to create user", "error");
      }
    } catch (err: any) {
      addToast(err.message || "Network error", "error");
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
    window.location.href = "/";
  };

  if (!mounted) return null;

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
            <div className={styles.tabContent}>
              <h2 className={styles.pageTitle}>Tenant User Profiles</h2>
              <p className={styles.pageSubtitle}>List registered operator profiles or create new dashboard sessions.</p>

              <div className={styles.formSplitGrid}>
                {/* Users List */}
                <div className={styles.panel}>
                  <h3>Organization Operators</h3>
                  {loadingUsers ? (
                    <div className={styles.spinnerWrapper}>
                      <div className={styles.spinner} />
                      <p>Loading operators...</p>
                    </div>
                  ) : (
                    <div className={styles.tableWrapper}>
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            <th>User ID</th>
                            <th>Role</th>
                            <th>Status</th>
                            <th>Created At</th>
                          </tr>
                        </thead>
                        <tbody>
                          {users.map((user) => (
                            <tr key={user.userid}>
                              <td className={styles.boldCell}>{user.userid}</td>
                              <td>
                                <span className={`${styles.badge} ${user.isadmin ? styles.badgeAdmin : styles.badgeUser}`}>
                                  {user.isadmin ? "Admin" : "Operator"}
                                </span>
                              </td>
                              <td>
                                <span className={user.isactive ? styles.statusActive : styles.statusInactive}>
                                  {user.isactive ? "Active" : "Disabled"}
                                </span>
                              </td>
                              <td className={styles.dateCell}>{new Date(user.created_at).toLocaleDateString()}</td>
                            </tr>
                          ))}
                          {users.length === 0 && (
                            <tr>
                              <td colSpan={4} style={{ textAlign: "center", padding: "24px", color: "var(--text-secondary)" }}>
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
                <div className={styles.panel} style={{ alignSelf: "flex-start" }}>
                  <h3>Provision User Account</h3>
                  <form onSubmit={handleCreateUser} className={styles.form}>
                    <div className={styles.inputGroup}>
                      <label className={styles.label}>Username / Operator ID*</label>
                      <input type="text" className={styles.input} placeholder="e.g. operator1" value={newUserId} onChange={(e) => setNewUserId(e.target.value)} />
                    </div>

                    <div className={styles.inputGroup}>
                      <label className={styles.label}>Account Password*</label>
                      <input type="password" className={styles.input} placeholder="••••••••" value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} />
                    </div>

                    <div className={styles.checkboxGroup}>
                      <input type="checkbox" id="isAdminCheck" checked={newUserIsAdmin} onChange={(e) => setNewUserIsAdmin(e.target.checked)} />
                      <label htmlFor="isAdminCheck" className={styles.label} style={{ cursor: "pointer" }}>Grant Administrator Access Rights</label>
                    </div>

                    <button type="submit" className={styles.submitBtn}>
                      Register Operator
                    </button>
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
