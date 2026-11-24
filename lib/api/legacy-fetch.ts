import { API_BASE_URL, apiGet } from "./client";

// csrf-transport: body-token (v2) — forces a dev recompile of this module.
/**
 * Authenticated transport for the exact-replica master screens
 * (HsnMaster / ItemMaster / ConsumableMaterialMaster / ItemUnitMaster).
 *
 * TRANSPORT-ONLY: same function shapes as the local helpers these screens
 * used before (getJSON returns null on HTTP error; mk/putJSON/rm return the
 * raw Response). URLs, payloads, validations and alerts in the callers are
 * unchanged. Sends the httpOnly session cookie; writes send the CSRF token.
 */

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp("(^|; )" + name + "=([^;]+)"));
  return m ? decodeURIComponent(m[2]) : null;
}

// Token from the /api/auth/csrf/ body — used when the cross-origin csrftoken cookie
// cannot be read by JS (e.g. the page is on a different host/port than this API).
let _csrfToken: string | null = null;

async function ensureCsrf(): Promise<void> {
  try {
    const r = await fetch(`${API_BASE_URL}/api/auth/csrf/`, { credentials: "include" });
    if (r.ok) {
      const d = await r.json().catch(() => null);
      if (d && typeof d.csrfToken === "string") _csrfToken = d.csrfToken;
    }
  } catch {
    /* ignore — fall back to the cookie below */
  }
}

function csrfHeaderToken(): string {
  return _csrfToken || getCookie("csrftoken") || "";
}

export async function getJSON<T = any>(path: string): Promise<T | null> {
  try {
    return await apiGet<T>(path, { credentials: "include" });
  } catch {
    return null;
  }
}

async function write(
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
): Promise<Response> {
  await ensureCsrf();
  return await fetch(`${API_BASE_URL}${path}`, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json", "X-CSRFToken": csrfHeaderToken() },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export async function mk(path: string, body: any): Promise<Response> {
  return write("POST", path, body);
}

export const postJSON = mk;

export async function putJSON(path: string, body: any): Promise<Response> {
  return write("PUT", path, body);
}

export async function patchJSON(path: string, body: any): Promise<Response> {
  return write("PATCH", path, body);
}

export async function rm(path: string): Promise<Response> {
  return write("DELETE", path);
}

export const deleteJSON = rm;

// Multipart upload (files + fields). Does NOT set Content-Type (browser adds the boundary).
export async function upload(path: string, form: FormData): Promise<Response> {
  await ensureCsrf();
  return await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "X-CSRFToken": csrfHeaderToken() },
    body: form,
  });
}

/**
 * Extract a human-readable message from a non-2xx Response (DRF shapes:
 * {detail}, ["msg"], {field: ["msg"]}, {non_field_errors: [...]}).
 * Never throws; falls back to `fallback`.
 */
export async function responseMessage(res: Response, fallback = "Request failed."): Promise<string> {
  let data: any = null;
  try {
    data = await res.clone().json();
  } catch {
    return res.status === 403 ? "You do not have permission for this action." : fallback;
  }
  const pick = (v: any): string | null => {
    if (v == null) return null;
    if (typeof v === "string") return v;
    if (Array.isArray(v)) return v.length ? pick(v[0]) : null;
    if (typeof v === "object") {
      if (v.detail) return pick(v.detail);
      if (v.non_field_errors) return pick(v.non_field_errors);
      for (const k of Object.keys(v)) { const m = pick(v[k]); if (m) return m; }
    }
    return null;
  };
  return pick(data) || (res.status === 403 ? "You do not have permission for this action." : fallback);
}

/** Like getJSON but throws an Error (with the backend message) on non-2xx instead of returning null. */
export async function getJSONStrict<T = any>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await responseMessage(res, `Request failed (${res.status}).`));
  return (await res.json()) as T;
}
