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
  const [mounted, setMounted] = useState(false);
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

  // Global toasts
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
    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setTheme(isDark ? "dark" : "light");

    const savedSession = localStorage.getItem("parchi_session");
    if (savedSession) {
      try {
        setSession(JSON.parse(savedSession));
      } catch (e) {
        setSession({ orgcode: "DEMO123", userid: "operator", isadmin: false });
      }
    } else {
      setSession({ orgcode: "DEMO123", userid: "operator", isadmin: false });
    }
  }, []);

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

    try {
      const response = await fetch(`/api/ledger?orgcode=${session.orgcode}&phone=${searchPhone.trim()}`);
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

    setSavingSlip(true);
    const { total } = getSlipTotals();
    const disc = parseFloat(slipDiscount) || 0;

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
        setSlipName("");
        setSlipAddress("");
        setSlipDiscount("0");
        setSlipItems([{ item: "", remarks: "", qty: "1", rate: "0" }]);
        // Refresh summary
        handleSearch();
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
    window.location.href = "/";
  };

  if (!mounted) return null;

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
        <div className={styles.panel} style={{ marginBottom: "28px" }}>
          <h2 className={styles.panelTitle}>Look Up Ledger Account</h2>
          <form onSubmit={handleSearch} className={styles.searchForm}>
            <div className={styles.inputWrapper}>
              <div className={styles.searchIcon}>🔍</div>
              <input type="text" className={styles.searchInput} placeholder="Enter Client Phone Number (e.g. 9876543210)" value={searchPhone} onChange={(e) => setSearchPhone(e.target.value)} />
            </div>
            <button type="submit" className={styles.searchSubmitBtn} disabled={loadingLedger}>
              {loadingLedger ? "Searching..." : "Retrieve Statement"}
            </button>
          </form>
        </div>

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

                  {slipItems.map((itemInput, idx) => (
                    <div key={idx} className={styles.itemInputRow}>
                      <input type="text" className={styles.input} style={{ flex: 1.5 }} placeholder="Item" value={itemInput.item} onChange={(e) => updateSlipItemField(idx, "item", e.target.value)} />
                      <input type="number" className={styles.input} style={{ flex: 0.8 }} placeholder="Qty" value={itemInput.qty} onChange={(e) => updateSlipItemField(idx, "qty", e.target.value)} />
                      <input type="number" className={styles.input} style={{ flex: 0.8 }} placeholder="Rate" value={itemInput.rate} onChange={(e) => updateSlipItemField(idx, "rate", e.target.value)} />
                      <button type="button" className={styles.removeItemBtn} onClick={() => removeSlipItemField(idx)}>×</button>
                    </div>
                  ))}

                  <div className={styles.inputGroup} style={{ marginTop: "12px" }}>
                    <label className={styles.label}>Discount (₹)</label>
                    <input type="number" className={styles.input} value={slipDiscount} onChange={(e) => setSlipDiscount(e.target.value)} />
                  </div>

                  <div className={styles.slipSummaryText}>
                    <div>Subtotal: <strong>₹{slipTotalSum}</strong></div>
                    <div className={styles.netAmountVal}>Total Net Debit: <strong>₹{slipNetSum}</strong></div>
                  </div>

                  <button type="submit" className={styles.submitBtn} disabled={savingSlip}>
                    {savingSlip ? "Publishing Slip..." : "Commit Transaction Slip"}
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
