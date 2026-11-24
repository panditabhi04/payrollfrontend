"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { apiGet } from "@/lib/api/client";

const BASE = "/api/masters/it-master";
const SEL = "Select";

type Opt = { v: string; t: string };
type Row = Record<string, any>;

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  promise?: Promise<T>;
}

const CACHE_TTL = 5 * 60 * 1000;
const clientCache = new Map<string, CacheEntry<{ results: Row[] }>>();
const statesCache = new Map<string, CacheEntry<{ results: Row[] }>>();
const branchesCache = new Map<string, CacheEntry<{ results: Row[] }>>();

function getCacheKey(base: string, params: Record<string, string>) {
  const sorted = Object.entries(params).sort(([a], [b]) => a.localeCompare(b));
  return base + "?" + new URLSearchParams(sorted).toString();
}

async function loadJSON<T>(path: string): Promise<{ data?: T; status?: number }> {
  try {
    const data = await apiGet<T>(path, { credentials: "include" });
    return { data };
  } catch (e: any) {
    const m = String(e?.message ?? "");
    const s = m.match(/API (\d+)/)?.[1];
    return { status: s ? parseInt(s, 10) : 0 };
  }
}

function errFor(what: string, status?: number): string {
  if (status === 404) return `${what} endpoint not found (404) — please restart the backend server so /api/masters/it-master/* routes are available, then refresh.`;
  if (status === 403) return `Access denied (403) for the ${what} — your session may have expired. Please log in again and refresh.`;
  if (status === 500 || status === 0) return `Failed to load the ${what} (server error) — please check the backend logs and the legacy DB connection, then refresh.`;
  return `Failed to load the ${what} — please check that the backend is running and you are logged in.`;
}

export function useClients() {
  const [clients, setClients] = useState<Opt[]>([{ v: SEL, t: SEL }]);
  const [err, setErr] = useState("");
  const loadingRef = useRef(false);

  const fetch = useCallback(async () => {
    if (loadingRef.current) return;
    const cacheKey = "clients";
    const cached = clientCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      const list = (cached.data?.results ?? []) as Row[];
      setClients([{ v: SEL, t: SEL }, ...list.map((c) => ({ v: String(c.client_code), t: String(c.client_name) }))]);
      if (list.length === 0) {
        setErr("Client list is empty — no clients are assigned to your login, or the client master has no data for this company.");
      }
      return;
    }

    loadingRef.current = true;
    const { data, status } = await loadJSON<{ results: Row[] }>(`${BASE}/clients/`);
    loadingRef.current = false;

    if (!data) {
      setErr(errFor("Client dropdown", status));
      return;
    }
    setErr("");
    const list = (data?.results ?? []) as Row[];
    const opts = [{ v: SEL, t: SEL }, ...list.map((c) => ({ v: String(c.client_code), t: String(c.client_name) }))];
    setClients(opts);
    clientCache.set(cacheKey, { data: { results: list }, timestamp: Date.now() });

    if (list.length === 0) {
      const dg = await loadJSON<any>(`${BASE}/diagnostics/`);
      const d = dg.data;
      if (d) {
        setErr(`Client list is empty — company '${d.comp_code ?? ""}' has ${d.active_clients_in_comp ?? 0} active clients, and login '${(d.logins_tried ?? []).join(" / ")}' has ${d.role_grade_rows_for_login ?? 0} client assignments. ` +
          ((d.role_grade_rows_for_login ?? 0) === 0
            ? "No clients are assigned to your login in the client-role mapping."
            : "Clients exist but none are active for this company."));
      } else {
        setErr("Client list is empty — no clients are assigned to your login, or the client master has no data for this company.");
      }
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { opts: clients, err, refresh: fetch };
}

export function useStates(client: string) {
  const [states, setStates] = useState<Opt[]>([{ v: SEL, t: SEL }]);
  const [err, setErr] = useState("");
  const loadingRef = useRef(false);

  const fetch = useCallback(async () => {
    if (loadingRef.current) return;
    if (!client || client.toUpperCase() === SEL.toUpperCase()) {
      setStates([{ v: SEL, t: SEL }]);
      setErr("");
      return;
    }

    const cacheKey = getCacheKey("states", { client_code: client });
    const cached = statesCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      const list = (cached.data?.results ?? []) as Row[];
      setStates([{ v: SEL, t: SEL }, ...list.map((s) => ({ v: String(s.state_name), t: String(s.state_name) }))]);
      return;
    }

    loadingRef.current = true;
    const { data, status } = await loadJSON<{ results: Row[] }>(`${BASE}/states/?client_code=${encodeURIComponent(client)}`);
    loadingRef.current = false;

    if (!data) {
      setErr(errFor("State dropdown", status));
      return;
    }
    setErr("");
    const list = (data?.results ?? []) as Row[];
    const opts = [{ v: SEL, t: SEL }, ...list.map((s) => ({ v: String(s.state_name), t: String(s.state_name) }))];
    setStates(opts);
    statesCache.set(cacheKey, { data: { results: list }, timestamp: Date.now() });
  }, [client]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { opts: states, err, refresh: fetch };
}

export function useBranches(client: string, state: string, allLabel = "ALL") {
  const [branches, setBranches] = useState<Opt[]>([{ v: SEL, t: SEL }]);
  const [err, setErr] = useState("");
  const loadingRef = useRef(false);

  const fetch = useCallback(async () => {
    if (loadingRef.current) return;
    if (!client || client.toUpperCase() === SEL.toUpperCase()) {
      setBranches([{ v: SEL, t: SEL }]);
      setErr("");
      return;
    }

    const cacheKey = getCacheKey("branches", { client_code: client, state: state || "", allLabel });
    const cached = branchesCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      const list = (cached.data?.results ?? []) as Row[];
      setBranches([{ v: allLabel, t: allLabel }, ...list.map((b) => ({ v: String(b.unit_code), t: String(b.unit_name) }))]);
      return;
    }

    loadingRef.current = true;
    const { data, status } = await loadJSON<{ results: Row[] }>(
      `${BASE}/branches/?client_code=${encodeURIComponent(client)}&state=${encodeURIComponent(state || "")}`
    );
    loadingRef.current = false;

    if (!data) {
      setErr(errFor("Branch dropdown", status));
      return;
    }
    setErr("");
    const list = (data?.results ?? []) as Row[];
    const opts = [{ v: allLabel, t: allLabel }, ...list.map((b) => ({ v: String(b.unit_code), t: String(b.unit_name) }))];
    setBranches(opts);
    branchesCache.set(cacheKey, { data: { results: list }, timestamp: Date.now() });
  }, [client, state, allLabel]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { opts: branches, err, refresh: fetch };
}

export function clearCaches() {
  clientCache.clear();
  statesCache.clear();
  branchesCache.clear();
}