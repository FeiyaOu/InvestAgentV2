import { useCallback, useEffect, useRef, useState } from "react";
import { eventStreamUrl, getRun, resumeRun as resumeRunRequest } from "./client";
import { TERMINAL, applyEvent } from "./runView";
import type { RunEvent, RunSnapshot } from "./types";

export interface UseRunResult {
  snapshot: RunSnapshot | null;
  loading: boolean;
  error: string | null;
  elapsed: number;
  resume: (answer: string) => Promise<void>;
}

/** Fetch the run snapshot, then follow its SSE stream until it finishes or waits for input. */
export function useRun(runId: string | undefined): UseRunResult {
  const [snapshot, setSnapshot] = useState<RunSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const sourceRef = useRef<EventSource | null>(null);
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    if (!runId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getRun(runId)
      .then((initial) => {
        if (cancelled) return;
        setSnapshot(initial);
        setLoading(false);
        if (TERMINAL.includes(initial.status)) return;
        const source = new EventSource(eventStreamUrl(runId, initial.event_count));
        sourceRef.current = source;
        source.onmessage = (message) => {
          const event = JSON.parse(message.data) as RunEvent;
          setSnapshot((current) => (current ? applyEvent(current, event) : current));
          if (event.type === "run_finished" || event.type === "run_waiting") {
            source.close();
            sourceRef.current = null;
          }
        };
        source.onerror = () => {
          // The server closes the stream at terminal states; a reconnect refreshes the snapshot instead.
          source.close();
          sourceRef.current = null;
          if (!cancelled) getRun(runId).then((fresh) => !cancelled && setSnapshot(fresh)).catch(() => undefined);
        };
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setError(err.message);
        setLoading(false);
      });
    return () => {
      cancelled = true;
      sourceRef.current?.close();
      sourceRef.current = null;
    };
  }, [runId, generation]);

  const running = snapshot ? !TERMINAL.includes(snapshot.status) : false;
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setTick((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  const resume = useCallback(
    async (answer: string) => {
      if (!runId) return;
      await resumeRunRequest(runId, answer);
      setGeneration((value) => value + 1);
    },
    [runId],
  );

  const elapsed = (() => {
    if (!snapshot) return 0;
    if (snapshot.elapsed_seconds != null && TERMINAL.includes(snapshot.status)) return snapshot.elapsed_seconds;
    if (!snapshot.started_at) return 0;
    void tick;
    return Math.max(0, Math.round((Date.now() - new Date(snapshot.started_at).getTime()) / 1000));
  })();

  return { snapshot, loading, error, elapsed, resume };
}
