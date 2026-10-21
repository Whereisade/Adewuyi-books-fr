import { NextRequest, NextResponse } from "next/server";

const ACCESS_COOKIE = "rental_access";
const REFRESH_COOKIE = "rental_refresh";

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) {
    return NextResponse.json({ detail: "Cross-origin request rejected." }, { status: 403 });
  }

  let base = process.env.DJANGO_API_BASE_URL;
  if (!base) return NextResponse.json({ detail: "The backend URL is not configured." }, { status: 500 });
  base = base.replace(/\/+$/, "");

  let credentials: { username?: string; password?: string };
  try {
    credentials = await request.json();
  } catch {
    return NextResponse.json({ detail: "Provide a username and password." }, { status: 400 });
  }
  if (!credentials.username || !credentials.password) {
    return NextResponse.json({ detail: "Enter your username and password." }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${base}/auth/token/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ username: credentials.username, password: credentials.password }),
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ detail: "Unable to reach Django. Check DJANGO_API_BASE_URL and that the backend is running." }, { status: 502 });
  }

  const payload = await upstream.json().catch(() => ({})) as { access?: string; refresh?: string; detail?: string };
  if (!upstream.ok || !payload.access || !payload.refresh) {
    return NextResponse.json({ detail: payload.detail || "Sign-in failed. Check your username and password." }, { status: upstream.status || 401 });
  }

  const response = NextResponse.json({ ok: true });
  const secure = process.env.NODE_ENV === "production";
  response.cookies.set(ACCESS_COOKIE, payload.access, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 35 * 60,
  });
  response.cookies.set(REFRESH_COOKIE, payload.refresh, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
