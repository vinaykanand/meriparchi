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
          <h1 className="text-xl font-bold uppercase">SLIP DETAILS</h1>
        </div>
        
        <div className="mb-2 text-xs">
          <div><span className="font-bold">Slip No:</span> {slipno}</div>
          <div><span className="font-bold">Date:</span> {new Date(data.date).toLocaleDateString('en-IN', {day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit'})}</div>
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
                  <td className="py-1 align-top pr-1 whitespace-pre-wrap">{item.item}
                    {item.remarks && <div className="text-[10px] text-gray-600 italic">({item.remarks})</div>}
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

        <div className="text-center text-xs mt-4">
          *** Thank You! ***
        </div>
      </div>
    );
  }

  // A4 FORMAT (Indian Ledger / Tax Invoice Style)
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
          <h1 className="text-3xl font-bold uppercase tracking-widest mt-2">Slip Details</h1>
        </div>

        {/* Details Section */}
        <div className="flex justify-between py-4 border-b-2 border-black text-sm">
          <div className="flex flex-col gap-1 w-1/2 pr-4 border-r-2 border-black">
            <div><span className="font-semibold text-gray-600">Billed To:</span></div>
            <div className="font-bold text-lg uppercase">{data.customer?.name || "Cash Customer"}</div>
            <div><span className="font-semibold">Phone:</span> {data.customer?.phone}</div>
            {data.customer?.address && <div><span className="font-semibold">Address:</span> {data.customer?.address}</div>}
          </div>
          <div className="flex flex-col gap-1 w-1/2 pl-4">
            <div><span className="font-semibold">Slip No:</span> <span className="font-bold">{slipno}</span></div>
            <div><span className="font-semibold">Date:</span> {new Date(data.date).toLocaleDateString('en-IN')}</div>
            <div><span className="font-semibold">Time:</span> {new Date(data.date).toLocaleTimeString('en-IN')}</div>
          </div>
        </div>

        {/* Items Table */}
        <div className="flex-1">
          <table className="w-full text-left text-sm mt-4 border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border-2 border-black px-3 py-2 w-16 text-center">S.No</th>
                <th className="border-2 border-black px-3 py-2">Particulars</th>
                <th className="border-2 border-black px-3 py-2 text-right w-24">Qty</th>
                <th className="border-2 border-black px-3 py-2 text-right w-32">Rate (₹)</th>
                <th className="border-2 border-black px-3 py-2 text-right w-32">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              {data.slips.map((item, idx) => (
                <tr key={idx}>
                  <td className="border-2 border-black border-t-0 px-3 py-2 text-center">{idx + 1}</td>
                  <td className="border-2 border-black border-t-0 px-3 py-2">
                    <div className="font-semibold">{item.item}</div>
                    {item.remarks && <div className="text-xs text-gray-600 mt-0.5">{item.remarks}</div>}
                  </td>
                  <td className="border-2 border-black border-t-0 px-3 py-2 text-right">{item.qty}</td>
                  <td className="border-2 border-black border-t-0 px-3 py-2 text-right">{parseFloat(item.rate).toFixed(2)}</td>
                  <td className="border-2 border-black border-t-0 px-3 py-2 text-right">{parseFloat(item.amt).toFixed(2)}</td>
                </tr>
              ))}
              {/* Empty rows to stretch table if needed */}
              {Array.from({ length: Math.max(0, 10 - data.slips.length) }).map((_, i) => (
                <tr key={'empty-'+i}>
                  <td className="border-x-2 border-black py-4"></td>
                  <td className="border-x-2 border-black py-4"></td>
                  <td className="border-x-2 border-black py-4"></td>
                  <td className="border-x-2 border-black py-4"></td>
                  <td className="border-x-2 border-black py-4"></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer / Total */}
        <div className="border-t-2 border-black pt-4 mt-auto">
          <div className="flex justify-between items-start">
            <div className="w-2/3 pr-8">
              <div className="text-sm font-semibold">Amount in Words:</div>
              <div className="italic text-sm mt-1">{numberToWords(Math.round(data.total))}</div>
            </div>
            <div className="w-1/3">
              <div className="flex justify-between border-2 border-black px-4 py-2 bg-gray-100">
                <span className="font-bold text-lg">Grand Total:</span>
                <span className="font-bold text-lg">₹{data.total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-between mt-12 pt-4">
            <div className="text-xs text-gray-500">
              * Subject to local jurisdiction.<br/>
              * E. & O. E.
            </div>
            <div className="text-center">
              <div className="w-48 border-b-2 border-black mb-1"></div>
              <div className="font-bold text-sm uppercase">Authorized Signatory</div>
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
