"use client";

import { Link } from "@/i18n/navigation";
import { usePathname } from "next/navigation";
import LanguageToggle from "@/components/LanguageToggle";
import RoleGate from "@/components/auth/RoleGate";
import { useAuth } from "@/context/AuthContext";

const ROLE_LABELS: Record<string, string> = {
  client: "Entrepreneur",
  expert: "Expert",
  admin: "Administrateur",
};

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const isFinance = pathname.startsWith("/finance");
  const showNav = user && !pathname.startsWith("/login");

  if (!showNav || isFinance) {
    return <>{children}</>;
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="header-inner">
          <Link href="/" className="brand">
            <span className="brand-icon">BP</span>
            <span className="brand-text">
              <strong>Business Plan</strong>
              <small>Tunisie · TIA</small>
            </span>
          </Link>

          <button
            type="button"
            className="nav-toggle"
            aria-label="Menu"
            onClick={() => document.body.classList.toggle("nav-open")}
          />

          <nav className="app-nav">
            <LanguageToggle className="me-2 shrink-0" />
            <Link
              href="/"
              className={pathname === "/" ? "nav-link active" : "nav-link"}
            >
              Business Plans
            </Link>
            <Link
              href="/finance"
              prefetch={false}
              className={pathname.startsWith("/finance") ? "nav-link active" : "nav-link"}
            >
              Cockpit coûts
            </Link>
            <RoleGate role={["admin"]}>
              <Link
                href="/admin"
                className={pathname.startsWith("/admin") ? "nav-link active" : "nav-link"}
              >
                Administration
              </Link>
            </RoleGate>
          </nav>

          <div className="header-user">
            <div className="user-meta">
              <span className="user-email">{user.email}</span>
              <span className={`role-badge role-${user.role}`}>
                {ROLE_LABELS[user.role] || user.role}
              </span>
            </div>
            <button type="button" className="btn btn-ghost" onClick={logout}>
              Déconnexion
            </button>
          </div>
        </div>
      </header>
      <main className="app-main">{children}</main>
      <footer className="app-footer">
        <p>Liasse Unique · Projection 7 ans · Conformité TIA</p>
      </footer>
    </div>
  );
}
