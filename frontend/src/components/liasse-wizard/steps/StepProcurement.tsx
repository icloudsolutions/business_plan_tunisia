"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import ProcurementDonutChart from "@/components/liasse-wizard/ProcurementDonutChart";
import ProcurementTrendChart from "@/components/liasse-wizard/ProcurementTrendChart";
import { useFormat } from "@/hooks/useFormat";
import { listProducts, type PlanProduct } from "@/lib/products-api";
import {
  createRawMaterial,
  deleteRawMaterial,
  fetchProcurement,
  gramsToKgPerKg,
  kgPerKgToGrams,
  listRawMaterials,
  savePurchaseAssumptions,
  saveRecipes,
  updateRawMaterial,
  type ProcurementProjection,
  type RawMaterial,
} from "@/lib/procurement-api";

type Props = { planId: string; readOnly?: boolean };

const CATEGORIES = [
  { value: "mp", label: "Matière première" },
  { value: "arome", label: "Arôme" },
  { value: "packaging", label: "Emballage" },
  { value: "other", label: "Autre" },
] as const;

export default function StepProcurement({ planId, readOnly }: Props) {
  const { formatCurrency } = useFormat();
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [products, setProducts] = useState<PlanProduct[]>([]);
  const [projection, setProjection] = useState<ProcurementProjection | null>(null);
  const [recipeGrams, setRecipeGrams] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [mats, prods, proj] = await Promise.all([
        listRawMaterials(planId),
        listProducts(planId),
        fetchProcurement(planId),
      ]);
      setMaterials(mats);
      setProducts(prods);
      setProjection(proj);
      const grams: Record<string, number> = {};
      const recipes = (proj as { recipes?: { product_id: string; raw_material_id: string; quantity_per_kg_product: number }[] }).recipes;
      for (const r of recipes ?? []) {
        const key = `${r.product_id}:${r.raw_material_id}`;
        grams[key] = kgPerKgToGrams(r.quantity_per_kg_product);
      }
      setRecipeGrams(grams);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur chargement approvisionnements");
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => {
    void load();
  }, [load]);

  const recipeKey = (pid: string, mid: string) => `${pid}:${mid}`;

  const persistRecipes = async () => {
    const entries = Object.entries(recipeGrams)
      .filter(([, g]) => g > 0)
      .map(([key, g]) => {
        const [product_id, raw_material_id] = key.split(":");
        return {
          product_id,
          raw_material_id,
          quantity_per_kg_product: gramsToKgPerKg(g),
        };
      });
    const proj = await saveRecipes(planId, entries);
    setProjection(proj);
  };

  const onRecipeChange = (pid: string, mid: string, grams: number) => {
    setRecipeGrams((prev) => ({ ...prev, [recipeKey(pid, mid)]: grams }));
  };

  const onRecipeBlur = async () => {
    if (readOnly) return;
    setSaving(true);
    try {
      await persistRecipes();
    } finally {
      setSaving(false);
    }
  };

  const onStockDays = async (mid: string, days: number) => {
    if (readOnly) return;
    setSaving(true);
    try {
      const proj = await savePurchaseAssumptions(planId, [
        { raw_material_id: mid, stock_days: days },
      ]);
      setProjection(proj);
      setMaterials((m) =>
        m.map((x) => (x.id === mid ? { ...x, stock_days: days } : x))
      );
    } finally {
      setSaving(false);
    }
  };

  const onMaterialField = async (id: string, patch: Partial<RawMaterial>) => {
    if (readOnly) return;
    const updated = await updateRawMaterial(planId, id, patch);
    setMaterials((m) => m.map((x) => (x.id === id ? updated : x)));
    const proj = await fetchProcurement(planId);
    setProjection(proj);
  };

  const addMaterial = async () => {
    if (readOnly) return;
    const row = await createRawMaterial(planId, {
      name: "Nouvelle MP",
      category: "mp",
      unit: "kg",
    });
    setMaterials((m) => [...m, row]);
    await load();
  };

  const years = useMemo(() => [1, 2, 3, 4, 5, 6, 7], []);

  if (loading && !projection) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-navy-500" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {error && <p className="text-sm text-red-700">{error}</p>}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-navy-900">Matières premières</h3>
          {!readOnly && (
            <button
              type="button"
              onClick={() => void addMaterial()}
              className="inline-flex items-center gap-1 rounded-lg bg-gold-500 px-3 py-1.5 text-xs font-medium text-white"
            >
              <Plus className="h-3.5 w-3.5" />
              Ajouter
            </button>
          )}
        </div>
        <div className="overflow-x-auto rounded-lg border border-navy-100">
          <table className="w-full min-w-[720px] text-xs">
            <thead className="bg-navy-50 text-navy-600">
              <tr>
                <th className="px-2 py-2 text-start">Nom</th>
                <th className="px-2 py-2">Catégorie</th>
                <th className="px-2 py-2">Prix unit.</th>
                <th className="px-2 py-2">TVA</th>
                <th className="px-2 py-2">Délai fourn.</th>
                <th className="px-2 py-2">Inflation /an</th>
                <th className="px-2 py-2">Stock (j)</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {materials.map((m) => {
                const row = projection?.rows.find((r) => r.raw_material_id === m.id);
                return (
                  <tr key={m.id} className="border-t border-navy-50">
                    <td className="px-2 py-1">
                      <input
                        disabled={readOnly}
                        className="w-full rounded border border-navy-100 px-1 py-0.5"
                        value={m.name}
                        onChange={(e) =>
                          setMaterials((ms) =>
                            ms.map((x) =>
                              x.id === m.id ? { ...x, name: e.target.value } : x
                            )
                          )
                        }
                        onBlur={(e) =>
                          void onMaterialField(m.id, { name: e.target.value })
                        }
                      />
                    </td>
                    <td className="px-2 py-1">
                      <select
                        disabled={readOnly}
                        className="rounded border border-navy-100 px-1 py-0.5"
                        value={m.category}
                        onChange={(e) =>
                          void onMaterialField(m.id, {
                            category: e.target.value as RawMaterial["category"],
                          })
                        }
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-1">
                      <input
                        type="number"
                        disabled={readOnly}
                        className="w-20 rounded border border-navy-100 px-1 py-0.5 text-end"
                        value={m.price_per_unit}
                        onChange={(e) =>
                          setMaterials((ms) =>
                            ms.map((x) =>
                              x.id === m.id
                                ? { ...x, price_per_unit: Number(e.target.value) }
                                : x
                            )
                          )
                        }
                        onBlur={(e) =>
                          void onMaterialField(m.id, {
                            price_per_unit: Number(e.target.value),
                          })
                        }
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        type="number"
                        step="0.01"
                        disabled={readOnly}
                        className="w-14 rounded border border-navy-100 px-1 py-0.5 text-end"
                        value={Math.round(m.tva_rate * 100)}
                        onBlur={(e) =>
                          void onMaterialField(m.id, {
                            tva_rate: Number(e.target.value) / 100,
                          })
                        }
                        onChange={() => {}}
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        type="number"
                        disabled={readOnly}
                        className="w-14 rounded border border-navy-100 px-1 py-0.5 text-end"
                        defaultValue={m.supplier_payment_days}
                        onBlur={(e) =>
                          void onMaterialField(m.id, {
                            supplier_payment_days: Number(e.target.value),
                          })
                        }
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        type="number"
                        step="0.5"
                        disabled={readOnly}
                        className="w-14 rounded border border-navy-100 px-1 py-0.5 text-end"
                        value={Math.round(m.annual_price_inflation_pct * 1000) / 10}
                        onBlur={(e) =>
                          void onMaterialField(m.id, {
                            annual_price_inflation_pct: Number(e.target.value) / 100,
                          })
                        }
                        onChange={() => {}}
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        type="number"
                        disabled={readOnly}
                        className="w-14 rounded border border-navy-100 px-1 py-0.5 text-end"
                        defaultValue={row?.stock_days ?? 30}
                        onBlur={(e) => void onStockDays(m.id, Number(e.target.value))}
                      />
                    </td>
                    <td className="px-2 py-1">
                      {!readOnly && (
                        <button
                          type="button"
                          className="text-red-600"
                          onClick={() => void deleteRawMaterial(planId, m.id).then(load)}
                          aria-label="Supprimer la matière première"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {products.length > 0 && materials.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold text-navy-900">
            Nomenclature (g par kg de produit fini)
          </h3>
          <p className="mb-3 text-xs text-navy-500">
            Ex. PF Maïs : 1000 g maïs + 60 g arômes + 4 g emballage pour 1 kg vendu
          </p>
          <div className="overflow-x-auto rounded-lg border border-navy-100">
            <table className="w-full text-xs">
              <thead className="bg-navy-50">
                <tr>
                  <th className="px-2 py-2 text-start">Produit</th>
                  {materials.map((m) => (
                    <th key={m.id} className="px-2 py-2 text-end">
                      {m.name}
                      <span className="block font-normal text-navy-400">(g/kg)</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="border-t border-navy-50">
                    <td className="px-2 py-1 font-medium">{p.name}</td>
                    {materials.map((m) => (
                      <td key={m.id} className="px-2 py-1">
                        <input
                          type="number"
                          min={0}
                          disabled={readOnly}
                          className="w-16 rounded border border-navy-100 px-1 py-0.5 text-end"
                          value={recipeGrams[recipeKey(p.id!, m.id)] ?? 0}
                          onChange={(e) =>
                            onRecipeChange(p.id!, m.id, Number(e.target.value))
                          }
                          onBlur={() => void onRecipeBlur()}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {projection?.rows?.length ? (
        <section>
          <h3 className="mb-3 text-sm font-semibold text-navy-900">
            Plan d&apos;approvisionnement annuel
          </h3>
          <div className="overflow-x-auto rounded-lg border border-navy-100">
            <table className="w-full min-w-[900px] text-xs tabular-nums">
              <thead className="bg-navy-50 text-navy-600">
                <tr>
                  <th className="px-2 py-2 text-start">Matière</th>
                  {years.map((y) => (
                    <th key={y} colSpan={2} className="border-s border-navy-100 px-1 py-2 text-center">
                      Y{y}
                    </th>
                  ))}
                </tr>
                <tr className="text-[10px]">
                  <th />
                  {years.map((y) => (
                    <th key={`h-${y}`} colSpan={2} className="border-s border-navy-100">
                      <span className="inline-block w-1/2 text-center">Qté</span>
                      <span className="inline-block w-1/2 text-center">Valeur HT</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {projection.rows.map((row) => (
                  <tr key={row.raw_material_id} className="border-t border-navy-50">
                    <td className="px-2 py-1 font-medium">{row.name}</td>
                    {years.map((y) => {
                      const cell = row.years.find((c) => c.year === y);
                      return (
                        <td key={y} colSpan={2} className="border-s border-navy-50 px-1 py-1">
                          <span className="inline-block w-1/2 text-end text-navy-600">
                            {cell?.purchases_qty.toLocaleString("fr-FR", {
                              maximumFractionDigits: 0,
                            }) ?? "—"}
                          </span>
                          <span className="inline-block w-1/2 text-end">
                            {cell ? formatCurrency(cell.purchase_value_ht) : "—"}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <ProcurementDonutChart data={projection?.chart_donut ?? []} />
        <ProcurementTrendChart data={projection?.chart_trend ?? []} />
      </div>

      {saving && <p className="text-xs text-navy-500">Recalcul…</p>}
    </div>
  );
}
