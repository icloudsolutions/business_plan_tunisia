"use client";

import { useState } from "react";
import { createLegacyExpert } from "@/lib/legacy-expert-api";
import { Button } from "@/components/ui/button";

/**
 * @deprecated Legacy expert provisioning via `POST /api/auth/admin/experts` and `X-Admin-Key`.
 * Not used in production UI — replaced by **Gestion des utilisateurs** (`POST /api/admin/users` with admin JWT).
 * Only mounted when `NEXT_PUBLIC_SHOW_LEGACY=true`.
 */
export default function LegacyExpertForm({ onCreated }: { onCreated?: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [adminKey, setAdminKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await createLegacyExpert(email, password, adminKey);
      setMessage("Expert créé.");
      setEmail("");
      setPassword("");
      onCreated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <p className="text-xs text-slate-500">
        POST /api/auth/admin/experts — en-tête <code className="rounded bg-slate-100 px-1">X-Admin-Key</code>
      </p>
      <input
        type="email"
        placeholder="Email expert"
        className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        autoComplete="off"
      />
      <input
        type="password"
        placeholder="Mot de passe (8+)"
        className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        minLength={8}
        required
        autoComplete="new-password"
      />
      <input
        type="password"
        placeholder="X-Admin-Key (ADMIN_API_KEY)"
        className="w-full rounded-md border border-amber-200 bg-amber-50/50 px-3 py-2 font-mono text-sm"
        value={adminKey}
        onChange={(e) => setAdminKey(e.target.value)}
        required
        autoComplete="off"
      />
      {error && (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="text-sm text-emerald-700" role="status">
          {message}
        </p>
      )}
      <Button type="submit" variant="outline" disabled={busy} className="w-full">
        {busy ? "Création…" : "Créer l'expert (legacy)"}
      </Button>
    </form>
  );
}
