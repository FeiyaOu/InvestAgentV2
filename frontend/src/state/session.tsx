/**
 * Which conversation new questions go to. `null` means "start a new one": the server allocates
 * the id on the first run and we adopt it. Persisted per browser as a convenience only.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

interface SessionValue {
  conversationId: string | null;
  setConversationId: (id: string | null) => void;
  newConversation: () => void;
}

const KEY = "investagent.conversation.v2";
const SessionContext = createContext<SessionValue | null>(null);

function load(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [conversationId, setConversationId] = useState<string | null>(load);

  useEffect(() => {
    try {
      if (conversationId) localStorage.setItem(KEY, conversationId);
      else localStorage.removeItem(KEY);
    } catch {
      /* storage unavailable */
    }
  }, [conversationId]);

  const newConversation = useCallback(() => setConversationId(null), []);
  const value = useMemo(() => ({ conversationId, setConversationId, newConversation }), [conversationId, newConversation]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside SessionProvider");
  return value;
}
