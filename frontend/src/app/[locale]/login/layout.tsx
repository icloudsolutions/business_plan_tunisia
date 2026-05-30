import type { ReactNode } from "react";
import { generatePageMetadata } from "@/lib/generate-page-metadata";

type Props = { children: ReactNode; params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  return generatePageMetadata(locale, "loginTitle", "loginDescription");
}

export default function LoginLayout({ children }: { children: ReactNode }) {
  return children;
}
