"use client";

import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/context/AuthContext";
import { DashboardNavProvider } from "@/context/DashboardNavContext";
import { ExportJobsProvider } from "@/context/ExportJobsContext";
import LocaleDirectionSync from "@/components/LocaleDirectionSync";
import { TooltipProvider } from "@/components/ui/tooltip";
import ClientShell from "@/components/dashboard/ClientShell";
import { LOCALE_STORAGE_KEY, type AppLocale } from "@/i18n/routing";

function LocaleStorageSync({ locale }: { locale: AppLocale }) {
  useEffect(() => {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  }, [locale]);
  return null;
}

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: 1,
      },
    },
  });
}

export default function Providers({
  children,
  locale,
}: {
  children: React.ReactNode;
  locale: AppLocale;
}) {
  const [queryClient] = useState(makeQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={200}>
      <AuthProvider>
        <LocaleStorageSync locale={locale} />
        <LocaleDirectionSync />
        <DashboardNavProvider>
          <ExportJobsProvider>
            <ClientShell>{children}</ClientShell>
          </ExportJobsProvider>
        </DashboardNavProvider>
      </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
