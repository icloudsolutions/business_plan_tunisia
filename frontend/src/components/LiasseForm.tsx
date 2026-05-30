"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Inputs = Record<string, unknown>;

interface Props {
  inputs: Inputs;
  onChange: (inputs: Inputs) => void;
  onSave: (inputs: Inputs) => Promise<void>;
  readOnly?: boolean;
  debounceMs?: number;
}

function get(obj: Inputs, path: string, fallback: string | number = ""): string {
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return String(fallback);
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur != null ? String(cur) : String(fallback);
}

function set(obj: Inputs, path: string, value: string | number): Inputs {
  const parts = path.split(".");
  const out = JSON.parse(JSON.stringify(obj)) as Inputs;
  let cur: Record<string, unknown> = out;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (!cur[p] || typeof cur[p] !== "object") cur[p] = {};
    cur = cur[p] as Record<string, unknown>;
  }
  const last = parts[parts.length - 1];
  const num = parseFloat(String(value));
  cur[last] = isNaN(num) || String(value).trim() === "" ? value : num;
  return out;
}

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

  const scheduleSave = useCallback(
    (next: Inputs) => {
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
    [onSave, readOnly, debounceMs]
  );

  const update = (path: string, value: string) => {
    const next = set(local, path, value);
    setLocal(next);
    onChange(next);
    scheduleSave(next);
  };

  const field = (label: string, path: string, type = "text") => (
    <label style={{ display: "block", marginBottom: 12 }}>
      <span style={{ fontSize: 13, color: "#444" }}>{label}</span>
      <input
        type={type}
        value={get(local, path)}
        onChange={(e) => update(path, e.target.value)}
        disabled={readOnly}
        style={{
          display: "block",
          width: "100%",
          marginTop: 4,
          padding: "8px 10px",
          border: "1px solid #ccc",
          borderRadius: 6,
        }}
      />
    </label>
  );

  return (
    <div>
      {saving && <p style={{ color: "#0066cc", fontSize: 13 }}>Enregistrement...</p>}
      {savedAt && !saving && (
        <p style={{ color: "#22863a", fontSize: 13 }}>
          Sauvegardé à {savedAt.toLocaleTimeString("fr-TN")}
        </p>
      )}

      <section style={{ marginBottom: 24 }}>
        <h3>Informations société (Liasse Unique)</h3>
        {field("Raison sociale", "company.name")}
        <label style={{ display: "block", marginBottom: 12 }}>
          <span style={{ fontSize: 13 }}>Forme juridique</span>
          <select
            value={get(local, "company.legalForm", "SARL")}
            onChange={(e) => update("company.legalForm", e.target.value)}
            disabled={readOnly}
            style={{ display: "block", width: "100%", marginTop: 4, padding: 8 }}
          >
            <option value="SARL">SARL</option>
            <option value="SUARL">SUARL</option>
            <option value="SA">SA</option>
          </select>
        </label>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h3>Investissements initiaux</h3>
        {field("Incorporel — Logiciels (TND)", "investments.intangible.0.amount", "number")}
        {field("Corporel — Matériel industriel (TND)", "investments.tangible.0.amount", "number")}
      </section>

      <section style={{ marginBottom: 24 }}>
        <h3>Hypothèses d&apos;exploitation</h3>
        {field("Capacité (unités/min)", "operations.capacityPerMinute", "number")}
        {field("Jours ouvrés / an", "operations.workingDaysPerYear", "number")}
        {field("Coût matière unitaire", "operations.rawMaterialCost", "number")}
        {field("Coût emballage unitaire", "operations.packagingCost", "number")}
        {field("Prix de vente unitaire", "operations.salePrice", "number")}
        {field("Taux de déchet (max 1%)", "operations.wasteRate.value", "number")}
      </section>

      <section style={{ marginBottom: 24 }}>
        <h3>Financement</h3>
        {field("Fonds propres (%)", "financing.equityRatio", "number")}
        {field("Dette (%)", "financing.debtRatio", "number")}
        {field("Taux d'intérêt emprunt", "financing.loan.rate", "number")}
      </section>

      <section>
        <h3>BFR — Délais de règlement</h3>
        {field("Créances clients (jours)", "workingCapital.clientPaymentDays", "number")}
        {field("Dettes fournisseurs (jours)", "workingCapital.supplierPaymentDays", "number")}
        {field("Ristourne commerciale (%)", "plAssumptions.commercialDiscount", "number")}
      </section>
    </div>
  );
}
