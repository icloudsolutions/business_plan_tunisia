import type { ReactNode } from "react";
import { generatePageMetadata } from "@/lib/generate-page-metadata";

type Props = { children: ReactNode; params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  return generatePageMetadata(locale, "plansTitle", "plansDescription");
}

export default function PlansLayout({ children }: { children: ReactNode }) {
  return children;
}
