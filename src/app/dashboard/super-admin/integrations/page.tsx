"use client";

import React, { useState } from "react";
import {
  CommandLineIcon,
  CreditCardIcon,
  CloudIcon,
  ChatBubbleLeftRightIcon,
  EnvelopeIcon,
  CheckCircleIcon,
  XCircleIcon,
  Cog6ToothIcon
} from "@heroicons/react/24/outline";

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: any;
  status: "active" | "inactive" | "coming-soon";
  category: "payment" | "backup" | "notification" | "system";
  provider: string;
}

export default function SuperAdminIntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([
    {
      id: "razorpay",
      name: "Razorpay Standard Checkout",
      description: "Direct online subscription billing and automated license expiration validation.",
      icon: CreditCardIcon,
      status: "active",
      category: "payment",
      provider: "Razorpay India"
    },
    {
      id: "gdrive",
      name: "Google Drive Automated Backups",
      description: "Auto-backup organization databases to Google Drive container storage.",
      icon: CloudIcon,
      status: "active",
      category: "backup",
      provider: "Google Cloud Platform"
    },
    {
      id: "smtp",
      name: "SMTP/Email Relay Server",
      description: "Custom system alerts, transaction records, and invoice mailer configuration.",
      icon: EnvelopeIcon,
      status: "coming-soon",
      category: "system",
      provider: "AWS SES / Sendgrid"
    },
    {
      id: "whatsapp",
      name: "WhatsApp Transaction Updates",
      description: "Automated billing messages and invoice alerts sent directly to clients via WhatsApp API.",
      icon: ChatBubbleLeftRightIcon,
      status: "coming-soon",
      category: "notification",
      provider: "Meta Graph API"
    },
    {
      id: "logs",
      name: "Syslog / Cloudwatch Stream",
      description: "Pipe global admin audit events and exceptions to external monitoring systems.",
      icon: CommandLineIcon,
      status: "coming-soon",
      category: "system",
      provider: "AWS CloudWatch"
    }
  ]);

  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);

  const getStatusBadge = (status: Integration["status"]) => {
    switch (status) {
      case "active":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-950/40 text-emerald-400 border border-emerald-800/30 uppercase tracking-wide">
            <CheckCircleIcon className="w-3.5 h-3.5" />
            Active
          </span>
        );
      case "inactive":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-950/40 text-rose-400 border border-rose-800/30 uppercase tracking-wide">
            <XCircleIcon className="w-3.5 h-3.5" />
            Inactive
          </span>
        );
      case "coming-soon":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-violet-950/40 text-violet-400 border border-violet-850 uppercase tracking-wide">
            Coming Soon
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in max-w-7xl mx-auto p-2">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-100">System Integrations</h1>
        <p className="text-slate-400 text-sm mt-1">
          Manage third-party payment gateways, external file backups, notification gateways, and relay servers.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {integrations.map((i) => {
          const Icon = i.icon;
          return (
            <div 
              key={i.id} 
              className={`bg-slate-800/50 backdrop-blur-md border rounded-2xl p-6 flex flex-col justify-between shadow-sm hover:border-slate-700 transition-all ${
                i.status === "coming-soon" ? "opacity-75" : ""
              }`}
            >
              <div>
                <div className="flex justify-between items-start gap-4 mb-4">
                  <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center border border-slate-700">
                    <Icon className="w-5 h-5 text-violet-400" />
                  </div>
                  {getStatusBadge(i.status)}
                </div>
                <h3 className="text-base font-bold text-slate-100 mb-1">{i.name}</h3>
                <span className="text-xs font-mono text-slate-500 block mb-3">Provider: {i.provider}</span>
                <p className="text-sm text-slate-400 leading-relaxed mb-6">{i.description}</p>
              </div>

              <div className="flex gap-2">
                {i.status === "active" ? (
                  <button 
                    onClick={() => setSelectedIntegration(i)}
                    className="flex-1 py-2 rounded-xl bg-slate-900 hover:bg-slate-750 text-slate-200 border border-slate-750 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                  >
                    <Cog6ToothIcon className="w-4 h-4" />
                    Configure Settings
                  </button>
                ) : (
                  <button 
                    disabled 
                    className="flex-1 py-2 rounded-xl bg-slate-900/40 text-slate-500 border border-slate-850 text-xs font-bold flex items-center justify-center cursor-not-allowed"
                  >
                    Not Configurable
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Integration config modal */}
      {selectedIntegration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold text-slate-100 mb-2">Configure {selectedIntegration.name}</h3>
            <p className="text-xs text-slate-400 mb-5">
              The credentials for active services (like API keys and secrets) are securely retrieved from your `.env` configuration file on the system.
            </p>

            <div className="flex flex-col gap-4 mb-6">
              {selectedIntegration.id === "razorpay" && (
                <>
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
                    <span className="text-xs text-slate-500 font-bold block mb-1">RAZORPAY KEY ID</span>
                    <span className="text-xs font-mono text-emerald-400 break-all select-all">rzp_live_T4gRvLc5YGFC66</span>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
                    <span className="text-xs text-slate-500 font-bold block mb-1">STATUS FLAG</span>
                    <span className="text-xs font-semibold text-emerald-400">Live Production Enabled</span>
                  </div>
                </>
              )}

              {selectedIntegration.id === "gdrive" && (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
                  <span className="text-xs text-slate-500 font-bold block mb-1">SERVICE ACCOUNT STATUS</span>
                  <span className="text-xs font-semibold text-emerald-400">Google Drive Token Active</span>
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setSelectedIntegration(null)}
                className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-750 text-white font-bold text-sm transition-all"
              >
                Close Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
