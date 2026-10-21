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
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

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

export async function login(username: string, password: string): Promise<void> {
  let response: Response;
  try {
    response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ username, password }),
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
