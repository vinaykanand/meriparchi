"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";

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
          if (data.issuperadmin) {
            router.push("/dashboard/super-admin");
          } else if (data.isadmin) {
            router.push("/dashboard/admin");
          } else {
            router.push("/dashboard/user");
          }
        }
      } catch (e) {}
    }
  }, [router]);

  // Apply dark class to html based on theme state
  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme]);

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
            issuperadmin: !!data.issuperadmin,
          };
          localStorage.setItem("parchi_session", JSON.stringify(sessionObj));
          setUserData(sessionObj as any);
          addToast("Authentication Successful!", "success");

          if (data.issuperadmin) {
            router.push("/dashboard/super-admin");
          } else if (data.isadmin) {
            router.push("/dashboard/admin");
          } else {
            router.push("/dashboard/user");
          }
          return;
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

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  return (
    <div className="min-h-screen relative overflow-hidden flex flex-col justify-center items-center bg-slate-50 dark:bg-slate-900 transition-colors duration-300 font-sans">
      {/* Background Decorative Blur Blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-500/20 dark:bg-blue-600/20 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-500/20 dark:bg-purple-600/20 blur-[100px] pointer-events-none" />

      {/* Floating Toast Notification Area */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-center p-4 rounded-lg shadow-lg border backdrop-blur-md animate-fade-in-down ${
              toast.type === "success" 
                ? "bg-emerald-50/90 border-emerald-200 text-emerald-800 dark:bg-emerald-900/80 dark:border-emerald-700 dark:text-emerald-100" 
                : "bg-red-50/90 border-red-200 text-red-800 dark:bg-red-900/80 dark:border-red-700 dark:text-red-100"
            }`}
          >
            <div className="mr-3 flex-shrink-0">
              {toast.type === "success" ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="15" y1="9" x2="9" y2="15"></line>
                  <line x1="9" y1="9" x2="15" y2="15"></line>
                </svg>
              )}
            </div>
            <div className="flex-1 text-sm font-medium">{toast.message}</div>
            <button className="ml-3 opacity-70 hover:opacity-100 focus:outline-none" onClick={() => removeToast(toast.id)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        ))}
      </div>

      {/* Header Controls (Theme Switcher) */}
      <div className="absolute top-6 right-6 z-40">
        <button
          className="p-2 rounded-full bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 hover:shadow-md transition-all outline-none focus:ring-2 focus:ring-blue-500"
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
      <div className={`w-full max-w-md p-6 z-10 ${shake ? "animate-shake" : ""}`}>
        <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 p-8 sm:p-10 transition-all">
          
          {/* Logo Area */}
          <div className="flex justify-center mb-8">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="filter drop-shadow-md">
              <rect x="3" y="3" width="18" height="18" rx="5" fill="url(#parchiGrad)" />
              <path d="M7 8H17" stroke="white" strokeWidth="2" strokeLinecap="round" />
              <path d="M7 12H17" stroke="white" strokeWidth="2" strokeLinecap="round" />
              <path d="M7 16H13" stroke="white" strokeWidth="2" strokeLinecap="round" />
              <defs>
                <linearGradient id="parchiGrad" x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#3b82f6" />
                  <stop offset="1" stopColor="#8b5cf6" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          {!isLoggedIn ? (
            <>
              {isOtpRequired ? (
                /* OTP STEP */
                <div className="flex flex-col items-center animate-fade-in">
                  <div className="w-14 h-14 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mb-4">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2 text-center">Verification Required</h2>
                  <p className="text-slate-500 dark:text-slate-400 text-center mb-6 text-sm">
                    Please enter the one-time password sent to your device.
                  </p>
                  
                  <form className="w-full flex flex-col gap-4" onSubmit={handleLogin}>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-500 transition-colors">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                        </svg>
                      </div>
                      <input
                        id="otp"
                        type="text"
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        placeholder="Enter 4-digit code"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        disabled={loading}
                        autoComplete="one-time-code"
                        autoFocus
                      />
                    </div>
                    
                    <button 
                      type="submit" 
                      className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl font-medium shadow-md shadow-blue-500/30 transition-all flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 disabled:opacity-70 disabled:cursor-not-allowed"
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Verifying...</span>
                        </>
                      ) : (
                        <span>Verify & Login</span>
                      )}
                    </button>
                    
                    <button 
                      type="button" 
                      className="w-full py-3 px-4 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:opacity-50"
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
                <div className="animate-fade-in">
                  <div className="text-center mb-8">
                    <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-white tracking-tight mb-2">Sign in with Parchi</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">
                      Enter your organization details and user credentials to access your secure portal.
                    </p>
                  </div>

                  <form className="flex flex-col gap-5" onSubmit={handleLogin}>
                    {/* Org Code Field */}
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="orgcode" className="text-sm font-medium text-slate-700 dark:text-slate-300 ml-1">
                        Organization Code
                      </label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-500 transition-colors">
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
                          className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                          placeholder="e.g. ABC123"
                          value={orgcode}
                          onChange={(e) => setOrgcode(e.target.value)}
                          disabled={loading}
                          autoComplete="organization"
                        />
                      </div>
                    </div>

                    {/* User ID Field */}
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="userid" className="text-sm font-medium text-slate-700 dark:text-slate-300 ml-1">
                        User ID
                      </label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-500 transition-colors">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                            <circle cx="12" cy="7" r="4"></circle>
                          </svg>
                        </div>
                        <input
                          id="userid"
                          type="text"
                          className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                          placeholder="e.g. admin"
                          value={userid}
                          onChange={(e) => setUserid(e.target.value)}
                          disabled={loading}
                          autoComplete="username"
                        />
                      </div>
                    </div>

                    {/* Password Field */}
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="password" className="text-sm font-medium text-slate-700 dark:text-slate-300 ml-1">
                        Password
                      </label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-500 transition-colors">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                          </svg>
                        </div>
                        <input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          className="w-full pl-10 pr-12 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          disabled={loading}
                          autoComplete="current-password"
                        />
                        <button
                          type="button"
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors focus:outline-none"
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
                    <button 
                      type="submit" 
                      className="w-full mt-2 py-3 px-4 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl font-medium shadow-md shadow-blue-500/30 transition-all flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 disabled:opacity-70 disabled:cursor-not-allowed group"
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Authenticating...</span>
                        </>
                      ) : (
                        <>
                          <span>Sign In</span>
                          <svg className="transform group-hover:translate-x-1 transition-transform" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                            <polyline points="12 5 19 12 12 19"></polyline>
                          </svg>
                        </>
                      )}
                    </button>
                  </form>
                </div>
              )}
            </>
          ) : (
            /* SIGNED IN / SUCCESS STATE */
            <div className="flex flex-col items-center py-8 animate-fade-in text-center">
              <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-500 rounded-full flex items-center justify-center mb-6 shadow-inner">
                <svg className="animate-bounce" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Login Successful</h2>
              <p className="text-slate-500 dark:text-slate-400">
                Welcome back, <span className="font-semibold text-slate-700 dark:text-slate-200">{userData?.userid}</span>! Redirecting to your dashboard...
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Footer Branding */}
      <div className="mt-8 text-slate-400 dark:text-slate-500 text-sm z-10 flex flex-col items-center gap-2">
        <p className="font-medium">Parchi Single Sign-On (SSO) Portal</p>
        <div className="flex gap-4 text-xs opacity-80">
          <a href="#help" className="hover:text-blue-500 hover:underline transition-colors">Help & Documentation</a>
          <a href="#privacy" className="hover:text-blue-500 hover:underline transition-colors">Privacy & Legal</a>
          <a href="#status" className="hover:text-blue-500 hover:underline transition-colors">System Status</a>
        </div>
      </div>

      {/* Global CSS for custom animations that Tailwind doesn't have by default */}
      <style jsx global>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
          20%, 40%, 60%, 80% { transform: translateX(5px); }
        }
        .animate-shake {
          animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both;
        }
        @keyframes fade-in {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out forwards;
        }
        @keyframes fade-in-down {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-down {
          animation: fade-in-down 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
