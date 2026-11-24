"use client";

import React, { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { API_BASE_URL } from "@/lib/api/client";
import { formatTime12h, getAddressFromCoords } from "@/lib/api/geocode";
import type { TrackingPoint } from "./GpsTrackingMap";

// Dynamic import with ssr: false ensures Leaflet never runs on server during Next.js SSR
const GpsTrackingMap = dynamic(() => import("./GpsTrackingMap"), {
  ssr: false,
  loading: () => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "520px", background: "#f8fafc", borderRadius: "8px", color: "#64748b" }}>
      <span>Loading OpenStreetMap...</span>
    </div>
  ),
});

interface EmployeeOpt {
  emp_code: string;
  emp_name: string;
  comp_code?: string;
  has_tracks?: boolean;
}

interface SessionData {
  id: number;
  status: "Active" | "Completed";
  start_time: string;
  end_time: string | null;
  total_distance_meters: number;
  total_distance_km: number;
  total_points: number;
}

export default function GpsTrackingDashboard() {
  const [employees, setEmployees] = useState<EmployeeOpt[]>([]);
  const [selectedEmp, setSelectedEmp] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  const [session, setSession] = useState<SessionData | null>(null);
  const [points, setPoints] = useState<TrackingPoint[]>([]);
  const [addresses, setAddresses] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<string>("");

  // 1. Load Employees
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/tracking/employees/`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        const list: EmployeeOpt[] = d.results || [];
        setEmployees(list);
        if (list.length > 0 && !selectedEmp) {
          // Pre-select first employee who has tracking data, else first
          const tracked = list.find((e) => e.has_tracks);
          setSelectedEmp(tracked ? tracked.emp_code : list[0].emp_code);
        }
      })
      .catch(() => { });
  }, []);

  // 2. Fetch Route Data
  const loadRouteData = useCallback(async (emp: string, date: string) => {
    if (!emp) return;
    setLoading(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/tracking/history/?emp_code=${encodeURIComponent(emp)}&date=${encodeURIComponent(date)}`,
        { credentials: "include" }
      );
      if (res.ok) {
        const d = await res.json();
        setSession(d.session || null);
        setPoints(d.points || []);
      } else {
        setSession(null);
        setPoints([]);
      }
    } catch {
      setSession(null);
      setPoints([]);
    } finally {
      setLoading(false);
      setLastRefreshed(new Date().toLocaleTimeString());
    }
  }, []);

  useEffect(() => {
    if (selectedEmp && selectedDate) {
      loadRouteData(selectedEmp, selectedDate);
    }
  }, [selectedEmp, selectedDate, loadRouteData]);

  // 3. Auto Refresh Timer (every 15s if enabled and session is Active)
  useEffect(() => {
    if (!autoRefresh || !selectedEmp) return;
    const interval = setInterval(() => {
      loadRouteData(selectedEmp, selectedDate);
    }, 15000);
    return () => clearInterval(interval);
  }, [autoRefresh, selectedEmp, selectedDate, loadRouteData]);

  // 4. Reverse Geocode GPS coordinates into human-readable addresses
  useEffect(() => {
    if (!points || points.length === 0) return;
    let active = true;
    points.forEach((pt) => {
      const key = `${pt.lat.toFixed(5)},${pt.lng.toFixed(5)}`;
      if (addresses[key]) return;
      getAddressFromCoords(pt.lat, pt.lng).then((addr) => {
        if (active && addr) {
          setAddresses((prev) => ({ ...prev, [key]: addr }));
        }
      });
    });
    return () => {
      active = false;
    };
  }, [points]);

  const enrichedPoints = points.map((pt) => {
    const key = `${pt.lat.toFixed(5)},${pt.lng.toFixed(5)}`;
    return {
      ...pt,
      address: addresses[key] || pt.address,
    };
  });

  const currentEmpObj = employees.find((e) => e.emp_code === selectedEmp);

  return (
    <div style={{ padding: "16px 20px 30px", maxWidth: "1400px", margin: "16px auto 0", fontFamily: "system-ui, -apple-system, sans-serif", position: "relative", zIndex: 1 }}>
      {/* Title Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
        <div>
          <h2 style={{ margin: 0, color: "#1e293b", fontSize: "22px", display: "flex", alignItems: "center", gap: "8px" }}>
            <span>🗺️</span> Employee GPS Movement Tracking
          </h2>
          <p style={{ margin: "4px 0 0 0", color: "#64748b", fontSize: "13px" }}>
            Live breadcrumb movement history powered by OpenStreetMap &amp; Leaflet
          </p>
        </div>

        {/* Filter Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          {/* Employee Picker */}
          <div>
            <label style={{ fontSize: "11px", fontWeight: "bold", color: "#475569", display: "block", marginBottom: "2px" }}>EMPLOYEE</label>
            <select
              value={selectedEmp}
              onChange={(e) => setSelectedEmp(e.target.value)}
              style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px", minWidth: "220px", background: "white" }}
            >
              {employees.map((emp) => (
                <option key={emp.emp_code} value={emp.emp_code}>
                  {emp.emp_code} - {emp.emp_name} {emp.has_tracks ? "" : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Date Picker */}
          <div>
            <label style={{ fontSize: "11px", fontWeight: "bold", color: "#475569", display: "block", marginBottom: "2px" }}>DATE</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{ padding: "5px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px", background: "white" }}
            />
          </div>

          {/* Auto Refresh Toggle */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "16px" }}>
            <label style={{ fontSize: "12px", color: "#334155", display: "flex", alignItems: "center", gap: "4px", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
              Auto-refresh (15s)
            </label>
            <button
              onClick={() => loadRouteData(selectedEmp, selectedDate)}
              disabled={loading}
              style={{
                padding: "6px 12px",
                borderRadius: "6px",
                border: "none",
                background: "#0284c7",
                color: "white",
                fontSize: "12px",
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              {loading ? "Refreshing..." : "↻ Refresh"}
            </button>
          </div>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px", marginBottom: "16px" }}>
        {/* Status Card */}
        <div style={{ background: "white", padding: "12px 16px", borderRadius: "8px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <div style={{ fontSize: "11px", color: "#64748b", fontWeight: "bold", textTransform: "uppercase" }}>Tracking Status</div>
          <div style={{ marginTop: "4px", display: "flex", alignItems: "center", gap: "6px" }}>
            {session ? (
              session.status === "Active" ? (
                <span style={{ background: "#dcfce7", color: "#166534", padding: "2px 8px", borderRadius: "12px", fontSize: "12px", fontWeight: "bold" }}>
                  🟢 Active (Punch In)
                </span>
              ) : (
                <span style={{ background: "#f1f5f9", color: "#334155", padding: "2px 8px", borderRadius: "12px", fontSize: "12px", fontWeight: "bold" }}>
                  ⚪ Completed
                </span>
              )
            ) : (
              <span style={{ color: "#94a3b8", fontSize: "13px" }}>No Session</span>
            )}
          </div>
        </div>

        {/* Distance Card */}
        <div style={{ background: "white", padding: "12px 16px", borderRadius: "8px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <div style={{ fontSize: "11px", color: "#64748b", fontWeight: "bold", textTransform: "uppercase" }}>Total Distance</div>
          <div style={{ fontSize: "18px", fontWeight: "bold", color: "#0f172a", marginTop: "2px" }}>
            {session ? (
              session.total_distance_km >= 1
                ? `${session.total_distance_km} km`
                : `${Math.round(session.total_distance_meters)} m`
            ) : (
              "0.0 km"
            )}
          </div>
        </div>

        {/* Recorded Points */}
        <div style={{ background: "white", padding: "12px 16px", borderRadius: "8px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <div style={{ fontSize: "11px", color: "#64748b", fontWeight: "bold", textTransform: "uppercase" }}>Movement Points</div>
          <div style={{ fontSize: "18px", fontWeight: "bold", color: "#0f172a", marginTop: "2px" }}>
            {points.length} <span style={{ fontSize: "12px", color: "#64748b", fontWeight: "normal" }}>pts (50m hops)</span>
          </div>
        </div>

        {/* Start / Last Time */}
        <div style={{ background: "white", padding: "12px 16px", borderRadius: "8px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <div style={{ fontSize: "11px", color: "#64748b", fontWeight: "bold", textTransform: "uppercase" }}>Start → Last Seen</div>
          <div style={{ fontSize: "14px", fontWeight: "bold", color: "#0f172a", marginTop: "4px" }}>
            {session ? (
              `${formatTime12h(session.start_time)} → ${formatTime12h(session.end_time || (points.length > 0 ? points[points.length - 1].time : "-"))}`
            ) : (
              "-"
            )}
          </div>
        </div>
      </div>

      {/* Main Grid: Timeline + Map */}
      <div style={{ display: "grid", gridTemplateColumns: points.length > 0 ? "300px 1fr" : "1fr", gap: "16px", background: "white", padding: "14px", borderRadius: "10px", border: "1px solid #e2e8f0", boxShadow: "0 2px 6px rgba(0,0,0,0.04)" }}>
        {/* Left Side: Timeline of Waypoints */}
        {points.length > 0 && (
          <div style={{ borderRight: "1px solid #f1f5f9", paddingRight: "14px", maxHeight: "560px", overflowY: "auto" }}>
            <h4 style={{ margin: "0 0 10px 0", fontSize: "13px", color: "#334155", textTransform: "uppercase" }}>
              Route Waypoints ({points.length})
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {points.map((pt, i) => (
                <div
                  key={pt.id || i}
                  style={{
                    padding: "8px 10px",
                    borderRadius: "6px",
                    background: i === 0 ? "#f0fdf4" : i === points.length - 1 ? "#fef2f2" : "#f8fafc",
                    border: "1px solid",
                    borderColor: i === 0 ? "#bbf7d0" : i === points.length - 1 ? "#fecaca" : "#e2e8f0",
                    fontSize: "11px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold" }}>
                    <span style={{ color: i === 0 ? "#16a34a" : i === points.length - 1 ? "#dc2626" : "#2563eb" }}>
                      {i === 0 ? "🟢 Point A (Start)" : i === points.length - 1 ? (session?.status === "Active" ? "🔴 Live Point" : "🔴 Point B (End)") : `📍 Point #${i + 1}`}
                    </span>
                    <span style={{ color: "#64748b" }}>{formatTime12h(pt.time)}</span>
                  </div>
                  {/* Human-readable street address instead of raw coordinates */}
                  {/* <div style={{ color: "#1e293b", marginTop: "4px", fontSize: "11.5px", lineHeight: "1.35", display: "flex", alignItems: "flex-start", gap: "4px" }}>
                    <span style={{ color: "#2563eb", flexShrink: 0, fontSize: "12px" }}>📍</span>
                    <span style={{ fontWeight: 500 }}>
                      {addresses[`${pt.lat.toFixed(5)},${pt.lng.toFixed(5)}`] || "Fetching address..."}
                    </span>
                  </div> */}
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: "3px", color: "#64748b", fontSize: "10px" }}>
                    <span>{pt.dist ? `+${pt.dist} m` : "0 m"}</span>
                    {pt.acc && <span>±{Math.round(pt.acc)}m acc</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Right Side: Leaflet Map */}
        <div style={{ minHeight: "540px", borderRadius: "8px", overflow: "hidden" }}>
          <GpsTrackingMap
            points={enrichedPoints}
            status={session?.status || "Active"}
            totalDistanceKm={session?.total_distance_km || 0}
          />
        </div>
      </div>

      {lastRefreshed && (
        <div style={{ textAlign: "right", fontSize: "11px", color: "#94a3b8", marginTop: "8px" }}>
          Last checked at: {lastRefreshed}
        </div>
      )}
    </div>
  );
}
