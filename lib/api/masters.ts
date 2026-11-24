import { apiGet } from "./client";

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export type MasterResource =
  | "companies"
  | "clients"
  | "units"
  | "zones"
  | "states"
  | "banks"
  | "leaves"
  | "holidays"
  | "shifts";

export interface ListParams {
  page?: number;
  pageSize?: number;
  search?: string;
}

export function listMaster<T = Record<string, unknown>>(
  resource: MasterResource,
  params: ListParams = {},
): Promise<Paginated<T>> {
  const q = new URLSearchParams();
  q.set("page_size", params.pageSize === 1 ? "1" : "all"); // count probes keep 1; everything else returns ALL rows (no paging)
  if (params.search) q.set("search", params.search);
  const qs = q.toString();
  return apiGet<Paginated<T>>(`/api/masters/${resource}/${qs ? `?${qs}` : ""}`);
}

export function getMaster<T = Record<string, unknown>>(
  resource: MasterResource,
  id: number | string,
): Promise<T> {
  return apiGet<T>(`/api/masters/${resource}/${id}/`);
}
