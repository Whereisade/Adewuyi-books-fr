import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) {
    return NextResponse.json({ detail: "Cross-origin request rejected." }, { status: 403 });
  }
  const response = NextResponse.json({ ok: true });
  for (const name of ["rental_access", "rental_refresh"]) {
    response.cookies.set(name, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  }
  response.headers.set("Cache-Control", "no-store");
  return response;
}
