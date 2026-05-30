"use client";

import { useLocale } from "@/context/LocaleContext";

export default function CompletionRing({
  percent,
  size,
}: {
  percent: number;
  /** Omit for responsive sizing (96px mobile, 128px sm+). */
  size?: number;
}) {
  const { t } = useLocale();
  const stroke = 8;

  if (size != null) {
    return (
      <RingSvg
        percent={percent}
        size={size}
        label={t("completion")}
      />
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative h-24 w-24 sm:h-32 sm:w-32">
        <svg
          viewBox="0 0 120 120"
          className="h-full w-full -rotate-90"
          aria-hidden
        >
          <RingCircles percent={percent} size={120} stroke={stroke} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="truncate font-display text-xl font-semibold tabular-nums text-navy-800 sm:text-2xl">
            {percent}%
          </span>
        </div>
      </div>
      <p className="max-w-[8rem] truncate text-center text-xs text-navy-600">
        {t("completion")}
      </p>
    </div>
  );
}

function RingCircles({
  percent,
  size,
  stroke,
}: {
  percent: number;
  size: number;
  stroke: number;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (percent / 100) * c;
  const half = size / 2;
  return (
    <>
      <circle
        cx={half}
        cy={half}
        r={r}
        fill="none"
        stroke="#e8ecf2"
        strokeWidth={stroke}
      />
      <circle
        cx={half}
        cy={half}
        r={r}
        fill="none"
        stroke="#C9A84C"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        className="transition-all duration-1000 ease-out"
      />
    </>
  );
}

function RingSvg({
  percent,
  size,
  label,
}: {
  percent: number;
  size: number;
  label: string;
}) {
  const stroke = 8;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" aria-hidden>
          <RingCircles percent={percent} size={size} stroke={stroke} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="truncate font-display text-2xl font-semibold tabular-nums text-navy-800">
            {percent}%
          </span>
        </div>
      </div>
      <p className="max-w-[8rem] truncate text-center text-xs text-navy-600">{label}</p>
    </div>
  );
}
