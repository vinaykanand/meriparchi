"use client";

import React, { useState } from "react";
import AuthProvider, { useAuth } from "@/components/providers/AuthProvider";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  BuildingOfficeIcon,
  ClipboardDocumentListIcon,
  CpuChipIcon,
  TagIcon,
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  XMarkIcon
} from "@heroicons/react/24/outline";

function SuperAdminSidebar({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const menuItems = [
    {
      name: "Clients",
      href: "/dashboard/super-admin",
      icon: BuildingOfficeIcon
    },
    {
      name: "Pricing & Coupons",
      href: "/dashboard/super-admin/pricing",
      icon: TagIcon
    },
    {
      name: "Global Audit Logs",
      href: "/dashboard/super-admin/audit-logs",
      icon: ClipboardDocumentListIcon
    },
    {
      name: "Integrations",
      href: "/dashboard/super-admin/integrations",
      icon: CpuChipIcon
    }
  ];

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col md:flex-row font-sans">
      {/* Mobile Top Header */}
      <header className="md:hidden flex items-center justify-between px-6 py-4 bg-slate-950 border-b border-slate-800 sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-tr from-violet-600 to-indigo-600 rounded-lg flex items-center justify-center">
            <span className="font-extrabold text-sm text-white">P</span>
          </div>
          <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
            Parchi SuperAdmin
          </span>
        </div>
        <button onClick={() => setMobileOpen(!mobileOpen)} className="p-1 hover:text-violet-400 transition-colors">
          {mobileOpen ? <XMarkIcon className="w-6 h-6" /> : <Bars3Icon className="w-6 h-6" />}
        </button>
      </header>

      {/* Sidebar - Desktop and Mobile Drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-64 bg-slate-950 border-r border-slate-800 flex flex-col justify-between p-6 transform transition-transform duration-300 md:translate-x-0 md:static md:h-screen ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col gap-8">
          {/* Logo Brand Header */}
          <div className="hidden md:flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-tr from-violet-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-violet-500/20">
              <span className="font-black text-lg text-white">P</span>
            </div>
            <div>
              <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent block">
                Parchi console
              </span>
              <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500 block -mt-1">
                Super Admin Hub
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex flex-col gap-1.5">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all border ${
                    isActive
                      ? "bg-violet-600/10 border-violet-500/30 text-violet-400 shadow-inner"
                      : "bg-transparent border-transparent text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? "text-violet-400" : "text-slate-400"}`} />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom Panel */}
        <div className="flex flex-col gap-4 border-t border-slate-850 pt-4">
          <div className="flex items-center gap-3 px-2">
            <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
              <span className="text-xs font-bold text-slate-300">SA</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-200 truncate">Super Administrator</p>
              <p className="text-[10px] text-slate-500 truncate">system@meriparchi.com</p>
            </div>
          </div>

          <button
            onClick={() => {
              setMobileOpen(false);
              logout();
            }}
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold text-rose-400 hover:bg-rose-950/20 hover:text-rose-300 border border-transparent hover:border-rose-900/30 transition-all text-left"
          >
            <ArrowRightOnRectangleIcon className="w-5 h-5" />
            Logout Session
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 h-screen overflow-y-auto p-6 sm:p-10 bg-slate-900">
        {children}
      </main>
    </div>
  );
}

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider requireSuperAdmin={true}>
      <SuperAdminSidebar>{children}</SuperAdminSidebar>
    </AuthProvider>
  );
}
