"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";

interface Toast {
  id: number;
  message: string;
  type: "success" | "error" | "info";
}

export default function AdminBackupPage() {
  const { session } = useAuth();

  const [hasGdriveConfig, setHasGdriveConfig] = useState(false);
  const [backupSchedule, setBackupSchedule] = useState("none");
  const [gdriveLinked, setGdriveLinked] = useState(false);
  const [lastBackupTime, setLastBackupTime] = useState("");
  const [gdriveUploading, setGdriveUploading] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);

  const [toasts, setToasts] = useState<Toast[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState<number | null>(null);
  const [gdriveBackups, setGdriveBackups] = useState<any[]>([]);
  const [loadingGdriveBackups, setLoadingGdriveBackups] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restorePassword, setRestorePassword] = useState("");
  const [restoreFileId, setRestoreFileId] = useState<string | undefined>(undefined);

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
    if (!hasGdriveConfig) {
      addToast("Google Drive configuration is missing in server environment variables.", "error");
      return;
    }
    window.location.href = `/api/company/backup/gdrive-auth?orgcode=${session.orgcode}`;
  };

  const fetchGdriveBackups = async () => {
    setLoadingGdriveBackups(true);
    try {
      const res = await fetch("/api/company/backup/gdrive-list");
      const data = await res.json();
      if (res.ok && data.success) {
        setGdriveBackups(data.backups || []);
      }
    } catch (e) {
      console.error("Failed to load Google Drive backups:", e);
    } finally {
      setLoadingGdriveBackups(false);
    }
  };

  useEffect(() => {
    if (gdriveLinked) {
      fetchGdriveBackups();
    }
  }, [gdriveLinked]);

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
        fetchGdriveBackups(); // Refresh the list of backups
      } else {
        addToast(data.message || "Failed to upload backup.", "error");
      }
    } catch (e) {
      addToast("Failed to connect to server.", "error");
    } finally {
      setGdriveUploading(false);
    }
  };

  const handleUnlinkGDrive = async () => {
    const confirmUnlink = window.confirm(
      "Are you sure you want to unlink Google Drive? Automatic backups and Google Drive restores will be disabled."
    );
    if (!confirmUnlink) return;

    try {
      const res = await fetch("/api/company/backup/gdrive-unlink", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.success) {
        addToast("Google Drive unlinked successfully!", "success");
        setGdriveLinked(false);
        setGdriveBackups([]);
        setLastBackupTime("");
      } else {
        addToast(data.message || "Failed to unlink Google Drive", "error");
      }
    } catch (e) {
      addToast("Failed to connect to server.", "error");
    }
  };

  const handleRestore = async (fileId?: string, password?: string) => {
    if (!password) return;
    setRestoring(true);
    setRestoreProgress(0);

    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        const percentComplete = Math.round((event.loaded / event.total) * 100);
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

    if (fileId) {
      setRestoreProgress(50);
      xhr.open("POST", `/api/company/restore?fileId=${fileId}&password=${encodeURIComponent(password)}`);
      xhr.send();
    } else {
      if (!selectedFile) return;
      const formData = new FormData();
      formData.append("file", selectedFile);
      xhr.open("POST", `/api/company/restore?password=${encodeURIComponent(password)}`);
      xhr.send(formData);
    }
  };

  useEffect(() => {
    const fetchCompanyData = async () => {
      if (!session) return;
      try {
        const res = await fetch(`/api/company?orgcode=${session.orgcode}`);
        const data = await res.json();
        if (res.ok && data.success && data.company) {
          setBackupSchedule(data.company.backup_schedule || "none");
          setGdriveLinked(!!data.company.gdrive_linked);
          setLastBackupTime(data.company.last_backup_time || "");
          setHasGdriveConfig(!!data.company.has_gdrive_config);
        }
      } catch (e) {
        console.error("Failed to load company data for backup page");
      }
    };
    fetchCompanyData();
  }, [session]);

  const handleUpdateSchedule = async (schedule: string) => {
    if (!session) return;
    setSavingSchedule(true);
    try {
      const getRes = await fetch(`/api/company?orgcode=${session.orgcode}`);
      const getData = await getRes.json();
      if (!getRes.ok || !getData.success || !getData.company) {
        addToast("Failed to fetch current settings", "error");
        return;
      }
      const c = getData.company;

      const response = await fetch("/api/company", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgcode: session.orgcode,
          orgname: c.orgname,
          enableotp: c.enableotp,
          isactive: c.isactive,
          otpresettime: c.otpresettime,
          opentime: c.opentime ? c.opentime.substring(0, 5) : "09:00",
          closetime: c.closetime ? c.closetime.substring(0, 5) : "18:00",
          audit_retention_days: c.audit_retention_days,
          backup_schedule: schedule,
          enable_security_logs: c.enable_security_logs,
          enable_ai_assistant: c.enable_ai_assistant,
        }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setBackupSchedule(schedule);
        addToast("Auto backup schedule updated successfully", "success");
      } else {
        addToast(data.message || "Failed to update schedule", "error");
      }
    } catch (e) {
      addToast("Failed to connect to server", "error");
    } finally {
      setSavingSchedule(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in relative max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Backup & Restore settings</h2>
      <p className="text-slate-500 text-sm mt-1 mb-4">Export ledger database locally or link Google Drive for automatic scheduled cloud backups.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column: Local Backup and Restore */}
        <div className="bg-white/80 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm backdrop-blur-xl flex flex-col gap-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-700 pb-3">Local Backup & Restore</h3>
          
          <div>
            <div className="font-semibold text-slate-900 dark:text-slate-100 text-sm">Backup Company Data</div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-3">
              Export all data related to this company—including settings, user accounts, slips, items, and payment logs—to a ZIP file.
            </p>
            <button
              onClick={handleBackup}
              className="py-2.5 px-4 rounded-xl text-white font-medium bg-emerald-600 hover:bg-emerald-700 transition-all shadow-[0_4px_10px_rgba(16,185,129,0.2)] text-sm"
            >
              Export Backup (.zip)
            </button>
          </div>

          <div className="border-t border-slate-200 dark:border-slate-700 pt-5">
            <div className="font-semibold text-slate-900 dark:text-slate-100 text-sm">Restore Company Data</div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-4 text-amber-600 dark:text-amber-500 font-medium">
              Warning: Restoring data will overwrite all current settings, users, slips, items, and payments for this company. This action cannot be undone.
            </p>
            
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
                onClick={() => {
                  if (!selectedFile) return;
                  setRestoreFileId(undefined);
                  setRestorePassword("");
                  setShowRestoreModal(true);
                }}
                disabled={!selectedFile || restoring}
                className="py-2.5 px-4 rounded-xl text-white font-medium bg-rose-600 hover:bg-rose-700 disabled:opacity-50 transition-all shadow-[0_4px_10px_rgba(225,29,72,0.2)] text-sm self-start"
              >
                {restoring && !restoreProgress ? "Restoring Data..." : "Restore Backup (.zip)"}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Google Drive Backup */}
        <div className="bg-white/80 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm backdrop-blur-xl flex flex-col gap-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-700 pb-3">Google Drive Backup Settings</h3>
          
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="font-semibold text-slate-900 dark:text-slate-100 text-sm">Status:</span>
              {gdriveLinked ? (
                <span className="text-sm font-semibold text-green-600 dark:text-green-400 bg-green-500/10 px-2.5 py-0.5 rounded-full">🟢 Linked</span>
              ) : (
                <span className="text-sm font-semibold text-red-600 dark:text-red-400 bg-red-500/10 px-2.5 py-0.5 rounded-full">🔴 Not Linked</span>
              )}
              {!hasGdriveConfig && (
                <span className="text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full ml-2">⚠️ Server Credentials Missing</span>
              )}
            </div>
            {lastBackupTime && (
              <p className="text-xs text-slate-500 mb-3">Last upload: {new Date(lastBackupTime).toLocaleString()}</p>
            )}
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-4">
              Grant permission to upload backup files to your Google Drive folder. Backups will be organized under the folder <code className="bg-slate-100 dark:bg-slate-900 px-1 py-0.5 rounded font-mono">MeriParchi</code>.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-3 mb-5">
              {!gdriveLinked ? (
                <button
                  onClick={handleLinkGDrive}
                  disabled={!hasGdriveConfig}
                  className="py-2.5 px-4 rounded-xl text-white font-medium bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-all text-sm shadow-md shadow-blue-500/20"
                >
                  Link Google Drive
                </button>
              ) : (
                <>
                  <button
                    onClick={handleManualGDriveBackup}
                    disabled={gdriveUploading}
                    className="py-2.5 px-4 rounded-xl text-white font-medium bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition-all text-sm shadow-md shadow-emerald-500/20"
                  >
                    {gdriveUploading ? "Uploading Backup..." : "Upload Backup to Drive"}
                  </button>
                  <button
                    onClick={handleUnlinkGDrive}
                    className="py-2.5 px-4 rounded-xl text-white font-medium bg-rose-600 hover:bg-rose-700 transition-all text-sm"
                  >
                    Unlink Google Drive
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="border-t border-slate-200 dark:border-slate-700 pt-5 flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Auto Backup Schedule</label>
            <select
              disabled={savingSchedule}
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900/50 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer disabled:opacity-50"
              value={backupSchedule}
              onChange={(e) => handleUpdateSchedule(e.target.value)}
            >
              <option value="none">Disabled (No Auto Backup)</option>
              <option value="daily">Daily Backup</option>
              <option value="weekly">Weekly Backup</option>
              <option value="monthly">Monthly Backup</option>
            </select>
            <p className="text-xs text-slate-500 mt-1">Automatically push backup ZIP files to the linked Google Drive folder on schedule.</p>
          </div>
        </div>
      </div>

      {/* Google Drive Backups List section */}
      {gdriveLinked && (
        <div className="bg-white/80 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm backdrop-blur-xl mt-6">
          <div className="font-semibold text-slate-900 dark:text-slate-100 mb-1 text-base">Restore from Google Drive</div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            Select a backup file stored in your Google Drive's <code className="bg-slate-100 dark:bg-slate-900 px-1 py-0.5 rounded font-mono">MeriParchi</code> folder to restore.
          </p>

          {loadingGdriveBackups ? (
            <div className="text-xs text-slate-550 dark:text-slate-400 py-3">Loading backups list...</div>
          ) : gdriveBackups.length === 0 ? (
            <div className="text-xs text-slate-550 dark:text-slate-400 py-3 bg-slate-50 dark:bg-slate-900/30 rounded-xl px-4 border border-slate-200/50 dark:border-slate-800">
              No backups found in Google Drive folder "MeriParchi".
            </div>
          ) : (
            <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden text-xs max-h-60 overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-700">
                    <th className="px-4 py-2.5">Filename</th>
                    <th className="px-4 py-2.5">Date Created</th>
                    <th className="px-4 py-2.5">Size</th>
                    <th className="px-4 py-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {gdriveBackups.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-slate-200 truncate max-w-[280px]" title={b.name}>
                        {b.name}
                      </td>
                      <td className="px-4 py-2.5 text-slate-550 dark:text-slate-400 whitespace-nowrap">
                        {new Date(b.createdTime).toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 text-slate-550 dark:text-slate-400 font-mono">
                        {b.size ? `${(parseInt(b.size) / 1024).toFixed(1)} KB` : "Unknown"}
                      </td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        <button
                          onClick={() => {
                            setRestoreFileId(b.id);
                            setRestorePassword("");
                            setShowRestoreModal(true);
                          }}
                          disabled={restoring}
                          className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold rounded-lg transition-colors disabled:opacity-50"
                        >
                          Restore
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Restore Confirmation Password Modal */}
      {showRestoreModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 max-w-md w-full space-y-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Restore Database Backup</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Warning: This will permanently delete and overwrite all current slips, items, users, and payments for this company. This action cannot be undone.
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-650 dark:text-slate-350">Enter Admin Password to Proceed</label>
              <input
                type="password"
                placeholder="••••••••"
                value={restorePassword}
                onChange={(e) => setRestorePassword(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-rose-500 text-slate-800 dark:text-slate-200 outline-none"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={restoring}
                onClick={() => setShowRestoreModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={restoring || !restorePassword}
                onClick={() => {
                  setShowRestoreModal(false);
                  handleRestore(restoreFileId, restorePassword);
                }}
                className="px-5 py-2.5 text-xs font-bold bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl transition-colors shadow-md shadow-rose-500/20"
              >
                Confirm & Restore
              </button>
            </div>
          </div>
        </div>
      )}

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
