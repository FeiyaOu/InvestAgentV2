import { afterEach, expect, it, vi } from "vitest";
import { deleteReport, setAuthHandlers } from "./client";

afterEach(() => vi.unstubAllGlobals());

it("accepts an empty 204 deletion response without trying to parse JSON", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", fetch);
  setAuthHandlers({ getToken: () => "owner-token", onUnauthorized: vi.fn() });
  await expect(deleteReport("rep-1")).resolves.toBeUndefined();
  expect(fetch).toHaveBeenCalledWith("/api/reports/rep-1", expect.objectContaining({
    method: "DELETE", headers: expect.objectContaining({ authorization: "Bearer owner-token" }),
  }));
});

it("surfaces a refused deletion so the UI keeps the row and shows the reason", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: "请先停止研究" }), {
    status: 409, headers: { "content-type": "application/json" },
  })));
  await expect(deleteReport("rep-1")).rejects.toThrow("请先停止研究");
});
