import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { expect, it } from "vitest";
import { ReportReader } from "./ReportCenter";

it("provides an explicit exit to the report centre even when opened without browser history", () => {
  const client = new QueryClient();
  const summary = { id: "report1", run_id: "run1", task_id: "task1", draft: false, validation_errors: [] };
  client.setQueryData(["reports"], [summary]);
  client.setQueryData(["report", "report1"], { ...summary, report: {
    research_topic: "新能源行业", report_date: "2026-11-17", dimensions: {},
    supporting_evidence: [], risk_factors: [], sources: [], investment_thesis: "研究结论",
  } });
  const html = renderToStaticMarkup(<QueryClientProvider client={client}>
    <MemoryRouter initialEntries={["/reports/run1/task1"]}><Routes>
      <Route path="/reports/:runId/:taskId" element={<ReportReader />} />
    </Routes></MemoryRouter>
  </QueryClientProvider>);
  expect(html).toMatch(/<a[^>]*aria-label="关闭报告"[^>]*href="\/reports"/);
});
