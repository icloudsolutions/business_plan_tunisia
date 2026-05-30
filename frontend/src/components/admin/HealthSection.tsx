"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, Database, Server } from "lucide-react";
import { fetchAdminLogs, fetchSystemHealth, type SystemHealth } from "@/lib/admin-api";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function HealthSection() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [apiHealth, setApiHealth] = useState<Record<string, string> | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    const [h, a, l] = await Promise.all([
      fetchSystemHealth(),
      api<Record<string, string>>("/health"),
      fetchAdminLogs(20),
    ]);
    setHealth(h);
    setApiHealth(a);
    setLogs(l.lines);
  }, []);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 30_000);
    return () => clearInterval(id);
  }, [refresh]);

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button variant="outline" onClick={() => void refresh()}>
          Actualiser
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Server className="h-4 w-4" />
              API
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={apiHealth?.status === "ok" ? "success" : "destructive"}>
              {apiHealth?.status ?? "—"}
            </Badge>
            <p className="mt-2 text-xs text-slate-500">
              {apiHealth?.service} v{apiHealth?.version}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Activity className="h-4 w-4" />
              Files Celery (Redis)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-xs">
            {health &&
              Object.entries(health.celery_queues).map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-slate-600">{k}</span>
                  <span className="font-mono font-medium">{v}</span>
                </div>
              ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Database className="h-4 w-4" />
              PostgreSQL
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold tabular-nums">
              {health?.postgres_human ?? "—"}
            </p>
            <p className="text-xs text-slate-500">
              {health?.postgres_bytes?.toLocaleString()} octets
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Journal API (20 dernières lignes)</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="max-h-80 overflow-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-200">
            {logs.length ? logs.join("\n") : "Aucun log WARNING+ en mémoire"}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
