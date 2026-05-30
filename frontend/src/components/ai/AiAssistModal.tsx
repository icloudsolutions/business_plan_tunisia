"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Send, Sparkles, X } from "lucide-react";
import { acceptAiSuggestion, requestAiAssist, type ChatMessage } from "@/lib/ai-assist";
import { useLocale } from "next-intl";
import { metaFor } from "@/lib/liasse-wizard/field-meta";
import type { AppLocale } from "@/i18n/routing";

type Props = {
  open: boolean;
  onClose: () => void;
  planId: string;
  fieldKey: string;
  sector: string;
  companyType: "PME" | "GE";
  location: string;
  onApplyValue: (fieldKey: string, value: number | string) => void;
  readOnly?: boolean;
};

export default function AiAssistModal({
  open,
  onClose,
  planId,
  fieldKey,
  sector,
  companyType,
  location,
  onApplyValue,
  readOnly,
}: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastSuggestionId, setLastSuggestionId] = useState<string | null>(null);
  const [suggestedValue, setSuggestedValue] = useState<number | string | null>(null);
  const [benchmarks, setBenchmarks] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const locale = useLocale() as AppLocale;
  const meta = metaFor(fieldKey, fieldKey, locale);

  useEffect(() => {
    if (!open) return;
    setMessages([]);
    setInput("");
    setError("");
    setLastSuggestionId(null);
    setSuggestedValue(null);
    setBenchmarks(null);
    const starter =
      `Comment estimer « ${meta.label} » pour une activité en ${sector} (${companyType}) à ${location} ?`;
    setInput(starter);
  }, [open, fieldKey, meta.label, sector, companyType, location]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setError("");
    const userMsg: ChatMessage = { role: "user", content: text };
    const history = [...messages, userMsg];
    setMessages(history);
    setLoading(true);
    try {
      const res = await requestAiAssist(planId, {
        action: "field_assist",
        field_key: fieldKey,
        message: text,
        sector,
        company_type: companyType,
        location,
        chat_history: messages,
      });
      setMessages((m) => [...m, { role: "assistant", content: res.reply }]);
      setLastSuggestionId(res.suggestion_id ?? null);
      setSuggestedValue(res.suggested_value ?? null);
      setBenchmarks(res.benchmarks ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur IA");
    } finally {
      setLoading(false);
    }
  }, [
    input,
    loading,
    messages,
    planId,
    fieldKey,
    sector,
    companyType,
    location,
  ]);

  const apply = async () => {
    if (suggestedValue == null) return;
    onApplyValue(fieldKey, suggestedValue);
    if (lastSuggestionId) {
      await acceptAiSuggestion(planId, lastSuggestionId, true);
    }
    onClose();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-navy-900/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal
      aria-labelledby="ai-assist-title"
    >
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl border border-navy-100 bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b border-navy-100 px-5 py-4">
          <div>
            <h2
              id="ai-assist-title"
              className="flex items-center gap-2 font-display text-lg font-semibold text-navy-900"
            >
              <Sparkles className="h-5 w-5 text-gold-500" aria-hidden />
              Aide IA
            </h2>
            <p className="mt-0.5 text-sm text-navy-600">{meta.label}</p>
            <p className="text-xs text-navy-400">
              {sector} · {companyType} · {location}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-navy-500 hover:bg-navy-50"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {messages.length === 0 && (
            <p className="rounded-lg bg-gold-50/80 px-3 py-2 text-xs text-navy-700">
              Posez votre question : l&apos;assistant utilise votre liasse déjà saisie et
              des repères de PME tunisiennes pour proposer une valeur concrète.
            </p>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={`rounded-xl px-3 py-2 text-sm ${
                m.role === "user"
                  ? "ms-8 bg-navy-800 text-white"
                  : "me-4 bg-navy-50 text-navy-800"
              }`}
            >
              {m.content}
            </div>
          ))}
          {benchmarks && (
            <p className="rounded-lg border border-gold-200 bg-gold-50/50 px-3 py-2 text-xs text-navy-700">
              <strong>Repères marché :</strong> {benchmarks}
            </p>
          )}
          {loading && (
            <div className="flex items-center gap-2 text-sm text-navy-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Réflexion en cours…
            </div>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div ref={bottomRef} />
        </div>

        <footer className="space-y-3 border-t border-navy-100 px-5 py-4">
          {suggestedValue != null && !readOnly && (
            <button
              type="button"
              onClick={() => void apply()}
              className="w-full rounded-lg bg-gold-500 py-2.5 text-sm font-semibold text-navy-900 hover:bg-gold-400"
            >
              Appliquer cette valeur ({String(suggestedValue)})
            </button>
          )}
          <div className="flex gap-2">
            <textarea
              className="min-h-[44px] flex-1 resize-none rounded-lg border border-navy-200 px-3 py-2 text-sm"
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder="Votre question…"
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => void send()}
              disabled={loading || !input.trim()}
              className="rounded-lg bg-navy-800 px-3 text-white disabled:opacity-50"
              aria-label="Envoyer"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
