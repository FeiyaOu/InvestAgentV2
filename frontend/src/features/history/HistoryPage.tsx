import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { getConversation, listConversations, listRuns } from "../../api/client";
import { canDeleteRun, DELETE_RUN_MESSAGE, useRecordDeletion } from "../../api/useRecordDeletion";
import { DeleteButton } from "../../components/DeleteButton";
import { Icon } from "../../components/Icon";
import { Notice } from "../../components/ResultPrimitives";
import { useSession } from "../../state/session";

const STATUS: Record<string, string> = {
  completed: "已完成",
  partial: "部分完成",
  failed: "未完成",
  needs_clarification: "需要补充信息",
  waiting_input: "等待补充",
  running: "进行中",
  queued: "排队中",
  cancelling: "正在停止",
  cancelled: "已停止",
};

export function HistoryPage() {
  const { conversationId, setConversationId } = useSession();
  const [search, setSearch] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const { removeRun, removeConversation } = useRecordDeletion();
  const conversations = useQuery({ queryKey: ["conversations"], queryFn: listConversations, staleTime: 10_000 });
  const runs = useQuery({ queryKey: ["runs", "all"], queryFn: () => listRuns(200), staleTime: 10_000 });
  const current = useQuery({
    queryKey: ["conversation", conversationId],
    queryFn: () => getConversation(conversationId!),
    enabled: Boolean(conversationId),
    retry: false,
  });
  const turns = current.data?.turns ?? [];
  const visibleRuns = (runs.data ?? []).filter((r) => r.query.includes(search));
  const visibleConversations = (conversations.data ?? []).filter((c) => c.title.includes(search));

  return (
    <div className="workspace-page">
      <div className="workspace-head">
        <div>
          <span>ACTIVITY</span>
          <h1>研究记录</h1>
          <p>你的全部对话与研究任务。选择一个对话后，新问题会延续它的上下文。</p>
        </div>
        <label className="history-search">
          <Icon name="search" size={15} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索研究记录" />
        </label>
      </div>
      {deleteError && <Notice tone="error">删除失败：{deleteError}</Notice>}
      <div className="history-summary">
        <div>
          <strong>{conversations.data?.length ?? 0}</strong>
          <span>对话</span>
        </div>
        <div>
          <strong>{runs.data?.length ?? 0}</strong>
          <span>研究任务</span>
        </div>
        <div>
          <strong>{(runs.data ?? []).filter((r) => r.status === "completed").length}</strong>
          <span>已完成</span>
        </div>
      </div>

      <section className="history-panel">
        <div className="history-panel-head">
          <b>对话</b>
          <span>{visibleConversations.length} 个</span>
        </div>
        {conversations.error && <Notice tone="error">无法读取对话：{String(conversations.error)}</Notice>}
        <div className="history-list">
          {visibleConversations.map((c) => (
            <div className="zh-history-row" key={c.conversation_id}>
            <button
              className={`zh-turn zh-turn-button ${c.conversation_id === conversationId ? "active" : ""}`}
              onClick={() => setConversationId(c.conversation_id)}
              title="设为当前对话"
            >
              <span className="history-icon">
                <Icon name="chat" size={18} />
              </span>
              <span className="history-main">
                <b>{c.title || c.conversation_id}</b>
                <small>
                  {c.turn_count} 轮 · {c.run_count} 次研究 · {new Date(c.updated_at).toLocaleString("zh-CN")}
                </small>
              </span>
              <span className={`history-status ${c.last_status ?? ""}`}>
                <i></i>
                {c.conversation_id === conversationId ? "当前对话" : STATUS[c.last_status ?? ""] ?? ""}
              </span>
            </button>
            <DeleteButton label={`删除对话：${c.title || c.conversation_id}`}
              message="删除整个对话及其全部研究记录、报告和对话记忆？此操作无法撤销。"
              disabled={(runs.data ?? []).some((run) => run.conversation_id === c.conversation_id && !canDeleteRun(run.status))}
              onError={setDeleteError} onDelete={async () => {
                setDeleteError(null);
                await removeConversation(c.conversation_id);
                if (conversationId === c.conversation_id) setConversationId(null);
              }} />
            </div>
          ))}
          {conversations.isSuccess && visibleConversations.length === 0 && <p className="zh-muted">暂无对话。</p>}
        </div>
      </section>

      {conversationId && (
        <section className="history-panel">
          <div className="history-panel-head">
            <b>当前对话的轮次</b>
            <span>{turns.length} 轮</span>
          </div>
          {current.isError && <Notice>这个对话还没有完成的轮次。</Notice>}
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
                  <DeleteButton label={`删除研究：${turn.query}`} message={DELETE_RUN_MESSAGE}
                    onError={setDeleteError} onDelete={async () => { setDeleteError(null); await removeRun(turn.run_id); }} />
                </div>
              ))}
          </div>
        </section>
      )}

      <section className="history-panel">
        <div className="history-panel-head">
          <b>研究任务</b>
          <span>共 {visibleRuns.length} 项</span>
        </div>
        <div className="history-list">
          {visibleRuns.map((run) => (
            <div className="zh-history-row" key={run.run_id}>
            <Link to={`/runs/${run.run_id}`} className="zh-turn">
              <span className="history-icon">
                <Icon name="search" size={18} />
              </span>
              <span className="history-main">
                <b>{run.query}</b>
                <small>
                  {run.conversation_id === conversationId ? "当前对话" : run.conversation_id} · {new Date(run.created_at).toLocaleString("zh-CN")}
                </small>
              </span>
              {run.elapsed_seconds != null && <span className="history-duration">{Math.round(run.elapsed_seconds)} 秒</span>}
              <span className={`history-status ${run.status}`}>
                <i></i>
                {STATUS[run.status] ?? run.status}
              </span>
              <Icon name="arrow" size={15} />
            </Link>
            <DeleteButton label={`删除研究：${run.query}`} message={DELETE_RUN_MESSAGE}
              disabled={!canDeleteRun(run.status)} onError={setDeleteError}
              onDelete={async () => { setDeleteError(null); await removeRun(run.run_id); }} />
            </div>
          ))}
          {runs.isSuccess && visibleRuns.length === 0 && <p className="zh-muted">暂无记录。</p>}
        </div>
      </section>
    </div>
  );
}
