"use client";

import { Link } from "@/i18n/navigation";
import {
  BarChart3,
  Factory,
  LayoutDashboard,
  Menu,
  PieChart,
  Users,
  X,
  ChevronRight,
  LogOut,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useFinance } from "@/context/FinanceContext";
import type { FinanceTab } from "@/lib/finance/types";

const NAV: { id: FinanceTab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Vue d'ensemble", icon: LayoutDashboard },
  { id: "production", label: "Coûts production", icon: Factory },
  { id: "payroll", label: "Masse salariale", icon: Users },
  { id: "distribution", label: "Répartition salaires", icon: PieChart },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, logout } = useAuth();
  const { activeTab, setActiveTab } = useFinance();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const activeLabel = NAV.find((n) => n.id === activeTab)?.label ?? "";

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Fermer le menu"
          className="fixed inset-0 z-40 bg-slate-900/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 start-0 z-50 flex w-72 flex-col border-s border-slate-200 bg-white transition-transform lg:static lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-slate-100 px-5">
          <Link href="/finance" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-brand-600 to-brand-700 text-sm font-bold text-white">
              BP
            </span>
            <div>
              <p className="text-sm font-semibold leading-tight">Cockpit Coûts</p>
              <p className="text-[10px] text-slate-500">Production & RH</p>
            </div>
          </Link>
          <button
            type="button"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setActiveTab(id);
                setSidebarOpen(false);
              }}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                activeTab === id
                  ? "bg-brand-50 text-brand-700"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </button>
          ))}
          <div className="my-3 border-t border-slate-100" />
          <Link
            href="/"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            <BarChart3 className="h-4 w-4" />
            Business Plans TIA
          </Link>
        </nav>

        <div className="border-t border-slate-100 p-4">
          <p className="truncate text-xs text-slate-500">{user?.email}</p>
          <button
            type="button"
            onClick={logout}
            className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            <LogOut className="h-4 w-4" />
            Déconnexion
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur-md sm:px-6">
          <button
            type="button"
            className="rounded-lg border border-slate-200 p-2 text-slate-600 lg:hidden"
            onClick={() => setSidebarOpen(true)}
            aria-label="Ouvrir le menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
              Gestion financière
            </p>
            <h1 className="truncate text-lg font-semibold text-slate-900">
              {activeLabel}
            </h1>
          </div>
          <div className="hidden items-center gap-1 text-sm text-slate-500 sm:flex">
            <Link href="/finance" className="hover:text-brand-600">
              Cockpit
            </Link>
            <ChevronRight className="h-4 w-4" />
            <span className="text-slate-800">{activeLabel}</span>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
