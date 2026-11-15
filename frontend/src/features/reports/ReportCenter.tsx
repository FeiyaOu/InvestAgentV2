import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { downloadReport, getReport, listReports } from "../../api/client";
import type { ReportSummary } from "../../api/types";
import { Icon } from "../../components/Icon";
import { Notice } from "../../components/ResultPrimitives";

export const DIMENSIONS: Record<string, string> = { fundamental: "基本面", market: "市场", news: "新闻", analyst: "分析师" };
export const RATINGS: Record<string, string> = { buy: "买入", hold: "持有", sell: "卖出" };

function useReports() {
  return useQuery({ queryKey: ["reports"], queryFn: listReports, staleTime: 10_000 });
}

export function ReportCenter() {
  const reports = useReports();
  const navigate = useNavigate();
  const items: ReportSummary[] = reports.data ?? [];
  return (
    <div className="workspace-page">
      <div className="workspace-head">
        <div>
          <span>RESEARCH LIBRARY</span>
          <h1>报告中心</h1>
          <p>集中阅读与下载由研究任务生成的完整报告。</p>
        </div>
        <button onClick={() => navigate("/", { state: { prefill: "请生成新能源行业未来一年的投研报告，重点关注光伏。" } })}>
          <Icon name="plus" size={16} /> 试试生成报告
        </button>
      </div>
      {reports.error && <Notice tone="error">无法读取报告列表：{String(reports.error)}</Notice>}
      {reports.isSuccess && items.length === 0 && (
        <Notice>还没有报告。在首页提出“生成 XX 行业投研报告”的请求，完成后会出现在这里。</Notice>
      )}
      <div className="report-library">
        {items.map((entry) => (
          <article key={entry.id}>
            <Link className={`library-cover ${entry.draft ? "gold" : "green"}`} to={`/reports/${entry.run_id}/${entry.task_id}`}>
              <span>ZH RESEARCH</span>
              <b>{entry.title || entry.question}</b>
              <small>{entry.report_date}</small>
            </Link>
            <div className="library-info">
              <span>{entry.industry_focus || "研究报告"}</span>
              <h2>{entry.title || entry.question}</h2>
              <p>
                {entry.draft ? "草稿" : "已完成"} · {RATINGS[entry.overall_rating] ?? entry.overall_rating} · {new Date(entry.created_at).toLocaleString("zh-CN")}
              </p>
            </div>
            <div className="library-actions">
              <Link to={`/reports/${entry.run_id}/${entry.task_id}`}>阅读</Link>
              <button aria-label="下载 Markdown" title="下载 Markdown" onClick={() => void downloadReport(entry.id, "md")}>
                <Icon name="download" size={15} />
              </button>
              <button aria-label="下载 HTML" title="下载 HTML" onClick={() => void downloadReport(entry.id, "html")}>
                <Icon name="file" size={15} />
              </button>
            </div>
          </article>
        ))}
      </div>
      {items.length > 0 && <div className="library-foot">已显示 {items.length} 份报告</div>}
    </div>
  );
}

