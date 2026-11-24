"use client";
/* =====================================================================
 * OUTSTANDING REPORT — 1:1 port of Outstanding_Report.aspx.
 * Header "OUTSTANDING REPORT" + help, beige single tab
 * "Send Outsanding Mail" (sic), white Panel9 (Client Name + blue x-large
 * total + TO/CC MAIL ID + Check Outstanding + Send Mail), "Outstanding"
 * h4 + gv_outstanding (Sr No. + auto cols, X-Small, #006699,
 * csv/print/copy/colvis). Exact validations.
 * Backend: /api/transactions/outstanding-portal/* (legacy pay_report_gst).
 * ===================================================================== */
import React, { useEffect, useState } from "react";
import { getJSON, mk } from "@/lib/api/legacy-fetch";

const BASE = "/api/transactions/outstanding-portal";
const SEL = "Select";

type Row = Record<string, any>;

const EMAIL_RE = /^([\w-]+(\.[\w-]+)*)@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.)|(([\w-]+\.)+))([a-zA-Z]{2,4}|[0-9]{1,3})(\]?)$/;

function Msg({ text, ok }: { text: string; ok: boolean }) {
  if (!text) return null;
  return (
    <div style={{ margin: "0 0 10px", padding: "6px 12px", borderRadius: 4, fontSize: 12,
      color: ok ? "#2e7d32" : "#c62828", background: ok ? "#e8f5e9" : "#ffebee",
      border: `1px solid ${ok ? "#a5d6a7" : "#ef9a9a"}` }}>{text}</div>
  );
}
function val(r: Row, name: string): any {
  if (r[name] !== undefined && r[name] !== null) return r[name];
  const want = name.toLowerCase();
  for (const k of Object.keys(r)) {
    if (k.toLowerCase() === want) return (r as Row)[k];
  }
  return "";
}
async function errText(r: Response, fallback: string) {
  const e = await r.json().catch(() => ({} as any));
  return (e as any)?.detail || (e as any)?.non_field_errors?.[0] || (Array.isArray(e) ? (e as any)[0] : fallback);
}

