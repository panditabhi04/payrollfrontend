import { API_BASE_URL } from "./client";
import { ApiError, type Paginated } from "./hr";

export type { Paginated };
export { ApiError };

/**
 * Generic authenticated CRUD over an arbitrary DRF collection base path
 * (e.g. "/api/masters/states"). Sends the httpOnly session cookie; writes send
 * the CSRF token. No token is stored in JS.
 */

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp("(^|; )" + name + "=([^;]+)"));
  return m ? decodeURIComponent(m[2]) : null;
}

async function ensureCsrf(): Promise<void> {
  await fetch(`${API_BASE_URL}/api/auth/csrf/`, { credentials: "include" });
}

export interface ListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  filters?: Record<string, string>;
}

export async function listItems<T = Record<string, unknown>>(
  basePath: string,
  params: ListParams = {},
): Promise<Paginated<T>> {
  const q = new URLSearchParams();
  // Grids show ALL records with a total count (no paging): always request everything.
  q.set("page_size", params.pageSize === 1 ? "1" : "all"); // count probes keep 1; everything else returns ALL rows (no paging)
  if (params.search) q.set("search", params.search);
  for (const [k, v] of Object.entries(params.filters ?? {})) if (v) q.set(k, v);
  const qs = q.toString();
  const res = await fetch(`${API_BASE_URL}${basePath}/${qs ? `?${qs}` : ""}`, {
    credentials: "include",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new ApiError(res.status, `API ${res.status}`);
  return (await res.json()) as Paginated<T>;
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
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") ?? "" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data: T;
  try { data = (await res.json()) as T; } catch { data = {} as T; }
  return { ok: res.ok, status: res.status, data };
}

export function createItem<T = Record<string, unknown>>(basePath: string, body: unknown) {
  return mutate<T>("POST", `${basePath}/`, body);
}
export function updateItem<T = Record<string, unknown>>(basePath: string, id: number | string, body: unknown) {
  return mutate<T>("PATCH", `${basePath}/${encodeURIComponent(String(id))}/`, body);
}

// Multipart variant for forms that carry a file upload (e.g. Company PFX).
// Fields go in as plain strings; the file (if any) under `file.key`.
// No Content-Type header — the browser sets the multipart boundary itself.
async function mutateForm<T>(
  method: "POST" | "PUT" | "PATCH",
  path: string,
  fields: Record<string, string>,
  file?: { key: string; file: File } | null,
): Promise<MutateResult<T>> {
  await ensureCsrf();
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v ?? "");
  if (file) fd.append(file.key, file.file);
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    credentials: "include",
    headers: { "X-CSRFToken": getCookie("csrftoken") ?? "" },
    body: fd,
  });
  let data: T;
  try { data = (await res.json()) as T; } catch { data = {} as T; }
  return { ok: res.ok, status: res.status, data };
}

export function createItemForm<T = Record<string, unknown>>(
  basePath: string, fields: Record<string, string>, file?: { key: string; file: File } | null,
) {
  return mutateForm<T>("POST", `${basePath}/`, fields, file);
}
export function updateItemForm<T = Record<string, unknown>>(
  basePath: string, id: number | string, fields: Record<string, string>, file?: { key: string; file: File } | null,
) {
  return mutateForm<T>("PATCH", `${basePath}/${encodeURIComponent(String(id))}/`, fields, file);
}
export function deleteItem(basePath: string, id: number | string) {
  return mutate<Record<string, never>>("DELETE", `${basePath}/${encodeURIComponent(String(id))}/`);
}
