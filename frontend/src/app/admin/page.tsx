"use client";

import { useCallback, useEffect, useState } from "react";
import AuthGuard from "@/components/AuthGuard";
import { adminCreateUser, listUsers, type User } from "@/lib/api";

const ROLE_LABELS: Record<string, string> = {
  client: "Entrepreneur",
  expert: "Expert",
  admin: "Administrateur",
};

function AdminContent() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"client" | "expert">("client");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      setUsers(await listUsers());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError("");
    try {
      await adminCreateUser(email, password, role);
      setEmail("");
      setPassword("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Création impossible");
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <header className="page-header">
        <h1>Administration</h1>
        <p>Gestion des comptes entrepreneurs et experts</p>
      </header>

      {error && <p className="form-error">{error}</p>}

      <div className="admin-layout">
        <div className="card">
          <h2 className="card-title">Nouvel utilisateur</h2>
          <form onSubmit={handleCreate}>
            <div className="form-group">
              <label htmlFor="new-email">Email</label>
              <input
                id="new-email"
                type="email"
                className="form-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="new-password">Mot de passe (8+ caractères)</label>
              <input
                id="new-password"
                type="password"
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="new-role">Rôle</label>
              <select
                id="new-role"
                className="form-select"
                value={role}
                onChange={(e) => setRole(e.target.value as "client" | "expert")}
              >
                <option value="client">Entrepreneur (client)</option>
                <option value="expert">Expert</option>
              </select>
            </div>
            <button type="submit" className="btn btn-primary" disabled={creating}>
              {creating ? "Création…" : "Créer le compte"}
            </button>
          </form>
        </div>

        <div className="card">
          <h2 className="card-title">Utilisateurs ({users.length})</h2>
          {loading ? (
            <div className="loading-screen" style={{ minHeight: 120 }}>
              <div className="spinner" aria-hidden />
            </div>
          ) : users.length === 0 ? (
            <p className="empty-state">Aucun utilisateur</p>
          ) : (
            <div className="table-wrap users-table">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Rôle</th>
                    <th>Créé le</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td>{u.email}</td>
                      <td className="role-cell">
                        <span className={`role-badge role-${u.role}`}>
                          {ROLE_LABELS[u.role] || u.role}
                        </span>
                      </td>
                      <td>
                        {u.created_at
                          ? new Date(u.created_at).toLocaleDateString("fr-TN")
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function AdminPage() {
  return (
    <AuthGuard roles={["admin"]}>
      <AdminContent />
    </AuthGuard>
  );
}
