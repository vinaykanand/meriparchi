import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgcode = searchParams.get("orgcode");
    const phone = searchParams.get("phone");
    const date = searchParams.get("date"); // optional: YYYY-MM-DD

    if (!orgcode || !phone) {
      return NextResponse.json(
        { success: false, message: "Missing required parameters: orgcode, phone" },
        { status: 400 }
      );
    }

    if (date) {
      // Fetch details by date
      const res = await query(
        "SELECT * FROM public.get_account_details_by_date($1, $2, $3::date)",
        [orgcode, phone, date]
      );
      return NextResponse.json({ success: true, details: res.rows });
    } else {
      // Fetch general account summary
      const res = await query(
        "SELECT * FROM public.get_account_summary($1, $2)",
        [orgcode, phone]
      );
      return NextResponse.json({ success: true, summary: res.rows });
    }
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type, orgcode } = body;

    if (!type || !orgcode) {
      return NextResponse.json(
        { success: false, message: "Missing required parameters: type, orgcode" },
        { status: 400 }
      );
    }

    if (type === "slip") {
      const { phone, name, address, totalamount, discount, items } = body;
      if (!phone || !items || !Array.isArray(items)) {
        return NextResponse.json(
          { success: false, message: "Missing required fields for slip creation: phone, items" },
          { status: 400 }
        );
      }

      const res = await query(
        "SELECT public.save_slip($1, $2, $3, $4, $5::numeric, $6::numeric, $7::json) AS result",
        [
          orgcode,
          phone,
          name || "",
          address || "",
          totalamount || 0,
          discount || 0,
          JSON.stringify(items),
        ]
      );

      const data = res.rows[0]?.result;
      if (!data || !data.success) {
        return NextResponse.json(
          data || { success: false, message: "Failed to save slip" },
          { status: 400 }
        );
      }
      return NextResponse.json(data);
    } else if (type === "payment") {
      const { id, phone, amount, narration } = body;
      if (!phone || amount === undefined) {
        return NextResponse.json(
          { success: false, message: "Missing required fields for payment: phone, amount" },
          { status: 400 }
        );
      }

      // Convert phone to numeric, id to bigint (defaults to null if new payment)
      const res = await query(
        "SELECT public.save_payment($1, $2::bigint, $3::numeric, $4::numeric, $5) AS result",
        [orgcode, id || null, phone, amount, narration || ""]
      );

      const data = res.rows[0]?.result;
      if (!data || !data.success) {
        return NextResponse.json(
          data || { success: false, message: "Failed to save payment" },
          { status: 400 }
        );
      }
      return NextResponse.json(data);
    } else {
      return NextResponse.json(
        { success: false, message: "Invalid type. Must be 'slip' or 'payment'" },
        { status: 400 }
      );
    }
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgcode = searchParams.get("orgcode");
    const phone = searchParams.get("phone");

    if (!orgcode || !phone) {
      return NextResponse.json(
        { success: false, message: "Missing required parameters: orgcode, phone" },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const authtoken = cookieStore.get("authtoken")?.value;

    if (!authtoken) {
      return NextResponse.json(
        { success: false, message: "Unauthorized: Missing authtoken session" },
        { status: 401 }
      );
    }

    const res = await query(
      "SELECT public.closeaccount($1::uuid, $2, $3) AS result",
      [authtoken, orgcode, phone]
    );

    const data = res.rows[0]?.result;

    if (!data || !data.success) {
      return NextResponse.json(
        data || { success: false, message: "Failed to close account" },
        { status: 400 }
      );
    }

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
