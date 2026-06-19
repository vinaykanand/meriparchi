"use client";

import React, { useState } from "react";
import Image from "next/image";

// Helper components for blurred/safe screenshots
interface BlurredScreenshotProps {
  src: string;
  alt: string;
  caption: string;
  blurOverlays?: {
    left: string;
    top: string;
    width: string;
    height: string;
    rounded?: string;
  }[];
}

function BlurredScreenshot({ src, alt, caption, blurOverlays = [] }: BlurredScreenshotProps) {
  return (
    <div className="my-6 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50 dark:bg-slate-900/50 p-2 shadow-sm">
      {/* Mock Browser Top bar */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-850">
        <div className="w-3 h-3 rounded-full bg-red-400"></div>
        <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
        <div className="w-3 h-3 rounded-full bg-green-400"></div>
        <div className="ml-4 flex-1 max-w-md h-5 rounded bg-white dark:bg-slate-800 text-[10px] text-slate-400 dark:text-slate-500 flex items-center px-3 border border-slate-150 dark:border-slate-700/50 truncate font-mono">
          http://localhost:3000/dashboard/admin
        </div>
      </div>
      
      {/* Image Container with relative positioning for blur layers */}
      <div className="relative w-full aspect-[4/3] sm:aspect-[16/10] bg-slate-200 dark:bg-slate-800">
        <img
          src={src}
          alt={alt}
          className="w-full h-full object-cover"
        />
        {/* Blur layers */}
        {blurOverlays.map((layer, idx) => (
          <div
            key={idx}
            className={`absolute backdrop-blur-[6px] bg-slate-100/30 dark:bg-slate-900/30 border border-slate-200/20 shadow-inner select-none ${layer.rounded || "rounded"}`}
            style={{
              left: layer.left,
              top: layer.top,
              width: layer.width,
              height: layer.height,
            }}
          />
        ))}
      </div>
      <div className="p-3 text-center text-xs text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-medium">
        {caption}
      </div>
    </div>
  );
}

export default function HelpManualPage() {
  const [activeTab, setActiveTab] = useState("getting-started");
  const [searchQuery, setSearchQuery] = useState("");

  const sections = [
    { id: "getting-started", name: "🚀 Getting Started" },
    { id: "dashboard", name: "🏠 Overview Dashboard" },
    { id: "slips", name: "📋 Create Slip" },
    { id: "payments", name: "💳 Log Payment" },
    { id: "lookup", name: "🔍 Lookup Ledger" },
    { id: "reports", name: "📊 Reports & Aging" },
    { id: "users", name: "👥 Manage Users" },
    { id: "settings", name: "⚙️ Settings & Audit" },
    { id: "shortcuts", name: "⌨️ Keyboard Shortcuts" },
    { id: "faq", name: "❓ FAQ & Help" },
  ];

  const filteredSections = sections.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
      <div className="max-w-6xl mx-auto flex flex-col gap-6">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
              MeriParchi User Manual
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Complete administrator guide and documentation for organization code: <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-blue-600 dark:text-blue-400 font-mono font-bold">ABC123</code>
            </p>
          </div>
          
          {/* Search bar */}
          <div className="relative w-full md:w-64">
            <input
              type="text"
              placeholder="Search help topics..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-850 dark:text-slate-150 transition-all shadow-sm"
            />
            <span className="absolute left-3 top-2.5 text-slate-400">🔍</span>
          </div>
        </div>

        {/* Layout Container */}
        <div className="flex flex-col lg:flex-row gap-8 items-start">
          
          {/* Section Navigation / Table of Contents (Sidebar) */}
          <aside className="w-full lg:w-64 flex-shrink-0 bg-white dark:bg-slate-800/50 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sticky top-4 shadow-sm flex flex-col gap-1.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-3 mb-2">
              Documentation Chapters
            </h3>
            {filteredSections.map((sec) => (
              <button
                key={sec.id}
                onClick={() => setActiveTab(sec.id)}
                className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-between
                  ${activeTab === sec.id
                    ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50"}`}
              >
                <span>{sec.name}</span>
                {activeTab === sec.id && <span className="text-blue-600 dark:text-blue-400">➔</span>}
              </button>
            ))}
          </aside>

          {/* Documentation Content Area */}
          <main className="flex-1 bg-white dark:bg-slate-800/30 border border-slate-200 dark:border-slate-800/80 rounded-3xl p-6 sm:p-8 shadow-sm">
            
            {/* 1. GETTING STARTED */}
            {activeTab === "getting-started" && (
              <article className="prose prose-slate dark:prose-invert max-w-none flex flex-col gap-6">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    🚀 Getting Started — Login & Navigation
                  </h2>
                  <p className="text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                    Welcome to the MeriParchi Administrator guide. Follow these instructions to login and navigate the control center securely.
                  </p>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-150 dark:border-slate-800">
                  <h3 className="text-sm font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-2">
                    Key Credentials Note
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Always use the unique Organization Code assigned to your company. Throughout this manual, the code is <strong className="text-blue-600 dark:text-blue-400">ABC123</strong>.
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-250 mt-4">1. Accessing the Login Screen</h3>
                  <p className="text-slate-600 dark:text-slate-400">
                    Type your deployment URL in your web browser. You will be greeted with the secure login portal:
                  </p>
                  
                  {/* Screenshot overlay to blur phone numbers (none on login screen but keeping style consistent) */}
                  <BlurredScreenshot
                    src="/help/login.png"
                    alt="Login Screen"
                    caption="Figure 1: Parchi Secure Login Screen using Org Code ABC123"
                  />

                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-250 mt-4">2. Step-by-Step Login Procedure</h3>
                  <ol className="list-decimal list-inside text-slate-600 dark:text-slate-400 flex flex-col gap-2 mt-2">
                    <li>Enter <strong className="font-mono">ABC123</strong> in the **Organization Code** input field.</li>
                    <li>Enter your assigned username (e.g. <strong className="font-mono">admin</strong>).</li>
                    <li>Input your account password securely.</li>
                    <li>Click the **Sign In** button.</li>
                  </ol>
                </div>
              </article>
            )}

            {/* 2. OVERVIEW DASHBOARD */}
            {activeTab === "dashboard" && (
              <article className="prose prose-slate dark:prose-invert max-w-none flex flex-col gap-6">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    🏠 Overview Dashboard
                  </h2>
                  <p className="text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                    The Admin Dashboard is the central command center, offering real-time financial stats, recent transactions, and debtor details.
                  </p>
                </div>

                <BlurredScreenshot
                  src="/help/dashboard.png"
                  alt="Administrator Dashboard"
                  caption="Figure 2: Real-time financial insights panel on the Dashboard"
                  blurOverlays={[
                    // Blur phone numbers in Top Debtors card (bottom-left)
                    { left: "18.5%", top: "72.8%", width: "12%", height: "2.5%" },
                    { left: "18.5%", top: "79.5%", width: "12%", height: "2.5%" },
                    { left: "18.5%", top: "84.5%", width: "12%", height: "2.5%" },
                    { left: "18.5%", top: "90.0%", width: "12%", height: "2.5%" },
                  ]}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                  <div className="p-5 border border-slate-250/50 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900">
                    <h4 className="font-bold text-slate-950 dark:text-slate-150 mb-2">📊 Metric Summary Cards</h4>
                    <ul className="list-disc list-inside text-sm text-slate-600 dark:text-slate-400 flex flex-col gap-1.5">
                      <li><strong>Total Outstanding:</strong> Sum of all outstanding bills across customers.</li>
                      <li><strong>Today's Revenue:</strong> Value of new slips made today.</li>
                      <li><strong>Today's Payments:</strong> Total cash/UPI payments captured today.</li>
                      <li><strong>Today's Returns:</strong> Returned items credited to ledger today.</li>
                    </ul>
                  </div>

                  <div className="p-5 border border-slate-250/50 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900">
                    <h4 className="font-bold text-slate-950 dark:text-slate-150 mb-2">📈 Financial Trend Chart</h4>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      The line graph plots payments, revenue, and returns over the last 7 days. Use this visualization to monitor daily revenue velocity and customer collection health.
                    </p>
                  </div>
                </div>
              </article>
            )}

            {/* 3. CREATE SLIP */}
            {activeTab === "slips" && (
              <article className="prose prose-slate dark:prose-invert max-w-none flex flex-col gap-6">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    📋 Create Slip (Billing)
                  </h2>
                  <p className="text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                    Create new purchase slips for customers, add inventory items, rates, and calculate total values.
                  </p>
                </div>

                <BlurredScreenshot
                  src="/help/slips.png"
                  alt="Create Slip Screen"
                  caption="Figure 3: Generating customer bills and adding inventory items"
                  blurOverlays={[
                    // Blur Customer Phone input if filled
                    { left: "21.5%", top: "27.0%", width: "18%", height: "4.5%" }
                  ]}
                />

                <div className="flex flex-col gap-4">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-200">How to create a bill:</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl">
                      <div className="text-blue-500 font-bold mb-1">01</div>
                      <h4 className="font-semibold text-sm mb-1 text-slate-900 dark:text-slate-200">Customer Info</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Type phone number. Name & address auto-fill if they exist, else type new details.</p>
                    </div>
                    <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl">
                      <div className="text-blue-500 font-bold mb-1">02</div>
                      <h4 className="font-semibold text-sm mb-1 text-slate-900 dark:text-slate-200">Add Items</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Type product name, quantity, and unit rate. Click "+ Add Item" to append lines.</p>
                    </div>
                    <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl">
                      <div className="text-blue-500 font-bold mb-1">03</div>
                      <h4 className="font-semibold text-sm mb-1 text-slate-900 dark:text-slate-200">Save Slip</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Review the auto-calculated total. Click Save Slip to push to database ledger.</p>
                    </div>
                  </div>
                </div>
              </article>
            )}

            {/* 4. LOG PAYMENT */}
            {activeTab === "payments" && (
              <article className="prose prose-slate dark:prose-invert max-w-none flex flex-col gap-6">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    💳 Log Payment
                  </h2>
                  <p className="text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                    Record payment receipts to reduce customer outstanding balances in real time.
                  </p>
                </div>

                <div className="p-5 border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900/50 flex flex-col gap-4">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Step-by-Step Payment Recording</h3>
                  <div className="space-y-4">
                    <div className="flex gap-4 items-start">
                      <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">1</div>
                      <div>
                        <p className="font-semibold text-slate-800 dark:text-slate-250">Search Customer Phone</p>
                        <p className="text-sm text-slate-500">Go to "Log Payment" and search the customer's phone. Their name and current outstanding balance will appear instantly.</p>
                      </div>
                    </div>

                    <div className="flex gap-4 items-start">
                      <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">2</div>
                      <div>
                        <p className="font-semibold text-slate-800 dark:text-slate-250">Input Amount & Select Mode</p>
                        <p className="text-sm text-slate-500">Enter the amount received and select the transaction channel: Cash, UPI / Online, or Cheque.</p>
                      </div>
                    </div>

                    <div className="flex gap-4 items-start">
                      <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">3</div>
                      <div>
                        <p className="font-semibold text-slate-800 dark:text-slate-250">Save Ledger Credit</p>
                        <p className="text-sm text-slate-500">Add any reference remarks (like transaction ID) and click Save Payment. The ledger will reduce immediately.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            )}

            {/* 5. LOOKUP LEDGER */}
            {activeTab === "lookup" && (
              <article className="prose prose-slate dark:prose-invert max-w-none flex flex-col gap-6">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    🔍 Lookup Ledger (Customer Statement)
                  </h2>
                  <p className="text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                    Retrieve complete statement history for a customer. Search past slips, payment records, returns, and track audit lines.
                  </p>
                </div>

                <BlurredScreenshot
                  src="/help/lookup.png"
                  alt="Lookup Ledger Statement View"
                  caption="Figure 4: Full Statement Ledger retrieved by searching customer account"
                  blurOverlays={[
                    // Phone blur in recent lookups list (top cards)
                    { left: "19.5%", top: "35.5%", width: "15%", height: "2.8%" },
                    { left: "19.5%", top: "79.0%", width: "15%", height: "2.8%" },
                    // Phone blur in suggestion table
                    { left: "37.5%", top: "40.0%", width: "15%", height: "3.5%" },
                  ]}
                />

                <div className="bg-slate-50 dark:bg-slate-900 p-5 rounded-2xl border border-slate-150 dark:border-slate-800">
                  <h4 className="font-bold text-slate-950 dark:text-slate-150 mb-2">🔍 Instant Suggestion Tool</h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    As you type a name or phone number into the search bar, the ledger queries matches. Selecting from the suggestion dropdown populates the screen with three segmented tabs: Slips, Payments, and Returns.
                  </p>
                </div>
              </article>
            )}

            {/* 6. REPORTS & AGING */}
            {activeTab === "reports" && (
              <article className="prose prose-slate dark:prose-invert max-w-none flex flex-col gap-6">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    📊 Reports, Financial Insights & Debt Aging
                  </h2>
                  <p className="text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                    Analyze your organization's outstanding credit health. Segment outstanding balances using standard FIFO debt aging buckets.
                  </p>
                </div>

                <BlurredScreenshot
                  src="/help/reports.png"
                  alt="Reports and Debt Aging Dashboard"
                  caption="Figure 5: Financial insights dashboard showing debt aging analysis buckets"
                  blurOverlays={[
                    // Blur phone numbers in reports table
                    { left: "26.5%", top: "32.0%", width: "11%", height: "3.5%" },
                    { left: "26.5%", top: "39.5%", width: "11%", height: "3.5%" },
                    { left: "26.5%", top: "47.0%", width: "11%", height: "3.5%" },
                  ]}
                />

                <div className="p-5 border border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50 dark:bg-slate-900/50">
                  <h4 className="font-bold text-slate-900 dark:text-slate-200 mb-2">⏳ Understanding Aging Buckets</h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                    The aging system groups customer balances by duration to indicate cash-flow risk:
                  </p>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs font-semibold">
                    <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-xl text-green-700 dark:text-green-400">
                      <p className="font-bold">0–30 Days</p>
                      <p className="text-[10px] opacity-80 font-normal">Recent billing cycle. Low risk.</p>
                    </div>
                    <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-yellow-700 dark:text-yellow-400">
                      <p className="font-bold">30–60 Days</p>
                      <p className="text-[10px] opacity-80 font-normal">Slightly overdue. Action: Remind.</p>
                    </div>
                    <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-xl text-orange-700 dark:text-orange-400">
                      <p className="font-bold">60–90 Days</p>
                      <p className="text-[10px] opacity-80 font-normal">Overdue. Action: Active followup.</p>
                    </div>
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-700 dark:text-red-400">
                      <p className="font-bold">90+ Days</p>
                      <p className="text-[10px] opacity-80 font-normal">High risk. Action: Formal notice.</p>
                    </div>
                  </div>
                </div>
              </article>
            )}

            {/* 7. MANAGE USERS */}
            {activeTab === "users" && (
              <article className="prose prose-slate dark:prose-invert max-w-none flex flex-col gap-6">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    👥 Manage Users
                  </h2>
                  <p className="text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                    Administrators can provision and deactivate accounts for staff members and set operational roles.
                  </p>
                </div>

                <BlurredScreenshot
                  src="/help/users.png"
                  alt="Manage Users screen"
                  caption="Figure 6: User provision list showing operational staff accounts"
                />

                <div className="bg-slate-50 dark:bg-slate-900/50 p-5 rounded-2xl border border-slate-150 dark:border-slate-800">
                  <h4 className="font-bold text-slate-900 dark:text-slate-200 mb-2">Roles and Access Matrix</h4>
                  <table className="w-full text-sm text-slate-600 dark:text-slate-400">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800">
                        <th className="py-2 text-left">Module / Feature</th>
                        <th className="py-2 text-center">Admin</th>
                        <th className="py-2 text-center">Staff</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-slate-100 dark:border-slate-800/50">
                        <td className="py-2 text-left">Create Slips & Payments</td>
                        <td className="py-2 text-center">✅ Full</td>
                        <td className="py-2 text-center">✅ Full</td>
                      </tr>
                      <tr className="border-b border-slate-100 dark:border-slate-800/50">
                        <td className="py-2 text-left">Lookup Ledger</td>
                        <td className="py-2 text-center">✅ Full</td>
                        <td className="py-2 text-center">✅ Full</td>
                      </tr>
                      <tr className="border-b border-slate-100 dark:border-slate-800/50">
                        <td className="py-2 text-left">Financial Reports</td>
                        <td className="py-2 text-center">✅ Full</td>
                        <td className="py-2 text-center">❌ Blocked</td>
                      </tr>
                      <tr>
                        <td className="py-2 text-left">Security Settings & Users</td>
                        <td className="py-2 text-center">✅ Full</td>
                        <td className="py-2 text-center">❌ Blocked</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </article>
            )}

            {/* 8. SETTINGS & AUDIT */}
            {activeTab === "settings" && (
              <article className="prose prose-slate dark:prose-invert max-w-none flex flex-col gap-6">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    ⚙️ Settings & Security Audit Logs
                  </h2>
                  <p className="text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                    Set up your business identity details, toggle security log features, and audit user logins or transactions.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-200">Organization Settings</h3>
                    <BlurredScreenshot
                      src="/help/settings.png"
                      alt="Settings configuration screen"
                      caption="Figure 7: Adjusting business configuration parameters"
                    />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-200">Audit Action Trail</h3>
                    <BlurredScreenshot
                      src="/help/audit.png"
                      alt="Audit activity log stream"
                      caption="Figure 8: Activity logs monitor showing system changes and login events"
                    />
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900/50 p-5 rounded-2xl border border-slate-150 dark:border-slate-800">
                  <h4 className="font-bold text-slate-900 dark:text-slate-200 mb-2">🔒 Failed Login Auditing Feature</h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    The portal tracks every failed sign-in attempt. In the event of a failure, the audit log records the exact username input string (e.g. <code>Unknown</code>) along with the source IP address. Use this to audit unauthorized attempts.
                  </p>
                </div>
              </article>
            )}

            {/* 9. KEYBOARD SHORTCUTS */}
            {activeTab === "shortcuts" && (
              <article className="prose prose-slate dark:prose-invert max-w-none flex flex-col gap-6">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    ⌨️ Keyboard Shortcuts
                  </h2>
                  <p className="text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                    Boost your speed using built-in system hotkeys to switch views instantly:
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex justify-between items-center p-3 border border-slate-200 dark:border-slate-850 rounded-xl bg-white dark:bg-slate-900">
                    <span className="text-slate-700 dark:text-slate-300 font-medium">Go to Dashboard</span>
                    <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-350 dark:border-slate-700 rounded text-xs font-mono font-bold shadow-sm">Alt + D</kbd>
                  </div>
                  <div className="flex justify-between items-center p-3 border border-slate-200 dark:border-slate-850 rounded-xl bg-white dark:bg-slate-900">
                    <span className="text-slate-700 dark:text-slate-300 font-medium">Create Billing Slip</span>
                    <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-350 dark:border-slate-700 rounded text-xs font-mono font-bold shadow-sm">Alt + S</kbd>
                  </div>
                  <div className="flex justify-between items-center p-3 border border-slate-200 dark:border-slate-850 rounded-xl bg-white dark:bg-slate-900">
                    <span className="text-slate-700 dark:text-slate-300 font-medium">Log Payment Receipt</span>
                    <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-350 dark:border-slate-700 rounded text-xs font-mono font-bold shadow-sm">Alt + P</kbd>
                  </div>
                  <div className="flex justify-between items-center p-3 border border-slate-200 dark:border-slate-850 rounded-xl bg-white dark:bg-slate-900">
                    <span className="text-slate-700 dark:text-slate-300 font-medium">Lookup Customer Ledger</span>
                    <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-350 dark:border-slate-700 rounded text-xs font-mono font-bold shadow-sm">Alt + L</kbd>
                  </div>
                  <div className="flex justify-between items-center p-3 border border-slate-200 dark:border-slate-850 rounded-xl bg-white dark:bg-slate-900">
                    <span className="text-slate-700 dark:text-slate-300 font-medium">Financial Reports</span>
                    <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-350 dark:border-slate-700 rounded text-xs font-mono font-bold shadow-sm">Alt + R</kbd>
                  </div>
                  <div className="flex justify-between items-center p-3 border border-slate-200 dark:border-slate-850 rounded-xl bg-white dark:bg-slate-900">
                    <span className="text-slate-700 dark:text-slate-300 font-medium">Close Modal / Cancel</span>
                    <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-350 dark:border-slate-700 rounded text-xs font-mono font-bold shadow-sm">Esc</kbd>
                  </div>
                </div>
              </article>
            )}

            {/* 10. FAQ */}
            {activeTab === "faq" && (
              <article className="prose prose-slate dark:prose-invert max-w-none flex flex-col gap-6">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    ❓ Frequently Asked Questions (FAQ)
                  </h2>
                  <p className="text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                    Quick answers to common questions about operating the MeriParchi system.
                  </p>
                </div>

                <div className="space-y-4">
                  <details className="group border border-slate-200 dark:border-slate-850 rounded-xl p-4 bg-white dark:bg-slate-900 cursor-pointer">
                    <summary className="font-bold text-slate-900 dark:text-slate-200 flex justify-between items-center">
                      <span>How can I reset a user password?</span>
                      <span className="text-slate-400 group-open:rotate-180 transition-transform">▼</span>
                    </summary>
                    <p className="text-sm text-slate-500 mt-2">
                      Go to the <strong>Manage Users</strong> tab. Locate the employee, click Edit, enter a new password in the input field, and save.
                    </p>
                  </details>

                  <details className="group border border-slate-200 dark:border-slate-850 rounded-xl p-4 bg-white dark:bg-slate-900 cursor-pointer">
                    <summary className="font-bold text-slate-900 dark:text-slate-200 flex justify-between items-center">
                      <span>What does a negative outstanding balance indicate?</span>
                      <span className="text-slate-400 group-open:rotate-180 transition-transform">▼</span>
                    </summary>
                    <p className="text-sm text-slate-500 mt-2">
                      A negative balance indicates the customer has an advance credit in their ledger. This typically happens when they pre-pay more than their outstanding balance.
                    </p>
                  </details>

                  <details className="group border border-slate-200 dark:border-slate-850 rounded-xl p-4 bg-white dark:bg-slate-900 cursor-pointer">
                    <summary className="font-bold text-slate-900 dark:text-slate-200 flex justify-between items-center">
                      <span>Are my slips editable or deletable?</span>
                      <span className="text-slate-400 group-open:rotate-180 transition-transform">▼</span>
                    </summary>
                    <p className="text-sm text-slate-500 mt-2">
                      To preserve financial integrity and prevent audit manipulation, slips cannot be edited. If you made an error, you must record a credit/return transaction to cancel out the wrong slip, and then issue a new one.
                    </p>
                  </details>

                  <details className="group border border-slate-200 dark:border-slate-850 rounded-xl p-4 bg-white dark:bg-slate-900 cursor-pointer">
                    <summary className="font-bold text-slate-900 dark:text-slate-200 flex justify-between items-center">
                      <span>How often are audit security logs purged?</span>
                      <span className="text-slate-400 group-open:rotate-180 transition-transform">▼</span>
                    </summary>
                    <p className="text-sm text-slate-500 mt-2">
                      Audit logs are retained indefinitely by default unless they are manually purged using the Admin interface under the Audit page settings.
                    </p>
                  </details>
                </div>
              </article>
            )}

          </main>
        </div>
        
      </div>
    </div>
  );
}