export function ReportReader() {
  const { runId, taskId } = useParams();
  const navigate = useNavigate();
  const reports = useReports();
  const summary = reports.data?.find((r) => r.run_id === runId && r.task_id === taskId);
  const detail = useQuery({
    queryKey: ["report", summary?.id],
    queryFn: () => getReport(summary!.id),
    enabled: Boolean(summary),
  });
  if (reports.isLoading || (summary && detail.isLoading)) return null;
  if (!summary || !detail.data) {
    return (
      <div className="report-overlay">
        <div className="report-toolbar">
          <button className="report-close" onClick={() => navigate("/reports")}>
            <Icon name="close" size={19} />
          </button>
          <div>
            <b>报告不可用</b>
          </div>
        </div>
        <div className="report-reader">
          <div className="report-pages">
            <article className="report-page">
              <Notice tone="warn">这份报告尚未生成完成，或不是可读取的结构化报告。</Notice>
              {runId && (
                <Link className="zh-link-button" to={`/runs/${runId}`}>
                  查看对应研究
                </Link>
              )}
            </article>
          </div>
        </div>
      </div>
    );
  }
  const entry = detail.data;
  const r = entry.report;
  const chapters = ["核心观点", ...Object.entries(DIMENSIONS).filter(([k]) => r.dimensions?.[k]).map(([, v]) => v), "证据与风险", "来源"];
  return (
    <div className="report-overlay">
      <div className="report-toolbar">
        <button className="report-close" onClick={() => navigate(-1)}>
          <Icon name="close" size={19} />
        </button>
        <div>
          <b>{r.research_topic}</b>
          <span>
            {r.report_date} · {entry.draft ? "草稿" : "已通过校验"}
          </span>
        </div>
        <div className="report-toolbar-actions">
          <button onClick={() => void downloadReport(entry.id, "md")}>
            <Icon name="download" size={16} /> Markdown
          </button>
          <button onClick={() => void downloadReport(entry.id, "html")}>
            <Icon name="download" size={16} /> HTML
          </button>
        </div>
      </div>
      <div className="report-reader">
        <aside className="report-outline">
          <span>报告目录</span>
          {chapters.map((item, i) => (
            <a key={item} href={`#chapter-${i}`}>
              {item}
              <small>{i + 1}</small>
            </a>
          ))}
        </aside>
        <div className="report-pages">
          <article className="report-page cover-page">
            <div className="report-brand">
              <span>知衡研究</span>
              <small>ZH RESEARCH</small>
            </div>
            <div className="cover-rule"></div>
            <span className="report-type">{r.industry_focus}</span>
            <h1>{r.research_topic}</h1>
            <div className="cover-meta">
              <span>研究期限 {r.time_horizon}</span>
              <span>报告日期 {r.report_date}</span>
              <span>模型评级 {RATINGS[r.overall_rating] ?? r.overall_rating}</span>
            </div>
            {entry.draft && <Notice tone="warn">草稿：报告未完全通过 C1–C7 校验或任务仅部分完成。</Notice>}
            {entry.validation_errors.length > 0 && (
              <ul className="zh-errors">
                {entry.validation_errors.map((e, i) => (
                  <li key={i}>{e.detail}</li>
                ))}
              </ul>
            )}
          </article>
          <article className="report-page" id="chapter-0">
            <span className="page-kicker">核心观点</span>
            <h2>投资论点</h2>
            <p className="report-highlight">{r.investment_thesis}</p>
            <p className="zh-muted">评级是模型分析结论，不构成交易建议；置信度指模型对分析的信心，不是收益或事件概率。</p>
          </article>
          {Object.entries(DIMENSIONS).map(([key, label], i) => {
            const dim = r.dimensions?.[key];
            if (!dim) return null;
            return (
              <article className="report-page" key={key} id={`chapter-${i + 1}`}>
                <span className="page-kicker">0{i + 1} 维度分析</span>
                <h2>{label}</h2>
                <p>{dim.summary}</p>
                <div className="confidence">
                  <span>
                    <i style={{ width: `${Math.round(Number(dim.confidence) * 100)}%` }}></i>
                  </span>
                  分析置信度 {Math.round(Number(dim.confidence) * 100)}%
                </div>
              </article>
            );
          })}
          <article className="report-page" id={`chapter-${chapters.length - 2}`}>
            <span className="page-kicker">证据与风险</span>
            <h2>支撑证据</h2>
            <ul>
              {(r.supporting_evidence ?? []).map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
            <h2>风险因素</h2>
            <ul>
              {(r.risk_factors ?? []).map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </article>
          <article className="report-page" id={`chapter-${chapters.length - 1}`}>
            <span className="page-kicker">来源</span>
            <h2>数据与信息来源</h2>
            <ul>
              {(r.sources ?? []).map((s, i) => (
                <li key={i}>
                  {/^https?:\/\/[^\s<>"]+$/.test(s) ? (
                    <a href={s} target="_blank" rel="noreferrer noopener">
                      {s}
                    </a>
                  ) : (
                    s
                  )}
                </li>
              ))}
            </ul>
          </article>
        </div>
      </div>
    </div>
  );
}
