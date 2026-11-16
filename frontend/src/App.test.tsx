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
  expect(html).toContain("AI 驱动的投研工作台");
  expect(html).toContain("登录 / 注册");
  expect(html).toContain("访客");
  expect(html).not.toContain("登录工作区");
});
