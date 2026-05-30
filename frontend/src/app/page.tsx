"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import StatusBadge from "@/components/StatusBadge";
import { createPlan, listPlans, type Plan } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

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
        <h1>Tableau de bord</h1>
        <p>
          {isExpert
            ? "Plans assignés — revue, simulations et validation"
            : isClient
              ? "Vos business plans — saisie Liasse Unique et soumission"
              : "Business plans collaboratifs"}
        </p>
      </header>

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
            <div key={p.id} className="plan-row">
              <div>
                <Link href={`/plans/${p.id}`}>{p.title}</Link>
              </div>
              <StatusBadge status={p.status} />
            </div>
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
