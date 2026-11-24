import { API_BASE_URL } from "./client";

/**
 * Employee / HR API client (Phase 6).
 *
 * Unlike the open Core Masters, HR endpoints require an authenticated + active
 * modern session, so every request sends the httpOnly session cookie
 * (`credentials: "include"`). No token is ever read from or stored in JS.
 */

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export type HrResource = "employees" | "grades" | "departments";

export class ApiError extends Error {
  status: number;
  data?: any;
  constructor(status: number, message: string, data?: any) {
    super(message);
    this.status = status;
    this.data = data;
    this.name = "ApiError";
  }
}

export interface HrListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  filters?: Record<string, string>;
}

async function hrGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new ApiError(res.status, `API ${res.status} for ${path}`);
  }
  return (await res.json()) as T;
}

export function listHr<T = Record<string, unknown>>(
  resource: HrResource,
  params: HrListParams = {},
): Promise<Paginated<T>> {
  const q = new URLSearchParams();
  q.set("page_size", params.pageSize === 1 ? "1" : "all"); // count probes keep 1; everything else returns ALL rows (no paging)
  if (params.search) q.set("search", params.search);
  for (const [k, v] of Object.entries(params.filters ?? {})) {
    if (v) q.set(k, v);
  }
  const qs = q.toString();
  return hrGet<Paginated<T>>(`/api/hr/${resource}/${qs ? `?${qs}` : ""}`);
}

export function getHr<T = Record<string, unknown>>(
  resource: HrResource,
  id: number | string,
): Promise<T> {
  return hrGet<T>(`/api/hr/${resource}/${encodeURIComponent(String(id))}/`);
}

// ---------------------------------------------------------------- writes (CSRF)
function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp("(^|; )" + name + "=([^;]+)"));
  return m ? decodeURIComponent(m[2]) : null;
}

async function ensureCsrf(): Promise<void> {
  await fetch(`${API_BASE_URL}/api/auth/csrf/`, { credentials: "include" });
}

export interface MutateResult<T> {
  ok: boolean;
  status: number;
  data: T;
}

async function mutate<T>(
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
): Promise<MutateResult<T>> {
  await ensureCsrf();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": getCookie("csrftoken") ?? "",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data: T;
  try {
    data = (await res.json()) as T;
  } catch {
    data = {} as T;
  }
  return { ok: res.ok, status: res.status, data };
}

export function createHr<T = Record<string, unknown>>(resource: HrResource, body: unknown) {
  return mutate<T>("POST", `/api/hr/${resource}/`, body);
}

export function updateHr<T = Record<string, unknown>>(
  resource: HrResource,
  id: number | string,
  body: unknown,
) {
  return mutate<T>("PATCH", `/api/hr/${resource}/${encodeURIComponent(String(id))}/`, body);
}

export function deleteHr(resource: HrResource, id: number | string) {
  return mutate<Record<string, never>>("DELETE", `/api/hr/${resource}/${encodeURIComponent(String(id))}/`);
}
