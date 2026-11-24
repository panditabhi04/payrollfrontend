import { API_BASE_URL, apiGet } from "./client";

/** Cookie-based (httpOnly session) auth client. Tokens are NEVER stored in JS. */

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp("(^|; )" + name + "=([^;]+)"));
  return m ? decodeURIComponent(m[2]) : null;
}

async function ensureCsrf(): Promise<void> {
  await fetch(`${API_BASE_URL}/api/auth/csrf/`, { credentials: "include" });
}

async function post<T>(path: string, body: unknown): Promise<{ ok: boolean; status: number; data: T }> {
  await ensureCsrf();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": getCookie("csrftoken") ?? "",
    },
    body: JSON.stringify(body),
  });
  let data: T;
  try {
    data = (await res.json()) as T;
  } catch {
    data = {} as T;
  }
  return { ok: res.ok, status: res.status, data };
}

export interface Me {
  username: string;
  legacy_login_id: string;
  is_active: boolean;
  is_staff: boolean;
  must_change_password: boolean;
  role: string | null;
  scope: { comp_code: string | null; client_code: string | null; unit_code: string | null };
  permissions: { menu: string; menu_id: number | null; permission: string; needs_review: boolean }[];
}

export function login(username: string, password: string) {
  return post<Me | { detail: string; must_change_password?: boolean }>("/api/auth/login/", { username, password });
}

export function logout() {
  return post<Record<string, never>>("/api/auth/logout/", {});
}

export function passwordSetup(token: string, new_password: string) {
  return post<{ detail: string | string[] }>("/api/auth/password/setup/", { token, new_password });
}

export async function getMe(): Promise<Me | null> {
  try {
    return await apiGet<Me>("/api/auth/me/", { credentials: "include" });
  } catch {
    return null;
  }
}
