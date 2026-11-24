"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getMe, logout, type Me } from "@/lib/api/auth";

export default function AccountPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const data = await getMe();
      if (!data) {
        router.replace("/login"); // protected-route handling
        return;
      }
      if (data.must_change_password) {
        router.replace("/password-setup");
        return;
      }
      setMe(data);
      setLoading(false);
    })();
  }, [router]);

  async function onLogout() {
    await logout();
    router.replace("/login");
  }

  if (loading) return <main style={{ padding: 24 }}>Loading…</main>;
  if (!me) return null;

  return (
    <div className="lg-panel">
      <div className="lg-panel-head" style={{ textAlign: "center" }}>My Account</div>
      <div className="lg-panel-body">
        <div className="lg-btns" style={{ justifyContent: "flex-end" }}>
          <button onClick={onLogout} className="lg-btn lg-btn-red">Log out</button>
        </div>
        <div className="dt-scroll"><table className="dt-grid">
          <tbody>
            <Row k="Login ID" v={me.legacy_login_id} />
            <Row k="Username" v={me.username} />
            <Row k="Active" v={String(me.is_active)} />
            <Row k="Role" v={me.role ?? "—"} />
            <Row k="Company" v={me.scope.comp_code ?? "—"} />
            <Row k="Client" v={me.scope.client_code ?? "—"} />
            <Row k="Unit" v={me.scope.unit_code ?? "—"} />
            <Row k="Permissions" v={`${me.permissions.length} menu grants`} />
          </tbody>
        </table></div>
        <div className="lg-subhead">Modules</div>
        <div className="lg-btns">
          {MODULES.map((m) => (
            <a key={m.href} href={m.href} className="lg-btn" style={{ textDecoration: "none" }}>{m.label}</a>
          ))}
        </div>
      </div>
    </div>
  );
}

const MODULES = [
  { href: "/masters/company", label: "Company" },
  { href: "/masters/client", label: "Client" },
  { href: "/masters/unit", label: "Unit" },
  { href: "/masters/state", label: "State" },
  { href: "/masters/shift", label: "Shift" },
  { href: "/hr/employees", label: "Employees" },
  { href: "/hr/grades", label: "Grades" },
  { href: "/hr/kyc", label: "KYC & Bank" },
  { href: "/leave", label: "Leave Policies" },
  { href: "/attendance/policies", label: "Attendance" },
  { href: "/reports", label: "Reports" },
  { href: "/transactions", label: "Invoices" },
];

function Row({ k, v }: { k: string; v: string }) {
  return (
    <tr>
      <td style={{ fontWeight: 700, width: 160 }}>{k}</td>
      <td>{v}</td>
    </tr>
  );
}
