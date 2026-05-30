"use client";

import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import type { AuditResult } from "@/lib/api";
import { formatIrrRate } from "@/lib/simulation-format";
import { useFormat } from "@/hooks/useFormat";

const CHECK_KEYS = [
  "balanceSheetBalanced",
  "positiveTreasuryHorizon",
  "bfrCoherent",
  "investmentDefined",
  "financingBalanced",
] as const;

const CHECK_I18N: Record<(typeof CHECK_KEYS)[number], string> = {
  balanceSheetBalanced: "checkBalanceSheet",
  positiveTreasuryHorizon: "checkTreasury",
  bfrCoherent: "checkBfr",
  investmentDefined: "checkInvestment",
  financingBalanced: "checkFinancing",
};

type Props = {
  audit: AuditResult;
  onClose?: () => void;
  showValidateWithReserves?: boolean;
  onValidateWithReserves?: () => void | Promise<void>;
  validateWithReservesBusy?: boolean;
};

export default function FinancialAuditPanel({
  audit,
  onClose,
  showValidateWithReserves,
  onValidateWithReserves,
  validateWithReservesBusy,
}: Props) {
  const t = useTranslations("audit");
  const tCommon = useTranslations("common");
  const { formatNumber, locale } = useFormat();
  const ind = audit.indicators;

  const decisionMeta = {
    VALIDATE: {
      label: t("decisionValidate"),
      className: "border-emerald-200 bg-emerald-50 text-emerald-900",
      Icon: CheckCircle2,
    },
    NEEDS_ADJUSTMENT: {
      label: t("decisionAdjust"),
      className: "border-amber-200 bg-amber-50 text-amber-900",
      Icon: AlertTriangle,
    },
    REJECT: {
      label: t("decisionReject"),
      className: "border-red-200 bg-red-50 text-red-900",
      Icon: XCircle,
    },
  } as const;

  const meta =
    decisionMeta[audit.decision as keyof typeof decisionMeta] ??
    decisionMeta.NEEDS_ADJUSTMENT;
  const { Icon } = meta;

  return (
    <div id="financial-audit-panel" className="card mt-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-semibold ${meta.className}`}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            {meta.label}
          </span>
          <span className="text-xs text-navy-500">{t("subtitle")}</span>
        </div>
        {onClose && (
          <button type="button" className="btn btn-secondary text-sm" onClick={onClose}>
            {tCommon("close")}
          </button>
        )}
      </div>

      {ind && (
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-navy-50/80 px-3 py-2">
            <dt className="text-xs text-navy-500">{t("vanRef")}</dt>
            <dd className="font-semibold tabular-nums text-navy-900">
              {formatNumber(ind.van ?? 0, { maximumFractionDigits: 0 })}{" "}
              {tCommon("currencyTnd")}
            </dd>
          </div>
          <div className="rounded-lg bg-navy-50/80 px-3 py-2">
            <dt className="text-xs text-navy-500">{t("tri")}</dt>
            <dd className="font-semibold tabular-nums text-navy-900">
              {formatIrrRate(ind.tri ?? null, locale)}
            </dd>
          </div>
          <div className="rounded-lg bg-navy-50/80 px-3 py-2">
            <dt className="text-xs text-navy-500">{t("drci")}</dt>
            <dd className="font-semibold tabular-nums text-navy-900">
              {ind.drciYears != null && ind.drciYears > 0
                ? `${ind.drciYears.toFixed(1)} ${tCommon("years")}`
                : tCommon("na")}
            </dd>
          </div>
        </dl>
      )}

      <div>
        <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-navy-600">
          {t("checksTitle")}
        </h4>
        <ul className="grid gap-2 sm:grid-cols-2">
          {CHECK_KEYS.map((key) => {
            const ok = audit.checks[key];
            return (
              <li
                key={key}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                  ok
                    ? "border-emerald-100 bg-emerald-50/50 text-emerald-900"
                    : "border-red-100 bg-red-50/50 text-red-900"
                }`}
              >
                {ok ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                ) : (
                  <XCircle className="h-4 w-4 shrink-0 text-red-600" />
                )}
                {t(CHECK_I18N[key])}
              </li>
            );
          })}
        </ul>
      </div>

      {audit.recommendations.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-navy-600">
            {t("recommendationsTitle")}
          </h4>
          <ul className="list-inside list-disc space-y-1 text-sm text-navy-700">
            {audit.recommendations.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-navy-500">{t("footnote")}</p>

      {showValidateWithReserves && onValidateWithReserves && (
        <div className="flex flex-wrap gap-2 border-t border-navy-100 pt-4">
          <button
            type="button"
            className="btn btn-primary text-sm"
            disabled={validateWithReservesBusy}
            onClick={() => void onValidateWithReserves()}
          >
            {t("validateWithReserves")}
          </button>
          <p className="w-full text-xs text-navy-600">{t("validateWithReservesHint")}</p>
        </div>
      )}
    </div>
  );
}
