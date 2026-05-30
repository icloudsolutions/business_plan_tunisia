"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { UserGroupIcon } from "@heroicons/react/24/outline";
import { Download, Mail, Search, UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import EmptyState from "@/components/ui/EmptyState";
import {
  bulkResetPassword,
  createAdminUser,
  downloadUsersCsv,
  listAdminUsers,
  patchAdminUser,
  type AdminUser,
} from "@/lib/admin-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import LegacyExpertSection from "@/components/admin/LegacyExpertSection";

const ROLES = ["client", "expert", "admin"] as const;

export default function UsersSection() {
  const tAdmin = useTranslations("admin");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"client" | "expert">("client");

  const load = useCallback(async () => {
    setError("");
    try {
      setUsers(await listAdminUsers());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        (u.display_name ?? "").toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
    );
  }, [users, search]);

  const allSelected = useMemo(
    () =>
      filteredUsers.length > 0 && selected.size === filteredUsers.length,
    [filteredUsers, selected]
  );

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(filteredUsers.map((u) => u.id)));
  };

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createAdminUser(email, password, role);
      setEmail("");
      setPassword("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => void downloadUsersCsv()}>
          <Download className="me-2 h-4 w-4" />
          Export CSV
        </Button>
        <Button
          variant="outline"
          disabled={selected.size === 0}
          onClick={async () => {
            await bulkResetPassword([...selected]);
            setSelected(new Set());
            alert("Emails de réinitialisation envoyés (journal API).");
          }}
        >
          <Mail className="me-2 h-4 w-4" />
          Réinitialiser MDP ({selected.size})
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Nouvel utilisateur
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label htmlFor="admin-new-email" className="text-sm font-medium text-slate-700">
                  Email
                </label>
                <input
                  id="admin-new-email"
                  type="email"
                  autoComplete="email"
                  className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div>
                <label htmlFor="admin-new-password" className="text-sm font-medium text-slate-700">
                  Mot de passe
                </label>
                <input
                  id="admin-new-password"
                  type="password"
                  autoComplete="new-password"
                  className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  required
                />
                <p className="mt-0.5 text-xs text-slate-600">8 caractères minimum</p>
              </div>
              <div>
                <label htmlFor="admin-new-role" className="text-sm font-medium text-slate-700">
                  Rôle
                </label>
                <select
                  id="admin-new-role"
                  className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                  value={role}
                  onChange={(e) => setRole(e.target.value as "client" | "expert")}
                >
                <option value="client">Client</option>
                <option value="expert">Expert</option>
                </select>
              </div>
              <Button type="submit" className="w-full">
                Créer
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="space-y-3">
            <CardTitle>Utilisateurs ({users.length})</CardTitle>
            <div className="relative max-w-md">
              <label htmlFor="admin-users-search" className="text-sm font-medium text-slate-700">
                {tAdmin("usersSearchPlaceholder")}
              </label>
              <Search
                className="pointer-events-none absolute start-3 top-[2.15rem] h-4 w-4 -translate-y-1/2 text-slate-600"
                aria-hidden
              />
              <input
                id="admin-users-search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-200 py-2 ps-9 pe-3 text-sm"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <p className="px-6 py-8 text-sm text-slate-500">Chargement…</p>
            ) : search.trim() && filteredUsers.length === 0 ? (
              <EmptyState
                icon={<UserGroupIcon />}
                title={tAdmin("usersSearchEmptyTitle")}
                description={tAdmin("usersSearchEmptyDescription")}
              />
            ) : users.length === 0 ? (
              <EmptyState
                icon={<UserGroupIcon />}
                title={tAdmin("usersEmptyTitle")}
                description={tAdmin("usersEmptyDescription")}
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleAll}
                        aria-label="Tout sélectionner"
                      />
                    </TableHead>
                    <TableHead>Nom</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Rôle</TableHead>
                    <TableHead>Plans</TableHead>
                    <TableHead>Dernière activité</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selected.has(u.id)}
                          onChange={() => toggleOne(u.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {u.display_name || "—"}
                      </TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell>
                        <select
                          className="rounded border border-slate-200 px-2 py-1 text-xs"
                          value={u.role}
                          onChange={async (e) => {
                            await patchAdminUser(u.id, { role: e.target.value });
                            await load();
                          }}
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      </TableCell>
                      <TableCell className="tabular-nums">{u.plans_count}</TableCell>
                      <TableCell className="text-xs text-slate-500">
                        {u.last_active_at
                          ? new Date(u.last_active_at).toLocaleString("fr-TN")
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <button
                          type="button"
                          onClick={async () => {
                            const next =
                              u.status === "active" ? "suspended" : "active";
                            await patchAdminUser(u.id, { status: next });
                            await load();
                          }}
                        >
                          <Badge
                            variant={u.status === "active" ? "success" : "destructive"}
                          >
                            {u.status === "active" ? "Actif" : "Suspendu"}
                          </Badge>
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <LegacyExpertSection onExpertCreated={() => void load()} />
    </div>
  );
}
