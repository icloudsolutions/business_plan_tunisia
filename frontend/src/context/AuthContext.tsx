"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import {
  fetchMe,
  login as apiLogin,
  register as apiRegister,
  type User,
} from "@/lib/api";
import { clearToken, getToken, setToken } from "@/lib/auth-storage";
import {
  LOCALE_COOKIE,
  LOCALE_STORAGE_KEY,
  locales,
  type AppLocale,
} from "@/i18n/routing";
import { userHasRole } from "@/lib/auth-roles";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  isAdmin: boolean;
  isExpert: boolean;
  isClient: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function isAppLocale(value: string): value is AppLocale {
  return (locales as readonly string[]).includes(value);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const uiLocale = useLocale() as AppLocale;
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const applyPreferredLocale = useCallback(
    (preferred: string | undefined, redirectHome = false) => {
      if (!preferred || !isAppLocale(preferred) || preferred === uiLocale) return;
      document.cookie = `${LOCALE_COOKIE}=${preferred};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;
      localStorage.setItem(LOCALE_STORAGE_KEY, preferred);
      if (redirectHome) {
        router.replace("/", { locale: preferred });
      } else {
        router.replace(pathname, { locale: preferred });
      }
    },
    [pathname, router, uiLocale]
  );

  const refreshUser = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      return;
    }
    try {
      const me = await fetchMe();
      setUser(me);
    } catch {
      clearToken();
      setUser(null);
    }
  }, []);

  useEffect(() => {
    refreshUser().finally(() => setLoading(false));
  }, [refreshUser]);

  const login = useCallback(
    async (email: string, password: string) => {
      const { access_token } = await apiLogin(email, password);
      setToken(access_token);
      const me = await fetchMe();
      setUser(me);
      if (
        me.preferred_locale &&
        isAppLocale(me.preferred_locale) &&
        me.preferred_locale !== uiLocale
      ) {
        applyPreferredLocale(me.preferred_locale, true);
      } else {
        router.push("/");
      }
    },
    [applyPreferredLocale, router, uiLocale]
  );

  const register = useCallback(
    async (email: string, password: string) => {
      await apiRegister(email, password, uiLocale);
      await login(email, password);
    },
    [login, uiLocale]
  );

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
    router.push("/login");
  }, [router]);

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      register,
      logout,
      refreshUser,
      isAdmin: userHasRole(user?.role, ["admin"]),
      isExpert: userHasRole(user?.role, ["expert"]),
      isClient: userHasRole(user?.role, ["client"]),
    }),
    [user, loading, login, register, logout, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
