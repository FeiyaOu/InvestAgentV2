import type { SeriesPoint, StrategyResult, TaskResult } from "../../../api/types";
import { LineChart, formatByUnit } from "../../../charts/LineChart";
import { Markdown } from "../../../components/Markdown";
import { Details, KeyValueList, Notice, RecordTable, StatusBadge } from "../../../components/ResultPrimitives";

const RISK_LABELS: Record<string, string> = {
  annualized_volatility: "组合年化波动率",
  max_drawdown: "回放最大回撤",
  historical_var_95: "历史VaR 95%",
  historical_cvar_95: "历史CVaR 95%",
  historical_var_99: "历史VaR 99%",
  historical_cvar_99: "历史CVaR 99%",
  parametric_var_95: "参数VaR 95%",
  parametric_cvar_95: "参数CVaR 95%",
  parametric_var_99: "参数VaR 99%",
  parametric_cvar_99: "参数CVaR 99%",
};
const SERIES_TITLES: Record<string, string> = {
  portfolio_nav: "当前权重恒定回放净值（非真实业绩）",
  portfolio_value: "情景期间组合价值（买入持有）",
};

function RiskRow({ row }: { row: Record<string, unknown> }) {
  const metrics = Object.entries(row).filter(([k, v]) => k in RISK_LABELS && typeof v === "number");
  if (!metrics.length) return null;
  return (
    <div className="metric-row">
      {metrics.map(([key, value]) => (
        <div key={key}>
          <span>{RISK_LABELS[key]}</span>
          <strong>{formatByUnit(value as number, "fraction")}</strong>
          <small>{String(row.basis ?? row.method ?? "")}</small>
        </div>
      ))}
    </div>
  );
}

export function StrategyPanel({
  record,
  series,
}: {
  record: TaskResult;
  series: Record<string, Record<string, SeriesPoint[]>>;
}) {
  const result = record.result as StrategyResult | null;
  return (
    <article className="zh-task">
      <header className="zh-task-head">
        <div>
          <b>{record.question}</b>
          <small>任务 {record.task_id} · Strategy / Risk</small>
        </div>
        <StatusBadge status={record.status} />
      </header>
      {record.error && <Notice tone="error">[{record.error.type}] {record.error.message}</Notice>}
      {result?.summary && <Markdown text={result.summary} />}
      {result && (result.opportunities.length > 0 || result.risks.length > 0) && (
        <div className="risk-grid">
          {[
            ["机会", result.opportunities],
            ["风险", result.risks],
          ].map(([title, claims]) =>
            (claims as StrategyResult["risks"]).map((claim, i) => (
              <article key={`${title}-${i}`}>
                <span className={`risk-level ${title === "机会" ? "low" : "high"}`}>{String(title)}</span>
                <p>{claim.text}</p>
                <small className="zh-muted">依据：{claim.evidence_ids.join("、")}</small>
              </article>
            )),
          )}
        </div>
      )}
      {result?.risk_results.map((row, i) => (
        <RiskRow key={i} row={row} />
      ))}
      {result && result.constraint_checks.length > 0 && (
        <section className="zh-finding">
          <div className="zh-finding-head"><b>用户约束检查</b></div>
          <RecordTable rows={result.constraint_checks} />
        </section>
      )}
      {result?.scenario_results.map((scenario, i) => (
        <section className="zh-finding" key={i}>
          <div className="zh-finding-head">
            <b>{String(scenario.name ?? scenario.scenario_id ?? `情景 ${i + 1}`)}</b>
            <small>{String(scenario.origin === "agent_proposed" ? "agent 提出的情景" : "用户假设")}</small>
          </div>
          <KeyValueList
            items={Object.entries(scenario)
              .filter(([k]) => !["name", "scenario_id", "origin"].includes(k))
              .map(([k, v]) => [k, typeof v === "number" ? formatByUnit(v, "fraction") : typeof v === "object" ? JSON.stringify(v) : String(v)] as [string, string])}
          />
        </section>
      ))}
      {Object.entries(series).flatMap(([artifactId, groups]) =>
        Object.entries(groups)
          .filter(([, points]) => points?.length)
          .map(([key, points]) => (
            <div className="chart-card" key={`${artifactId}_${key}`}>
              <div className="chart-head"><div className="legend">{SERIES_TITLES[key] ?? key}</div></div>
              <LineChart series={[{ name: SERIES_TITLES[key] ?? key, points }]} />
            </div>
          )),
      )}
      {result?.missing_information.map((text) => (
        <Notice key={text} tone="warn">{text}</Notice>
      ))}
      {result?.missing_data_requests.map((req, i) => (
        <Notice key={i}>待补数据：{req.kind}{req.subjects.length ? ` · ${req.subjects.join("、")}` : ""}；{req.reason}</Notice>
      ))}
      {result && result.limitations.length > 0 && (
        <Details summary="策略限制">
          {result.limitations.map((text) => (
            <p className="zh-muted" key={text}>{text}</p>
          ))}
        </Details>
      )}
      {result && (
        <Details summary="策略假设与来源">
          <KeyValueList items={Object.entries(result.assumptions).map(([k, v]) => [k, typeof v === "object" ? JSON.stringify(v) : String(v)] as [string, string])} />
          {result.dataset_refs.length > 0 && (
            <RecordTable columns={["symbol", "security_name", "provider", "start_date", "end_date", "data_mode"]} rows={result.dataset_refs as Record<string, unknown>[]} />
          )}
        </Details>
      )}
    </article>
  );
}
