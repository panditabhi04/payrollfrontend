import React, { useState } from "react";
import Link from "next/link";
import { mk } from "@/lib/api/legacy-fetch";

interface Props {
  activeTab: string;
}

export default function LegacyTabContents({ activeTab }: Props) {
  const [msg, setMsg] = useState("");

  const handleAction = async (label: string) => {
    setMsg(`Processing ${label}...`);
    // Simulate API call for the legacy tab action
    const r = await mk(`/api/payroll/legacy/${activeTab.toLowerCase().replace(/ /g, '_')}/${label.toLowerCase().replace(/ /g, '_')}/`, {});
    await new Promise(res => setTimeout(res, 500));
    setMsg(`${label} completed successfully for ${activeTab}.`);
  };

  const Btn = ({ label }: { label: string }) => (
    <button
      className="btn btn-primary"
      onClick={() => handleAction(label)}
      style={{
        background: "#337ab7",
        border: "1px solid #2e6da4",
        color: "#fff",
        padding: "6px 20px",
        borderRadius: "4px",
        marginRight: "10px",
        marginBottom: "10px"
      }}
    >
      {label}
    </button>
  );

  const CloseBtn = () => (
    <Link
      href="/"
      className="btn btn-danger"
      style={{
        background: "#d9534f",
        border: "1px solid #d43f3a",
        color: "#fff",
        padding: "6px 20px",
        borderRadius: "4px",
        textDecoration: "none",
        display: "inline-block",
        marginBottom: "10px"
      }}
    >
      Close
    </Link>
  );

  const Message = () => (
    msg ? <div style={{ color: "green", fontWeight: "bold", textAlign: "center", marginBottom: "15px", padding: "10px", background: "#dff0d8", border: "1px solid #d6e9c6", borderRadius: "4px" }}>{msg}</div> : null
  );

  if (activeTab === "Payment") return null; // handled in page.tsx

  if (activeTab === "OT Payment") {
    return (
      <div style={{ padding: "20px" }}>
        <div style={{ marginBottom: "20px" }}>
          <b>Employee XL Type : </b>
          <select className="form-control" style={{ width: "200px", display: "inline-block", marginLeft: "10px" }}>
            <option>Employee XL</option>
            <option>Without Ac/No XL</option>
            <option>Left Employee XL</option>
            <option>Reliever Employee XL</option>
          </select>
        </div>
        <div>
          <Btn label="Process" />
          <Btn label="OT Get Employee XL" />
          <Btn label="OT Paid Salary" />
          <Btn label="Get Hold Employee" />
          <CloseBtn />
        </div>
      </div>
    );
  }

  if (activeTab === "Arrears Payment") {
    return (
      <div style={{ padding: "20px" }}>
        <div style={{ display: "flex", gap: "20px", marginBottom: "20px" }}>
          <div>
            <b>Arrear Type: </b>
            <select className="form-control" style={{ width: "150px" }}>
              <option>Month Wise</option>
              <option>Policy Wise</option>
            </select>
          </div>
          <div>
            <b>Employee XL Type: </b>
            <select className="form-control" style={{ width: "200px" }}>
              <option>Employee XL</option>
              <option>Without Ac/No XL</option>
              <option>Left Employee XL</option>
              <option>Reliever Employee XL</option>
            </select>
          </div>
        </div>
        <div>
          <Btn label="Process" />
          <Btn label="Get Employee XL" />
          <Btn label="Paid Salary" />
          <Btn label="Get Annuxure Upload" />
          <Btn label="Query Payment" />
          <CloseBtn />
        </div>
      </div>
    );
  }

  if (activeTab === "Conveyance Payment") {
    return (
      <div style={{ padding: "20px" }}>
        <div style={{ display: "flex", gap: "20px", marginBottom: "20px" }}>
          <div>
            <b>Type : </b>
            <select className="form-control" style={{ width: "200px" }}>
              <option>Conveyance</option>
              <option>Driver Conveyance</option>
            </select>
          </div>
          <div>
            <b>Employee XL Type: </b>
            <select className="form-control" style={{ width: "200px" }}>
              <option>Employee XL</option>
              <option>Without Ac/No XL</option>
              <option>Left Employee XL</option>
            </select>
          </div>
        </div>
        <div>
          <Btn label="Process" />
          <Btn label="Get Employee XL" />
          <Btn label="Paid Conveyance" />
          <Btn label="Payment Approve" />
          <Btn label="Query Payment" />
          <Btn label="Get Hold Employee" />
          <CloseBtn />
        </div>
      </div>
    );
  }

  if (activeTab === "Material Payment") {
    return (
      <div style={{ padding: "20px" }}>
        <div style={{ marginBottom: "20px" }}>
          <b>Employee XL Type : </b>
          <select className="form-control" style={{ width: "200px", display: "inline-block", marginLeft: "10px" }}>
            <option>Employee XL</option>
            <option>Without Ac/No XL</option>
            <option>Left Employee XL</option>
          </select>
        </div>
        <div>
          <Btn label="Process" />
          <Btn label="Get Employee XL" />
          <Btn label="Paid Material" />
          <Btn label="Payment Approve" />
          <CloseBtn />
        </div>
      </div>
    );
  }

  if (activeTab === "Vendor Payment") {
    return (
      <div style={{ padding: "20px" }}>
        <div style={{ display: "flex", gap: "20px", flexWrap: "wrap", marginBottom: "20px" }}>
          <div>
            <b>Month: </b><br/>
            <input type="month" className="form-control" style={{ width: "150px" }} />
          </div>
          <div>
            <b>Vendor Name: </b><br/>
            <select className="form-control" style={{ width: "150px" }}><option>Select</option></select>
          </div>
          <div>
            <b>Purchase Order No: </b><br/>
            <select className="form-control" style={{ width: "150px" }}><option>Select</option></select>
          </div>
          <div>
            <b>Purchase Invoice No: </b><br/>
            <select className="form-control" style={{ width: "150px" }}><option>Select</option></select>
          </div>
          <div>
            <b>Bank: </b><br/>
            <select className="form-control" style={{ width: "150px" }}><option>Select</option></select>
          </div>
          <div>
            <b>Mode Of Payment: </b><br/>
            <select className="form-control" style={{ width: "150px" }}>
              <option>NEFT</option>
              <option>CHEQUE</option>
            </select>
          </div>
        </div>
        <div>
          <Btn label="Process" />
          <Btn label="Get Vendor XL" />
          <Btn label="Paid Vendor Payment" />
          <Btn label="Get Annuxure Upload" />
        </div>
      </div>
    );
  }

  if (activeTab === "R&M Service Payment") {
    return (
      <div style={{ padding: "20px" }}>
        <div style={{ marginBottom: "20px" }}>
          <b>Invoice Slot: </b>
          <select className="form-control" style={{ width: "150px", display: "inline-block", marginLeft: "10px" }}>
            <option>Select</option>
            <option>1 to 15</option>
            <option>16 to 30</option>
          </select>
        </div>
        <div>
          <Btn label="Process" />
          <Btn label="Get Employee XL" />
          <Btn label="Paid Salary" />
        </div>
      </div>
    );
  }

  if (activeTab === "Administrative Expense Payment") {
    return (
      <div style={{ padding: "20px" }}>
        <div>
          <Btn label="Process" />
          <Btn label="Get Employee XL" />
          <Btn label="Paid Salary" />
        </div>
      </div>
    );
  }

  if (activeTab === "Advanced Payment") {
    return (
      <div style={{ padding: "20px" }}>
        <div style={{ display: "flex", gap: "20px", flexWrap: "wrap", marginBottom: "20px" }}>
          <div>
            <b>Select Month: </b><br/>
            <input type="month" className="form-control" style={{ width: "150px" }} />
          </div>
          <div>
            <b>Select Party Type: </b><br/>
            <select className="form-control" style={{ width: "150px" }}>
              <option>Select</option>
              <option>Client</option>
              <option>Vendor</option>
            </select>
          </div>
          <div>
            <b>Select Party: </b><br/>
            <select className="form-control" style={{ width: "150px" }}><option>Select</option></select>
          </div>
          <div>
            <b>State: </b><br/>
            <select className="form-control" style={{ width: "150px" }}><option>Select</option></select>
          </div>
          <div>
            <b>Branch: </b><br/>
            <select className="form-control" style={{ width: "150px" }}><option>Select</option></select>
          </div>
          <div>
            <b>Bank: </b><br/>
            <select className="form-control" style={{ width: "150px" }}><option>Select</option></select>
          </div>
        </div>
        <div>
          <Btn label="Process" />
          <Btn label="Get Employee XL" />
          <Btn label="Paid Payment" />
          <Btn label="Get Annuxure Upload" />
        </div>
      </div>
    );
  }

  if (activeTab === "Shiftwise Payment" || activeTab === "Incentive Payment" || activeTab === "Office Rent Payment") {
    return (
      <div style={{ padding: "20px" }}>
        <div>
          <Btn label="Process" />
          <Btn label="Get Employee XL" />
          <Btn label="Paid Salary" />
          {activeTab === "Shiftwise Payment" && <Btn label="Get Hold Employee" />}
        </div>
      </div>
    );
  }

  if (activeTab === "Yearly Payment") {
    return (
      <div style={{ padding: "20px" }}>
        <div style={{ display: "flex", gap: "20px", flexWrap: "wrap", marginBottom: "20px" }}>
          <div>
            <b>Yearly Billing Type: </b><br/>
            <select className="form-control" style={{ width: "200px" }}>
              <option>Select</option>
              <option>Bonus Billing</option>
              <option>Leave Billing</option>
              <option>Gratuity Billing</option>
            </select>
          </div>
          <div>
            <b>From Month: </b><br/>
            <input type="month" className="form-control" style={{ width: "150px" }} />
          </div>
          <div>
            <b>To Month: </b><br/>
            <input type="month" className="form-control" style={{ width: "150px" }} />
          </div>
        </div>
        <div>
          <Btn label="Process" />
          <Btn label="Get Employee XL" />
          <Btn label="Paid Salary" />
          <CloseBtn />
        </div>
      </div>
    );
  }

  if (activeTab === "Manual Payment") {
    return (
      <div style={{ padding: "20px" }}>
        <div style={{ display: "flex", gap: "20px", marginBottom: "20px" }}>
          <label><input type="radio" name="mp_type" defaultChecked /> Manual Payment</label>
          <label><input type="radio" name="mp_type" /> Bank To Bank</label>
          <label><input type="radio" name="mp_type" /> Bulk Payment</label>
        </div>
        <div style={{ padding: "15px", border: "1px solid #ddd", borderRadius: "4px" }}>
          <p>Bank To Bank / Manual Payment Form details go here.</p>
          <Btn label="Submit" />
        </div>
      </div>
    );
  }

  if (activeTab === "Manual Payment Process") {
    return (
      <div style={{ padding: "20px" }}>
        <p>Grid view for manual payments to process.</p>
        <Btn label="Refresh List" />
      </div>
    );
  }

  return (
    <div style={{ padding: "20px", textAlign: "center", color: "#666" }}>
      <p>This <b>{activeTab}</b> workflow has not been fully migrated to the modern backend yet.</p>
    </div>
  );
}
