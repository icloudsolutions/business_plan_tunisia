"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useFormat } from "@/hooks/useFormat";
import {
  createProduct,
  deleteProduct,
  getRevenueAssumptions,
  getRevenueProjection,
  listProducts,
  updateProduct,
  updateRevenueAssumptions,
  utilizationBarColor,
  type CapacityBasis,
  type PlanProduct,
  type PlanProductInput,
  type ProductUnit,
  type RevenueAssumptions,
  type RevenueProjection,
} from "@/lib/products-api";

const UNITS: { value: ProductUnit; label: string }[] = [
  { value: "kg", label: "kg" },
  { value: "sachet", label: "Sachet" },
  { value: "unit", label: "Unité" },
  { value: "L", label: "Litre" },
  { value: "other", label: "Autre" },
];

const GROWTH_KEYS = [
  "growth_rate_y2",
  "growth_rate_y3",
  "growth_rate_y4",
  "growth_rate_y5",
  "growth_rate_y6",
  "growth_rate_y7",
] as const;

type Props = { planId: string; readOnly?: boolean };

function emptyProduct(): PlanProductInput {
  return {
    name: "",
    unit: "unit",
    unit_price_sell: 0,
    ristourne_pct: 0.1,
    monthly_qty_y1: 0,
  };
}

