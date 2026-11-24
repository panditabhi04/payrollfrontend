"use client";
/* =====================================================================
 * IT MASTER — 1:1 port of ITMASTER.aspx (NOT Income_Tax.aspx).
 * /masters/income-tax stays as the Income Tax page; this is the IT admin
 * hub with all 13 legacy tabs, exact tab names, exact validation alert
 * strings, exact grid columns, and DataTable-style export buttons
 * (csv / print / copy / colvis) on every grid.
 * Backend: /api/masters/it-master/* (apps/masters/it_master.py).
 * RBAC menu: "IT Master".
 * Date formats (legacy): month boxes = mm/yy, date boxes = yy/mm/dd.
 * ===================================================================== */
import React, { useState, memo } from "react";
import dynamic from "next/dynamic";

// Tabs render in the browser only: React.lazy + Suspense produced different server and client
// HTML (hydration error); these are post-login admin tools, SSR gives them nothing.
const LoadingFallback = memo(function LoadingFallback() {
  return <div style={{ padding: 20, textAlign: "center", color: "#666" }}>Loading tab...</div>;
});

const TabAttendanceApproval = dynamic(() => import("./it-master-tabs/TabAttendanceApproval"), { ssr: false, loading: () => <LoadingFallback /> });
const TabEmpDates = dynamic(() => import("./it-master-tabs/TabEmpDates"), { ssr: false, loading: () => <LoadingFallback /> });
const TabRemoveDuplicate = dynamic(() => import("./it-master-tabs/TabRemoveDuplicate"), { ssr: false, loading: () => <LoadingFallback /> });
const TabSojso = dynamic(() => import("./it-master-tabs/TabSojso"), { ssr: false, loading: () => <LoadingFallback /> });
const TabContract = dynamic(() => import("./it-master-tabs/TabContract"), { ssr: false, loading: () => <LoadingFallback /> });
const TabBank = dynamic(() => import("./it-master-tabs/TabBank"), { ssr: false, loading: () => <LoadingFallback /> });
const TabEmpCount = dynamic(() => import("./it-master-tabs/TabEmpCount"), { ssr: false, loading: () => <LoadingFallback /> });
const TabEmail = dynamic(() => import("./it-master-tabs/TabEmail"), { ssr: false, loading: () => <LoadingFallback /> });
const TabStrength = dynamic(() => import("./it-master-tabs/TabStrength"), { ssr: false, loading: () => <LoadingFallback /> });
const TabMD = dynamic(() => import("./it-master-tabs/TabMD"), { ssr: false, loading: () => <LoadingFallback /> });
const TabCRN = dynamic(() => import("./it-master-tabs/TabCRN"), { ssr: false, loading: () => <LoadingFallback /> });
const TabBAHA = dynamic(() => import("./it-master-tabs/TabBAHA"), { ssr: false, loading: () => <LoadingFallback /> });
const TabAddBA = dynamic(() => import("./it-master-tabs/TabAddBA"), { ssr: false, loading: () => <LoadingFallback /> });

const TABS = [
  { key: "menu1", label: "Attendance Approval" },
  { key: "menu2", label: "Emp Left_Date and Joining Date" },
  { key: "menu3", label: "Remove duplicate attendance" },
  { key: "menu4", label: "SO/JSO number of days change" },
  { key: "menu5", label: "Contract Date" },
  { key: "menu6", label: "Bank Approval" },
  { key: "menu7", label: "Total Employee Count" },
  { key: "menu8", label: "Update Email" },
  { key: "menu9", label: "Increase Strength" },
  { key: "menu10", label: "MD Approval" },
  { key: "menu11", label: "CRN Update" },
  { key: "menu12", label: "BA-HA Mapping" },
  { key: "menu13", label: "Add BA-Code" },
];

const TabComponents: Record<string, React.ComponentType> = {
  menu1: TabAttendanceApproval,
  menu2: TabEmpDates,
  menu3: TabRemoveDuplicate,
  menu4: TabSojso,
  menu5: TabContract,
  menu6: TabBank,
  menu7: TabEmpCount,
  menu8: TabEmail,
  menu9: TabStrength,
  menu10: TabMD,
  menu11: TabCRN,
  menu12: TabBAHA,
  menu13: TabAddBA,
};

function openHelp() {
  window.open("html/CompanyMaster.html", "popUpWindow",
    "height=500,width=600,left=100,top=100,toolbar=no,menubar=no,location=no,directories=no,scrollbars=yes,status=No");
}

export default function ITMaster() {
  const [hidtab, setHidtab] = useState("menu1");

  const ActiveTab = TabComponents[hidtab];

  return (
    <div className="container-fluid itmaster">
      <div className="lg-panel">
        <div className="lg-panel-head">
          <div className="row">
            <div className="col-sm-10">
              <div style={{ color: "#fff", fontSize: "small" }} className="text-center text-uppercase"><b>IT MASTER</b></div>
            </div>
            <div className="col-sm-2 text-right">
              <button type="button" onClick={openHelp} style={{ background: "transparent", border: "none", cursor: "pointer" }} title="Help">
                <img src="/Images/help_ico.png" width={20} height={20} alt="Help" />
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="container-fluid">
        <div id="tabs" className="itmaster-tabs">
          <input type="hidden" id="hidtab" value={hidtab} readOnly />
          <ul>
            {TABS.map((t) => (
              <li key={t.key} className={hidtab === t.key ? "active" : ""}>
                <a data-toggle="tab" href={`#${t.key}`} onClick={(e) => { e.preventDefault(); setHidtab(t.key); }}>
                  {t.label}
                </a>
              </li>
            ))}
          </ul>
          <div id={hidtab} className="itmaster-body">
            <ActiveTab />
          </div>
        </div>
      </div>
    </div>
  );
}