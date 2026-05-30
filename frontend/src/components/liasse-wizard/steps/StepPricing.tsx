"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import PricingCompetitivenessChart from "@/components/liasse-wizard/PricingCompetitivenessChart";
import PricingGridTable from "@/components/liasse-wizard/PricingGridTable";
import PricingSensitivityPanel from "@/components/liasse-wizard/PricingSensitivityPanel";
import {
  fetchPricing,
  syncPricingFromProducts,
  updatePricingRow,
  type PricingProjection,
} from "@/lib/pricing-api";

type Props = { planId: string; readOnly?: boolean };

export default function StepPricing({ planId, readOnly }: Props) {
  const [projection, setProjection] = useState<PricingProjection | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [syncMsg, setSyncMsg] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const p = await fetchPricing(planId);
      setProjection(p);
      if (!selectedId && p.rows[0]) setSelectedId(p.rows[0].product_id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleUpdate = async (
    rowId: string,
    patch: Parameters<typeof updatePricingRow>[2]
  ) => {
    if (readOnly) return;
    setSaving(true);
    try {
      await updatePricingRow(planId, rowId, patch);
      const p = await fetchPricing(planId);
      setProjection(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncMsg("");
    try {
      const res = await syncPricingFromProducts(planId);
      setProjection(res.projection);
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
        Grille achat / vente / prix marché par produit, marge brute et positionnement concurrentiel
        (prix distributeur vs. rayon).
      </p>

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      {syncMsg && <p className="text-sm text-green-700">{syncMsg}</p>}

      <PricingGridTable
        projection={projection}
        readOnly={readOnly}
        saving={saving}
        onUpdate={(id, patch) => void handleUpdate(id, patch)}
      />

      <PricingSensitivityPanel rows={projection?.rows ?? []} />

      <PricingCompetitivenessChart
        bars={projection?.chart_bars ?? []}
        selectedProductId={selectedId}
      />

      {projection && projection.rows.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {projection.rows.map((r) => (
            <button
              key={r.product_id}
              type="button"
              onClick={() => setSelectedId(r.product_id)}
              className={`rounded-full px-3 py-1 text-xs ${
                selectedId === r.product_id
                  ? "bg-navy-800 text-white"
                  : "border border-navy-200 text-navy-700"
              }`}
            >
              {r.product_name}
            </button>
          ))}
        </div>
      )}

      {!readOnly && (
        <button
          type="button"
          disabled={syncing || saving}
          onClick={() => void handleSync()}
          className="inline-flex items-center gap-2 rounded-lg border border-navy-300 bg-white px-4 py-2 text-sm font-medium text-navy-800"
        >
          {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Importer les prix depuis le catalogue produits
        </button>
      )}
    </div>
  );
}
