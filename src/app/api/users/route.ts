import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const cookieStore = await cookies();
    const authtoken = cookieStore.get("authtoken")?.value;
    const orgcode = searchParams.get("orgcode");

    if (!authtoken || !orgcode) {
      return NextResponse.json(
        { success: false, message: "Missing required parameters" },
        { status: 400 }
      );
    }

    const result = await query(
      "SELECT public.get_users($1, $2) as result",
      [authtoken, orgcode]
    );

    if (result.rows.length > 0 && result.rows[0].result) {
      const data = result.rows[0].result;
      return NextResponse.json(data, { status: data.success ? 200 : 400 });
    }

    return NextResponse.json(
      { success: false, message: "Failed to fetch users" },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("Fetch Users Error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Server Error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const authtoken = cookieStore.get("authtoken")?.value;

    if (!authtoken) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { orgcode, userid, password, isadmin, isactive } = body;

    if (!orgcode || !userid || !password) {
      return NextResponse.json(
        { success: false, message: "Missing required fields" },
        { status: 400 }
      );
    }

    // Explicitly block editing the 'admin' user from the backend
    if (userid.toLowerCase() === "admin") {
      return NextResponse.json(
        { success: false, message: "The primary 'admin' user cannot be modified." },
        { status: 403 }
      );
    }

    const result = await query(
      "SELECT public.save_user($1, $2, $3, $4, $5, $6) as result",
      [authtoken, orgcode, userid, password, isadmin, isactive]
    );

    if (result.rows.length > 0 && result.rows[0].result) {
      const data = result.rows[0].result;
      return NextResponse.json(data, { status: data.success ? 200 : 400 });
    }

    return NextResponse.json(
      { success: false, message: "Failed to save user" },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("Save User Error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Server Error" },
      { status: 500 }
    );
  }
}
