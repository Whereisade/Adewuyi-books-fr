import { NextRequest, NextResponse } from "next/server";

function backendUrl() {
  const configured = process.env.DJANGO_API_BASE_URL;
  if (!configured) return null;
  return `${configured.replace(/\/+$/, "")}/auth/signup/`;
}

export async function GET() {
  const url = backendUrl();
  if (!url) return NextResponse.json({ detail: "The backend URL is not configured." }, { status: 500 });
  try {
    const upstream = await fetch(url, { method: "GET", headers: { Accept: "application/json" }, cache: "no-store" });
    const payload = await upstream.json().catch(() => ({ detail: "The signup service returned an invalid response." }));
    return NextResponse.json(payload, { status: upstream.status, headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ detail: "Unable to reach the signup service. Check that Django is running." }, { status: 502 });
  }
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) {
    return NextResponse.json({ detail: "Cross-origin request rejected." }, { status: 403 });
  }
  const url = backendUrl();
  if (!url) return NextResponse.json({ detail: "The backend URL is not configured." }, { status: 500 });

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ detail: "Submit the registration form using valid JSON." }, { status: 400 });
  }

  try {
    const upstream = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    const result = await upstream.json().catch(() => ({ detail: "The signup service returned an invalid response." }));
    return NextResponse.json(result, {
      status: upstream.status,
      headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
    });
  } catch {
    return NextResponse.json({ detail: "Unable to reach the signup service. Check that Django is running." }, { status: 502 });
  }
}
