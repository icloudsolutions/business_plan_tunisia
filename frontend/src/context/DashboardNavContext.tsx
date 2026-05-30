"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { PresenceUser } from "@/lib/collaboration";
import type { PlanCompletion } from "@/lib/completion";

type DashboardNavContextValue = {
  planTitle: string | null;
  setPlanTitle: (title: string | null) => void;
  planId: string | null;
  setPlanId: (id: string | null) => void;
  planCompletion: PlanCompletion | null;
  setPlanCompletion: (c: PlanCompletion | null) => void;
  historyOpen: boolean;
  setHistoryOpen: (open: boolean) => void;
  refreshPlan: (() => void) | null;
  setRefreshPlan: (fn: (() => void) | null) => void;
  unreadNotifications: number;
  markNotificationsRead: () => void;
  presenceOthers: PresenceUser[];
  setPresenceOthers: (users: PresenceUser[]) => void;
};

const DashboardNavContext = createContext<DashboardNavContextValue | null>(null);

export function DashboardNavProvider({ children }: { children: ReactNode }) {
  const [planTitle, setPlanTitle] = useState<string | null>(null);
  const [planId, setPlanId] = useState<string | null>(null);
  const [planCompletion, setPlanCompletion] = useState<PlanCompletion | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [refreshPlan, setRefreshPlan] = useState<(() => void) | null>(null);
  const [unreadNotifications, setUnread] = useState(2);
  const [presenceOthers, setPresenceOthers] = useState<PresenceUser[]>([]);

  const value = useMemo(
    () => ({
      planTitle,
      setPlanTitle,
      planId,
      setPlanId,
      planCompletion,
      setPlanCompletion,
      historyOpen,
      setHistoryOpen,
      refreshPlan,
      setRefreshPlan,
      unreadNotifications,
      markNotificationsRead: () => setUnread(0),
      presenceOthers,
      setPresenceOthers,
    }),
    [planTitle, planId, planCompletion, historyOpen, refreshPlan, unreadNotifications, presenceOthers]
  );

  return (
    <DashboardNavContext.Provider value={value}>
      {children}
    </DashboardNavContext.Provider>
  );
}

export function useDashboardNav() {
  const ctx = useContext(DashboardNavContext);
  if (!ctx) throw new Error("useDashboardNav requires DashboardNavProvider");
  return ctx;
}
