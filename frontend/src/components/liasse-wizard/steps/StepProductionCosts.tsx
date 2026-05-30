"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2, Sparkles } from "lucide-react";
import CostDonutChart from "@/components/liasse-wizard/CostDonutChart";
import { useFormat } from "@/hooks/useFormat";
import {
  getCostAutofill,
  getUnitCostProjection,
  listCostComponents,
  type CostAutofill,
  type CostComponent,
  type PlanCostProjection,
  type ProductUnitCost,
  upsertCostComponents,
  updateMarginThreshold,
} from "@/lib/cost-api";
import { listProducts, type PlanProduct } from "@/lib/products-api";
import type { Inputs } from "@/components/liasse-form-utils";
import { get } from "@/components/liasse-form-utils";

type Props = {
  planId: string;
  planInputs: Inputs;
  readOnly?: boolean;
};

const ROWS: { field: keyof CostComponent | "utilities"; label: string; pct?: boolean }[] = [
  { field: "mp_price_per_kg", label: "1. Achat MP (DT/kg)" },
  { field: "arome_rate_pct", label: "2. Arômes (% du MP)", pct: true },
  { field: "packaging_price_per_kg", label: "3. Emballage (DT/kg)" },
  { field: "packaging_g_per_unit", label: "   Grammes / unité" },
  { field: "utilities", label: "4. Gaz + Élec + Eau (DT/mois)" },
  { field: "waste_pct", label: "7. Déchets (% du MP)", pct: true },
];

function compKey(planId: string, productId: string, year: number) {
  return `${planId}:${productId}:${year}`;
}

