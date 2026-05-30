/** Loading placeholder: three pulsing bars (Tailwind animate-pulse). */
export default function ChartBarsSkeleton({ className = "" }: { className?: string }) {
  const heights = ["h-[45%]", "h-[70%]", "h-[55%]"];
  return (
    <div
      className={`flex h-64 items-end justify-center gap-10 rounded-xl border border-slate-200 bg-slate-50 px-8 pb-8 ${className}`}
      aria-hidden
    >
      {heights.map((h, i) => (
        <div
          key={i}
          className={`w-14 animate-pulse rounded-t bg-slate-300 ${h}`}
        />
      ))}
    </div>
  );
}
