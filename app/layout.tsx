import type { ReactNode } from "react";
import "./globals.css";
import "./alignment.css";
import "./design-system.css";
import "./design-system-pages.css";
import "./compact-frame.css";
import "./design-3d.css";
import AppShell from "@/components/AppShell";
import GridTotals from "@/components/GridTotals";

export const metadata = {
  title: "Celtpayroll",
  description: "Modern Celtpayroll (IHMS) — Django + Next.js",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
        <GridTotals />
      </body>
    </html>
  );
}
