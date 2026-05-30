import createMiddleware from "next-intl/middleware";
import { routing, LOCALE_COOKIE } from "./i18n/routing";

export default createMiddleware({
  ...routing,
  localeCookie: {
    name: LOCALE_COOKIE,
    maxAge: 60 * 60 * 24 * 365,
  },
});

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
