"use client";

import { useEffect } from "react";
import { AuthProvider } from "@/context/AuthContext";
import { DashboardNavProvider } from "@/context/DashboardNavContext";
import ClientShell from "@/components/dashboard/ClientShell";
import { LOCALE_STORAGE_KEY, type AppLocale } from "@/i18n/routing";

function LocaleStorageSync({ locale }: { locale: AppLocale }) {
  useEffect(() => {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  }, [locale]);
  return null;
}

export default function Providers({
  children,
  locale,
}: {
  children: React.ReactNode;
  locale: AppLocale;
}) {
  return (
    <AuthProvider>
      <LocaleStorageSync locale={locale} />
      <DashboardNavProvider>
        <ClientShell>{children}</ClientShell>
      </DashboardNavProvider>
    </AuthProvider>
  );
}
