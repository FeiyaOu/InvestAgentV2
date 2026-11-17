import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import type { RunSnapshot } from "../../api/types";
import fixture from "../../test-fixtures/analytics-run.json";
import { ConversationPage } from "./ConversationPage";
import { HistoryPage } from "../history/HistoryPage";

const store = vi.hoisted(() => ({ runs: {} as Record<string, RunSnapshot> }));
vi.mock("../../state/session", () => ({ useSession: () => ({ conversationId: "c1", setConversationId: vi.fn() }) }));
vi.mock("../../api/useRun", () => ({ useRun: (id: string) => ({ snapshot: store.runs[id], loading: false,
  error: null, elapsed: 1, resume: vi.fn(), cancel: vi.fn() }) }));

beforeEach(() => {
  store.runs = Object.fromEntries(["r1", "r2"].map((id, index) => [id, {
    ...(fixture as unknown as RunSnapshot), run_id: id, conversation_id: "c1", status: "completed",
    query: index === 0 ? "查茅台五粮液股价" : "我们讨论哪两只股票",
    state: { composition_summary: index === 0 ? "第一轮行情结果" : "贵州茅台和五粮液。" },
  }]));
});

function renderConversation() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(["conversation", "c1"], { conversation_id: "c1", title: "查茅台五粮液股价", runs: Object.values(store.runs), turns: [] });
  return renderToStaticMarkup(<QueryClientProvider client={client}><MemoryRouter initialEntries={["/conversations/c1"]}>
    <Routes><Route path="/conversations/:conversationId" element={<ConversationPage onFollowUp={vi.fn()} submitting={false} />} /></Routes>
  </MemoryRouter></QueryClientProvider>);
}

it("keeps both questions and answers in order with one follow-up input", () => {
  const html = renderConversation();
  expect(html.indexOf("第一轮行情结果")).toBeLessThan(html.indexOf("我们讨论哪两只股票"));
  expect(html).toContain("贵州茅台和五粮液。");
  expect(html.match(/aria-label="继续追问"/g)).toHaveLength(1);
  expect(html.match(/aria-label="删除这次研究"/g)).toHaveLength(2);
});

it("shows a new running turn without removing the previous answer and prevents another concurrent follow-up", () => {
  store.runs.r2 = { ...store.runs.r2, status: "running", state: {} };
  const html = renderConversation();
  expect(html).toContain("第一轮行情结果");
  expect(html).toContain("正在进行深度研究");
  expect(html).toContain("停止研究");
  expect(html).toMatch(/aria-label="继续追问"[^>]*disabled/);
});

it("lists a two-turn conversation once in research history", () => {
  const client = new QueryClient();
  client.setQueryData(["conversations"], [{ conversation_id: "c1", title: "查茅台五粮液股价", run_count: 2,
    turn_count: 2, last_status: "completed", updated_at: "2026-11-17T00:00:00Z" }]);
  const html = renderToStaticMarkup(<QueryClientProvider client={client}><MemoryRouter><HistoryPage /></MemoryRouter></QueryClientProvider>);
  expect(html.match(/href="\/conversations\/c1"/g)).toHaveLength(1);
  expect(html).toContain("2 轮提问");
  expect(html).not.toContain('href="/runs/');
});
