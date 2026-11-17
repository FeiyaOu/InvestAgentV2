import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Navigate, useLocation, useParams } from "react-router-dom";
import { getConversation, getRun } from "../../api/client";
import { TERMINAL } from "../../api/runView";
import { Icon } from "../../components/Icon";
import { Notice } from "../../components/ResultPrimitives";
import { useSession } from "../../state/session";
import { ResearchTurn } from "./RunPage";

export function LegacyRunRedirect() {
  const { runId } = useParams();
  const run = useQuery({ queryKey: ["run-link", runId], queryFn: () => getRun(runId!), enabled: Boolean(runId), retry: false });
  if (run.error) return <Notice tone="error">无法读取这次研究：{String(run.error)}</Notice>;
  if (!run.data) return <p className="zh-muted">加载对话中…</p>;
  return <Navigate replace to={`/conversations/${run.data.conversation_id}#run-${runId}`} />;
}

export function ConversationPage({ onFollowUp, submitting }: {
  onFollowUp: (query: string, conversationId: string) => Promise<boolean>; submitting: boolean;
}) {
  const { conversationId } = useParams();
  const { setConversationId } = useSession();
  const { hash } = useLocation();
  const [question, setQuestion] = useState("");
  const bottom = useRef<HTMLDivElement>(null);
  const previousCount = useRef<number | null>(null);
  const conversation = useQuery({ queryKey: ["conversation", conversationId],
    queryFn: () => getConversation(conversationId!), enabled: Boolean(conversationId), retry: false,
    refetchInterval: (query) => query.state.data?.runs.some((run) => !TERMINAL.includes(run.status)) ? 3000 : false });
  const runs = conversation.data?.runs ?? [];
  const busy = runs.some((run) => !TERMINAL.includes(run.status) || run.status === "waiting_input");
  useEffect(() => {
    if (conversation.data) setConversationId(conversation.data.conversation_id);
  }, [conversation.data?.conversation_id, setConversationId]);
  useEffect(() => {
    if (!conversation.data) return;
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ block: "start" });
    else if (previousCount.current !== null && runs.length > previousCount.current) bottom.current?.scrollIntoView({ behavior: "smooth" });
    previousCount.current = runs.length;
  }, [runs.length, hash, Boolean(conversation.data)]);
  const send = async () => {
    if (!question.trim() || busy || submitting || !conversationId) return;
    if (await onFollowUp(question.trim(), conversationId)) setQuestion("");
  };
  if (conversation.error && !conversation.data) return <Notice tone="error">无法读取对话：{String(conversation.error)}</Notice>;
  if (!conversation.data) return <p className="zh-muted">加载对话中…</p>;
  return <div className="result-content"><div className="result-wrap">
    <div className="result-breadcrumb"><span>当前对话</span><b>/</b><span>{conversation.data.title || "研究对话"}</span></div>
    {conversation.error && <Notice tone="warn">暂时无法同步对话，已保留当前内容。正在进行的研究仍可在下方查看。</Notice>}
    {runs.length === 0 && <p className="zh-muted">这个对话暂无研究内容，可以在下方继续提问。</p>}
    {runs.map((run) => <div className="zh-conversation-message" id={`run-${run.run_id}`} key={run.run_id}><ResearchTurn runId={run.run_id} conversationId={conversationId!} initialSnapshot={run} /></div>)}
    <div ref={bottom} />
    <div className="followup-bar"><div>
      <Icon name="spark" size={16} />
      <input aria-label="继续追问" value={question} maxLength={2000} disabled={busy || submitting}
        placeholder={busy ? "本轮结束后可继续追问…" : "基于以上结果继续追问…"}
        onChange={(event) => setQuestion(event.target.value)}
        onKeyDown={(event) => { if (event.key === "Enter" && !event.nativeEvent.isComposing) void send(); }} />
      <button aria-label={submitting ? "正在发送" : "发送消息"} title="发送消息" disabled={!question.trim() || busy || submitting} onClick={() => void send()}>
        <Icon name="send" size={16} />
      </button>
    </div></div>
  </div></div>;
}
