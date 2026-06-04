import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgcode = searchParams.get("orgcode");
    const phone = searchParams.get("phone");
    const date = searchParams.get("date");
    const search = searchParams.get("search");
    const recent = searchParams.get("recent");

    if (!orgcode) {
      return NextResponse.json(
        { success: false, message: "Missing required orgcode parameter" },
        { status: 400 }
      );
    }

    // 1. Fuzzy Account Search
    if (search !== null) {
      const result = await query(
        "SELECT phone, name, address FROM public.search_accounts($1, $2)",
        [orgcode, search]
      );
      return NextResponse.json({ success: true, accounts: result.rows });
    }

    // 2. Recent Transactions / Accounts Lookup
    if (recent === "true") {
      // Recent slips
      const slipsResult = await query(
        `SELECT id, slipno, date, phone, name, address, totalamount, discount, netamount 
         FROM public.slips 
         WHERE orgcode = $1 
         ORDER BY date DESC, id DESC 
         LIMIT 15`,
        [orgcode]
      );
      
      // Recent payments
      const paymentsResult = await query(
        `SELECT id, phone, date, amount, narration 
         FROM public.payments 
         WHERE orgcode = $1 
         ORDER BY date DESC, id DESC 
         LIMIT 15`,
        [orgcode]
      );

      // Recent active accounts
      const accountsResult = await query(
        `SELECT phone, name, address, MAX(date) as last_date 
         FROM public.slips 
         WHERE orgcode = $1 
         GROUP BY phone, name, address 
         ORDER BY last_date DESC 
         LIMIT 15`,
        [orgcode]
      );

      return NextResponse.json({
        success: true,
        recentSlips: slipsResult.rows,
        recentPayments: paymentsResult.rows,
        recentAccounts: accountsResult.rows
      });
    }

    if (!phone) {
      return NextResponse.json(
        { success: false, message: "Missing required parameters" },
        { status: 400 }
      );
    }

    let url = `https://ekzrjsjulqkoqvqgtsgi.supabase.co/functions/v1/ledger?orgcode=${orgcode}&phone=${phone}`;
    if (date) {
      url += `&date=${date}`;
    }

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Server Error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const response = await fetch("https://ekzrjsjulqkoqvqgtsgi.supabase.co/functions/v1/ledger", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Server Error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const cookieStore = await cookies();
    const authtoken = cookieStore.get("authtoken")?.value;
    const orgcode = searchParams.get("orgcode");
    const phone = searchParams.get("phone");

    if (!authtoken || !orgcode || !phone) {
      return NextResponse.json(
        { success: false, message: "Missing required parameters" },
        { status: 400 }
      );
    }

    const response = await fetch(
      `https://ekzrjsjulqkoqvqgtsgi.supabase.co/functions/v1/ledger?authtoken=${authtoken}&orgcode=${orgcode}&phone=${phone}`,
      {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Server Error" },
      { status: 500 }
    );
  }
}
