import MasterExplorer from "@/components/MasterExplorer";

export const metadata = { title: "Zone — Core Masters" };

export default function ZonePage() {
  return (
    <>
      <MasterExplorer
        resource="zones"
        title="Zone"
        expectedCount={1406}
        searchPlaceholder="Search zone, region, client name…"
        columns={[
          { key: "comp_code", label: "Company" },
          { key: "client_code", label: "Client" },
          { key: "zone", label: "Zone" },
          { key: "region", label: "Region" },
          { key: "type", label: "Type" },
        ]}
      />
      <p style={{ color: "#92400e", fontSize: 13, marginTop: 12 }}>
        ⚠️ Known limitation: the zone ↔ region ↔ client relationship is
        <strong> unresolved</strong> (Phase 2). Fields are shown as stored; no
        relationships are inferred. <code>field1..field5</code> are raw values with no assigned meaning.
      </p>
    </>
  );
}
