"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { getMe, logout, type Me } from "@/lib/api/auth";
import { getMenu, routeFor, type MenuNode } from "@/lib/api/menu";
import { API_BASE_URL } from "@/lib/api/client";

const BARE = [
  "/",
  "/login",
  "/password-setup",
  "/privacy-policy",
  "/login/privacy-policy",
  "/terms-and-conditions",
  "/login/terms-and-conditions",
];

// A leaf/link or a sub-group inside a dropdown (recursive, supports the legacy ▶ submenus).
function MenuItemNode({ node, close }: { node: MenuNode; close: () => void }) {
  const [open, setOpen] = useState(false);
  const route = routeFor(node.page);
  const hasChildren = node.children.length > 0;

  if (hasChildren) {
    return (
      <div className="ihms-sub" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
        <div className="ihms-item ihms-hassub" onClick={() => setOpen(!open)}>
          <span>{node.name}</span><span className="sub-caret">▶</span>
        </div>
        {open && (
          <div className="ihms-flyout">
            {node.children.map((c) => <MenuItemNode key={c.id} node={c} close={close} />)}
          </div>
        )}
      </div>
    );
  }
  if (route) {
    return <Link href={route} className="ihms-item" onClick={close}>{node.name}</Link>;
  }
  return <span className="ihms-item disabled" title="Not yet migrated">{node.name}</span>;
}

// Legacy MasterPage getaccess(): only menus granted to the user's role are shown.
// A page (leaf) is kept when granted. A group is kept only when at least one page under it
// is granted: Manage Role saves every group heading for every role, so the group's own
// grant must not make an empty dropdown appear. Staff/superuser see all.
function filterMenu(nodes: MenuNode[], granted: Set<string>): MenuNode[] {
  const out: MenuNode[] = [];
  for (const n of nodes) {
    const kids = filterMenu(n.children, granted);
    const isAllowed = granted.has(String(n.id)) || n.id >= 9000;
    if (n.children.length > 0 ? kids.length > 0 : isAllowed) {
      out.push({ ...n, children: kids });
    }
  }
  return out;
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [menu, setMenu] = useState<MenuNode[]>([]);
  const [open, setOpen] = useState<number | null>(null);
  // The logged-in user's own company logo (uploaded in Company Master); refreshed on every navigation.
  const [companyLogo, setCompanyLogo] = useState<{ url: string; name: string }>({ url: "", name: "" });

  useEffect(() => {
    let alive = true;
    getMe().then((m) => {
      if (!alive) return;
      setMe(m);
      // legacy: no session -> Response.Redirect("Login_Page.aspx") on every page
      if (!m && !BARE.includes(pathname)) router.replace("/login");
    });
    getMenu().then((tree) => { if (alive) setMenu(tree); });
    return () => { alive = false; };
  }, [pathname]);

  useEffect(() => { setOpen(null); }, [pathname]);

  useEffect(() => {
    if (!me) { setCompanyLogo({ url: "", name: "" }); return; }
    let alive = true;
    fetch(`${API_BASE_URL}/api/masters/company-logo/`, { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive && d) setCompanyLogo({ url: d.logo_url ? `${API_BASE_URL}${d.logo_url}` : "", name: d.company_name || "" }); })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [me, pathname]);

  // Permissions not loaded yet (me === null) -> show no menu rather than flashing everything.
  const visibleMenu = useMemo(() => {
    if (!me) return [];
    if (me.is_staff) return menu;
    const granted = new Set<string>();
    for (const p of me.permissions ?? []) {
      if (p.menu_id != null && p.permission !== "I") granted.add(String(p.menu_id));
    }
    return filterMenu(menu, granted);
  }, [me, menu]);

  if (BARE.includes(pathname)) return <>{children}</>;

  const onLogout = async () => { await logout(); setMe(null); router.push("/login"); };
  const initials = me?.username ? me.username.slice(0, 2).toUpperCase() : "?";

  return (
    <>
      <header className="ihms-header">
        <Link href="/" className="ihms-brand" aria-label="IHMS Home">
          {/* one logo only: the user's company logo (Company Master) when it has one, else the default IHMS logo */}
          {companyLogo.url ? (
            <img src={companyLogo.url} alt={companyLogo.name || "Company logo"} title={companyLogo.name}
              className="ihms-logo ihms-company-logo" onError={() => setCompanyLogo({ url: "", name: "" })} />
          ) : (
            <img src="/logo.png" alt="IHMS" className="ihms-logo" />
          )}
        </Link>
        <nav className="ihms-nav" onMouseLeave={() => setOpen(null)}>
          {visibleMenu.map((g) => (
            <div key={g.id} className="ihms-group" onMouseEnter={() => setOpen(g.id)}>
              <button className="ihms-top" onClick={() => setOpen(open === g.id ? null : g.id)}>
                {g.name}{g.children.length > 0 && <span className="caret"> ▾</span>}
              </button>
              {open === g.id && g.children.length > 0 && (
                <div className="ihms-dropdown">
                  {g.children.map((c) => <MenuItemNode key={c.id} node={c} close={() => setOpen(null)} />)}
                </div>
              )}
            </div>
          ))}
        </nav>
        <div className="ihms-user">
          {me ? (
            <>
              <span className="ihms-avatar" title={me.username}>{initials}</span>
              <span className="ihms-who">{me.username} · {me.scope.comp_code ?? "—"}</span>
              <Link href="/account" className="ihms-btn" style={{ textDecoration: "none" }}>Account</Link>
              <button className="ihms-btn" onClick={onLogout}>Log out</button>
            </>
          ) : (
            <Link href="/login" className="ihms-btn" style={{ textDecoration: "none" }}>Sign in</Link>
          )}
        </div>
      </header>
      <div className="app-content">{children}</div>
      <footer className="app-footer">
        Copyright &copy; 2020 CeltSoft. All rights reserved.
      </footer>
    </>
  );
}
