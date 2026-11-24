"use client";
// account_department.aspx - "Accounts_department Approval" page (status 1 -> 2/3).
import CashVoucherApprovals from "@/components/CashVoucherApprovals";

export default function AccountDepartmentPage() {
  const openHelp = () => {
    window.open("/html/CompanyMaster.html", "popUpWindow",
      "height=500,width=600,left=100,top=100,toolbar=no,menubar=no,location=no,directories=no,scrollbars=yes,status=No");
  };
  return (
    <div className="container-fluid" style={{ fontSize: "10px" }}>
      <div className="panel panel-primary" style={{ backgroundColor: "white" }}>
        <div className="panel-heading">
          <div className="row">
            <div className="col-sm-1"></div>
            <div className="col-sm-9">
              <div style={{ color: "#fff", fontSize: "small" }} className="text-center text-uppercase"><b>Accounts_department Approval</b></div>
            </div>
            <div className="col-sm-2 text-right">
              <button type="button" className="btn btn-link" style={{ color: "#fff", padding: 0 }} onClick={openHelp} title="Help">
                <img src="/Images/help_ico.png" width="20" height="20" alt="Help" />
              </button>
            </div>
          </div>
        </div>
        <CashVoucherApprovals only="accounts" />
      </div>
    </div>
  );
}
