"use client";

// Adds a bold "Total: N" badge (top-right) above every data grid that does not already show one.
// All grids now render every record (no paging), so the number of body rows is the full-dataset count.
// "Showing X of N" appears when a client-side search/filter has hidden some rows (detected via the
// grid's own search box: the largest row count seen for that table since it was mounted).

import { useEffect } from "react";

const BADGE = "grid-total-badge";

function dataRows(t: HTMLTableElement): number {
  const body = t.tBodies[0];
  if (!body) return 0;
  let n = 0;
  for (const r of Array.from(body.rows)) {
    const cells = r.cells;
    if (cells.length === 1 && cells[0].colSpan > 1) continue; // "No records" placeholder row
    n++;
  }
  return n;
}

function sync() {
  const root = document.querySelector(".app-content") ?? document.body;
  const tables = Array.from(root.querySelectorAll<HTMLTableElement>("table")).filter((t) => {
    if (!t.tHead || t.tHead.rows.length === 0) return false;
    if (t.closest(".dt")) return false; // DataTable has its own total
    if (t.closest("[data-no-total]")) return false;
    const n = dataRows(t);
    return n >= 0 && t.tBodies[0] && t.tBodies[0].rows.length > 0;
  });
  const keep = new Set<Element>();
  for (const t of tables) {
    const host = (t.closest(".dt-scroll, .lg-grid-wrapper, .grid-view") as HTMLElement | null) ?? t;
    const parent = host.parentElement;
    if (!parent) continue;
    // a sibling already announces a total -> skip
    const prev = host.previousElementSibling as HTMLElement | null;
    let badge: HTMLElement | null = prev && prev.classList.contains(BADGE) ? prev : null;
    const total = dataRows(t);
    const seen = Math.max(Number(badge?.dataset.max ?? 0), total);
    if (!badge) {
      if (/Total:\s*\d+/.test(parent.textContent?.slice(0, 20000) ?? "") && !parent.querySelector("." + BADGE)) {
        // the component renders its own "Total: N"; don't duplicate
        continue;
      }
      badge = document.createElement("div");
      badge.className = BADGE;
      badge.style.cssText = "text-align:right;margin:4px 0;font-size:12px;font-weight:700;color:#2b3a67";
      parent.insertBefore(badge, host);
    }
    badge.dataset.max = String(seen);
    badge.textContent = total < seen ? `Showing ${total} of ${seen} records` : `Total: ${total} records`;
    keep.add(badge);
  }
  document.querySelectorAll("." + BADGE).forEach((b) => {
    if (!keep.has(b)) b.remove();
  });
}

export default function GridTotals() {
  useEffect(() => {
    let raf = 0;
    const run = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(sync); };
    const mo = new MutationObserver((muts) => {
      // ignore our own badge edits
      if (muts.every((m) => (m.target as HTMLElement).classList?.contains(BADGE) ||
        Array.from(m.addedNodes).concat(Array.from(m.removedNodes)).every((n) => (n as HTMLElement).classList?.contains(BADGE)))) return;
      run();
    });
    mo.observe(document.body, { childList: true, subtree: true, characterData: true });
    run();
    return () => { mo.disconnect(); cancelAnimationFrame(raf); };
  }, []);
  return null;
}
