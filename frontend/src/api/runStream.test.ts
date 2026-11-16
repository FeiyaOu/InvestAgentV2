import { afterEach, expect, it, vi } from "vitest";
import { watchRun } from "./runStream";
import { emptySnapshot } from "./runView";
import type { RunSnapshot } from "./types";

class FakeSource extends EventTarget {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;
  close() { this.closed = true; }
  send(type: string, seq: number, payload = {}) {
    this.dispatchEvent(new MessageEvent(type, { data: JSON.stringify({ type, seq, payload, at: "2026-11-16T00:00:00Z" }) }));
  }
}
afterEach(() => vi.useRealTimers());

it("receives named SSE events and stops listening without cancelling the server run", async () => {
  const source = new FakeSource();
  const changed = vi.fn();
  const stop = watchRun("r", {
    load: vi.fn().mockResolvedValue(emptySnapshot("r", "c", "q")),
    url: (_, after) => `events?after=${after}`,
    open: () => source as unknown as EventSource,
    onSnapshot: changed, onError: vi.fn(),
  });
  await vi.waitFor(() => expect(changed).toHaveBeenCalled());
  source.send("run_started", 1);
  expect(changed.mock.lastCall?.[0].status).toBe("running");
  source.send("run_cancelling", 2);
  expect(changed.mock.lastCall?.[0].status).toBe("cancelling");
  stop();
  expect(source.closed).toBe(true);
  source.send("run_finished", 3, { status: "cancelled" });
  expect(changed.mock.lastCall?.[0].status).toBe("cancelling");
});

it("refreshes and reconnects from the persisted cursor after a network error", async () => {
  vi.useFakeTimers();
  const initial = emptySnapshot("r", "c", "q");
  const fresh: RunSnapshot = { ...initial, status: "running", event_count: 5 };
  const load = vi.fn().mockResolvedValueOnce(initial).mockResolvedValue(fresh);
  const first = new FakeSource(), second = new FakeSource();
  const open = vi.fn().mockReturnValueOnce(first).mockReturnValue(second);
  const changed = vi.fn();
  const stop = watchRun("r", { load, url: (_, after) => `events?after=${after}`, open,
    onSnapshot: changed, onError: vi.fn() });
  await vi.advanceTimersByTimeAsync(0);
  first.onerror?.();
  expect(first.closed).toBe(true);
  await vi.advanceTimersByTimeAsync(1000);
  expect(open).toHaveBeenLastCalledWith("events?after=5");
  second.send("run_finished", 6, { status: "cancelled" });
  expect(changed.mock.lastCall?.[0].status).toBe("cancelled");
  expect(second.closed).toBe(true);
  stop();
  await vi.advanceTimersByTimeAsync(30000);
  expect(open).toHaveBeenCalledTimes(2);
});
