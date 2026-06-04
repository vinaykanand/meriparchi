"use client";

import { useState, useEffect } from "react";
import styles from "./user.module.css";

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

export default function UserDashboard() {
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  // Session state
  const [session, setSession] = useState<{
    orgcode: string;
    userid: string;
    isadmin: boolean;
  } | null>(null);

  // Search state
  const [searchPhone, setSearchPhone] = useState("");
  const [searchedPhone, setSearchedPhone] = useState("");
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [ledgerSummary, setLedgerSummary] = useState<LedgerSummaryRow[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  // Search autocomplete & recent activity states
  const [searchSuggestions, setSearchSuggestions] = useState<{ phone: string; name: string; address: string }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [recentSlips, setRecentSlips] = useState<any[]>([]);
  const [recentPayments, setRecentPayments] = useState<any[]>([]);
  const [recentAccounts, setRecentAccounts] = useState<any[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(false);

  // Modal detail states
  const [detailDate, setDetailDate] = useState<string | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [slipDetails, setSlipDetails] = useState<SlipDetailItem[]>([]);

  // Logger state
  const [slipName, setSlipName] = useState("");
  const [slipAddress, setSlipAddress] = useState("");
  const [slipDiscount, setSlipDiscount] = useState("0");
  const [slipItems, setSlipItems] = useState<SlipItemInput[]>([{ item: "", remarks: "", qty: "1", rate: "0" }]);
  const [savingSlip, setSavingSlip] = useState(false);
  const [paymentMade, setPaymentMade] = useState<string>("0");

  // Global toasts
  const [toasts, setToasts] = useState<Toast[]>([]);

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
    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setTheme(isDark ? "dark" : "light");

    const checkAuth = async () => {
      try {
        const res = await fetch("/api/auth/verify");
        const data = await res.json();
        if (res.ok && data.success) {
          if (data.isadmin) {
            // Redirect admin to admin dashboard
            window.location.href = "/dashboard/admin";
            return;
          }
          const sessionObj = {
            orgcode: data.orgcode,
            userid: data.userid,
            isadmin: data.isadmin,
          };
          localStorage.setItem("parchi_session", JSON.stringify(sessionObj));
          setSession(sessionObj);
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

  // Autocomplete fetch effect
  useEffect(() => {
    if (!session || !searchPhone.trim() || searchPhone.trim().length < 2) {
      setSearchSuggestions([]);
      return;
    }
    const delayDebounce = setTimeout(async () => {
      try {
        const res = await fetch(`/api/ledger?orgcode=${session.orgcode}&search=${searchPhone.trim()}`);
        const data = await res.json();
        if (res.ok && data.success) {
          setSearchSuggestions(data.accounts || []);
        }
      } catch (err) {
        console.error("Error fetching suggestions:", err);
      }
    }, 200);
    return () => clearTimeout(delayDebounce);
  }, [searchPhone, session]);

  const triggerPhoneSearch = async (phoneToSearch: string) => {
    if (!session) return;
    setLoadingLedger(true);
    setHasSearched(true);
    setSearchedPhone(phoneToSearch);

    try {
      const response = await fetch(`/api/ledger?orgcode=${session.orgcode}&phone=${phoneToSearch}`);
      const data = await response.json();
      if (response.ok && data.success) {
        setLedgerSummary(data.summary || []);
      } else {
        addToast(data.message || "Failed to search ledger", "error");
      }
    } catch (err: any) {
      addToast(err.message || "Database connection error", "error");
    } finally {
      setLoadingLedger(false);
    }
  };

  const handleSelectSuggestion = (phone: string, name: string, address: string) => {
    setSearchPhone(phone);
    setSearchedPhone(phone);
    if (name) setSlipName(name);
    if (address) setSlipAddress(address);
    setSearchSuggestions([]);
    setShowSuggestions(false);
    triggerPhoneSearch(phone);
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!session) return;
    if (!searchPhone.trim()) {
      addToast("Please enter a customer phone number", "error");
      return;
    }

    setLoadingLedger(true);
    setHasSearched(true);
    setSearchedPhone(searchPhone.trim());
    setShowSuggestions(false);

    try {
      const response = await fetch(`/api/ledger?orgcode=${session.orgcode}&phone=${searchPhone.trim()}`);
      const data = await response.json();
      if (response.ok && data.success) {
        setLedgerSummary(data.summary || []);
        if (data.customer) {
          if (data.customer.name) setSlipName(data.customer.name);
          if (data.customer.address) setSlipAddress(data.customer.address);
        }
      } else {
        addToast(data.message || "Failed to search ledger", "error");
      }
    } catch (err: any) {
      addToast(err.message || "Database connection error", "error");
    } finally {
      setLoadingLedger(false);
    }
  };

  const loadSlipDetails = async (dateString: string) => {
    if (!session || !searchedPhone) return;
    // Format date string to clean YYYY-MM-DD
    const dateObj = new Date(dateString);
    const formattedDate = dateObj.toISOString().split("T")[0];

    setDetailDate(dateString);
    setLoadingDetails(true);

    try {
      const response = await fetch(
        `/api/ledger?orgcode=${session.orgcode}&phone=${searchedPhone}&date=${formattedDate}`
      );
      const data = await response.json();
      if (response.ok && data.success) {
        setSlipDetails(data.details || []);
      } else {
        addToast(data.message || "Failed to load slip details", "error");
      }
    } catch (err: any) {
      addToast(err.message || "Error reaching server", "error");
    } finally {
      setLoadingDetails(false);
    }
  };

  // Slip logging management
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
    if (!session || !searchedPhone) return;

    const invalidItem = slipItems.some((it) => !it.item.trim());
    if (invalidItem) {
      addToast("Item name is required for all lines", "error");
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
          phone: searchedPhone,
          name: slipName.trim(),
          address: slipAddress.trim(),
          totalamount: total,
          discount: disc,
          items: formattedItems,
        }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        addToast(data.message || "Slip logged successfully", "success");

        if (payAmt > 0) {
          const payResponse = await fetch("/api/ledger", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "payment",
              orgcode: session.orgcode,
              phone: searchedPhone,
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

        setSlipName("");
        setSlipAddress("");
        setSlipDiscount("0");
        setPaymentMade("0");
        setSlipItems([{ item: "", remarks: "", qty: "1", rate: "0" }]);
        // Refresh summary
        handleSearch();
        fetchRecentData(session.orgcode);
      } else {
        addToast(data.message || "Failed to log slip", "error");
      }
    } catch (err: any) {
      addToast(err.message || "Network error", "error");
    } finally {
      setSavingSlip(false);
    }
  };

  // Summary Metrics calculations
  const getAccountMetrics = () => {
    let slipSum = 0;
    let paySum = 0;
    ledgerSummary.forEach((row) => {
      slipSum += parseFloat(row.netamount) || 0;
      paySum += parseFloat(row.paymentmade) || 0;
    });
    const outstanding = Math.max(0, slipSum - paySum);
    return { slipSum, paySum, outstanding };
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

  const { slipSum, paySum, outstanding } = getAccountMetrics();
  const { total: slipTotalSum, net: slipNetSum } = getSlipTotals();

  return (
    <div className={`${styles.container} ${theme === "dark" ? styles.darkMode : ""}`}>
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

      {/* Header */}
      <header className={styles.header}>
        <div className={styles.brand}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className={styles.logoSvg}>
            <rect x="3" y="3" width="18" height="18" rx="5" fill="url(#userGrad)" />
            <path d="M7 8H17" stroke="white" strokeWidth="2" strokeLinecap="round" />
            <path d="M7 12H17" stroke="white" strokeWidth="2" strokeLinecap="round" />
            <path d="M7 16H13" stroke="white" strokeWidth="2" strokeLinecap="round" />
            <defs>
              <linearGradient id="userGrad" x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">
                <stop stopColor="#0071e3" />
                <stop offset="1" stopColor="#34c759" />
              </linearGradient>
            </defs>
          </svg>
          <span className={styles.brandName}>Parchi Portal</span>
          <span className={styles.roleLabel}>Operator</span>
        </div>

        <div className={styles.userInfo}>
          <div className={styles.sessionBadge}>
            <span className={styles.badgeLabel}>Tenant:</span>
            <span className={styles.badgeVal}>{session?.orgcode}</span>
          </div>
          <div className={styles.sessionBadge}>
            <span className={styles.badgeLabel}>User ID:</span>
            <span className={styles.badgeVal}>{session?.userid}</span>
          </div>
          <button className={styles.themeBtn} onClick={toggleTheme}>
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
          <button className={styles.logoutBtn} onClick={handleLogout}>
            Sign Out
          </button>
        </div>
      </header>

      {/* Main content view */}
      <main className={styles.contentFrame}>
        {/* Search Panel */}
        <div className={styles.panel} style={{ marginBottom: "28px" }} onClick={(e) => e.stopPropagation()}>
          <h2 className={styles.panelTitle}>Look Up Ledger Account</h2>
          <form onSubmit={handleSearch} className={styles.searchForm}>
            <div className={styles.inputWrapper}>
              <div className={styles.searchIcon}>🔍</div>
              <input 
                type="text" 
                className={styles.searchInput} 
                placeholder="Enter Client Phone Number, Name, or Address" 
                value={searchPhone} 
                onChange={(e) => {
                  setSearchPhone(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
              />
              {showSuggestions && searchSuggestions.length > 0 && (
                <div className={styles.suggestionsDropdown}>
                  {searchSuggestions.map((item, idx) => (
                    <div 
                      key={idx} 
                      className={styles.suggestionItem}
                      onClick={() => handleSelectSuggestion(item.phone, item.name, item.address)}
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
            <button type="submit" className={styles.searchSubmitBtn} disabled={loadingLedger}>
              {loadingLedger ? "Searching..." : "Retrieve Statement"}
            </button>
          </form>
        </div>

        {/* Recent Transactions & Customer Accounts (Shown when no search is active) */}
        {!hasSearched && (
          <div className="flex flex-col gap-6 mt-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Quick Lookup & Recent Transactions</h2>
            
            {loadingRecent ? (
              <div className={styles.spinnerWrapper}>
                <div className={styles.spinner} />
                <p>Loading recent database entries...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Column 1: Recently Active Customers */}
                <div className={styles.panel}>
                  <h3 className="text-base font-semibold border-b border-gray-200 dark:border-gray-700 pb-2">Recently Active Clients</h3>
                  <div className="flex flex-col gap-2 mt-2 max-h-[400px] overflow-y-auto pr-1">
                    {recentAccounts.map((acc, idx) => (
                      <div 
                        key={idx} 
                        onClick={() => handleSelectSuggestion(acc.phone, acc.name, acc.address)}
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
                <div className={styles.panel + " lg:col-span-2"}>
                  <h3 className="text-base font-semibold border-b border-gray-200 dark:border-gray-700 pb-2">Recently Generated Slips</h3>
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
                              setSearchedPhone(slip.phone);
                              loadSlipDetails(slip.date);
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

                {/* Row 3: Recently Logged Payments */}
                <div className={styles.panel + " lg:col-span-3"}>
                  <h3 className="text-base font-semibold border-b border-gray-200 dark:border-gray-700 pb-2">Recent Credit Payments</h3>
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
                              handleSelectSuggestion(pay.phone.toString(), "", "");
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

        {/* Ledger workspace (Only show if searched) */}
        {hasSearched && (
          <div className={styles.dashboardGrid}>
            
            {/* Left Column: Ledger statement */}
            <div className={styles.leftCol}>
              {loadingLedger ? (
                <div className={styles.spinnerWrapper}>
                  <div className={styles.spinner} />
                  <p>Fetching database ledger...</p>
                </div>
              ) : (
                <div className={styles.tabContent}>
                  
                  {/* Account Metrics Grid */}
                  <div className={styles.metricGrid}>
                    <div className={styles.metricCard}>
                      <div className={styles.metricLabel}>Total Debit Slips</div>
                      <div className={styles.metricValDisplay}>₹{slipSum}</div>
                    </div>
                    <div className={styles.metricCard}>
                      <div className={styles.metricLabel}>Total Payments Logged</div>
                      <div className={styles.metricValDisplay} style={{ color: "var(--accent-green)" }}>₹{paySum}</div>
                    </div>
                    <div className={styles.metricCard} style={{ borderLeft: "4px solid var(--accent-red)" }}>
                      <div className={styles.metricLabel}>Outstanding Receivable</div>
                      <div className={styles.metricValDisplay} style={{ color: "var(--accent-red)" }}>₹{outstanding}</div>
                    </div>
                  </div>

                  {/* Ledger statement list */}
                  <div className={styles.panel}>
                    <div className={styles.panelHeader}>
                      <h3>Account Statement log</h3>
                      <span className={styles.helpText}>Click row to view slip items details</span>
                    </div>

                    <div className={styles.tableWrapper}>
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            <th>Transaction Date</th>
                            <th>Slip Subtotal</th>
                            <th>Discount</th>
                            <th>Net Slip Debit</th>
                            <th>Credit Payment</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ledgerSummary.map((row, idx) => (
                            <tr key={idx} className={styles.clickableRow} onClick={() => loadSlipDetails(row.txn_date)}>
                              <td className={styles.dateCell}>{new Date(row.txn_date).toLocaleDateString()}</td>
                              <td>₹{parseFloat(row.totalamount) || 0}</td>
                              <td style={{ color: "var(--text-secondary)" }}>₹{parseFloat(row.discount) || 0}</td>
                              <td className={styles.boldCell}>₹{parseFloat(row.netamount) || 0}</td>
                              <td className={styles.boldCell} style={{ color: "var(--accent-green)" }}>
                                {parseFloat(row.paymentmade) > 0 ? `₹${parseFloat(row.paymentmade)}` : "—"}
                              </td>
                            </tr>
                          ))}
                          {ledgerSummary.length === 0 && (
                            <tr>
                              <td colSpan={5} style={{ textAlign: "center", padding: "24px", color: "var(--text-secondary)" }}>
                                No ledger transaction records found for this phone number.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Log new slips */}
            <div className={styles.rightCol}>
              <div className={styles.panel}>
                <h3>Record Client Transaction Slip</h3>
                <p className={styles.helpText}>Create new transaction slips for customer phone: <strong>{searchedPhone}</strong></p>
                
                <form onSubmit={handleSaveSlip} className={styles.form}>
                  <div className={styles.inputGroup}>
                    <label className={styles.label}>Customer Name</label>
                    <input type="text" className={styles.input} placeholder="e.g. John Doe" value={slipName} onChange={(e) => setSlipName(e.target.value)} />
                  </div>

                  <div className={styles.inputGroup}>
                    <label className={styles.label}>Customer Address</label>
                    <input type="text" className={styles.input} placeholder="City, State" value={slipAddress} onChange={(e) => setSlipAddress(e.target.value)} />
                  </div>

                  <div className={styles.itemTitleRow}>
                    <span className={styles.label}>Slip Items List</span>
                    <button type="button" className={styles.addItemBtn} onClick={addSlipItemField}>+ Item</button>
                  </div>

                  <div className="mb-4">
                    <div className="w-full overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-black/20">
                      <table className="w-full text-left text-sm min-w-[450px]">
                        <thead className="bg-gray-50/50 dark:bg-white/5 text-gray-500 dark:text-gray-400 text-xs uppercase font-medium">
                          <tr>
                            <th className="px-3 py-2 w-[45%]">Item Name*</th>
                            <th className="px-3 py-2 w-[20%]">Qty</th>
                            <th className="px-3 py-2 w-[25%]">Rate (₹)</th>
                            <th className="px-3 py-2 w-10"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                          {slipItems.map((itemInput, idx) => (
                            <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-white/5">
                              <td className="px-2 py-1.5">
                                <input 
                                  type="text" 
                                  className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-700 rounded bg-transparent text-gray-900 dark:text-gray-100 focus:outline-none" 
                                  placeholder="Item Name" 
                                  value={itemInput.item} 
                                  onChange={(e) => updateSlipItemField(idx, "item", e.target.value)} 
                                  required
                                />
                              </td>
                              <td className="px-2 py-1.5">
                                <input 
                                  type="number" 
                                  min="0"
                                  step="any"
                                  className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-700 rounded bg-transparent text-gray-900 dark:text-gray-100 focus:outline-none" 
                                  placeholder="1" 
                                  value={itemInput.qty} 
                                  onChange={(e) => updateSlipItemField(idx, "qty", e.target.value)} 
                                  required
                                />
                              </td>
                              <td className="px-2 py-1.5">
                                <input 
                                  type="number" 
                                  min="0"
                                  step="any"
                                  className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-700 rounded bg-transparent text-gray-900 dark:text-gray-100 focus:outline-none" 
                                  placeholder="Rate" 
                                  value={itemInput.rate} 
                                  onChange={(e) => updateSlipItemField(idx, "rate", e.target.value)} 
                                  required
                                />
                              </td>
                              <td className="px-2 py-1.5 text-center">
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
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Subtotal:</span>
                        <span className="font-semibold text-gray-900 dark:text-gray-100">₹{slipTotalSum.toFixed(2)}</span>
                      </div>
                      
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500">Discount:</span>
                        <input 
                          type="number" 
                          min="0"
                          step="any"
                          className="w-[100px] px-2 py-1 text-sm border border-gray-300 dark:border-gray-700 rounded bg-transparent text-right text-gray-900 dark:text-gray-100"
                          value={slipDiscount} 
                          onChange={(e) => setSlipDiscount(e.target.value)} 
                        />
                      </div>

                      <div className="flex justify-between text-sm border-t border-dashed border-gray-200 dark:border-gray-700 pt-2 font-semibold">
                        <span>Net Debit:</span>
                        <span className="text-blue-600 dark:text-blue-400 font-bold">₹{slipNetSum.toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-gray-700 rounded-xl p-3 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Prev Balance:</span>
                        <span className="font-semibold text-gray-900 dark:text-gray-100">₹{outstanding.toFixed(2)}</span>
                      </div>

                      <div className={styles.inputGroup}>
                        <label className={styles.label}>Payment Made (₹)</label>
                        <input 
                          type="number" 
                          min="0"
                          step="any"
                          className={styles.input} 
                          placeholder="e.g. 500" 
                          value={paymentMade} 
                          onChange={(e) => setPaymentMade(e.target.value)} 
                        />
                      </div>
                    </div>
                  </div>

                  <button type="submit" className="w-full mt-6 py-2.5 px-4 rounded-xl text-white font-medium bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_4px_12px_rgba(59,130,246,0.2)]" disabled={savingSlip}>
                    {savingSlip ? "Publishing Slip & Payment..." : "Commit Transaction Slip & Payment"}
                  </button>
                </form>
              </div>
            </div>

          </div>
        )}
      </main>

      {/* Slip Details Modal */}
      {detailDate && (
        <div className={styles.modalOverlay} onClick={() => setDetailDate(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h3 className={styles.modalTitle}>Transaction Slip Details</h3>
                <p className={styles.helpText} style={{ margin: 0 }}>Date: {new Date(detailDate).toLocaleDateString()}</p>
              </div>
              <button className={styles.modalCloseBtn} onClick={() => setDetailDate(null)}>×</button>
            </div>

            {loadingDetails ? (
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
                      {slipDetails.map((item, idx) => (
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

                {slipDetails.length > 0 && (
                  <div className={styles.modalSummaryBox}>
                    <div>Gross Total: <strong>₹{slipDetails[0].totalamount}</strong></div>
                    <div>Applied Discount: <strong>₹{slipDetails[0].discount}</strong></div>
                    <div className={styles.modalNetVal}>Net Amount Issued: <strong>₹{slipDetails[0].netamount}</strong></div>
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
