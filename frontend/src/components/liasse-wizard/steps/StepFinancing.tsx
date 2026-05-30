"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import FinancingEligibilityChecker from "@/components/liasse-wizard/FinancingEligibilityChecker";
import FinancingInvestmentSummary from "@/components/liasse-wizard/FinancingInvestmentSummary";
import FinancingSourcesTable from "@/components/liasse-wizard/FinancingSourcesTable";
import FinancingStructureDonut from "@/components/liasse-wizard/FinancingStructureDonut";
import LoanDualAxisChart from "@/components/liasse-wizard/LoanDualAxisChart";
import { useFormat } from "@/hooks/useFormat";
import {
  fetchFinancingStructure,
  syncFinancingStructure,
  updateFinancingSource,
  type FinancingStructureProjection,
} from "@/lib/financing-structure-api";
import {
  createLoan,
  deleteLoan,
  getLoanProjection,
  listLoans,
  syncLoansToLiasse,
  updateLoan,
  type CombinedLoanProjection,
  type LoanFrequency,
  type LoanScheduleProjection,
  type PlanLoan,
} from "@/lib/loans-api";

type Props = {
  planId: string;
  readOnly?: boolean;
};

const MAX_LOANS = 3;
const YEARS = [1, 2, 3, 4, 5, 6, 7] as const;

