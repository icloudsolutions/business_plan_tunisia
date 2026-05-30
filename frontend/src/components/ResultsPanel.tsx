"use client";

interface Results {
  revenue?: { years: number[] };
  netProfit?: { years: number[] };
  cumulativeTreasury?: { years: number[] };
  distributionExpense?: { years: number[] };
  marketingExpense?: { years: number[] };
  indicators?: { van: number; tri?: number; drciYears?: number };
  cashRunwayBreakYear?: number | null;
}

export default function ResultsPanel({ results }: { results: Results | null }) {
  if (!results) {
    return <p className="empty-state" style={{ padding: "1rem 0" }}>Aucun résultat — lancez un calcul.</p>;
  }

  const ind = results.indicators;

  return (
    <div>
      <h3 className="card-title">Indicateurs de rentabilité</h3>
      <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
        <li><strong>VAN (10%):</strong> {ind?.van?.toLocaleString("fr-TN")} TND</li>
        <li><strong>TRI:</strong> {ind?.tri != null ? `${(ind.tri * 100).toFixed(2)}%` : "N/A"}</li>
        <li><strong>DRCI:</strong> {ind?.drciYears?.toFixed(1) ?? "N/A"} ans</li>
        {results.cashRunwayBreakYear && (
          <li style={{ color: "var(--color-danger)" }}>
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
        {results.distributionExpense?.years?.[0] != null && (
          <li>
            Distribution (an 1) : {results.distributionExpense.years[0].toLocaleString("fr-TN")} TND
          </li>
        )}
        {results.marketingExpense?.years?.[0] != null && (
          <li>
            Marketing (an 1) : {results.marketingExpense.years[0].toLocaleString("fr-TN")} TND
          </li>
        )}
      </ul>

      <h4 style={{ marginTop: "1.25rem", marginBottom: "0.5rem" }}>Projection 7 ans</h4>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Année</th>
              <th className="num">CA</th>
              <th className="num">Résultat net</th>
              <th className="num">Trésorerie cum.</th>
            </tr>
          </thead>
          <tbody>
            {(results.netProfit?.years ?? []).map((_, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td className="num">{results.revenue?.years?.[i]?.toLocaleString("fr-TN")}</td>
                <td className="num">{results.netProfit?.years?.[i]?.toLocaleString("fr-TN")}</td>
                <td className="num">{results.cumulativeTreasury?.years?.[i]?.toLocaleString("fr-TN")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
