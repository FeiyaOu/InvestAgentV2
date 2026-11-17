import type { QueryClient } from "@tanstack/react-query";
import { emptySnapshot } from "./runView";
import type { ConversationView } from "./types";

/** Acknowledged identifiers and the user's own question are enough to paint the first frame. */
export function seedSubmittedRun(client: QueryClient, created: { run_id: string; conversation_id: string }, query: string) {
  const run = emptySnapshot(created.run_id, created.conversation_id, query);
  client.setQueryData<ConversationView>(["conversation", created.conversation_id], (previous) => ({
    conversation_id: created.conversation_id,
    title: previous?.title || query,
    turn_count: previous?.turn_count ?? 0,
    turns: previous?.turns ?? [],
    runs: [...(previous?.runs ?? []).filter((item) => item.run_id !== run.run_id), run],
  }));
}
