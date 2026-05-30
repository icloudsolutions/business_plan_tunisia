"use client";

import { Link } from "@/i18n/navigation";
import { LayoutDashboard, LogOut, Shield } from "lucide-react";
import AuthGuard from "@/components/AuthGuard";
import RoleGate from "@/components/auth/RoleGate";
import AnalyticsSection from "@/components/admin/AnalyticsSection";
import HealthSection from "@/components/admin/HealthSection";
import NotificationsSection from "@/components/admin/NotificationsSection";
import PlansSection from "@/components/admin/PlansSection";
import UsersSection from "@/components/admin/UsersSection";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/AuthContext";

function AdminPanel() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-amber-400">
              <Shield className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-lg font-semibold text-slate-900">Administration</h1>
              <p className="text-xs text-slate-500">Business Plan Tunisie</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="hidden items-center gap-1 text-sm text-slate-600 hover:text-slate-900 sm:flex"
            >
              <LayoutDashboard className="h-4 w-4" />
              Tableau de bord
            </Link>
            <span className="text-xs text-slate-500">{user?.email}</span>
            <button
              type="button"
              onClick={logout}
              className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
              aria-label="Déconnexion"
            >
              <LogOut className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <Tabs defaultValue="users">
          <TabsList className="mb-2 flex-wrap">
            <TabsTrigger value="users">Utilisateurs</TabsTrigger>
            <TabsTrigger value="plans">Plans</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="health">Système</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <UsersSection />
          </TabsContent>
          <TabsContent value="plans">
            <PlansSection />
          </TabsContent>
          <TabsContent value="analytics">
            <AnalyticsSection />
          </TabsContent>
          <TabsContent value="health">
            <HealthSection />
          </TabsContent>
          <TabsContent value="notifications">
            <NotificationsSection />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

export default function AdminPage() {
  return (
    <AuthGuard>
      <RoleGate role={["admin"]} redirect="/">
        <AdminPanel />
      </RoleGate>
    </AuthGuard>
  );
}
