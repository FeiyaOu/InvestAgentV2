import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { expect, it } from "vitest";
import { ResearchTurn } from "../features/research/RunPage";
import { emptySnapshot } from "./runView";
import { seedSubmittedRun } from "./submittedRun";
import type { ConversationView } from "./types";

it("renders the submitted question and queued progress before the first snapshot fetch", () => {
  const client = new QueryClient();
  seedSubmittedRun(client, { run_id: "r1", conversation_id: "c1" }, "查茅台股价");
  const conversation = client.getQueryData<ConversationView>(["conversation", "c1"])!;
  const html = renderToStaticMarkup(<QueryClientProvider client={client}><MemoryRouter>
    <ResearchTurn runId="r1" conversationId="c1" initialSnapshot={conversation.runs[0]} />
  </MemoryRouter></QueryClientProvider>);
  expect(html).toContain("查茅台股价");
  expect(html).toContain("排队等待执行");
  expect(html).not.toContain("加载中");
  expect(html).not.toContain("加载对话中");
});

it("appends a submitted follow-up while retaining earlier answers and the conversation title", () => {
  const client = new QueryClient();
  const previous = { ...emptySnapshot("r1", "c1", "查股价"), state: { final_response: "已有回答" } };
  client.setQueryData<ConversationView>(["conversation", "c1"], { conversation_id: "c1", title: "原对话",
    turn_count: 1, turns: [], runs: [previous] });
  seedSubmittedRun(client, { run_id: "r2", conversation_id: "c1" }, "解释一下");
  const view = client.getQueryData<ConversationView>(["conversation", "c1"])!;
  expect(view.title).toBe("原对话");
  expect(view.runs[0].state.final_response).toBe("已有回答");
  expect(view.runs.map((run) => run.query)).toEqual(["查股价", "解释一下"]);
});
