"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function PrintLedgerContent() {
  const searchParams = useSearchParams();
  const phone = searchParams.get("phone");
  const orgcode = searchParams.get("orgcode");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<{
    customer?: { name: string; phone: string; address: string };
    orgname?: string;
    transactions: any[];
    kpis: any;
  } | null>(null);

  useEffect(() => {
    if (!phone || !orgcode) {
      setError("Missing required parameters: phone, orgcode");
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const ledgerRes = await fetch(`/api/ledger?orgcode=${orgcode}&phone=${phone}`);
        const ledgerData = await ledgerRes.json();

        if (!ledgerRes.ok || !ledgerData.success) {
          throw new Error(ledgerData.message || "Failed to fetch ledger data");
        }

        let orgname = orgcode.toUpperCase();
        try {
          const compRes = await fetch(`/api/company?orgcode=${orgcode}`);
          const compData = await compRes.json();
          if (compData.success && compData.company && compData.company.orgname) {
            orgname = compData.company.orgname;
          }
        } catch (e) {}

        // Group slips
        const slipsMap = new Map();
        (ledgerData.slips || []).forEach((s: any) => {
          if (!slipsMap.has(s.no)) {
            slipsMap.set(s.no, {
              type: 'slip',
              date: new Date(s.time),
              no: s.no,
              particulars: s.item,
              debit: parseFloat(s.amt) || 0,
              credit: 0
            });
          } else {
            const existing = slipsMap.get(s.no);
            existing.debit += (parseFloat(s.amt) || 0);
            if (!existing.particulars.includes(s.item)) {
              existing.particulars += `, ${s.item}`;
            }
          }
        });

        const payments = (ledgerData.payments || []).map((p: any) => ({
          type: 'payment',
          date: new Date(p.time),
          no: '-',
          particulars: p.narration || 'Payment Received',
          debit: 0,
          credit: parseFloat(p.amt) || 0
        }));

        const allTransactions = [...Array.from(slipsMap.values()), ...payments].sort((a, b) => a.date.getTime() - b.date.getTime());

        let runningBalance = 0;
        const transactionsWithBalance = allTransactions.map(t => {
          runningBalance += (t.debit - t.credit);
          return { ...t, balance: runningBalance };
        });

        setData({
          customer: ledgerData.customer || { name: "", phone, address: "" },
          orgname,
          transactions: transactionsWithBalance,
          kpis: ledgerData.kpis
        });
        
        document.title = `${phone} - ${ledgerData.customer?.name || 'Customer'} - Ledger`;
      } catch (err: any) {
        setError(err.message || "An error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [phone, orgcode]);

  useEffect(() => {
    if (!loading && data) {
      setTimeout(() => {
        window.print();
      }, 500);
    }
  }, [loading, data]);

  if (loading) return <div className="p-10 font-sans text-center">Loading ledger statement...</div>;
  if (error || !data) return <div className="p-10 font-sans text-red-600 text-center">Error: {error}</div>;

  return (
    <div className="bg-white text-black font-sans w-full max-w-[800px] mx-auto p-8 print:p-0 print:max-w-none print:w-full">
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page { size: A4; margin: 1cm; }
          body { background-color: white; -webkit-print-color-adjust: exact; color-adjust: exact; }
        }
      `}} />
      <div className="border-2 border-black p-6 relative min-h-[900px] flex flex-col">
        {/* Header */}
        <div className="text-center pb-4 border-b-2 border-black">
          <h1 className="text-3xl font-bold uppercase tracking-widest mt-2">Ledger Statement</h1>
        </div>

        {/* Details Section */}
        <div className="flex justify-between py-4 border-b-2 border-black text-sm">
          <div className="flex flex-col gap-1 w-1/2 pr-4 border-r-2 border-black">
            <div><span className="font-semibold text-gray-600">Account Of:</span></div>
            <div className="font-bold text-lg uppercase">{data.customer?.name || "Customer"}</div>
            <div><span className="font-semibold">Phone:</span> {data.customer?.phone}</div>
            {data.customer?.address && <div><span className="font-semibold">Address:</span> {data.customer?.address}</div>}
          </div>
          <div className="flex flex-col gap-1 w-1/2 pl-4 justify-center">
            <div className="flex justify-between items-center"><span className="font-semibold text-gray-600">Total Billed:</span> <span className="font-bold text-slate-800">₹{data.kpis?.slipsTotal?.toFixed(2) || "0.00"}</span></div>
            <div className="flex justify-between items-center"><span className="font-semibold text-gray-600">Total Paid:</span> <span className="font-bold text-green-700">₹{data.kpis?.paymentsTotal?.toFixed(2) || "0.00"}</span></div>
            <div className="flex justify-between items-center mt-2 pt-2 border-t border-dashed border-gray-400"><span className="font-bold text-lg">Net Outstanding:</span> <span className={`font-bold text-lg ${data.kpis?.outstanding > 0 ? 'text-red-600' : 'text-green-600'}`}>₹{data.kpis?.outstanding?.toFixed(2) || "0.00"}</span></div>
          </div>
        </div>

        {/* Items Table */}
        <div className="flex-1 mt-4">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border-2 border-black px-3 py-2 w-24">Date</th>
                <th className="border-2 border-black px-3 py-2">Particulars</th>
                <th className="border-2 border-black px-3 py-2 text-center w-16">Ref</th>
                <th className="border-2 border-black px-3 py-2 text-right w-24">Debit (₹)</th>
                <th className="border-2 border-black px-3 py-2 text-right w-24">Credit (₹)</th>
                <th className="border-2 border-black px-3 py-2 text-right w-28">Balance (₹)</th>
              </tr>
            </thead>
            <tbody>
              {data.transactions.map((t, idx) => (
                <tr key={idx}>
                  <td className="border-2 border-black border-t-0 px-3 py-2 whitespace-nowrap">{t.date.toLocaleDateString('en-IN')}</td>
                  <td className="border-2 border-black border-t-0 px-3 py-2">
                    <div className="font-medium text-xs text-gray-800">{t.type === 'slip' ? 'Sales / Services' : 'Payment Received'}</div>
                    <div className="text-xs text-gray-600 mt-0.5 truncate max-w-[200px]" title={t.particulars}>{t.particulars}</div>
                  </td>
                  <td className="border-2 border-black border-t-0 px-3 py-2 text-center text-xs">{t.type === 'slip' ? `#${t.no}` : '-'}</td>
                  <td className="border-2 border-black border-t-0 px-3 py-2 text-right text-red-700">{t.debit > 0 ? t.debit.toFixed(2) : ''}</td>
                  <td className="border-2 border-black border-t-0 px-3 py-2 text-right text-green-700">{t.credit > 0 ? t.credit.toFixed(2) : ''}</td>
                  <td className="border-2 border-black border-t-0 px-3 py-2 text-right font-semibold">{Math.abs(t.balance).toFixed(2)} {t.balance > 0 ? 'Dr' : t.balance < 0 ? 'Cr' : ''}</td>
                </tr>
              ))}
              {data.transactions.length === 0 && (
                <tr>
                  <td colSpan={6} className="border-2 border-black border-t-0 px-3 py-8 text-center text-gray-500">No transactions found for this account.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Footer */}
        <div className="mt-8 text-center text-xs text-gray-500 pb-2">
          This is a computer generated ledger statement.
        </div>
      </div>
    </div>
  );
}

export default function PrintLedgerPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center">Loading...</div>}>
      <PrintLedgerContent />
    </Suspense>
  );
}
