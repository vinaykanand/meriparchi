"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useSearchParams } from "next/navigation";
import { PlusIcon, MagnifyingGlassIcon, UserIcon, MapPinIcon, TrashIcon, CheckIcon, AdjustmentsHorizontalIcon, XMarkIcon, PrinterIcon } from "@heroicons/react/24/outline";
import { SkuInputWithPicker, type SkuItem } from "@/components/inventory/SkuPicker";

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
  id: number;
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
  transaction_header_id?: number | string;
  voucher_no?: string | number;
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
  const [printingVoucher, setPrintingVoucher] = useState<any>(null);
  const [printingDetails, setPrintingDetails] = useState<any[]>([]);
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
  const [searchQuery, setSearchQuery] = useState("");

  const [txnSubmitting, setTxnSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Advanced search states
  const [showAdvSearch, setShowAdvSearch] = useState(false);
  const [advSkuItem, setAdvSkuItem] = useState("");
  const [advDate, setAdvDate] = useState("");
  const [advType, setAdvType] = useState("");
  const [advLocation, setAdvLocation] = useState("");
  const [advQty, setAdvQty] = useState("");
  const [advPartyRef, setAdvPartyRef] = useState("");

  const selectedFy = financialYears.find(f => f.id.toString() === selectedFyId);
  const selectedType = transactionTypes.find(t => String(t.code) === String(txnTypeCode));

  const getItemStock = (sku: string | number) => {
    if (!txnFromLoc) return null; // null = no location selected
    if (!txnFromLoc) return null;
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

  const handlePrintVoucherById = async (voucherId: number) => {
    if (!session?.orgcode) return;
    try {
      const res = await fetch(`/api/inventory?orgcode=${session.orgcode}&voucherId=${voucherId}`);
      const data = await res.json();
      if (data.success && data.voucher) {
        setPrintingVoucher(data.voucher);
        setPrintingDetails(data.details || []);
        
        setTimeout(() => {
          window.print();
        }, 300);
      }
    } catch (e) {
      alert("Failed to load voucher for printing");
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
    const adminPassword = window.prompt("Enter Admin Password to authorize deletion of this voucher:");
    if (adminPassword === null) return; // User cancelled
    if (!adminPassword.trim()) {
      alert("Admin password is required!");
      return;
    }
    try {
      setTxnDeleting(true);
      setErrorMsg("");
      setSuccessMsg("");
      const res = await fetch(`/api/inventory?orgcode=${session.orgcode}&id=${voucherId}&password=${encodeURIComponent(adminPassword.trim())}`, {
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
      if (stock !== null && stock <= 0) {
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
        if (stock !== null && parseFloat(d.qty) > stock) {
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

  const filteredTxns = recentTransactions.filter((t) => {
    // 1. Simple search query
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      const formattedDate = t.transaction_date ? new Date(t.transaction_date).toLocaleDateString("en-IN") : "";
      const matchesSimple =
        String(t.sku).toLowerCase().includes(q) ||
        (t.item_name && t.item_name.toLowerCase().includes(q)) ||
        (t.party_name && t.party_name.toLowerCase().includes(q)) ||
        String(t.transaction_type).toLowerCase().includes(q) ||
        (t.transaction_type_name && t.transaction_type_name.toLowerCase().includes(q)) ||
        (t.reference_no && t.reference_no.toLowerCase().includes(q)) ||
        (t.remarks && t.remarks.toLowerCase().includes(q)) ||
        (t.from_location_name && t.from_location_name.toLowerCase().includes(q)) ||
        (t.to_location_name && t.to_location_name.toLowerCase().includes(q)) ||
        (t.stock_effect && t.stock_effect.toLowerCase().includes(q)) ||
        (t.transaction_date && t.transaction_date.toLowerCase().includes(q)) ||
        formattedDate.toLowerCase().includes(q) ||
        String(t.qty).toLowerCase().includes(q);
      if (!matchesSimple) return false;
    }

    // 2. Advanced fields
    if (advSkuItem.trim() !== "") {
      const q = advSkuItem.toLowerCase();
      const match = String(t.sku).toLowerCase().includes(q) || (t.item_name && t.item_name.toLowerCase().includes(q));
      if (!match) return false;
    }
    if (advDate.trim() !== "") {
      const formattedDate = t.transaction_date ? new Date(t.transaction_date).toISOString().split("T")[0] : "";
      if (formattedDate !== advDate) return false;
    }
    if (advType.trim() !== "") {
      const q = advType.toLowerCase();
      const match = (t.transaction_type_name && t.transaction_type_name.toLowerCase().includes(q)) || (t.stock_effect && t.stock_effect.toLowerCase().includes(q));
      if (!match) return false;
    }
    if (advLocation.trim() !== "") {
      const q = advLocation.toLowerCase();
      const match = (t.from_location_name && t.from_location_name.toLowerCase().includes(q)) || (t.to_location_name && t.to_location_name.toLowerCase().includes(q));
      if (!match) return false;
    }
    if (advQty.trim() !== "") {
      const q = advQty.toLowerCase();
      const match = String(t.qty).toLowerCase().includes(q);
      if (!match) return false;
    }
    if (advPartyRef.trim() !== "") {
      const q = advPartyRef.toLowerCase();
      const match = (t.party_name && t.party_name.toLowerCase().includes(q)) || (t.reference_no && t.reference_no.toLowerCase().includes(q));
      if (!match) return false;
    }

    return true;
  });

  const isSearchActive = 
    searchQuery.trim() !== "" ||
    advSkuItem.trim() !== "" ||
    advDate.trim() !== "" ||
    advType.trim() !== "" ||
    advLocation.trim() !== "" ||
    advQty.trim() !== "" ||
    advPartyRef.trim() !== "";

  const displayTxns = !isSearchActive ? filteredTxns.slice(0, 5) : filteredTxns;

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

                {/* ITEMIZED ROWS TABLE */}
                <div className="overflow-visible border border-slate-100 dark:border-slate-800/80 rounded-xl">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-55/40 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-850 text-slate-400 text-[10px] font-bold tracking-wider uppercase">
                        <th className="py-2 px-3 w-[65%]">Search Item Name or SKU*</th>
                        <th className="py-2 px-3 w-[20%] text-center">Qty</th>
                        <th className="py-2 px-3 w-[15%] text-right"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40 text-xs">
                      {voucherDetails.map((line, idx) => {
                        const suggestions = getItemSuggestions(line.searchText);
                        const stockAtLoc = line.sku ? getItemStock(line.sku) : null;
                        return (
                          <tr key={idx} className="hover:bg-slate-50/20 dark:hover:bg-slate-900/5 align-top">

                            {/* Item Input using global SkuInputWithPicker */}
                            <td className="py-2 px-3">
                              <SkuInputWithPicker
                                value={line.searchText}
                                onChange={(val) => updateDetailRowField(idx, "searchText", val)}
                                onPick={(item) => selectItemSuggestion(idx, item as any)}
                                items={items as any}
                                stockBalances={stockBalances}
                                fromLocationId={txnFromLoc || null}
                                fromLocationName={locations.find(l => String(l.id) === txnFromLoc)?.name}
                                isOutward={selectedType?.stock_effect === "OUTWARD"}
                                placeholder="Type item name / SKU..."
                                disabled={selectedFy?.is_closed}
                                inputClassName="p-1.5 text-xs rounded-lg"
                              />
                            </td>

                            {/* Quantity column — top aligned */}
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
                                className="w-20 p-1.5 bg-slate-50/50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700/80 rounded-lg text-center font-mono font-bold focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                              {selectedType?.stock_effect === "OUTWARD" && line.sku && stockAtLoc !== null && (
                                <div className="text-[9px] mt-1 font-bold">
                                  {parseFloat(line.qty) > stockAtLoc ? (
                                    <span className="text-rose-500 dark:text-rose-400 block">⚠️ Exceeds ({stockAtLoc})</span>
                                  ) : (
                                    <span className="text-slate-400 dark:text-slate-500 block">Avail: {stockAtLoc}</span>
                                  )}
                                </div>
                              )}
                            </td>

                            {/* Remove row button — top aligned */}
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

            {/* Show 5 latest vouchers */}
            <div className="bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-5 shadow-sm flex flex-col gap-3 mt-4">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">5 Latest Vouchers</h3>
                <p className="text-[10px] text-slate-400 font-semibold">Click a voucher to load it in edit mode</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {vouchers.slice(0, 5).map((v) => (
                  <div
                    key={v.id}
                    className="p-3 bg-slate-50/50 dark:bg-slate-900/30 rounded-xl border border-slate-150 dark:border-slate-800 text-left hover:border-blue-400 dark:hover:border-blue-500/50 transition-all flex flex-col gap-1.5 group relative"
                  >
                    <div className="flex justify-between items-center w-full pr-8">
                      <span className="font-extrabold text-[10px] text-slate-500 uppercase">
                        {v.type_name} {v.voucher_no ? `[#${v.voucher_no}]` : ""}
                      </span>
                      <span className="text-[9px] text-slate-450 font-mono">
                        {new Date(v.transaction_date).toLocaleDateString()}
                      </span>
                    </div>

                    <div 
                      onClick={() => handleLoadVoucher(v.id)}
                      className="flex flex-col gap-0.5 text-xs cursor-pointer"
                    >
                      <span className="font-bold text-slate-750 dark:text-slate-250 truncate max-w-[200px]">
                        Narration: {v.party_name || v.reference_no || v.remarks || "-"}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">
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

                    <button
                      type="button"
                      onClick={() => handlePrintVoucherById(v.id)}
                      className="absolute right-2 top-2 p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                      title="Print Voucher"
                    >
                      <PrinterIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                {vouchers.length === 0 && (
                  <p className="text-slate-400 text-[11px] py-4 md:col-span-2 text-center">No vouchers found in this financial year.</p>
                )}
              </div>
            </div>
          </div>

          {/* Ledger log (Right column) */}
          <div className="lg:col-span-1 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-4 shadow-sm flex flex-col gap-3">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-2 flex flex-col gap-2 relative">
              <h3 className="text-sm font-bold">Voucher Ledger Log</h3>
              
              <div className="flex gap-1.5 items-center">
                <div className="relative flex-1">
                  <MagnifyingGlassIcon className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3" />
                  <input
                    type="text"
                    placeholder="Search ledger entries..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-2.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs font-semibold"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (isSearchActive) {
                      setSearchQuery("");
                      setAdvSkuItem("");
                      setAdvDate("");
                      setAdvType("");
                      setAdvLocation("");
                      setAdvQty("");
                      setAdvPartyRef("");
                    } else {
                      setShowAdvSearch(!showAdvSearch);
                    }
                  }}
                  className={`p-2 border rounded-lg transition-colors flex items-center gap-1.5 font-bold text-xs ${
                    isSearchActive
                      ? "border-rose-300 bg-rose-50/50 text-rose-600 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-400"
                      : showAdvSearch 
                        ? "border-blue-500 bg-blue-50/20 text-blue-600 dark:bg-blue-950/30 dark:text-blue-450" 
                        : "border-slate-200 dark:border-slate-800 text-slate-550 hover:bg-slate-50 dark:hover:bg-slate-900"
                  }`}
                  title={isSearchActive ? "Clear all active filters" : "Advanced Search Filters"}
                >
                  {isSearchActive ? (
                    <>
                      <XMarkIcon className="w-4 h-4" />
                      <span>Clear</span>
                    </>
                  ) : (
                    <>
                      <AdjustmentsHorizontalIcon className="w-4 h-4" />
                      <span>Filters</span>
                    </>
                  )}
                </button>
              </div>

              {/* Advanced Search Overlay Card */}
              {showAdvSearch && (
                <div className="absolute top-[80px] left-0 right-0 bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800 rounded-2xl p-4 shadow-xl z-20 flex flex-col gap-3 animate-scale-up">
                  <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-850 pb-2">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Advanced Search</span>
                    <button 
                      type="button" 
                      onClick={() => {
                        setAdvSkuItem("");
                        setAdvDate("");
                        setAdvType("");
                        setAdvLocation("");
                        setAdvQty("");
                        setAdvPartyRef("");
                      }}
                      className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Clear All
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-400">SKU / Item</label>
                      <input 
                        type="text" 
                        value={advSkuItem} 
                        onChange={(e) => setAdvSkuItem(e.target.value)}
                        placeholder="e.g. 101, Birla" 
                        className="p-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-400">Date</label>
                      <input 
                        type="date" 
                        value={advDate} 
                        onChange={(e) => setAdvDate(e.target.value)}
                        className="p-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs w-full focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-400">Type / Effect</label>
                      <input 
                        type="text" 
                        value={advType} 
                        onChange={(e) => setAdvType(e.target.value)}
                        placeholder="e.g. Sale, INWARD" 
                        className="p-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-400">Location</label>
                      <input 
                        type="text" 
                        value={advLocation} 
                        onChange={(e) => setAdvLocation(e.target.value)}
                        placeholder="e.g. Godown" 
                        className="p-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-400">Quantity</label>
                      <input 
                        type="text" 
                        value={advQty} 
                        onChange={(e) => setAdvQty(e.target.value)}
                        placeholder="e.g. 10" 
                        className="p-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-400">Party / Ref</label>
                      <input 
                        type="text" 
                        value={advPartyRef} 
                        onChange={(e) => setAdvPartyRef(e.target.value)}
                        placeholder="e.g. Birla, REF123" 
                        className="p-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end pt-1">
                    <button 
                      type="button" 
                      onClick={() => setShowAdvSearch(false)}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 max-h-[500px] overflow-y-auto pr-1">
              {displayTxns.map((t) => (
                <div
                  key={t.id}
                  className="p-2.5 bg-slate-50/40 dark:bg-slate-900/30 rounded-xl border border-slate-100/80 dark:border-slate-800 flex flex-col gap-1.5 text-xs hover:border-blue-450 dark:hover:border-blue-500/50 hover:bg-slate-100/50 dark:hover:bg-slate-900/60 transition-all relative group"
                >
                  <div
                    onClick={() => t.transaction_header_id && handleLoadVoucher(Number(t.transaction_header_id))}
                    className="cursor-pointer flex flex-col gap-1.5 pr-8"
                    title="Click to edit this voucher"
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-750 dark:text-slate-250 truncate max-w-[170px] group-hover:text-blue-600 dark:group-hover:text-blue-400">
                        {t.item_name || t.sku}
                      </span>
                      <span className="font-mono text-[10px] text-slate-400">
                        {new Date(t.transaction_date).toLocaleDateString("en-IN")}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <div className="flex flex-col">
                        <span className="font-extrabold text-[9px] text-slate-500 uppercase">
                          Voucher No: #{t.voucher_no || t.transaction_header_id} ({t.transaction_type_name || t.transaction_type})
                        </span>
                        {t.from_location_name || t.to_location_name ? (
                          <span className="text-[9px] text-slate-400 font-mono">
                            {t.from_location_name || "Outside"} ➔ {t.to_location_name || "Outside"}
                          </span>
                        ) : null}
                      </div>
                      
                      <div className="flex flex-col items-end gap-0.5">
                        <span className="font-mono font-black text-xs text-slate-800 dark:text-slate-100">
                          Qty: {parseFloat(t.qty).toLocaleString('en-IN')}
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

                  <button
                    type="button"
                    onClick={() => t.transaction_header_id && handlePrintVoucherById(Number(t.transaction_header_id))}
                    className="absolute right-2 top-2 p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-slate-450 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    title="Print Voucher"
                  >
                    <PrinterIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {displayTxns.length === 0 && (
                <p className="text-slate-400 text-xs py-6 text-center">No ledger entries found.</p>
              )}
            </div>
          </div>
        </div>
      )}


      {/* Hidden Print Voucher Layout */}
      {printingVoucher !== null && (
        <div className="hidden print:block print-area">
          <div style={{ padding: "0px", fontFamily: "Courier, 'Courier New', monospace", color: "#000", maxWidth: "800px", margin: "0 auto" }}>
            
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #000", paddingBottom: "8px", marginBottom: "12px" }}>
              <div>
                <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "bold", letterSpacing: "1px" }}>INVENTORY VOUCHER</h1>
                <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#666" }}>ORGANIZATION CODE: {session?.orgcode}</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <span style={{ fontSize: "11px", fontWeight: "bold", padding: "4px 8px", border: "1px solid #000", textTransform: "uppercase" }}>
                  {printingVoucher.stock_effect || "TRANSACTION"}
                </span>
              </div>
            </div>

            {/* Meta Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", fontSize: "11px", marginBottom: "16px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <div><strong>Voucher No:</strong> #{printingVoucher.voucher_no || printingVoucher.id}</div>
                <div><strong>Voucher Date:</strong> {new Date(printingVoucher.transaction_date).toLocaleDateString("en-IN")}</div>
                <div><strong>Transaction Type:</strong> {printingVoucher.type_name} ({printingVoucher.type_code})</div>
                {printingVoucher.reference_no && <div><strong>Reference / Bill No:</strong> {printingVoucher.reference_no}</div>}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <div><strong>Source (From):</strong> {printingVoucher.from_location_name || (printingVoucher.stock_effect === "INWARD" ? printingVoucher.party_name : "Outside / Vendor") || "-"}</div>
                <div><strong>Destination (To):</strong> {printingVoucher.to_location_name || (printingVoucher.stock_effect === "OUTWARD" ? printingVoucher.party_name : "Outside / Customer") || "-"}</div>
                {printingVoucher.party_name && <div><strong>Party / Customer / Vendor:</strong> {printingVoucher.party_name}</div>}
              </div>
            </div>

            {/* Remarks */}
            {printingVoucher.remarks && (
              <div style={{ fontSize: "11px", marginBottom: "16px", padding: "8px", border: "1px dashed #999", borderRadius: "4px" }}>
                <strong>Remarks / Narration:</strong> {printingVoucher.remarks}
              </div>
            )}

            {/* Items Table */}
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px", marginBottom: "16px" }}>
              <thead>
                <tr style={{ borderTop: "2px solid #000", borderBottom: "2px solid #000", background: "#f8fafc" }}>
                  <th style={{ textAlign: "left", padding: "6px", width: "8%", fontWeight: "bold" }}>S.No</th>
                  <th style={{ textAlign: "left", padding: "6px", width: "20%", fontWeight: "bold" }}>SKU</th>
                  <th style={{ textAlign: "left", padding: "6px", width: "52%", fontWeight: "bold" }}>Item Description</th>
                  <th style={{ textAlign: "right", padding: "6px", width: "20%", fontWeight: "bold" }}>Quantity</th>
                </tr>
              </thead>
              <tbody>
                {printingDetails.map((line: any, idx: number) => (
                  <tr key={idx} style={{ borderBottom: "1px solid #ddd" }}>
                    <td style={{ padding: "6px" }}>{idx + 1}</td>
                    <td style={{ padding: "6px" }}>{line.sku}</td>
                    <td style={{ padding: "6px" }}>{line.item_name || `Item SKU: ${line.sku}`}</td>
                    <td style={{ textAlign: "right", padding: "6px", fontWeight: "bold" }}>{parseFloat(line.qty || "0").toLocaleString('en-IN')}</td>
                  </tr>
                ))}
                {/* Total Row */}
                <tr style={{ borderTop: "2px solid #000", borderBottom: "2px solid #000", fontWeight: "bold" }}>
                  <td colSpan={2} style={{ padding: "6px" }}>Total Unique Items: {printingDetails.length}</td>
                  <td style={{ textAlign: "right", padding: "6px" }}>Total Qty:</td>
                  <td style={{ textAlign: "right", padding: "6px" }}>
                    {printingDetails.reduce((sum: number, line: any) => sum + parseFloat(line.qty || "0"), 0).toLocaleString('en-IN')}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Signatures */}
            <div style={{ marginTop: "30px", display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ borderTop: "1px solid #000", width: "150px", paddingTop: "5px" }}>
                  Prepared By
                </div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ borderTop: "1px solid #000", width: "150px", paddingTop: "5px" }}>
                  Verified / Checked By
                </div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ borderTop: "1px solid #000", width: "150px", paddingTop: "5px" }}>
                  Authorized Signatory
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Print styles */}
      <style jsx global>{`
        @page {
          size: auto;
          margin: 12mm 10mm 12mm 10mm;
        }
        @media print {
          html, body {
            height: auto !important;
            overflow: initial !important;
          }
          body {
            visibility: hidden !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print-area, .print-area * {
            visibility: visible !important;
          }
          .print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>
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
