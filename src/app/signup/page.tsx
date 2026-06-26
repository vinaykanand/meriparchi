"use client";

import React, { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";

interface Toast {
  id: string;
  message: string;
  type: "success" | "error";
}

export default function SignupPage() {
  const [orgcode, setOrgcode] = useState("");
  const [orgname, setOrgname] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [referralCode, setReferralCode] = useState("");

  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [isAllowed, setIsAllowed] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  const router = useRouter();

  useEffect(() => {
    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setTheme(isDark ? "dark" : "light");

    // Check if public signups are globally enabled
    const checkSignupStatus = async () => {
      try {
        const res = await fetch("/api/signup");
        const data = await res.json();
        if (res.ok && data.success) {
          setIsAllowed(data.allowed);
        } else {
          setIsAllowed(false);
        }
      } catch (e) {
        setIsAllowed(false);
      } finally {
        setChecking(false);
      }
    };
    checkSignupStatus();
  }, []);

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
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const handleSignup = async (e: FormEvent) => {
    e.preventDefault();

    if (!orgcode.trim()) {
      addToast("Organization Code is required", "error");
      return;
    }
    if (!orgname.trim()) {
      addToast("Organization Name is required", "error");
      return;
    }
    if (!adminPassword.trim()) {
      addToast("Admin Password is required", "error");
      return;
    }
    if (adminPassword !== confirmPassword) {
      addToast("Passwords do not match", "error");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgcode: orgcode.trim().toUpperCase(),
          orgname: orgname.trim(),
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          adminPassword: adminPassword.trim(),
          referralCode: referralCode.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        addToast("Account registered successfully! Redirecting to login...", "success");
        setTimeout(() => {
          router.push("/");
        }, 2000);
      } else {
        addToast(data.message || "Registration failed", "error");
        setLoading(false);
      }
    } catch (err: any) {
      addToast(err.message || "Network connection error", "error");
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col justify-center items-center">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-slate-500 dark:text-slate-400 font-medium">Checking registration status...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-y-auto py-12 flex flex-col justify-center items-center bg-slate-50 dark:bg-slate-900 transition-colors duration-300 font-sans">
      {/* Background Blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-500/10 dark:bg-blue-600/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-500/10 dark:bg-purple-600/10 blur-[100px] pointer-events-none" />

      {/* Toast Notification Container */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-center p-4 rounded-xl shadow-2xl border backdrop-blur-md animate-slide-up ${
              toast.type === "success" 
                ? "bg-emerald-950/85 border-emerald-800 text-emerald-100" 
                : "bg-rose-950/85 border-rose-800 text-rose-100"
            }`}
          >
            <div className="flex-1 text-sm font-medium">{toast.message}</div>
            <button className="ml-3 opacity-70 hover:opacity-100 focus:outline-none" onClick={() => setToasts(t => t.filter(x => x.id !== toast.id))}>×</button>
          </div>
        ))}
      </div>

      <div className="w-full max-w-md p-6 z-10">
        <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 p-8 transition-all">
          
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="24" height="24" rx="6" fill="url(#signupGrad)" />
              <path d="M7 8H17" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
              <path d="M7 12H17" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
              <path d="M7 16H13" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
              <defs>
                <linearGradient id="signupGrad" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#3b82f6" />
                  <stop offset="1" stopColor="#8b5cf6" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          {!isAllowed ? (
            /* DISABLED REGISTRATION STATE */
            <div className="text-center py-6 animate-fade-in">
              <div className="w-14 h-14 bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-450 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
              </div>
              <h2 className="text-xl font-extrabold text-slate-805 dark:text-white mb-2">Registration Closed</h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm mb-6 leading-relaxed">
                Public signup is currently disabled by the system administrator. Please contact your organization owner for access credentials.
              </p>
              <button
                onClick={() => router.push("/")}
                className="w-full py-2.5 px-4 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-850 dark:text-slate-200 rounded-xl font-bold text-sm transition-all"
              >
                Back to Login
              </button>
            </div>
          ) : (
            /* ACTIVE SIGNUP FORM */
            <div className="animate-fade-in">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-extrabold text-slate-850 dark:text-white">Register Organization</h2>
                <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
                  Start your 10-day trial plan instantly. No credit card required.
                </p>
              </div>

              <form onSubmit={handleSignup} className="flex flex-col gap-4">
                
                {/* Org Code */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Organization Code</label>
                  <input
                    type="text"
                    placeholder="e.g. MYCORP (letters and numbers only)"
                    required
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold uppercase text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    value={orgcode}
                    onChange={(e) => setOrgcode(e.target.value.toUpperCase())}
                    disabled={loading}
                  />
                </div>

                {/* Org Name */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Organization Name</label>
                  <input
                    type="text"
                    placeholder="e.g. My Company Private Ltd"
                    required
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    value={orgname}
                    onChange={(e) => setOrgname(e.target.value)}
                    disabled={loading}
                  />
                </div>

                {/* Email Address */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Owner Email Address (optional)</label>
                  <input
                    type="email"
                    placeholder="e.g. owner@mycorp.com"
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                  />
                </div>

                {/* Phone Number */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Owner Phone Number (optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. +91 98765 43210"
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    disabled={loading}
                  />
                </div>

                {/* Referral Code */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Referral Code (optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. REF-XXXXXX"
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold uppercase text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    value={referralCode}
                    onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                    disabled={loading}
                  />
                </div>

                {/* Admin Password */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Choose Admin Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      required
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none pr-10"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      disabled={loading}
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? "👁️" : "👁️‍🗨️"}
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Confirm Admin Password</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    required
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={loading}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl text-sm shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Registering...</span>
                    </>
                  ) : (
                    <span>Register Trial Account</span>
                  )}
                </button>
              </form>

              <div className="mt-6 text-center text-xs text-slate-400 dark:text-slate-500">
                Already registered?{" "}
                <button onClick={() => router.push("/")} className="text-blue-500 hover:underline font-bold transition-colors">
                  Sign In
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
