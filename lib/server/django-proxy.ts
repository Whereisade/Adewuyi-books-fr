import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const ACCESS_COOKIE = "rental_access";
const REFRESH_COOKIE = "rental_refresh";
const ACCESS_MAX_AGE = 35 * 60;
const REFRESH_MAX_AGE = 7 * 24 * 60 * 60;

function apiBase(): string {
  const raw = process.env.DJANGO_API_BASE_URL;
  if (!raw) throw new Error("DJANGO_API_BASE_URL is not configured.");
  return raw.replace(/\/+$/, "");
}

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

function responseWithCookies(body: BodyInit | null, status: number, refreshedAccess?: string, refreshedRefresh?: string) {
  const response = new NextResponse(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
  if (refreshedAccess) response.cookies.set(ACCESS_COOKIE, refreshedAccess, cookieOptions(ACCESS_MAX_AGE));
  if (refreshedRefresh) response.cookies.set(REFRESH_COOKIE, refreshedRefresh, cookieOptions(REFRESH_MAX_AGE));
  return response;
}

async function refreshAccessToken(refreshToken: string): Promise<{ access: string; refresh?: string } | null> {
  try {
    const response = await fetch(`${apiBase()}/auth/token/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh: refreshToken }),
      cache: "no-store",
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { access?: string; refresh?: string };
    if (!data.access) return null;
    return { access: data.access, refresh: data.refresh };
  } catch {
    return null;
  }
}

function makeUrl(path: string[], request: NextRequest): string {
  const safePath = path.map((part) => encodeURIComponent(part)).join("/");
  return `${apiBase()}/${safePath}/${request.nextUrl.search}`;
}

async function callDjango(url: string, request: NextRequest, token: string, body: ArrayBuffer | undefined): Promise<Response> {
  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);
  const accept = request.headers.get("accept");
  if (accept) headers.set("Accept", accept);
  headers.set("Authorization", `Bearer ${token}`);
  return fetch(url, {
    method: request.method,
    headers,
    body: ["GET", "HEAD"].includes(request.method) ? undefined : body,
    cache: "no-store",
    redirect: "manual",
  });
}

export async function proxyDjango(request: NextRequest, path: string[]): Promise<NextResponse> {
  const method = request.method.toUpperCase();
  if (!path.length || path.some((part) => part === ".." || part === ".")) {
    return NextResponse.json({ detail: "Invalid API path." }, { status: 400 });
  }

  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    const origin = request.headers.get("origin");
    if (origin && origin !== request.nextUrl.origin) {
      return NextResponse.json({ detail: "Cross-origin request rejected." }, { status: 403 });
    }
  }

  let base: string;
  try {
    base = makeUrl(path, request);
  } catch {
    return NextResponse.json({ detail: "The backend URL is not configured." }, { status: 500 });
  }

  const cookieStore = await cookies();
  let access = cookieStore.get(ACCESS_COOKIE)?.value;
  const refresh = cookieStore.get(REFRESH_COOKIE)?.value;
  if (!access && !refresh) return NextResponse.json({ detail: "Authentication required." }, { status: 401 });

  let body: ArrayBuffer | undefined;
  if (!["GET", "HEAD"].includes(method)) body = await request.arrayBuffer();

  let updatedAccess: string | undefined;
  let updatedRefresh: string | undefined;
  if (!access && refresh) {
    const renewed = await refreshAccessToken(refresh);
    if (!renewed) {
      const response = NextResponse.json({ detail: "Your session has expired. Please sign in again." }, { status: 401 });
      response.cookies.set(ACCESS_COOKIE, "", { ...cookieOptions(0), maxAge: 0 });
      response.cookies.set(REFRESH_COOKIE, "", { ...cookieOptions(0), maxAge: 0 });
      return response;
    }
    access = renewed.access;
    updatedAccess = renewed.access;
    updatedRefresh = renewed.refresh;
  }

  let upstream: Response;
  try {
    upstream = await callDjango(base, request, access!, body);
  } catch {
    return NextResponse.json({ detail: "Unable to reach the Django API." }, { status: 502 });
  }

  if (upstream.status === 401 && refresh) {
    const renewed = await refreshAccessToken(refresh);
    if (renewed) {
      access = renewed.access;
      updatedAccess = renewed.access;
      updatedRefresh = renewed.refresh;
      try {
        upstream = await callDjango(base, request, access, body);
      } catch {
        return responseWithCookies(JSON.stringify({ detail: "Unable to reach the Django API." }), 502, updatedAccess, updatedRefresh);
      }
    } else {
      const response = NextResponse.json({ detail: "Your session has expired. Please sign in again." }, { status: 401 });
      response.cookies.set(ACCESS_COOKIE, "", { ...cookieOptions(0), maxAge: 0 });
      response.cookies.set(REFRESH_COOKIE, "", { ...cookieOptions(0), maxAge: 0 });
      return response;
    }
  }

  if (upstream.status === 401) {
    const response = NextResponse.json({ detail: "Your session has expired. Please sign in again." }, { status: 401 });
    response.cookies.set(ACCESS_COOKIE, "", { ...cookieOptions(0), maxAge: 0 });
    response.cookies.set(REFRESH_COOKIE, "", { ...cookieOptions(0), maxAge: 0 });
    return response;
  }

  const upstreamBody = method === "HEAD" || upstream.status === 204 ? null : await upstream.arrayBuffer();
  const contentType = upstream.headers.get("content-type");
  const headers = new Headers({
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  if (contentType) headers.set("Content-Type", contentType);
  const contentDisposition = upstream.headers.get("content-disposition");
  if (contentDisposition) headers.set("Content-Disposition", contentDisposition);
  const response = responseWithCookies(upstreamBody, upstream.status, updatedAccess, updatedRefresh);
  headers.forEach((value, key) => response.headers.set(key, value));
  return response;
}
