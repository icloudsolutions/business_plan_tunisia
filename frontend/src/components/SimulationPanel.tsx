"use client";

import type { SimulationItem } from "@/lib/api";

export default function SimulationPanel({ simulations }: { simulations: SimulationItem[] }) {
  if (!simulations.length) {
    return <p style={{ color: "#666", fontSize: 14 }}>Aucune simulation enregistrée.</p>;
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ background: "#f0f0f0" }}>
            <th style={{ padding: 8, textAlign: "left" }}>Scénario</th>
            <th style={{ padding: 8, textAlign: "right" }}>Δ VAN</th>
            <th style={{ padding: 8, textAlign: "right" }}>Δ TRI</th>
            <th style={{ padding: 8, textAlign: "center" }}>Runway base</th>
            <th style={{ padding: 8, textAlign: "center" }}>Runway scénario</th>
          </tr>
        </thead>
        <tbody>
          {simulations.map((s) => {
            const d = s.deltaVsBaseline || {};
            return (
              <tr key={s.id} style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: 8 }}>{s.name}</td>
                <td style={{ padding: 8, textAlign: "right" }}>
                  {typeof d.deltaVan === "number" ? d.deltaVan.toLocaleString("fr-TN") : "—"}
                </td>
                <td style={{ padding: 8, textAlign: "right" }}>
                  {typeof d.deltaTri === "number" ? `${(d.deltaTri * 100).toFixed(2)}%` : "—"}
                </td>
                <td style={{ padding: 8, textAlign: "center" }}>
                  {d.baselineCashBreakYear ?? "—"}
                </td>
                <td style={{ padding: 8, textAlign: "center" }}>
                  {d.scenarioCashBreakYear ?? "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
