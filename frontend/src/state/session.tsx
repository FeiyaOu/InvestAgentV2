/**
 * Per-browser session: the active conversation id and the runs started from this device.
 * Server-side persistence (users, conversation list) arrives in step 4; until then
 * localStorage is only a convenience and every read/write is guarded.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export interface SessionRun {
  runId: string;
  conversationId: string;
  query: string;
  createdAt: string;
}

interface SessionValue {
  conversationId: string;
  runs: SessionRun[];
  newConversation: () => string;
  addRun: (run: SessionRun) => void;
}

const KEY = "investagent.session.v1";

function freshId(prefix: string) {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return `${prefix}_${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

function load(): { conversationId: string; runs: SessionRun[] } {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed.conversationId === "string" && Array.isArray(parsed.runs)) return parsed;
    }
  } catch {
    /* storage unavailable */
  }
  return { conversationId: freshId("conv"), runs: [] };
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState(load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch {
      /* storage unavailable */
    }
  }, [data]);

  const newConversation = useCallback(() => {
    const id = freshId("conv");
    setData((current) => ({ ...current, conversationId: id }));
    return id;
  }, []);

  const addRun = useCallback((run: SessionRun) => {
    setData((current) => ({ ...current, runs: [run, ...current.runs.filter((r) => r.runId !== run.runId)].slice(0, 200) }));
  }, []);

  const value = useMemo(
    () => ({ conversationId: data.conversationId, runs: data.runs, newConversation, addRun }),
    [data, newConversation, addRun],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside SessionProvider");
  return value;
}
