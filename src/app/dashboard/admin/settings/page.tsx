"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { QuestionMarkCircleIcon } from "@heroicons/react/24/outline";

interface Toast {
  id: number;
  message: string;
  type: "success" | "error" | "info";
}

export default function AdminSettingsPage() {
  const { session } = useAuth();

  const [orgname, setOrgname] = useState("");
  const [enableotp, setEnableotp] = useState(false);
  const [isactive, setIsactive] = useState(true);
  const [otpresettime, setOtpresettime] = useState<number>(24);
  const [opentime, setOpentime] = useState("09:00");
  const [closetime, setClosetime] = useState("18:00");
  const [auditRetentionDays, setAuditRetentionDays] = useState<number>(15);
  
  // Google Drive config states
  const [gdriveClientId, setGdriveClientId] = useState("");
  const [gdriveClientSecret, setGdriveClientSecret] = useState("");
  const [backupSchedule, setBackupSchedule] = useState("none");
  const [gdriveLinked, setGdriveLinked] = useState(false);
  const [lastBackupTime, setLastBackupTime] = useState("");
  const [gdriveUploading, setGdriveUploading] = useState(false);
  const [enableSecurityLogs, setEnableSecurityLogs] = useState(true);
  const [enableAiAssistant, setEnableAiAssistant] = useState(true);

  const [savingCompany, setSavingCompany] = useState(false);

  const [toasts, setToasts] = useState<Toast[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState<number | null>(null);

  const addToast = (message: string, type: "success" | "error" | "info") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  };

  const handleBackup = () => {
    window.location.href = "/api/company/backup";
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleLinkGDrive = () => {
    if (!session) return;
    if (!gdriveClientId) {
      addToast("Please save your Google Client ID first.", "error");
      return;
    }
    window.location.href = `/api/company/backup/gdrive-auth?orgcode=${session.orgcode}`;
  };

  const handleManualGDriveBackup = async () => {
    setGdriveUploading(true);
    try {
      const response = await fetch("/api/company/backup/gdrive-upload", {
        method: "POST",
      });
      const data = await response.json();
      if (response.ok && data.success) {
        addToast("Backup uploaded to Google Drive successfully!", "success");
        setLastBackupTime(new Date().toISOString());
      } else {
        addToast(data.message || "Failed to upload backup.", "error");
      }
    } catch (e) {
      addToast("Failed to connect to server.", "error");
    } finally {
      setGdriveUploading(false);
    }
  };

  const handleRestore = async () => {
    if (!selectedFile) return;

    const confirmRestore = window.confirm(
      "Are you absolutely sure you want to restore? This will permanently delete and overwrite all current slips, items, users, and payments for this company. This cannot be undone."
    );
    if (!confirmRestore) return;

    setRestoring(true);
    setRestoreProgress(0);

    const formData = new FormData();
    formData.append("file", selectedFile);

    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        const percentComplete = Math.round((event.loaded / event.total) * 100);
        // Cap upload progress at 99% to indicate server-side DB work is running
        setRestoreProgress(Math.min(percentComplete, 99));
      }
    });

    xhr.addEventListener("load", () => {
      setRestoreProgress(100);
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300 && data.success) {
          addToast("Database restored successfully! Reloading...", "success");
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        } else {
          addToast(data.message || "Failed to restore database", "error");
          setRestoreProgress(null);
          setRestoring(false);
        }
      } catch (e) {
        addToast("Failed to parse server response", "error");
        setRestoreProgress(null);
        setRestoring(false);
      }
    });

    xhr.addEventListener("error", () => {
      addToast("Failed to connect to server", "error");
      setRestoreProgress(null);
      setRestoring(false);
    });

    xhr.open("POST", "/api/company/restore");
    xhr.send(formData);
  };

  useEffect(() => {
    // Read OAuth success query param
    const params = new URLSearchParams(window.location.search);
    if (params.get("gdrive") === "success") {
      addToast("Google Drive successfully linked!", "success");
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  useEffect(() => {
    const fetchCompanyData = async () => {
      if (!session) return;
      try {
        const res = await fetch(`/api/company?orgcode=${session.orgcode}`);
        const data = await res.json();
        if (res.ok && data.success) {
          if (data.company) {
            setOrgname(data.company.orgname || "");
            setEnableotp(data.company.enableotp || false);
            setIsactive(data.company.isactive !== false);
            setOtpresettime(data.company.otpresettime || 24);
            if (data.company.opentime) setOpentime(data.company.opentime.substring(0, 5));
            if (data.company.closetime) setClosetime(data.company.closetime.substring(0, 5));
            if (data.company.audit_retention_days !== undefined) {
              setAuditRetentionDays(data.company.audit_retention_days);
            }
            setGdriveClientId(data.company.gdrive_client_id || "");
            setBackupSchedule(data.company.backup_schedule || "none");
            setGdriveLinked(!!data.company.gdrive_linked);
            setLastBackupTime(data.company.last_backup_time || "");
            if (data.company.enable_security_logs !== undefined) {
              setEnableSecurityLogs(data.company.enable_security_logs);
            }
            if (data.company.enable_ai_assistant !== undefined) {
              setEnableAiAssistant(data.company.enable_ai_assistant);
            }
          }
        }
      } catch (e) {
        console.error("Failed to load company data");
      }
    };
    fetchCompanyData();
  }, [session]);

  const handleUpdateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    setSavingCompany(true);
    try {
      const response = await fetch("/api/company", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgcode: session.orgcode,
          orgname: orgname,
          enableotp: enableotp,
          isactive: isactive,
          otpresettime: otpresettime,
          opentime: opentime,
          closetime: closetime,
          audit_retention_days: auditRetentionDays,
          gdrive_client_id: gdriveClientId,
          gdrive_client_secret: gdriveClientSecret,
          backup_schedule: backupSchedule,
          enable_security_logs: enableSecurityLogs,
          enable_ai_assistant: enableAiAssistant,
        }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        addToast("Company settings updated successfully", "success");
        window.dispatchEvent(new Event("company-settings-updated"));
        setGdriveClientSecret(""); // clear secret input on save
        // Re-fetch company details to check link status
        const fetchRes = await fetch(`/api/company?orgcode=${session.orgcode}`);
        const fetchData = await fetchRes.json();
        if (fetchRes.ok && fetchData.success && fetchData.company) {
          setGdriveLinked(!!fetchData.company.gdrive_linked);
        }
      } else {
        addToast(data.message || "Failed to update settings", "error");
      }
    } catch (e) {
      addToast("Failed to connect to server", "error");
    } finally {
      setSavingCompany(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in relative">
      <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Company Profiles</h2>
      <p className="text-slate-500 text-sm mt-1 mb-4">Configure organization metadata and validation rules.</p>

      <div className="flex flex-col gap-6 max-w-[600px]">
        <div className="bg-white/80 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm backdrop-blur-xl">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-700 pb-3 mb-5">Organization Profile Settings</h3>
          <form onSubmit={handleUpdateCompany} className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Organization Name</label>
              <input 
                type="text" 
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900/50 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500 transition-all" 
                value={orgname} 
                onChange={(e) => setOrgname(e.target.value)} 
              />
            </div>

            <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
              <div>
                <div className="font-semibold text-slate-900 dark:text-slate-100">Enable Login OTP Code Verification</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  If enabled, standard operator accounts require entering a 4-digit code generated by the administrator.
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer"
                  checked={enableotp} 
                  onChange={(e) => setEnableotp(e.target.checked)} 
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
              <div>
                <div className="font-semibold text-slate-900 dark:text-slate-100">Session Tracking & Security Logs</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Log security-critical operations including successful/failed operator logins and logout actions.
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer"
                  checked={enableSecurityLogs} 
                  onChange={(e) => setEnableSecurityLogs(e.target.checked)} 
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
              <div>
                <div className="font-semibold text-slate-900 dark:text-slate-100">Enable AI Assistant Chat Widget</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Toggle to show/hide the floating AI Assistant chat interface on the admin dashboard.
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer"
                  checked={enableAiAssistant} 
                  onChange={(e) => setEnableAiAssistant(e.target.checked)} 
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">OTP Reset Time (Hours)</label>
              <input 
                type="number" 
                min="1"
                max="24"
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900/50 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500 transition-all" 
                value={otpresettime} 
                onChange={(e) => setOtpresettime(parseInt(e.target.value) || 24)} 
              />
              <p className="text-xs text-slate-500 mt-1">Time window before unused OTPs expire (1-24 hrs).</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Audit Log Retention (Days)</label>
              <input 
                type="number" 
                min="1"
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900/50 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500 transition-all" 
                value={auditRetentionDays} 
                onChange={(e) => setAuditRetentionDays(parseInt(e.target.value) || 15)} 
              />
              <p className="text-xs text-slate-500 mt-1">Number of days to retain audit logs. Older logs are automatically purged.</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Google Drive Client ID</label>
                <div className="group relative flex items-center">
                  <QuestionMarkCircleIcon className="w-4 h-4 text-slate-400 cursor-pointer hover:text-slate-600 dark:hover:text-slate-300" />
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3 bg-slate-900 text-white text-xs rounded-xl shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 z-50 font-normal leading-relaxed">
                    <strong>How to get Google Client ID:</strong>
                    <ol className="list-decimal list-inside mt-1 space-y-1">
                      <li>Go to Google Cloud Console.</li>
                      <li>Create a project & enable Google Drive API.</li>
                      <li>Configure OAuth Consent Screen.</li>
                      <li>Create Credentials &rarr; OAuth Client ID.</li>
                      <li>Set Web App and add redirect URI: <em>{"http://<your-domain>/api/company/backup/gdrive-callback"}</em></li>
                    </ol>
                  </div>
                </div>
              </div>
              <input 
                type="text" 
                placeholder="Google OAuth Client ID"
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900/50 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500 transition-all" 
                value={gdriveClientId} 
                onChange={(e) => setGdriveClientId(e.target.value)} 
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Google Drive Client Secret</label>
                <div className="group relative flex items-center">
                  <QuestionMarkCircleIcon className="w-4 h-4 text-slate-400 cursor-pointer hover:text-slate-600 dark:hover:text-slate-300" />
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3 bg-slate-900 text-white text-xs rounded-xl shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 z-50 font-normal leading-relaxed">
                    <strong>How to get Client Secret:</strong>
                    <p className="mt-1">
                      The Client Secret is generated automatically alongside the Client ID in the Google Cloud Console Credentials interface. Copy both into these fields.
                    </p>
                  </div>
                </div>
              </div>
              <input 
                type="password" 
                placeholder={gdriveLinked ? "••••••••••••••••" : "Google OAuth Client Secret"}
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900/50 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500 transition-all" 
                value={gdriveClientSecret} 
                onChange={(e) => setGdriveClientSecret(e.target.value)} 
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Auto Backup Schedule</label>
              <select
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900/50 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer"
                value={backupSchedule}
                onChange={(e) => setBackupSchedule(e.target.value)}
              >
                <option value="none">Disabled (No Auto Backup)</option>
                <option value="daily">Daily Backup</option>
                <option value="weekly">Weekly Backup</option>
                <option value="monthly">Monthly Backup</option>
              </select>
              <p className="text-xs text-slate-500 mt-1">Automatically push backup ZIP files to the linked Google Drive folder on schedule.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Opening Time</label>
                <input 
                  type="time" 
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900/50 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500 transition-all" 
                  value={opentime} 
                  onChange={(e) => setOpentime(e.target.value)} 
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Closing Time</label>
                <input 
                  type="time" 
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900/50 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500 transition-all" 
                  value={closetime} 
                  onChange={(e) => setClosetime(e.target.value)} 
                />
              </div>
            </div>

            <button 
              type="submit" 
              className="w-full mt-2 py-3 px-4 rounded-xl text-white font-medium bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 transition-all shadow-[0_4px_10px_rgba(37,99,235,0.2)]" 
              disabled={savingCompany}
            >
              {savingCompany ? "Saving Settings..." : "Commit Settings"}
            </button>
          </form>
        </div>

        <div className="bg-white/80 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm backdrop-blur-xl">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-700 pb-3 mb-5">Google Drive Backup Settings</h3>
          <div className="flex flex-col gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="font-semibold text-slate-900 dark:text-slate-100">Status:</span>
                {gdriveLinked ? (
                  <span className="text-sm font-semibold text-green-600 dark:text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full">🟢 Linked</span>
                ) : (
                  <span className="text-sm font-semibold text-red-600 dark:text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full">🔴 Not Linked</span>
                )}
              </div>
              {lastBackupTime && (
                <p className="text-xs text-slate-500 mb-3">Last upload: {new Date(lastBackupTime).toLocaleString()}</p>
              )}
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-4">
                Grant permission to upload backup files to your Google Drive. Save your Client ID and Client Secret in Organization settings first, then authenticate.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleLinkGDrive}
                  disabled={!gdriveClientId}
                  className="py-2.5 px-4 rounded-xl text-white font-medium bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-all text-sm"
                >
                  Link Google Drive
                </button>
                {gdriveLinked && (
                  <button
                    onClick={handleManualGDriveBackup}
                    disabled={gdriveUploading}
                    className="py-2.5 px-4 rounded-xl text-white font-medium bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition-all text-sm"
                  >
                    {gdriveUploading ? "Uploading Backup..." : "Upload Backup to Drive"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white/80 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm backdrop-blur-xl">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-700 pb-3 mb-5">Database Backup & Restore</h3>
          <div className="flex flex-col gap-6">
            <div>
              <div className="font-semibold text-slate-900 dark:text-slate-100">Backup Company Data</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-3">
                Export all data related to this company—including settings, user accounts, slips, items, and payment logs—to a ZIP file.
              </div>
              <button
                onClick={handleBackup}
                className="py-2.5 px-4 rounded-xl text-white font-medium bg-emerald-600 hover:bg-emerald-700 transition-all shadow-[0_4px_10px_rgba(16,185,129,0.2)] text-sm"
              >
                Export Backup (.zip)
              </button>
            </div>

            <div className="border-t border-slate-200 dark:border-slate-700 pt-5">
              <div className="font-semibold text-slate-900 dark:text-slate-100">Restore Company Data</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-4 text-amber-600 dark:text-amber-500 font-medium">
                Warning: Restoring data will overwrite all current settings, users, slips, items, and payments for this company. This action cannot be undone.
              </div>
              
              <div className="flex flex-col gap-3">
                <input
                  type="file"
                  accept=".zip"
                  onChange={handleFileChange}
                  className="block w-full text-sm text-slate-500 dark:text-slate-400
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-xl file:border-0
                    file:text-sm file:font-semibold
                    file:bg-slate-100 dark:file:bg-slate-700
                    file:text-slate-700 dark:file:text-slate-200
                    hover:file:bg-slate-200 dark:hover:file:bg-slate-600
                    cursor-pointer"
                />
                
                {restoreProgress !== null && (
                  <div className="w-full bg-slate-100 dark:bg-slate-900 rounded-full h-4 relative overflow-hidden border border-slate-200 dark:border-slate-800">
                    <div 
                      className="bg-blue-600 h-full rounded-full transition-all duration-300 ease-out" 
                      style={{ width: `${restoreProgress}%` }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-slate-700 dark:text-slate-350">
                      {restoreProgress === 99 ? "Processing database..." : `${restoreProgress}%`}
                    </div>
                  </div>
                )}

                <button
                  onClick={handleRestore}
                  disabled={!selectedFile || restoring}
                  className="py-2.5 px-4 rounded-xl text-white font-medium bg-rose-600 hover:bg-rose-700 disabled:opacity-50 transition-all shadow-[0_4px_10px_rgba(225,29,72,0.2)] text-sm self-start"
                >
                  {restoring ? "Restoring Data..." : "Restore Backup (.zip)"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Toasts */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((toast) => (
          <div key={toast.id} className={`px-4 py-3 rounded shadow-lg text-white text-sm font-medium animate-slide-up ${toast.type === 'error' ? 'bg-red-500' : toast.type === 'success' ? 'bg-green-500' : 'bg-blue-500'}`}>
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
}
