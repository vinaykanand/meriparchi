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
  PaperAirplaneIcon
} from "@heroicons/react/24/outline";

interface ChatMessage {
  sender: "user" | "ai";
  text: string;
}

function AdminDashboardContent({ children }: { children: React.ReactNode }) {
  const { session, logout } = useAuth();
  const pathname = usePathname();
  const [theme, setTheme] = useState("light");

  // AI Assistant Chat Widget State
  const [isAiEnabled, setIsAiEnabled] = useState(true);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { sender: "ai", text: "Hello! I am your AI Assistant. Ask me anything about your customer balances, payments, top debtors, or outstanding statistics." }
  ]);
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
    { name: "Manage Users", href: "/dashboard/admin/users", icon: <UsersIcon className="w-5 h-5" /> },
    { name: "Organization Settings", href: "/dashboard/admin/settings", icon: <Cog6ToothIcon className="w-5 h-5" /> },
    { name: "Audit Logs", href: "/dashboard/admin/audit", icon: <ShieldCheckIcon className="w-5 h-5" /> },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300 font-sans text-slate-900 dark:text-slate-100 overflow-hidden relative flex flex-col">
      {/* Top Navbar */}
      <header className="flex justify-between items-center p-4 sm:px-6 lg:px-8 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md relative z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 shadow-lg shadow-blue-500/20 flex items-center justify-center text-white font-bold text-xl">
            P
          </div>
          <span className="font-bold text-lg hidden sm:block">Parchi Admin</span>
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
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
          {/* Chat window drawer */}
          {isChatOpen && (
            <div className="w-[360px] sm:w-[380px] h-[480px] bg-white/95 dark:bg-slate-950/95 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden mb-4 backdrop-blur-xl animate-fade-in relative">
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

              {/* Messages log */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 flex flex-col">
                {chatMessages.map((msg, idx) => (
                  <div 
                    key={idx}                  className={`px-3 py-2 rounded-2xl max-w-[85%] text-sm shadow-sm leading-relaxed whitespace-pre-line
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

              {/* Scrolling suggestions */}
              <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50 flex gap-1.5 overflow-x-auto whitespace-nowrap scrollbar-none">
                {chatSuggestions.map((sugg, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendChat(sugg)}
                    className="px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-slate-700 text-blue-600 dark:text-blue-400 rounded-full text-xs font-semibold border border-slate-200 dark:border-slate-700 transition-colors shadow-sm shrink-0"
                  >
                    {sugg}
                  </button>
                ))}
              </div>

              {/* Input Form */}
              <form 
                onSubmit={(e) => { e.preventDefault(); handleSendChat(chatInput); }}
                className="p-3 border-t border-slate-200 dark:border-slate-800 flex gap-2 items-center bg-white dark:bg-slate-950"
              >
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
            </div>
          )}

          {/* Floating Bubble Trigger */}
          <button
            onClick={() => setIsChatOpen(!isChatOpen)}
            className="w-14 h-14 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-[0_8px_30px_rgba(37,99,235,0.45)] hover:scale-105 active:scale-95 transition-all duration-300 flex items-center justify-center relative hover:shadow-[0_12px_40px_rgba(37,99,235,0.6)]"
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

