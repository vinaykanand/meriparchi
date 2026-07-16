"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

// Number to words converter for Indian Rupees
function numberToWords(num: number): string {
  if (num === 0) return "Zero Rupees Only";
  const a = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const n = ("000000000" + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!n) return "";
  let str = "";
  str += (Number(n[1]) != 0) ? (a[Number(n[1])] || b[n[1][0] as any] + " " + a[n[1][1] as any]) + " Crore " : "";
  str += (Number(n[2]) != 0) ? (a[Number(n[2])] || b[n[2][0] as any] + " " + a[n[2][1] as any]) + " Lakh " : "";
  str += (Number(n[3]) != 0) ? (a[Number(n[3])] || b[n[3][0] as any] + " " + a[n[3][1] as any]) + " Thousand " : "";
  str += (Number(n[4]) != 0) ? (a[Number(n[4])] || b[n[4][0] as any] + " " + a[n[4][1] as any]) + " Hundred " : "";
  str += (Number(n[5]) != 0) ? ((str != "") ? "and " : "") + (a[Number(n[5])] || b[n[5][0] as any] + " " + a[n[5][1] as any]) : "";
  return str.trim() + " Rupees Only";
}

function PrintSlipContent() {
  const searchParams = useSearchParams();
  const phone = searchParams.get("phone");
  const slipno = searchParams.get("slipno");
  const orgcode = searchParams.get("orgcode");
  const format = searchParams.get("format") || "compact"; // 'a4' or 'compact'

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<{
    customer?: { name: string; phone: string; address: string };
    orgname?: string;
    slips: any[];
    total: number;
    date: string;
    kpis: any;
    payments: any[];
  } | null>(null);

  useEffect(() => {
    if (!phone || !slipno || !orgcode) {
      setError("Missing required parameters: phone, slipno, orgcode");
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        // Fetch ledger data
        const ledgerRes = await fetch(`/api/ledger?orgcode=${orgcode}&phone=${phone}`);
        const ledgerData = await ledgerRes.json();

        if (!ledgerRes.ok || !ledgerData.success) {
          throw new Error(ledgerData.message || "Failed to fetch ledger data");
        }

        // Fetch company info (assuming an API exists, else fallback to orgcode)
        // For simplicity, we try to fetch from an existing API or just use orgcode
        let orgname = orgcode.toUpperCase();
        try {
          const compRes = await fetch(`/api/company?orgcode=${orgcode}`);
          const compData = await compRes.json();
          if (compData.success && compData.company && compData.company.orgname) {
            orgname = compData.company.orgname;
          }
        } catch (e) {
           // ignore, use fallback
        }

        const allSlips = ledgerData.slips || [];
        const slipItems = allSlips.filter((s: any) => s.no.toString() === slipno);

        if (slipItems.length === 0) {
          throw new Error("Slip not found");
        }

        const total = slipItems.reduce((acc: number, item: any) => acc + (parseFloat(item.amt) || 0), 0);
        const slipDate = slipItems[0]?.time;

        setData({
          customer: ledgerData.customer || { name: "", phone, address: "" },
          orgname,
          slips: slipItems,
          total,
          date: slipDate,
          kpis: ledgerData.kpis,
          payments: ledgerData.payments || []
        });
        
        document.title = `${phone} - ${ledgerData.customer?.name || 'Customer'} - Slip ${slipno}`;
      } catch (err: any) {
        setError(err.message || "An error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [phone, slipno, orgcode]);

  useEffect(() => {
    // Automatically open print dialog once data is loaded and rendered
    if (!loading && data) {
      setTimeout(() => {
        window.print();
      }, 500);
    }
  }, [loading, data]);

  if (loading) {
    return <div className="p-10 font-sans text-center">Loading print preview...</div>;
  }

  if (error || !data) {
    return <div className="p-10 font-sans text-red-600 text-center">Error: {error}</div>;
  }

  if (format === "compact") {
    // THERMAL RECEIPT FORMAT (Compact)
    return (
      <div className="bg-white text-black font-mono w-full max-w-[300px] mx-auto text-sm p-4 print:p-0 print:max-w-none print:w-full">
        <style dangerouslySetInnerHTML={{__html: `
          @media print {
            @page { margin: 0; }
            body { margin: 0; padding: 0.5cm; font-family: monospace; }
          }
        `}} />
        <div className="text-center pb-2 border-b border-dashed border-black mb-2">
          <h1 className="text-xl font-bold uppercase">SLIP DETAIL / ESTIMATE</h1>
        </div>
        
        <div className="mb-2 text-xs">
          <div><span className="font-bold">Slip No:</span> {slipno}</div>
          <div><span className="font-bold">Date:</span> {new Date(data.date).toLocaleDateString('en-IN', {day:'2-digit', month:'2-digit', year:'numeric'})} {new Date(data.date).toLocaleTimeString('en-IN', {hour:'2-digit', minute:'2-digit'})}</div>
          <div className="mt-1"><span className="font-bold">Name:</span> {data.customer?.name || "Cash Customer"}</div>
          <div><span className="font-bold">Mob:</span> {data.customer?.phone}</div>
        </div>

        <div className="border-t border-b border-dashed border-black py-1 mb-2 text-xs">
          <table className="w-full text-left">
            <thead>
              <tr>
                <th className="font-bold py-1 w-1/2">Item</th>
                <th className="font-bold py-1 text-right">Qty</th>
                <th className="font-bold py-1 text-right">Amt</th>
              </tr>
            </thead>
            <tbody>
              {data.slips.map((item, idx) => (
                <tr key={idx}>
                  <td className="py-1 align-top pr-1 whitespace-pre-wrap">
                    {item.item} <span className="text-[10px]">@ ₹{parseFloat(item.rate).toFixed(2)}</span>
                    {item.remarks && <div className="text-[10px] text-gray-600 italic">- {item.remarks}</div>}
                  </td>
                  <td className="py-1 align-top text-right pr-1">{item.qty}</td>
                  <td className="py-1 align-top text-right">₹{item.amt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-between items-center font-bold text-sm border-b border-dashed border-black pb-2 mb-2">
          <span>TOTAL:</span>
          <span>₹{data.total.toFixed(2)}</span>
        </div>

        {data.payments && data.payments.length > 0 && (
          <div className="border-b border-dashed border-black pb-2 mb-2 text-xs">
            <div className="font-bold mb-1">Payment History:</div>
            {data.payments.map((p: any, idx: number) => (
              <div key={idx} className="flex justify-between mb-1">
                <div className="flex flex-col">
                  <span>{new Date(p.time).toLocaleDateString('en-IN', {day:'2-digit', month:'2-digit', year:'numeric'})}</span>
                  {p.narration && <span className="text-[10px] italic text-gray-600">{p.narration}</span>}
                </div>
                <span>₹{parseFloat(p.amt).toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}

        <div className="border-b border-dashed border-black pb-2 mb-2 text-[10px]">
          <div className="font-bold mb-1">Account Summary:</div>
          <div className="flex justify-between"><span>Previous Outstanding:</span> <span>₹{data.kpis?.slipsTotal?.toFixed(2) || "0.00"}</span></div>
          <div className="flex justify-between"><span>Total Paid:</span> <span>₹{data.kpis?.paymentsTotal?.toFixed(2) || "0.00"}</span></div>
          <div className="flex justify-between font-bold mt-0.5 border-t border-dashed border-black pt-0.5"><span>Net Outstanding:</span> <span>₹{data.kpis?.outstanding?.toFixed(2) || "0.00"}</span></div>
        </div>

        <div className="text-center text-xs mt-4">
          *** Thank You! ***
        </div>
      </div>
    );
  }

  // A4 FORMAT (Indian Ledger / Tax Invoice Style)
  return (
    <div className="bg-white text-black font-sans w-full max-w-[800px] mx-auto p-4 print:p-0 print:max-w-none print:w-full text-xs">
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page { size: A4; margin: 0.5cm; }
          body { background-color: white; -webkit-print-color-adjust: exact; color-adjust: exact; }
        }
      `}} />
      <div className="relative flex flex-col">
        {/* Header */}
        <div className="text-center pb-1 border-b-[0.3px] border-black/50">
          <h1 className="text-base font-bold uppercase tracking-wider mt-0.5">Slip Detail / Estimate</h1>
        </div>

        {/* Details Section */}
        <div className="flex justify-between py-1 text-[11px]">
          <div className="flex flex-col gap-0.5 w-1/2 pr-2 border-r-[0.3px] border-black/50">
            <div className="font-bold text-sm uppercase">{data.customer?.name || "Cash Customer"}</div>
            <div><span className="font-semibold">Phone:</span> {data.customer?.phone}</div>
            {data.customer?.address && <div><span className="font-semibold">Address:</span> {data.customer?.address}</div>}
          </div>
          <div className="flex flex-col gap-0.5 w-1/2 pl-2">
            <div><span className="font-semibold">Slip No:</span> <span className="font-bold">{slipno}</span></div>
            <div><span className="font-semibold">Date:</span> {new Date(data.date).toLocaleDateString('en-IN')}</div>
            <div><span className="font-semibold">Time:</span> {new Date(data.date).toLocaleTimeString('en-IN')}</div>
          </div>
        </div>

        {/* Items Table */}
        <div className="flex-1">
          <table className="w-full text-left text-[11px] mt-2 border-collapse border-[0.3px] border-black/50">
            <thead>
              <tr className="border-b-[0.3px] border-black/50">
                <th className="border-r-[0.3px] border-black/50 px-2 py-1 w-10 text-center">S.No</th>
                <th className="border-r-[0.3px] border-black/50 px-2 py-1">Particulars</th>
                <th className="border-r-[0.3px] border-black/50 px-2 py-1 text-right w-16">Qty</th>
                <th className="border-r-[0.3px] border-black/50 px-2 py-1 text-right w-20">Rate (₹)</th>
                <th className="px-2 py-1 text-right w-24">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              {data.slips.map((item, idx) => (
                <tr key={idx} className="border-none">
                  <td className="border-r-[0.3px] border-black/50 px-2 py-0.5 text-center">{idx + 1}</td>
                  <td className="border-r-[0.3px] border-black/50 px-2 py-0.5">
                    <span className="font-semibold">{item.item}</span>
                    {item.remarks && <span className="text-[10px] text-gray-600 italic ml-2">- {item.remarks}</span>}
                  </td>
                  <td className="border-r-[0.3px] border-black/50 px-2 py-0.5 text-right">{item.qty}</td>
                  <td className="border-r-[0.3px] border-black/50 px-2 py-0.5 text-right">{parseFloat(item.rate).toFixed(2)}</td>
                  <td className="px-2 py-0.5 text-right">{parseFloat(item.amt).toFixed(2)}</td>
                </tr>
              ))}
              {/* Total row directly in table */}
              <tr className="border-t-[0.3px] border-black/50 font-bold">
                <td colSpan={2} className="border-r-[0.3px] border-black/50 px-2 py-1 text-right">Total:</td>
                <td className="border-r-[0.3px] border-black/50 px-2 py-1 text-right">
                  {data.slips.reduce((sum, item) => sum + (parseFloat(item.qty) || 0), 0)}
                </td>
                <td className="border-r-[0.3px] border-black/50 px-2 py-1 text-right"></td>
                <td className="px-2 py-1 text-right">₹{data.total.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>

          {data.payments && data.payments.length > 0 && (
            <div className="mt-2 mb-2">
              <div className="font-bold text-[11px] mb-0.5 border-[0.3px] border-black/50 border-b-0 px-2 py-0.5">Payment History</div>
              <table className="w-full text-left text-[10px] border-collapse border-[0.3px] border-black/50">
                <thead>
                  <tr className="border-b-[0.3px] border-black/50">
                    <th className="border-r-[0.3px] border-black/50 px-2 py-0.5 w-24">Date</th>
                    <th className="border-r-[0.3px] border-black/50 px-2 py-0.5">Narration</th>
                    <th className="px-2 py-0.5 text-right w-24">Amount Paid (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {data.payments.map((p: any, idx: number) => (
                    <tr key={idx} className="border-none">
                      <td className="border-r-[0.3px] border-black/50 px-2 py-0.5">{new Date(p.time).toLocaleDateString('en-IN')}</td>
                      <td className="border-r-[0.3px] border-black/50 px-2 py-0.5">{p.narration || "-"}</td>
                      <td className="px-2 py-0.5 text-right text-green-700 font-semibold">{parseFloat(p.amt).toFixed(2)}</td>
                    </tr>
                  ))}
                  {/* Closing line */}
                  <tr className="border-t-[0.3px] border-black/50">
                    <td className="border-r-[0.3px] border-black/50 py-0.5"></td>
                    <td className="border-r-[0.3px] border-black/50 py-0.5"></td>
                    <td className="py-0.5"></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer / Total */}
        <div className="border-t-[0.3px] border-black/50 pt-2 mt-2">
          <div className="flex justify-between items-start">
            <div className="w-2/3 pr-4">
              <div className="text-[10px] font-semibold">Amount in Words:</div>
              <div className="italic text-[10px] mt-0.5">{numberToWords(Math.round(data.total))}</div>
            </div>
            <div className="w-1/3">
              <div className="border-[0.3px] border-black/50 p-1.5 text-[10px]">
                <div className="font-bold mb-0.5 border-b-[0.3px] border-gray-300 pb-0.5">Account Summary</div>
                <div className="flex justify-between mb-0.5"><span>Previous Outstanding:</span> <span>₹{data.kpis?.slipsTotal?.toFixed(2) || "0.00"}</span></div>
                <div className="flex justify-between mb-0.5"><span>Total Paid:</span> <span className="text-green-700">₹{data.kpis?.paymentsTotal?.toFixed(2) || "0.00"}</span></div>
                <div className="flex justify-between font-bold mt-0.5 pt-0.5 border-t-[0.3px] border-gray-300"><span>Net Outstanding:</span> <span className={data.kpis?.outstanding > 0 ? "text-red-700" : ""}>₹{data.kpis?.outstanding?.toFixed(2) || "0.00"}</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PrintSlipPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center">Loading...</div>}>
      <PrintSlipContent />
    </Suspense>
  );
}
