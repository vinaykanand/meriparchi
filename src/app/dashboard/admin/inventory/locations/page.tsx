"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { PlusIcon, PencilSquareIcon, MagnifyingGlassIcon, XMarkIcon, TrashIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";

interface Location {
  id: number;
  name: string;
}

export default function LocationsPage() {
  const { session } = useAuth();

  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [newLocationName, setNewLocationName] = useState("");
  const [locationSubmitting, setLocationSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Edit states
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [editLocationName, setEditLocationName] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Delete states
  const [deleteTarget, setDeleteTarget] = useState<Location | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteBlockedMsg, setDeleteBlockedMsg] = useState("");

  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    if (session?.orgcode) {
      fetchLocations();
    }
  }, [session]);

  const fetchLocations = async () => {
    setLoading(true);
    if (!session?.orgcode) return;
    try {
      const res = await fetch(`/api/inventory/locations?orgcode=${session.orgcode}`);
      const data = await res.json();
      if (data.success) {
        setLocations(data.locations);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLocationName.trim() || !session?.orgcode) return;
    try {
      setLocationSubmitting(true);
      setErrorMsg("");
      setSuccessMsg("");
      const res = await fetch("/api/inventory/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgcode: session.orgcode, name: newLocationName.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`Location "${newLocationName}" created successfully!`);
        setNewLocationName("");
        fetchLocations();
      } else {
        setErrorMsg(data.message || "Failed to create location");
      }
    } catch (e) {
      setErrorMsg("Error creating location");
    } finally {
      setLocationSubmitting(false);
    }
  };

  const handleUpdateLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLocation || !editLocationName.trim() || !session?.orgcode) return;
    try {
      setEditSubmitting(true);
      setErrorMsg("");
      setSuccessMsg("");
      const res = await fetch("/api/inventory/locations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgcode: session.orgcode,
          id: editingLocation.id,
          name: editLocationName.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`Location updated to "${editLocationName}" successfully!`);
        setEditingLocation(null);
        setEditLocationName("");
        fetchLocations();
      } else {
        setErrorMsg(data.message || "Failed to update location");
      }
    } catch (e) {
      setErrorMsg("Error updating location");
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDeleteLocation = async () => {
    if (!deleteTarget || !session?.orgcode) return;
    setDeleteSubmitting(true);
    try {
      const res = await fetch(
        `/api/inventory/locations?orgcode=${session.orgcode}&id=${deleteTarget.id}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`Location "${deleteTarget.name}" deleted successfully.`);
        setDeleteTarget(null);
        fetchLocations();
      } else {
        setDeleteTarget(null);
        setDeleteBlockedMsg(data.message || "Deletion failed.");
      }
    } catch (e) {
      setDeleteTarget(null);
      setDeleteBlockedMsg("An unexpected error occurred.");
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const startEdit = (loc: Location) => {
    setEditingLocation(loc);
    setEditLocationName(loc.name);
    setErrorMsg("");
    setSuccessMsg("");
  };

  const cancelEdit = () => {
    setEditingLocation(null);
    setEditLocationName("");
  };

  const filteredLocations = locations.filter((loc) =>
    loc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    loc.id.toString().includes(searchQuery)
  );

  return (
    <div className="flex flex-col gap-6 pb-12 text-slate-800 dark:text-slate-100 max-w-6xl mx-auto">
      <div>
        <h2 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-500 bg-clip-text text-transparent">
          Manage Warehouse Locations
        </h2>
        <p className="text-slate-500 text-sm mt-1 font-semibold">
          Define and edit physical locations for inventory storage.
        </p>
      </div>

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 dark:bg-rose-950/30 dark:border-rose-900/50 dark:text-rose-400 rounded-xl text-sm font-semibold">
          ⚠️ {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 dark:bg-emerald-950/30 dark:border-emerald-900/50 dark:text-emerald-400 rounded-xl text-sm font-semibold">
          ✅ {successMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Container: New or Edit */}
        <div className="lg:col-span-1">
          {editingLocation ? (
            <div className="bg-white dark:bg-slate-800/50 border border-amber-200 dark:border-amber-900/50 rounded-3xl p-6 shadow-sm sticky top-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold flex items-center gap-2 text-amber-600 dark:text-amber-400">
                  <PencilSquareIcon className="w-5 h-5" /> Edit Location
                </h3>
                <button
                  onClick={cancelEdit}
                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 transition-colors"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleUpdateLocation} className="flex flex-col gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Location ID
                  </label>
                  <input
                    type="text"
                    disabled
                    value={editingLocation.id}
                    className="w-full p-3 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-mono text-sm text-slate-400 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Location Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Warehouse A"
                    value={editLocationName}
                    onChange={(e) => setEditLocationName(e.target.value)}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold text-sm"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={editSubmitting || !editLocationName.trim()}
                    className="flex-1 p-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl transition-colors text-sm disabled:opacity-50"
                  >
                    {editSubmitting ? "Saving..." : "Save Changes"}
                  </button>
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-350 font-bold rounded-xl transition-colors text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 rounded-3xl p-6 shadow-sm sticky top-6">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <PlusIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" /> Create Location
              </h3>

              <form onSubmit={handleAddLocation} className="flex flex-col gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Location Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Warehouse 1"
                    value={newLocationName}
                    onChange={(e) => setNewLocationName(e.target.value)}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={locationSubmitting || !newLocationName.trim()}
                  className="w-full p-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors text-sm disabled:opacity-50"
                >
                  {locationSubmitting ? "Adding..." : "Add Location"}
                </button>
              </form>
            </div>
          )}
        </div>

        {/* List & Search View */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 rounded-3xl p-6 shadow-sm flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h3 className="text-lg font-bold">Location Registry</h3>
            <div className="relative w-full sm:w-72">
              <MagnifyingGlassIcon className="w-5 h-5 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="text"
                placeholder="Search locations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold text-sm"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-10 h-10 border-4 border-slate-200 dark:border-slate-800 border-t-blue-600 rounded-full animate-spin"></div>
              <p className="text-slate-400 text-sm">Loading locations...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800/60 text-slate-400 text-xs font-bold uppercase tracking-wider">
                    <th className="py-3 px-4">Location ID</th>
                    <th className="py-3 px-4">Name</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40">
                  {filteredLocations.map((loc) => (
                    <tr
                      key={loc.id}
                      className="hover:bg-slate-50/40 dark:hover:bg-slate-900/10 transition-colors"
                    >
                      <td className="py-3.5 px-4 text-sm font-mono text-slate-450">#{loc.id}</td>
                      <td className="py-3.5 px-4 text-sm font-bold">{loc.name}</td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex gap-2">
                          <button
                            onClick={() => startEdit(loc)}
                            className="p-1.5 hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-950/30 dark:hover:text-amber-400 rounded-lg text-slate-400 transition-colors inline-flex items-center gap-1.5 text-xs font-bold"
                          >
                            <PencilSquareIcon className="w-4 h-4" /> Edit
                          </button>
                          <button
                            onClick={() => setDeleteTarget(loc)}
                            className="p-1.5 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30 dark:hover:text-rose-400 rounded-lg text-slate-400 transition-colors inline-flex items-center gap-1.5 text-xs font-bold"
                          >
                            <TrashIcon className="w-4 h-4" /> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredLocations.length === 0 && (
                    <tr>
                      <td colSpan={3} className="text-slate-400 text-xs py-8 text-center">
                        No locations found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-md w-full p-6 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/40 flex items-center justify-center flex-shrink-0">
                <TrashIcon className="w-6 h-6 text-rose-600 dark:text-rose-400" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">Delete Location?</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">This action cannot be undone.</p>
              </div>
            </div>
            <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 rounded-2xl p-4">
              <p className="text-sm text-slate-700 dark:text-slate-300">
                You are about to permanently delete location{" "}
                <span className="font-black text-rose-700 dark:text-rose-400">&ldquo;{deleteTarget.name}&rdquo;</span>{" "}
                (ID: #{deleteTarget.id}).
              </p>
            </div>
            <div className="flex gap-3 pt-1">
              <button
                onClick={handleDeleteLocation}
                disabled={deleteSubmitting}
                className="flex-1 py-3 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl transition-colors text-sm disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {deleteSubmitting ? (
                  <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Deleting...</>
                ) : (
                  <><TrashIcon className="w-4 h-4" />Yes, Delete</>  
                )}
              </button>
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleteSubmitting}
                className="flex-1 py-3 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl transition-colors text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active Transaction Block Modal */}
      {deleteBlockedMsg && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800 rounded-3xl shadow-2xl max-w-md w-full p-6 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center flex-shrink-0">
                <ExclamationTriangleIcon className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">Deletion Blocked</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">Active transactions detected</p>
              </div>
            </div>
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 rounded-2xl p-4">
              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{deleteBlockedMsg}</p>
            </div>
            <button
              onClick={() => setDeleteBlockedMsg("")}
              className="w-full py-3 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl transition-colors text-sm"
            >
              Understood
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
