import { Link } from "react-router-dom";
import type { AnalyticsResult, RunSnapshot, StrategyResult } from "../../api/types";
import { LineChart, formatByUnit } from "../../charts/LineChart";
import { Markdown } from "../../components/Markdown";
import { Notice } from "../../components/ResultPrimitives";
import { ArtifactCharts, label } from "./panels/AnalyticsPanel";

const RISK_LABELS: Record<string, string> = {
  annualized_volatility: "组合年化波动率", max_drawdown: "组合最大回撤", historical_var_95: "单日历史VaR 95%",
  historical_cvar_95: "单日历史CVaR 95%", historical_var_99: "单日历史VaR 99%", historical_cvar_99: "单日历史CVaR 99%",
};

/** Only existing structured findings and series are promoted; no figures are inferred from prose. */
export function KeyInsights({ snapshot }: { snapshot: RunSnapshot }) {
  const records = Object.values(snapshot.state.task_results ?? {});
  const warnings = [...new Set(records.flatMap((record) => {
    const result = record.result as AnalyticsResult | StrategyResult | null;
    return [
      ...(record.error ? [`${record.question}：${record.error.message}`] : []),
      ...(["failed", "blocked", "unsupported", "partial"].includes(record.status) ? [`${record.question}：${record.status === "partial" ? "仅部分完成。" : "本项未完成，不能视为已获得有效结果。"}`] : []),
      ...(result && "missing_information" in result ? result.missing_information : []),
      ...(result && "limitations" in result ? result.limitations : []),
    ];
  }))];
  return <>
    {warnings.length > 0 && <Notice tone="warn"><ul className="zh-insight-notices">{warnings.map((text) => <li key={text}>{text}</li>)}</ul></Notice>}
    {records.filter((record) => record.category === "analytics" && record.result).map((record) => {
      const result = record.result as unknown as AnalyticsResult;
      return <section className="zh-key-insights" key={record.task_id} aria-label="图表与关键数据">
        <h3>图表与关键数据</h3>
        {result.summary && <Markdown text={result.summary} />}
        {result.findings.map((finding) => {
          const artifact = snapshot.analysis_snapshots[record.task_id]?.[finding.analysis_id];
          return <div className="zh-insight-finding" key={finding.analysis_id}>
            <h4>{artifact?.dataset_refs.map((ref) => ref.security_name || ref.symbol).join(" · ") || record.question}</h4>
            {artifact && <p className="zh-muted">{artifact.start_date} 至 {artifact.end_date} · 样本 {artifact.sample_size} · 来源：{[...new Set(artifact.dataset_refs.map((ref) => ref.provider))].join("、") || "未提供"}{artifact.dataset_refs.some((ref) => ref.data_mode === "mock") ? " · 模拟数据" : ""}</p>}
            <div className="metric-row">{Object.entries(finding.metrics).slice(0, 6).map(([key, value]) => <div key={key}>
              <span>{label(key)}</span><strong>{formatByUnit(value, finding.metric_units[key])}</strong>
            </div>)}</div>
            {artifact && <ArtifactCharts artifact={artifact} limit={2} />}
          </div>;
        })}
      </section>;
    })}
    {records.filter((record) => record.category === "investment_strategy" && record.result).map((record) => {
      const result = record.result as unknown as StrategyResult;
      return <section className="zh-key-insights" key={record.task_id} aria-label="组合关键数据">
        <h3>组合关键数据</h3>
        {result.summary && <Markdown text={result.summary} />}
        {result.risk_results.map((row, index) => {
          const metrics = (row.metrics ?? row) as Record<string, number | null>;
          return <div key={index}><p className="zh-muted">{String(row.start_date ?? "")} 至 {String(row.end_date ?? "")} · 历史回放</p>
            <div className="metric-row">{Object.entries(metrics).filter(([key]) => key in RISK_LABELS).slice(0, 6).map(([key, value]) => <div key={key}>
              <span>{RISK_LABELS[key]}</span><strong>{formatByUnit(value, "fraction")}</strong>
            </div>)}</div></div>;
        })}
        {result.scenario_results.map((row, index) => typeof row.portfolio_return === "number" && <div className="metric-row" key={index}><div>
          <span>{String(row.name ?? "假设情景")} · 组合收益</span><strong>{formatByUnit(row.portfolio_return, "fraction")}</strong><small>情景结果不代表预测</small>
        </div></div>)}
        {Object.entries(snapshot.strategy_series[record.task_id] ?? {}).flatMap(([id, groups]) => Object.entries(groups).filter(([, points]) => points.length > 0).map(([key, points]) =>
          <div className="chart-card" key={`${id}-${key}`}><h4>{key === "portfolio_nav" ? "组合历史回放净值" : key === "portfolio_value" ? "情景期间组合价值" : key}</h4>
            <LineChart unit="multiple" series={[{ name: "组合", points }]} />
            <p className="zh-chart-caption">{points[0].date} 至 {points[points.length - 1].date} · 根据已提供的持仓假设回放，不是真实持仓业绩，也不预示未来。</p>
          </div>))}
      </section>;
    })}
    {records.filter((record) => record.category === "report" && ["completed", "partial"].includes(record.status)).map((record) =>
      <p key={record.task_id}><Link className="zh-report-entry" to={`/reports/${snapshot.run_id}/${record.task_id}`}>阅读与下载：{record.question}</Link></p>)}
  </>;
}
