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

interface LedgerSummaryRow {
  txn_date: string;
  totalamount: string;
  discount: string;
  netamount: string;
  paymentmade: string;
}

interface SlipDetailItem {
  slipno: string;
  slip_date: string;
  item: string;
  remarks: string;
  qty: string;
  rate: string;
  itemamount: string;
  totalamount: string;
  discount: string;
  netamount: string;
}

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [activeTab, setActiveTab] = useState<"overview" | "create" | "lookup" | "users" | "settings">("overview");

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

  // Ledger: Slip & Payment entry state
  const [slipPhone, setSlipPhone] = useState("");
  const [slipName, setSlipName] = useState("");
  const [slipAddress, setSlipAddress] = useState("");
  const [slipDiscount, setSlipDiscount] = useState("0");
  const [slipItems, setSlipItems] = useState<SlipItemInput[]>([{ item: "", remarks: "", qty: "1", rate: "0" }]);
  const [savingSlip, setSavingSlip] = useState(false);
  const [previousBalance, setPreviousBalance] = useState<number>(0);
  const [paymentMade, setPaymentMade] = useState<string>("0");
  const [loadingCustomer, setLoadingCustomer] = useState(false);

  // Ledger lookup tab state
  const [lookupPhone, setLookupPhone] = useState("");
  const [searchedLookupPhone, setSearchedLookupPhone] = useState("");
  const [loadingLookupLedger, setLoadingLookupLedger] = useState(false);
  const [lookupLedgerSummary, setLookupLedgerSummary] = useState<LedgerSummaryRow[]>([]);
  const [hasLookupSearched, setHasLookupSearched] = useState(false);
  const [lookupDetailDate, setLookupDetailDate] = useState<string | null>(null);
  const [loadingLookupDetails, setLoadingLookupDetails] = useState(false);
  const [lookupSlipDetails, setLookupSlipDetails] = useState<SlipDetailItem[]>([]);
  const [closingAccount, setClosingAccount] = useState(false);

  // Global Toast state
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Autocomplete and recent lookup states for admin
  const [searchSuggestions, setSearchSuggestions] = useState<{ phone: string; name: string; address: string }[]>([]);
  const [showSlipSuggestions, setShowSlipSuggestions] = useState(false);
  const [showLookupSuggestions, setShowLookupSuggestions] = useState(false);
  const [recentSlips, setRecentSlips] = useState<any[]>([]);
  const [recentPayments, setRecentPayments] = useState<any[]>([]);
  const [recentAccounts, setRecentAccounts] = useState<any[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(false);

  const addToast = (message: string, type: "success" | "error") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const fetchRecentData = async (orgcode: string) => {
    setLoadingRecent(true);
    try {
      const res = await fetch(`/api/ledger?orgcode=${orgcode}&recent=true`);
      const data = await res.json();
      if (res.ok && data.success) {
        setRecentSlips(data.recentSlips || []);
        setRecentPayments(data.recentPayments || []);
        setRecentAccounts(data.recentAccounts || []);
      }
    } catch (err) {
      console.error("Failed to load recent activity:", err);
    } finally {
      setLoadingRecent(false);
    }
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
          fetchRecentData(sessionObj.orgcode);
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

  // Global click listener to close suggestions
  useEffect(() => {
    const handleGlobalClick = () => {
      setShowSlipSuggestions(false);
      setShowLookupSuggestions(false);
    };
    window.addEventListener("click", handleGlobalClick);
    return () => window.removeEventListener("click", handleGlobalClick);
  }, []);

  // Autocomplete fetch effect for slip phone input
  useEffect(() => {
    if (!session || !slipPhone.trim() || slipPhone.trim().length < 2) {
      setSearchSuggestions([]);
      return;
    }
    const delayDebounce = setTimeout(async () => {
      try {
        const res = await fetch(`/api/ledger?orgcode=${session.orgcode}&search=${slipPhone.trim()}`);
        const data = await res.json();
        if (res.ok && data.success) {
          setSearchSuggestions(data.accounts || []);
        }
      } catch (err) {
        console.error("Error fetching suggestions:", err);
      }
    }, 200);
    return () => clearTimeout(delayDebounce);
  }, [slipPhone, session]);

  // Autocomplete fetch effect for lookup phone input
  useEffect(() => {
    if (!session || !lookupPhone.trim() || lookupPhone.trim().length < 2) {
      setSearchSuggestions([]);
      return;
    }
    const delayDebounce = setTimeout(async () => {
      try {
        const res = await fetch(`/api/ledger?orgcode=${session.orgcode}&search=${lookupPhone.trim()}`);
        const data = await res.json();
        if (res.ok && data.success) {
          setSearchSuggestions(data.accounts || []);
        }
      } catch (err) {
        console.error("Error fetching suggestions:", err);
      }
    }, 200);
    return () => clearTimeout(delayDebounce);
  }, [lookupPhone, session]);

  const handleSelectSlipSuggestion = (phone: string, name: string, address: string) => {
    setSlipPhone(phone);
    if (name) setSlipName(name);
    if (address) setSlipAddress(address);
    setSearchSuggestions([]);
    setShowSlipSuggestions(false);
  };

  const handleSelectLookupSuggestion = (phone: string, name: string, address: string) => {
    setLookupPhone(phone);
    setSearchedLookupPhone(phone);
    setSearchSuggestions([]);
    setShowLookupSuggestions(false);
    triggerLookupPhoneSearch(phone);
  };

  const triggerLookupPhoneSearch = async (phoneToSearch: string) => {
    if (!session) return;
    setLoadingLookupLedger(true);
    setHasLookupSearched(true);
    setSearchedLookupPhone(phoneToSearch);

    try {
      const response = await fetch(`/api/ledger?orgcode=${session.orgcode}&phone=${phoneToSearch}`);
      const data = await response.json();
      if (response.ok && data.success) {
        setLookupLedgerSummary(data.summary || []);
      } else {
        addToast(data.message || "Failed to search ledger", "error");
      }
    } catch (err: any) {
      addToast(err.message || "Database connection error", "error");
    } finally {
      setLoadingLookupLedger(false);
    }
  };

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

  const fetchCustomerDetails = async (phone: string) => {
    if (!session || !phone.trim() || phone.trim().length < 5) return;
    setLoadingCustomer(true);
    try {
      const response = await fetch(`/api/ledger?orgcode=${session.orgcode}&phone=${phone.trim()}`);
      const data = await response.json();
      if (response.ok && data.success) {
        let slipSum = 0;
        let paySum = 0;
        if (data.summary) {
          data.summary.forEach((row: any) => {
            slipSum += parseFloat(row.netamount) || 0;
            paySum += parseFloat(row.paymentmade) || 0;
          });
        }
        setPreviousBalance(Math.max(0, slipSum - paySum));

        if (data.customer) {
          if (data.customer.name) setSlipName(data.customer.name);
          if (data.customer.address) setSlipAddress(data.customer.address);
        }
      } else {
        setPreviousBalance(0);
      }
    } catch (err) {
      console.error("Error fetching customer details:", err);
    } finally {
      setLoadingCustomer(false);
    }
  };

  useEffect(() => {
    if (slipPhone.trim().length === 10) {
      fetchCustomerDetails(slipPhone.trim());
    } else {
      setPreviousBalance(0);
    }
  }, [slipPhone]);

  const handleSaveSlipAndPayment = async (e: React.FormEvent) => {
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

    const hasNegativeQtyOrRate = slipItems.some(
      (it) => (parseFloat(it.qty) || 0) < 0 || (parseFloat(it.rate) || 0) < 0
    );
    if (hasNegativeQtyOrRate) {
      addToast("Quantity and Rate must be non-negative", "error");
      return;
    }

    const { total, net } = getSlipTotals();
    const disc = parseFloat(slipDiscount) || 0;
    if (disc < 0) {
      addToast("Discount must be non-negative", "error");
      return;
    }
    if (disc > total) {
      addToast("Discount cannot be more than Total amount", "error");
      return;
    }

    const payAmt = parseFloat(paymentMade) || 0;
    if (payAmt < 0) {
      addToast("Payment amount must be non-negative", "error");
      return;
    }

    setSavingSlip(true);

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

        if (payAmt > 0) {
          const payResponse = await fetch("/api/ledger", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "payment",
              orgcode: session.orgcode,
              phone: slipPhone.trim(),
              amount: payAmt,
              narration: `Payment made with Slip No ${data.slipno || ""}`.trim(),
            }),
          });
          const payData = await payResponse.json();
          if (payResponse.ok && payData.success) {
            addToast(payData.message || "Payment logged successfully", "success");
          } else {
            addToast(payData.message || "Slip created, but failed to log payment", "error");
          }
        }

        // Clear states
        setSlipPhone("");
        setSlipName("");
        setSlipAddress("");
        setSlipDiscount("0");
        setPaymentMade("0");
        setPreviousBalance(0);
        setSlipItems([{ item: "", remarks: "", qty: "1", rate: "0" }]);
        fetchRecentData(session.orgcode);
      } else {
        addToast(data.message || "Failed to save slip", "error");
      }
    } catch (err: any) {
      addToast(err.message || "Network error", "error");
    } finally {
      setSavingSlip(false);
    }
  };

  const handleLookupSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!session) return;
    if (!lookupPhone.trim()) {
      addToast("Please enter a customer phone number", "error");
      return;
    }

    setLoadingLookupLedger(true);
    setHasLookupSearched(true);
    setSearchedLookupPhone(lookupPhone.trim());

    try {
      const response = await fetch(`/api/ledger?orgcode=${session.orgcode}&phone=${lookupPhone.trim()}`);
      const data = await response.json();
      if (response.ok && data.success) {
        setLookupLedgerSummary(data.summary || []);
      } else {
        addToast(data.message || "Failed to search ledger", "error");
      }
    } catch (err: any) {
      addToast(err.message || "Database connection error", "error");
    } finally {
      setLoadingLookupLedger(false);
    }
  };

  const loadLookupSlipDetails = async (dateString: string) => {
    if (!session || !searchedLookupPhone) return;
    const dateObj = new Date(dateString);
    const formattedDate = dateObj.toISOString().split("T")[0];

    setLookupDetailDate(dateString);
    setLoadingLookupDetails(true);

    try {
      const response = await fetch(
        `/api/ledger?orgcode=${session.orgcode}&phone=${searchedLookupPhone}&date=${formattedDate}`
      );
      const data = await response.json();
      if (response.ok && data.success) {
        setLookupSlipDetails(data.details || []);
      } else {
        addToast(data.message || "Failed to load slip details", "error");
      }
    } catch (err: any) {
      addToast(err.message || "Error reaching server", "error");
    } finally {
      setLoadingLookupDetails(false);
    }
  };

  const handleCloseAccount = async () => {
    if (!session || !searchedLookupPhone) return;
    if (
      !confirm(
        "Are you absolutely sure you want to CLOSE this customer account?\n\nThis will PERMANENTLY delete all transaction slips, invoice items, and payment history for this phone number. This action cannot be undone."
      )
    ) {
      return;
    }

    setClosingAccount(true);
    try {
      const response = await fetch(
        `/api/ledger?orgcode=${session.orgcode}&phone=${searchedLookupPhone}`,
        {
          method: "DELETE",
        }
      );
      const data = await response.json();
      if (response.ok && data.success) {
        addToast(
          `Account closed successfully! Deleted ${data.deleted_slips} slips and ${data.deleted_payments} payments.`,
          "success"
        );
        // Clear lookup states
        setLookupPhone("");
        setSearchedLookupPhone("");
        setLookupLedgerSummary([]);
        setHasLookupSearched(false);
        fetchRecentData(session.orgcode);
      } else {
        addToast(data.message || "Failed to close account", "error");
      }
    } catch (err: any) {
      addToast(err.message || "Server communication error", "error");
    } finally {
      setClosingAccount(false);
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
              Slip & Payment Management
            </button>
            <button className={`${styles.navItem} ${activeTab === "lookup" ? styles.navActive : ""}`} onClick={() => setActiveTab("lookup")}>
              Ledger Statements
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

          {/* TAB 2: SLIP & PAYMENT MANAGEMENT */}
          {activeTab === "create" && (
            <div className={styles.tabContent}>
              <h2 className={styles.pageTitle}>Slip & Payment Management</h2>
              <p className={styles.pageSubtitle}>Log client transaction slips and record cash payments in a single transaction.</p>

              <div className={styles.panel}>
                <form onSubmit={handleSaveSlipAndPayment} className={styles.form}>
                  {/* Customer Info Card */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className={styles.inputGroup} onClick={(e) => e.stopPropagation()}>
                      <label className={styles.label}>Customer Phone Number*</label>
                      <div className="flex gap-2 relative">
                        <input 
                          type="text" 
                          className={styles.input} 
                          style={{ flex: 1 }}
                          placeholder="Phone, name, or address" 
                          value={slipPhone} 
                          onChange={(e) => {
                            setSlipPhone(e.target.value);
                            setShowSlipSuggestions(true);
                          }}
                          onFocus={() => setShowSlipSuggestions(true)}
                        />
                        <button
                          type="button"
                          onClick={() => fetchCustomerDetails(slipPhone)}
                          disabled={loadingCustomer}
                          className="px-3 py-2 text-xs font-medium rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 transition-colors"
                        >
                          {loadingCustomer ? "..." : "Lookup"}
                        </button>
                        {showSlipSuggestions && searchSuggestions.length > 0 && (
                          <div className={styles.suggestionsDropdown} style={{ top: "100%", left: 0, right: 0 }}>
                            {searchSuggestions.map((item, idx) => (
                              <div 
                                key={idx} 
                                className={styles.suggestionItem}
                                onClick={() => handleSelectSlipSuggestion(item.phone, item.name, item.address)}
                              >
                                <div className={styles.suggestionName}>{item.name || "Unnamed Customer"}</div>
                                <div className={styles.suggestionMeta}>
                                  <span>📞 {item.phone}</span>
                                  {item.address && <span style={{ marginLeft: "8px" }}>📍 {item.address}</span>}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className={styles.inputGroup}>
                      <label className={styles.label}>Customer Name</label>
                      <input 
                        type="text" 
                        className={styles.input} 
                        placeholder="e.g. John Doe" 
                        value={slipName} 
                        onChange={(e) => setSlipName(e.target.value)} 
                      />
                    </div>

                    <div className={styles.inputGroup}>
                      <label className={styles.label}>Customer Address</label>
                      <input 
                        type="text" 
                        className={styles.input} 
                        placeholder="City, State" 
                        value={slipAddress} 
                        onChange={(e) => setSlipAddress(e.target.value)} 
                      />
                    </div>
                  </div>

                  {/* Items List Table */}
                  <div className="mb-6">
                    <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-700 pb-2 mb-3">
                      <span className="font-semibold text-gray-900 dark:text-gray-100">Slip Items List</span>
                      <button 
                        type="button" 
                        className="px-3 py-1.5 text-xs font-semibold rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 transition-colors"
                        onClick={addSlipItemField}
                      >
                        + Add Item
                      </button>
                    </div>

                    <div className="w-full overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-black/20">
                      <table className="w-full text-left text-sm min-w-[600px]">
                        <thead className="bg-gray-50/50 dark:bg-white/5 text-gray-500 dark:text-gray-400 text-xs uppercase font-medium">
                          <tr>
                            <th className="px-4 py-2 w-[35%]">Item Name*</th>
                            <th className="px-4 py-2 w-[25%]">Remark</th>
                            <th className="px-4 py-2 w-[15%]">Qty</th>
                            <th className="px-4 py-2 w-[15%]">Rate (₹)</th>
                            <th className="px-4 py-2 w-[10%]">Amount (₹)</th>
                            <th className="px-4 py-2 w-10"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                          {slipItems.map((itemInput, idx) => {
                            const qty = parseFloat(itemInput.qty) || 0;
                            const rate = parseFloat(itemInput.rate) || 0;
                            const amount = qty * rate;
                            return (
                              <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-white/5">
                                <td className="px-3 py-2">
                                  <input 
                                    type="text" 
                                    className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-700 rounded bg-transparent text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500" 
                                    placeholder="e.g. Paint" 
                                    value={itemInput.item} 
                                    onChange={(e) => updateSlipItemField(idx, "item", e.target.value)} 
                                    required
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <input 
                                    type="text" 
                                    className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-700 rounded bg-transparent text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500" 
                                    placeholder="Remarks" 
                                    value={itemInput.remarks} 
                                    onChange={(e) => updateSlipItemField(idx, "remarks", e.target.value)} 
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <input 
                                    type="number" 
                                    min="0"
                                    step="any"
                                    className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-700 rounded bg-transparent text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500" 
                                    placeholder="1" 
                                    value={itemInput.qty} 
                                    onChange={(e) => updateSlipItemField(idx, "qty", e.target.value)} 
                                    required
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <input 
                                    type="number" 
                                    min="0"
                                    step="any"
                                    className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-700 rounded bg-transparent text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500" 
                                    placeholder="0" 
                                    value={itemInput.rate} 
                                    onChange={(e) => updateSlipItemField(idx, "rate", e.target.value)} 
                                    required
                                  />
                                </td>
                                <td className="px-4 py-2 font-mono font-semibold text-gray-700 dark:text-gray-300">
                                  ₹{amount.toFixed(2)}
                                </td>
                                <td className="px-3 py-2 text-center">
                                  <button 
                                    type="button" 
                                    disabled={slipItems.length === 1}
                                    className="text-red-500 hover:text-red-700 font-bold text-lg disabled:opacity-30" 
                                    onClick={() => removeSlipItemField(idx)}
                                  >
                                    ×
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Calculations & Payment made panel */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start border-t border-gray-200 dark:border-gray-700 pt-6">
                    <div className="space-y-4">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500 dark:text-gray-400">Total Amount (A)</span>
                        <span className="font-semibold text-gray-900 dark:text-gray-100">₹{slipTotalSum.toFixed(2)}</span>
                      </div>
                      
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500 dark:text-gray-400">Discount (B)</span>
                        <div className="w-[120px]">
                          <input 
                            type="number" 
                            min="0"
                            step="any"
                            className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-700 rounded bg-transparent text-gray-900 dark:text-gray-100 text-right focus:outline-none focus:ring-1 focus:ring-blue-500" 
                            value={slipDiscount} 
                            onChange={(e) => setSlipDiscount(e.target.value)} 
                          />
                        </div>
                      </div>

                      <div className="flex justify-between items-center border-t border-dashed border-gray-200 dark:border-gray-700 pt-3">
                        <span className="font-semibold text-gray-900 dark:text-gray-100">Net Receivable (C = A - B)</span>
                        <span className="text-lg font-bold text-blue-600 dark:text-blue-400">₹{slipNetSum.toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-gray-700/50 rounded-xl p-4 space-y-4">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500 dark:text-gray-400">Previous Outstanding Balance</span>
                        <span className="font-semibold text-gray-900 dark:text-gray-100">₹{previousBalance.toFixed(2)}</span>
                      </div>

                      <div className={styles.inputGroup}>
                        <label className={styles.label}>Payment Made (₹)</label>
                        <input 
                          type="number" 
                          min="0"
                          step="any"
                          className={styles.input} 
                          placeholder="Amount received (e.g. 500)" 
                          value={paymentMade} 
                          onChange={(e) => setPaymentMade(e.target.value)} 
                        />
                      </div>
                    </div>
                  </div>

                  <button 
                    type="submit" 
                    className="w-full mt-6 py-3 px-4 rounded-xl text-white font-medium bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_4px_15px_rgba(59,130,246,0.3)] hover:shadow-[0_6px_20px_rgba(59,130,246,0.4)]"
                    disabled={savingSlip}
                  >
                    {savingSlip ? "Processing..." : "Commit Transaction Slip & Payment"}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* TAB 5: LEDGER STATEMENTS LOOKUP */}
          {activeTab === "lookup" && (
            <div className={styles.tabContent}>
              <h2 className={styles.pageTitle}>Look Up Ledger Account</h2>
              <p className={styles.pageSubtitle}>Retrieve customer account statements, view invoice lists, and manage accounts.</p>

              {/* Search Panel */}
              <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
                <form onSubmit={handleLookupSearch} className="flex gap-3">
                  <div className="relative flex-grow flex items-center">
                    <span className="absolute left-4 text-gray-400">🔍</span>
                    <input 
                      type="text" 
                      className="w-full pl-10 pr-4 py-3 text-sm border border-gray-300 dark:border-gray-700 rounded-xl bg-white/80 dark:bg-black/40 text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-blue-500" 
                      placeholder="Enter Client Phone Number, Name, or Address" 
                      value={lookupPhone} 
                      onChange={(e) => {
                        setLookupPhone(e.target.value);
                        setShowLookupSuggestions(true);
                      }}
                      onFocus={() => setShowLookupSuggestions(true)}
                    />
                    {showLookupSuggestions && searchSuggestions.length > 0 && (
                      <div className={styles.suggestionsDropdown} style={{ top: "100%", left: 0, right: 0 }}>
                        {searchSuggestions.map((item, idx) => (
                          <div 
                            key={idx} 
                            className={styles.suggestionItem}
                            onClick={() => handleSelectLookupSuggestion(item.phone, item.name, item.address)}
                          >
                            <div className={styles.suggestionName}>{item.name || "Unnamed Customer"}</div>
                            <div className={styles.suggestionMeta}>
                              <span>📞 {item.phone}</span>
                              {item.address && <span style={{ marginLeft: "8px" }}>📍 {item.address}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <button 
                    type="submit" 
                    className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 rounded-xl shadow-[0_4px_10px_rgba(37,99,235,0.2)] disabled:opacity-50"
                    disabled={loadingLookupLedger}
                  >
                    {loadingLookupLedger ? "Searching..." : "Retrieve Statement"}
                  </button>
                </form>
              </div>

              {/* Recent activity when no search is performed yet */}
              {!hasLookupSearched && (
                <div className="flex flex-col gap-6 mt-6 animate-[fadeIn_0.4s_ease-out_forwards]">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Quick Lookup & Recent Transactions</h3>
                  {loadingRecent ? (
                    <div className="flex flex-col items-center justify-center p-12 gap-3 text-gray-500">
                      <div className="w-8 h-8 border-4 border-gray-200 dark:border-gray-800 border-t-blue-500 rounded-full animate-spin"></div>
                      <p>Loading recent activity...</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      
                      {/* Column 1: Recently Active Clients */}
                      <div className="bg-white/80 dark:bg-[#1c1c1e]/70 border border-white/50 dark:border-white/10 rounded-2xl p-5 shadow-[0_10px_30px_rgba(0,0,0,0.04)] dark:shadow-[0_15px_40px_rgba(0,0,0,0.5)]">
                        <h4 className="text-sm font-semibold border-b border-gray-200 dark:border-gray-700 pb-2">Recently Active Clients</h4>
                        <div className="flex flex-col gap-2 mt-2 max-h-[400px] overflow-y-auto pr-1">
                          {recentAccounts.map((acc, idx) => (
                            <div 
                              key={idx} 
                              onClick={() => handleSelectLookupSuggestion(acc.phone, acc.name, acc.address)}
                              className="p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-black/20 hover:bg-blue-500/5 dark:hover:bg-white/5 cursor-pointer transition-all flex flex-col gap-1"
                            >
                              <div className="font-semibold text-sm text-gray-900 dark:text-gray-100">{acc.name || "Unnamed Client"}</div>
                              <div className="text-xs text-gray-500 flex justify-between">
                                <span>📞 {acc.phone}</span>
                                <span>{acc.address ? `📍 ${acc.address}` : ""}</span>
                              </div>
                            </div>
                          ))}
                          {recentAccounts.length === 0 && (
                            <div className="text-center py-6 text-xs text-gray-500">No active accounts found.</div>
                          )}
                        </div>
                      </div>

                      {/* Column 2: Recently Generated Slips */}
                      <div className="bg-white/80 dark:bg-[#1c1c1e]/70 border border-white/50 dark:border-white/10 rounded-2xl p-5 shadow-[0_10px_30px_rgba(0,0,0,0.04)] dark:shadow-[0_15px_40px_rgba(0,0,0,0.5)] lg:col-span-2">
                        <h4 className="text-sm font-semibold border-b border-gray-200 dark:border-gray-700 pb-2">Recently Generated Slips</h4>
                        <div className="w-full overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-black/20 mt-3">
                          <table className="w-full text-left text-sm min-w-[500px]">
                            <thead className="bg-gray-50/50 dark:bg-white/5 text-gray-500 dark:text-gray-400 text-xs uppercase font-medium">
                              <tr>
                                <th className="px-3 py-2">Slip No</th>
                                <th className="px-3 py-2">Date</th>
                                <th className="px-3 py-2">Client</th>
                                <th className="px-3 py-2">Phone</th>
                                <th className="px-3 py-2">Subtotal</th>
                                <th className="px-3 py-2">Net Amt</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                              {recentSlips.map((slip, idx) => (
                                <tr 
                                  key={idx} 
                                  onClick={() => {
                                    setSearchedLookupPhone(slip.phone);
                                    loadLookupSlipDetails(slip.date);
                                  }}
                                  className="hover:bg-blue-500/5 dark:hover:bg-white/5 cursor-pointer transition-colors"
                                >
                                  <td className="px-3 py-2 font-semibold">#{slip.slipno}</td>
                                  <td className="px-3 py-2 text-xs text-gray-500">{new Date(slip.date).toLocaleDateString()}</td>
                                  <td className="px-3 py-2">{slip.name || "—"}</td>
                                  <td className="px-3 py-2 text-xs font-mono">{slip.phone}</td>
                                  <td className="px-3 py-2 text-gray-500">₹{slip.totalamount}</td>
                                  <td className="px-3 py-2 font-semibold text-blue-600 dark:text-blue-400">₹{slip.netamount}</td>
                                </tr>
                              ))}
                              {recentSlips.length === 0 && (
                                <tr>
                                  <td colSpan={6} className="text-center py-8 text-xs text-gray-500">No transaction slips logged yet.</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Column 3: Recently Logged Payments */}
                      <div className="bg-white/80 dark:bg-[#1c1c1e]/70 border border-white/50 dark:border-white/10 rounded-2xl p-5 shadow-[0_10px_30px_rgba(0,0,0,0.04)] dark:shadow-[0_15px_40px_rgba(0,0,0,0.5)] lg:col-span-3">
                        <h4 className="text-sm font-semibold border-b border-gray-200 dark:border-gray-700 pb-2">Recent Credit Payments</h4>
                        <div className="w-full overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-black/20 mt-3">
                          <table className="w-full text-left text-sm min-w-[500px]">
                            <thead className="bg-gray-50/50 dark:bg-white/5 text-gray-500 dark:text-gray-400 text-xs uppercase font-medium">
                              <tr>
                                <th className="px-3 py-2">Txn Date</th>
                                <th className="px-3 py-2">Customer Phone</th>
                                <th className="px-3 py-2">Payment Amount</th>
                                <th className="px-3 py-2">Narration</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                              {recentPayments.map((pay, idx) => (
                                <tr 
                                  key={idx}
                                  onClick={() => {
                                    handleSelectLookupSuggestion(pay.phone.toString(), "", "");
                                  }}
                                  className="hover:bg-blue-500/5 dark:hover:bg-white/5 cursor-pointer transition-colors"
                                >
                                  <td className="px-3 py-2 text-xs text-gray-500">{new Date(pay.date).toLocaleDateString()}</td>
                                  <td className="px-3 py-2 font-mono text-xs">{pay.phone}</td>
                                  <td className="px-3 py-2 font-semibold text-green-600 dark:text-green-400">₹{pay.amount}</td>
                                  <td className="px-3 py-2 text-xs text-gray-500">{pay.narration || "—"}</td>
                                </tr>
                              ))}
                              {recentPayments.length === 0 && (
                                <tr>
                                  <td colSpan={4} className="text-center py-6 text-xs text-gray-500">No payment logs found.</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                    </div>
                  )}
                </div>
              )}

              {/* Statement details view */}
              {hasLookupSearched && (
                <div className="flex flex-col gap-6 animate-[fadeIn_0.4s_ease-out_forwards]">
                  {loadingLookupLedger ? (
                    <div className="flex flex-col items-center justify-center p-12 gap-3 text-gray-500">
                      <div className="w-8 h-8 border-4 border-gray-200 dark:border-gray-800 border-t-blue-500 rounded-full animate-spin"></div>
                      <p>Fetching statement data...</p>
                    </div>
                  ) : (
                    <>
                      {/* Account Metrics Grid */}
                      {(() => {
                        let slipSum = 0;
                        let paySum = 0;
                        lookupLedgerSummary.forEach((row) => {
                          slipSum += parseFloat(row.netamount) || 0;
                          paySum += parseFloat(row.paymentmade) || 0;
                        });
                        const outstanding = Math.max(0, slipSum - paySum);
                        return (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-white/80 dark:bg-[#1c1c1e]/70 border border-white/50 dark:border-white/10 rounded-2xl p-5 shadow-[0_10px_30px_rgba(0,0,0,0.04)] dark:shadow-[0_15px_40px_rgba(0,0,0,0.5)]">
                              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Total Debit Slips</div>
                              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">₹{slipSum.toFixed(2)}</div>
                            </div>
                            <div className="bg-white/80 dark:bg-[#1c1c1e]/70 border border-white/50 dark:border-white/10 rounded-2xl p-5 shadow-[0_10px_30px_rgba(0,0,0,0.04)] dark:shadow-[0_15px_40px_rgba(0,0,0,0.5)]">
                              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Total Payments Logged</div>
                              <div className="text-2xl font-bold text-green-600 dark:text-green-400">₹{paySum.toFixed(2)}</div>
                            </div>
                            <div className="bg-white/80 dark:bg-[#1c1c1e]/70 border border-white/50 dark:border-white/10 rounded-2xl p-5 shadow-[0_10px_30px_rgba(0,0,0,0.04)] dark:shadow-[0_15px_40px_rgba(0,0,0,0.5)] border-l-4 border-l-red-500">
                              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Outstanding Receivable</div>
                              <div className="text-2xl font-bold text-red-600 dark:text-red-400">₹{outstanding.toFixed(2)}</div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Statement log table */}
                      <div className="bg-white/80 dark:bg-[#1c1c1e]/70 border border-white/50 dark:border-white/10 rounded-2xl p-6 shadow-[0_10px_30px_rgba(0,0,0,0.04)] dark:shadow-[0_15px_40px_rgba(0,0,0,0.5)]">
                        <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-700 pb-3 mb-4">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Account Statement Log</h3>
                          <span className="text-xs text-gray-500">Click a row to view item details</span>
                        </div>

                        <div className="w-full overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-black/20">
                          <table className="w-full text-left text-sm whitespace-nowrap">
                            <thead className="bg-gray-50/50 dark:bg-white/5 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider font-medium">
                              <tr>
                                <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">Transaction Date</th>
                                <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">Slip Subtotal</th>
                                <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">Discount</th>
                                <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">Net Slip Debit</th>
                                <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">Credit Payment</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                              {lookupLedgerSummary.map((row, idx) => (
                                <tr 
                                  key={idx} 
                                  onClick={() => loadLookupSlipDetails(row.txn_date)}
                                  className="hover:bg-blue-500/5 dark:hover:bg-white/5 cursor-pointer transition-colors"
                                >
                                  <td className="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-400">
                                    {new Date(row.txn_date).toLocaleDateString()}
                                  </td>
                                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                                    ₹{parseFloat(row.totalamount) || 0}
                                  </td>
                                  <td className="px-4 py-3 text-gray-500 dark:text-gray-500">
                                    ₹{parseFloat(row.discount) || 0}
                                  </td>
                                  <td className="px-4 py-3 font-semibold text-gray-900 dark:text-gray-100">
                                    ₹{parseFloat(row.netamount) || 0}
                                  </td>
                                  <td className="px-4 py-3 font-semibold text-green-600 dark:text-green-400">
                                    {parseFloat(row.paymentmade) > 0 ? `₹${parseFloat(row.paymentmade)}` : "—"}
                                  </td>
                                </tr>
                              ))}
                              {lookupLedgerSummary.length === 0 && (
                                <tr>
                                  <td colSpan={5} className="text-center py-8 text-gray-500">
                                    No ledger transaction records found for this phone number.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Danger Zone: Close Account */}
                      <div className="bg-red-500/5 border border-red-500/20 dark:border-red-500/10 rounded-2xl p-6 shadow-[0_10px_30px_rgba(239,68,68,0.02)]">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                          <div>
                            <h4 className="text-base font-semibold text-red-600 dark:text-red-400">Danger Zone: Close Ledger Account</h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-[500px]">
                              Closing this account will permanently delete all transaction history, slips, and payments associated with this phone number. This action is irreversible.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={handleCloseAccount}
                            disabled={closingAccount}
                            className="px-4 py-2.5 text-sm font-semibold rounded-xl text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 shadow-[0_4px_12px_rgba(220,38,38,0.2)] transition-all"
                          >
                            {closingAccount ? "Closing Account..." : "Close Account"}
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
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

      {/* Slip Details Modal */}
      {lookupDetailDate && (
        <div className={styles.modalOverlay} onClick={() => setLookupDetailDate(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h3 className={styles.modalTitle}>Transaction Slip Details</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Date: {new Date(lookupDetailDate).toLocaleDateString()}</p>
              </div>
              <button className={styles.modalCloseBtn} onClick={() => setLookupDetailDate(null)}>×</button>
            </div>

            {loadingLookupDetails ? (
              <div className={styles.spinnerWrapper}>
                <div className={styles.spinner} />
                <p>Loading items details...</p>
              </div>
            ) : (
              <div className={styles.modalBody}>
                <div className={styles.tableWrapper}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Item Name</th>
                        <th>Remarks</th>
                        <th>Qty</th>
                        <th>Rate</th>
                        <th>Total (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lookupSlipDetails.map((item, idx) => (
                        <tr key={idx}>
                          <td className={styles.boldCell}>{item.item}</td>
                          <td style={{ color: "var(--text-secondary)" }}>{item.remarks || "—"}</td>
                          <td>{item.qty}</td>
                          <td>₹{item.rate}</td>
                          <td className={styles.boldCell}>₹{item.itemamount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {lookupSlipDetails.length > 0 && (
                  <div className={styles.modalSummaryBox}>
                    <div>Gross Total: <strong>₹{lookupSlipDetails[0].totalamount}</strong></div>
                    <div>Applied Discount: <strong>₹{lookupSlipDetails[0].discount}</strong></div>
                    <div className={styles.modalNetVal}>Net Amount Issued: <strong>₹{lookupSlipDetails[0].netamount}</strong></div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