export default function StepFinancing({ planId, readOnly }: Props) {
  const { formatCurrency } = useFormat();

  const [structure, setStructure] = useState<FinancingStructureProjection | null>(null);
  const [loans, setLoans] = useState<PlanLoan[]>([]);
  const [projection, setProjection] = useState<CombinedLoanProjection | null>(null);
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [structureSaving, setStructureSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [structureSyncing, setStructureSyncing] = useState(false);
  const [error, setError] = useState("");
  const [syncMsg, setSyncMsg] = useState("");

  const refreshStructure = useCallback(async () => {
    try {
      setStructure(await fetchFinancingStructure(planId));
    } catch {
      setStructure(null);
    }
  }, [planId]);

  const load = useCallback(async () => {
    setError("");
    try {
      const [rows, struct] = await Promise.all([
        listLoans(planId),
        fetchFinancingStructure(planId),
      ]);
      setLoans(rows);
      setStructure(struct);
      if (rows.length && !selectedLoanId) setSelectedLoanId(rows[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }, [planId]);

  const refreshProjection = useCallback(async () => {
    try {
      setProjection(await getLoanProjection(planId));
    } catch {
      setProjection(null);
    }
  }, [planId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const t = window.setTimeout(() => void refreshProjection(), 400);
    return () => window.clearTimeout(t);
  }, [loans, refreshProjection]);

  const selectedSchedule: LoanScheduleProjection | null = useMemo(() => {
    if (!projection || !selectedLoanId) return projection?.loans[0] ?? null;
    return projection.loans.find((l) => l.loan_id === selectedLoanId) ?? projection.loans[0] ?? null;
  }, [projection, selectedLoanId]);

  const combinedAnnual = useMemo(() => {
    if (!projection) return [];
    return YEARS.map((y) => ({
      year: y,
      interest: projection.annual_interest[y - 1] ?? 0,
      principal: projection.annual_principal[y - 1] ?? 0,
      balance: projection.annual_ending_balance[y - 1] ?? 0,
    }));
  }, [projection]);

  const persistLoan = async (loan: PlanLoan) => {
    setSaving(true);
    try {
      const row = await updateLoan(planId, loan.id, {
        lender_name: loan.lender_name,
        amount: loan.amount,
        rate: loan.rate,
        term_years: loan.term_years,
        grace_months: loan.grace_months,
        start_date: loan.start_date,
        frequency: loan.frequency,
      });
      setLoans((list) => list.map((l) => (l.id === row.id ? row : l)));
      void refreshProjection();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(false);
    }
  };

  const addLoan = async () => {
    if (loans.length >= MAX_LOANS) return;
    setSaving(true);
    try {
      const row = await createLoan(planId, {
        lender_name: loans.length === 0 ? "CMT" : `Tranche ${loans.length + 1}`,
        amount: 0,
        rate: 0.083,
        term_years: 7,
        grace_months: 12,
        frequency: "quarterly",
        sort_order: loans.length,
      });
      setLoans((list) => [...list, row]);
      setSelectedLoanId(row.id);
      void refreshProjection();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(false);
    }
  };

  const removeLoan = async (id: string) => {
    await deleteLoan(planId, id);
    setLoans((list) => list.filter((l) => l.id !== id));
    if (selectedLoanId === id) setSelectedLoanId(null);
    void refreshProjection();
  };

  const handleSourceUpdate = async (
    sourceId: string,
    patch: Parameters<typeof updateFinancingSource>[2]
  ) => {
    if (readOnly) return;
    setStructureSaving(true);
    setError("");
    try {
      await updateFinancingSource(planId, sourceId, patch);
      await refreshStructure();
      const rows = await listLoans(planId);
      setLoans(rows);
      void refreshProjection();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setStructureSaving(false);
    }
  };

  const handleStructureSync = async () => {
    setStructureSyncing(true);
    setSyncMsg("");
    try {
      const res = await syncFinancingStructure(planId);
      setStructure(res.projection);
      setSyncMsg(res.message);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setStructureSyncing(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncMsg("");
    try {
      const res = await syncLoansToLiasse(planId);
      setSyncMsg(res.message);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16 text-navy-600">
        <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-navy-600">
        Structure de financement (investissement + BFR initial), validation bancaire (≥ 25 %
        fonds propres) et tableaux d&apos;amortissement des emprunts synchronisés depuis CMT /
        leasing.
      </p>

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      {syncMsg && <p className="text-sm text-green-700">{syncMsg}</p>}

      <FinancingInvestmentSummary projection={structure} />
      <FinancingSourcesTable
        projection={structure}
        readOnly={readOnly}
        saving={structureSaving}
        onUpdate={(id, patch) => void handleSourceUpdate(id, patch)}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <FinancingStructureDonut projection={structure} />
        <FinancingEligibilityChecker projection={structure} />
      </div>

      {!readOnly && (
        <button
          type="button"
          disabled={structureSyncing || structureSaving}
          onClick={() => void handleStructureSync()}
          className="inline-flex items-center gap-2 rounded-lg border border-navy-300 bg-white px-4 py-2 text-sm font-medium text-navy-800 hover:bg-navy-50"
        >
          {structureSyncing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Synchroniser ratios avec la liasse
        </button>
      )}

      <section className="rounded-xl border border-navy-100 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-navy-800">
            Tranches d&apos;emprunt (détail amortissement)
          </h4>
          {!readOnly && loans.length < MAX_LOANS && (
            <button
              type="button"
              onClick={() => void addLoan()}
              disabled={saving}
              className="inline-flex items-center gap-1 rounded-lg border border-gold-300 bg-gold-50 px-3 py-1.5 text-sm font-medium text-navy-800"
            >
              <Plus className="h-4 w-4" />
              Ajouter une tranche
            </button>
          )}
        </div>

        {loans.length === 0 ? (
          <p className="rounded-lg border border-dashed border-navy-200 py-8 text-center text-sm text-navy-500">
            Aucun emprunt — ajoutez une tranche pour générer le tableau d&apos;amortissement.
          </p>
        ) : (
          <div className="space-y-4">
            {loans.map((loan) => (
              <div
                key={loan.id}
                className={`rounded-xl border p-4 ${
                  selectedLoanId === loan.id
                    ? "border-gold-400 bg-gold-50/30"
                    : "border-navy-100"
                }`}
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    className="text-sm font-semibold text-navy-800 hover:underline"
                    onClick={() => setSelectedLoanId(loan.id)}
                  >
                    {loan.lender_name || "Emprunt"}
                  </button>
                  {!readOnly && (
                    <button
                      type="button"
                      className="text-red-600"
                      onClick={() => void removeLoan(loan.id)}
                      aria-label="Supprimer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <label className="text-xs font-medium text-navy-700">Montant (TND)</label>
                    <input
                      type="number"
                      min={0}
                      disabled={readOnly}
                      className="mt-1 w-full rounded-lg border border-navy-200 px-3 py-2 text-sm"
                      value={loan.amount}
                      onChange={(e) =>
                        setLoans((list) =>
                          list.map((l) =>
                            l.id === loan.id ? { ...l, amount: Number(e.target.value) } : l
                          )
                        )
                      }
                      onBlur={() => {
                        const cur = loans.find((l) => l.id === loan.id);
                        if (cur) void persistLoan(cur);
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-navy-700">Taux annuel</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.1}
                      disabled={readOnly}
                      className="mt-1 w-full rounded-lg border border-navy-200 px-3 py-2 text-sm"
                      value={Math.round(loan.rate * 1000) / 10}
                      onChange={(e) =>
                        setLoans((list) =>
                          list.map((l) =>
                            l.id === loan.id
                              ? { ...l, rate: Number(e.target.value) / 100 }
                              : l
                          )
                        )
                      }
                      onBlur={() => {
                        const cur = loans.find((l) => l.id === loan.id);
                        if (cur) void persistLoan(cur);
                      }}
                    />
                    <span className="text-xs text-navy-500"> %</span>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-navy-700">Durée (ans)</label>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      disabled={readOnly}
                      className="mt-1 w-full rounded-lg border border-navy-200 px-3 py-2 text-sm"
                      value={loan.term_years}
                      onChange={(e) =>
                        setLoans((list) =>
                          list.map((l) =>
                            l.id === loan.id
                              ? { ...l, term_years: Number(e.target.value) }
                              : l
                          )
                        )
                      }
                      onBlur={() => {
                        const cur = loans.find((l) => l.id === loan.id);
                        if (cur) void persistLoan(cur);
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-navy-700">
                      Différé principal (mois)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={120}
                      disabled={readOnly}
                      className="mt-1 w-full rounded-lg border border-navy-200 px-3 py-2 text-sm"
                      value={loan.grace_months}
                      onChange={(e) =>
                        setLoans((list) =>
                          list.map((l) =>
                            l.id === loan.id
                              ? { ...l, grace_months: Number(e.target.value) }
                              : l
                          )
                        )
                      }
                      onBlur={() => {
                        const cur = loans.find((l) => l.id === loan.id);
                        if (cur) void persistLoan(cur);
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-navy-700">Date de début</label>
                    <input
                      type="date"
                      disabled={readOnly}
                      className="mt-1 w-full rounded-lg border border-navy-200 px-3 py-2 text-sm"
                      value={loan.start_date ?? ""}
                      onChange={(e) =>
                        setLoans((list) =>
                          list.map((l) =>
                            l.id === loan.id
                              ? { ...l, start_date: e.target.value || null }
                              : l
                          )
                        )
                      }
                      onBlur={() => {
                        const cur = loans.find((l) => l.id === loan.id);
                        if (cur) void persistLoan(cur);
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-navy-700">Périodicité</label>
                    <select
                      disabled={readOnly}
                      className="mt-1 w-full rounded-lg border border-navy-200 px-3 py-2 text-sm"
                      value={loan.frequency}
                      onChange={(e) => {
                        const freq = e.target.value as LoanFrequency;
                        setLoans((list) =>
                          list.map((l) => (l.id === loan.id ? { ...l, frequency: freq } : l))
                        );
                      }}
                      onBlur={() => {
                        const cur = loans.find((l) => l.id === loan.id);
                        if (cur) void persistLoan(cur);
                      }}
                    >
                      <option value="quarterly">Trimestrielle</option>
                      <option value="annual">Annuelle</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs font-medium text-navy-700">Prêteur / libellé</label>
                    <input
                      className="mt-1 w-full rounded-lg border border-navy-200 px-3 py-2 text-sm"
                      disabled={readOnly}
                      value={loan.lender_name}
                      onChange={(e) =>
                        setLoans((list) =>
                          list.map((l) =>
                            l.id === loan.id ? { ...l, lender_name: e.target.value } : l
                          )
                        )
                      }
                      onBlur={() => {
                        const cur = loans.find((l) => l.id === loan.id);
                        if (cur) void persistLoan(cur);
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {selectedSchedule && selectedSchedule.periods.length > 0 && (
        <section className="rounded-xl border border-navy-100 bg-white p-4 shadow-sm">
          <h4 className="mb-3 text-sm font-semibold text-navy-800">
            Tableau d&apos;amortissement — {selectedSchedule.lender_name}
          </h4>
          <div className="max-h-80 overflow-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="sticky top-0 bg-navy-50 text-navy-800">
                <tr>
                  <th className="px-2 py-2">#</th>
                  <th className="px-2 py-2">Date</th>
                  <th className="px-2 py-2 text-end">Solde initial</th>
                  <th className="px-2 py-2 text-end">Annuité</th>
                  <th className="px-2 py-2 text-end">Principal</th>
                  <th className="px-2 py-2 text-end">Intérêt</th>
                  <th className="px-2 py-2 text-end">Solde final</th>
                </tr>
              </thead>
              <tbody>
                {selectedSchedule.periods.map((row) => (
                  <tr
                    key={row.period}
                    className={
                      row.in_grace
                        ? "border-b border-sky-100 bg-sky-50/80"
                        : "border-b border-navy-50 bg-white"
                    }
                  >
                    <td className="px-2 py-1.5">{row.period}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap">{row.date}</td>
                    <td className="px-2 py-1.5 text-end tabular-nums">
                      {formatCurrency(row.opening_balance)}
                    </td>
                    <td className="px-2 py-1.5 text-end tabular-nums">
                      {formatCurrency(row.payment)}
                    </td>
                    <td className="px-2 py-1.5 text-end tabular-nums">
                      {formatCurrency(row.principal)}
                    </td>
                    <td className="px-2 py-1.5 text-end tabular-nums">
                      {formatCurrency(row.interest)}
                    </td>
                    <td className="px-2 py-1.5 text-end tabular-nums">
                      {formatCurrency(row.closing_balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {combinedAnnual.length > 0 && (
        <section className="overflow-x-auto rounded-xl border border-navy-100 bg-white p-4 shadow-sm">
          <h4 className="mb-3 text-sm font-semibold text-navy-800">
            Synthèse annuelle (toutes tranches)
          </h4>
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-navy-100 text-xs text-navy-700">
                <th className="px-2 py-2 text-start">Poste</th>
                {YEARS.map((y) => (
                  <th key={y} className="px-2 py-2 text-end">
                    Y{y}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-navy-50">
                <td className="px-2 py-2 font-medium">Capital restant dû</td>
                {combinedAnnual.map((a) => (
                  <td key={a.year} className="px-2 py-2 text-end tabular-nums">
                    {formatCurrency(a.balance)}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-navy-50">
                <td className="px-2 py-2 font-medium">Intérêts</td>
                {combinedAnnual.map((a) => (
                  <td key={a.year} className="px-2 py-2 text-end tabular-nums">
                    {formatCurrency(a.interest)}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="px-2 py-2 font-medium">Principal remboursé</td>
                {combinedAnnual.map((a) => (
                  <td key={a.year} className="px-2 py-2 text-end tabular-nums">
                    {formatCurrency(a.principal)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </section>
      )}

      <LoanDualAxisChart projection={projection} />

      {!readOnly && loans.length > 0 && (
        <button
          type="button"
          disabled={syncing || saving}
          onClick={() => void handleSync()}
          className="inline-flex items-center gap-2 rounded-lg bg-navy-800 px-4 py-2 text-sm font-medium text-white hover:bg-navy-900"
        >
          {syncing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Synchroniser la tranche principale avec la liasse
        </button>
      )}
    </div>
  );
}
