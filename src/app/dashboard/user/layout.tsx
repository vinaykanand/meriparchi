"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import AuthProvider, { useAuth } from "@/components/providers/AuthProvider";
import { 
  DocumentPlusIcon, 
  BanknotesIcon, 
  MagnifyingGlassIcon,
  SunIcon,
  MoonIcon
} from "@heroicons/react/24/outline";

function UserDashboardContent({ children }: { children: React.ReactNode }) {
  const { session, logout } = useAuth();
  const pathname = usePathname();
  const [theme, setTheme] = useState("light");

  useEffect(() => {
    const savedTheme = localStorage.getItem("parchi_theme");
    if (savedTheme) {
      setTheme(savedTheme);
      if (savedTheme === "dark") {
        document.documentElement.classList.add("dark");
      }
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    localStorage.setItem("parchi_theme", newTheme);
    if (newTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  const navLinks = [
    { name: "Create Slip", href: "/dashboard/user/slips", icon: <DocumentPlusIcon className="w-5 h-5" /> },
    { name: "Log Payment", href: "/dashboard/user/payments", icon: <BanknotesIcon className="w-5 h-5" /> },
    { name: "Lookup Ledger", href: "/dashboard/user/lookup", icon: <MagnifyingGlassIcon className="w-5 h-5" /> },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300 font-sans text-slate-900 dark:text-slate-100 overflow-hidden relative flex flex-col">
      {session?.isImpersonation && (
        <div className="w-full bg-amber-500 text-slate-950 font-bold text-center py-2 text-xs uppercase tracking-wider flex items-center justify-center gap-4 relative z-30 shadow-[0_2px_8px_rgba(245,158,11,0.3)]">
          <span>⚠️ Impersonation Mode: Logged in as Super Admin. You have read-only access to slips & payments.</span>
          <button
            onClick={async () => {
              try {
                const res = await fetch("/api/company/super-admin/impersonate", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ targetOrgcode: "SUPER" }),
                });
                if (res.ok) {
                  window.location.href = "/dashboard/super-admin";
                }
              } catch (e) {
                console.error("Failed to exit impersonation", e);
              }
            }}
            className="px-3 py-1 bg-slate-950 hover:bg-slate-900 text-white rounded-lg transition-colors font-extrabold uppercase text-[10px] tracking-wider shadow"
          >
            Exit Impersonation
          </button>
        </div>
      )}
      {/* Top Navbar */}
      <header className="flex justify-between items-center p-4 sm:px-6 lg:px-8 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md relative z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/20 flex items-center justify-center text-white font-bold text-xl">
            P
          </div>
          <span className="font-bold text-lg hidden sm:block">Parchi Operator</span>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm">
            <span className="text-slate-500 dark:text-slate-400">Org Code:</span>
            <span className="font-semibold">{session?.orgcode}</span>
          </div>
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm">
            <span className="text-slate-500 dark:text-slate-400">User:</span>
            <span className="font-semibold">{session?.userid}</span>
          </div>
          <button className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={toggleTheme} aria-label="Toggle Theme">
            {theme === "dark" ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
          </button>
          <button className="px-4 py-1.5 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 border border-transparent hover:border-red-200 dark:hover:border-red-800 transition-colors" onClick={logout}>
            Sign Out
          </button>
        </div>
      </header>

      <div className="flex-1 w-full flex flex-col md:flex-row overflow-hidden relative z-10">
        {/* Sidebar Nav */}
        <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md flex-shrink-0">
          <nav className="flex md:flex-col gap-1 p-4 overflow-x-auto md:overflow-x-visible">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-4 py-2.5 rounded-xl text-base font-semibold transition-colors whitespace-nowrap flex items-center gap-3
                    ${isActive 
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 shadow-sm" 
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"}`}
                >
                  <span className="flex-shrink-0">{link.icon}</span>
                  {link.name}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Content Container */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function UserDashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider requireAdmin={false}>
      <UserDashboardContent>{children}</UserDashboardContent>
    </AuthProvider>
  );
}
