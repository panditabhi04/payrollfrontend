/**
 * Basic health / API connectivity test (Phase 1).
 * Verifies the Next.js side can reach the Django backend health endpoint.
 * Usage: npm run health   (backend must be running)
 * Exit code 0 = ok, 1 = failure.
 */
const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

try {
  const res = await fetch(`${base}/api/health/`, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    console.error(`FAIL: backend returned HTTP ${res.status}`);
    process.exit(1);
  }
  const body = await res.json();
  const ok = body.status === "ok" && body.databases?.legacy_readonly?.status === "ok";
  console.log("Backend health response:", JSON.stringify(body));
  if (!ok) {
    console.error("FAIL: backend health not ok");
    process.exit(1);
  }
  console.log("PASS: Next.js reached Django backend; legacy read-only DB is healthy.");
  process.exit(0);
} catch (e) {
  console.error("FAIL: could not reach backend:", e.message);
  process.exit(1);
}
