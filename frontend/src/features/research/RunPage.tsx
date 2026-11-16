import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useRun } from "../../api/useRun";
import { CATEGORY_LABELS, TERMINAL, buildSteps, evidenceCount, runHeadline, type ProgressStep } from "../../api/runView";
import type { RunSnapshot, TaskCategory } from "../../api/types";
import { Icon } from "../../components/Icon";
import { Markdown } from "../../components/Markdown";
import { Notice, SectionTitle } from "../../components/ResultPrimitives";
import { AnalyticsPanel } from "./panels/AnalyticsPanel";
import { MarketDataPanel } from "./panels/MarketDataPanel";
import { ReportPanel } from "./panels/ReportPanel";
import { StrategyPanel } from "./panels/StrategyPanel";

const STATE_TEXT: Record<ProgressStep["state"], string> = {
  done: "已完成",
  active: "进行中",
  pending: "等待中",
  partial: "部分完成",
  failed: "未完成",
};

const SECTIONS: [TaskCategory, string, string][] = [
  ["market_data", "数据与证据", "Market Data 采集的行情、估值与证据，均标注来源、日期与数据模式"],
  ["analytics", "分析结果", "基于本次采集数据的确定性计算，指标单位与参数见各计算产物"],
  ["investment_strategy", "策略与风险", "约束检查、组合风险与情景结果；历史回放不代表未来"],
  ["report", "研究报告", "完整报告在「报告中心」阅读与下载"],
];

function ProgressPanel({ snapshot, elapsed }: { snapshot: RunSnapshot; elapsed: number }) {
  const steps = buildSteps(snapshot);
  const tasks = steps.slice(1, -1);
  const finished = tasks.filter((s) => s.state === "done" || s.state === "partial" || s.state === "failed").length;
  return (
    <section className="loading-panel">
      <div className="research-orbit">
        <span></span>
        <Icon name="spark" size={23} />
      </div>
      <h2>{snapshot.status === "cancelling" ? "正在停止研究" : snapshot.status === "queued" ? "排队等待执行" : "正在进行深度研究"}</h2>
      <p>
        已用时 {elapsed} 秒{tasks.length ? ` · 已完成 ${finished}/${tasks.length} 个任务` : ""}
      </p>
      {snapshot.status === "cancelling" && <p className="zh-muted">等待已发出的请求返回，之后不再执行后续步骤。</p>}
      <div className="research-steps">
        {steps.map((step, index) => (
          <div className={`research-step ${step.state}`} key={`${step.label}-${index}`}>
            <span>{step.state === "active" ? <i></i> : index + 1}</span>
            <b>{step.label}</b>
            <small className="zh-step-detail">{step.detail}</small>
            <small>{STATE_TEXT[step.state]}</small>
          </div>
        ))}
      </div>
    </section>
  );
}

function ClarificationCard({ snapshot, onResume }: { snapshot: RunSnapshot; onResume: (answer: string) => Promise<void> }) {
  const [answer, setAnswer] = useState("");
  const [sending, setSending] = useState(false);
  const interrupt = snapshot.interrupt!;
  return (
    <section className="zh-clarify">
      <div className="zh-clarify-head">
        <Icon name="chat" size={18} />
        <div>
          <b>需要你补充信息</b>
          <span>
            第 {interrupt.round}/{interrupt.max_rounds} 轮澄清 · 回答后将重新规划任务
          </span>
        </div>
      </div>
      <ol>
        {interrupt.questions.map((q) => (
          <li key={q}>{q}</li>
        ))}
      </ol>
      {interrupt.error && <Notice tone="warn">{interrupt.error}</Notice>}
      <div className="zh-clarify-input">
        <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="例如：贵州茅台，过去一年，前复权" rows={2} />
        <button
          className="run-button"
          disabled={!answer.trim() || sending}
          onClick={async () => {
            setSending(true);
            try {
              await onResume(answer.trim());
              setAnswer("");
            } finally {
              setSending(false);
            }
          }}
        >
          <Icon name="send" size={15} /> 提交补充
        </button>
      </div>
    </section>
  );
}

