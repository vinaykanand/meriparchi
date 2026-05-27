"use client";

import { useState, useEffect, FormEvent } from "react";
import styles from "./login.module.css";

interface Toast {
  id: string;
  message: string;
  type: "success" | "error";
}

interface UserData {
  authtoken: string;
  orgcode: string;
  userid: string;
  isadmin: boolean;
}

export default function LoginPage() {
  // Form states
  const [orgcode, setOrgcode] = useState("");
  const [userid, setUserid] = useState("");
  const [password, setPassword] = useState("");
  
  // UI states
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [shake, setShake] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [isDevPanelOpen, setIsDevPanelOpen] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Automatically check system theme on mount
  useEffect(() => {
    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setTheme(isDark ? "dark" : "light");
  }, []);

  const addToast = (message: string, type: "success" | "error") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    
    // Auto-remove toast after 4 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleLogin = async (e?: FormEvent) => {
    if (e) e.preventDefault();

    if (!orgcode.trim()) {
      addToast("Organization Code is required", "error");
      triggerShake();
      return;
    }
    if (!userid.trim()) {
      addToast("User ID is required", "error");
      triggerShake();
      return;
    }
    if (!password.trim()) {
      addToast("Password is required", "error");
      triggerShake();
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orgcode: orgcode.trim(),
          userid: userid.trim(),
          password: password.trim(),
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setUserData({
          authtoken: data.authtoken,
          orgcode: data.orgcode,
          userid: data.userid,
          isadmin: data.isadmin,
        });
        setIsLoggedIn(true);
        addToast("Authentication Successful!", "success");
      } else {
        triggerShake();
        addToast(data.message || "Invalid credentials", "error");
      }
    } catch (err: any) {
      triggerShake();
      addToast(err.message || "Unable to reach authorization server", "error");
    } finally {
      setLoading(false);
    }
  };

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const handleQuickFill = (org: string, user: string, pass: string) => {
    setOrgcode(org);
    setUserid(user);
    setPassword(pass);
    addToast("Credentials pre-filled", "success");
  };

  const handleQuickFillAndLogin = async (org: string, user: string, pass: string) => {
    setOrgcode(org);
    setUserid(user);
    setPassword(pass);
    addToast("Logging in with demo credentials...", "success");
    
    // Short delay to let the state update reflect in UI before fetching
    setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch("/api/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            orgcode: org,
            userid: user,
            password: pass,
          }),
        });

        const data = await response.json();

        if (response.ok && data.success) {
          setUserData({
            authtoken: data.authtoken,
            orgcode: data.orgcode,
            userid: data.userid,
            isadmin: data.isadmin,
          });
          setIsLoggedIn(true);
          addToast("Authentication Successful!", "success");
        } else {
          triggerShake();
          addToast(data.message || "Invalid credentials", "error");
        }
      } catch (err: any) {
        triggerShake();
        addToast(err.message || "Unable to reach authorization server", "error");
      } finally {
        setLoading(false);
      }
    }, 100);
  };

  const handleSignOut = () => {
    setIsLoggedIn(false);
    setUserData(null);
    setPassword(""); // Clear password for security
    addToast("Logged out successfully", "success");
  };

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  return (
    <div className={`${styles.container} ${theme === "dark" ? styles.darkMode : ""}`}>
      {/* Background Decorative Blur Blobs */}
      <div className={styles.bgBlurBlob1} />
      <div className={styles.bgBlurBlob2} />

      {/* Floating Toast Notification Area */}
      <div className={styles.toastContainer}>
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`${styles.toast} ${
              toast.type === "success" ? styles.toastSuccess : styles.toastError
            }`}
          >
            <div className={styles.toastIcon}>
              {toast.type === "success" ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="15" y1="9" x2="9" y2="15"></line>
                  <line x1="9" y1="9" x2="15" y2="15"></line>
                </svg>
              )}
            </div>
            <div className={styles.toastMessage}>{toast.message}</div>
            <button className={styles.toastClose} onClick={() => removeToast(toast.id)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        ))}
      </div>

      {/* Header Controls (Theme Switcher) */}
      <div className={styles.headerControls}>
        <button
          className={styles.iconBtn}
          onClick={toggleTheme}
          aria-label="Toggle Theme"
          title={`Switch to ${theme === "dark" ? "Light" : "Dark"} Mode`}
        >
          {theme === "dark" ? (
            // Sun Icon
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5"></circle>
              <line x1="12" y1="1" x2="12" y2="3"></line>
              <line x1="12" y1="21" x2="12" y2="23"></line>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
              <line x1="1" y1="12" x2="3" y2="12"></line>
              <line x1="21" y1="12" x2="23" y2="12"></line>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
            </svg>
          ) : (
            // Moon Icon
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
            </svg>
          )}
        </button>
      </div>

      {/* Authentication Card Wrapper */}
      <div className={styles.cardWrapper}>
        <div className={`${styles.loginCard} ${shake ? styles.shake : ""}`}>
          
          {/* Logo Area */}
          <div className={styles.logoSection}>
            <svg className={styles.parchiLogo} width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Glowing ticket/receipt sheet representing "Parchi" */}
              <rect x="3" y="3" width="18" height="18" rx="5" fill="url(#parchiGrad)" />
              <path d="M7 8H17" stroke="white" strokeWidth="2" strokeLinecap="round" />
              <path d="M7 12H17" stroke="white" strokeWidth="2" strokeLinecap="round" />
              <path d="M7 16H13" stroke="white" strokeWidth="2" strokeLinecap="round" />
              <defs>
                <linearGradient id="parchiGrad" x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#0071e3" />
                  <stop offset="1" stopColor="#5856d6" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          {!isLoggedIn ? (
            /* SIGN IN VIEW */
            <>
              <h2 className={styles.headerTitle}>Sign in with Parchi</h2>
              <p className={styles.headerSubtitle}>
                Enter your organization details and user credentials to access your secure portal.
              </p>

              <form className={styles.form} onSubmit={handleLogin}>
                {/* Org Code Field */}
                <div className={styles.inputGroup}>
                  <label htmlFor="orgcode" className={styles.inputLabel}>
                    Organization Code
                  </label>
                  <div className={styles.inputWrapper}>
                    <div className={styles.inputIcon}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect>
                        <line x1="9" y1="22" x2="9" y2="16"></line>
                        <line x1="15" y1="22" x2="15" y2="16"></line>
                        <line x1="9" y1="16" x2="15" y2="16"></line>
                        <path d="M8 6h.01M16 6h.01M8 10h.01M16 10h.01"></path>
                      </svg>
                    </div>
                    <input
                      id="orgcode"
                      type="text"
                      className={styles.inputField}
                      placeholder="e.g. ABC123"
                      value={orgcode}
                      onChange={(e) => setOrgcode(e.target.value)}
                      disabled={loading}
                      autoComplete="organization"
                    />
                  </div>
                </div>

                {/* User ID Field */}
                <div className={styles.inputGroup}>
                  <label htmlFor="userid" className={styles.inputLabel}>
                    User ID
                  </label>
                  <div className={styles.inputWrapper}>
                    <div className={styles.inputIcon}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                        <circle cx="12" cy="7" r="4"></circle>
                      </svg>
                    </div>
                    <input
                      id="userid"
                      type="text"
                      className={styles.inputField}
                      placeholder="e.g. admin"
                      value={userid}
                      onChange={(e) => setUserid(e.target.value)}
                      disabled={loading}
                      autoComplete="username"
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div className={styles.inputGroup}>
                  <label htmlFor="password" className={styles.inputLabel}>
                    Password
                  </label>
                  <div className={styles.inputWrapper}>
                    <div className={styles.inputIcon}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                      </svg>
                    </div>
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      className={styles.inputField}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loading}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      className={styles.eyeBtn}
                      onClick={() => setShowPassword(!showPassword)}
                      disabled={loading}
                      tabIndex={-1}
                      title={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                          <line x1="1" y1="1" x2="23" y2="23"></line>
                        </svg>
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                          <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {/* Submit button */}
                <button type="submit" className={styles.submitBtn} disabled={loading}>
                  {loading ? (
                    <>
                      <div className={styles.spinner} />
                      <span>Verifying identity...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In</span>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                        <polyline points="12 5 19 12 12 19"></polyline>
                      </svg>
                    </>
                  )}
                </button>
              </form>
            </>
          ) : (
            /* SIGNED IN / SUCCESS STATE */
            <div className={styles.successCard}>
              <div className={styles.checkmarkWrapper}>
                <div className={styles.successCheckmark}>✓</div>
              </div>
              <h2 className={styles.headerTitle}>Login Successful</h2>
              <p className={styles.headerSubtitle}>
                Welcome back, {userData?.userid}! You have successfully authenticated using Parchi Single Sign-On.
              </p>

              <div className={styles.sessionDetails}>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>User ID</span>
                  <span className={styles.detailValue}>{userData?.userid}</span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Organization</span>
                  <span className={styles.detailValue}>{userData?.orgcode}</span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Authorization Role</span>
                  <span className={styles.detailValue}>
                    {userData?.isadmin ? (
                      <span className={`${styles.badge} ${styles.badgeAdmin}`}>Administrator</span>
                    ) : (
                      <span className={styles.badge}>Standard User</span>
                    )}
                  </span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Session Token</span>
                  <span className={styles.detailValue} title={userData?.authtoken}>
                    {userData?.authtoken}
                  </span>
                </div>
              </div>

              <button className={styles.signOutBtn} onClick={handleSignOut}>
                Disconnect Session (Sign Out)
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Interactive Developer / Tester Panel */}
      <div className={`${styles.devPanel} ${!isDevPanelOpen ? styles.closedDevPanel : ""}`}>
        <div 
          className={styles.devPanelHeader} 
          onClick={() => setIsDevPanelOpen(!isDevPanelOpen)}
          title="Toggle developer credentials helpers"
        >
          <div className={styles.devPanelTitle}>
            <span className={styles.devIndicator} />
            <span>Developer Sandbox Panel</span>
          </div>
          <div className={styles.devToggleIcon}>
            {isDevPanelOpen ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="18 15 12 9 6 15"></polyline>
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            )}
          </div>
        </div>

        {isDevPanelOpen && (
          <div className={styles.devPanelContent}>
            <p className={styles.devInfoText}>
              Test credentials discovered in database records. Click to quick-fill or sign in immediately:
            </p>

            <div 
              className={styles.credentialCard}
              onClick={() => handleQuickFill("ABC123", "admin", "admin@123")}
              title="Click to fill form with these details"
            >
              <div className={styles.credRow}>
                <span className={styles.credKey}>Org Code</span>
                <span className={styles.credVal}>ABC123</span>
              </div>
              <div className={styles.credRow}>
                <span className={styles.credKey}>User ID</span>
                <span className={styles.credVal}>admin</span>
              </div>
              <div className={styles.credRow}>
                <span className={styles.credKey}>Password</span>
                <span className={styles.credVal}>admin@123</span>
              </div>
            </div>

            <button 
              className={styles.devActionBtn}
              onClick={() => handleQuickFillAndLogin("ABC123", "admin", "admin@123")}
            >
              🚀 Auto Sign-In With Credentials
            </button>

            <p className={styles.devInfoText} style={{ borderTop: "1px solid var(--card-border)", paddingTop: "10px", marginTop: "4px" }}>
              Test invalid states (triggers high-fidelity error shakes & premium banner notifications):
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              <button 
                className={styles.signOutBtn}
                style={{ fontSize: "11px", padding: "8px" }}
                onClick={() => handleQuickFillAndLogin("WRONG_ORG", "admin", "admin@123")}
              >
                Wrong Org
              </button>
              <button 
                className={styles.signOutBtn}
                style={{ fontSize: "11px", padding: "8px" }}
                onClick={() => handleQuickFillAndLogin("ABC123", "admin", "wrong_pass")}
              >
                Wrong Pass
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer Branding */}
      <div className={styles.footerText}>
        Parchi Single Sign-On (SSO) Portal
      </div>
      <div className={styles.footerLinks}>
        <a href="#help">Help & Documentation</a>
        <a href="#privacy">Privacy & Legal</a>
        <a href="#status">System Status</a>
      </div>
    </div>
  );
}
