"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_EQUIPMENT,
  get,
  getArray,
  set,
  setArray,
  type Inputs,
} from "./liasse-form-utils";

interface Props {
  inputs: Inputs;
  onChange: (inputs: Inputs) => void;
  onSave: (inputs: Inputs) => Promise<void>;
  readOnly?: boolean;
  debounceMs?: number;
}

type EquipmentRow = {
  name: string;
  cost: number;
  usefulLifeYears: number;
  acquisitionYear: number;
  assetType: string;
};

const YEAR_LABELS = ["An 1", "An 2", "An 3", "An 4", "An 5", "An 6", "An 7"];

export default function LiasseForm({
  inputs,
  onChange,
  onSave,
  readOnly = false,
  debounceMs = 2500,
}: Props) {
  const [local, setLocal] = useState(inputs);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLocal(inputs);
  }, [inputs]);

  const push = useCallback(
    (next: Inputs) => {
      setLocal(next);
      onChange(next);
      if (readOnly) return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(async () => {
        setSaving(true);
        try {
          await onSave(next);
          setSavedAt(new Date());
        } finally {
          setSaving(false);
        }
      }, debounceMs);
    },
    [onChange, onSave, readOnly, debounceMs]
  );

  const update = (path: string, value: string) => {
    push(set(local, path, value));
  };

  const equipment = getArray<EquipmentRow>(local, "investments.equipment");

  const updateEquipment = (index: number, field: keyof EquipmentRow, value: string) => {
    const rows = [...equipment];
    const row = { ...rows[index] };
    if (field === "name" || field === "assetType") {
      row[field] = value as never;
    } else {
      const n = parseFloat(value);
      (row as Record<string, unknown>)[field] = isNaN(n) ? 0 : n;
    }
    rows[index] = row;
    push(setArray(local, "investments.equipment", rows));
  };

  const addEquipment = () => {
    push(setArray(local, "investments.equipment", [...equipment, { ...DEFAULT_EQUIPMENT }]));
  };

  const removeEquipment = (index: number) => {
    push(
      setArray(
        local,
        "investments.equipment",
        equipment.filter((_, i) => i !== index)
      )
    );
  };

  const wasteByYear = getArray<Record<string, unknown>>(local, "operations.wasteRateByYear").map(
    (v) => (typeof v === "number" ? v : parseFloat(String(v)) || 0.01)
  );
  const wasteRates =
    wasteByYear.length >= 7
      ? wasteByYear.slice(0, 7)
      : [
          ...wasteByYear,
          ...Array(7 - wasteByYear.length).fill(
            parseFloat(get(local, "operations.wasteRate.value", "0.01")) || 0.01
          ),
        ];

  const setWasteYear = (yearIndex: number, value: string) => {
    const next = [...wasteRates];
    next[yearIndex] = parseFloat(value) || 0;
    push(setArray(local, "operations.wasteRateByYear", next));
  };

  const field = (label: string, path: string, type = "text") => (
    <div className="form-group" key={path}>
      <label htmlFor={path}>{label}</label>
      <input
        id={path}
        type={type}
        className="form-input"
        value={get(local, path)}
        onChange={(e) => update(path, e.target.value)}
        disabled={readOnly}
      />
    </div>
  );

  const totalCapex = equipment.reduce((s, e) => s + (Number(e.cost) || 0), 0);

  return (
    <div>
      {saving && <p className="save-hint saving">Enregistrement…</p>}
      {savedAt && !saving && (
        <p className="save-hint saved">
          Sauvegardé à {savedAt.toLocaleTimeString("fr-TN")}
        </p>
      )}

      <section className="form-section">
        <h3>Informations société (Liasse Unique)</h3>
        {field("Raison sociale", "company.name")}
        <div className="form-group">
          <label htmlFor="company.legalForm">Forme juridique</label>
          <select
            id="company.legalForm"
            className="form-select"
            value={get(local, "company.legalForm", "SARL")}
            onChange={(e) => update("company.legalForm", e.target.value)}
            disabled={readOnly}
          >
            <option value="SARL">SARL</option>
            <option value="SUARL">SUARL</option>
            <option value="SA">SA</option>
          </select>
        </div>
      </section>

      <section className="form-section">
        <div className="form-section-header">
          <h3>CAPEX — Équipements détaillés</h3>
          {!readOnly && (
            <button type="button" className="btn btn-secondary" onClick={addEquipment}>
              + Équipement
            </button>
          )}
        </div>
        <p className="form-hint">
          CAPEX total : <strong>{totalCapex.toLocaleString("fr-TN")} TND</strong> — amortissements
          selon durée et année d&apos;acquisition.
        </p>
        {equipment.length === 0 ? (
          <p className="form-hint">Ajoutez au moins un équipement.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table liasse-table">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Type</th>
                  <th className="num">Coût (TND)</th>
                  <th className="num">Amort. (ans)</th>
                  <th className="num">Acquisition (an)</th>
                  {!readOnly && <th />}
                </tr>
              </thead>
              <tbody>
                {equipment.map((row, i) => (
                  <tr key={i}>
                    <td>
                      <input
                        className="form-input form-input-inline"
                        value={row.name ?? ""}
                        disabled={readOnly}
                        onChange={(e) => updateEquipment(i, "name", e.target.value)}
                      />
                    </td>
                    <td>
                      <select
                        className="form-select form-input-inline"
                        value={row.assetType ?? "tangible"}
                        disabled={readOnly}
                        onChange={(e) => updateEquipment(i, "assetType", e.target.value)}
                      >
                        <option value="tangible">Corporel</option>
                        <option value="intangible">Incorporel</option>
                      </select>
                    </td>
                    <td>
                      <input
                        type="number"
                        className="form-input form-input-inline"
                        value={row.cost ?? 0}
                        disabled={readOnly}
                        onChange={(e) => updateEquipment(i, "cost", e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        className="form-input form-input-inline"
                        value={row.usefulLifeYears ?? 5}
                        disabled={readOnly}
                        onChange={(e) =>
                          updateEquipment(i, "usefulLifeYears", e.target.value)
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min={1}
                        max={7}
                        className="form-input form-input-inline"
                        value={row.acquisitionYear ?? 1}
                        disabled={readOnly}
                        onChange={(e) =>
                          updateEquipment(i, "acquisitionYear", e.target.value)
                        }
                      />
                    </td>
                    {!readOnly && (
                      <td>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => removeEquipment(i)}
                        >
                          Suppr.
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

      <section className="form-section">
        <h3>Hypothèses d&apos;exploitation</h3>
        {field("Capacité (unités/min)", "operations.capacityPerMinute", "number")}
        {field("Jours ouvrés / an", "operations.workingDaysPerYear", "number")}
        {field("Coût matière unitaire", "operations.rawMaterialCost", "number")}
        {field("Coût emballage unitaire", "operations.packagingCost", "number")}
        {field("Prix de vente unitaire", "operations.salePrice", "number")}
        {field("Taux de déchet max autorisé", "operations.wasteRate.maxAllowed", "number")}
        <div className="form-subsection">
          <h4>Taux de déchet par année (%)</h4>
          <p className="form-hint">
            Variable par année du plan — impacte la capacité nette et les coûts.
          </p>
          <div className="waste-year-grid">
            {YEAR_LABELS.map((label, yi) => (
              <div className="form-group" key={yi}>
                <label htmlFor={`waste-${yi}`}>{label}</label>
                <input
                  id={`waste-${yi}`}
                  type="number"
                  step="0.001"
                  min={0}
                  max={1}
                  className="form-input"
                  value={wasteRates[yi] ?? 0.01}
                  disabled={readOnly}
                  onChange={(e) => setWasteYear(yi, e.target.value)}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="form-section">
        <h3>BFR — Stocks finaux (en jours)</h3>
        {field("Stock matières premières (jours)", "workingCapital.rawMaterialStockDays", "number")}
        {field("Stock emballages (jours)", "workingCapital.packagingStockDays", "number")}
        {field("Stock produits finis (jours)", "workingCapital.finishedGoodsStockDays", "number")}
        {field("Créances clients (jours)", "workingCapital.clientPaymentDays", "number")}
        {field("Dettes fournisseurs (jours)", "workingCapital.supplierPaymentDays", "number")}
      </section>

      <section className="form-section">
        <h3>OPEX — Distribution & marketing</h3>
        <p className="form-hint">Pourcentage du chiffre d&apos;affaires HT (ex. 0,04 = 4 %).</p>
        {field("Frais de distribution (% CA)", "plAssumptions.distributionExpensePct", "number")}
        {field("Frais de marketing (% CA)", "plAssumptions.marketingExpensePct", "number")}
        {field("Autres charges opérationnelles (TND/an)", "plAssumptions.otherOperatingCharges", "number")}
        {field("Ristourne commerciale (%)", "plAssumptions.commercialDiscount", "number")}
      </section>

      <section className="form-section">
        <h3>Financement</h3>
        {field("Fonds propres (%)", "financing.equityRatio", "number")}
        {field("Dette (%)", "financing.debtRatio", "number")}
        {field("Taux d'intérêt emprunt", "financing.loan.rate", "number")}
      </section>
    </div>
  );
}
