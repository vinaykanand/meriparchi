"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";

interface User {
  userid: string;
  isadmin: boolean;
  isactive: boolean;
  otp: string | null;
  created_at: string;
}

interface Toast {
  id: number;
  message: string;
  type: "success" | "error" | "info";
}

export default function AdminUsersPage() {
  const { session } = useAuth();

  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [newUserId, setNewUserId] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserIsAdmin, setNewUserIsAdmin] = useState(false);
  const [newUserIsActive, setNewUserIsActive] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [resettingOtp, setResettingOtp] = useState(false);

  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (message: string, type: "success" | "error" | "info") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  };

  const fetchUsers = async () => {
    if (!session) return;
    setLoadingUsers(true);
    try {
      const response = await fetch(`/api/users?orgcode=${session.orgcode}`);
      const data = await response.json();
      if (response.ok && data.success) {
        setUsers(data.users || []);
      }
    } catch (error) {
      addToast("Failed to fetch users", "error");
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [session]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    if (!newUserId.trim() || (!isEditMode && !newUserPassword.trim())) {
      addToast("User ID and Password are required", "error");
      return;
    }

    try {
      const response = await fetch("/api/users", {
        method: isEditMode ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgcode: session.orgcode,
          userid: newUserId.trim(),
          password: newUserPassword.trim() || undefined,
          isadmin: newUserIsAdmin,
          isactive: newUserIsActive,
        }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        addToast(isEditMode ? "User updated" : "User created", "success");
        setNewUserId("");
        setNewUserPassword("");
        setNewUserIsAdmin(false);
        setNewUserIsActive(true);
        setIsEditMode(false);
        fetchUsers();
      } else {
        addToast(data.message || "Operation failed", "error");
      }
    } catch (error) {
      addToast("Failed to process user", "error");
    }
  };

  const handleEditUser = (user: User) => {
    setNewUserId(user.userid);
    setNewUserPassword(""); // Empty means no change
    setNewUserIsAdmin(user.isadmin);
    setNewUserIsActive(user.isactive);
    setIsEditMode(true);
  };

  const handleCancelEdit = () => {
    setNewUserId("");
    setNewUserPassword("");
    setNewUserIsAdmin(false);
    setNewUserIsActive(true);
    setIsEditMode(false);
  };

  const handleDeleteUser = async (user: User) => {
    if (!session) return;
    if (!confirm(`Are you sure you want to permanently delete user '${user.userid}'?`)) return;

    try {
      const response = await fetch("/api/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgcode: session.orgcode,
          userid: user.userid,
        }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        addToast("User deleted successfully", "success");
        if (newUserId === user.userid) {
          handleCancelEdit();
        }
        fetchUsers();
      } else {
        addToast(data.message || "Failed to delete user", "error");
      }
    } catch (error) {
      addToast("Failed to process deletion", "error");
    }
  };

  const toggleUserSelection = (userid: string) => {
    setSelectedUsers(prev => 
      prev.includes(userid) 
        ? prev.filter(id => id !== userid)
        : [...prev, userid]
    );
  };

  const handleResetAllOtps = async () => {
    if (!session) return;
    if (!confirm("Are you sure you want to reset OTPs for ALL users? This will forcefully log everyone out.")) return;
    setResettingOtp(true);
    try {
      const response = await fetch("/api/users-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgcode: session.orgcode, resetAll: true }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        addToast(`Successfully reset ${data.updatedCount} OTPs`, "success");
        fetchUsers();
      } else {
        addToast(data.message || "Failed to reset OTPs", "error");
      }
    } catch (error) {
      addToast("Failed to connect to server", "error");
    } finally {
      setResettingOtp(false);
    }
  };

  const handleResetSelectedOtps = async () => {
    if (!session || selectedUsers.length === 0) return;
    if (!confirm(`Are you sure you want to reset OTPs for ${selectedUsers.length} selected user(s)?`)) return;
    setResettingOtp(true);
    try {
      const response = await fetch("/api/users-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgcode: session.orgcode, userids: selectedUsers }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        addToast(`Successfully reset ${data.updatedCount} OTPs`, "success");
        setSelectedUsers([]);
        fetchUsers();
      } else {
        addToast(data.message || "Failed to reset OTPs", "error");
      }
    } catch (error) {
      addToast("Failed to connect to server", "error");
    } finally {
      setResettingOtp(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-[fadeIn_0.4s_ease-out_forwards] relative">
      <div>
        <h2 className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">Tenant User Profiles</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">List registered operator profiles or create new dashboard sessions.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-6 items-start">
        {/* Users List */}
        <div className="bg-white/80 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm backdrop-blur-xl">
          <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-700 pb-3 mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Organization Operators</h3>
            <div className="flex gap-2">
              <button 
                onClick={handleResetAllOtps}
                disabled={resettingOtp || users.length === 0}
                className="px-3 py-1.5 text-sm font-medium rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Reset All OTPs
              </button>
              <button 
                onClick={handleResetSelectedOtps}
                disabled={selectedUsers.length === 0 || resettingOtp}
                className="px-3 py-1.5 text-sm font-medium rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {resettingOtp ? "Resetting..." : `Reset Selected (${selectedUsers.length})`}
              </button>
            </div>
          </div>
          
          {loadingUsers ? (
            <div className="flex flex-col items-center justify-center p-10 gap-3 text-gray-500">
              <div className="w-7 h-7 border-4 border-gray-200 dark:border-gray-800 border-t-blue-500 rounded-full animate-spin"></div>
              <p>Loading operators...</p>
            </div>
          ) : (
            <div className="w-full overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-black/20">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-gray-50/50 dark:bg-white/5 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider font-medium">
                  <tr>
                    <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 w-10"></th>
                    <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">User ID</th>
                    <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">Role</th>
                    <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">Status</th>
                    <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">OTP</th>
                    <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">Created At</th>
                    <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {users.map((user) => {
                    const isAdminUser = user.userid === 'admin';
                    const isSelected = selectedUsers.includes(user.userid);
                    return (
                    <tr 
                      key={user.userid}
                      className={`transition-colors ${isAdminUser ? 'opacity-70 cursor-not-allowed bg-gray-50 dark:bg-white/5' : 'hover:bg-blue-500/5 dark:hover:bg-white/5 cursor-pointer'}`}
                    >
                      <td className="px-4 py-3">
                        <input 
                          type="checkbox"
                          disabled={isAdminUser || user.isadmin}
                          checked={isSelected}
                          onChange={() => toggleUserSelection(user.userid)}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                        />
                      </td>
                      <td className="px-4 py-3 font-semibold text-gray-900 dark:text-gray-100" onClick={() => !isAdminUser && handleEditUser(user)}>
                        {user.userid} {isAdminUser && <span title="Protected Account" className="ml-1.5">🔒</span>}
                      </td>
                      <td className="px-4 py-3" onClick={() => !isAdminUser && handleEditUser(user)}>
                        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide ${user.isadmin ? 'bg-red-500/10 text-red-600 dark:text-red-400' : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'}`}>
                          {user.isadmin ? "Admin" : "Operator"}
                        </span>
                      </td>
                      <td className="px-4 py-3" onClick={() => !isAdminUser && handleEditUser(user)}>
                        <span className={`font-medium ${user.isactive ? 'text-green-500' : 'text-gray-500'}`}>
                          {user.isactive ? "Active" : "Disabled"}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-gray-700 dark:text-gray-300" onClick={() => !isAdminUser && handleEditUser(user)}>
                        {user.otp ? user.otp : '-'}
                      </td>
                      <td className="px-4 py-3 font-mono text-gray-500 dark:text-gray-400 text-xs" onClick={() => !isAdminUser && handleEditUser(user)}>
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        {isAdminUser ? (
                          <span className="text-gray-500 italic text-xs">Locked</span>
                        ) : (
                          <div className="flex gap-3">
                            <button onClick={() => handleEditUser(user)} className="text-blue-600 dark:text-blue-400 font-medium text-sm hover:underline">✏️ Edit</button>
                            <button onClick={() => handleDeleteUser(user)} className="text-red-600 dark:text-red-400 font-medium text-sm hover:underline">🗑️ Delete</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )})}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-6 text-gray-500">
                        No registered user accounts found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Add User Form */}
        <div className="bg-white/80 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm backdrop-blur-xl">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700 pb-3 mb-5">
            {isEditMode ? "Edit User Account" : "Provision User Account"}
          </h3>
          <form onSubmit={handleCreateUser} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide ml-0.5">Username / Operator ID*</label>
              <input 
                type="text" 
                placeholder="e.g. operator1" 
                value={newUserId} 
                onChange={(e) => setNewUserId(e.target.value)} 
                disabled={isEditMode} 
                className="bg-white dark:bg-slate-900/50 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 px-3.5 py-3 rounded-xl text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide ml-0.5">{isEditMode ? "New Password (Required)*" : "Account Password*"}</label>
              <input 
                type="password" 
                placeholder="••••••••" 
                value={newUserPassword} 
                onChange={(e) => setNewUserPassword(e.target.value)} 
                className="bg-white dark:bg-slate-900/50 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 px-3.5 py-3 rounded-xl text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center gap-2.5 mt-1">
              <input 
                type="checkbox" 
                id="isAdminCheck" 
                checked={newUserIsAdmin} 
                onChange={(e) => setNewUserIsAdmin(e.target.checked)} 
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <label htmlFor="isAdminCheck" className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer select-none">Grant Administrator Access Rights</label>
            </div>

            {isEditMode && (
              <div className="flex items-center gap-2.5">
                <input 
                  type="checkbox" 
                  id="isActiveCheck" 
                  checked={newUserIsActive} 
                  onChange={(e) => setNewUserIsActive(e.target.checked)} 
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <label htmlFor="isActiveCheck" className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer select-none">Account is Active</label>
              </div>
            )}

            <div className="flex gap-3 mt-4">
              <button 
                type="submit" 
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-xl shadow-[0_4px_10px_rgba(37,99,235,0.2)] transition-all hover:-translate-y-0.5 active:translate-y-px"
              >
                {isEditMode ? "Update Account" : "Register Operator"}
              </button>
              {isEditMode && (
                <button 
                  type="button" 
                  onClick={handleCancelEdit}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-900 dark:text-white font-medium py-3 px-4 rounded-xl transition-all"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
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
