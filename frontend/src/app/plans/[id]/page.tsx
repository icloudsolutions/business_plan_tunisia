"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import AuthGuard from "@/components/AuthGuard";
import LiasseForm from "@/components/LiasseForm";
import ResultsPanel from "@/components/ResultsPanel";
import SimulationPanel from "@/components/SimulationPanel";
import StatusBadge from "@/components/StatusBadge";
import { useAuth } from "@/context/AuthContext";
import {
  auditPlan,
  downloadExport,
  exportPlan,
  getPlan,
  updatePlan,
  listSimulations,
  pollJob,
  recalculate,
  runSimulation,
  saveInputs,
  submitPlan,
  transitionPlan,
  type AuditResult,
  type Plan,
  type SimulationItem,
} from "@/lib/api";

const STATUS_HINTS: Record<string, string> = {
  DRAFT: "Saisie et calcul — soumission à l'expert",
  UNDER_REVIEW: "Revue expert — simulations et audit",
  ADJUSTMENT: "Corrections collaboratives",
  VALIDATED: "Plan verrouillé — exports PDF / Excel",
};

function PlanContent() {
  const params = useParams();
  const id = params.id as string;
  const { isExpert } = useAuth();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [inputs, setInputs] = useState<Record<string, unknown>>({});
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [simulations, setSimulations] = useState<SimulationItem[]>([]);
  const [audit, setAudit] = useState<AuditResult | null>(null);
  const [jobStatus, setJobStatus] = useState("");
  const [exportJobId, setExportJobId] = useState<string | null>(null);
  const [exportFormats, setExportFormats] = useState<string[]>([]);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError("");
    try {
      const p = await getPlan(id);
      setPlan(p);
      setInputs(p.inputs || {});
      const sims = await listSimulations(id);
      setSimulations(sims);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const readOnly =
    plan?.status === "VALIDATED" ||
    (plan?.status === "UNDER_REVIEW" && !isExpert);

  const handleRecalc = async () => {
    setError("");
    const job = await recalculate(id);
    setJobStatus("PENDING");
    const result = await pollJob(job.id, setJobStatus);
    if (result.status === "FAILED") setError(result.error || "Calcul échoué");
    else await load();
  };

  const handleSimulate = async () => {
    setError("");
    const job = await runSimulation(
      id,
      [{ path: "operations/rawMaterialCost", multiplier: 1.15 }],
      "Inflation matières +15%"
    );
    const result = await pollJob(job.id, setJobStatus);
    if (result.status === "FAILED") setError(result.error || "Simulation échouée");
    else await load();
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" aria-hidden />
        <p>Chargement du plan…</p>
      </div>
    );
  }

  if (!plan) {
    return <p className="form-error">{error || "Plan introuvable"}</p>;
  }

  return (
    <>
      <p className="breadcrumb">
        <Link href="/">← Tableau de bord</Link>
      </p>

      <header className="page-header">
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.75rem" }}>
          {editingTitle && plan.status !== "VALIDATED" ? (
            <form
              style={{ display: "flex", gap: "0.5rem", flex: "1 1 auto", flexWrap: "wrap" }}
              onSubmit={async (e) => {
                e.preventDefault();
                const updated = await updatePlan(id, titleDraft);
                setPlan(updated);
                setEditingTitle(false);
              }}
            >
              <input
                className="form-input"
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                style={{ maxWidth: 400 }}
              />
              <button type="submit" className="btn btn-primary">
                Enregistrer
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setEditingTitle(false)}
              >
                Annuler
              </button>
            </form>
          ) : (
            <h1 style={{ margin: 0, flex: "1 1 auto" }}>
              {plan.title}
              {plan.status !== "VALIDATED" && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ marginLeft: "0.5rem", verticalAlign: "middle" }}
                  onClick={() => {
                    setTitleDraft(plan.title);
                    setEditingTitle(true);
                  }}
                >
                  Renommer
                </button>
              )}
            </h1>
          )}
          <StatusBadge status={plan.status} />
        </div>
        <p>{STATUS_HINTS[plan.status] || plan.status}</p>
      </header>

      {missingFields.length > 0 && (
        <div className="alert alert-warning">
          <strong>Champs à compléter :</strong> {missingFields.join(", ")}
        </div>
      )}

      {error && <p className="form-error">{error}</p>}
      {jobStatus && (
        <p className="alert alert-info">Traitement : {jobStatus}</p>
      )}

      <div className="plan-grid">
        <div className="card">
          <LiasseForm
            inputs={inputs}
            onChange={setInputs}
            onSave={async (inp) => {
              const res = await saveInputs(id, inp);
              setPlan(res.plan);
              setMissingFields(res.missingFields || []);
            }}
            readOnly={readOnly}
          />
        </div>
        <div className="card">
          <ResultsPanel results={plan.results as never} />
        </div>
      </div>

      {(plan.status === "UNDER_REVIEW" || plan.status === "ADJUSTMENT") && (
        <div className="card" style={{ marginTop: "1.25rem" }}>
          <h3 className="card-title">Comparatif simulations</h3>
          <SimulationPanel simulations={simulations} />
        </div>
      )}

      <div className="plan-actions btn-group">
        {!isExpert && plan.status === "DRAFT" && (
          <>
            <button type="button" className="btn btn-primary" onClick={handleRecalc}>
              Calculer (7 ans)
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={async () => {
                await submitPlan(id);
                load();
              }}
            >
              Soumettre à l&apos;expert
            </button>
          </>
        )}
        {(plan.status === "UNDER_REVIEW" || plan.status === "ADJUSTMENT") && (
          <>
            <button type="button" className="btn btn-secondary" onClick={handleRecalc}>
              Recalculer
            </button>
            <button type="button" className="btn btn-secondary" onClick={handleSimulate}>
              Simuler (+15% matières)
            </button>
            {isExpert && (
              <>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={async () => setAudit(await auditPlan(id))}
                >
                  Audit financier
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={async () => {
                    await transitionPlan(id, "NEEDS_ADJUSTMENT");
                    load();
                  }}
                >
                  Demander ajustement
                </button>
                <button
                  type="button"
                  className="btn btn-success"
                  onClick={async () => {
                    await transitionPlan(id, "VALIDATE");
                    load();
                  }}
                >
                  Valider
                </button>
              </>
            )}
          </>
        )}
        {plan.status === "VALIDATED" && (
          <>
            <button
              type="button"
              className="btn btn-primary"
              onClick={async () => {
                setError("");
                setExportFormats([]);
                const job = await exportPlan(id);
                setExportJobId(job.id);
                try {
                  const result = await pollJob(job.id, setJobStatus);
                  setExportJobId(job.id);
                  const formats = result.result?.formats ?? Object.keys(result.result?.files ?? {});
                  setExportFormats(formats.length ? formats : ["pdf", "xlsx"]);
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Export échoué");
                  setExportJobId(null);
                }
              }}
            >
              Générer PDF / Excel
            </button>
            {exportJobId && exportFormats.length > 0 && (
              <>
                {exportFormats.includes("pdf") && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => downloadExport(id, exportJobId, "pdf")}
                  >
                    Télécharger PDF
                  </button>
                )}
                {exportFormats.includes("xlsx") && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => downloadExport(id, exportJobId, "xlsx")}
                  >
                    Télécharger Excel
                  </button>
                )}
              </>
            )}
          </>
        )}
      </div>

      {audit && (
        <pre
          className="card"
          style={{
            marginTop: "1.25rem",
            overflow: "auto",
            fontSize: "0.8rem",
          }}
        >
          {JSON.stringify(audit, null, 2)}
        </pre>
      )}
    </>
  );
}

export default function PlanPage() {
  return (
    <AuthGuard>
      <PlanContent />
    </AuthGuard>
  );
}
