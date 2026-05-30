"use client";

import { useTranslations } from "next-intl";

export default function StatusBadge({ status }: { status: string }) {
  const t = useTranslations("status");
  const key = status.toLowerCase().replace(/_/g, "-");
  let label = status;
  try {
    label = t(status as "DRAFT");
  } catch {
    label = status;
  }
  return (
    <span className={`status-badge status-${key}`}>
      {label}
    </span>
  );
}
