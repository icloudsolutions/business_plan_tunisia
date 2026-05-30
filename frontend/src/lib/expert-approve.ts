import {
  auditPlan,
  transitionPlan,
  type AuditResult,
  type Plan,
} from "@/lib/api";
import { isApiHttpError, parseAuditFromApiError } from "@/lib/api-errors";

export type ExpertApproveOutcome =
  | { ok: true; plan: Plan }
  | { ok: false; audit: AuditResult; message: string };

export async function runExpertApprove(
  planId: string,
  options?: { acknowledgeWarnings?: boolean }
): Promise<ExpertApproveOutcome> {
  let audit: AuditResult;
  try {
    audit = await auditPlan(planId);
  } catch (e) {
    const fromApi = parseAuditFromApiError(e);
    if (fromApi) {
      return { ok: false, audit: fromApi, message: "" };
    }
    throw e;
  }

  if (audit.decision === "VALIDATE") {
    const plan = await transitionPlan(planId, "VALIDATE");
    return { ok: true, plan };
  }

  if (
    options?.acknowledgeWarnings &&
    audit.decision === "NEEDS_ADJUSTMENT"
  ) {
    try {
      const plan = await transitionPlan(planId, "VALIDATE", undefined, {
        acknowledgeAuditWarnings: true,
      });
      return { ok: true, plan };
    } catch (e) {
      const fromApi = parseAuditFromApiError(e);
      if (fromApi) {
        return { ok: false, audit: fromApi, message: "" };
      }
      throw e;
    }
  }

  return { ok: false, audit, message: "" };
}

export function isExpertApproveBlocked(
  outcome: ExpertApproveOutcome
): outcome is { ok: false; audit: AuditResult; message: string } {
  return !outcome.ok;
}

export async function expertApproveOrThrow(
  planId: string,
  options?: { acknowledgeWarnings?: boolean }
): Promise<Plan> {
  const outcome = await runExpertApprove(planId, options);
  if (outcome.ok) return outcome.plan;
  const err = new Error("approve_blocked");
  (err as Error & { audit: AuditResult }).audit = outcome.audit;
  throw err;
}

export function auditFromApproveError(e: unknown): AuditResult | null {
  if (e && typeof e === "object" && "audit" in e) {
    return (e as { audit: AuditResult }).audit;
  }
  return parseAuditFromApiError(e);
}

export function isApproveBlockedError(e: unknown): boolean {
  return (
    (e instanceof Error && e.message === "approve_blocked") ||
    isApiHttpError(e, 400)
  );
}
