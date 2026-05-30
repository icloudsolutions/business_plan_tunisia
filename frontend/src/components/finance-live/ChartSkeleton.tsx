export default function ChartSkeleton({ height = 280 }: { height?: number }) {
  return (
    <div
      className="animate-pulse rounded-xl border border-slate-200 bg-slate-100/80"
      style={{ height }}
      aria-hidden
    >
      <div className="flex h-full flex-col justify-end gap-2 p-6">
        <div className="flex items-end justify-between gap-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className="w-full rounded-t bg-slate-200"
              style={{ height: `${30 + (i % 4) * 15}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
