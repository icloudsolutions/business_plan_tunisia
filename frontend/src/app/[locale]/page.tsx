import { generatePageMetadata } from "@/lib/generate-page-metadata";
import HomePageClient from "./HomePageClient";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  return generatePageMetadata(locale, "homeTitle", "homeDescription");
}

export default function HomePage() {
  return <HomePageClient />;
}
