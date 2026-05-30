"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getToken } from "@/lib/auth-storage";
import {
  buildWsUrl,
  fetchCollaborationSync,
  type CollaborationSync,
  type PresenceUser,
} from "@/lib/collaboration";

const POLL_MS = 10_000;
const HEARTBEAT_MS = 20_000;

/** Stable fallbacks — avoid `?? []` creating new refs every render (infinite update loops). */
const EMPTY_PRESENCE: PresenceUser[] = [];
const EMPTY_COMMENTS: CollaborationSync["comments"] = [];
const EMPTY_REVIEWS: CollaborationSync["section_reviews"] = [];
const EMPTY_ACTIVITY: CollaborationSync["activity"] = [];

type WsHandler = (data: { type: string; payload: unknown }) => void;

export function usePlanRealtime(planId: string, enabled: boolean) {
  const [sync, setSync] = useState<CollaborationSync | null>(null);
  const [connected, setConnected] = useState(false);
  const [usingPoll, setUsingPoll] = useState(false);
  const handlers = useRef<Set<WsHandler>>(new Set());

  const applySync = useCallback((data: CollaborationSync) => {
    setSync(data);
  }, []);

  const refresh = useCallback(async () => {
    if (!enabled || !planId) return;
    const data = await fetchCollaborationSync(planId);
    applySync(data);
    return data;
  }, [applySync, enabled, planId]);

  const onEvent = useCallback((handler: WsHandler) => {
    handlers.current.add(handler);
    return () => handlers.current.delete(handler);
  }, []);

  const dispatch = useCallback(
    (msg: { type: string; payload: unknown }) => {
      handlers.current.forEach((h) => h(msg));
      if (
        msg.type === "comment.created" ||
        msg.type === "comment.updated" ||
        msg.type === "section_review.updated" ||
        msg.type === "plan.status_changed" ||
        msg.type === "activity.created"
      ) {
        void refresh();
      } else if (msg.type === "presence.updated") {
        const payload = msg.payload as { users?: PresenceUser[] };
        setSync((prev) =>
          prev ? { ...prev, presence: payload.users ?? prev.presence } : prev
        );
      } else if (msg.type === "connected") {
        const payload = msg.payload as {
          plan_status?: string;
          presence?: { users?: PresenceUser[] };
        };
        setSync((prev) =>
          prev
            ? {
                ...prev,
                plan_status: payload.plan_status ?? prev.plan_status,
                presence: payload.presence?.users ?? prev.presence,
              }
            : prev
        );
      }
    },
    [refresh]
  );

  useEffect(() => {
    if (!enabled || !planId) return;

    let closed = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    let ws: WebSocket | null = null;

    const startPolling = () => {
      setUsingPoll(true);
      if (!pollTimer) {
        pollTimer = setInterval(() => void refresh(), POLL_MS);
      }
    };

    const stopPolling = () => {
      setUsingPoll(false);
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    };

    void refresh();

    const token = getToken();
    if (token) {
      ws = new WebSocket(buildWsUrl(planId, token));

      ws.onopen = () => {
        if (closed) return;
        setConnected(true);
        stopPolling();
        heartbeatTimer = setInterval(() => {
          if (ws?.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "presence.heartbeat" }));
          }
        }, HEARTBEAT_MS);
      };

      ws.onmessage = (ev) => {
        try {
          dispatch(JSON.parse(ev.data) as { type: string; payload: unknown });
        } catch {
          /* ignore */
        }
      };

      ws.onclose = () => {
        setConnected(false);
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        if (!closed) startPolling();
      };

      ws.onerror = () => {
        ws?.close();
      };
    } else {
      startPolling();
    }

    return () => {
      closed = true;
      stopPolling();
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      if (ws) {
        ws.onopen = null;
        ws.onmessage = null;
        ws.onclose = null;
        ws.onerror = null;
        if (
          ws.readyState === WebSocket.CONNECTING ||
          ws.readyState === WebSocket.OPEN
        ) {
          ws.close();
        }
      }
    };
  }, [planId, enabled, refresh, dispatch]);

  return {
    sync,
    connected,
    usingPoll,
    refresh,
    onEvent,
    presence: sync?.presence ?? EMPTY_PRESENCE,
    comments: sync?.comments ?? EMPTY_COMMENTS,
    sectionReviews: sync?.section_reviews ?? EMPTY_REVIEWS,
    activity: sync?.activity ?? EMPTY_ACTIVITY,
  };
}
