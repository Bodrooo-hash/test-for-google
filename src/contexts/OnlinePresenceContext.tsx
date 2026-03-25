import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { externalSupabase } from "@/lib/externalSupabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface OnlinePresenceContextType {
  onlineUserIds: Set<string>;
  isOnline: (userId: string) => boolean;
}

const OnlinePresenceContext = createContext<OnlinePresenceContextType>({
  onlineUserIds: new Set(),
  isOnline: () => false,
});

export const useOnlinePresence = () => useContext(OnlinePresenceContext);

export const OnlinePresenceProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user?.id) return;

    let channel: RealtimeChannel | null = null;

    const setupPresence = () => {
      channel = externalSupabase.channel("online-users", {
        config: { presence: { key: user.id } },
      });

      channel
        .on("presence", { event: "sync" }, () => {
          const state = channel!.presenceState();
          const ids = new Set<string>();
          Object.keys(state).forEach((key) => ids.add(key));
          setOnlineUserIds(ids);
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            await channel!.track({ user_id: user.id, online_at: new Date().toISOString() });
          }
        });
    };

    setupPresence();

    return () => {
      if (channel) {
        channel.untrack();
        externalSupabase.removeChannel(channel);
      }
    };
  }, [user?.id]);

  const isOnline = useCallback(
    (userId: string) => onlineUserIds.has(userId),
    [onlineUserIds]
  );

  return (
    <OnlinePresenceContext.Provider value={{ onlineUserIds, isOnline }}>
      {children}
    </OnlinePresenceContext.Provider>
  );
};
