"use client";

import { Plus, Trash2 } from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import { defaultLaborType, formatTnd } from "@/lib/finance/calculations";
import type { Department, LaborType } from "@/lib/finance/types";
import { Btn, Card, CardHeader, Label, NumInput, SelectInput, TextInput } from "./ui";

const DEPT_OPTIONS: { value: Department; label: string }[] = [
  { value: "production", label: "Production" },
  { value: "conditionnement", label: "Conditionnement" },
  { value: "support", label: "Support / Qualité" },
  { value: "administration", label: "Administration" },
  { value: "direction", label: "Direction" },
];

const LABOR_OPTIONS: { value: LaborType; label: string }[] = [
  { value: "direct", label: "Direct (production)" },
  { value: "indirect", label: "Indirect (support)" },
];

export default function PayrollModule() {
  const {
    employees,
    payrollLines,
    addEmployee,
    updateEmployee,
    removeEmployee,
  } = useFinance();

  const totalEmployer = payrollLines.reduce((s, l) => s + l.totalEmployerCost, 0);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Calcul des coûts salariaux"
          subtitle="Saisissez l'effectif et le salaire net désiré — brut, charges et coût employeur sont calculés automatiquement (taux CNSS mock)."
          action={
            <Btn onClick={addEmployee}>
              <Plus className="h-4 w-4" />
              Ajouter un poste
            </Btn>
          }
        />

        <div className="space-y-4">
          {employees.map((e) => (
            <div
              key={e.id}
              className="grid gap-3 rounded-xl border border-slate-100 bg-slate-50/40 p-4 lg:grid-cols-12 lg:items-end"
            >
              <div className="lg:col-span-3">
                <Label>Poste / département</Label>
                <TextInput
                  value={e.poste}
                  onChange={(v) => updateEmployee(e.id, { poste: v })}
                />
              </div>
              <div className="lg:col-span-2">
                <Label>Département</Label>
                <SelectInput
                  value={e.department}
                  onChange={(v) => {
                    const dept = v as Department;
                    updateEmployee(e.id, {
                      department: dept,
                      laborType: defaultLaborType(dept),
                    });
                  }}
                  options={DEPT_OPTIONS}
                />
              </div>
              <div className="lg:col-span-2">
                <Label>Type MO</Label>
                <SelectInput
                  value={e.laborType}
                  onChange={(v) =>
                    updateEmployee(e.id, { laborType: v as LaborType })
                  }
                  options={LABOR_OPTIONS}
                />
              </div>
              <div className="lg:col-span-1">
                <Label>Effectif</Label>
                <NumInput
                  value={e.headcount}
                  onChange={(v) => updateEmployee(e.id, { headcount: Math.max(0, v) })}
                  step={1}
                />
              </div>
              <div className="lg:col-span-2">
                <Label>Salaire net désiré (TND)</Label>
                <NumInput
                  value={e.netSalaryDesired}
                  onChange={(v) => updateEmployee(e.id, { netSalaryDesired: v })}
                  step={50}
                />
              </div>
              <div className="flex lg:col-span-2 lg:justify-end">
                <Btn variant="danger" onClick={() => removeEmployee(e.id)}>
                  <Trash2 className="h-4 w-4" />
                </Btn>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Résultats par catégorie"
          subtitle="Brut, retenues salariales, charges patronales et coût total employeur"
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-3">Poste</th>
                <th className="px-3 py-3 text-center">Eff.</th>
                <th className="px-3 py-3">Type</th>
                <th className="px-3 py-3 text-right">Net cible</th>
                <th className="px-3 py-3 text-right">Brut</th>
                <th className="px-3 py-3 text-right">Retenues sal.</th>
                <th className="px-3 py-3 text-right">Charges pat.</th>
                <th className="px-3 py-3 text-right">Net calculé</th>
                <th className="px-3 py-3 text-right font-semibold text-violet-700">
                  Coût employeur total
                </th>
              </tr>
            </thead>
            <tbody>
              {payrollLines.map((l) => (
                <tr
                  key={l.id}
                  className="border-b border-slate-50 hover:bg-slate-50/80"
                >
                  <td className="px-3 py-3 font-medium">{l.poste}</td>
                  <td className="px-3 py-3 text-center tabular-nums">
                    {l.headcount}
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`inline rounded-full px-2 py-0.5 text-xs font-medium ${
                        l.laborType === "direct"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-violet-100 text-violet-800"
                      }`}
                    >
                      {l.laborType === "direct" ? "Direct" : "Indirect"}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {formatTnd(l.netSalaryDesired)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {formatTnd(l.grossSalary)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-amber-700">
                    {formatTnd(l.employeeCharges)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-orange-700">
                    {formatTnd(l.employerCharges)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {formatTnd(l.netSalary)}
                  </td>
                  <td className="px-3 py-3 text-right font-semibold tabular-nums text-violet-700">
                    {formatTnd(l.totalEmployerCost)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-violet-50 font-semibold">
                <td className="px-3 py-3" colSpan={8}>
                  Masse salariale totale (coût employeur)
                </td>
                <td className="px-3 py-3 text-right text-violet-800">
                  {formatTnd(totalEmployer)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="mt-4 text-xs text-slate-500">
          Taux démo : CNSS salarié 9,18 % · CNSS patronal 16,57 % · autres charges 2 % · IRPP effectif 5 %.
        </p>
      </Card>
    </div>
  );
}
