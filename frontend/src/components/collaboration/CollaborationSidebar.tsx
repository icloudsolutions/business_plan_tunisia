"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  MessageSquare,
  Radio,
  RefreshCw,
  Send,
  X,
  XCircle,
} from "lucide-react";
import RoleGate from "@/components/auth/RoleGate";
import { useAuth } from "@/context/AuthContext";
import { userHasRole } from "@/lib/auth-roles";
import { useCollaboration } from "@/context/CollaborationContext";
import {
  WIZARD_SECTIONS,
  type PlanComment,
  type SectionId,
} from "@/lib/collaboration";
import { transitionPlan } from "@/lib/api";

type Props = {
  planId: string;
  planStatus: string;
  onPlanUpdated: () => void;
};

function formatTime(iso?: string) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("fr-TN", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function ThreadBlock({
  thread,
  onReply,
  onResolve,
  canResolve,
}: {
  thread: PlanComment[];
  onReply: (parentId: string, text: string) => void | Promise<void>;
  onResolve: (rootId: string) => void;
  canResolve: boolean;
}) {
  const root = thread[0];
  const replies = thread.slice(1);
  const [replyText, setReplyText] = useState("");
  const collapsed = root.resolved;

  if (collapsed) {
    return (
      <details className="rounded-lg border border-navy-100 bg-navy-50/50 px-3 py-2 text-xs">
        <summary className="cursor-pointer text-navy-600">
          Résolu — {root.content.slice(0, 60)}
          {root.content.length > 60 ? "…" : ""}
        </summary>
        <p className="mt-2 text-navy-700">{root.content}</p>
      </details>
    );
  }

  return (
    <div className="rounded-lg border border-orange-200 bg-orange-50/60 p-3 text-sm">
      <p className="font-medium text-navy-900">{root.content}</p>
      <p className="mt-1 text-[10px] text-navy-500">
        {root.user_email} · {formatTime(root.created_at)}
      </p>
      {replies.map((r) => (
        <div key={r.id} className="mt-2 border-s-2 border-orange-300 ps-3 text-xs text-navy-800">
          <p>{r.content}</p>
          <p className="text-[10px] text-navy-500">
            {r.user_email} · {formatTime(r.created_at)}
          </p>
        </div>
      ))}
      <div className="mt-2 flex gap-2">
        <input
          className="min-w-0 flex-1 rounded border border-orange-200 bg-white px-2 py-1 text-xs"
          placeholder="Répondre…"
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
        />
        <button
          type="button"
          className="rounded bg-navy-800 p-1.5 text-white"
          onClick={() => {
            if (!replyText.trim()) return;
            void onReply(root.id, replyText.trim());
            setReplyText("");
          }}
          aria-label="Envoyer le commentaire"
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </div>
      {canResolve && (
        <button
          type="button"
          className="mt-2 flex items-center gap-1 text-xs font-medium text-emerald-700 hover:underline"
          onClick={() => onResolve(root.id)}
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          Marquer résolu
        </button>
      )}
    </div>
  );
}

export default function CollaborationSidebar({
  planId,
  planStatus,
  onPlanUpdated,
}: Props) {
  const { user } = useAuth();
  const isExpert = userHasRole(user?.role, ["expert", "admin"]);
  const collab = useCollaboration();
  const [tab, setTab] = useState<"comments" | "activity">("comments");
  const [globalMessage, setGlobalMessage] = useState("");
  const [newComment, setNewComment] = useState("");
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const fieldKey = collab?.activeFieldKey ?? "_global";
  const fieldThreads = useMemo(
    () => (collab ? collab.threadsForField(fieldKey) : []),
    [collab, fieldKey]
  );

  if (!collab?.enabled) return null;

  const reviewBySection = new Map(
    collab.sectionReviews.map((r) => [r.section_key, r.status])
  );

  const handleRequestAdjustment = async () => {
    setBusy(true);
    try {
      await transitionPlan(planId, "NEEDS_ADJUSTMENT", globalMessage.trim() || undefined);
      setAdjustOpen(false);
      setGlobalMessage("");
      onPlanUpdated();
      await collab.refresh();
    } finally {
      setBusy(false);
    }
  };

  const groupedThreads = useMemo(() => {
    const map = new Map<string, PlanComment[][]>();
    for (const c of collab.comments.filter((x) => !x.parent_id)) {
      const list = map.get(c.field_key) ?? [];
      const thread = collab.threadsForField(c.field_key).find((t) => t[0]?.id === c.id);
      if (thread) list.push(thread);
      map.set(c.field_key, list);
    }
    return map;
  }, [collab]);

  return (
    <aside className="flex h-full min-h-[480px] w-full flex-col border-l border-navy-100 bg-white lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:w-80 xl:w-96">
      <div className="border-b border-navy-100 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-display text-sm font-semibold text-navy-900">
            Collaboration
          </h3>
          <span
            className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
              collab.connected
                ? "bg-emerald-50 text-emerald-800"
                : "bg-amber-50 text-amber-800"
            }`}
            title={collab.usingPoll ? "Synchronisation par polling (10 s)" : "Temps réel"}
          >
            <Radio className="h-3 w-3" />
            {collab.connected ? "Live" : "Sync 10s"}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-navy-500">Statut : {planStatus}</p>
      </div>

      <RoleGate role={["expert", "admin"]}>
        <div className="border-b border-navy-100 px-3 py-2">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-navy-500">
            Annotation par section
          </p>
          <div className="space-y-1.5">
            {WIZARD_SECTIONS.map((s) => {
              const status = reviewBySection.get(s.id);
              return (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-1 rounded-lg bg-navy-50/80 px-2 py-1.5"
                >
                  <span className="truncate text-[11px] font-medium text-navy-800">
                    {s.label}
                  </span>
                  <div className="flex shrink-0 gap-0.5">
                    {(
                      [
                        ["approve", Check, "text-emerald-600 bg-emerald-50"],
                        ["flag", AlertTriangle, "text-amber-700 bg-amber-50"],
                        ["reject", XCircle, "text-red-700 bg-red-50"],
                      ] as const
                    ).map(([st, Icon, cls]) => (
                      <button
                        key={st}
                        type="button"
                        title={st}
                        className={`rounded p-1 ${status === st ? cls + " ring-1 ring-current" : "text-navy-400 hover:bg-white"}`}
                        onClick={() =>
                          collab.setSectionReview(s.id as SectionId, st)
                        }
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </RoleGate>

      <RoleGate role={["expert", "admin"]}>
        <div className="border-b border-navy-100 px-3 py-2">
          {!adjustOpen ? (
            <button
              type="button"
              className="w-full rounded-lg border border-amber-300 bg-amber-50 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100"
              onClick={() => setAdjustOpen(true)}
            >
              Demander un ajustement
            </button>
          ) : (
            <div className="space-y-2">
              <textarea
                className="w-full rounded-lg border border-navy-200 px-2 py-1.5 text-xs"
                rows={3}
                placeholder="Message global pour le client (optionnel)…"
                value={globalMessage}
                onChange={(e) => setGlobalMessage(e.target.value)}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  className="flex-1 rounded-lg bg-amber-600 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                  onClick={handleRequestAdjustment}
                >
                  Confirmer
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-navy-200 px-2 py-1.5 text-xs"
                  onClick={() => setAdjustOpen(false)}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </RoleGate>

      <div className="flex border-b border-navy-100 text-xs font-medium">
        <button
          type="button"
          className={`flex-1 py-2 ${tab === "comments" ? "border-b-2 border-gold-500 text-navy-900" : "text-navy-500"}`}
          onClick={() => setTab("comments")}
        >
          <MessageSquare className="me-1 inline h-3.5 w-3.5" />
          Fil
        </button>
        <button
          type="button"
          className={`flex-1 py-2 ${tab === "activity" ? "border-b-2 border-gold-500 text-navy-900" : "text-navy-500"}`}
          onClick={() => setTab("activity")}
        >
          <RefreshCw className="me-1 inline h-3.5 w-3.5" />
          Activité
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        {tab === "comments" ? (
          <div className="space-y-4">
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase text-navy-500">
                Champ sélectionné
              </p>
              <p className="mb-2 truncate rounded bg-gold-50 px-2 py-1 font-mono text-[11px] text-navy-800">
                {fieldKey === "_global" ? "Message global" : fieldKey}
              </p>
              {fieldThreads.map((thread) => (
                <ThreadBlock
                  key={thread[0].id}
                  thread={thread}
                  onReply={(parentId, text) =>
                    collab.addComment(fieldKey, text, parentId)
                  }
                  onResolve={collab.resolveThread}
                  canResolve
                />
              ))}
              <div className="mt-2 flex gap-2">
                <input
                  className="min-w-0 flex-1 rounded-lg border border-navy-200 px-2 py-1.5 text-xs"
                  placeholder={
                    isExpert
                      ? "Commentaire expert sur ce champ…"
                      : "Votre réponse…"
                  }
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                />
                <button
                  type="button"
                  className="rounded-lg bg-navy-800 px-2 text-white"
                  onClick={async () => {
                    if (!newComment.trim()) return;
                    await collab.addComment(fieldKey, newComment.trim());
                    setNewComment("");
                  }}
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase text-navy-500">
                Tous les fils
              </p>
              <div className="space-y-2">
                {[...groupedThreads.entries()].map(([fk, list]) =>
                  list.map((thread) => (
                    <button
                      key={thread[0].id}
                      type="button"
                      className="block w-full rounded-lg border border-navy-100 px-2 py-2 text-start text-xs hover:border-orange-300"
                      onClick={() => collab.setActiveFieldKey(fk)}
                    >
                      <span className="font-mono text-[10px] text-navy-500">{fk}</span>
                      <p className="mt-0.5 line-clamp-2 text-navy-800">{thread[0].content}</p>
                    </button>
                  ))
                )}
                {collab.comments.length === 0 && (
                  <p className="text-xs text-navy-500">Aucun commentaire pour l&apos;instant.</p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <ul className="space-y-2">
            {collab.activity.map((item, i) => (
              <li
                key={`${item.created_at}-${i}`}
                className="rounded-lg border border-navy-50 bg-navy-50/50 px-2 py-2 text-xs"
              >
                <p className="text-navy-800">{item.message}</p>
                <p className="mt-0.5 text-[10px] text-navy-500">
                  {item.user_email ?? "Système"} · {formatTime(item.created_at)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {collab.presence.length > 0 && (
        <div className="border-t border-navy-100 px-3 py-2 text-[10px] text-navy-600">
          <span className="font-semibold">En ligne :</span>{" "}
          {collab.presence
            .filter((p) => p.user_id !== user?.id)
            .map((p) => p.email)
            .join(", ") || "—"}
        </div>
      )}
    </aside>
  );
}
