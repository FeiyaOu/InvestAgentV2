import { useCallback, useEffect, useRef, useState } from "react";
import { cancelRun, resumeRun as resumeRunRequest } from "./client";
import { watchRun } from "./runStream";
import { TERMINAL } from "./runView";
import type { RunSnapshot } from "./types";

export interface UseRunResult {
  snapshot: RunSnapshot | null;
  loading: boolean;
  error: string | null;
  elapsed: number;
  resume: (answer: string) => Promise<void>;
  cancel: () => Promise<void>;
}

/** Fetch the run snapshot, then follow its SSE stream until it finishes or waits for input. */
export function useRun(runId: string | undefined, initialSnapshot?: RunSnapshot): UseRunResult {
  const [snapshot, setSnapshot] = useState<RunSnapshot | null>(initialSnapshot ?? null);
  const initial = useRef(initialSnapshot);
  initial.current = initialSnapshot;
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    if (!runId) return;
    setLoading(true);
    setError(null);
    setSnapshot((current) => current?.run_id === runId ? current : initial.current ?? null);
    return watchRun(runId, {
      onSnapshot: (fresh) => { setSnapshot(fresh); setLoading(false); setError(null); },
      onError: (err) => { setError(err.message); setLoading(false); },
    });
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

  const cancel = useCallback(async () => {
    if (!runId) return;
    await cancelRun(runId);
    setGeneration((value) => value + 1);
  }, [runId]);

  const elapsed = (() => {
    if (!snapshot) return 0;
    if (snapshot.elapsed_seconds != null && TERMINAL.includes(snapshot.status)) return snapshot.elapsed_seconds;
    if (!snapshot.started_at) return 0;
    void tick;
    return Math.max(0, Math.round((Date.now() - new Date(snapshot.started_at).getTime()) / 1000));
  })();

  return { snapshot, loading: loading && !snapshot, error, elapsed, resume, cancel };
}
