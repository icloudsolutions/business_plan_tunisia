"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import AuthGuard from "@/components/AuthGuard";
import RoleGate from "@/components/auth/RoleGate";
import TemplateSelector from "@/components/TemplateSelector";
import {
  createBlankPlan,
  createPlanFromTemplate,
  fetchTemplatesTaxonomy,
  listDocumentTemplates,
  type SecteurTaxonomy,
  type TemplateSummary,
} from "@/lib/templates-api";

const TYPE_ENTREPRISE = ["PME", "GE", "STARTUP"] as const;
const TYPE_FINANCEMENT = [
  { id: "CMT_SEUL", label: "CMT seul" },
  { id: "LEASING", label: "Leasing" },
  { id: "MIXTE", label: "Mixte" },
  { id: "FONDS_PROPRES", label: "Fonds propres" },
] as const;

export default function NewPlanPage() {
  return (
    <AuthGuard>
      <RoleGate role={["client"]} redirect="/plans">
        <NewPlanWizard />
      </RoleGate>
    </AuthGuard>
  );
}

function NewPlanWizard() {
  const router = useRouter();
  const t = useTranslations("newPlan");
  const [taxonomy, setTaxonomy] = useState<SecteurTaxonomy[]>([]);
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [loadingTaxonomy, setLoadingTaxonomy] = useState(true);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [secteur, setSecteur] = useState("");
  const [sousSecteur, setSousSecteur] = useState("");
  const [typeEntreprise, setTypeEntreprise] = useState<string>("PME");
  const [typeFinancement, setTypeFinancement] = useState("MIXTE");
  const [planName, setPlanName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateSummary | null>(null);

  const sousSecteurs = useMemo(() => {
    const s = taxonomy.find((x) => x.id === secteur);
    return s?.sous_secteurs ?? [];
  }, [taxonomy, secteur]);

  useEffect(() => {
    void fetchTemplatesTaxonomy()
      .then((r) => setTaxonomy(r.secteurs))
      .catch((e) => setError(e instanceof Error ? e.message : "Erreur"))
      .finally(() => setLoadingTaxonomy(false));
  }, []);

  const loadTemplates = useCallback(async () => {
    if (!secteur) {
      setTemplates([]);
      return;
    }
    setLoadingTemplates(true);
    setError("");
    try {
      const list = await listDocumentTemplates({
        secteur,
        sous_secteur: sousSecteur || undefined,
        type_entreprise: typeEntreprise,
        type_financement: typeFinancement,
      });
      setTemplates(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoadingTemplates(false);
    }
  }, [secteur, sousSecteur, typeEntreprise, typeFinancement]);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  useEffect(() => {
    setSousSecteur("");
    setSelectedTemplate(null);
  }, [secteur]);

  const handleBlank = async () => {
    setBusy(true);
    setError("");
    try {
      const p = await createBlankPlan(planName.trim() || undefined);
      router.replace(`/plans/${p.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  };

  const handleUseTemplate = async (tpl: TemplateSummary) => {
    const name = planName.trim() || tpl.name;
    setBusy(true);
    setError("");
    try {
      const res = await createPlanFromTemplate({
        template_id: tpl.id,
        plan_name: name,
        project_description: description.trim() || undefined,
      });
      router.replace(`/plans/${res.plan_id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-8">
        <h1 className="font-display text-2xl font-bold text-navy-900">{t("title")}</h1>
        <p className="mt-2 text-sm text-navy-600">{t("subtitle")}</p>
      </header>

      {error && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <section className="card mb-8 space-y-5">
        <h2 className="text-lg font-semibold text-navy-800">{t("filtersTitle")}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-navy-700">{t("secteur")}</span>
            <select
              className="w-full rounded-lg border border-navy-200 px-3 py-2"
              value={secteur}
              disabled={loadingTaxonomy}
              onChange={(e) => setSecteur(e.target.value)}
            >
              <option value="">{t("secteurPlaceholder")}</option>
              {taxonomy.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-navy-700">{t("sousSecteur")}</span>
            <select
              className="w-full rounded-lg border border-navy-200 px-3 py-2"
              value={sousSecteur}
              disabled={!secteur}
              onChange={(e) => setSousSecteur(e.target.value)}
            >
              <option value="">{t("allSousSecteurs")}</option>
              {sousSecteurs.map((ss) => (
                <option key={ss.id} value={ss.id}>
                  {ss.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-navy-700">{t("typeEntreprise")}</span>
            <select
              className="w-full rounded-lg border border-navy-200 px-3 py-2"
              value={typeEntreprise}
              onChange={(e) => setTypeEntreprise(e.target.value)}
            >
              {TYPE_ENTREPRISE.map((te) => (
                <option key={te} value={te}>
                  {te}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-navy-700">{t("typeFinancement")}</span>
            <select
              className="w-full rounded-lg border border-navy-200 px-3 py-2"
              value={typeFinancement}
              onChange={(e) => setTypeFinancement(e.target.value)}
            >
              {TYPE_FINANCEMENT.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-navy-700">{t("planName")}</span>
            <input
              type="text"
              className="w-full rounded-lg border border-navy-200 px-3 py-2"
              value={planName}
              onChange={(e) => setPlanName(e.target.value)}
              placeholder={t("planNamePlaceholder")}
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block font-medium text-navy-700">{t("description")}</span>
            <textarea
              className="w-full rounded-lg border border-navy-200 px-3 py-2"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("descriptionPlaceholder")}
            />
          </label>
        </div>
      </section>

      <section className="mb-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-navy-800">{t("templatesTitle")}</h2>
          <button
            type="button"
            disabled={busy}
            className="rounded-lg border border-navy-300 px-4 py-2 text-sm font-medium text-navy-800 hover:bg-navy-50"
            onClick={() => void handleBlank()}
          >
            {t("blankCta")}
          </button>
        </div>
        {!secteur ? (
          <p className="text-sm text-navy-600">{t("pickSecteur")}</p>
        ) : (
          <TemplateSelector
            templates={templates}
            loading={loadingTemplates}
            selectedId={selectedTemplate?.id}
            onSelect={(tpl) => {
              setSelectedTemplate(tpl);
              void handleUseTemplate(tpl);
            }}
          />
        )}
      </section>

      {busy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/20">
          <div className="rounded-xl bg-white px-6 py-4 shadow-xl">
            <p className="text-sm text-navy-700">{t("creating")}</p>
          </div>
        </div>
      )}
    </div>
  );
}
