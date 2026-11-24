import type { ReactNode } from "react";

// Navigation is the legacy IHMS top menu (AppShell). Each master screen is its
// own faithful replica, so this layout is a pass-through — no extra banners or tabs.
export default function MastersLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
