import type { Metadata } from "next";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Playfair_Display, IBM_Plex_Sans_Arabic, IBM_Plex_Sans } from "next/font/google";
import { routing, type AppLocale } from "@/i18n/routing";
import Providers from "@/components/Providers";
import "../globals.css";

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const ibmSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

const ibmSansArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans-ar",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Business Plan Tunisie",
  description: "Plateforme collaborative — Liasse Unique TIA",
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();

  const dir = locale === "ar" ? "rtl" : "ltr";
  const fontClass =
    locale === "ar"
      ? `${playfair.variable} ${ibmSansArabic.variable} font-sans antialiased`
      : `${playfair.variable} ${ibmSans.variable} font-sans antialiased`;

  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <body className={fontClass}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers locale={locale as AppLocale}>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
