import type { ReactNode } from "react";
import { generatePageMetadata } from "@/lib/generate-page-metadata";

type Props = { children: ReactNode; params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  return generatePageMetadata(locale, "financePlanTitle", "financePlanDescription");
}

export default function FinancePlanLayout({ children }: { children: ReactNode }) {
  return children;
}
