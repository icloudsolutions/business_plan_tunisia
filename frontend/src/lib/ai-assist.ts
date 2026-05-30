import { api } from "./api";

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type AiAssistResponse = {
  reply: string;
  suggested_value?: number | string | null;
  benchmarks?: string | null;
  suggestion_id?: string | null;
  executive_summary?: string | null;
};

export async function requestAiAssist(
  planId: string,
  body: {
    action: "field_assist" | "executive_summary";
    field_key?: string;
    message?: string;
    sector?: string;
    company_type?: "PME" | "GE";
    location?: string;
    chat_history?: ChatMessage[];
  }
): Promise<AiAssistResponse> {
  return api(`/plans/${planId}/ai-assist`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function acceptAiSuggestion(
  planId: string,
  suggestionId: string,
  accepted = true
) {
  return api(`/plans/${planId}/ai-suggestions/${suggestionId}`, {
    method: "PATCH",
    body: JSON.stringify({ accepted }),
  });
}
