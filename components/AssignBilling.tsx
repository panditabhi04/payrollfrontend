"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { getJSON as apiGet, postJSON as apiPost } from "@/lib/api/legacy-fetch";

export default function AssignBilling() {
  const [loading, setLoading] = useState(false);
  
  const [policies, setPolicies] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  
  const [selectedPolicy, setSelectedPolicy] = useState("0");
  const [selectedClient, setSelectedClient] = useState("");
  
  const [leftItems, setLeftItems] = useState<any[]>([]);
  const [rightItems, setRightItems] = useState<any[]>([]);
  
  const [selectedLeft, setSelectedLeft] = useState<string[]>([]);
  const [selectedRight, setSelectedRight] = useState<string[]>([]);

  const policyRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    fetchLists();
  }, []);

  const fetchLists = async () => {
    setLoading(true);
    try {
      const res = await apiGet(`/api/payroll/assign-billing/lists/`);
      if (res) {
        setPolicies(res.policies || []);
        setClients(res.clients || []);
      }
    } catch (err: any) {
      console.error(err);
      alert("Error fetching options.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedPolicy !== "0") {
      fetchPolicyUnits();
    } else {
      setRightItems([]);
    }
  }, [selectedPolicy]);

  useEffect(() => {
    if (selectedClient && selectedPolicy !== "0") {
      fetchClientUnits();
    } else {
      setLeftItems([]);
    }
  }, [selectedClient, selectedPolicy]);

  const fetchPolicyUnits = async () => {
    setLoading(true);
    try {
      const res = await apiGet(`/api/payroll/assign-billing/policy_units/?policy=${encodeURIComponent(selectedPolicy)}`);
      if (res) setRightItems(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchClientUnits = async () => {
    setLoading(true);
    try {
      const res = await apiGet(`/api/payroll/assign-billing/client_units/?client=${encodeURIComponent(selectedClient)}`);
      if (res) setLeftItems(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const moveRight = (e: React.MouseEvent) => {
    e.preventDefault();
    const itemsToMove = leftItems.filter(item => selectedLeft.includes(item.unit_code));
    setRightItems([...rightItems, ...itemsToMove]);
    setLeftItems(leftItems.filter(item => !selectedLeft.includes(item.unit_code)));
    setSelectedLeft([]);
  };

  const moveLeft = (e: React.MouseEvent) => {
    e.preventDefault();
    const itemsToMove = rightItems.filter(item => selectedRight.includes(item.unit_code));
    setLeftItems([...leftItems, ...itemsToMove]);
    setRightItems(rightItems.filter(item => !selectedRight.includes(item.unit_code)));
    setSelectedRight([]);
  };

  const moveAllRight = (e: React.MouseEvent) => {
    e.preventDefault();
    setRightItems([...rightItems, ...leftItems]);
    setLeftItems([]);
    setSelectedLeft([]);
  };

  const moveAllLeft = (e: React.MouseEvent) => {
    e.preventDefault();
    setLeftItems([...leftItems, ...rightItems]);
    setRightItems([]);
    setSelectedRight([]);
  };

  const validate = () => {
    if (selectedPolicy === "0") {
      alert("Please Select Policy.");
      policyRef.current?.focus();
      return false;
    }
    return true;
  };

  const handleSave = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!validate()) return;
    
    setLoading(true);
    try {
      const units = rightItems.map(u => u.unit_code);
      const out: any = await apiPost(`/api/payroll/assign-billing/assign/`, { policy: selectedPolicy, units });
      alert(out?.message || (out?.status === "success" ? "Branches added successfully to Policy." : "Branches adding failed to Policy."));
      setSelectedPolicy("0");
      setRightItems([]);
      setLeftItems([]);
      setSelectedClient("");
    } catch (err: any) {
      console.error(err);
      alert("Branches adding failed to Policy.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-fluid" style={{ maxWidth: "99%" }}>
      {loading && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(204, 204, 204, 0.7)", zIndex: 9999 }}>
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}>Loading...</div>
        </div>
      )}

      <div className="panel panel-primary">
        <div className="panel-heading">
          <div className="row">
            <div className="col-sm-1"></div>
            <div className="col-sm-9">
              <div style={{ color: "#fff", fontSize: "small" }} className="text-center text-uppercase"><b>ASSIGN POLICY</b></div>
            </div>
            <div className="col-sm-2 text-right">
              <Link href="#" onClick={(e) => { e.preventDefault(); window.open("html/travelling_managment.html", "popUpWindow", "height=500,width=600,left=100,top=100,toolbar=no,menubar=no,location=no,directories=no,scrollbars=yes,status=No"); }} style={{ fontSize: "10px" }}>
                <img src="/Images/help_ico.png" alt="Help" width="20" height="20" title="Help" />
              </Link>
            </div>
          </div>
        </div>

        <div className="panel-body">
          <br />
          <br />
          <div className="row">
            <div className="col-lg-2 col-md-2 col-sm-3 col-xs-12">
              Policies :
              <select ref={policyRef} value={selectedPolicy} onChange={(e) => setSelectedPolicy(e.target.value)} className="form-control dropdown-toggle">
                <option value="0">Select Policy</option>
                {policies.map(p => <option key={p.id} value={p.id}>{p.txt_policy_name}</option>)}
              </select>
            </div>
            <div className="col-lg-2 col-md-2 col-sm-3 col-xs-12">
              Client Name :
              <select value={selectedClient} onChange={(e) => setSelectedClient(e.target.value)} className="form-control">
                <option value="">Select</option>
                {clients.map(c => <option key={c.client_code} value={c.client_code}>{c.client_name}</option>)}
              </select>
            </div>
          </div>
          <br />

          <div id="employeepanel">
            <div className="row">
              <div className="col-sm-3 col-xs-12" style={{ marginLeft: "170px" }}>
                <select 
                  multiple 
                  value={selectedLeft}
                  onChange={(e) => setSelectedLeft(Array.from(e.target.selectedOptions, option => option.value))}
                  style={{ width: "100%", height: "300px" }}
                >
                  {leftItems.map(item => (
                    <option key={item.unit_code} value={item.unit_code}>{item.unit_name}</option>
                  ))}
                </select>
              </div>
              
              <div className="col-sm-1 col-xs-12 "></div>
              
              <div className="col-sm-2 col-xs-12 ">
                <br />
                <br />
                <div className="row">
                  <button onClick={moveAllRight} className="btn btn-primary" style={{ marginLeft: "25px", fontWeight: "bold" }}>&gt;&gt;</button>
                </div>
                <br />
                <br />
                <br />
                <div className="row">
                  <button onClick={moveRight} className="btn btn-primary" style={{ paddingLeft: "20px", textAlign: "center", marginLeft: "25px", fontWeight: "bold" }}>&gt;</button>
                </div>
                <br />
                <br />
                <br />
                <div className="row">
                  <button onClick={moveLeft} className="btn btn-primary" style={{ paddingLeft: "20px", textAlign: "center", marginLeft: "25px", fontWeight: "bold" }}>&lt;</button>
                </div>
                <br />
                <br />
                <br />
                <div className="row">
                  <button onClick={moveAllLeft} className="btn btn-primary" style={{ marginLeft: "25px", fontWeight: "bold" }}>&lt;&lt;</button>
                </div>
                <br />
                <br />
                <br />
              </div>
              
              <div className="col-sm-3 col-xs-12">
                <select 
                  multiple 
                  value={selectedRight}
                  onChange={(e) => setSelectedRight(Array.from(e.target.selectedOptions, option => option.value))}
                  style={{ width: "100%", height: "300px" }}
                >
                  {rightItems.map(item => (
                    <option key={item.unit_code} value={item.unit_code}>{item.unit_name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          
          <br />
          <br />
          
          <div className="row text-center">
            <button onClick={handleSave} className="btn btn-primary" style={{ fontWeight: "bold", marginRight: "4px" }}>Save</button>
            <button onClick={(e) => { e.preventDefault(); window.location.href="/"; }} className="btn btn-danger" style={{ fontWeight: "bold" }}>Close</button>
          </div>

        </div>
      </div>
    </div>
  );
}
