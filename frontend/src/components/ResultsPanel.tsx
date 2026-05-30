"use client";

interface Results {
  revenue?: { years: number[] };
  netProfit?: { years: number[] };
  cumulativeTreasury?: { years: number[] };
  indicators?: { van: number; tri?: number; drciYears?: number };
  cashRunwayBreakYear?: number | null;
}

export default function ResultsPanel({ results }: { results: Results | null }) {
  if (!results) {
    return <p style={{ color: "#666" }}>Aucun résultat — lancez un calcul.</p>;
  }

  const ind = results.indicators;

  return (
    <div>
      <h3>Indicateurs de rentabilité</h3>
      <ul>
        <li><strong>VAN (10%):</strong> {ind?.van?.toLocaleString("fr-TN")} TND</li>
        <li><strong>TRI:</strong> {ind?.tri != null ? `${(ind.tri * 100).toFixed(2)}%` : "N/A"}</li>
        <li><strong>DRCI:</strong> {ind?.drciYears?.toFixed(1) ?? "N/A"} ans</li>
        {results.cashRunwayBreakYear && (
          <li style={{ color: "#b31d28" }}>
            Alerte trésorerie — année {results.cashRunwayBreakYear}
          </li>
        )}
        {"bfrCoherent" in results && (
          <li>BFR cohérent : {(results as { bfrCoherent?: boolean }).bfrCoherent ? "Oui" : "Non"}</li>
        )}
        {"balanceSheetBalanced" in results && (
          <li>
            Bilan équilibré : {(results as { balanceSheetBalanced?: boolean }).balanceSheetBalanced ? "Oui" : "Non"}
          </li>
        )}
      </ul>

      <h4 style={{ marginTop: 16 }}>Projection 7 ans — Résultat net</h4>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr style={{ background: "#f0f0f0" }}>
            <th style={{ padding: 8, textAlign: "left" }}>Année</th>
            <th style={{ padding: 8, textAlign: "right" }}>CA</th>
            <th style={{ padding: 8, textAlign: "right" }}>Résultat net</th>
            <th style={{ padding: 8, textAlign: "right" }}>Trésorerie cum.</th>
          </tr>
        </thead>
        <tbody>
          {(results.netProfit?.years ?? []).map((_, i) => (
            <tr key={i} style={{ borderBottom: "1px solid #eee" }}>
              <td style={{ padding: 8 }}>{i + 1}</td>
              <td style={{ padding: 8, textAlign: "right" }}>
                {results.revenue?.years?.[i]?.toLocaleString("fr-TN")}
              </td>
              <td style={{ padding: 8, textAlign: "right" }}>
                {results.netProfit?.years?.[i]?.toLocaleString("fr-TN")}
              </td>
              <td style={{ padding: 8, textAlign: "right" }}>
                {results.cumulativeTreasury?.years?.[i]?.toLocaleString("fr-TN")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