export function Answer({ snapshot, elapsed }: { snapshot: RunSnapshot; elapsed: number }) {
  const [copied, setCopied] = useState(false);
  const state = snapshot.state;
  const summary = state.composition_summary;
  const full = state.final_response ?? "";
  const details = summary && full.startsWith(summary) ? full.slice(summary.length).replace(/^\s*---\s*/, "") : summary ? full : "";
  const results = state.task_results ?? {};
  const planned = state.plan?.tasks ?? [];
  let section = 0;
  return (
    <section className="answer">
      <div className="answer-head">
        <div className="ai-mark">
          <Icon name="spark" size={18} />
        </div>
        <div>
          <b>知衡研究助手</b>
          <span>
            {runHeadline(snapshot)} · 用时 {elapsed} 秒 · {evidenceCount(state)} 条数据证据
          </span>
        </div>
        <div className="answer-actions">
          <button
            onClick={() => {
              navigator.clipboard?.writeText(full).catch(() => undefined);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1200);
            }}
          >
            <Icon name="copy" size={15} />
            {copied ? "已复制" : "复制"}
          </button>
        </div>
      </div>

      {snapshot.error && <Notice tone="error">{snapshot.error.message}</Notice>}
      {snapshot.status === "cancelled" && <Notice>研究已停止，已产生的结果保留在下方。</Notice>}
      {state.planning_error && <Notice tone="error">[{state.planning_error.type}] {state.planning_error.message}</Notice>}
      {state.supervisor_error && <Notice tone="error">[{state.supervisor_error.type}] {state.supervisor_error.message}</Notice>}
      {state.composition_error && <Notice tone="warn">{state.composition_error.message}</Notice>}

      {(summary || (!details && full)) && (
        <div className="summary-card">
          <span className="summary-label">核心结论</span>
          <Markdown text={summary || full} />
        </div>
      )}

      {SECTIONS.map(([category, title, subtitle]) => {
        const tasks = planned.filter((t) => t.category === category);
        if (!tasks.length) return null;
        section += 1;
        return (
          <div className="result-section" key={category}>
            <SectionTitle index={section} title={title} subtitle={subtitle} aside={`${tasks.length} 个任务`} />
            {tasks.map((task) => {
              const record = results[task.task_id];
              if (!record && snapshot.status === "cancelled") {
                return <article className="zh-task" key={task.task_id}><b>{task.question}</b><span className="zh-badge gray">已停止</span></article>;
              }
              if (category === "report") {
                return (
                  <ReportPanel
                    key={task.task_id}
                    record={record}
                    runId={snapshot.run_id}
                    progress={snapshot.report_progress[task.task_id]}
                    active={snapshot.active_task === task.task_id && !TERMINAL.includes(snapshot.status)}
                    question={task.question}
                    taskId={task.task_id}
                  />
                );
              }
              if (!record) {
                return (
                  <article className="zh-task" key={task.task_id}>
                    <header className="zh-task-head">
                      <div>
                        <b>{task.question}</b>
                        <small>任务 {task.task_id} · {CATEGORY_LABELS[task.category]}</small>
                      </div>
                      <span className="zh-badge gray">{snapshot.active_task === task.task_id ? "进行中" : "等待中"}</span>
                    </header>
                  </article>
                );
              }
              if (category === "market_data") return <MarketDataPanel key={task.task_id} record={record} />;
              if (category === "analytics")
                return <AnalyticsPanel key={task.task_id} record={record} artifacts={snapshot.analysis_snapshots[task.task_id] ?? {}} />;
              return <StrategyPanel key={task.task_id} record={record} series={snapshot.strategy_series[task.task_id] ?? {}} />;
            })}
          </div>
        );
      })}

      {details && (
        <details className="zh-details zh-full-answer">
          <summary>逐任务汇总全文</summary>
          <Markdown text={details} />
        </details>
      )}
      {!summary && !full && TERMINAL.includes(snapshot.status) && <p className="zh-muted">本轮没有可汇总的回答。</p>}
    </section>
  );
}

export function RunPage({ onFollowUp, submitting }: { onFollowUp: (query: string) => void; submitting: boolean }) {
  const { runId } = useParams();
  const navigate = useNavigate();
  const { snapshot, loading, error, elapsed, resume, cancel } = useRun(runId);
  const [followUp, setFollowUp] = useState("");
  const [stopping, setStopping] = useState(false);
  const [stopError, setStopError] = useState<string | null>(null);

  if (error) {
    return (
      <div className="result-content">
        <div className="result-wrap">
          <Notice tone="error">无法读取这次研究：{error}</Notice>
          <button className="run-button" onClick={() => navigate("/")}>
            返回首页
          </button>
        </div>
      </div>
    );
  }
  if (loading || !snapshot) {
    return (
      <div className="result-content">
        <div className="result-wrap">
          <div className="question-card">
            <span>你的问题</span>
            <h1>加载中…</h1>
          </div>
        </div>
      </div>
    );
  }
  const running = !TERMINAL.includes(snapshot.status);
  const waiting = snapshot.status === "waiting_input" && snapshot.interrupt;
  const planned = snapshot.state.plan?.tasks ?? [];
  const showAnswer = !running && !waiting;
  const partialResults = running && planned.length > 0 && Object.keys(snapshot.state.task_results ?? {}).length > 0;

  return (
    <div className="result-content">
      <div className="result-wrap">
        <div className="result-breadcrumb">
          <span>当前对话</span>
          <b>/</b>
          <span>{snapshot.conversation_id}</span>
        </div>
        <div className="question-card compact">
          <div>
            <span>你的问题</span>
            <h1>{snapshot.query}</h1>
          </div>
          {(running || waiting) && (
            <button className="zh-stop-button" disabled={stopping || snapshot.status === "cancelling"}
              onClick={async () => {
                setStopping(true);
                setStopError(null);
                try { await cancel(); }
                catch (err) { setStopError(err instanceof Error ? err.message : String(err)); }
                finally { setStopping(false); }
              }}>
              {stopping || snapshot.status === "cancelling" ? "正在停止…" : "停止研究"}
            </button>
          )}
        </div>
        {stopError && <Notice tone="error">停止失败：{stopError}</Notice>}
        {running && <ProgressPanel snapshot={snapshot} elapsed={elapsed} />}
        {waiting && <ClarificationCard snapshot={snapshot} onResume={resume} />}
        {(showAnswer || partialResults) && <Answer snapshot={snapshot} elapsed={elapsed} />}
      </div>
      {showAnswer && (
        <div className="followup-bar">
          <div>
            <Icon name="spark" size={16} />
            <input
              aria-label="继续追问"
              value={followUp}
              placeholder="基于以上结果继续追问…"
              onChange={(event) => setFollowUp(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && followUp.trim() && !submitting) {
                  onFollowUp(followUp.trim());
                  setFollowUp("");
                }
              }}
            />
            <span>同一对话 · 最近 3 轮进入上下文</span>
            <button
              disabled={!followUp.trim() || submitting}
              onClick={() => {
                onFollowUp(followUp.trim());
                setFollowUp("");
              }}
            >
              <Icon name="send" size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
