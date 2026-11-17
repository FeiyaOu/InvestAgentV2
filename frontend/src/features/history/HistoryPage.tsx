import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { listConversations } from "../../api/client";
import { useRecordDeletion } from "../../api/useRecordDeletion";
import { DeleteButton } from "../../components/DeleteButton";
import { Icon } from "../../components/Icon";
import { Notice } from "../../components/ResultPrimitives";
import { useSession } from "../../state/session";

const STATUS: Record<string, string> = {
  completed: "已完成", partial: "部分完成", failed: "未完成", needs_clarification: "需要补充信息",
  waiting_input: "等待补充", running: "进行中", queued: "排队中", cancelling: "正在停止", cancelled: "已停止",
};

export function HistoryPage() {
  const { conversationId, setConversationId } = useSession();
  const [search, setSearch] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const { removeConversation } = useRecordDeletion();
  const conversations = useQuery({ queryKey: ["conversations"], queryFn: listConversations, staleTime: 10_000 });
  const visible = (conversations.data ?? []).filter((c) => c.title.includes(search));
  return <div className="workspace-page">
    <div className="workspace-head"><div><span>ACTIVITY</span><h1>研究记录</h1>
      <p>每个对话集中保存问题、追问与研究结果，打开后可继续讨论。</p></div>
      <label className="history-search"><Icon name="search" size={15} />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索对话标题" /></label>
    </div>
    {deleteError && <Notice tone="error">删除失败：{deleteError}</Notice>}
    <div className="history-summary">
      <div><strong>{conversations.data?.length ?? 0}</strong><span>对话</span></div>
      <div><strong>{(conversations.data ?? []).reduce((total, c) => total + c.run_count, 0)}</strong><span>提问与追问</span></div>
    </div>
    <section className="history-panel"><div className="history-panel-head"><b>研究对话</b><span>{visible.length} 个</span></div>
      {conversations.error && <Notice tone="error">无法读取对话：{String(conversations.error)}</Notice>}
      <div className="history-list">{visible.map((c) => <div className="zh-history-row" key={c.conversation_id}>
        <Link className={`zh-turn ${c.conversation_id === conversationId ? "active" : ""}`} to={`/conversations/${c.conversation_id}`}>
          <span className="history-icon"><Icon name="chat" size={18} /></span>
          <span className="history-main"><b>{c.title || "研究对话"}</b>
            <small>{c.run_count} 轮提问 · {new Date(c.updated_at).toLocaleString("zh-CN")}</small></span>
          <span className={`history-status ${c.last_status ?? ""}`}><i />{STATUS[c.last_status ?? ""] ?? ""}</span>
          <Icon name="arrow" size={15} />
        </Link>
        <DeleteButton label={`删除对话：${c.title || "研究对话"}`}
          message="删除整个对话及其全部研究记录、报告和对话记忆？此操作无法撤销。"
          disabled={["queued", "running", "cancelling", "waiting_input"].includes(c.last_status ?? "")}
          onError={setDeleteError} onDelete={async () => {
            setDeleteError(null); await removeConversation(c.conversation_id);
            if (conversationId === c.conversation_id) setConversationId(null);
          }} />
      </div>)}
      {conversations.isSuccess && visible.length === 0 && <p className="zh-muted">暂无对话。</p>}
      </div>
    </section>
  </div>;
}