export default function StepProductionCosts({ planId, planInputs, readOnly }: Props) {
  const { formatCurrency, formatPercent } = useFormat();
  const [year, setYear] = useState(1);
  const [products, setProducts] = useState<PlanProduct[]>([]);
  const [components, setComponents] = useState<Record<string, CostComponent>>({});
  const [autofill, setAutofill] = useState<CostAutofill | null>(null);
  const [projection, setProjection] = useState<PlanCostProjection | null>(null);
  const [marginThreshold, setMarginThreshold] = useState(0.2);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const [prods, costs, hints] = await Promise.all([
        listProducts(planId),
        listCostComponents(planId, year),
        getCostAutofill(planId),
      ]);
      setProducts(prods);
      setAutofill(hints);
      const map: Record<string, CostComponent> = {};
      for (const c of costs) {
        map[compKey(planId, c.product_id, c.year)] = c;
      }
      setComponents(map);
      if (prods.length && !selectedProductId) setSelectedProductId(prods[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }, [planId, year]);

  const refreshProjection = useCallback(async () => {
    try {
      const res = await getUnitCostProjection(planId, year);
      setProjection(res.projection);
      if (res.projection?.margin_alert_threshold != null) {
        setMarginThreshold(res.projection.margin_alert_threshold);
      }
    } catch {
      setProjection(null);
    }
  }, [planId, year]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const t = window.setTimeout(() => void refreshProjection(), 500);
    return () => window.clearTimeout(t);
  }, [components, year, products, refreshProjection]);

  const getComp = (productId: string): CostComponent => {
    const k = compKey(planId, productId, year);
    return (
      components[k] ?? {
        id: "",
        plan_id: planId,
        product_id: productId,
        year,
        mp_price_per_kg: autofill?.suggested_mp_price_per_kg ?? 0,
        arome_rate_pct: 0,
        packaging_g_per_unit: 1000,
        packaging_price_per_kg: autofill?.suggested_packaging_price_per_kg ?? 0,
        gas_monthly: 0,
        electricity_monthly: 0,
        water_monthly: 0,
        waste_pct: autofill?.suggested_waste_pct ?? 0,
      }
    );
  };

  const setCompField = (productId: string, field: string, value: number) => {
    const k = compKey(planId, productId, year);
    const cur = getComp(productId);
    if (field === "gas_monthly") {
      setComponents((m) => ({
        ...m,
        [k]: { ...cur, gas_monthly: value },
      }));
      return;
    }
    if (field === "electricity_monthly" || field === "water_monthly") {
      setComponents((m) => ({
        ...m,
        [k]: { ...cur, [field]: value },
      }));
      return;
    }
    setComponents((m) => ({
      ...m,
      [k]: { ...cur, [field]: value },
    }));
  };

  const applyAutofill = () => {
    if (!autofill || readOnly) return;
    const dep =
      autofill.depreciation_by_year[year - 1] ?? autofill.annual_depreciation_y1;
    const rawMaterialRaw = get(planInputs, "operations.rawMaterialCost", "");
    const packagingRaw = get(planInputs, "operations.packagingCost", "");
    const wasteRaw = get(planInputs, "operations.wasteRate.value", "");
    const rawMaterialCost =
      rawMaterialRaw !== "" ? parseFloat(rawMaterialRaw) : undefined;
    const packagingCost =
      packagingRaw !== "" ? parseFloat(packagingRaw) : undefined;
    const wastePct = wasteRaw !== "" ? parseFloat(wasteRaw) : undefined;
    setComponents((prev) => {
      const next = { ...prev };
      for (const p of products) {
        const k = compKey(planId, p.id, year);
        const cur = next[k] ?? getComp(p.id);
        next[k] = {
          ...cur,
          mp_price_per_kg: rawMaterialCost ?? cur.mp_price_per_kg,
          packaging_price_per_kg: packagingCost ?? cur.packaging_price_per_kg,
          waste_pct: wastePct ?? cur.waste_pct,
        };
      }
      return next;
    });
    void dep;
  };

  const persist = async () => {
    setSaving(true);
    try {
      const items = products.map((p) => {
        const c = getComp(p.id);
        return {
          product_id: p.id,
          year,
          mp_price_per_kg: c.mp_price_per_kg,
          arome_rate_pct: c.arome_rate_pct,
          packaging_g_per_unit: c.packaging_g_per_unit,
          packaging_price_per_kg: c.packaging_price_per_kg,
          gas_monthly: c.gas_monthly,
          electricity_monthly: c.electricity_monthly,
          water_monthly: c.water_monthly,
          waste_pct: c.waste_pct,
        };
      });
      const saved = await upsertCostComponents(planId, items);
      const map = { ...components };
      for (const c of saved) {
        map[compKey(planId, c.product_id, c.year)] = c;
      }
      setComponents(map);
      await refreshProjection();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  const resultByProduct = useMemo(() => {
    const m = new Map<string, ProductUnitCost>();
    projection?.products.forEach((p) => m.set(p.product_id, p));
    return m;
  }, [projection]);

  const selectedResult = selectedProductId
    ? resultByProduct.get(selectedProductId)
    : null;

  const payrollHint = autofill?.annual_payroll ?? 0;
  const depHint =
    autofill?.depreciation_by_year?.[year - 1] ?? autofill?.annual_depreciation_y1 ?? 0;

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-12 text-sm text-navy-600">
        <Loader2 className="h-5 w-5 animate-spin" />
        Chargement des coûts…
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <p className="p-6 text-sm text-navy-600">
        Ajoutez d&apos;abord des produits dans l&apos;étape « Produits &amp; Prix ».
      </p>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-semibold text-navy-800">
            Coûts de production
          </h3>
          <p className="text-sm text-navy-600">
            Coût unitaire, marge brute et répartition — données RH et investissements
            reprises automatiquement.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-navy-600">
            Année
            <select
              className="ms-2 rounded border border-navy-200 px-2 py-1 text-sm"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {[1, 2, 3, 4, 5, 6, 7].map((y) => (
                <option key={y} value={y}>
                  Y{y}
                </option>
              ))}
            </select>
          </label>
          {!readOnly && (
            <>
              <button
                type="button"
                onClick={() => applyAutofill()}
                className="inline-flex items-center gap-1 rounded-lg border border-navy-200 px-3 py-1.5 text-xs font-medium text-navy-700"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Remplir depuis la liasse
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void persist()}
                className="rounded-lg bg-navy-800 px-3 py-1.5 text-xs font-semibold text-gold-300 disabled:opacity-50"
              >
                {saving ? "Enregistrement…" : "Enregistrer"}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-navy-100 bg-navy-50/50 px-3 py-2 text-xs text-navy-700">
        <span className="font-semibold">Auto (année {year}) :</span> Masse salariale{" "}
        {formatCurrency(payrollHint)} · Amortissement machines {formatCurrency(depHint)} ·
        Seuil marge alerte{" "}
        <input
          type="number"
          min={5}
          max={80}
          disabled={readOnly}
          className="mx-1 w-12 rounded border border-navy-200 px-1 text-center"
          value={Math.round(marginThreshold * 100)}
          onChange={(e) => setMarginThreshold(Number(e.target.value) / 100)}
          onBlur={() => void updateMarginThreshold(planId, marginThreshold)}
        />
        %
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2 space-y-4">
          {products.map((p) => {
            const c = getComp(p.id);
            const active = p.id === selectedProductId;
            return (
              <div
                key={p.id}
                className={`rounded-xl border p-4 transition ${
                  active ? "border-gold-400 bg-gold-50/20" : "border-navy-100 bg-white"
                }`}
              >
                <button
                  type="button"
                  className="mb-3 w-full text-start font-semibold text-navy-800"
                  onClick={() => setSelectedProductId(p.id)}
                >
                  {p.name}{" "}
                  <span className="text-xs font-normal text-navy-500">({p.unit})</span>
                </button>
                <div className="grid gap-2 sm:grid-cols-2">
                  {ROWS.map((row) => {
                    if (row.field === "utilities") {
                      return (
                        <div key="util" className="grid grid-cols-1 gap-2 sm:col-span-2 sm:grid-cols-3">
                          {(
                            [
                              ["gas_monthly", "Gaz"],
                              ["electricity_monthly", "Élec."],
                              ["water_monthly", "Eau"],
                            ] as const
                          ).map(([f, lbl]) => (
                            <label key={f} className="text-[10px] text-navy-600">
                              {lbl}
                              <input
                                type="number"
                                min={0}
                                disabled={readOnly}
                                className="mt-0.5 w-full rounded border border-navy-200 px-2 py-1 text-sm"
                                value={c[f]}
                                onChange={(e) =>
                                  setCompField(p.id, f, Number(e.target.value))
                                }
                              />
                            </label>
                          ))}
                        </div>
                      );
                    }
                    const val = c[row.field as keyof CostComponent] as number;
                    return (
                      <label key={row.field} className="text-[10px] text-navy-600">
                        {row.label}
                        <input
                          type="number"
                          min={0}
                          step={row.pct ? 0.01 : 0.001}
                          disabled={readOnly}
                          className="mt-0.5 w-full rounded border border-navy-200 px-2 py-1 text-sm"
                          value={row.pct ? val * 100 : val}
                          onChange={(e) =>
                            setCompField(
                              p.id,
                              row.field,
                              row.pct
                                ? Number(e.target.value) / 100
                                : Number(e.target.value)
                            )
                          }
                        />
                      </label>
                    );
                  })}
                </div>
                <p className="mt-2 text-[10px] text-navy-500">
                  5. MO : {formatCurrency(payrollHint)} / production totale · 6. Amort. :{" "}
                  {formatCurrency(depHint)} / production
                </p>
              </div>
            );
          })}
        </div>

        <div className="space-y-4">
          {selectedResult && (
            <div className="rounded-xl border border-navy-100 bg-white p-4 shadow-sm">
              <h4 className="mb-2 text-sm font-semibold text-navy-800">
                Structure des coûts — {selectedResult.name}
              </h4>
              <CostDonutChart result={selectedResult} />
            </div>
          )}
        </div>
      </div>

      <section className="rounded-xl border border-navy-100 bg-white p-4 overflow-x-auto">
        <h4 className="mb-3 text-sm font-semibold text-navy-800">Synthèse marges (Y{year})</h4>
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b text-xs uppercase text-navy-500">
              <th className="py-2 text-start">Produit</th>
              <th className="py-2 text-end">Coût unit.</th>
              <th className="py-2 text-end">Prix vente</th>
              <th className="py-2 text-end">Marge / u.</th>
              <th className="py-2 text-end">Taux marge</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => {
              const r = resultByProduct.get(p.id);
              if (!r) return null;
              return (
                <tr
                  key={p.id}
                  className={`border-b border-navy-50 ${r.margin_alert ? "bg-red-50" : ""}`}
                >
                  <td className="py-2 font-medium">
                    {r.name}
                    {r.margin_alert && (
                      <AlertTriangle className="ms-1 inline h-4 w-4 text-red-600" />
                    )}
                  </td>
                  <td className="py-2 text-end tabular-nums">{formatCurrency(r.unit_cost)}</td>
                  <td className="py-2 text-end tabular-nums">{formatCurrency(r.sell_price)}</td>
                  <td className="py-2 text-end tabular-nums">
                    {formatCurrency(r.gross_margin_per_unit)}
                  </td>
                  <td className="py-2 text-end tabular-nums">
                    {r.gross_margin_rate != null
                      ? formatPercent(r.gross_margin_rate)
                      : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {projection?.products.some((p) => p.margin_alert) && (
          <p className="mt-3 flex items-center gap-2 text-xs text-red-700">
            <AlertTriangle className="h-4 w-4" />
            Marge brute inférieure au seuil de {formatPercent(marginThreshold)} sur un ou
            plusieurs produits.
          </p>
        )}
      </section>
    </div>
  );
}
