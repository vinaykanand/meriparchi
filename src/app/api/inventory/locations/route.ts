import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query } from "@/lib/db";
import { logAction } from "@/lib/audit";

async function getSession(orgcode: string) {
  const cookieStore = await cookies();
  const authtoken = cookieStore.get("authtoken")?.value;
  if (!authtoken) return null;
  const res = await query(
    "SELECT isadmin, userid FROM public.users WHERE authtoken = $1 AND orgcode = $2 AND isactive = true",
    [authtoken, orgcode]
  );
  return res.rows[0] || null;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgcode = searchParams.get("orgcode");

    if (!orgcode) {
      return NextResponse.json(
        { success: false, message: "Missing required orgcode parameter" },
        { status: 400 }
      );
    }

    const session = await getSession(orgcode);
    if (!session) {
      return NextResponse.json(
        { success: false, message: "Unauthorized or invalid session" },
        { status: 401 }
      );
    }

    const result = await query(
      "SELECT id, name, created_at FROM public.inventory_locations WHERE orgcode = $1 ORDER BY name ASC",
      [orgcode]
    );

    return NextResponse.json({ success: true, locations: result.rows });
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
    const { orgcode, name } = body;

    if (!orgcode || !name) {
      return NextResponse.json(
        { success: false, message: "Missing required parameters (orgcode, name)" },
        { status: 400 }
      );
    }

    const session = await getSession(orgcode);
    if (!session) {
      return NextResponse.json(
        { success: false, message: "Unauthorized or invalid session" },
        { status: 401 }
      );
    }

    // Insert new location
    const result = await query(
      "INSERT INTO public.inventory_locations (orgcode, name) VALUES ($1, $2) RETURNING id, name",
      [orgcode, name.trim()]
    );

    await logAction({
      orgcode,
      userid: session.userid,
      action: "CREATE_INVENTORY_LOCATION",
      details: { name: name.trim() },
    });

    return NextResponse.json({
      success: true,
      message: "Location created successfully",
      location: result.rows[0],
    });
  } catch (error: any) {
    if (error.code === "23505") { // Unique violation
      return NextResponse.json(
        { success: false, message: "A location with this name already exists" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, message: error.message || "Server Error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { orgcode, id, name } = body;

    if (!orgcode || !id || !name) {
      return NextResponse.json(
        { success: false, message: "Missing required parameters (orgcode, id, name)" },
        { status: 400 }
      );
    }

    const session = await getSession(orgcode);
    if (!session) {
      return NextResponse.json(
        { success: false, message: "Unauthorized or invalid session" },
        { status: 401 }
      );
    }

    const result = await query(
      `UPDATE public.inventory_locations 
       SET name = $1
       WHERE orgcode = $2 AND id = $3
       RETURNING id, name`,
      [name.trim(), orgcode, id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: "Location not found" },
        { status: 404 }
      );
    }

    await logAction({
      orgcode,
      userid: session.userid,
      action: "UPDATE_INVENTORY_LOCATION",
      details: { id, name: name.trim() },
    });

    return NextResponse.json({
      success: true,
      message: "Location updated successfully",
      location: result.rows[0],
    });
  } catch (error: any) {
    if (error.code === "23505") { // Unique violation
      return NextResponse.json(
        { success: false, message: "A location with this name already exists" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, message: error.message || "Server Error" },
      { status: 500 }
    );
  }
}
