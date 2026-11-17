import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { examples, HomeView } from "./HomeView";

it("preserves six starting suggestions and exposes accessible controls for more questions", () => {
  const html = renderToStaticMarkup(<HomeView onRun={vi.fn()} busy={false} />);
  expect(html.match(/class="zh-example-title"/g)).toHaveLength(6);
  expect(html).toContain("查最新估值");
  expect(html).toContain("生成行业报告");
  expect(html).toMatch(/aria-label="上一页问题"[^>]*disabled/);
  expect(html).toContain('aria-label="下一页问题"');
  expect(html).toContain('aria-live="polite"');
  expect(html).toContain("1 / 3");
});

it("offers the upgraded analyses with current holding dates and bounded prompts", () => {
  const cards = examples("2026-11-17");
  expect(cards.find((card) => card.title === "比较同行因子")?.query).toContain("洋河股份");
  expect(cards.find((card) => card.title === "评估组合风险")?.query).toContain("2026-11-17");
  expect(cards.find((card) => card.title === "重演历史冲击")?.query).toContain("2020年疫情");
  expect(cards.find((card) => card.title === "分析资产相关性")?.query).toContain("相关系数");
  expect(cards.every((card) => card.query.length > 0 && card.query.length <= 2000)).toBe(true);
  expect(new Set(cards.map((card) => card.title)).size).toBe(cards.length);
});
