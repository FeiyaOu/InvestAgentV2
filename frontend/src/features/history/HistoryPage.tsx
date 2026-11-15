import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { ApiError, getConversation } from "../../api/client";
import { Icon } from "../../components/Icon";
import { Notice } from "../../components/ResultPrimitives";
import { useSession } from "../../state/session";

const STATUS: Record<string, string> = {
  completed: "已完成",
  partial: "部分完成",
  failed: "未完成",
  needs_clarification: "需要补充信息",
};

export function HistoryPage() {
  const { conversationId, runs } = useSession();
  const [search, setSearch] = useState("");
  const conversation = useQuery({
    queryKey: ["conversation", conversationId],
    queryFn: () => getConversation(conversationId),
    retry: false,
  });
  const turns = conversation.data?.turns ?? [];
  const notFound = conversation.error instanceof ApiError && conversation.error.status === 404;
  const visibleRuns = runs.filter((r) => r.query.includes(search));

  return (
    <div className="workspace-page">
      <div className="workspace-head">
        <div>
          <span>ACTIVITY</span>
          <h1>研究记录</h1>
          <p>当前对话的历史轮次来自服务端线程记忆；下方运行列表来自本浏览器。</p>
        </div>
        <label className="history-search">
          <Icon name="search" size={15} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索研究记录" />
        </label>
      </div>
      <div className="history-summary">
        <div>
          <strong>{turns.length}</strong>
          <span>当前对话轮次</span>
        </div>
        <div>
          <strong>{runs.length}</strong>
          <span>本浏览器发起的研究</span>
        </div>
        <div>
          <strong>{turns.filter((t) => t.status === "completed").length}</strong>
          <span>完整完成的轮次</span>
        </div>
      </div>

      <section className="history-panel">
        <div className="history-panel-head">
          <b>当前对话 · {conversationId}</b>
          <span>{turns.length} 轮</span>
        </div>
        {conversation.isLoading && <p className="zh-muted">读取中…</p>}
        {notFound && <Notice>这个对话还没有完成的轮次。</Notice>}
        {conversation.error && !notFound && <Notice tone="error">无法读取对话：{String(conversation.error)}</Notice>}
        <div className="history-list">
          {turns
            .filter((t) => t.query.includes(search))
            .map((turn, i) => (
              <div className="zh-turn" key={`${turn.completed_at}-${i}`}>
                <span className="history-icon">
                  <Icon name="chat" size={18} />
                </span>
                <span className="history-main">
                  <b>{turn.query}</b>
                  <small>{turn.response_preview.slice(0, 160)}</small>
                </span>
                <span className="history-duration">{new Date(turn.completed_at).toLocaleString("zh-CN")}</span>
                <span className={`history-status ${turn.status}`}>
                  <i></i>
                  {STATUS[turn.status] ?? turn.status}
                </span>
              </div>
            ))}
        </div>
      </section>

      <section className="history-panel">
        <div className="history-panel-head">
          <b>本浏览器发起的研究</b>
          <span>共 {visibleRuns.length} 项</span>
        </div>
        <div className="history-list">
          {visibleRuns.map((run) => (
            <Link to={`/runs/${run.runId}`} key={run.runId} className="zh-turn">
              <span className="history-icon">
                <Icon name="search" size={18} />
              </span>
              <span className="history-main">
                <b>{run.query}</b>
                <small>
                  {run.conversationId === conversationId ? "当前对话" : run.conversationId} · {new Date(run.createdAt).toLocaleString("zh-CN")}
                </small>
              </span>
              <Icon name="arrow" size={15} />
            </Link>
          ))}
          {visibleRuns.length === 0 && <p className="zh-muted">暂无记录。</p>}
        </div>
      </section>
    </div>
  );
}
