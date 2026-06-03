import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgcode = searchParams.get("orgcode");

    if (!orgcode) {
      return NextResponse.json(
        { success: false, message: "Missing orgcode parameter" },
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

    const res = await query("SELECT public.get_users($1::uuid, $2) AS result", [
      authtoken,
      orgcode,
    ]);

    const data = res.rows[0]?.result;

    if (!data || !data.success) {
      return NextResponse.json(
        data || { success: false, message: "Failed to load users" },
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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { orgcode, userid, password, isadmin, isactive } = body;

    if (!orgcode || !userid || !password) {
      return NextResponse.json(
        { success: false, message: "Missing required fields: orgcode, userid, password" },
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
      "SELECT public.save_user($1::uuid, $2, $3, $4, $5::boolean, $6::boolean) AS result",
      [
        authtoken,
        orgcode,
        userid,
        password,
        isadmin === undefined ? true : isadmin,
        isactive === undefined ? true : isactive,
      ]
    );

    const data = res.rows[0]?.result;

    if (!data || !data.success) {
      return NextResponse.json(
        data || { success: false, message: "Failed to save user" },
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
