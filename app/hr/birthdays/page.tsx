"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { getJSON, mk, responseMessage } from "@/lib/api/legacy-fetch";
import { API_BASE_URL } from "@/lib/api/client";

// Legacy birthday.aspx ("Birthday Master"): Today's Birthdays (photo, name (grade), wish box + Send
// Notification), Recent Birthdays (previous 8 days) and Upcoming Birthdays (next 8 days).
const B = "/api/hr/birthdays/";
const PLACEHOLDER =
  "data:image/svg+xml;utf8," +
  encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='75' height='75'><rect width='75' height='75' fill='#e5e5e5'/><circle cx='37' cy='28' r='13' fill='#b5b5b5'/><rect x='14' y='46' width='46' height='24' rx='12' fill='#b5b5b5'/></svg>");

type Today = { emp_code: string; name: string; birth_date: string; photo: string };
type Win = { emp_code: string; emp_name: string; grade_desc: string; birth_date: string; photo: string };

const Photo = ({ emp, has, w, h }: { emp: string; has: boolean; w: number; h: number }) => (
  // eslint-disable-next-line @next/next/no-img-element
  <img
    src={has ? `${API_BASE_URL}${B}photo/?emp_code=${encodeURIComponent(emp)}` : PLACEHOLDER}
    onError={(e) => { (e.currentTarget as HTMLImageElement).src = PLACEHOLDER; }}
    width={w} height={h} alt="" style={{ objectFit: "cover" }}
  />
);

// Legacy AllowAlphabet_address keypress filter: letters, digits, space and a few punctuation marks.
const allowed = (ch: string) => "&,-./:;=\\".includes(ch) || /[A-Za-z0-9 ]/.test(ch);

export default function BirthdaysPage() {
  const [today, setToday] = useState<Today[]>([]);
  const [recent, setRecent] = useState<Win[]>([]);
  const [upcoming, setUpcoming] = useState<Win[]>([]);
  const [msgs, setMsgs] = useState<Record<string, string>>({});
  const [open, setOpen] = useState({ t: true, r: true, u: true });

  useEffect(() => {
    getJSON<{ today: Today[]; recent: Win[]; upcoming: Win[] }>(B).then((d) => {
      setToday(d?.today ?? []); setRecent(d?.recent ?? []); setUpcoming(d?.upcoming ?? []);
    });
  }, []);

  const send = async (emp: string) => {
    const message = msgs[emp] ?? "";
    if (message === "") { window.alert("Please Enter Messsage!!"); return; }
    const r = await mk(`${B}send-notification/`, { emp_code: emp, message });
    if (r.ok) { window.alert("Notification Send successfully!!"); setMsgs({ ...msgs, [emp]: "" }); }
    else window.alert(await responseMessage(r, "Failed"));
  };

  const grid = (rows: Win[]) => (
    <div className="grid-view">
      <table className="table">
        <thead><tr><th>EMP NAME</th><th>EMP GRADE</th><th>BIRTH DATE</th><th>EMP IMAGE</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.emp_code}>
              <td style={{ textAlign: "left" }}>{r.emp_name}</td>
              <td style={{ textAlign: "left" }}>{r.grade_desc}</td>
              <td style={{ textAlign: "left" }}>{r.birth_date}</td>
              <td><Photo emp={r.emp_code} has={!!r.photo} w={75} h={75} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  const head = (label: string, k: "t" | "r" | "u") => (
    <div className="panel panel-primary" style={{ marginBottom: -5, cursor: "pointer" }} onClick={() => setOpen({ ...open, [k]: !open[k] })}>
      <div className="panel-heading text-center"><b style={{ fontSize: 13 }}>{label}</b></div>
    </div>
  );

  return (
    <div className="panel panel-primary">
      <div className="panel-heading text-center text-uppercase"><b>Birthday Master</b></div>
      <div className="panel-body">
        <div style={{ background: "#f3f1fe", border: "1px solid #e2e2dd", borderRadius: 10, padding: 15, margin: "20px 0" }}>
          {head("Today's Birthdays", "t")}<br />
          {open.t && (
            <div className="panel panel-primary" style={{ maxHeight: 250, overflow: "auto" }}>
              <div className="panel-body">
                {today.map((t) => (
                  <div className="row" key={t.emp_code} style={{ display: "flex", gap: 24, alignItems: "flex-start", borderBottom: "1px solid #ddd", padding: "10px 0" }}>
                    <div style={{ width: 120 }}><Photo emp={t.emp_code} has={!!t.photo} w={100} h={130} /></div>
                    <div style={{ flex: 1, maxWidth: 420 }}>
                      <div>{t.name}</div><br />
                      <textarea className="form-control" rows={1} placeholder="Write a birthday wishes..."
                        value={msgs[t.emp_code] ?? ""}
                        onKeyPress={(e) => { if (!allowed(e.key) && e.key.length === 1) e.preventDefault(); }}
                        onChange={(e) => setMsgs({ ...msgs, [t.emp_code]: e.target.value })} />
                      <br />
                      <button className="btn btn-success" type="button" onClick={() => send(t.emp_code)}>Send Notification</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {head("Recent Birthdays", "r")}<br />
          {open.r && <div className="panel panel-primary" style={{ maxHeight: 250, overflow: "auto" }}><div className="panel-body">{grid(recent)}</div></div>}
          {head("Upcoming Birthdays", "u")}<br />
          {open.u && <div className="panel panel-primary" style={{ maxHeight: 250, overflow: "auto" }}><div className="panel-body">{grid(upcoming)}</div></div>}
        </div>
        <div className="text-center"><Link href="/" className="btn btn-primary">Close</Link></div>
      </div>
    </div>
  );
}
