"use client";

import AuthGuard from "@/components/AuthGuard";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useAuth } from "@/context/AuthContext";
import { updateProfile } from "@/lib/api";
import { useFormat } from "@/hooks/useFormat";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { User } from "lucide-react";
import type { AppLocale } from "@/i18n/routing";

const TIMEZONES = [
  "Africa/Tunis",
  "Europe/Paris",
  "Europe/London",
  "UTC",
  "America/New_York",
] as const;

const ROLE_LABELS: Record<string, string> = {
  client: "CLIENT",
  expert: "EXPERT",
  admin: "ADMIN",
};

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const t = useTranslations("settings");
  const locale = useLocale() as AppLocale;
  const { formatDate } = useFormat();
  const [displayName, setDisplayName] = useState("");
  const [timezone, setTimezone] = useState("Africa/Tunis");
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<"ok" | "err" | null>(null);

  useEffect(() => {
    if (!user) return;
    setDisplayName(user.display_name ?? "");
    setTimezone(user.timezone ?? "Africa/Tunis");
    setEmailNotifications(user.email_notifications_enabled ?? true);
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setMessage(null);
    try {
      await updateProfile({
        display_name: displayName.trim() || null,
        preferred_locale: locale,
        timezone,
        email_notifications_enabled: emailNotifications,
      });
      await refreshUser();
      setMessage("ok");
    } catch {
      setMessage("err");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AuthGuard>
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <div className="mb-8 flex items-start gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-navy-800 text-gold-400">
            <User className="h-6 w-6" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-semibold text-navy-900">
              {t("title")}
            </h1>
            <p className="mt-1 text-sm text-navy-600">{t("subtitle")}</p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-8">
          <section className="rounded-xl border border-navy-100 bg-white/90 p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-navy-700">
              {t("account")}
            </h2>
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="settings-email"
                  className="mb-1 block text-xs font-medium text-navy-600"
                >
                  {t("emailReadOnly")}
                </label>
                <input
                  id="settings-email"
                  type="email"
                  readOnly
                  value={user?.email ?? ""}
                  className="w-full rounded-lg border border-navy-100 bg-navy-50/50 px-3 py-2 text-sm text-navy-700"
                />
              </div>
              <div>
                <label
                  htmlFor="settings-display-name"
                  className="mb-1 block text-xs font-medium text-navy-600"
                >
                  {t("displayName")}
                </label>
                <input
                  id="settings-display-name"
                  type="text"
                  maxLength={255}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={t("displayNamePlaceholder")}
                  className="w-full rounded-lg border border-navy-200 px-3 py-2 text-sm focus:border-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                />
              </div>
              <div className="flex flex-wrap gap-6 text-sm text-navy-600">
                <div>
                  <span className="text-xs font-medium text-navy-500">{t("role")}</span>
                  <p className="font-semibold text-navy-800">
                    {ROLE_LABELS[user?.role ?? "client"] ?? user?.role}
                  </p>
                </div>
                {user?.created_at && (
                  <div>
                    <span className="text-xs font-medium text-navy-500">
                      {t("memberSince")}
                    </span>
                    <p className="font-semibold text-navy-800">
                      {formatDate(user.created_at)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-navy-100 bg-white/90 p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-navy-700">
              {t("preferences")}
            </h2>
            <div className="space-y-5">
              <div>
                <p className="mb-2 text-xs font-medium text-navy-600">
                  {t("languageHint")}
                </p>
                <LanguageSwitcher syncProfile variant="panel" />
              </div>
              <div>
                <label
                  htmlFor="settings-timezone"
                  className="mb-1 block text-xs font-medium text-navy-600"
                >
                  {t("timezone")}
                </label>
                <p className="mb-2 text-[11px] text-navy-600">{t("timezoneHint")}</p>
                <select
                  id="settings-timezone"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full rounded-lg border border-navy-200 px-3 py-2 text-sm focus:border-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-between gap-4 rounded-lg border border-navy-100 bg-navy-50/40 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-navy-800">
                    {t("emailNotifications")}
                  </p>
                  <p className="text-xs text-navy-500">{t("emailNotificationsHint")}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={emailNotifications}
                  onClick={() => setEmailNotifications((v) => !v)}
                  className={`relative h-7 w-12 shrink-0 rounded-full transition ${
                    emailNotifications ? "bg-navy-800" : "bg-navy-200"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${
                      emailNotifications ? "start-5" : "start-0.5"
                    }`}
                  />
                </button>
              </div>
            </div>
          </section>

          {message === "ok" && (
            <p className="text-sm font-medium text-emerald-700">{t("saved")}</p>
          )}
          {message === "err" && (
            <p className="text-sm font-medium text-red-600">{t("saveError")}</p>
          )}

          <button
            type="submit"
            disabled={saving || !user}
            className="rounded-lg bg-navy-800 px-6 py-2.5 text-sm font-semibold text-gold-300 transition hover:bg-navy-900 disabled:opacity-50"
          >
            {saving ? t("saving") : t("save")}
          </button>
        </form>
      </div>
    </AuthGuard>
  );
}
