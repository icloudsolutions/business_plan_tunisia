"use client";

import { Plus, Trash2 } from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import {
  formatTnd,
  monthlyProductionCost,
  unitProductionCost,
} from "@/lib/finance/calculations";
import { Btn, Card, CardHeader, Label, NumInput, TextInput } from "./ui";

export default function ProductionModule() {
  const { products, addProduct, updateProduct, removeProduct } = useFinance();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Composantes de production — Produits finis"
          subtitle="Saisissez les coûts unitaires : eau, énergie, main-d'œuvre directe, additifs et matières premières."
          action={
            <Btn onClick={addProduct}>
              <Plus className="h-4 w-4" />
              Ajouter un produit
            </Btn>
          }
        />

        <div className="space-y-6">
          {products.map((p) => {
            const unit = unitProductionCost(p);
            const monthly = monthlyProductionCost(p);
            return (
              <div
                key={p.id}
                className="rounded-xl border border-slate-100 bg-slate-50/40 p-4 sm:p-5"
              >
                <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                  <div className="grid flex-1 gap-3 sm:grid-cols-3">
                    <div>
                      <Label>Produit</Label>
                      <TextInput
                        value={p.name}
                        onChange={(v) => updateProduct(p.id, { name: v })}
                      />
                    </div>
                    <div>
                      <Label>Réf. SKU</Label>
                      <TextInput
                        value={p.sku}
                        onChange={(v) => updateProduct(p.id, { sku: v })}
                      />
                    </div>
                    <div>
                      <Label>Volume mensuel ({p.unit})</Label>
                      <NumInput
                        value={p.monthlyVolume}
                        onChange={(v) =>
                          updateProduct(p.id, { monthlyVolume: v })
                        }
                        step={100}
                      />
                    </div>
                  </div>
                  <Btn variant="danger" onClick={() => removeProduct(p.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Btn>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                  {(
                    [
                      ["Eau", "water"],
                      ["Électricité", "electricity"],
                      ["M.O. directe", "directLabor"],
                      ["Additifs", "additives"],
                      ["Matières premières", "rawMaterials"],
                      ["Autres", "other"],
                    ] as const
                  ).map(([label, key]) => (
                    <div key={key}>
                      <Label>{label} (TND/u)</Label>
                      <NumInput
                        value={p[key]}
                        onChange={(v) => updateProduct(p.id, { [key]: v })}
                        step={0.01}
                      />
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex flex-wrap gap-4 rounded-lg bg-white px-4 py-3 text-sm">
                  <span>
                    <strong className="text-slate-700">Coût de revient unitaire :</strong>{" "}
                    <span className="font-semibold text-brand-700">
                      {formatTnd(unit, 3)}
                    </span>
                  </span>
                  <span className="text-slate-300">|</span>
                  <span>
                    <strong className="text-slate-700">Coût mensuel :</strong>{" "}
                    <span className="font-semibold text-emerald-700">
                      {formatTnd(monthly)}
                    </span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Tableau récapitulatif — Coûts de revient"
          subtitle="Calcul automatique à partir des composantes saisies"
        />
        <div className="overflow-x-auto -mx-1">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-3 font-medium">Produit</th>
                <th className="px-3 py-3 text-right font-medium">Eau</th>
                <th className="px-3 py-3 text-right font-medium">Élec.</th>
                <th className="px-3 py-3 text-right font-medium">M.O.</th>
                <th className="px-3 py-3 text-right font-medium">Additifs</th>
                <th className="px-3 py-3 text-right font-medium">MP</th>
                <th className="px-3 py-3 text-right font-medium">Autres</th>
                <th className="px-3 py-3 text-right font-semibold text-brand-700">
                  Coût unitaire
                </th>
                <th className="px-3 py-3 text-right font-semibold text-emerald-700">
                  Mensuel
                </th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-slate-50 hover:bg-slate-50/80"
                >
                  <td className="px-3 py-3 font-medium text-slate-800">
                    {p.name}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {formatTnd(p.water, 2)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {formatTnd(p.electricity, 2)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {formatTnd(p.directLabor, 2)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {formatTnd(p.additives, 2)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {formatTnd(p.rawMaterials, 2)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {formatTnd(p.other, 2)}
                  </td>
                  <td className="px-3 py-3 text-right font-semibold tabular-nums text-brand-700">
                    {formatTnd(unitProductionCost(p), 3)}
                  </td>
                  <td className="px-3 py-3 text-right font-semibold tabular-nums text-emerald-700">
                    {formatTnd(monthlyProductionCost(p))}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 font-semibold">
                <td className="px-3 py-3">Total</td>
                <td colSpan={6} />
                <td className="px-3 py-3 text-right text-brand-700">—</td>
                <td className="px-3 py-3 text-right text-emerald-700">
                  {formatTnd(
                    products.reduce((s, p) => s + monthlyProductionCost(p), 0)
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </div>
  );
}
