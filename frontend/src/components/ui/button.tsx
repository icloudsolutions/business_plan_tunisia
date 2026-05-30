import { cn } from "@/lib/utils";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "outline" | "ghost" | "destructive";
  size?: "sm" | "md" | "icon";
};

export function Button({
  className,
  variant = "default",
  size = "md",
  ...props
}: Props) {
  const base =
    "inline-flex items-center justify-center rounded-md font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:pointer-events-none disabled:opacity-50";
  const variants = {
    default: "bg-slate-900 text-slate-50 hover:bg-slate-800",
    outline: "border border-slate-200 bg-white hover:bg-slate-50",
    ghost: "hover:bg-slate-100",
    destructive: "bg-red-600 text-white hover:bg-red-700",
  };
  const sizes = {
    sm: "h-8 px-3 text-xs",
    md: "h-9 px-4 text-sm",
    icon: "h-9 w-9",
  };
  return (
    <button className={cn(base, variants[variant], sizes[size], className)} {...props} />
  );
}
