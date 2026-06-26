"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useSearchParams } from "next/navigation";
import { PlusIcon, MagnifyingGlassIcon, UserIcon, MapPinIcon, TrashIcon, CheckIcon } from "@heroicons/react/24/outline";

interface FinancialYear {
  id: number;
  name: string;
  is_closed: boolean;
}

interface Location {
  id: number;
  name: string;
}

interface InventoryItem {
  sku: string;
  name: string;
  description?: string;
}

interface TransactionType {
  code: string | number;
  name: string;
  stock_effect: string;
  from_type: string;
  to_type: string;
}

interface VoucherDetailInput {
  searchText: string;
  sku: string;
  name: string;
  qty: string;
}

interface Transaction {
  id: string;
  transaction_date: string;
  transaction_type: string | number;
  sku: string | number;
  qty: string;
  party_name?: string;
  reference_no?: string;
  remarks?: string;
  from_location_name?: string;
  to_location_name?: string;
  item_name?: string;
  transaction_type_name?: string;
  stock_effect?: string;
  from_type?: string;
  to_type?: string;
}

function PostTransactionPageContent() {
  const { session } = useAuth();
  const searchParams = useSearchParams();
  const editVoucherIdParam = searchParams.get("editVoucherId");

  const [financialYears, setFinancialYears] = useState<FinancialYear[]>([]);
  const [selectedFyId, setSelectedFyId] = useState<string>("");
  const [locations, setLocations] = useState<Location[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [transactionTypes, setTransactionTypes] = useState<TransactionType[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [stockBalances, setStockBalances] = useState<any[]>([]);
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [editingVoucherId, setEditingVoucherId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [txnDeleting, setTxnDeleting] = useState(false);

  // Voucher header states
  const [txnTypeCode, setTxnTypeCode] = useState("");
  const [txnFromLoc, setTxnFromLoc] = useState("");
  const [txnToLoc, setTxnToLoc] = useState("");
  const [txnPartyName, setTxnPartyName] = useState("");
  const [txnRefNo, setTxnRefNo] = useState("");
  const [txnRemarks, setTxnRemarks] = useState("");
  const [txnDate, setTxnDate] = useState(() => new Date().toISOString().split("T")[0]);

  // Voucher detail row states (adding items)
  const [voucherDetails, setVoucherDetails] = useState<VoucherDetailInput[]>([
    { searchText: "", sku: "", name: "", qty: "" }
  ]);
  const itemInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [activeRowIndex, setActiveRowIndex] = useState<number | null>(null);
  const [showItemSuggestions, setShowItemSuggestions] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [txnSubmitting, setTxnSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const selectedFy = financialYears.find(f => f.id.toString() === selectedFyId);
  const selectedType = transactionTypes.find(t => String(t.code) === String(txnTypeCode));

  const getItemStock = (sku: string | number) => {
    if (!txnFromLoc) return 0;
    const match = stockBalances.find(
      (s) => String(s.sku) === String(sku) && String(s.location_id) === String(txnFromLoc)
    );
    return match ? Number(match.current_qty) : 0;
  };

  useEffect(() => {
    const initLoad = async () => {
      if (session?.orgcode) {
        const types = await fetchTransactionTypes();
        fetchLocations();
        fetchItems();
        fetchInventoryData();
        
        if (editVoucherIdParam) {
          const vId = parseInt(editVoucherIdParam, 10);
          if (!isNaN(vId)) {
            handleLoadVoucher(vId, types);
          }
        }
      }
    };
    initLoad();
  }, [session, selectedFyId, editVoucherIdParam]);

  // Reset values when transaction type changes
  useEffect(() => {
    if (selectedType && editingVoucherId === null) {
      setTxnFromLoc("");
      setTxnToLoc("");
      setTxnPartyName("");
      setVoucherDetails([{ searchText: "", sku: "", name: "", qty: "" }]);
    }
  }, [txnTypeCode]);

  const fetchLocations = async () => {
    if (!session?.orgcode) return;
    try {
      const res = await fetch(`/api/inventory/locations?orgcode=${session.orgcode}`);
      const data = await res.json();
      if (data.success) setLocations(data.locations);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchItems = async () => {
    if (!session?.orgcode) return;
    try {
      const res = await fetch(`/api/inventory/items?orgcode=${session.orgcode}`);
      const data = await res.json();
      if (data.success) setItems(data.items);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchTransactionTypes = async () => {
    if (!session?.orgcode) return [];
    try {
      const res = await fetch(`/api/inventory/transaction-types?orgcode=${session.orgcode}`);
      const data = await res.json();
      if (data.success) {
        setTransactionTypes(data.transactionTypes);
        if (data.transactionTypes.length > 0) {
          setTxnTypeCode(String(data.transactionTypes[0].code));
        }
        return data.transactionTypes;
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  };

  const fetchInventoryData = async () => {
    if (!session?.orgcode) return;
    try {
      setLoading(true);
      setErrorMsg("");
      let url = `/api/inventory?orgcode=${session.orgcode}`;
      if (selectedFyId) {
        url += `&financialYearId=${selectedFyId}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setFinancialYears(data.financialYears);
        if (!selectedFyId) {
          setSelectedFyId(data.selectedFyId.toString());
        }
        setRecentTransactions(data.transactions || []);
        setStockBalances(data.stock || []);
        setVouchers(data.vouchers || []);
      } else {
        setErrorMsg(data.message || "Failed to load active details");
      }
    } catch (e) {
      setErrorMsg("Failed to connect to server");
    } finally {
      setLoading(false);
    }
  };

  const handleLoadVoucher = async (voucherId: number, typesList?: TransactionType[]) => {
    if (!session?.orgcode) return;
    setErrorMsg("");
    setSuccessMsg("");
    try {
      setLoading(true);
      const res = await fetch(`/api/inventory?orgcode=${session.orgcode}&voucherId=${voucherId}`);
      const data = await res.json();
      if (data.success && data.voucher) {
        const v = data.voucher;
        setEditingVoucherId(v.id);
        
        const listToUse = typesList && typesList.length > 0 ? typesList : transactionTypes;
        const typeMatch = listToUse.find(t => String(t.code) === String(v.type_code) || t.code === v.transaction_type_id);
        setTxnTypeCode(typeMatch ? String(typeMatch.code) : "");
        
        setTxnDate(new Date(v.transaction_date).toISOString().split("T")[0]);
        setTxnFromLoc(v.from_location_id ? String(v.from_location_id) : "");
        setTxnToLoc(v.to_location_id ? String(v.to_location_id) : "");
        setTxnPartyName(v.party_name || "");
        setTxnRefNo(v.reference_no || "");
        setTxnRemarks(v.remarks || "");
        
        const mappedDetails = data.details.map((d: any) => ({
          searchText: `${d.item_name} (${d.sku})`,
          sku: String(d.sku),
          name: d.item_name,
          qty: String(d.qty)
        }));
        setVoucherDetails(mappedDetails.length > 0 ? mappedDetails : [{ searchText: "", sku: "", name: "", qty: "" }]);
      } else {
        setErrorMsg(data.message || "Failed to load voucher details");
      }
    } catch {
      setErrorMsg("Failed to connect to server to load voucher");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteVoucher = async (voucherId: number) => {
    if (!session?.orgcode) return;
    if (!window.confirm("Are you sure you want to delete this voucher? This will reverse all stock effects!")) return;
    try {
      setTxnDeleting(true);
      setErrorMsg("");
      setSuccessMsg("");
      const res = await fetch(`/api/inventory?orgcode=${session.orgcode}&id=${voucherId}`, {
        method: "DELETE"
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg("Voucher deleted and stock effect reversed successfully!");
        handleCancelEdit();
        fetchInventoryData();
      } else {
        setErrorMsg(data.message || "Failed to delete voucher");
      }
    } catch {
      setErrorMsg("Failed to delete voucher due to server error");
    } finally {
      setTxnDeleting(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingVoucherId(null);
    setTxnTypeCode(transactionTypes.length > 0 ? String(transactionTypes[0].code) : "");
    setTxnFromLoc("");
    setTxnToLoc("");
    setTxnPartyName("");
    setTxnRefNo("");
    setTxnRemarks("");
    setTxnDate(new Date().toISOString().split("T")[0]);
    setVoucherDetails([{ searchText: "", sku: "", name: "", qty: "" }]);
  };

  const addDetailRow = () => {
    setVoucherDetails(prev => {
      const newLength = prev.length;
      setTimeout(() => itemInputRefs.current[newLength]?.focus(), 50);
      return [...prev, { searchText: "", sku: "", name: "", qty: "" }];
    });
  };

  const removeDetailRow = (index: number) => {
    if (voucherDetails.length > 1) {
      setVoucherDetails(voucherDetails.filter((_, idx) => idx !== index));
    }
  };

  const updateDetailRowField = (index: number, field: keyof VoucherDetailInput, value: string) => {
    const updated = [...voucherDetails];
    updated[index][field] = value;

    if (field === "searchText") {
      updated[index].sku = "";
      updated[index].name = "";
      setShowItemSuggestions(value.trim().length > 0);
      setActiveRowIndex(index);
    }

    setVoucherDetails(updated);
  };

  const selectItemSuggestion = (index: number, item: InventoryItem) => {
    if (selectedType?.stock_effect === "OUTWARD") {
      if (!txnFromLoc) {
        alert("Please select a Source (From) location first.");
        return;
      }
      const stock = getItemStock(item.sku);
      if (stock <= 0) {
        alert(`Cannot select "${item.name}" (SKU: ${item.sku}) because there is no stock available at the selected location.`);
        return;
      }
    }
    const updated = [...voucherDetails];
    updated[index] = {
      searchText: `${item.name} (${item.sku})`,
      sku: String(item.sku),
      name: item.name,
      qty: updated[index].qty
    };
    setVoucherDetails(updated);
    setShowItemSuggestions(false);
    setActiveRowIndex(null);
  };

  const getItemSuggestions = (search: string) => {
    if (!search.trim()) return [];
    return items.filter(item =>
      String(item.sku).toLowerCase().includes(search.toLowerCase()) ||
      item.name.toLowerCase().includes(search.toLowerCase())
    ).slice(0, 10);
  };

  const handlePostTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.orgcode || !selectedFyId || !selectedType) return;

    // Filter out blank rows automatically before saving
    const validDetails = voucherDetails.filter(d => String(d.sku).trim() !== "" && String(d.qty).trim() !== "" && parseFloat(d.qty) > 0);

    if (validDetails.length === 0) {
      setErrorMsg("Please specify at least one valid item SKU and quantity to post.");
      return;
    }

    // Dynamic validations based on transaction type configuration
    if (selectedType.from_type === "location" && !txnFromLoc) {
      setErrorMsg("Please specify the source location");
      return;
    }
    if (selectedType.to_type === "location" && !txnToLoc) {
      setErrorMsg("Please specify the destination location");
      return;
    }
    if (selectedType.from_type === "location" && selectedType.to_type === "location" && txnFromLoc === txnToLoc) {
      setErrorMsg("Source and destination locations cannot be the same");
      return;
    }
    if ((selectedType.from_type === "vendor" || selectedType.from_type === "customer" ||
         selectedType.to_type === "vendor" || selectedType.to_type === "customer") && !txnPartyName.trim()) {
      setErrorMsg(`Please specify the ${selectedType.from_type === "vendor" || selectedType.to_type === "vendor" ? "Vendor" : "Customer"} Name`);
      return;
    }

    if (selectedType.stock_effect === "OUTWARD") {
      for (const d of validDetails) {
        const stock = getItemStock(d.sku);
        if (parseFloat(d.qty) > stock) {
          setErrorMsg(`Requested quantity (${d.qty}) for item "${d.name || d.sku}" exceeds available stock (${stock}) at the selected location.`);
          return;
        }
      }
    }

    const isEdit = editingVoucherId !== null;
    try {
      setTxnSubmitting(true);
      setErrorMsg("");
      setSuccessMsg("");
      
      const payload: any = {
        orgcode: session.orgcode,
        financial_year_id: parseInt(selectedFyId, 10),
        transaction_date: txnDate,
        transaction_type: txnTypeCode,
        from_location_id: selectedType.from_type === "location" ? parseInt(txnFromLoc, 10) : undefined,
        to_location_id: selectedType.to_type === "location" ? parseInt(txnToLoc, 10) : undefined,
        party_name: txnPartyName.trim(),
        reference_no: txnRefNo,
        remarks: txnRemarks,
        items: validDetails.map(d => ({ sku: d.sku, qty: parseFloat(d.qty) }))
      };
      if (isEdit) {
        payload.id = editingVoucherId;
      }

      const res = await fetch("/api/inventory", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        setSuccessMsg(isEdit ? "Stock Voucher updated successfully!" : `Stock Voucher recorded successfully with ${validDetails.length} items!`);
        handleCancelEdit();
        fetchInventoryData();
      } else {
        setErrorMsg(data.message || "Failed to submit transaction");
      }
    } catch (e) {
      setErrorMsg("Error submitting transaction");
    } finally {
      setTxnSubmitting(false);
    }
  };

  const filteredTxns = recentTransactions.filter((t) =>
    String(t.sku).toLowerCase().includes(searchQuery.toLowerCase()) ||
    (t.item_name && t.item_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (t.party_name && t.party_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
    String(t.transaction_type).toLowerCase().includes(searchQuery.toLowerCase()) ||
    (t.transaction_type_name && t.transaction_type_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (t.reference_no && t.reference_no.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="flex flex-col gap-5 pb-12 text-slate-800 dark:text-slate-100 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-500 bg-clip-text text-transparent">
            Voucher Transaction Entry
          </h2>
          <p className="text-slate-500 text-xs mt-0.5 font-semibold">
            Navigate using Tab key on Quantity column to append rows dynamically.
          </p>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-350 shadow-sm">
          <span>Active Year:</span>
          <span className="text-blue-600 dark:text-blue-400 font-black">{selectedFy?.name}</span>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 dark:bg-rose-950/20 dark:border-rose-900/50 dark:text-rose-450 rounded-xl text-xs font-semibold animate-fade-in">
          ⚠️ {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 dark:bg-emerald-950/20 dark:border-emerald-900/50 dark:text-emerald-405 rounded-xl text-xs font-semibold animate-fade-in">
          ✅ {successMsg}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <div className="w-8 h-8 border-4 border-slate-200 dark:border-slate-800 border-t-blue-600 rounded-full animate-spin"></div>
          <p className="text-slate-400 text-xs">Loading voucher forms...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
          
          {/* Master Detail voucher Form */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            
            <form onSubmit={handlePostTransaction} className="flex flex-col gap-4">
              
              {/* SEGMENT 1: Voucher Header Details (Visual Card 1) */}
              <div className="bg-slate-50/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 shadow-sm flex flex-col gap-3.5">
                <div className="flex justify-between items-center border-b border-slate-200/50 dark:border-slate-800/50 pb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <span>📝</span> Voucher Header details
                  </span>
                  {selectedType && (
                    <span className="text-[10px] text-slate-400 font-mono font-bold">
                      Route: {selectedType.from_type.toUpperCase()} ➔ {selectedType.to_type.toUpperCase()}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold uppercase text-slate-400">Transaction Type</label>
                    <select
                      value={txnTypeCode}
                      disabled={selectedFy?.is_closed}
                      onChange={(e) => setTxnTypeCode(e.target.value)}
                      className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold text-xs"
                    >
                      {transactionTypes.map((t) => (
                        <option key={t.code} value={t.code}>
                          {t.name} ({t.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold uppercase text-slate-400">Voucher Date</label>
                    <input
                      type="date"
                      value={txnDate}
                      disabled={selectedFy?.is_closed}
                      onChange={(e) => setTxnDate(e.target.value)}
                      className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold text-xs"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold uppercase text-slate-400">Ref / Challan / Bill No</label>
                    <input
                      type="text"
                      placeholder="e.g. BILL-9827"
                      value={txnRefNo}
                      disabled={selectedFy?.is_closed}
                      onChange={(e) => setTxnRefNo(e.target.value)}
                      className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold text-xs"
                    />
                  </div>
                </div>

                {/* Routing & Remarks Inputs */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 border-t border-slate-200/40 dark:border-slate-800/40 pt-3">
                  
                  {/* Dynamic From Input */}
                  {selectedType?.from_type === "location" && (
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1">
                        <MapPinIcon className="w-3 h-3 text-blue-500" /> Source (From)
                      </label>
                      <select
                        value={txnFromLoc}
                        disabled={selectedFy?.is_closed}
                        onChange={(e) => setTxnFromLoc(e.target.value)}
                        className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold text-xs"
                      >
                        <option value="">Select source warehouse...</option>
                        {locations.map((l) => (
                          <option key={l.id} value={l.id.toString()}>
                            {l.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Dynamic To Input */}
                  {selectedType?.to_type === "location" && (
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1">
                        <MapPinIcon className="w-3 h-3 text-indigo-500" /> Destination (To)
                      </label>
                      <select
                        value={txnToLoc}
                        disabled={selectedFy?.is_closed}
                        onChange={(e) => setTxnToLoc(e.target.value)}
                        className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold text-xs"
                      >
                        <option value="">Select destination warehouse...</option>
                        {locations.map((l) => (
                          <option key={l.id} value={l.id.toString()}>
                            {l.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Dynamic Party input */}
                  {(selectedType?.from_type === "vendor" || selectedType?.from_type === "customer" ||
                    selectedType?.to_type === "vendor" || selectedType?.to_type === "customer") && (
                    <div className="flex flex-col gap-1 md:col-span-2">
                      <label className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1">
                        <UserIcon className="w-3 h-3 text-blue-500" />
                        {selectedType.from_type === "vendor" || selectedType.to_type === "vendor" ? "Vendor Name" : "Customer Name"}
                      </label>
                      <input
                        type="text"
                        placeholder={selectedType.from_type === "vendor" || selectedType.to_type === "vendor" ? "e.g. ABC Manufacturing" : "e.g. John Doe"}
                        value={txnPartyName}
                        disabled={selectedFy?.is_closed}
                        onChange={(e) => setTxnPartyName(e.target.value)}
                        className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold text-xs"
                      />
                    </div>
                  )}

                  <div className="flex flex-col gap-1 md:col-span-1">
                    <label className="text-[10px] font-bold uppercase text-slate-400">Remarks</label>
                    <input
                      type="text"
                      placeholder="Remarks..."
                      value={txnRemarks}
                      disabled={selectedFy?.is_closed}
                      onChange={(e) => setTxnRemarks(e.target.value)}
                      className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* SEGMENT 2: Voucher Details / Grid (Visual Card 2 - Distinguishable White layout) */}
              <div className="bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-4 shadow-sm flex flex-col gap-3">
                <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <span>📦</span> Itemized voucher lines
                  </span>
                  {selectedType && (
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold ${
                      selectedType.stock_effect === "INWARD"
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-450 border border-emerald-100/50"
                        : selectedType.stock_effect === "OUTWARD"
                          ? "bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-455 border border-rose-100/50"
                          : "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-450 border border-blue-100/50"
                    }`}>
                      {selectedType.stock_effect} Stock
                    </span>
                  )}
                </div>

                <div className="overflow-visible border border-slate-100 dark:border-slate-800/80 rounded-xl">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-55/40 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-850 text-slate-400 text-[10px] font-bold G tracking-wider uppercase">
                        <th className="py-2 px-3 w-[65%]">Search Item Name or SKU*</th>
                        <th className="py-2 px-3 w-[20%] text-center">Qty</th>
                        <th className="py-2 px-3 w-[15%] text-right"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40 text-xs">
                      {voucherDetails.map((line, idx) => {
                        const suggestions = getItemSuggestions(line.searchText);
                        return (
                          <tr key={idx} className="hover:bg-slate-50/20 dark:hover:bg-slate-900/5">
                            {/* Autocomplete Input Column */}
                            <td className="py-2 px-3 relative">
                              <input
                                type="text"
                                ref={el => { itemInputRefs.current[idx] = el; }}
                                placeholder="Type item name/SKU..."
                                value={line.searchText}
                                onChange={(e) => updateDetailRowField(idx, "searchText", e.target.value)}
                                onFocus={() => {
                                  setActiveRowIndex(idx);
                                  setShowItemSuggestions(line.searchText.trim().length > 0);
                                }}
                                onBlur={() => {
                                  setTimeout(() => {
                                    if (activeRowIndex === idx) {
                                      setShowItemSuggestions(false);
                                    }
                                  }, 200);
                                }}
                                disabled={selectedFy?.is_closed}
                                className="w-full p-1.5 bg-slate-50/50 dark:bg-slate-900/30 border border-slate-205 dark:border-slate-700/80 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold"
                              />

                              {/* Suggestion Dropdown */}
                              {activeRowIndex === idx && showItemSuggestions && suggestions.length > 0 && (
                                <ul className="absolute left-3 right-3 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto">
                                  {suggestions.map((item) => {
                                    const stockVal = getItemStock(item.sku);
                                    const isOut = selectedType?.stock_effect === "OUTWARD" && stockVal <= 0;
                                    return (
                                      <li
                                        key={item.sku}
                                        onMouseDown={(e) => {
                                          e.preventDefault();
                                          if (isOut) {
                                            alert(`Cannot select "${item.name}" because there is no stock available at the selected location.`);
                                            return;
                                          }
                                          selectItemSuggestion(idx, item);
                                        }}
                                        className={`px-3 py-2 border-b border-slate-100 dark:border-slate-700/60 last:border-0 flex justify-between items-center text-xs ${
                                          isOut 
                                            ? "opacity-50 cursor-not-allowed bg-slate-50 dark:bg-slate-900/40 text-slate-455" 
                                            : "hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer text-slate-800 dark:text-slate-200"
                                        }`}
                                      >
                                        <div className="flex flex-col text-left">
                                          <span className="font-bold">{item.name}</span>
                                          <span className="text-[10px] text-slate-400 font-mono">SKU: {item.sku}</span>
                                        </div>
                                        {selectedType?.stock_effect === "OUTWARD" && (
                                          <span className={`text-[10px] font-extrabold ${stockVal > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500 dark:text-rose-450"}`}>
                                            {stockVal > 0 ? `Stock: ${stockVal}` : "Out of stock"}
                                          </span>
                                        )}
                                      </li>
                                    );
                                  })}
                                </ul>
                              )}
                            </td>

                            {/* Quantity column */}
                            <td className="py-2 px-3 text-center">
                              <input
                                type="number"
                                step="any"
                                placeholder="0"
                                value={line.qty}
                                onChange={(e) => updateDetailRowField(idx, "qty", e.target.value)}
                                disabled={selectedFy?.is_closed}
                                onKeyDown={(e) => {
                                  if (e.key === "Tab" && idx === voucherDetails.length - 1) {
                                    if (line.sku && line.qty && parseFloat(line.qty) > 0) {
                                      e.preventDefault();
                                      addDetailRow();
                                    }
                                  }
                                }}
                                className="w-20 p-1.5 bg-slate-50/50 dark:bg-slate-900/30 border border-slate-205 dark:border-slate-700/80 rounded-lg text-center font-mono font-bold focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                              {selectedType?.stock_effect === "OUTWARD" && line.sku && (
                                <div className="text-[9px] mt-1 font-bold">
                                  {parseFloat(line.qty) > getItemStock(line.sku) ? (
                                    <span className="text-rose-500 dark:text-rose-400 block">⚠️ Exceeds stock ({getItemStock(line.sku)})</span>
                                  ) : (
                                    <span className="text-slate-400 dark:text-slate-500 block">Avail: {getItemStock(line.sku)}</span>
                                  )}
                                </div>
                              )}
                            </td>

                            {/* Remove row button */}
                            <td className="py-2 px-3 text-right">
                              <button
                                type="button"
                                onClick={() => removeDetailRow(idx)}
                                disabled={voucherDetails.length === 1}
                                className="p-1 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-rose-500 rounded-lg transition-colors disabled:opacity-30"
                              >
                                <TrashIcon className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-between items-center mt-0.5">
                  <button
                    type="button"
                    onClick={addDetailRow}
                    disabled={selectedFy?.is_closed}
                    className="px-3 py-1.5 text-[11px] font-bold text-blue-600 hover:bg-blue-50/50 dark:text-blue-400 dark:hover:bg-blue-900/10 rounded-lg transition-colors flex items-center gap-1 border border-dashed border-blue-200 dark:border-blue-800"
                  >
                    <PlusIcon className="w-3 h-3" /> Add Detail Line
                  </button>
                  <span className="text-[10px] text-slate-400 font-semibold font-mono">
                    Total Lines: {voucherDetails.filter(d => String(d.sku).trim() !== "").length}
                  </span>
                </div>
              </div>

              {/* Submit / Edit / Delete Voucher Actions */}
              {editingVoucherId !== null ? (
                <div className="flex flex-col sm:flex-row gap-2 mt-2 w-full">
                  <button
                    type="submit"
                    disabled={txnSubmitting || selectedFy?.is_closed || voucherDetails.filter(d => String(d.sku).trim() !== "").length === 0}
                    className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-md transition-transform hover:-translate-y-0.5 duration-200 disabled:opacity-50 text-xs flex items-center justify-center gap-1.5"
                  >
                    <CheckIcon className="w-4 h-4" />
                    {txnSubmitting ? "Updating Voucher..." : "Update Voucher"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteVoucher(editingVoucherId)}
                    disabled={txnDeleting || selectedFy?.is_closed}
                    className="py-3 px-5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-md transition-transform hover:-translate-y-0.5 duration-200 disabled:opacity-50 text-xs flex items-center justify-center gap-1.5"
                  >
                    <TrashIcon className="w-4 h-4" />
                    {txnDeleting ? "Deleting..." : "Delete Voucher"}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="py-3 px-5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-705 dark:text-slate-350 font-bold rounded-xl transition-all text-xs"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="submit"
                  disabled={txnSubmitting || selectedFy?.is_closed || voucherDetails.filter(d => String(d.sku).trim() !== "").length === 0}
                  className="w-full py-3 mt-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-md transition-transform hover:-translate-y-0.5 duration-200 disabled:opacity-50 disabled:pointer-events-none text-xs flex items-center justify-center gap-1.5"
                >
                  <CheckIcon className="w-4 h-4" />
                  {txnSubmitting ? "Submitting Voucher..." : "Post Complete Voucher"}
                </button>
              )}
            </form>

            {/* Show 2 latest vouchers */}
            <div className="bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-5 shadow-sm flex flex-col gap-3 mt-4">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">2 Latest Vouchers</h3>
                <p className="text-[10px] text-slate-400 font-semibold">Click a voucher to load it in edit mode</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {vouchers.slice(0, 2).map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => handleLoadVoucher(v.id)}
                    className="p-3 bg-slate-50/50 dark:bg-slate-900/30 rounded-xl border border-slate-150 dark:border-slate-800 text-left hover:border-blue-400 dark:hover:border-blue-500/50 transition-all flex flex-col gap-1.5 group cursor-pointer"
                  >
                    <div className="flex justify-between items-center w-full">
                      <span className="font-extrabold text-[10px] text-slate-500 uppercase">
                        {v.type_name}
                      </span>
                      <span className="text-[9px] text-slate-450 font-mono">
                        {new Date(v.transaction_date).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="flex flex-col gap-0.5 text-xs">
                      <span className="font-bold text-slate-750 dark:text-slate-250 truncate max-w-xs">
                        Narration: {v.party_name || v.reference_no || v.remarks || "-"}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Location: <span className="font-semibold text-slate-700 dark:text-slate-300">
                          {v.from_location_name && v.to_location_name ? (
                            `${v.from_location_name} ➔ ${v.to_location_name}`
                          ) : v.from_location_name ? (
                            v.from_location_name
                          ) : v.to_location_name ? (
                            v.to_location_name
                          ) : (
                            "-"
                          )}
                        </span>
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {v.items_count} unique item(s) • Effect: <span className="font-extrabold">{v.stock_effect}</span>
                      </span>
                    </div>
                  </button>
                ))}
                {vouchers.length === 0 && (
                  <p className="text-slate-400 text-[11px] py-4 md:col-span-2 text-center">No vouchers found in this financial year.</p>
                )}
              </div>
            </div>
          </div>

          {/* Ledger log (Right column) */}
          <div className="lg:col-span-1 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-4 shadow-sm flex flex-col gap-3">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-2 flex flex-col gap-2">
              <h3 className="text-sm font-bold">Voucher Ledger Log</h3>
              
              <div className="relative">
                <MagnifyingGlassIcon className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3" />
                <input
                  type="text"
                  placeholder="Search ledger entries..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs font-semibold"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2 max-h-[500px] overflow-y-auto pr-1">
              {filteredTxns.map((t) => (
                <div
                  key={t.id}
                  className="p-2.5 bg-slate-50/40 dark:bg-slate-900/30 rounded-xl border border-slate-100/80 dark:border-slate-800 flex flex-col gap-1.5 text-xs hover:border-slate-200 dark:hover:border-slate-700 transition-colors"
                >
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-700 dark:text-slate-300 truncate max-w-[130px]">
                      {t.item_name || t.sku}
                    </span>
                    <span className="font-mono text-[10px] text-slate-400">
                      {new Date(t.transaction_date).toLocaleDateString("en-IN")}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <div className="flex flex-col">
                      <span className="font-extrabold text-[9px] text-slate-500 uppercase">
                        {t.transaction_type_name || t.transaction_type}
                      </span>
                      {t.from_location_name || t.to_location_name ? (
                        <span className="text-[9px] text-slate-400 font-mono">
                          {t.from_location_name || "Outside"} ➔ {t.to_location_name || "Outside"}
                        </span>
                      ) : null}
                    </div>
                    
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="font-mono font-black text-xs text-slate-800 dark:text-slate-100">
                        {parseFloat(t.qty).toLocaleString('en-IN')}
                      </span>
                      <span className={`px-1 rounded text-[8px] font-extrabold ${
                        t.stock_effect === "INWARD"
                          ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20"
                          : t.stock_effect === "OUTWARD"
                            ? "bg-rose-50 text-rose-600 dark:bg-rose-950/20"
                            : "bg-blue-50 text-blue-600 dark:bg-blue-950/20"
                      }`}>
                        {t.stock_effect || "INWARD"}
                      </span>
                    </div>
                  </div>
                  
                  {(t.reference_no || t.party_name) && (
                    <div className="text-[9px] text-slate-400 border-t border-slate-100 dark:border-slate-800/80 pt-1.5 mt-0.5 flex flex-col gap-0.5">
                      {t.reference_no && <div>Ref: <span className="font-bold">{t.reference_no}</span></div>}
                      {t.party_name && <div>Party: <span className="font-bold">{t.party_name}</span></div>}
                    </div>
                  )}
                </div>
              ))}
              {filteredTxns.length === 0 && (
                <p className="text-slate-400 text-xs py-6 text-center">No ledger entries found.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PostTransactionPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="w-10 h-10 border-4 border-slate-200 dark:border-slate-700 border-t-blue-600 rounded-full animate-spin"></div>
        <p className="text-slate-500 font-medium animate-pulse">Initializing transaction module...</p>
      </div>
    }>
      <PostTransactionPageContent />
    </Suspense>
  );
}
