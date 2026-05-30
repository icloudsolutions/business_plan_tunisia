"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

const ROLE_LABELS: Record<string, string> = {
  client: "Entrepreneur",
  expert: "Expert",
  admin: "Administrateur",
};

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout, isAdmin } = useAuth();
  const pathname = usePathname();
  const showNav = user && !pathname.startsWith("/login");

  if (!showNav) {
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
            <Link
              href="/"
              className={pathname === "/" ? "nav-link active" : "nav-link"}
            >
              Tableau de bord
            </Link>
            {isAdmin && (
              <Link
                href="/admin"
                className={pathname.startsWith("/admin") ? "nav-link active" : "nav-link"}
              >
                Administration
              </Link>
            )}
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
