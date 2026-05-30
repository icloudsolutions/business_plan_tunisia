"use client";

import { useEffect, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import TunisianMeshBackground from "@/components/dashboard/TunisianMeshBackground";
import { useAuth } from "@/context/AuthContext";

export default function LoginPage() {
  const router = useRouter();
  const { user, loading, login, register } = useAuth();
  const t = useTranslations("auth");
  const tNav = useTranslations("nav");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace("/");
  }, [user, loading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      if (mode === "register") await register(email, password);
      else await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("connectionError"));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-navy-50">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-navy-200 border-t-gold-500" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen font-sans">
      <TunisianMeshBackground />
      <div className="absolute end-4 top-4 z-10">
        <LanguageSwitcher />
      </div>
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md overflow-hidden rounded-2xl border border-navy-100 bg-white shadow-card">
          <div className="bg-navy-800 px-6 py-8 text-center">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-gold-500 font-display text-lg font-bold text-navy-900">
              BP
            </span>
            <h1 className="mt-4 font-display text-2xl font-semibold text-white">
              {tNav("appName")}
            </h1>
            <p className="mt-1 text-sm text-navy-200">{tNav("appTagline")}</p>
          </div>
          <div className="p-6">
            <div className="mb-6 flex rounded-lg border border-navy-100 p-1">
              <button
                type="button"
                className={`flex-1 rounded-md py-2 text-sm font-medium transition ${
                  mode === "login"
                    ? "bg-navy-800 text-gold-300"
                    : "text-navy-600"
                }`}
                onClick={() => setMode("login")}
              >
                {t("login")}
              </button>
              <button
                type="button"
                className={`flex-1 rounded-md py-2 text-sm font-medium transition ${
                  mode === "register"
                    ? "bg-navy-800 text-gold-300"
                    : "text-navy-600"
                }`}
                onClick={() => setMode("register")}
              >
                {t("register")}
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="login-email"
                  className="mb-1 block text-xs font-medium uppercase text-navy-500"
                >
                  {t("email")}
                </label>
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  className="w-full rounded-lg border border-navy-200 px-3 py-2.5 text-sm focus:border-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div>
                <label
                  htmlFor="login-password"
                  className="mb-1 block text-xs font-medium uppercase text-navy-500"
                >
                  {t("password")}
                </label>
                <input
                  id="login-password"
                  type="password"
                  autoComplete={mode === "register" ? "new-password" : "current-password"}
                  className="w-full rounded-lg border border-navy-200 px-3 py-2.5 text-sm focus:border-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  required
                />
              </div>
              {error && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-gold-500 py-3 text-sm font-semibold text-navy-900 transition hover:bg-gold-400 disabled:opacity-50"
              >
                {submitting
                  ? t("pleaseWait")
                  : mode === "login"
                    ? t("submitLogin")
                    : t("submitRegister")}
              </button>
            </form>
            <p className="mt-6 text-center text-xs text-navy-500">{t("demoHint")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
