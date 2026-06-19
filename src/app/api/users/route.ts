import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query } from "@/lib/db";
import { logAction } from "@/lib/audit";

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

    if (!orgcode || !userid) {
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

    const sessionCheck = await query(
      "SELECT userid FROM public.users WHERE authtoken = $1 AND orgcode = $2 AND isactive = true",
      [authtoken, orgcode]
    );
    if (sessionCheck.rows.length === 0) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }
    const actorUserid = sessionCheck.rows[0].userid;

    const result = await query(
      "SELECT public.save_user($1, $2, $3, $4, $5, $6) as result",
      [authtoken, orgcode, userid, password, isadmin, isactive]
    );

    if (result.rows.length > 0 && result.rows[0].result) {
      const data = result.rows[0].result;
      if (data.success) {
        const isUpdate = data.message?.toLowerCase().includes("update");
        await logAction({
          orgcode,
          userid: actorUserid,
          action: isUpdate ? "UPDATE_USER" : "CREATE_USER",
          details: { targetUserid: userid, isadmin, isactive },
        });
      }
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

export const PUT = POST;

export async function DELETE(request: Request) {
  try {
    const cookieStore = await cookies();
    const authtoken = cookieStore.get("authtoken")?.value;

    if (!authtoken) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { orgcode, userid } = body;

    if (!orgcode || !userid) {
      return NextResponse.json({ success: false, message: "Missing required fields" }, { status: 400 });
    }

    if (userid.toLowerCase() === "admin") {
      return NextResponse.json({ success: false, message: "Cannot delete the primary admin user" }, { status: 403 });
    }

    const sessionCheck = await query(
      "SELECT userid, isadmin FROM public.users WHERE authtoken = $1 AND orgcode = $2 AND isactive = true",
      [authtoken, orgcode]
    );
    if (sessionCheck.rows.length === 0 || !sessionCheck.rows[0].isadmin) {
      return NextResponse.json({ success: false, message: "Unauthorized: Admin access required" }, { status: 401 });
    }

    await query("DELETE FROM public.users WHERE orgcode = $1 AND userid = $2", [orgcode, userid]);

    await logAction({
      orgcode,
      userid: sessionCheck.rows[0].userid,
      action: "DELETE_USER",
      details: { targetUserid: userid },
    });

    return NextResponse.json({ success: true, message: "User deleted successfully" });
  } catch (error: any) {
    console.error("Delete User Error:", error);
    return NextResponse.json({ success: false, message: error.message || "Server Error" }, { status: 500 });
  }
}
