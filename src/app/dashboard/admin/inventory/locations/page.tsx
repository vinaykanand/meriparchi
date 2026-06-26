"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { PlusIcon, PencilSquareIcon, MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/24/outline";

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
                        <button
                          onClick={() => startEdit(loc)}
                          className="p-1.5 hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-950/30 dark:hover:text-amber-400 rounded-lg text-slate-400 transition-colors inline-flex items-center gap-1.5 text-xs font-bold"
                        >
                          <PencilSquareIcon className="w-4 h-4" /> Edit
                        </button>
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
    </div>
  );
}
