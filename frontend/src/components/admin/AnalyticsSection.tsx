"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fetchAdminAnalytics, type Analytics } from "@/lib/admin-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const PIE_COLORS = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#64748b"];

export default function AnalyticsSection() {
  const [data, setData] = useState<Analytics | null>(null);

  useEffect(() => {
    fetchAdminAnalytics().then(setData).catch(() => setData(null));
  }, []);

  if (!data) {
    return <p className="text-sm text-slate-500">Chargement des analytics…</p>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Plans créés par mois</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.plansPerMonth}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Répartition par état</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data.stateDistribution}
                dataKey="count"
                nameKey="state"
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                label={({ state, count }) => `${state} (${count})`}
              >
                {data.stateDistribution.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Durée moyenne par état (jours)</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.avgTimePerState}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="state" tick={{ fontSize: 10 }} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="avgDays" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Charge experts</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.expertWorkload} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="expert_email"
                width={120}
                tick={{ fontSize: 10 }}
              />
              <Tooltip />
              <Bar dataKey="plans_count" fill="#059669" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {data.emailDelivery && (
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Emails transactionnels</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <div className="rounded-lg bg-slate-50 p-3 text-center">
                <p className="text-2xl font-semibold text-slate-900">{data.emailDelivery.sent}</p>
                <p className="text-xs text-slate-500">Envoyés</p>
              </div>
              <div className="rounded-lg bg-amber-50 p-3 text-center">
                <p className="text-2xl font-semibold text-amber-800">{data.emailDelivery.pending}</p>
                <p className="text-xs text-slate-500">En file</p>
              </div>
              <div className="rounded-lg bg-red-50 p-3 text-center">
                <p className="text-2xl font-semibold text-red-700">{data.emailDelivery.failed}</p>
                <p className="text-xs text-slate-500">Échecs</p>
              </div>
              <div className="rounded-lg bg-emerald-50 p-3 text-center">
                <p className="text-2xl font-semibold text-emerald-800">{data.emailDelivery.opened}</p>
                <p className="text-xs text-slate-500">Ouverts</p>
              </div>
              <div className="rounded-lg bg-violet-50 p-3 text-center">
                <p className="text-2xl font-semibold text-violet-800">
                  {data.emailDelivery.openRatePct}%
                </p>
                <p className="text-xs text-slate-500">Taux d&apos;ouverture</p>
              </div>
            </div>
            {data.emailDelivery.byType.length > 0 && (
              <ul className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">
                {data.emailDelivery.byType.map((row) => (
                  <li
                    key={row.type}
                    className="rounded-full border border-slate-200 bg-white px-2 py-1"
                  >
                    {row.type}: {row.count}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="lg:col-span-2">
        <CardContent className="py-4 text-center text-sm text-slate-600">
          Total plans : <strong>{data.totalPlans}</strong>
        </CardContent>
      </Card>
    </div>
  );
}
