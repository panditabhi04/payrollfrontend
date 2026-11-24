/**
 * Minimal API client foundation for the Django backend.
 */
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

/** Error thrown by apiGet/apiGetAll. `message` carries the server's own text when available. */
export class ApiGetError extends Error {
  status: number;
  data?: unknown;
  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.status = status;
    this.data = data;
    this.name = "ApiGetError";
  }
}

/** Flatten a DRF error body ({detail} | {field: [msgs]} | [msgs] | string) into readable text. */
export function drfErrorText(d: unknown): string {
  if (d == null) return "";
  if (typeof d === "string") return d.trim();
  if (Array.isArray(d)) return d.map(drfErrorText).filter(Boolean).join(" ");
  if (typeof d === "object") {
    const o = d as Record<string, unknown>;
    if (typeof o.detail === "string") return o.detail;
    if (typeof o.message === "string") return o.message;
    if (typeof o.error === "string") return o.error;
    return Object.entries(o)
      .map(([k, v]) => {
        const t = drfErrorText(v);
        return t ? (k === "non_field_errors" ? t : `${k}: ${t}`) : "";
      })
      .filter(Boolean)
      .join(" · ");
  }
  return String(d);
}

async function failure(res: Response, path: string): Promise<ApiGetError> {
  let data: unknown;
  try {
    const txt = await res.text();
    try { data = JSON.parse(txt); } catch { data = txt && !/^\s*</.test(txt) ? txt : undefined; }
  } catch { /* ignore */ }
  const text = drfErrorText(data);
  return new ApiGetError(res.status, text || `API ${res.status} for ${path}`, data);
}

export async function apiGet<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const res = await fetch(url, {
    credentials: "include",
    ...init,
    headers: { Accept: "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  if (!res.ok) throw await failure(res, path);
  return (await res.json()) as T;
}

/**
 * GET a list endpoint and return EVERY row, following DRF `next` links.
 * Works for plain arrays and for `{count, next, results}` envelopes.
 * `maxPages` (default 400) is a safety cap against runaway/looping `next` links.
 */
export async function apiGetAll<T = Record<string, unknown>>(
  path: string,
  opts: { maxPages?: number; init?: RequestInit } = {},
): Promise<T[]> {
  const maxPages = opts.maxPages ?? 400;
  const out: T[] = [];
  const seen = new Set<string>();
  let next: string | null = path;
  for (let i = 0; next && i < maxPages; i++) {
    if (seen.has(next)) break;
    seen.add(next);
    const page: unknown = await apiGet<unknown>(next, opts.init);
    if (Array.isArray(page)) return out.concat(page as T[]);
    const env = (page ?? {}) as { results?: T[]; next?: string | null };
    if (!Array.isArray(env.results)) return out;
    out.push(...env.results);
    if (!env.next) break;
    // `next` is absolute (and may use another host name): keep only path + query.
    try {
      const u = new URL(env.next, API_BASE_URL);
      next = u.pathname + u.search;
    } catch {
      next = env.next;
    }
  }
  return out;
}
