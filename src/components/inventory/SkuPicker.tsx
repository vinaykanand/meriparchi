"use client";

import React, { useState, useEffect, useCallback } from "react";
import { MagnifyingGlassIcon, XMarkIcon, CubeIcon, MapPinIcon } from "@heroicons/react/24/outline";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface SkuItem {
  id: number;
  sku: string | number;
  name: string;
  description?: string;
}

export interface StockBalance {
  sku: string | number;
  location_id: string | number;
  current_qty: number;
}

interface SkuPickerPopupProps {
  /** Whether the popup is open */
  open: boolean;
  /** Called when user closes popup */
  onClose: () => void;
  /** Called when user selects a SKU */
  onSelect: (item: SkuItem) => void;
  /** All available items to show */
  items: SkuItem[];
  /** Stock balances — optional; if provided, shows stock-in-hand beside each SKU */
  stockBalances?: StockBalance[];
  /** If set, filter stock to this location ID */
  fromLocationId?: string | number | null;
  /** Location name shown in popup subtitle */
  fromLocationName?: string;
  /** If OUTWARD, disables zero-stock items */
  isOutward?: boolean;
  /** Title of the popup (default: "Browse SKUs") */
  title?: string;
}

// ─────────────────────────────────────────────
// Helper
// ─────────────────────────────────────────────

function getStock(
  sku: string | number,
  stockBalances: StockBalance[],
  fromLocationId?: string | number | null
): number | null {
  if (!stockBalances || stockBalances.length === 0) return null;

  if (fromLocationId) {
    const match = stockBalances.find(
      (s) =>
        String(s.sku) === String(sku) &&
        String(s.location_id) === String(fromLocationId)
    );
    return match ? Number(match.current_qty) : 0;
  }

  // Sum across all locations
  const matches = stockBalances.filter((s) => String(s.sku) === String(sku));
  if (matches.length === 0) return null;
  return matches.reduce((sum, s) => sum + Number(s.current_qty), 0);
}

// ─────────────────────────────────────────────
// Popup Component
// ─────────────────────────────────────────────

