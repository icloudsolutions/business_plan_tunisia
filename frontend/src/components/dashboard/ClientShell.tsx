"use client";

import { usePathname } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import TunisianMeshBackground from "./TunisianMeshBackground";
import CompletionToastHost from "@/components/completion/CompletionToasts";
import DashboardTopNav from "./DashboardTopNav";

export default function ClientShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const tNav = useTranslations("nav");
  const isLogin = pathname === "/login" || pathname.startsWith("/login");
  const isFinance = pathname.startsWith("/finance");

  if (isLogin) {
    return <>{children}</>;
  }

  if (isFinance) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen font-sans text-navy-900">
      <TunisianMeshBackground />
      <DashboardTopNav />
      <CompletionToastHost />
      <main>{children}</main>
      <footer className="border-t border-navy-100/80 bg-white/60 py-6 text-center text-xs text-navy-500 backdrop-blur-sm">
        {tNav("footerTagline")}
      </footer>
    </div>
  );
}
