import { useQueries } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getRun } from "../../api/client";
import { Icon } from "../../components/Icon";
import { Notice } from "../../components/ResultPrimitives";
import { useSession } from "../../state/session";
import { DIMENSIONS, RATINGS, downloadText, reportEntries, reportMarkdown, type ReportEntry } from "./reportModel";

function useSessionReports() {
  const { runs } = useSession();
  const queries = useQueries({
    queries: runs.map((run) => ({
      queryKey: ["run", run.runId],
      queryFn: () => getRun(run.runId),
      retry: false,
      staleTime: 30_000,
    })),
  });
  const entries: ReportEntry[] = [];
  queries.forEach((q) => q.data && entries.push(...reportEntries(q.data)));
  const pending = queries.some((q) => q.isLoading);
  const missing = queries.filter((q) => q.isError).length;
  return { entries, pending, missing };
}

function statusText(entry: ReportEntry) {
  if (!entry.report) return entry.status === "failed" ? "生成失败" : "生成中";
  return entry.draft ? "草稿" : "已完成";
}

export function ReportCenter() {
  const { entries, pending, missing } = useSessionReports();
  const navigate = useNavigate();
  return (
    <div className="workspace-page">
      <div className="workspace-head">
        <div>
          <span>RESEARCH LIBRARY</span>
          <h1>报告中心</h1>
          <p>集中阅读与下载由研究任务生成的完整报告。当前列出本浏览器发起的研究。</p>
        </div>
        <button onClick={() => navigate("/", { state: { prefill: "请生成新能源行业未来一年的投研报告，重点关注光伏。" } })}>
          <Icon name="plus" size={16} /> 试试生成报告
        </button>
      </div>
      {missing > 0 && <Notice tone="warn">有 {missing} 次研究的运行记录已不在服务内存中（服务重启会清空），持久化将在下一步接入。</Notice>}
      {entries.length === 0 && !pending && (
        <Notice>还没有报告。在首页提出“生成 XX 行业投研报告”的请求，完成后会出现在这里。</Notice>
      )}
      <div className="report-library">
        {entries.map((entry) => (
          <article key={`${entry.runId}-${entry.taskId}`}>
            <Link className={`library-cover ${entry.draft ? "gold" : "green"}`} to={entry.report ? `/reports/${entry.runId}/${entry.taskId}` : `/runs/${entry.runId}`}>
              <span>ZH RESEARCH</span>
              <b>{entry.report?.research_topic ?? entry.question}</b>
              <small>{entry.report?.report_date ?? ""}</small>
            </Link>
            <div className="library-info">
              <span>{entry.report?.industry_focus ?? "研究报告"}</span>
              <h2>{entry.report?.research_topic ?? entry.question}</h2>
              <p>
                {statusText(entry)} · {entry.report ? `${RATINGS[entry.report.overall_rating] ?? entry.report.overall_rating} · ` : ""}
                {new Date(entry.createdAt).toLocaleString("zh-CN")}
              </p>
            </div>
            <div className="library-actions">
              {entry.report ? (
                <>
                  <Link to={`/reports/${entry.runId}/${entry.taskId}`}>阅读</Link>
                  <button aria-label="下载 Markdown" onClick={() => downloadText(`${entry.report!.research_topic || "report"}${entry.draft ? "_draft" : ""}.md`, reportMarkdown(entry))}>
                    <Icon name="download" size={15} />
                  </button>
                </>
              ) : (
                <Link to={`/runs/${entry.runId}`}>查看研究</Link>
              )}
            </div>
          </article>
        ))}
      </div>
      {entries.length > 0 && <div className="library-foot">已显示 {entries.length} 份报告</div>}
    </div>
  );
}

export function ReportReader() {
  const { runId, taskId } = useParams();
  const navigate = useNavigate();
  const { entries, pending } = useSessionReports();
  const entry = entries.find((e) => e.runId === runId && e.taskId === taskId);
  if (pending && !entry) return null;
  if (!entry || !entry.report) {
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
              <Notice tone="warn">报告内容不是可读取的结构化报告，或该次研究已不在服务内存中。</Notice>
            </article>
          </div>
        </div>
      </div>
    );
  }
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
          <button onClick={() => downloadText(`${r.research_topic || "report"}${entry.draft ? "_draft" : ""}.md`, reportMarkdown(entry))}>
            <Icon name="download" size={16} /> 下载 Markdown
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
            {entry.errors.length > 0 && (
              <ul className="zh-errors">
                {entry.errors.map((e, i) => (
                  <li key={i}>{[e.constraint, e.message].filter(Boolean).join("：")}</li>
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
