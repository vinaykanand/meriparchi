import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { orgname, isactive, enableotp } = body;

    if (!orgname) {
      return NextResponse.json(
        { success: false, message: "Missing orgname parameter" },
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
      "SELECT public.update_company($1::uuid, $2, $3::boolean, $4::boolean) AS result",
      [
        authtoken,
        orgname,
        isactive === undefined ? true : isactive,
        enableotp === undefined ? false : enableotp,
      ]
    );

    const data = res.rows[0]?.result;

    if (!data || !data.success) {
      return NextResponse.json(
        data || { success: false, message: "Failed to update company" },
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
