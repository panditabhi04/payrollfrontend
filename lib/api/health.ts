import { apiGet } from "./client";

export interface HealthResponse {
  service: string;
  phase: number;
  status: "ok" | "degraded";
  databases: {
    default_meta: { status: string };
    legacy_readonly: { status: string };
  };
}

export function getHealth(): Promise<HealthResponse> {
  return apiGet<HealthResponse>("/api/health/");
}
