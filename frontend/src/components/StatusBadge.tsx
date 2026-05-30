"use client";

import { useTranslations } from "next-intl";

const STATUS_SYMBOL: Record<string, string> = {
  DRAFT: "●",
  UNDER_REVIEW: "●",
  ADJUSTMENT: "●",
  VALIDATED: "●",
};

export default function StatusBadge({ status }: { status: string }) {
  const t = useTranslations("status");
  const key = status.toLowerCase().replace(/_/g, "-");
  let label = status;
  try {
    label = t(status as "DRAFT");
  } catch {
    label = status;
  }
  const symbol = STATUS_SYMBOL[status] ?? "●";

  return (
    <span className={`status-badge status-${key}`}>
      <span aria-hidden="true">{symbol} </span>
      {label}
    </span>
  );
}
