"use client";

import type { SimulationItem } from "@/lib/api";

export default function SimulationPanel({ simulations }: { simulations: SimulationItem[] }) {
  if (!simulations.length) {
    return <p className="empty-state" style={{ padding: "0.5rem 0" }}>Aucune simulation enregistrée.</p>;
  }

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Scénario</th>
            <th className="num">Δ VAN</th>
            <th className="num">Δ TRI</th>
            <th style={{ textAlign: "center" }}>Runway base</th>
            <th style={{ textAlign: "center" }}>Runway scénario</th>
          </tr>
        </thead>
        <tbody>
          {simulations.map((s) => {
            const d = s.deltaVsBaseline ?? {};
            return (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td className="num">
                  {typeof d.deltaVan === "number" ? d.deltaVan.toLocaleString("fr-TN") : "—"}
                </td>
                <td className="num">
                  {typeof d.deltaTri === "number" ? `${(d.deltaTri * 100).toFixed(2)}%` : "—"}
                </td>
                <td style={{ textAlign: "center" }}>{d.baselineCashBreakYear ?? "—"}</td>
                <td style={{ textAlign: "center" }}>{d.scenarioCashBreakYear ?? "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
