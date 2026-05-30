"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Mail, UserPlus } from "lucide-react";
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

const ROLES = ["client", "expert", "admin"] as const;

export default function UsersSection() {
  const [users, setUsers] = useState<AdminUser[]>([]);
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

  const allSelected = useMemo(
    () => users.length > 0 && selected.size === users.length,
    [users, selected]
  );

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(users.map((u) => u.id)));
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
          <Download className="mr-2 h-4 w-4" />
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
          <Mail className="mr-2 h-4 w-4" />
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
              <input
                type="email"
                placeholder="Email"
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <input
                type="password"
                placeholder="Mot de passe (8+)"
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
              <select
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                value={role}
                onChange={(e) => setRole(e.target.value as "client" | "expert")}
              >
                <option value="client">Client</option>
                <option value="expert">Expert</option>
              </select>
              <Button type="submit" className="w-full">
                Créer
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Utilisateurs ({users.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <p className="px-6 py-8 text-sm text-slate-500">Chargement…</p>
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
                  {users.map((u) => (
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
    </div>
  );
}
