import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  const [base, liasse] = await Promise.all([
    import(`../../messages/${locale}.json`),
    import(`../../messages/liasse-${locale}.json`),
  ]);

  return {
    locale,
    messages: {
      ...base.default,
      liasse: liasse.default,
    },
  };
});
