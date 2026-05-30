"use client";

import { useLocale } from "@/context/LocaleContext";

export default function CompletionRing({
  percent,
  size = 120,
}: {
  percent: number;
  size?: number;
}) {
  const { t } = useLocale();
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (percent / 100) * c;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="#e8ecf2"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="#C9A84C"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-2xl font-semibold text-navy-800">
            {percent}%
          </span>
        </div>
      </div>
      <p className="max-w-[8rem] text-center text-xs text-navy-600">
        {t("completion")}
      </p>
    </div>
  );
}
