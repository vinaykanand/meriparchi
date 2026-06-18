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

        // Expand every slip item into a separate transaction row
        const allTransactions: any[] = [];
        let totalDebit = 0;
        let totalCredit = 0;

        (ledgerData.slips || []).forEach((s: any) => {
          const qty = parseFloat(s.qty) || 0;
          const rate = parseFloat(s.rate) || 0;
          const amt = parseFloat(s.amt) || 0;
          const isReturn = qty < 0;

          const debit = isReturn ? 0 : Math.abs(amt);
          const credit = isReturn ? Math.abs(amt) : 0;

          allTransactions.push({
            type: 'slip',
            isReturn,
            date: new Date(s.time),
            particulars: (
              <>
                <div>
                  <span className="font-bold">{s.item}</span>
                  {s.remarks && <span className="font-light italic text-gray-600 ml-1">- {s.remarks}</span>}
                </div>
                <div className="text-gray-700">@ {rate} x {Math.abs(qty)} Qty, Slip: {s.no}</div>
              </>
            ),
            debit,
            credit,
            sortKey: new Date(s.time).getTime()
          });
        });

        (ledgerData.payments || []).forEach((p: any) => {
          const credit = parseFloat(p.amt) || 0;
          allTransactions.push({
            type: 'payment',
            date: new Date(p.time),
            particulars: p.narration ? (
              <>
                <div className="font-bold">Payment clear</div>
                <div className="font-light italic text-gray-600">{p.narration}</div>
              </>
            ) : <span className="font-bold">Payment clear</span>,
            debit: 0,
            credit,
            sortKey: new Date(p.time).getTime() + 1 // Sort slightly after slips
          });
        });

        allTransactions.sort((a, b) => a.sortKey - b.sortKey);

        let runningBalance = 0;
        const transactionsWithBalance = allTransactions.map(t => {
          runningBalance += (t.debit - t.credit);
          totalDebit += t.debit;
          totalCredit += t.credit;
          return { ...t, balance: runningBalance };
        });

        setData({
          customer: ledgerData.customer || { name: "", phone, address: "" },
          orgname,
          transactions: transactionsWithBalance,
          kpis: ledgerData.kpis,
          totals: { debit: totalDebit, credit: totalCredit }
        } as any);
        
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
    <div className="bg-white text-black font-sans w-full max-w-[800px] mx-auto p-8 print:p-0 print:max-w-none print:w-full print:block">
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page { size: A4; margin: 10mm; }
          body { background-color: white; -webkit-print-color-adjust: exact; color-adjust: exact; margin: 0; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          thead { display: table-header-group; }
          tfoot { display: table-footer-group; }
        }
      `}} />
      <div className="border-2 border-black p-6 print:border-none print:p-0">
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
        <div className="mt-4">
          <table className="w-full text-left text-sm border-collapse" style={{ pageBreakInside: 'auto' }}>
            <thead style={{ display: 'table-header-group' }}>
              <tr className="bg-gray-100">
                <th className="border-2 border-black px-3 py-2 w-24">Date</th>
                <th className="border-2 border-black px-3 py-2">Particular</th>
                <th className="border-2 border-black px-3 py-2 text-right w-28">Debit</th>
                <th className="border-2 border-black px-3 py-2 text-right w-28">Credit</th>
                <th className="border-2 border-black px-3 py-2 text-right w-28">Balance</th>
              </tr>
            </thead>
            <tbody>
              {data.transactions.map((t, idx) => (
                <tr key={idx} style={{ pageBreakInside: 'avoid', pageBreakAfter: 'auto' }}>
                  <td className="border-2 border-black border-t-0 px-3 py-2 whitespace-nowrap align-top">{t.date.toLocaleDateString('en-IN')}</td>
                  <td className="border-2 border-black border-t-0 px-3 py-2 align-top whitespace-pre-wrap">{t.particulars}</td>
                  <td className="border-2 border-black border-t-0 px-3 py-2 text-right align-top">{t.debit > 0 ? t.debit.toFixed(2) : ''}</td>
                  <td className={`border-2 border-black border-t-0 px-3 py-2 text-right align-top ${t.isReturn ? 'text-red-600 font-bold' : ''}`}>{t.credit > 0 ? t.credit.toFixed(2) : ''}</td>
                  <td className="border-2 border-black border-t-0 px-3 py-2 text-right align-top">{Math.abs(t.balance).toFixed(2)}</td>
                </tr>
              ))}
              {data.transactions.length === 0 && (
                <tr>
                  <td colSpan={5} className="border-2 border-black border-t-0 px-3 py-8 text-center text-gray-500">No transactions found for this account.</td>
                </tr>
              )}
              {data.transactions.length > 0 && (
                <tr className="font-bold">
                  <td colSpan={2} className="border-2 border-black border-t-0 px-3 py-2 text-center text-lg">Total</td>
                  <td className="border-2 border-black border-t-0 px-3 py-2 text-right">{(data as any).totals.debit.toFixed(2)}</td>
                  <td className="border-2 border-black border-t-0 px-3 py-2 text-right">{(data as any).totals.credit.toFixed(2)}</td>
                  <td className="border-2 border-black border-t-0 px-3 py-2"></td>
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
