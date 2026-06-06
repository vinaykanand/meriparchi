import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const cookieStore = await cookies();
    const authtoken = cookieStore.get("authtoken")?.value;
    const orgcode = searchParams.get("orgcode");
    const phone = searchParams.get("phone");
    const search = searchParams.get("search") || "";

    if (!authtoken || !orgcode || !phone) {
      return NextResponse.json(
        { success: false, message: "Missing required parameters" },
        { status: 400 }
      );
    }

    const result = await query(
      "SELECT * FROM public.search_customer_items($1, $2, $3) LIMIT 10",
      [orgcode, phone, search]
    );

    return NextResponse.json({ success: true, items: result.rows }, { status: 200 });
  } catch (error: any) {
    console.error("API Error fetching items:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Server Error" },
      { status: 500 }
    );
  }
}