export function SkuPickerPopup({
  open,
  onClose,
  onSelect,
  items,
  stockBalances = [],
  fromLocationId,
  fromLocationName,
  isOutward = false,
  title = "Browse SKUs",
}: SkuPickerPopupProps) {
  const [search, setSearch] = useState("");

  // Reset search when popup opens
  useEffect(() => {
    if (open) setSearch("");
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const filtered = items.filter(
    (i) =>
      i.name.toLowerCase().includes(search.toLowerCase()) ||
      String(i.sku).includes(search)
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] bg-slate-900/60 dark:bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-lg flex flex-col max-h-[82vh] animate-fade-in">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center flex-shrink-0">
              <CubeIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white leading-tight">
                {title}
              </h3>
              <p className="text-[11px] text-slate-400 font-semibold mt-0.5 flex items-center gap-1">
                {fromLocationId && fromLocationName ? (
                  <>
                    <MapPinIcon className="w-3 h-3" />
                    Stock at: <span className="text-slate-600 dark:text-slate-300 font-bold">{fromLocationName}</span>
                  </>
                ) : stockBalances.length > 0 ? (
                  "Showing total stock across all locations"
                ) : (
                  "Select an item to add to the voucher"
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
            aria-label="Close picker"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>

        {/* ── Search Filter ── */}
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
          <div className="relative">
            <MagnifyingGlassIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              autoFocus
              placeholder="Search by name or SKU..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-9 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* ── SKU List ── */}
        <div className="overflow-y-auto flex-1">
          {filtered.length === 0 ? (
            <div className="py-14 flex flex-col items-center gap-2 text-slate-400">
              <MagnifyingGlassIcon className="w-9 h-9 text-slate-300 dark:text-slate-700" />
              <p className="text-sm font-semibold">
                {search ? `No items match "${search}"` : "No items available"}
              </p>
            </div>
          ) : (
            filtered.map((item) => {
              const stock = getStock(item.sku, stockBalances, fromLocationId);
              const blocked = isOutward && stock !== null && stock <= 0;
              const hasStock = stock === null || stock > 0;

              return (
                <button
                  key={item.sku}
                  type="button"
                  disabled={blocked}
                  onClick={() => {
                    if (!blocked) onSelect(item);
                  }}
                  className={`w-full text-left px-5 py-3.5 border-b border-slate-100 dark:border-slate-800/60 last:border-0 flex items-center justify-between gap-4 transition-colors group ${
                    blocked
                      ? "opacity-40 cursor-not-allowed"
                      : "hover:bg-blue-50 dark:hover:bg-blue-950/20 cursor-pointer"
                  }`}
                >
                  {/* Left: item info */}
                  <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                    <span className="font-bold text-sm text-slate-800 dark:text-slate-200 truncate group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors">
                      {item.name}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                        SKU: {item.sku}
                      </span>
                      {item.description && (
                        <span className="text-[11px] text-slate-400 truncate">{item.description}</span>
                      )}
                    </div>
                  </div>

                  {/* Right: stock badge */}
                  {stock !== null && (
                    <div className="flex-shrink-0">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black border ${
                          hasStock
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/50"
                            : "bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-900/50"
                        }`}
                      >
                        {hasStock ? (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 inline-block" />
                            {stock.toLocaleString("en-IN")} in stock
                          </>
                        ) : (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block" />
                            No stock
                          </>
                        )}
                      </span>
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-5 py-3.5 border-t border-slate-100 dark:border-slate-800 flex-shrink-0 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50 rounded-b-3xl">
          <span className="text-xs text-slate-400 font-semibold">
            {filtered.length} of {items.length} SKU(s)
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl transition-colors text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Convenience wrapper: SkuInputWithPicker
// A complete <input> + picker-button combo, drop-in replacement
// for any standalone SKU search text box.
// ─────────────────────────────────────────────────────────────

interface SkuInputWithPickerProps {
  /** Current text value of the input */
  value: string;
  /** Called on every keystroke */
  onChange: (value: string) => void;
  /** Called when user picks an item from the popup */
  onPick: (item: SkuItem) => void;
  /** All SKUs */
  items: SkuItem[];
  /** Optional stock balances for popup */
  stockBalances?: StockBalance[];
  /** If OUTWARD mode, zero-stock items are blocked */
  isOutward?: boolean;
  /** Source location filter */
  fromLocationId?: string | number | null;
  fromLocationName?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
}

export function SkuInputWithPicker({
  value,
  onChange,
  onPick,
  items,
  stockBalances = [],
  isOutward = false,
  fromLocationId,
  fromLocationName,
  placeholder = "Search item by name or SKU...",
  disabled = false,
  className = "",
  inputClassName = "",
}: SkuInputWithPickerProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const suggestions = value.trim()
    ? items
        .filter(
          (i) =>
            i.name.toLowerCase().includes(value.toLowerCase()) ||
            String(i.sku).includes(value)
        )
        .slice(0, 8)
    : [];

  const handlePick = useCallback(
    (item: SkuItem) => {
      onPick(item);
      setPickerOpen(false);
      setShowDropdown(false);
    },
    [onPick]
  );

  return (
    <>
      <div className={`flex items-center gap-1.5 ${className}`}>
        {/* Text input with inline suggestions */}
        <div className="relative flex-1">
          <input
            type="text"
            placeholder={placeholder}
            value={value}
            disabled={disabled}
            onChange={(e) => {
              onChange(e.target.value);
              setShowDropdown(true);
            }}
            onFocus={() => setShowDropdown(value.trim().length > 0)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 180)}
            className={`w-full pl-3 pr-3 py-2 bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 disabled:opacity-50 ${inputClassName}`}
          />

          {/* Inline dropdown suggestions */}
          {showDropdown && suggestions.length > 0 && (
            <ul className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 max-h-52 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/60">
              {suggestions.map((item) => {
                const stock = getStock(item.sku, stockBalances, fromLocationId);
                const blocked = isOutward && stock !== null && stock <= 0;
                return (
                  <li
                    key={item.sku}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      if (!blocked) handlePick(item);
                    }}
                    className={`px-3 py-2.5 flex justify-between items-center text-sm transition-colors ${
                      blocked
                        ? "opacity-40 cursor-not-allowed"
                        : "hover:bg-blue-50 dark:hover:bg-blue-950/20 cursor-pointer"
                    }`}
                  >
                    <div>
                      <div className="font-bold text-slate-800 dark:text-slate-200">{item.name}</div>
                      <div className="text-[11px] font-mono text-slate-400">SKU: {item.sku}</div>
                    </div>
                    {stock !== null && (
                      <span
                        className={`text-xs font-extrabold ${
                          stock > 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-rose-500 dark:text-rose-400"
                        }`}
                      >
                        {stock > 0 ? `${stock.toLocaleString("en-IN")} stk` : "No stock"}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Popup trigger button */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => setPickerOpen(true)}
          title="Browse all SKUs"
          className="p-2 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/30 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-xl transition-colors flex-shrink-0 disabled:opacity-40"
        >
          <MagnifyingGlassIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Full popup */}
      <SkuPickerPopup
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handlePick}
        items={items}
        stockBalances={stockBalances}
        fromLocationId={fromLocationId}
        fromLocationName={fromLocationName}
        isOutward={isOutward}
      />
    </>
  );
}
