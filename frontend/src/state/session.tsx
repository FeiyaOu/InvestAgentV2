/** Account conversation selection persists per user; guest selection stays in memory. */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "./auth";

interface SessionValue {
  conversationId: string | null;
  setConversationId: (id: string | null) => void;
  newConversation: () => void;
}
const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const storageKey = user && !user.is_guest ? `investagent.conversation.v3.${user.id}` : null;
  const identity = user?.id ?? null;
  return <SessionScope key={storageKey ?? "guest"} storageKey={storageKey} identity={identity}>{children}</SessionScope>;
}

function SessionScope({ children, storageKey, identity }: { children: ReactNode; storageKey: string | null; identity: string | null }) {
  const previousIdentity = useRef(identity);
  const [conversationId, setConversationId] = useState<string | null>(() => {
    try { return storageKey ? localStorage.getItem(storageKey) : null; } catch { return null; }
  });
  useEffect(() => {
    if (previousIdentity.current !== identity && previousIdentity.current !== null) setConversationId(null);
    previousIdentity.current = identity;
  }, [identity]);
  useEffect(() => {
    if (!storageKey) return;
    try {
      if (conversationId) localStorage.setItem(storageKey, conversationId);
      else localStorage.removeItem(storageKey);
    } catch { /* storage unavailable */ }
  }, [conversationId, storageKey]);
  const newConversation = useCallback(() => setConversationId(null), []);
  const value = useMemo(() => ({ conversationId, setConversationId, newConversation }), [conversationId, newConversation]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside SessionProvider");
  return value;
}