export default function OutstandingPortal() {
  const [clients, setClients] = useState<{ v: string; t: string }[]>([{ v: SEL, t: SEL }]);
  const [client, setClient] = useState(SEL);
  const [total, setTotal] = useState("");
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [emailErr, setEmailErr] = useState("");
  // legacy ddl_client_outstanding_SelectedIndexChanged: Send Mail is visible only when a TO mail is pre-filled
  const [sendVisible, setSendVisible] = useState(true);
  const [hidtab, setHidtab] = useState("menu0");
  const [msg, setMsg] = useState({ text: "", ok: true });
  const show = (text: string, ok = true) => setMsg({ text, ok });

  useEffect(() => {
    (async () => {
      const d = await getJSON<{ results: Row[] }>(`${BASE}/clients/`);
      const list = ((d?.results ?? []) as Row[]);
      setClients([{ v: SEL, t: SEL },
        ...list.map((c) => ({ v: String(val(c, "name")), t: String(val(c, "name")) }))]);
    })();
  }, []);
  const pick = async (v: string) => {
    setClient(v);
    if (!v || v === SEL) { setTotal("0"); setTo(""); setCc(""); setSendVisible(false); return; }
    const t = await getJSON<{ total: string }>(`${BASE}/total/?client_code=${encodeURIComponent(v)}`);
    setTotal(String((t as any)?.total ?? ""));
    const m = await getJSON<any>(`${BASE}/mails/?client_code=${encodeURIComponent(v)}`);
    const toMail = String((m as any)?.to ?? "");
    setTo(toMail); setCc(String((m as any)?.cc ?? "")); setSendVisible(toMail !== "");
  };
  const view = async () => {
    // view_outstanding_validation()
    if (!client || client === SEL) { window.alert("Please Select Client Name"); return; }
    const d = await getJSON<any>(`${BASE}/view/?client_code=${encodeURIComponent(client)}`);
    if (!d || !d.columns) { return; }
    // legacy streams Outstanding_<client>.xls (header-only when nothing matches) and shows no grid
    const esc = (s: any) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const html = `<style> .textmode { } </style><table border=1 width=100%><tr><th bgcolor=yellow colspan=19>OUTSTANDING REPORT</th></tr> <tr>${d.columns.map((c: string) => `<th>${esc(c)}</th>`).join("")}</tr>` +
      d.rows.map((r: any[]) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("") + `</table>`;
    const blob = new Blob(["\ufeff" + html], { type: "application/vnd.ms-excel" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = d.filename;
    document.body.appendChild(a); a.click(); a.remove();
  };
  const send = async () => {
    // R_validation() first (confirm; cancel -> "Record not Available"), then send_mail_validation()
    const r = window.confirm("Are you Sure You Want to Approve Record. The Details can not change after Approve");
    if (!r) { window.alert("Record not Available"); return; }
    if (!client || client === SEL) { window.alert("Please Select Client Name"); return; }
    if (!to) { window.alert("Please Enter To Mail"); return; }
    if (!cc) { window.alert("Please Enter CC Mail"); return; }
    const resp = await mk(`${BASE}/send/`, { client_code: client, to_mail: to, cc_mail: cc });
    if (resp.ok) {
      window.alert("Mail Sent Successfully...!!!"); show("Mail Sent Successfully...!!!", true);
      // legacy resets the client dropdown, TO/CC and the total after a successful send
      setClient(SEL); setTo(""); setCc(""); setTotal("0"); setEmailErr("");
    }
    else { const t = await errText(resp, "Error in Sending Email...!!"); window.alert(t); show(t, false); }
  };
  const checkMail = (v: string) => {
    setTo(v);
    // ValidateEmail()
    setEmailErr(EMAIL_RE.test(v) || v === "" ? "" : "Invalid email address.");
  };
  const openHelp = () => {
    window.open("/html/Outstanding_Report.html", "popUpWindow",
      "height=500,width=600,left=100,top=100,toolbar=no,menubar=no,location=no,directories=no,scrollbars=yes,status=No");
  };
  return (
    <div className="container-fluid itmaster">
      <div className="lg-panel" style={{ marginBottom: 0 }}>
        <div className="lg-panel-head">
          <div className="row">
            <div className="col-sm-1"></div>
            <div className="col-sm-9">
              <div style={{ color: "#fff", fontSize: "small" }} className="text-center text-uppercase">
                <b>OUTSTANDING REPORT</b>
              </div>
            </div>
            <div className="col-sm-2 text-right">
              <button type="button" onClick={openHelp} style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 10 }} title="Help">
                <img src="/Images/help_ico.png" width={20} height={20} alt="Help" />
              </button>
            </div>
          </div>
        </div>
        <div className="lg-panel-body">
          <Msg text={msg.text} ok={msg.ok} />
          <div id="tabs" className="itmaster-tabs">
            <input type="hidden" id="hidtab" value={hidtab} readOnly />
            <ul>
              <li className={hidtab === "menu0" ? "active" : ""}>
                <a href="#menu0" onClick={(e) => { e.preventDefault(); setHidtab("menu0"); }}>
                  <b>Send Outsanding Mail</b>
                </a>
              </li>
            </ul>
            <div id="menu0" className="itmaster-body">
              <div className="container-fluid">
                <div className="panel panel-primary" style={{ borderColor: "white", background: "white" }}>
                  <div className="row">
                    <br />
                    <div className="col-sm-3 col-md-offset-1">
                      <b>Client Name :</b>
                      <select className="form-control" value={client} onChange={(e) => pick(e.target.value)}>
                        {clients.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
                      </select>
                      <div style={{ fontSize: "x-large", color: "blue" }}>{total}</div>
                    </div>
                    <div className="col-sm-2 col-xs-12">
                      <b>TO MAIL ID:</b>
                      <span id="lblError" style={{ color: "red" }}>{emailErr}</span>
                      <textarea className="form-control" value={to} onChange={(e) => checkMail(e.target.value)} />
                    </div>
                    <div className="col-sm-2 col-xs-12">
                      <b>CC MAIL ID:</b>
                      <textarea className="form-control" value={cc} onChange={(e) => setCc(e.target.value)} />
                    </div>
                    <div className="col-sm-2 col-xs-12" style={{ marginTop: 14 }}>
                      <button type="button" className="it-btn btn-block convience" onClick={view}>Check Outstanding</button>
                    </div>
                    <div className="col-sm-1 col-xs-12" style={{ marginTop: 14 }}>
                      {sendVisible && <button type="button" className="it-btn btn-block" style={{ width: "auto" }} onClick={send}>Send Mail</button>}
                    </div>
                    <br /><br />
                  </div>
                  <br /><br />
                </div>
              </div>
              <br />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
