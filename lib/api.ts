export class ApiError extends Error {
  status: number;
  details: unknown;

  constructor(message: string, status = 500, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

type ApiPage<T> = { results: T[]; next: string | null };

function isApiPage<T>(value: unknown): value is ApiPage<T> {
  return value !== null
    && typeof value === "object"
    && "results" in value
    && Array.isArray(value.results)
    && "next" in value
    && (typeof value.next === "string" || value.next === null);
}

function messageFromPayload(payload: unknown): string {
  if (typeof payload === "string") return payload;
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    if (typeof record.detail === "string") return record.detail;
    if (typeof record.message === "string") return record.message;
    const first = Object.values(record)[0];
    if (typeof first === "string") return first;
    if (Array.isArray(first) && typeof first[0] === "string") return first[0];
  }
  return "The request could not be completed. Please check the details and try again.";
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const cleanPath = path.replace(/^\/+/, "");
  const headers = new Headers(options.headers);
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  if (options.body && !isFormData && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  let response: Response;
  try {
    response = await fetch(`/api/backend/${cleanPath}`, {
      ...options,
      headers,
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    throw new ApiError("Unable to reach the backend. Check that Django is running and DJANGO_API_BASE_URL is correct.", 0);
  }

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json().catch(() => null) : await response.text();
  if (!response.ok) {
    throw new ApiError(messageFromPayload(payload), response.status, payload);
  }
  return payload as T;
}

export async function apiList<T>(path: string): Promise<T[]> {
  let response: unknown = await api<unknown>(path);
  if (Array.isArray(response)) return response as T[];

  const results: T[] = [];
  while (isApiPage<T>(response)) {
    results.push(...response.results);
    if (!response.next) return results;
    const query = new URL(response.next, window.location.origin).search;
    response = await api<unknown>(`${path}${query}`);
  }

  throw new ApiError("The backend returned an unexpected list response.");
}

export async function login(email: string, password: string): Promise<void> {
  let response: Response;
  try {
    response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ email, password }),
    });
  } catch {
    throw new ApiError("Unable to reach the login service. Check the backend URL and try again.", 0);
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(messageFromPayload(payload), response.status, payload);
}

export async function logout(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
}
