"use client";

import React, { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import { formatTime12h } from "@/lib/api/geocode";

export interface TrackingPoint {
  id: number;
  lat: number;
  lng: number;
  acc?: number | null;
  dist?: number;
  speed?: number | null;
  time: string;
  datetime?: string;
  type: "START" | "WAYPOINT" | "END" | "CURRENT";
  address?: string;
}

interface Props {
  points: TrackingPoint[];
  status?: string;
  totalDistanceKm?: number;
}

export default function GpsTrackingMap({ points, status = "Active", totalDistanceKm = 0 }: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const layerGroupRef = useRef<any>(null);
  const leafletModuleRef = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);

  // 1. Initialize Map ONCE on mount (prevents recreation during zoom animations)
  useEffect(() => {
    let isMounted = true;

    async function initMap() {
      if (!mapContainerRef.current || mapInstanceRef.current) return;
      const L = (await import("leaflet")).default;
      if (!isMounted) return;
      leafletModuleRef.current = L;

      // Default center fallback (Pune)
      const defaultCenter: [number, number] = points.length > 0
        ? [points[0].lat, points[0].lng]
        : [18.5204, 73.8567];

      const map = L.map(mapContainerRef.current, {
        center: defaultCenter,
        zoom: points.length > 0 ? 16 : 13,
        zoomControl: true,
      });

      // OpenStreetMap Tiles
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      // Dedicated layer group for polyline and markers (cleared & redrawn on updates)
      const layerGroup = L.layerGroup().addTo(map);
      layerGroupRef.current = layerGroup;
      mapInstanceRef.current = map;

      if (isMounted) {
        setMapReady(true);
      }
    }

    initMap();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.stop(); // Stop any pending zoom transitions
          mapInstanceRef.current.remove();
        } catch {
          // ignore cleanup errors on unmount
        }
        mapInstanceRef.current = null;
        layerGroupRef.current = null;
      }
    };
  }, []);

  // 2. Update layers (polyline & markers) smoothly without destroying the map
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layers = layerGroupRef.current;
    const L = leafletModuleRef.current;

    if (!map || !layers || !L) return;

    // Clear previous markers & lines smoothly
    layers.clearLayers();

    if (!points || points.length === 0) return;

    const latlngs: [number, number][] = points.map((p) => [p.lat, p.lng]);

    // 1. Draw connecting polyline route
    const polyline = L.polyline(latlngs, {
      color: "#2563eb", // Vibrant blue
      weight: 5,
      opacity: 0.85,
      smoothFactor: 1,
    });
    layers.addLayer(polyline);

    // Fit map to route bounds safely
    try {
      map.fitBounds(polyline.getBounds(), { padding: [50, 50], maxZoom: 17, animate: false });
    } catch {
      // ignore fitBounds if coordinates identical
    }

    // 2. Custom Icons
    const startIcon = L.divIcon({
      className: "custom-gps-pin-start",
      html: `<div style="
        background: #16a34a;
        color: white;
        width: 34px;
        height: 34px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        font-size: 14px;
        border: 3px solid white;
        box-shadow: 0 3px 8px rgba(0,0,0,0.35);
      ">A</div>`,
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    });

    const endIcon = L.divIcon({
      className: "custom-gps-pin-end",
      html: `<div style="
        background: #dc2626;
        color: white;
        width: 34px;
        height: 34px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        font-size: 14px;
        border: 3px solid white;
        box-shadow: 0 3px 8px rgba(0,0,0,0.35);
        position: relative;
      ">
        B
        ${status === "Active" ? `<span style="
          position: absolute;
          inset: -4px;
          border-radius: 50%;
          border: 2px solid #ef4444;
          animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
        "></span>` : ""}
      </div>`,
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    });

    const waypointIcon = (seq: number) => L.divIcon({
      className: "custom-gps-waypoint",
      html: `<div style="
        background: #3b82f6;
        color: white;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 10px;
        font-weight: bold;
        border: 2px solid white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.25);
      ">${seq}</div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });

    // 3. Place Markers
    points.forEach((pt, idx) => {
      let icon = waypointIcon(idx + 1);
      let title = `Point #${idx + 1}`;

      if (idx === 0) {
        icon = startIcon;
        title = "🟢 Point A (Start / Punch In)";
      } else if (idx === points.length - 1) {
        icon = endIcon;
        title = status === "Active" ? "🔴 Live Current Location" : "🔴 Point B (End / Punch Out)";
      }

      const marker = L.marker([pt.lat, pt.lng], { icon });
      layers.addLayer(marker);

      const formattedTime = formatTime12h(pt.time || pt.datetime);
      const addressText = pt.address
        ? `<div><b>Address:</b> 📍 ${pt.address}</div>`
        : `<div><b>Lat, Lng:</b> ${pt.lat.toFixed(5)}, ${pt.lng.toFixed(5)}</div>`;

      const popupContent = `
        <div style="font-family: system-ui, sans-serif; font-size: 12px; line-height: 1.4; min-width: 190px;">
          <b style="font-size: 13px; color: #1e293b;">${title}</b>
          <hr style="margin: 6px 0; border: none; border-top: 1px solid #e2e8f0;" />
          <div><b>Time:</b> ${formattedTime}</div>
          ${addressText}
          ${pt.dist ? `<div><b>Moved:</b> +${pt.dist} m</div>` : ""}
          ${pt.acc ? `<div><b>Accuracy:</b> ±${Math.round(pt.acc)} m</div>` : ""}
          ${pt.speed ? `<div><b>Speed:</b> ${pt.speed} km/h</div>` : ""}
        </div>
      `;

      marker.bindPopup(popupContent);

      // Open popup on last point by default
      if (idx === points.length - 1) {
        marker.openPopup();
      }
    });
  }, [points, status, mapReady]);

  return (

    <div style={{ position: "relative", zIndex: 1, isolation: "isolate", width: "100%", height: "100%", minHeight: "520px" }}>
      <div ref={mapContainerRef} style={{ width: "100%", height: "100%", minHeight: "520px", borderRadius: "8px", zIndex: 1 }} />
    </div>
  );
}
