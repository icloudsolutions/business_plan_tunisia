"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { useAuth } from "@/context/AuthContext";
import { usePlanRealtime } from "@/hooks/usePlanRealtime";
import {
  createPlanComment,
  patchPlanComment,
  threadsByField,
  unresolvedFieldKeys,
  upsertSectionReview,
  type PlanComment,
  type SectionId,
  type SectionReview,
} from "@/lib/collaboration";

type CollaborationContextValue = {
  enabled: boolean;
  comments: PlanComment[];
  sectionReviews: SectionReview[];
  activity: ReturnType<typeof usePlanRealtime>["activity"];
  presence: ReturnType<typeof usePlanRealtime>["presence"];
  connected: boolean;
  usingPoll: boolean;
  highlightedFields: Set<string>;
  activeFieldKey: string | null;
  setActiveFieldKey: (key: string | null) => void;
  threadsForField: (fieldKey: string) => PlanComment[][];
  addComment: (fieldKey: string, content: string, parentId?: string | null) => Promise<void>;
  resolveThread: (rootId: string) => Promise<void>;
  setSectionReview: (section: SectionId, status: "approve" | "flag" | "reject") => Promise<void>;
  refresh: () => Promise<unknown>;
};

const CollaborationContext = createContext<CollaborationContextValue | null>(null);

export function CollaborationProvider({
  planId,
  enabled,
  children,
  activeFieldKey,
  setActiveFieldKey,
}: {
  planId: string;
  enabled: boolean;
  children: ReactNode;
  activeFieldKey: string | null;
  setActiveFieldKey: (key: string | null) => void;
}) {
  const { user } = useAuth();
  const { comments, sectionReviews, activity, presence, connected, usingPoll, refresh } =
    usePlanRealtime(planId, enabled);

  const threadMap = useMemo(() => threadsByField(comments), [comments]);
  const highlightedFields = useMemo(() => unresolvedFieldKeys(comments), [comments]);

  const threadsForField = useCallback(
    (fieldKey: string) => threadMap.get(fieldKey) ?? [],
    [threadMap]
  );

  const addComment = useCallback(
    async (fieldKey: string, content: string, parentId?: string | null) => {
      await createPlanComment(planId, {
        field_key: parentId ? undefined : fieldKey,
        content,
        parent_id: parentId ?? undefined,
      });
      await refresh();
    },
    [planId, refresh]
  );

  const resolveThread = useCallback(
    async (rootId: string) => {
      await patchPlanComment(planId, rootId, { resolved: true });
      await refresh();
    },
    [planId, refresh]
  );

  const setSectionReview = useCallback(
    async (section: SectionId, status: "approve" | "flag" | "reject") => {
      if (user?.role !== "expert") return;
      await upsertSectionReview(planId, section, status);
      await refresh();
    },
    [planId, refresh, user?.role]
  );

  const value = useMemo(
    () => ({
      enabled,
      comments,
      sectionReviews,
      activity,
      presence,
      connected,
      usingPoll,
      highlightedFields,
      activeFieldKey,
      setActiveFieldKey,
      threadsForField,
      addComment,
      resolveThread,
      setSectionReview,
      refresh,
    }),
    [
      enabled,
      comments,
      sectionReviews,
      activity,
      presence,
      connected,
      usingPoll,
      highlightedFields,
      activeFieldKey,
      setActiveFieldKey,
      threadsForField,
      addComment,
      resolveThread,
      setSectionReview,
      refresh,
    ]
  );

  return (
    <CollaborationContext.Provider value={value}>
      {children}
    </CollaborationContext.Provider>
  );
}

export function useCollaboration() {
  const ctx = useContext(CollaborationContext);
  return ctx;
}
