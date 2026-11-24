import { API_BASE_URL } from "@/lib/api/client";

/**
 * Open a server-rendered printable HTML document (ID card / PF form / letters, see
 * backend apps/employees/print_views.py) in a new window and print it.
 * The request is sent with the session cookie; failures show the backend's legacy message.
 */
export async function openPrintHtml(path: string): Promise<boolean> {
  const sep = path.includes("?") ? "&" : "?";
  // open synchronously so the popup is not blocked, fill it once the HTML arrives
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) { alert("Please allow popups to print."); return false; }
  w.document.write("<p style='font-family:Arial'>Loading...</p>");
  try {
    const r = await fetch(`${API_BASE_URL}${path}${sep}print=1`, {
      credentials: "include", headers: { Accept: "text/html" }, cache: "no-store",
    });
    if (!r.ok) {
      w.close();
      let msg = "Print view could not be generated.";
      try {
        const d = await r.json();
        const pick = (v: unknown): string => Array.isArray(v) ? pick(v[0]) : typeof v === "string" ? v
          : v && typeof v === "object" ? pick(Object.values(v as Record<string, unknown>)[0]) : "";
        msg = pick(d) || msg;
      } catch { if (r.status === 403) msg = "You do not have permission for this action."; }
      alert(msg);
      return false;
    }
    if ((r.headers.get("Content-Type") || "").includes("application/pdf")) {
      // letters / ID cards drawn in the legacy Crystal layout come back as a PDF: show it in the popup
      const url = URL.createObjectURL(await r.blob());
      w.location.href = url;
      return true;
    }
    const html = await r.text();
    w.document.open();
    w.document.write(html);
    w.document.close();
    return true;
  } catch {
    w.close();
    alert("Print view could not be generated.");
    return false;
  }
}

/** Download a generated file (xlsx / zip / csv) with the session cookie; backend legacy messages are shown on failure. */
export async function downloadAuthed(path: string, fallbackName: string): Promise<boolean> {
  try {
    const r = await fetch(`${API_BASE_URL}${path}`, { credentials: "include", cache: "no-store" });
    if (!r.ok) {
      let msg = "Request failed.";
      try {
        const d = await r.json();
        const pick = (v: unknown): string => Array.isArray(v) ? pick(v[0]) : typeof v === "string" ? v
          : v && typeof v === "object" ? pick(Object.values(v as Record<string, unknown>)[0]) : "";
        msg = pick(d) || msg;
      } catch { if (r.status === 403) msg = "You do not have permission for this action."; }
      alert(msg);
      return false;
    }
    const cd = r.headers.get("Content-Disposition") || "";
    const m = /filename="?([^";]+)"?/i.exec(cd);
    const blob = await r.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = m ? m[1] : fallbackName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
    return true;
  } catch {
    alert("Request failed.");
    return false;
  }
}
