"use client";

import { useCallback, useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { ArrowLeft, Download, Shield } from "lucide-react";
import AuthGuard from "@/components/AuthGuard";
import RoleGate from "@/components/auth/RoleGate";
import { useAuth } from "@/context/AuthContext";
import { getToken } from "@/lib/auth-storage";
import {
  adminListTemplates,
  adminPatchTemplate,
  adminTemplateStats,
  adminTemplatesCsvUrl,
  fetchTemplatesTaxonomy,
  type AdminTemplateRow,
  type SecteurTaxonomy,
} from "@/lib/templates-api";

function AdminTemplatesPanel() {
  const { user, logout } = useAuth();
  const [taxonomy, setTaxonomy] = useState<SecteurTaxonomy[]>([]);
  const [rows, setRows] = useState<AdminTemplateRow[]>([]);
  const [stats, setStats] = useState<{
    by_secteur: { secteur: string; count: number; total_usage: number }[];
    top_templates: { name: string; usage_count: number }[];
  } | null>(null);
  const [secteur, setSecteur] = useState("");
  const [sousSecteur, setSousSecteur] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, st] = await Promise.all([
        adminListTemplates({
          secteur: secteur || undefined,
          sous_secteur: sousSecteur || undefined,
        }),
        adminTemplateStats(),
      ]);
      setRows(list);
      setStats(st);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }, [secteur, sousSecteur]);

  useEffect(() => {
    void fetchTemplatesTaxonomy().then((r) => setTaxonomy(r.secteurs));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleActive = async (row: AdminTemplateRow) => {
    try {
      await adminPatchTemplate(row.id, { is_active: !row.is_active });
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Erreur");
    }
  };

  const downloadCsv = async () => {
    const token = getToken();
    const res = await fetch(adminTemplatesCsvUrl(), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      setMessage("Export CSV impossible");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "templates_export.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const sousOptions = taxonomy.find((s) => s.id === secteur)?.sous_secteurs ?? [];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="text-slate-500 hover:text-slate-800">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-amber-400">
              <Shield className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-lg font-semibold text-slate-900">Templates documents</h1>
              <p className="text-xs text-slate-500">Secteurs TIA · hypothèses sectorielles</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void downloadCsv()}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
            <span className="text-xs text-slate-500">{user?.email}</span>
            <button
              type="button"
              onClick={logout}
              className="text-xs text-slate-600 hover:underline"
            >
              Déconnexion
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
        {message && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{message}</p>
        )}

        {stats && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats.by_secteur.map((s) => (
              <div key={s.secteur} className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs uppercase text-slate-500">{s.secteur.replace(/_/g, " ")}</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">{s.count}</p>
                <p className="text-xs text-slate-600">{s.total_usage} utilisations</p>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white p-4">
          <select
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={secteur}
            onChange={(e) => {
              setSecteur(e.target.value);
              setSousSecteur("");
            }}
          >
            <option value="">Tous secteurs</option>
            {taxonomy.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <select
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={sousSecteur}
            disabled={!secteur}
            onChange={(e) => setSousSecteur(e.target.value)}
          >
            <option value="">Tous sous-secteurs</option>
            {sousOptions.map((ss) => (
              <option key={ss.id} value={ss.id}>
                {ss.label}
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Nom</th>
                <th className="px-4 py-3">Secteur</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Usage</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    Chargement…
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100">
                    <td className="px-4 py-3 font-medium text-slate-900">{r.name}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {r.secteur}
                      <br />
                      <span className="text-xs">{r.sous_secteur}</span>
                    </td>
                    <td className="px-4 py-3">
                      {r.type_entreprise} · {r.type_financement}
                    </td>
                    <td className="px-4 py-3">{r.usage_count}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          r.is_active
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {r.is_active ? "Actif" : "Inactif"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className="text-sm font-medium text-indigo-600 hover:underline"
                        onClick={() => void toggleActive(r)}
                      >
                        {r.is_active ? "Désactiver" : "Activer"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

export default function AdminTemplatesPage() {
  return (
    <AuthGuard>
      <RoleGate role={["admin"]} redirect="/">
        <AdminTemplatesPanel />
      </RoleGate>
    </AuthGuard>
  );
}
