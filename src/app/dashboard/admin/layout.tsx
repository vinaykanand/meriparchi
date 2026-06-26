"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import AuthProvider, { useAuth } from "@/components/providers/AuthProvider";
import { 
  ChartBarIcon, 
  DocumentPlusIcon, 
  BanknotesIcon, 
  MagnifyingGlassIcon, 
  PresentationChartLineIcon, 
  UsersIcon, 
  Cog6ToothIcon,
  SunIcon,
  MoonIcon,
  ShieldCheckIcon,
  SparklesIcon,
  PaperAirplaneIcon,
  CloudArrowUpIcon,
  CreditCardIcon,
  CubeIcon,
  ChevronRightIcon,
  MapPinIcon,
  TagIcon
} from "@heroicons/react/24/outline";

interface ChatMessage {
  sender: "user" | "ai";
  text: string;
}

function AdminDashboardContent({ children }: { children: React.ReactNode }) {
  const { session, logout } = useAuth();
  const pathname = usePathname();
  const [theme, setTheme] = useState("light");

  // Subscription State
  const [subscription, setSubscription] = useState<{
    type: "trial" | "monthly";
    remaining_days: number;
    slips_count: number;
    payments_count: number;
  } | null>(null);
  const [inventoryEnabled, setInventoryEnabled] = useState(false);
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);

  const fetchSubscription = async () => {
    if (!session?.orgcode) return;
    try {
      const res = await fetch(`/api/company?orgcode=${session.orgcode}`);
      const data = await res.json();
      if (res.ok && data.success && data.company?.subscription) {
        const sub = data.company.subscription;
        setSubscription({
          type: sub.type,
          remaining_days: sub.remaining_days || 0,
          slips_count: sub.slips_count,
          payments_count: sub.payments_count,
        });
        setInventoryEnabled(!!data.company.inventory_enabled);
      }
    } catch (err) {
      console.error("Failed to load subscription details:", err);
    }
  };

  useEffect(() => {
    fetchSubscription();
    window.addEventListener("company-settings-updated", fetchSubscription);
    return () => {
      window.removeEventListener("company-settings-updated", fetchSubscription);
    };
  }, [session]);

  useEffect(() => {
    if (pathname.startsWith("/dashboard/admin/inventory") || pathname === "/dashboard/admin/reports") {
      setIsInventoryOpen(true);
    }
  }, [pathname]);

  // AI Assistant Chat Widget State
  const [isAiEnabled, setIsAiEnabled] = useState(true);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("chat");

  // Draggable position states
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = React.useRef({ x: 0, y: 0 });
  const dragDistance = React.useRef(0);
  const pointerDownPos = React.useRef({ x: 0, y: 0 });
  const bubbleRef = React.useRef<HTMLButtonElement | null>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    dragDistance.current = 0;
    pointerDownPos.current = { x: e.clientX, y: e.clientY };
    dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    if (bubbleRef.current) {
      bubbleRef.current.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - pointerDownPos.current.x;
    const dy = e.clientY - pointerDownPos.current.y;
    dragDistance.current = Math.sqrt(dx * dx + dy * dy);

    const newX = e.clientX - dragStart.current.x;
    const newY = e.clientY - dragStart.current.y;
    setPosition({ x: newX, y: newY });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    if (bubbleRef.current) {
      bubbleRef.current.releasePointerCapture(e.pointerId);
    }
    // If user dragged more than 5px, do not toggle the chat drawer
    if (dragDistance.current > 5) {
      e.stopPropagation();
      e.preventDefault();
    } else {
      setIsChatOpen((prev) => !prev);
    }
  };

  const [hasInventory, setHasInventory] = useState(false);
  const [todayOverview, setTodayOverview] = useState<{
    totalOutstanding: number;
    revenueToday: number;
    paymentsToday: number;
    returnsToday: number;
    slipsToday: number;
  } | null>(null);
  const [isLoadingOverview, setIsLoadingOverview] = useState(false);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatSuggestions, setChatSuggestions] = useState<string[]>([
    "Total Outstanding",
    "Show Top Debtors",
    "Show Aging Report",
    "Today's Stats"
  ]);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isChatOpen) {
      setTimeout(scrollToBottom, 100);
    }
  }, [chatMessages, isChatOpen]);

  // Set suggestions and welcome greeting dynamically based on subscription features
  useEffect(() => {
    const greetingText = `Hello! I am your AI Assistant. I can help you search ledgers and analyze details in real time.

**Here are examples of what you can ask me (click to ask):**
- *"What is the total outstanding?"*
- *"Who is the top debtor?"*
- *"Show Aging Report"*
- *"risky accounts"* (overdue > 60 days)
- *"hasn't paid"* (no payment in 30+ days)
- *"most sold"* (popular items)
- *"returned items today"*
- *"this week vs last week"* (WoW trend)
- *"largest payment"* or *"largest slip"*
- *"outstanding in [City]"*
- *"Show details for slip #8"*${hasInventory ? `\n\n**📦 Inventory Commands:**\n- *"low stock"* (items at/below reorder level)\n- *"recent vouchers"* (recent inventory movements)\n- *"stock status"* (overall stock overview)` : ""}

*Or type a customer query like: "Outstanding for [Name/Phone]" or "Payments for [Name/Phone]"*`;

    setChatMessages([
      {
        sender: "ai",
        text: greetingText
      }
    ]);

    if (hasInventory) {
      setChatSuggestions([
        "Total Outstanding",
        "Show Top Debtors",
        "Show Aging Report",
        "Today's Stats",
        "low stock",
        "recent vouchers",
        "stock status"
      ]);
    } else {
      setChatSuggestions([
        "Total Outstanding",
        "Show Top Debtors",
        "Show Aging Report",
        "Today's Stats"
      ]);
    }
  }, [hasInventory]);

  // Fetch today's overview data whenever chat is opened or refreshed
  const fetchOverviewData = async () => {
    if (!session?.orgcode) return;
    setIsLoadingOverview(true);
    try {
      const res = await fetch(`/api/dashboard?orgcode=${session.orgcode}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setTodayOverview(data.kpis);
      }
    } catch (e) {
      console.error("Failed to load today's overview stats:", e);
    } finally {
      setIsLoadingOverview(false);
    }
  };

  useEffect(() => {
    if (isChatOpen && session?.orgcode) {
      fetchOverviewData();
    }
  }, [isChatOpen, session?.orgcode]);

  useEffect(() => {
    const savedTheme = localStorage.getItem("parchi_theme");
    if (savedTheme) {
      setTheme(savedTheme);
      if (savedTheme === "dark") {
        document.documentElement.classList.add("dark");
      }
    }
  }, []);

  useEffect(() => {
    const fetchCompanyAiSetting = async () => {
      if (!session?.orgcode) return;
      try {
        const res = await fetch(`/api/company?orgcode=${session.orgcode}`);
        const data = await res.json();
        if (res.ok && data.success && data.company) {
          if (data.company.enable_ai_assistant !== undefined) {
            setIsAiEnabled(data.company.enable_ai_assistant);
          }
          const hasInv = data.company.subscription?.has_inventory || data.company.subscription?.type === 'trial' || data.company.inventory_enabled;
          setHasInventory(!!hasInv);
        }
      } catch (e) {
        console.error("Failed to load company AI setting:", e);
      }
    };
    fetchCompanyAiSetting();

    window.addEventListener("company-settings-updated", fetchCompanyAiSetting);
    return () => {
      window.removeEventListener("company-settings-updated", fetchCompanyAiSetting);
    };
  }, [session]);

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

  const handleSendChat = async (textToSend: string) => {
    if (!textToSend.trim() || !session) return;
    
    const userMsg = textToSend.trim();
    setChatInput("");
    // Ensure we switch to chat tab so the user can see the AI's reply stream
    setActiveTab("chat");
    setChatMessages((prev) => [...prev, { sender: "user", text: userMsg }]);
    setIsChatLoading(true);

    try {
      const response = await fetch("/api/ai-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMsg,
          orgcode: session.orgcode
        })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setChatMessages((prev) => [...prev, { sender: "ai", text: data.reply }]);
        if (data.suggestions) {
          setChatSuggestions(data.suggestions);
        }
      } else {
        setChatMessages((prev) => [...prev, { sender: "ai", text: "Sorry, I encountered an issue processing your query. Please try again." }]);
      }
    } catch (e) {
      setChatMessages((prev) => [...prev, { sender: "ai", text: "Connection error. Please check your internet connection and try again." }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const renderMessageContent = (msg: ChatMessage) => {
    if (msg.sender === "user") {
      return msg.text;
    }

    // Parse text to find quoted suggestion questions: *"[Question]"* or "[Question]"
    const regex = /\*?"([^"]+)"\*?/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(msg.text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(msg.text.substring(lastIndex, match.index));
      }
      
      const question = match[1];
      parts.push(
        <button
          key={match.index}
          onClick={() => handleSendChat(question)}
          className="inline-block mx-1 my-0.5 px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-800 text-[11px] font-semibold rounded-lg border border-blue-200/50 dark:border-blue-700/50 transition-colors align-middle cursor-pointer"
        >
          "{question}"
        </button>
      );
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < msg.text.length) {
      parts.push(msg.text.substring(lastIndex));
    }

    return parts.length > 0 ? parts : msg.text;
  };

  const navLinks = [
    { name: "Overview", href: "/dashboard/admin", icon: <ChartBarIcon className="w-5 h-5" /> },
    { name: "Create Slip", href: "/dashboard/admin/slips", icon: <DocumentPlusIcon className="w-5 h-5" /> },
    { name: "Log Payment", href: "/dashboard/admin/payments", icon: <BanknotesIcon className="w-5 h-5" /> },
    { name: "Lookup Ledger", href: "/dashboard/admin/lookup", icon: <MagnifyingGlassIcon className="w-5 h-5" /> },
    { name: "Reports & Filters", href: "/dashboard/admin/reports", icon: <PresentationChartLineIcon className="w-5 h-5" /> },
    ...(inventoryEnabled ? [{ name: "InventoryHeader" }] : []),
    { name: "Manage Users", href: "/dashboard/admin/users", icon: <UsersIcon className="w-5 h-5" /> },
    { name: "Organization Settings", href: "/dashboard/admin/settings", icon: <Cog6ToothIcon className="w-5 h-5" /> },
    { name: "Billing & Plans", href: "/dashboard/admin/billing", icon: <CreditCardIcon className="w-5 h-5" /> },
    { name: "Backup & Restore", href: "/dashboard/admin/backup", icon: <CloudArrowUpIcon className="w-5 h-5" /> },
    { name: "Audit Logs", href: "/dashboard/admin/audit", icon: <ShieldCheckIcon className="w-5 h-5" /> },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300 font-sans text-slate-900 dark:text-slate-100 overflow-hidden relative flex flex-col">
      {session?.isImpersonation && (
        <div className="w-full bg-amber-500 text-slate-950 font-bold text-center py-2 text-xs uppercase tracking-wider flex items-center justify-center gap-4 relative z-30 shadow-[0_2px_8px_rgba(245,158,11,0.3)]">
          <span>⚠️ Impersonation Mode: Viewing as <span className="font-mono underline">{session.userid}</span> in <span className="font-mono underline">{session.orgcode}</span>. Read-only for transactions.</span>
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
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 shadow-lg shadow-blue-500/20 flex items-center justify-center text-white font-bold text-xl">
            P
          </div>
          <span className="font-bold text-lg hidden sm:block">Parchi Admin</span>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          {subscription && (
            <div className={`hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border ${
              subscription.remaining_days <= 0
                ? "bg-rose-50/80 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-400"
                : subscription.type === "trial"
                  ? "bg-amber-50/80 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900 text-amber-700 dark:text-amber-400"
                  : "bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-400"
            }`}>
              <span className="font-bold uppercase tracking-wider text-xs flex flex-col items-start leading-tight">
                <span className="text-[10px] opacity-80 font-black tracking-widest text-blue-650 dark:text-blue-300">
                  {inventoryEnabled ? "Parchi + Inventory" : "Parchi"}
                </span>
                <span>
                  {subscription.type === "trial" ? "Trial Mode" : "Subscription"}
                </span>
              </span>
              <span className="text-xs opacity-85 self-end">
                {subscription.remaining_days <= 0
                  ? "Expired"
                  : `(${Math.ceil(subscription.remaining_days)} days left)`}
              </span>
            </div>
          )}
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
          {!session?.isImpersonation && (
            <button className="px-4 py-1.5 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 border border-transparent hover:border-red-200 dark:hover:border-red-800 transition-colors" onClick={logout}>
              Sign Out
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 w-full flex flex-col md:flex-row overflow-hidden relative z-10">
        {/* Sidebar Nav */}
        <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md flex-shrink-0">
          <nav className="flex md:flex-col gap-1 p-4 overflow-x-auto md:overflow-x-visible">
            {navLinks.map((link) => {
              if (link.name === "InventoryHeader") {
                return (
                  <div key="inventory-group" className="flex flex-col gap-1 w-full">
                    <button
                      type="button"
                      onClick={() => setIsInventoryOpen(!isInventoryOpen)}
                      className="px-4 py-2.5 rounded-xl text-base font-semibold text-slate-650 dark:text-slate-405 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap flex items-center justify-between gap-3 w-full"
                    >
                      <div className="flex items-center gap-3">
                        <CubeIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        <span>Inventory</span>
                      </div>
                      <ChevronRightIcon className={`w-4 h-4 text-slate-400 dark:text-slate-500 transition-transform duration-200 ${isInventoryOpen ? 'rotate-90' : ''}`} />
                    </button>
                    {isInventoryOpen && (
                      <div className="flex flex-col gap-1 ml-4 border-l border-slate-200 dark:border-slate-800 pl-2 animate-fade-in">
                        <Link
                          href="/dashboard/admin/inventory"
                          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap flex items-center gap-3
                            ${pathname === "/dashboard/admin/inventory"
                              ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 shadow-sm"
                              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"}`}
                        >
                          <CubeIcon className="w-4 h-4" />
                          <span>Stock Overview</span>
                        </Link>
                        <Link
                          href="/dashboard/admin/inventory/reports"
                          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap flex items-center gap-3
                            ${pathname === "/dashboard/admin/inventory/reports"
                              ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 shadow-sm"
                              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"}`}
                        >
                          <PresentationChartLineIcon className="w-4 h-4" />
                          <span>Statement Report</span>
                        </Link>
                        <Link
                          href="/dashboard/admin/inventory/transactions"
                          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap flex items-center gap-3
                            ${pathname === "/dashboard/admin/inventory/transactions"
                              ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 shadow-sm"
                              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"}`}
                        >
                          <PaperAirplaneIcon className="w-4 h-4" />
                          <span>Post Movement</span>
                        </Link>
                        <Link
                          href="/dashboard/admin/inventory/locations"
                          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap flex items-center gap-3
                            ${pathname === "/dashboard/admin/inventory/locations"
                              ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 shadow-sm"
                              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"}`}
                        >
                          <MapPinIcon className="w-4 h-4" />
                          <span>Locations</span>
                        </Link>
                        <Link
                          href="/dashboard/admin/inventory/skus"
                          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap flex items-center gap-3
                            ${pathname === "/dashboard/admin/inventory/skus"
                              ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 shadow-sm"
                              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"}`}
                        >
                          <TagIcon className="w-4 h-4" />
                          <span>SKUs</span>
                        </Link>
                        <Link
                          href="/dashboard/admin/inventory/transaction-types"
                          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap flex items-center gap-3
                            ${pathname === "/dashboard/admin/inventory/transaction-types"
                              ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 shadow-sm"
                              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"}`}
                        >
                          <Cog6ToothIcon className="w-4 h-4" />
                          <span>Transaction Types</span>
                        </Link>
                        <Link
                          href="/dashboard/admin/inventory/close"
                          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap flex items-center gap-3
                            ${pathname === "/dashboard/admin/inventory/close"
                              ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 shadow-sm"
                              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"}`}
                        >
                          <ShieldCheckIcon className="w-4 h-4" />
                          <span>Year-End Close</span>
                        </Link>
                      </div>
                    )}
                  </div>
                );
              }

              if (!link.href) return null;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-4 py-2.5 rounded-xl text-base font-semibold transition-colors whitespace-nowrap flex items-center gap-3
                    ${isActive 
                      ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 shadow-sm" 
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

      {/* FLOATING AI ASSISTANT CHAT WIDGET */}
      {isAiEnabled && (
        <div 
          className="fixed bottom-6 right-6 z-50 flex flex-col items-end"
          style={{ transform: `translate3d(${position.x}px, ${position.y}px, 0)` }}
        >
          {/* Chat window drawer */}
          {isChatOpen && (
            <div className="w-[360px] sm:w-[380px] h-[540px] bg-white/95 dark:bg-slate-950/95 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden mb-4 backdrop-blur-xl animate-fade-in relative">
              {/* Header */}
              <div className="p-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex justify-between items-center shadow">
                <div className="flex items-center gap-2">
                  <SparklesIcon className="w-5 h-5 animate-pulse text-yellow-300" />
                  <div>
                    <h4 className="font-bold text-sm">AI Assistant</h4>
                    <p className="text-[10px] text-blue-100">Ask balance, payments & aging</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsChatOpen(false)}
                  className="w-6 h-6 rounded-full hover:bg-white/20 flex items-center justify-center text-lg font-bold"
                >
                  ×
                </button>
              </div>

              {/* Tab Selector */}
              <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60">
                <button
                  onClick={() => setActiveTab("chat")}
                  className={`flex-1 py-2 text-xs font-semibold border-b-2 transition-all ${
                    activeTab === "chat"
                      ? "border-blue-600 text-blue-600 dark:text-blue-400"
                      : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  }`}
                >
                  Chat Assistant
                </button>
                <button
                  onClick={() => setActiveTab("help")}
                  className={`flex-1 py-2 text-xs font-semibold border-b-2 transition-all ${
                    activeTab === "help"
                      ? "border-blue-600 text-blue-600 dark:text-blue-400"
                      : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  }`}
                >
                  Today & Help Guide
                </button>
              </div>

              {activeTab === "help" ? (
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/30 dark:bg-slate-950/30">
                  {/* Today's Overview Section */}
                  <div>
                    <h5 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Today's Real-time Overview</h5>
                    {isLoadingOverview ? (
                      <div className="grid grid-cols-2 gap-2">
                        {[1, 2, 3, 4].map((i) => (
                          <div key={i} className="h-14 bg-slate-100 dark:bg-slate-900 rounded-xl animate-pulse"></div>
                        ))}
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="p-3 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100/50 dark:border-blue-900/30 rounded-2xl">
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">New Revenue</p>
                          <p className="text-sm font-bold text-blue-600 dark:text-blue-400 mt-0.5">
                            ₹{(todayOverview?.revenueToday || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </p>
                          <span className="text-[9px] text-slate-400">({todayOverview?.slipsToday || 0} slips)</span>
                        </div>
                        <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100/50 dark:border-emerald-900/30 rounded-2xl">
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Payments Received</p>
                          <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                            ₹{(todayOverview?.paymentsToday || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                        <div className="p-3 bg-red-50/50 dark:bg-red-950/20 border border-red-100/50 dark:border-red-900/30 rounded-2xl">
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Returns Today</p>
                          <p className="text-sm font-bold text-red-600 dark:text-red-400 mt-0.5">
                            ₹{(todayOverview?.returnsToday || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                        <div className="p-3 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100/50 dark:border-amber-900/30 rounded-2xl col-span-1">
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Total Outstanding</p>
                          <p className="text-sm font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                            ₹{(todayOverview?.totalOutstanding || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Interactive Questions Manual */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <h5 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Help Manual & Ask Guide</h5>
                      <span className="text-[9px] bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-full font-medium">Click to Ask</span>
                    </div>

                    <div className="space-y-2 text-xs">
                      {/* Section 1 */}
                      <div className="p-2.5 rounded-2xl bg-slate-100/50 dark:bg-slate-900 border border-slate-200/40 dark:border-slate-800/80">
                        <p className="font-bold text-[11px] text-slate-700 dark:text-slate-300 mb-1.5">📊 Ledgers & Debt Overview</p>
                        <div className="flex flex-wrap gap-1.5">
                          {[
                            { label: "Total Outstanding", query: "What is the total outstanding?" },
                            { label: "Top Debtors", query: "Who is the top debtor?" },
                            { label: "Aging Summary", query: "Show Aging Report" },
                          ].map((item) => (
                            <button
                              key={item.label}
                              onClick={() => handleSendChat(item.query)}
                              className="px-2 py-1 bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 border border-slate-205 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-medium transition-colors"
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Section 2 */}
                      <div className="p-2.5 rounded-2xl bg-slate-100/50 dark:bg-slate-900 border border-slate-200/40 dark:border-slate-800/80">
                        <p className="font-bold text-[11px] text-slate-700 dark:text-slate-300 mb-1.5">⚠️ Risk & Inactivity</p>
                        <div className="flex flex-wrap gap-1.5">
                          {[
                            { label: "Overdue > 60 Days", query: "risky accounts" },
                            { label: "No payments (30+ days)", query: "hasn't paid" },
                          ].map((item) => (
                            <button
                              key={item.label}
                              onClick={() => handleSendChat(item.query)}
                              className="px-2 py-1 bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 border border-slate-205 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-medium transition-colors"
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Section 3 */}
                      <div className="p-2.5 rounded-2xl bg-slate-100/50 dark:bg-slate-900 border border-slate-200/40 dark:border-slate-800/80">
                        <p className="font-bold text-[11px] text-slate-700 dark:text-slate-300 mb-1.5">📦 Products & Returns</p>
                        <div className="flex flex-wrap gap-1.5">
                          {[
                            { label: "Most Sold Items", query: "most sold" },
                            { label: "Returned Items Today", query: "returned items today" },
                            { label: "Week-over-Week Trend", query: "this week vs last week" },
                          ].map((item) => (
                            <button
                              key={item.label}
                              onClick={() => handleSendChat(item.query)}
                              className="px-2 py-1 bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 border border-slate-205 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-medium transition-colors"
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Section 4 */}
                      <div className="p-2.5 rounded-2xl bg-slate-100/50 dark:bg-slate-900 border border-slate-200/40 dark:border-slate-800/80">
                        <p className="font-bold text-[11px] text-slate-700 dark:text-slate-300 mb-1">🔍 Customer & Slip Lookup</p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mb-2">Click to search a customer or slip detail:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {[
                            { label: "Outstanding: Vinay", query: "Outstanding for Vinay" },
                            { label: "Payments: Vinay", query: "Payments for Vinay" },
                            { label: "Returns: Vinay", query: "Returns for Vinay" },
                            { label: "Slip Details #1", query: "details for slip 1" },
                          ].map((item) => (
                            <button
                              key={item.label}
                              type="button"
                              onClick={() => handleSendChat(item.query)}
                              className="px-2 py-1 bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 border border-slate-205 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-medium transition-colors text-[10px]"
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Section 5: Inventory */}
                      {hasInventory && (
                        <div className="p-2.5 rounded-2xl bg-slate-100/50 dark:bg-slate-900 border border-slate-200/40 dark:border-slate-800/80">
                          <p className="font-bold text-[11px] text-slate-700 dark:text-slate-300 mb-1">📦 Inventory & Stock Control</p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 mb-2">Click to search inventory, locations, or vouchers:</p>
                          <div className="flex flex-wrap gap-1.5">
                            {[
                              { label: "Low Stock Alert", query: "low stock" },
                              { label: "Reorder List", query: "list reorder item" },
                              { label: "Voucher Summary", query: "recent vouchers" },
                              { label: "Stock Overview", query: "stock status" },
                              { label: "Stock: Putty", query: "stock for putty" },
                              { label: "Stock: Putty in Mehli", query: "stock for putty in Mehli" },
                              { label: "Recent 3 Vouchers", query: "show last 3 voucher" },
                            ].map((item) => (
                              <button
                                key={item.label}
                                type="button"
                                onClick={() => handleSendChat(item.query)}
                                className="px-2 py-1 bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 border border-slate-205 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-medium transition-colors text-[10px]"
                              >
                                {item.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* Messages log */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-3 flex flex-col">
                    {chatMessages.map((msg, idx) => (
                      <div 
                        key={idx}
                        className={`px-3 py-2 rounded-2xl max-w-[85%] text-sm shadow-sm leading-relaxed whitespace-pre-line
                          ${msg.sender === "user"
                            ? "bg-blue-600 text-white rounded-tr-none self-end"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-none self-start border border-slate-200/50 dark:border-slate-700"}`}
                      >
                        {renderMessageContent(msg)}
                      </div>
                    ))}
                    {isChatLoading && (
                      <div className="bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-2xl rounded-tl-none px-3 py-2 self-start flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></span>
                        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Input Form */}
                  <form 
                    onSubmit={(e) => { e.preventDefault(); handleSendChat(chatInput); }}
                    className="p-3 border-t border-slate-200 dark:border-slate-800 flex gap-2 items-center bg-white dark:bg-slate-950"
                  >
                    <button
                      type="button"
                      onClick={() => setActiveTab((prev) => (prev === "help" ? "chat" : "help"))}
                      className={`p-2 rounded-xl border transition-colors flex items-center justify-center font-bold text-sm w-9 h-9 shrink-0 shadow-sm
                        ${activeTab === "help"
                          ? "bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-400"
                          : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800"
                        }`}
                      title="Show Help Guide & Commands"
                    >
                      ?
                    </button>
                    <input
                      type="text"
                      placeholder="Ask assistant..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      className="flex-1 px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-slate-200"
                    />
                    <button
                      type="submit"
                      disabled={!chatInput.trim() || isChatLoading}
                      className="p-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white transition-colors shadow shadow-blue-500/20"
                    >
                      <PaperAirplaneIcon className="w-4 h-4" />
                    </button>
                  </form>
                </>
              )}
            </div>
          )}

          {/* Floating Bubble Trigger */}
          <button
            ref={bubbleRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className={`w-14 h-14 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-[0_8px_30px_rgba(37,99,235,0.45)] hover:scale-105 active:scale-95 transition-all duration-300 flex items-center justify-center relative hover:shadow-[0_12px_40px_rgba(37,99,235,0.6)] select-none cursor-move ${isDragging ? "opacity-90 scale-95" : ""}`}
            style={{ touchAction: "none" }}
            aria-label="Toggle AI Assistant"
          >
            {isChatOpen ? (
              <span className="text-xl font-black">✕</span>
            ) : (
              <>
                <SparklesIcon className="w-6 h-6 animate-pulse text-yellow-300" />
                {/* Pulsing indicator ring */}
                <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full">
                  <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75"></span>
                </span>
              </>
            )}
          </button>
        </div>
      )}

    </div>
  );
}

export default function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider requireAdmin={true}>
      <AdminDashboardContent>{children}</AdminDashboardContent>
    </AuthProvider>
  );
}

