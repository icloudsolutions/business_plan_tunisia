"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import StatusBadge from "@/components/StatusBadge";
import { createPlan, deletePlan, listPlans, updatePlan, type Plan } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

function PlanRow({ plan, onChanged }: { plan: Plan; onChanged: () => void }) {
  const { isClient, isAdmin } = useAuth();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(plan.title);
  const canEdit = plan.status !== "VALIDATED" && (isAdmin || isClient);
  const canDelete =
    plan.status !== "VALIDATED" &&
    (isAdmin || (isClient && plan.status === "DRAFT"));

  const saveTitle = async () => {
    await updatePlan(plan.id, title);
    setEditing(false);
    onChanged();
  };

  const remove = async () => {
    if (!confirm(`Supprimer « ${plan.title} » ?`)) return;
    await deletePlan(plan.id);
    onChanged();
  };

  return (
    <div className="plan-row">
      <div style={{ flex: "1 1 200px" }}>
        {editing ? (
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <input
              className="form-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{ maxWidth: 280 }}
            />
            <button type="button" className="btn btn-primary" onClick={saveTitle}>
              OK
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)}>
              Annuler
            </button>
          </div>
        ) : (
          <Link href={`/plans/${plan.id}`}>{plan.title}</Link>
        )}
      </div>
      <StatusBadge status={plan.status} />
      <div className="btn-group" style={{ margin: 0 }}>
        {canEdit && !editing && (
          <button type="button" className="btn btn-ghost" onClick={() => setEditing(true)}>
            Renommer
          </button>
        )}
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => router.push(`/plans/${plan.id}`)}
        >
          Ouvrir
        </button>
        {canDelete && (
          <button type="button" className="btn btn-ghost" onClick={remove}>
            Supprimer
          </button>
        )}
      </div>
    </div>
  );
}

function Dashboard() {
  const router = useRouter();
  const { isExpert, isClient } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadPlans = useCallback(async () => {
    setError("");
    try {
      setPlans(await listPlans());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  const newPlan = async () => {
    const p = await createPlan(
      "Business Plan " + new Date().toLocaleDateString("fr-TN")
    );
    router.push(`/plans/${p.id}`);
  };

  return (
    <>
      <header className="page-header">
        <h1>Business Plans</h1>
        <p>
          {isExpert
            ? "Plans assignés — revue, simulations et validation"
            : isClient
              ? "Vos business plans — saisie Liasse Unique et soumission"
              : "Business plans collaboratifs"}
        </p>
      </header>

      <div className="card" style={{ marginBottom: "1.25rem", padding: "1rem 1.25rem" }}>
        <p style={{ margin: "0 0 0.75rem", fontSize: "0.9rem", color: "var(--color-muted)" }}>
          Gestion des coûts de production et de la masse salariale (données démo).
        </p>
        <Link href="/finance" className="btn btn-primary" style={{ display: "inline-flex" }}>
          Ouvrir le cockpit financier →
        </Link>
      </div>

      <div className="btn-group">
        {isClient && (
          <button type="button" className="btn btn-primary" onClick={newPlan}>
            Nouveau business plan
          </button>
        )}
        <button type="button" className="btn btn-secondary" onClick={loadPlans}>
          Actualiser
        </button>
      </div>

      {error && <p className="form-error">{error}</p>}

      {loading ? (
        <div className="loading-screen">
          <div className="spinner" aria-hidden />
        </div>
      ) : plans.length === 0 ? (
        <div className="empty-state card" style={{ marginTop: "1.25rem" }}>
          <p>Aucun plan pour le moment.</p>
          {isClient && (
            <button
              type="button"
              className="btn btn-primary"
              style={{ marginTop: "1rem" }}
              onClick={newPlan}
            >
              Créer mon premier plan
            </button>
          )}
        </div>
      ) : (
        <div className="plans-grid">
          {plans.map((p) => (
            <PlanRow key={p.id} plan={p} onChanged={loadPlans} />
          ))}
        </div>
      )}
    </>
  );
}

export default function HomePage() {
  return (
    <AuthGuard>
      <Dashboard />
    </AuthGuard>
  );
}
