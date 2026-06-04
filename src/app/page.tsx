"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
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
  const [otp, setOtp] = useState("");
  
  // UI states
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isOtpRequired, setIsOtpRequired] = useState(false);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [shake, setShake] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [toasts, setToasts] = useState<Toast[]>([]);

  const router = useRouter();

  // Automatically check system theme and session on mount
  useEffect(() => {
    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setTheme(isDark ? "dark" : "light");

    const saved = localStorage.getItem("parchi_session");
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.authtoken) {
          if (data.isadmin) {
            router.push("/dashboard/admin");
          } else {
            router.push("/dashboard/user");
          }
        }
      } catch (e) {}
    }
  }, [router]);

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
    if (isOtpRequired && !otp.trim()) {
      addToast("OTP is required", "error");
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
          otp: isOtpRequired ? otp.trim() : undefined,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        if (data.otprequired) {
          setIsOtpRequired(true);
          addToast(data.message || "OTP sent to your registered device", "success");
          setLoading(false);
        } else {
          const sessionObj = {
            authtoken: data.authtoken,
            orgcode: data.orgcode,
            userid: data.userid,
            isadmin: data.isadmin,
          };
          localStorage.setItem("parchi_session", JSON.stringify(sessionObj));
          setUserData(sessionObj);
          // Do not set isLoggedIn(true) to avoid showing the success card
          addToast("Authentication Successful!", "success");

          // Automatically redirect user based on role immediately
          if (data.isadmin) {
            router.push("/dashboard/admin");
          } else {
            router.push("/dashboard/user");
          }
          return; // Return early so setLoading(false) is not called
        }
      } else {
        triggerShake();
        addToast(data.message || "Invalid credentials", "error");
        setLoading(false);
      }
    } catch (err: any) {
      triggerShake();
      addToast(err.message || "Unable to reach authorization server", "error");
      setLoading(false);
    }
  };

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const handleSignOut = () => {
    localStorage.removeItem("parchi_session");
    document.cookie = "authtoken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
    document.cookie = "orgcode=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
    setIsLoggedIn(false);
    setUserData(null);
    setIsOtpRequired(false);
    setPassword("");
    setOtp("");
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
              {isOtpRequired ? (
                /* OTP STEP */
                <div className={styles.otpStep}>
                  <div className={styles.otpIconWrapper}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                  </div>
                  <h2 className={styles.headerTitle} style={{fontSize: '22px'}}>Verification Required</h2>
                  <p className={styles.headerSubtitle} style={{marginBottom: '24px'}}>
                    Please enter the one-time password sent to your device.
                  </p>
                  
                  <form 
                    style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}
                    onSubmit={handleLogin}
                  >
                    <div className={styles.inputWrapper}>
                      <div className={styles.inputIcon}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                        </svg>
                      </div>
                      <input
                        id="otp"
                        type="text"
                        className={styles.inputField}
                        placeholder="Enter 4-digit code"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        disabled={loading}
                        autoComplete="one-time-code"
                        autoFocus
                      />
                    </div>
                    
                    <button type="submit" className={styles.submitBtn} disabled={loading}>
                      {loading ? (
                        <>
                          <div className={styles.spinner} />
                          <span>Verifying...</span>
                        </>
                      ) : (
                        <span>Verify & Login</span>
                      )}
                    </button>
                    
                    <button 
                      type="button" 
                      className={styles.cancelBtn} 
                      onClick={() => {
                        setIsOtpRequired(false);
                        setOtp("");
                      }}
                      disabled={loading}
                    >
                      Cancel
                    </button>
                  </form>
                </div>
              ) : (
                /* LOGIN STEP */
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
                          <span>Authenticating...</span>
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
              )}
            </>
          ) : (
            /* SIGNED IN / SUCCESS STATE */
            <div className={styles.successCard}>
              <div className={styles.checkmarkWrapper}>
                <div className={styles.successCheckmark}>✓</div>
              </div>
              <h2 className={styles.headerTitle}>Login Successful</h2>
              <p className={styles.headerSubtitle}>
                Welcome back, {userData?.userid}! Redirecting to your dashboard...
              </p>
            </div>
          )}
        </div>
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
