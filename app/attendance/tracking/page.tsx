import GpsTrackingDashboard from "@/components/GpsTrackingDashboard";

export const metadata = {
  title: "Employee GPS Tracking (50m Movement) | IHMS",
  description: "Live movement-based GPS tracking and route history map powered by OpenStreetMap & Leaflet",
};

export default function GpsTrackingPage() {
  return <GpsTrackingDashboard />;
}
