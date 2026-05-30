"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import LiasseForm from "@/components/LiasseForm";
import ResultsPanel from "@/components/ResultsPanel";
import SimulationPanel from "@/components/SimulationPanel";
import {
  auditPlan,
  downloadExport,
  exportPlan,
  fetchMe,
  getPlan,
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
  type User,
} from "@/lib/api";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Brouillon (Client)",
  UNDER_REVIEW: "En revue (Expert)",
  ADJUSTMENT: "Ajustement (Collaboratif)",
  VALIDATED: "Validé (Verrouillé)",
};

export default function PlanPage() {
  const params = useParams();
  const id = params.id as string;
  const [user, setUser] = useState<User | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [inputs, setInputs] = useState<Record<string, unknown>>({});
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [simulations, setSimulations] = useState<SimulationItem[]>([]);
  const [audit, setAudit] = useState<AuditResult | null>(null);
  const [jobStatus, setJobStatus] = useState("");
  const [exportJobId, setExportJobId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const p = await getPlan(id);
      setPlan(p);
      setInputs(p.inputs || {});
      const sims = await listSimulations(id);
      setSimulations(sims);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    }
  }, [id]);

  useEffect(() => {
    fetchMe().then(setUser).catch(() => {});
    load();
  }, [load]);

  const isExpert = user?.role === "expert";
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

  if (!plan) {
    return <main style={{ padding: 32 }}>{error || "Chargement..."}</main>;
  }

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
      <Link href="/">← Retour</Link>
      <h1 style={{ marginTop: 16 }}>{plan.title}</h1>
      <p>
        État : <strong>{STATUS_LABELS[plan.status] || plan.status}</strong>
        {user && (
          <span style={{ marginLeft: 12, color: "#666", fontSize: 14 }}>
            ({user.role})
          </span>
        )}
      </p>

      {missingFields.length > 0 && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            background: "#fff8e6",
            borderRadius: 8,
            fontSize: 13,
          }}
        >
          <strong>Champs à compléter :</strong> {missingFields.join(", ")}
        </div>
      )}

      {error && <p style={{ color: "red", marginTop: 12 }}>{error}</p>}
      {jobStatus && <p style={{ color: "#0066cc" }}>Job : {jobStatus}</p>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginTop: 24 }}>
        <div style={{ background: "#fff", padding: 20, borderRadius: 8 }}>
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
        <div style={{ background: "#fff", padding: 20, borderRadius: 8 }}>
          <ResultsPanel results={plan.results as never} />
        </div>
      </div>

      {(plan.status === "UNDER_REVIEW" || plan.status === "ADJUSTMENT") && (
        <div style={{ marginTop: 24, background: "#fff", padding: 20, borderRadius: 8 }}>
          <h3>Comparatif simulations</h3>
          <SimulationPanel simulations={simulations} />
        </div>
      )}

      <div style={{ marginTop: 24, display: "flex", flexWrap: "wrap", gap: 8 }}>
        {!isExpert && plan.status === "DRAFT" && (
          <>
            <button type="button" onClick={handleRecalc} style={{ padding: "8px 16px" }}>
              Calculer (7 ans)
            </button>
            <button
              type="button"
              onClick={async () => {
                await submitPlan(id);
                load();
              }}
              style={{ padding: "8px 16px" }}
            >
              Soumettre à l&apos;expert
            </button>
          </>
        )}
        {(plan.status === "UNDER_REVIEW" || plan.status === "ADJUSTMENT") && (
          <>
            <button type="button" onClick={handleRecalc} style={{ padding: "8px 16px" }}>
              Recalculer
            </button>
            <button type="button" onClick={handleSimulate} style={{ padding: "8px 16px" }}>
              Simuler (+15% matières)
            </button>
            {isExpert && (
              <>
                <button
                  type="button"
                  onClick={async () => setAudit(await auditPlan(id))}
                  style={{ padding: "8px 16px" }}
                >
                  Audit financier
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await transitionPlan(id, "NEEDS_ADJUSTMENT");
                    load();
                  }}
                  style={{ padding: "8px 16px" }}
                >
                  Demander ajustement
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await transitionPlan(id, "VALIDATE");
                    load();
                  }}
                  style={{ padding: "8px 16px", background: "#22863a", color: "#fff", border: 0 }}
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
              onClick={async () => {
                const job = await exportPlan(id);
                setExportJobId(job.id);
                const result = await pollJob(job.id, setJobStatus);
                if (result.status === "COMPLETED") setExportJobId(job.id);
              }}
              style={{ padding: "8px 16px" }}
            >
              Générer PDF / Excel
            </button>
            {exportJobId && (
              <button
                type="button"
                onClick={() => downloadExport(id, exportJobId)}
                style={{
                  padding: "8px 16px",
                  background: "#0969da",
                  color: "#fff",
                  border: 0,
                  borderRadius: 6,
                }}
              >
                Télécharger export
              </button>
            )}
          </>
        )}
      </div>

      {audit && (
        <pre
          style={{
            marginTop: 24,
            background: "#fff",
            padding: 16,
            borderRadius: 8,
            overflow: "auto",
            fontSize: 13,
          }}
        >
          {JSON.stringify(audit, null, 2)}
        </pre>
      )}
    </main>
  );
}
