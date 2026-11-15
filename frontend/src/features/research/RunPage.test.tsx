/** Server-render the result view from a real backend snapshot (mock market data) to catch runtime errors. */
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { RunSnapshot } from "../../api/types";
import fixture from "../../test-fixtures/analytics-run.json";
import { Answer } from "./RunPage";

const snapshot = fixture as unknown as RunSnapshot;

describe("Answer", () => {
  it("renders market data and analytics panels with metrics and chart cards from a real snapshot", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <Answer snapshot={snapshot} elapsed={22} />
      </MemoryRouter>,
    );
    expect(html).toContain("核心结论");
    expect(html).toContain("数据与证据");
    expect(html).toContain("分析结果");
    expect(html).toContain("analyze_price_performance");
    expect(html).toContain("累计价格收益");
    expect(html).toContain("历史回撤");
    expect(html).toContain("样本 259");
    expect(html).toContain("部分完成");
    expect(html).not.toContain("undefined");
    expect(html).not.toContain("[object Object]");
  });

  it("renders a failed run without task results", () => {
    const failed: RunSnapshot = {
      ...snapshot,
      status: "failed",
      error: { type: "execution_error", message: "运行异常" },
      state: { planning_status: "failed", planning_error: { type: "invalid_input", message: "请输入非空问题" }, final_response: "未能生成任务计划" },
    };
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <Answer snapshot={failed} elapsed={1} />
      </MemoryRouter>,
    );
    expect(html).toContain("运行异常");
    expect(html).toContain("请输入非空问题");
    expect(html).toContain("未能生成任务计划");
  });
});