export default function StepProducts({ planId, readOnly }: Props) {
  const { formatCurrency, formatNumber, formatPercent } = useFormat();
  const [products, setProducts] = useState<PlanProduct[]>([]);
  const [assumptions, setAssumptions] = useState<RevenueAssumptions | null>(null);
  const [projection, setProjection] = useState<RevenueProjection | null>(null);
  const [loading, setLoading] = useState(true);
  const [projLoading, setProjLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const [prods, assump] = await Promise.all([
        listProducts(planId),
        getRevenueAssumptions(planId),
      ]);
      setProducts(prods);
      setAssumptions(assump);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }, [planId]);

  const refreshProjection = useCallback(async () => {
    setProjLoading(true);
    try {
      setProjection(await getRevenueProjection(planId, true));
    } catch {
      setProjection(null);
    } finally {
      setProjLoading(false);
    }
  }, [planId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!assumptions) return;
    const t = window.setTimeout(() => void refreshProjection(), 400);
    return () => window.clearTimeout(t);
  }, [products, assumptions, refreshProjection]);

  const saveAssumptions = async (patch: Partial<RevenueAssumptions>) => {
    if (readOnly) return;
    const next = await updateRevenueAssumptions(planId, patch);
    setAssumptions(next);
  };

  const addProduct = async () => {
    const draft = emptyProduct();
    draft.name = `Produit ${products.length + 1}`;
    const row = await createProduct(planId, draft);
    setProducts((p) => [...p, row]);
  };

  const patchProduct = async (id: string, patch: Partial<PlanProductInput>) => {
    const row = await updateProduct(planId, id, patch);
    setProducts((list) => list.map((p) => (p.id === id ? row : p)));
  };

  const removeProduct = async (id: string) => {
    await deleteProduct(planId, id);
    setProducts((list) => list.filter((p) => p.id !== id));
  };

  const years = useMemo(() => [1, 2, 3, 4, 5, 6, 7], []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-12 text-sm text-navy-600">
        <Loader2 className="h-5 w-5 animate-spin" />
        Chargement produits…
      </div>
    );
  }

  return (
    <div className="space-y-8 p-4 sm:p-6">
      <div>
        <h3 className="font-display text-lg font-semibold text-navy-800">Produits &amp; Prix</h3>
        <p className="mt-1 text-sm text-navy-600">
          Chiffre d&apos;affaires multi-produits sur 7 ans — quantités mensuelles Y1, ristournes et
          croissance annuelle.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <section className="rounded-xl border border-navy-100 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-navy-800">Catalogue produits</h4>
          {!readOnly && (
            <button
              type="button"
              onClick={() => void addProduct()}
              className="inline-flex items-center gap-1 rounded-lg bg-navy-800 px-3 py-1.5 text-xs font-semibold text-gold-300"
            >
              <Plus className="h-4 w-4" />
              Ajouter un produit
            </button>
          )}
        </div>

        {products.length === 0 ? (
          <p className="text-sm text-navy-500">Aucun produit — ajoutez une ligne pour projeter le CA.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-start text-sm">
              <thead>
                <tr className="border-b border-navy-100 text-xs uppercase text-navy-500">
                  <th className="px-2 py-2">Nom</th>
                  <th className="px-2 py-2">Unité</th>
                  <th className="px-2 py-2">Qté mens. Y1</th>
                  <th className="px-2 py-2">Prix vente</th>
                  <th className="px-2 py-2">Ristourne %</th>
                  {!readOnly && <th className="px-2 py-2" />}
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="border-b border-navy-50">
                    <td className="px-2 py-2">
                      <input
                        className="w-full rounded border border-navy-200 px-2 py-1"
                        value={p.name}
                        disabled={readOnly}
                        onChange={(e) =>
                          setProducts((list) =>
                            list.map((x) =>
                              x.id === p.id ? { ...x, name: e.target.value } : x
                            )
                          )
                        }
                        onBlur={(e) => void patchProduct(p.id, { name: e.target.value })}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <select
                        className="rounded border border-navy-200 px-2 py-1"
                        value={p.unit}
                        disabled={readOnly}
                        onChange={(e) =>
                          void patchProduct(p.id, { unit: e.target.value as ProductUnit })
                        }
                      >
                        {UNITS.map((u) => (
                          <option key={u.value} value={u.value}>
                            {u.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        min={0}
                        step="any"
                        className="w-24 rounded border border-navy-200 px-2 py-1"
                        value={p.monthly_qty_y1}
                        disabled={readOnly}
                        onChange={(e) =>
                          setProducts((list) =>
                            list.map((x) =>
                              x.id === p.id
                                ? { ...x, monthly_qty_y1: Number(e.target.value) }
                                : x
                            )
                          )
                        }
                        onBlur={(e) =>
                          void patchProduct(p.id, { monthly_qty_y1: Number(e.target.value) })
                        }
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        className="w-24 rounded border border-navy-200 px-2 py-1"
                        value={p.unit_price_sell}
                        disabled={readOnly}
                        onBlur={(e) =>
                          void patchProduct(p.id, { unit_price_sell: Number(e.target.value) })
                        }
                        onChange={(e) =>
                          setProducts((list) =>
                            list.map((x) =>
                              x.id === p.id
                                ? { ...x, unit_price_sell: Number(e.target.value) }
                                : x
                            )
                          )
                        }
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step="1"
                        className="w-16 rounded border border-navy-200 px-2 py-1"
                        value={Math.round(p.ristourne_pct * 100)}
                        disabled={readOnly}
                        onBlur={(e) =>
                          void patchProduct(p.id, {
                            ristourne_pct: Number(e.target.value) / 100,
                          })
                        }
                        onChange={(e) =>
                          setProducts((list) =>
                            list.map((x) =>
                              x.id === p.id
                                ? { ...x, ristourne_pct: Number(e.target.value) / 100 }
                                : x
                            )
                          )
                        }
                      />
                    </td>
                    {!readOnly && (
                      <td className="px-2 py-2">
                        <button
                          type="button"
                          className="text-red-600 hover:text-red-800"
                          onClick={() => void removeProduct(p.id)}
                          aria-label="Supprimer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {assumptions && (
        <section className="rounded-xl border border-navy-100 bg-white p-4 shadow-sm">
          <h4 className="mb-4 text-sm font-semibold text-navy-800">Capacité &amp; croissance</h4>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-xs text-navy-600">
              Capacité nominale
              <input
                type="number"
                min={0}
                className="mt-1 w-full rounded-lg border border-navy-200 px-3 py-2 text-sm"
                value={assumptions.nominal_capacity}
                disabled={readOnly}
                onChange={(e) =>
                  setAssumptions({ ...assumptions, nominal_capacity: Number(e.target.value) })
                }
                onBlur={(e) =>
                  void saveAssumptions({ nominal_capacity: Number(e.target.value) })
                }
              />
            </label>
            <label className="text-xs text-navy-600">
              Base capacité
              <select
                className="mt-1 w-full rounded-lg border border-navy-200 px-3 py-2 text-sm"
                value={assumptions.capacity_basis}
                disabled={readOnly}
                onChange={(e) =>
                  void saveAssumptions({
                    capacity_basis: e.target.value as CapacityBasis,
                  })
                }
              >
                <option value="units_per_day">Unités / jour</option>
                <option value="kg_per_month">kg / mois</option>
              </select>
            </label>
            <label className="text-xs text-navy-600">
              Jours de production / an
              <input
                type="number"
                min={1}
                className="mt-1 w-full rounded-lg border border-navy-200 px-3 py-2 text-sm"
                value={assumptions.production_days}
                disabled={readOnly}
                onChange={(e) =>
                  setAssumptions({ ...assumptions, production_days: Number(e.target.value) })
                }
                onBlur={(e) =>
                  void saveAssumptions({ production_days: Number(e.target.value) })
                }
              />
            </label>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {GROWTH_KEYS.map((key, i) => (
              <label key={key} className="text-xs text-navy-600">
                Croissance Y{i + 2} → Y{i + 3} ({formatPercent(assumptions[key])})
                <input
                  type="range"
                  min={-20}
                  max={80}
                  step={1}
                  disabled={readOnly}
                  value={Math.round(assumptions[key] * 100)}
                  className="mt-2 w-full accent-gold-500"
                  onChange={(e) =>
                    setAssumptions({
                      ...assumptions,
                      [key]: Number(e.target.value) / 100,
                    })
                  }
                  onMouseUp={(e) =>
                    void saveAssumptions({ [key]: Number(e.currentTarget.value) / 100 })
                  }
                  onTouchEnd={(e) =>
                    void saveAssumptions({ [key]: Number(e.currentTarget.value) / 100 })
                  }
                />
              </label>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-xl border border-gold-200/60 bg-gold-50/30 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-navy-800">Projection CA Y1–Y7 (aperçu)</h4>
          {projLoading && <Loader2 className="h-4 w-4 animate-spin text-navy-500" />}
        </div>
        {projection && projection.products.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-start text-xs">
              <thead>
                <tr className="border-b border-navy-200 text-navy-600">
                  <th className="sticky start-0 bg-gold-50/90 px-2 py-2">Produit</th>
                  {years.map((y) => (
                    <th key={y} className="px-2 py-2 text-end">
                      Y{y}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {projection.products.map((s) => (
                  <tr key={s.product_id} className="border-b border-navy-100">
                    <td className="sticky start-0 bg-white/80 px-2 py-2 font-medium">
                      {s.name}
                    </td>
                    {s.years.map((yr) => (
                      <td key={yr.year} className="px-2 py-2 text-end tabular-nums">
                        {formatCurrency(yr.revenue_net)}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="bg-navy-800/5 font-semibold">
                  <td className="sticky start-0 px-2 py-2">Total CA net</td>
                  {projection.total_revenue_net.map((v, i) => (
                    <td key={i} className="px-2 py-2 text-end tabular-nums text-navy-900">
                      {formatCurrency(v)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="sticky start-0 px-2 py-2 text-navy-600">Taux utilisation</td>
                  {projection.capacity_utilization_pct.map((pct, i) => (
                    <td key={i} className="px-2 py-2">
                      <div className="flex flex-col items-end gap-1">
                        <span className="tabular-nums text-[10px]">{formatNumber(pct, { maximumFractionDigits: 1 })}%</span>
                        <div className="h-2 w-full max-w-[4rem] overflow-hidden rounded-full bg-navy-100">
                          <div
                            className={`h-full ${utilizationBarColor(pct)}`}
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-navy-500">
            Ajoutez des produits et une capacité nominale pour voir la grille.
          </p>
        )}
      </section>
    </div>
  );
}
