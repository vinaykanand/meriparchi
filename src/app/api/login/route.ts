import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const response = await fetch("https://ekzrjsjulqkoqvqgtsgi.supabase.co/functions/v1/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    // Forward the status code and JSON data
    const nextResponse = NextResponse.json(data, { status: response.status });
    
    if (response.ok && data.success && data.authtoken) {
      nextResponse.cookies.set("authtoken", data.authtoken, {
        httpOnly: false, // Allows frontend to access it if needed
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: 60 * 60 * 24 * 7, // 1 week
      });
    }

    return nextResponse;
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Server Error" },
      { status: 500 }
    );
  }
}
