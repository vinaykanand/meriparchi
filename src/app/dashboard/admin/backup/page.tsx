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
  const [restoreType, setRestoreType] = useState<"full" | "partial">("full");
  const [restorePhone, setRestorePhone] = useState("");
  const [inspecting, setInspecting] = useState(false);
  const [inspectResult, setInspectResult] = useState<{ phone: string, name: string, address: string }[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [loadingMoreBackups, setLoadingMoreBackups] = useState(false);
  const [backupRetentionCount, setBackupRetentionCount] = useState<number>(5);
  const [savingRetention, setSavingRetention] = useState(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const BACKUPS_PER_PAGE = 5;


  const addToast = (message: string, type: "success" | "error" | "info") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  };

  const handleInspectBackup = async (fileId?: string) => {
    setInspecting(true);
    setInspectResult([]);
    try {
      if (fileId) {
        const res = await fetch(`/api/company/restore/inspect?fileId=${fileId}`, {
          method: "POST"
        });
        const data = await res.json();
        if (res.ok && data.success) {
          setInspectResult(data.customers || []);
        } else {
          console.error("Inspect failed:", data.message);
        }
      } else {
        if (!selectedFile) return;
        const formData = new FormData();
        formData.append("file", selectedFile);
        const res = await fetch("/api/company/restore/inspect", {
          method: "POST",
          body: formData
        });
        const data = await res.json();
        if (res.ok && data.success) {
          setInspectResult(data.customers || []);
        } else {
          console.error("Inspect failed:", data.message);
        }
      }
    } catch (e) {
      console.error("Inspect failed:", e);
    } finally {
      setInspecting(false);
    }
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
      const res = await fetch("/api/company/backup/gdrive-list?limit=100");
      const data = await res.json();
      if (res.ok && data.success) {
        setGdriveBackups(data.backups || []);
        setNextPageToken(data.nextPageToken || null);
        setCurrentPage(1);
      }
    } catch (e) {
      console.error("Failed to load Google Drive backups:", e);
    } finally {
      setLoadingGdriveBackups(false);
    }
  };

  const fetchMoreGdriveBackups = async () => {
    if (!nextPageToken || loadingMoreBackups) return;
    setLoadingMoreBackups(true);
    try {
      const res = await fetch(`/api/company/backup/gdrive-list?limit=100&pageToken=${nextPageToken}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setGdriveBackups((prev) => [...prev, ...(data.backups || [])]);
        setNextPageToken(data.nextPageToken || null);
      }
    } catch (e) {
      console.error("Failed to load more Google Drive backups:", e);
    } finally {
      setLoadingMoreBackups(false);
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
      let url = `/api/company/restore?fileId=${fileId}&password=${encodeURIComponent(password)}`;
      if (restoreType === "partial" && restorePhone.trim()) {
        url += `&phone=${encodeURIComponent(restorePhone.trim())}`;
      }
      xhr.open("POST", url);
      xhr.send();
    } else {
      if (!selectedFile) return;
      const formData = new FormData();
      formData.append("file", selectedFile);
      let url = `/api/company/restore?password=${encodeURIComponent(password)}`;
      if (restoreType === "partial" && restorePhone.trim()) {
        url += `&phone=${encodeURIComponent(restorePhone.trim())}`;
      }
      xhr.open("POST", url);
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
          if (data.company.backup_retention_count !== undefined) {
            setBackupRetentionCount(data.company.backup_retention_count);
          }
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
          backup_retention_count: backupRetentionCount,
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

  const handleUpdateRetention = async (retentionCount: number) => {
    if (!session) return;
    setSavingRetention(true);
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
          backup_schedule: c.backup_schedule || "none",
          enable_security_logs: c.enable_security_logs,
          enable_ai_assistant: c.enable_ai_assistant,
          backup_retention_count: retentionCount,
        }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setBackupRetentionCount(retentionCount);
        addToast("GDrive backup retention limit updated successfully", "success");
      } else {
        addToast(data.message || "Failed to update retention limit", "error");
      }
    } catch (e) {
      addToast("Failed to connect to server", "error");
    } finally {
      setSavingRetention(false);
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
                  setRestoreType("full");
                  setRestorePhone("");
                  setShowRestoreModal(true);
                  handleInspectBackup();
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
              <div className="border-t border-slate-200 dark:border-slate-700 pt-5 flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Auto Backup Schedule</label>
              <select
                disabled={savingSchedule}
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900/50 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer disabled:opacity-50"
                value={backupSchedule}
                onChange={(e) => handleUpdateSchedule(e.target.value)}
              >
                <option value="none">Disabled (No Auto Backup)</option>
                <option value="twice_daily">Twice a Day (12 hours)</option>
                <option value="daily">Daily Backup</option>
                <option value="weekly">Weekly Backup</option>
                <option value="monthly">Monthly Backup</option>
              </select>
              <p className="text-xs text-slate-500 mt-1">Automatically push backup ZIP files to the linked Google Drive folder on schedule.</p>
            </div>

            <div className="flex flex-col gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Google Drive Backup Retention Limit</label>
              <input
                type="number"
                min="1"
                disabled={savingRetention}
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900/50 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500 transition-all disabled:opacity-50"
                value={backupRetentionCount}
                onChange={(e) => handleUpdateRetention(parseInt(e.target.value) || 5)}
              />
              <p className="text-xs text-slate-500 mt-1">Maximum number of backups to keep on Google Drive. Older files are automatically deleted.</p>
            </div>
          </div>        </div>
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
            (() => {
              const totalPages = Math.ceil(gdriveBackups.length / BACKUPS_PER_PAGE);
              const effectiveCurrentPage = Math.min(currentPage, totalPages || 1);
              const displayedBackups = gdriveBackups.slice(
                (effectiveCurrentPage - 1) * BACKUPS_PER_PAGE,
                effectiveCurrentPage * BACKUPS_PER_PAGE
              );

              return (
                <>
                  <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden text-xs">
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
                        {displayedBackups.map((b) => (
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
                                  setRestoreType("full");
                                  setRestorePhone("");
                                  setShowRestoreModal(true);
                                  handleInspectBackup(b.id);
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

                  <div className="flex items-center justify-between mt-4 px-1 text-xs">
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={effectiveCurrentPage === 1}
                      className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold rounded-xl disabled:opacity-40 transition-colors"
                    >
                      Previous
                    </button>
                    <span className="text-slate-600 dark:text-slate-400 font-medium">
                      Page {effectiveCurrentPage} of {totalPages || 1}
                    </span>
                    <div className="flex gap-2">
                      {nextPageToken && effectiveCurrentPage === totalPages && (
                        <button
                          type="button"
                          onClick={fetchMoreGdriveBackups}
                          disabled={loadingMoreBackups}
                          className="px-3 py-1.5 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-450 font-semibold rounded-xl disabled:opacity-50 transition-colors"
                        >
                          {loadingMoreBackups ? "Loading..." : "Fetch More"}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={effectiveCurrentPage === totalPages}
                        className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold rounded-xl disabled:opacity-40 transition-colors"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </>
              );
            })()
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
                {restoreType === "full" 
                  ? "Warning: This will permanently delete and overwrite all current slips, items, users, and payments for this company. This action cannot be undone."
                  : "Restore only the history (slips and payments) of a specific phone number. Other data will remain untouched."}
              </p>
            </div>

            {/* Toggle Restore Type */}
            <div className="flex gap-2 p-1 bg-slate-150 dark:bg-slate-950 rounded-xl border border-slate-200/50 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setRestoreType("full")}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${restoreType === "full" ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                Full Restore
              </button>
              <button
                type="button"
                onClick={() => setRestoreType("partial")}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${restoreType === "partial" ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                Restore Selected Phone
              </button>
            </div>

            {restoreType === "partial" && (() => {
              const exactMatch = inspectResult.find(c => c.phone === restorePhone);
              const filteredResults = inspectResult.filter(c => 
                c.phone.includes(restorePhone) || 
                c.name.toLowerCase().includes(restorePhone.toLowerCase()) || 
                (c.address && c.address.toLowerCase().includes(restorePhone.toLowerCase()))
              );
              return (
                <div className="space-y-1 animate-fade-in relative">
                  <label className="text-xs font-semibold text-slate-650 dark:text-slate-350">Target Customer Phone Number</label>
                  <input
                    type="text"
                    placeholder="Type to search phone, name, or address..."
                    value={restorePhone}
                    onChange={(e) => setRestorePhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 text-slate-800 dark:text-slate-200 outline-none"
                  />
                  {exactMatch && (
                    <p className="text-[11px] text-green-600 dark:text-green-400 font-semibold mt-1">
                      ✓ Selected Customer: {exactMatch.name}
                    </p>
                  )}
                  {inspecting ? (
                    <p className="text-[10px] text-slate-400">Scanning backup contents...</p>
                  ) : (
                    <>
                      {restorePhone.trim() && !exactMatch && (
                        <div className="absolute left-0 right-0 z-50 max-h-48 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg mt-1 divide-y divide-slate-100 dark:divide-slate-800">
                          {filteredResults.length === 0 ? (
                            <div className="p-3 text-xs text-slate-400 text-center">No matching customer found in backup</div>
                          ) : (
                            filteredResults.map((c) => (
                              <button
                                key={c.phone}
                                type="button"
                                onClick={() => setRestorePhone(c.phone)}
                                className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 flex flex-col gap-1 transition-colors"
                              >
                                <div className="font-semibold text-sm text-slate-800 dark:text-slate-200">{c.name || "Unknown Customer"}</div>
                                <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center flex-wrap gap-x-3 gap-y-1">
                                  <span className="flex items-center gap-1">
                                    <svg className="w-3.5 h-3.5 text-rose-500 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                                      <path d="M20 15.5c-1.2 0-2.4-.2-3.6-.6-.3-.1-.7 0-1 .2l-2.2 2.2c-2.8-1.4-5.1-3.8-6.6-6.6l2.2-2.2c.3-.3.4-.7.2-1-.3-1.1-.5-2.3-.5-3.5 0-.6-.4-1-1-1H4c-.6 0-1 .4-1 1 0 9.4 7.6 17 17 17 .6 0 1-.4 1-1v-3.5c0-.6-.4-1-1-1z" />
                                    </svg>
                                    {c.phone}
                                  </span>
                                  {c.address && (
                                    <span className="flex items-center gap-1">
                                      <svg className="w-3.5 h-3.5 text-rose-500 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M12 2C8.1 2 5 5.1 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.9-3.1-7-7-7zm0 9.5c-1.4 0-2.5-1.1-2.5-2.5s1.1-2.5 2.5-2.5 2.5 1.1 2.5 2.5-1.1 2.5-2.5 2.5z" />
                                      </svg>
                                      {c.address}
                                    </span>
                                  )}
                                </div>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })()}

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
                disabled={restoring || !restorePassword || (restoreType === "partial" && !restorePhone.trim())}
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
