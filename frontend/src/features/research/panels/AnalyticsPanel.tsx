import type { AnalysisArtifact, AnalyticsResult, TaskResult } from "../../../api/types";
import { BarChart, Heatmap, LineChart, formatByUnit } from "../../../charts/LineChart";
import { Markdown } from "../../../components/Markdown";
import { Details, KeyValueList, Notice, RecordTable, StatusBadge } from "../../../components/ResultPrimitives";

/** Labels follow backend app/analytics_dashboard.py so both shells name metrics identically. */
const LABELS: Record<string, string> = {
  period_return: "区间收益",
  annualized_volatility: "年化波动率",
  max_drawdown: "最大回撤",
  asset_period_return: "标的收益",
  benchmark_period_return: "基准收益",
  excess_period_return: "超额区间收益",
  beta: "Beta",
  correlation: "相关系数",
  tracking_error: "年化跟踪误差",
  momentum: "动量",
  sma_gap: "均线偏离",
  realized_volatility: "滚动年化波动率",
  volume_ratio: "量比",
  rsi: "RSI",
  macd_hist_pct: "MACD柱/收盘价",
  bollinger_pct_b: "布林带位置 %B",
  turnover: "平均换手率",
};
const SERIES: Record<string, string> = {
  cumulative_return: "累计价格收益",
  drawdown: "历史回撤",
  asset_cumulative_return: "标的",
  benchmark_cumulative_return: "基准",
};

function label(key: string) {
  return SERIES[key] ?? LABELS[key] ?? key;
}

function ArtifactCharts({ artifact }: { artifact: AnalysisArtifact }) {
  const charts: React.ReactNode[] = [];
  if (artifact.tool_name === "build_return_matrix" && artifact.table.length) {
    const labels = Array.from(new Set(artifact.table.flatMap((r) => [String(r.symbol_a), String(r.symbol_b)])));
    const matrix = labels.map((a) =>
      labels.map((b) => {
        if (a === b) return 1;
        const row = artifact.table.find(
          (r) => (r.symbol_a === a && r.symbol_b === b) || (r.symbol_a === b && r.symbol_b === a),
        );
        const value = row?.correlation;
        return typeof value === "number" ? value : null;
      }),
    );
    return (
      <div className="chart-card">
        <div className="chart-head"><div className="legend">收益相关系数</div></div>
        <Heatmap labels={labels} matrix={matrix} />
      </div>
    );
  }
  const consumed = new Set<string>();
  const benchmarkKeys = ["asset_cumulative_return", "benchmark_cumulative_return"];
  if (benchmarkKeys.some((k) => artifact.series[k]?.length)) {
    benchmarkKeys.forEach((k) => consumed.add(k));
    charts.push(
      <div className="chart-card" key="benchmark">
        <div className="chart-head"><div className="legend">标的与基准 · 累计价格收益</div></div>
        <LineChart
          unit="fraction"
          series={benchmarkKeys.filter((k) => artifact.series[k]?.length).map((k) => ({ name: SERIES[k], points: artifact.series[k] }))}
        />
      </div>,
    );
  }
  for (const [key, points] of Object.entries(artifact.series)) {
    if (consumed.has(key) || !points?.length) continue;
    charts.push(
      <div className="chart-card" key={key}>
        <div className="chart-head"><div className="legend">{label(key)}</div></div>
        <LineChart unit={artifact.metric_units[key] ?? "fraction"} series={[{ name: label(key), points, area: key === "drawdown" }]} />
      </div>,
    );
  }
  const metricNames = Array.from(new Set(artifact.table.map((r) => r.metric).filter((m): m is string => typeof m === "string")));
  for (const metric of metricNames) {
    const rows = artifact.table.filter((r) => r.metric === metric && typeof r.value === "number" && Number.isFinite(r.value as number));
    if (!rows.length) continue;
    const units = new Set(rows.map((r) => r.unit));
    const bases = new Set(rows.map((r) => r.basis));
    if (units.size !== 1 || bases.size !== 1 || bases.has(undefined) || bases.has(null)) continue;
    charts.push(
      <div className="chart-card" key={`valuation_${metric}`}>
        <div className="chart-head"><div className="legend">{metric} · {String([...bases][0])}</div></div>
        <BarChart categories={rows.map((r) => String(r.symbol ?? "未知"))} values={rows.map((r) => r.value as number)} unit={String([...units][0])} />
      </div>,
    );
  }
  return <>{charts}</>;
}

export function AnalyticsPanel({
  record,
  artifacts,
}: {
  record: TaskResult;
  artifacts: Record<string, AnalysisArtifact>;
}) {
  const result = record.result as AnalyticsResult | null;
  return (
    <article className="zh-task">
      <header className="zh-task-head">
        <div>
          <b>{record.question}</b>
          <small>任务 {record.task_id} · Analytics</small>
        </div>
        <StatusBadge status={record.status} />
      </header>
      {record.error && <Notice tone="error">[{record.error.type}] {record.error.message}</Notice>}
      {result?.summary && <Markdown text={result.summary} />}
      {result?.findings.map((finding) => {
        const artifact = artifacts[finding.analysis_id];
        const metrics = Object.entries(finding.metrics);
        return (
          <section className="zh-finding" key={finding.analysis_id}>
            <div className="zh-finding-head">
              <b>{finding.tool_name}</b>
              <small>
                {artifact ? `${artifact.start_date} 至 ${artifact.end_date} · 样本 ${artifact.sample_size}` : finding.analysis_id}
              </small>
            </div>
            {metrics.length > 0 && (
              <div className="metric-row">
                {metrics.slice(0, 8).map(([key, value]) => (
                  <div key={key}>
                    <span>{label(key)}</span>
                    <strong className={typeof value === "number" && value < 0 ? "negative" : ""}>{formatByUnit(value, finding.metric_units[key])}</strong>
                    <small>{finding.metric_units[key] ?? "单位未提供"}</small>
                  </div>
                ))}
              </div>
            )}
            {artifact && <ArtifactCharts artifact={artifact} />}
            {finding.table.length > 0 && (
              <Details summary={`明细表 · ${finding.table.length} 行`}>
                <RecordTable rows={finding.table} />
              </Details>
            )}
            {artifact && (artifact.limitations.length > 0 || Object.keys(artifact.assumptions).length > 0) && (
              <Details summary="计算假设与限制">
                <KeyValueList items={Object.entries(artifact.assumptions).map(([k, v]) => [k, String(v)] as [string, string])} />
                {artifact.limitations.map((text) => (
                  <p className="zh-muted" key={text}>限制：{text}</p>
                ))}
              </Details>
            )}
          </section>
        );
      })}
      {result?.missing_information.map((text) => (
        <Notice key={text} tone="warn">{text}</Notice>
      ))}
      {result?.missing_data_requests.map((req, i) => (
        <Notice key={i}>待补数据：{req.kind} · {req.subjects.join("、")} · {req.time_range}；{req.reason}</Notice>
      ))}
      {result && result.limitations.length > 0 && (
        <Details summary="分析限制">
          {result.limitations.map((text) => (
            <p className="zh-muted" key={text}>{text}</p>
          ))}
        </Details>
      )}
      {result && result.dataset_refs.length > 0 && (
        <Details summary={`数据来源 · ${result.dataset_refs.length} 个数据集`}>
          <RecordTable
            columns={["symbol", "security_name", "provider", "start_date", "end_date", "adjustment", "data_mode", "source_url"]}
            rows={result.dataset_refs as Record<string, unknown>[]}
          />
        </Details>
      )}
    </article>
  );
}
