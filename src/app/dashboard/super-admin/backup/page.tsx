"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";

interface Toast {
  id: number;
  message: string;
  type: "success" | "error" | "info";
}

export default function SuperAdminBackupPage() {
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
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [loadingMoreBackups, setLoadingMoreBackups] = useState(false);
  const [backupRetentionCount, setBackupRetentionCount] = useState<number>(5);
  const [savingRetention, setSavingRetention] = useState(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const BACKUPS_PER_PAGE = 5;
  const [backupPassword, setBackupPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [showBackupPassword, setShowBackupPassword] = useState(false);

  const [backupTimer, setBackupTimer] = useState<number>(0);
  const [restoreTimer, setRestoreTimer] = useState<number>(0);
  const [restoreTimeRemaining, setRestoreTimeRemaining] = useState<number | null>(null);
  const [restoreSpeed, setRestoreSpeed] = useState<number | null>(null);

  useEffect(() => {
    let interval: any;
    if (gdriveUploading) {
      setBackupTimer(0);
      interval = setInterval(() => {
        setBackupTimer(t => t + 1);
      }, 1000);
    } else {
      setBackupTimer(0);
    }
    return () => clearInterval(interval);
  }, [gdriveUploading]);

  useEffect(() => {
    let interval: any;
    if (restoring) {
      setRestoreTimer(0);
      interval = setInterval(() => {
        setRestoreTimer(t => t + 1);
      }, 1000);
    } else {
      setRestoreTimer(0);
      setRestoreTimeRemaining(null);
      setRestoreSpeed(null);
    }
    return () => clearInterval(interval);
  }, [restoring]);

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
    // Prefix with superadmin_ to indicate redirect destination
    window.location.href = `/api/company/backup/gdrive-auth?orgcode=superadmin_${session.orgcode}`;
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
        addToast("Super Admin System Backup uploaded to Google Drive successfully!", "success");
        setLastBackupTime(new Date().toISOString());
        fetchGdriveBackups();
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
    setRestoring(true);
    setRestoreProgress(0);

    const xhr = new XMLHttpRequest();

    const startTime = Date.now();
    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        const percentComplete = Math.round((event.loaded / event.total) * 100);
        setRestoreProgress(Math.min(percentComplete, 99));

        const elapsed = (Date.now() - startTime) / 1000;
        if (elapsed > 0.5 && event.loaded > 0) {
          const speed = event.loaded / elapsed; // bytes/sec
          const remainingBytes = event.total - event.loaded;
          const remainingSecs = Math.max(0, Math.round(remainingBytes / speed));
          setRestoreTimeRemaining(remainingSecs);
          setRestoreSpeed(Math.round(speed / 1024)); // KB/s
        }
      }
    });

    xhr.addEventListener("load", () => {
      setRestoreProgress(100);
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300 && data.success) {
          addToast("Entire database restored successfully! Reloading...", "success");
          setTimeout(() => {
            window.location.reload();
          }, 2500);
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
      let url = `/api/company/restore?fileId=${fileId}&password=${encodeURIComponent(password || "")}`;
      xhr.open("POST", url);
      xhr.send();
    } else {
      if (!selectedFile) return;
      const formData = new FormData();
      formData.append("file", selectedFile);
      let url = `/api/company/restore?password=${encodeURIComponent(password || "")}`;
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
          if (data.company.backup_password !== undefined) {
            setBackupPassword(data.company.backup_password || "");
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
          backup_password: c.backup_password || "",
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
          backup_password: c.backup_password || "",
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

  const handleUpdateBackupPassword = async (pwd: string) => {
    if (!session) return;
    setSavingPassword(true);
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
          backup_retention_count: c.backup_retention_count || 5,
          backup_password: pwd,
        }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setBackupPassword(pwd);
        addToast("Backup encryption password updated successfully", "success");
      } else {
        addToast(data.message || "Failed to update backup password", "error");
      }
    } catch (e) {
      addToast("Failed to connect to server", "error");
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in relative max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Super Admin Backup & Restore</h2>
      <p className="text-slate-500 text-sm mt-1 mb-4">
        Perform a full system-wide database backup or restore all tables. Google Drive integration saves files under the target folder <code className="bg-slate-100 dark:bg-slate-900 px-1 py-0.5 rounded font-mono font-bold">parchiadmin</code>.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column: Local Backup and Restore */}
        <div className="bg-white/80 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm backdrop-blur-xl flex flex-col gap-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-700 pb-3">Local System Backup & Restore</h3>
          
          <div>
            <div className="font-semibold text-slate-900 dark:text-slate-100 text-sm">Full System Backup</div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-3">
              Export all tables and data—including system configs, pricing plans, client profiles, users, slips, payments, coupons, and global logs—to a ZIP file.
            </p>
            <button
              onClick={handleBackup}
              className="py-2.5 px-4 rounded-xl text-white font-medium bg-emerald-600 hover:bg-emerald-700 transition-all shadow-[0_4px_10px_rgba(16,185,129,0.2)] text-sm"
            >
              Export System Backup (.zip)
            </button>
          </div>

          <div className="border-t border-slate-200 dark:border-slate-700 pt-5">
            <div className="font-semibold text-slate-900 dark:text-slate-100 text-sm">Full System Restore</div>
            <p className="text-xs text-rose-600 dark:text-rose-450 mt-1 mb-4 font-semibold">
              ⚠️ CRITICAL WARNING: Restoring will completely clear ALL tables in the database and import the new data. Current users, transactions, logs, pricing plans, and client profiles will be lost permanently.
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
                <div className="w-full flex flex-col gap-1.5 mt-2">
                  <div className="w-full bg-slate-100 dark:bg-slate-900 rounded-full h-4 relative overflow-hidden border border-slate-200 dark:border-slate-800">
                    <div 
                      className="bg-blue-600 h-full rounded-full transition-all duration-300 ease-out" 
                      style={{ width: `${restoreProgress}%` }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-slate-700 dark:text-slate-350">
                      {restoreProgress === 99 ? "Performing truncation & system rebuild..." : `${restoreProgress}%`}
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-slate-500 font-semibold px-1 font-mono">
                    <span>Elapsed: {restoreTimer}s</span>
                    {restoreSpeed !== null && <span>Speed: {restoreSpeed} KB/s</span>}
                    {restoreTimeRemaining !== null && (
                      <span>Est. Remaining: {restoreTimeRemaining}s</span>
                    )}
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
                {restoring && !restoreProgress ? "Rebuilding System..." : "Restore System Backup (.zip)"}
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
              Authorize connection to upload complete system backups to Google Drive. Backups will be stored inside the folder <code className="bg-slate-100 dark:bg-slate-900 px-1 py-0.5 rounded font-mono">parchiadmin</code>.
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
                    {gdriveUploading ? `Uploading Backup... (${backupTimer}s elapsed)` : "Upload System Backup to Drive"}
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
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Backup Retention Limit</label>
                <input
                  type="number"
                  min="1"
                  disabled={savingRetention}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900/50 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500 transition-all disabled:opacity-50"
                  value={backupRetentionCount}
                  onChange={(e) => handleUpdateRetention(parseInt(e.target.value) || 5)}
                />
                <p className="text-xs text-slate-500 mt-1">Maximum number of system backups to retain in Google Drive.</p>
              </div>

              <div className="flex flex-col gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Backup Encryption Password</label>
                <div className="relative">
                  <input
                    type={showBackupPassword ? "text" : "password"}
                    disabled={savingPassword}
                    placeholder="Optional (Password-protect backups)"
                    className="w-full pl-4 pr-10 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900/50 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500 transition-all disabled:opacity-50"
                    value={backupPassword}
                    onChange={(e) => setBackupPassword(e.target.value)}
                    onBlur={(e) => handleUpdateBackupPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowBackupPassword(!showBackupPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 focus:outline-none"
                  >
                    {showBackupPassword ? (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  <span className="font-semibold text-emerald-600 dark:text-emerald-500">Recommended:</span> Leave empty for simple restores. If set, backups will be password-protected.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Google Drive Backups List section */}
      {gdriveLinked && (
        <div className="bg-white/80 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm backdrop-blur-xl mt-6">
          <div className="font-semibold text-slate-900 dark:text-slate-100 mb-1 text-base">Restore from Google Drive</div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            Select a backup file stored in your Google Drive's <code className="bg-slate-100 dark:bg-slate-900 px-1 py-0.5 rounded font-mono">parchiadmin</code> folder to restore the system.
          </p>
          {loadingGdriveBackups ? (
            <div className="text-xs text-slate-550 dark:text-slate-400 py-3">Loading backups list...</div>
          ) : gdriveBackups.length === 0 ? (
            <div className="text-xs text-slate-550 dark:text-slate-400 py-3 bg-slate-50 dark:bg-slate-900/30 rounded-xl px-4 border border-slate-200/50 dark:border-slate-800">
              No backups found in Google Drive folder "parchiadmin".
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
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Confirm System Restore</h3>
              <p className="text-xs text-rose-600 dark:text-rose-450 mt-2 leading-relaxed font-semibold">
                ⚠️ WARNING: This will perform a FULL SYSTEM RESTORE. All current database records will be deleted and replaced. This action cannot be undone.
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-650 dark:text-slate-350">Enter Super Admin Password to Proceed</label>
              <input
                type="password"
                placeholder="••••••••"
                value={restorePassword}
                onChange={(e) => setRestorePassword(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-rose-500 text-slate-800 dark:text-slate-200 outline-none"
                required
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
                Restore
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
