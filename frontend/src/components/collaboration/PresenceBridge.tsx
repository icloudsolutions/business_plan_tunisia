"use client";

import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useCollaboration } from "@/context/CollaborationContext";
import { useDashboardNav } from "@/context/DashboardNavContext";

/** Pushes WebSocket presence into the top nav breadcrumb. */
export default function PresenceBridge() {
  const { user } = useAuth();
  const collab = useCollaboration();
  const { setPresenceOthers } = useDashboardNav();

  useEffect(() => {
    if (!collab?.enabled) {
      setPresenceOthers([]);
      return;
    }
    const others = collab.presence.filter((p) => p.user_id !== user?.id);
    setPresenceOthers(others);
    return () => setPresenceOthers([]);
  }, [collab?.enabled, collab?.presence, user?.id, setPresenceOthers]);

  return null;
}
