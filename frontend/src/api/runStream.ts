import { ApiError, eventStreamUrl, getRun } from "./client";
import { TERMINAL, applyEvent } from "./runView";
import type { RunEvent, RunSnapshot } from "./types";

const EVENT_TYPES = [
  "run_queued", "run_started", "run_cancelling", "run_waiting", "run_finished",
  "clarification_required", "clarification_answered", "planner_attempt", "task_started",
  "analysis_artifacts", "strategy_artifacts", "strategy_diagnostic", "analytics_diagnostic",
  "node_update", "report_progress",
];

interface WatchOptions {
  onSnapshot: (snapshot: RunSnapshot) => void;
  onError: (error: Error) => void;
  load?: typeof getRun;
  url?: typeof eventStreamUrl;
  open?: (url: string) => EventSource;
}

/** A subscription owns only its connection; disposing it never stops server-side work. */
export function watchRun(runId: string, options: WatchOptions): () => void {
  const { onSnapshot, onError, load = getRun, url = eventStreamUrl, open = (url) => new EventSource(url) } = options;
  let disposed = false;
  let source: EventSource | null = null;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let failures = 0;
  let snapshot: RunSnapshot;

  const close = () => { source?.close(); source = null; };
  const schedule = () => {
    if (disposed) return;
    const delay = Math.min(1000 * 2 ** Math.min(failures++, 4), 15000);
    retry = setTimeout(refresh, delay);
  };
  async function refresh() {
    try {
      const fresh = await load(runId);
      if (disposed) return;
      snapshot = fresh;
      onSnapshot(snapshot);
      if (TERMINAL.includes(snapshot.status)) return;
      const connection = open(url(runId, snapshot.event_count));
      source = connection;
      const receive = (message: MessageEvent) => {
        if (disposed || source !== connection) return;
        try {
          snapshot = applyEvent(snapshot, JSON.parse(message.data) as RunEvent);
          failures = 0;
          onSnapshot(snapshot);
          if (TERMINAL.includes(snapshot.status)) close();
        } catch {
          close();
          schedule();
        }
      };
      // Named SSE events do not dispatch to EventSource.onmessage.
      EVENT_TYPES.forEach((type) => connection.addEventListener(type, receive as EventListener));
      connection.onmessage = receive;
      connection.onerror = () => {
        if (disposed || source !== connection) return;
        close();
        schedule();
      };
    } catch (error) {
      if (disposed) return;
      onError(error instanceof Error ? error : new Error(String(error)));
      if (!(error instanceof ApiError && (error.status === 401 || error.status === 403 || error.status === 404))) schedule();
    }
  }
  void refresh();
  return () => {
    disposed = true;
    clearTimeout(retry);
    close();
  };
}
