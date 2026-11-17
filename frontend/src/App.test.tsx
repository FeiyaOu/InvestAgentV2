import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import App from "./App";
import { SessionProvider } from "./state/session";

vi.mock("./state/auth", () => ({ useAuth: () => ({ user: null, ready: true, ensureGuest: vi.fn(), logout: vi.fn() }) }));

it("shows the workbench homepage before any login or guest API request completes", () => {
  const html = renderToStaticMarkup(<QueryClientProvider client={new QueryClient()}><SessionProvider>
    <MemoryRouter><App /></MemoryRouter>
  </SessionProvider></QueryClientProvider>);
  expect(html).toContain("您的智能投研工作台");
  expect(html).toContain("登录 / 注册");
  expect(html).toContain("访客");
  expect(html).not.toContain("登录工作区");
});

it("shows one recent entry for a conversation with multiple research turns", () => {
  const client = new QueryClient();
  client.setQueryData(["conversations"], [{ conversation_id: "c1", title: "连续讨论茅台五粮液", run_count: 2,
    turn_count: 2, last_status: "completed", updated_at: "2026-11-17T08:00:00Z", created_at: "2026-11-17T07:00:00Z" }]);
  const html = renderToStaticMarkup(<QueryClientProvider client={client}><SessionProvider>
    <MemoryRouter><App /></MemoryRouter>
  </SessionProvider></QueryClientProvider>);
  expect(html.match(/class="zh-recent-row"/g)).toHaveLength(1);
  expect(html).toContain("删除对话：连续讨论茅台五粮液");
  expect(html).not.toContain("从最近研究移除");
});
