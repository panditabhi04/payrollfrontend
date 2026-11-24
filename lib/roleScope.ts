import { getJSON } from "@/lib/api/legacy-fetch";

/**
 * Role-grade scope (legacy pay_client_state_role_grade via REPORTING_EMP_SERIES).
 * `unrestricted` users (staff/admin) see everything.
 */
export type RoleScope = {
  unrestricted: boolean;
  rows: { client_code: string; state_name: string; unit_code: string }[];
};

export async function loadRoleScope(): Promise<RoleScope> {
  const d = await getJSON<RoleScope>("/api/masters/role-scope/");
  // fail closed: an unreadable scope allows nothing
  return d ?? { unrestricted: false, rows: [] };
}

export const scopeClient = (s: RoleScope | null, client: string) =>
  !s || s.unrestricted || s.rows.some((r) => r.client_code === client);

export const scopeState = (s: RoleScope | null, client: string, state: string) =>
  !s || s.unrestricted || s.rows.some((r) => r.client_code === client && r.state_name === state);

export const scopeUnit = (s: RoleScope | null, client: string, unit: string) =>
  !s || s.unrestricted || s.rows.some((r) => r.client_code === client && r.unit_code === unit);
