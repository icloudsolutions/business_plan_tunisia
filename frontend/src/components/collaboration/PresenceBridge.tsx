"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useCollaboration } from "@/context/CollaborationContext";
import { useDashboardNav } from "@/context/DashboardNavContext";
import type { PresenceUser } from "@/lib/collaboration";

function presenceKey(users: PresenceUser[]): string {
  return users.map((p) => p.user_id).join(",");
}

/** Pushes WebSocket presence into the top nav breadcrumb. */
export default function PresenceBridge() {
  const { user } = useAuth();
  const collab = useCollaboration();
  const { setPresenceOthers } = useDashboardNav();
  const lastKeyRef = useRef("");

  useEffect(() => {
    if (!collab?.enabled) {
      if (lastKeyRef.current !== "") {
        lastKeyRef.current = "";
        setPresenceOthers([]);
      }
      return;
    }
    const others = collab.presence.filter((p) => p.user_id !== user?.id);
    const key = presenceKey(others);
    if (key === lastKeyRef.current) return;
    lastKeyRef.current = key;
    setPresenceOthers(others);
    return () => {
      lastKeyRef.current = "";
      setPresenceOthers([]);
    };
  }, [collab?.enabled, collab?.presence, user?.id, setPresenceOthers]);

  return null;
}
