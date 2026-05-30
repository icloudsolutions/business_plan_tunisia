"use client";

import { useEffect, useState } from "react";
import { Send } from "lucide-react";
import {
  listAdminUsers,
  listNotificationTemplates,
  sendAdminNotification,
  type AdminUser,
  type NotificationTemplate,
} from "@/lib/admin-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function NotificationsSection() {
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [templateKey, setTemplateKey] = useState("action_required");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [channel, setChannel] = useState<"in_app" | "email" | "both">("both");
  const [target, setTarget] = useState<"user" | "role">("role");
  const [userId, setUserId] = useState("");
  const [roleTarget, setRoleTarget] = useState<"client" | "expert" | "admin">("client");
  const [sent, setSent] = useState<number | null>(null);

  useEffect(() => {
    listNotificationTemplates().then(setTemplates);
    listAdminUsers().then(setUsers);
  }, []);

  useEffect(() => {
    const t = templates.find((x) => x.key === templateKey);
    if (t) {
      setTitle(t.title);
      setBody(t.body);
    }
  }, [templateKey, templates]);

  const handleSend = async () => {
    const res = await sendAdminNotification({
      title,
      body,
      channel,
      template_key: templateKey,
      user_id: target === "user" ? userId : undefined,
      role_target: target === "role" ? roleTarget : undefined,
    });
    setSent(res.sent);
  };

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="h-4 w-4" />
          Centre de notifications
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-xs font-medium text-slate-600">Modèle</label>
          <select
            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            value={templateKey}
            onChange={(e) => setTemplateKey(e.target.value)}
          >
            {templates.map((t) => (
              <option key={t.key} value={t.key}>
                {t.key}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              checked={target === "role"}
              onChange={() => setTarget("role")}
            />
            Par rôle
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              checked={target === "user"}
              onChange={() => setTarget("user")}
            />
            Utilisateur
          </label>
        </div>

        {target === "role" ? (
          <select
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            value={roleTarget}
            onChange={(e) =>
              setRoleTarget(e.target.value as "client" | "expert" | "admin")
            }
          >
            <option value="client">Tous les clients</option>
            <option value="expert">Tous les experts</option>
            <option value="admin">Administrateurs</option>
          </select>
        ) : (
          <select
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
          >
            <option value="">Choisir…</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.email}
              </option>
            ))}
          </select>
        )}

        <select
          className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
          value={channel}
          onChange={(e) => setChannel(e.target.value as typeof channel)}
        >
          <option value="in_app">In-app uniquement</option>
          <option value="email">Email uniquement</option>
          <option value="both">In-app + email</option>
        </select>

        <input
          className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Titre"
        />
        <textarea
          className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
          rows={5}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Message"
        />

        <Button onClick={() => void handleSend()}>Envoyer</Button>
        {sent != null && (
          <p className="text-sm text-emerald-700">{sent} notification(s) envoyée(s).</p>
        )}
      </CardContent>
    </Card>
  );
}
