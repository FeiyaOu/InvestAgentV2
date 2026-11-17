import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Navigate, NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { createRun, listConversations } from "./api/client";
import { seedSubmittedRun } from "./api/submittedRun";
import { Icon, type IconName } from "./components/Icon";
import { LoginPage } from "./features/auth/LoginPage";
import { HistoryPage } from "./features/history/HistoryPage";
import { HomeView } from "./features/home/HomeView";
import { ReportCenter, ReportReader } from "./features/reports/ReportCenter";
import { ConversationPage, LegacyRunRedirect } from "./features/research/ConversationPage";
import { DeleteButton } from "./components/DeleteButton";
import { useRecordDeletion } from "./api/useRecordDeletion";
import { useAuth } from "./state/auth";
import { useSession } from "./state/session";

const NAV: { name: string; to: string; icon: IconName }[] = [
  { name: "当前对话", to: "/", icon: "chat" },
  { name: "报告中心", to: "/reports", icon: "file" },
  { name: "研究记录", to: "/history", icon: "clock" },
];

export default function App() {
  const { user, ready, logout } = useAuth();
  const location = useLocation();
  if (!ready) return null;
  if (location.pathname === "/login") {
    if (user && !user.is_guest) return <Navigate to="/" replace />;
    return <LoginPage />;
  }
  // A reopened guest page has no credentials for the old run/report URL.
  if (!user && location.pathname !== "/") return <Navigate to="/" replace />;
  return <Workbench key={user && !user.is_guest ? user.id : "guest"} userEmail={user?.email ?? ""}
    displayName={user?.display_name ?? "访客"} onLogout={logout} />;
}

function Workbench({ userEmail, displayName, onLogout }: { userEmail: string; displayName: string; onLogout: () => void }) {
  const { user, ensureGuest } = useAuth();
  const guest = !user || Boolean(user.is_guest);
  const { conversationId, setConversationId, newConversation } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { removeConversation } = useRecordDeletion();
  const recent = useQuery({ queryKey: ["conversations"], queryFn: listConversations, staleTime: 10_000, enabled: Boolean(user) });
  const visibleRecent = (recent.data ?? []).slice(0, 5);

  const submit = async (query: string, targetConversationId = conversationId) => {
    if (submitting) return false;
    setSubmitting(true);
    setSubmitError(null);
    try {
      if (guest) await ensureGuest();
      const created = await createRun(query, targetConversationId);
      await queryClient.cancelQueries({ queryKey: ["conversation", created.conversation_id] });
      seedSubmittedRun(queryClient, created, query);
      setConversationId(created.conversation_id);
      void queryClient.invalidateQueries({ queryKey: ["runs"] });
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
      const target = `/conversations/${created.conversation_id}`;
      if (location.pathname !== target) navigate(target);
      else if (location.hash) navigate(target, { replace: true });
      await queryClient.invalidateQueries({ queryKey: ["conversation", created.conversation_id] });
      return true;
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const startNewConversation = () => {
    newConversation();
    navigate("/");
  };

  const prefill = (location.state as { prefill?: string } | null)?.prefill;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={startNewConversation} aria-label="返回首页">
          <div className="brand-mark">
            <Icon name="spark" size={20} />
          </div>
          <span>知衡研究</span>
          <span className="beta">BETA</span>
        </button>

        <button className="new-chat" onClick={startNewConversation}>
          <Icon name="plus" size={17} /> 新对话
        </button>

        <nav className="nav-list" aria-label="主要导航">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to === "/" && conversationId ? `/conversations/${conversationId}` : item.to}
              end={item.to === "/"}
              className={({ isActive }) => (isActive || (item.to === "/" && /^\/(runs|conversations)\//.test(location.pathname)) ? "nav-item active" : "nav-item")}
            >
              <Icon name={item.icon} size={17} /> {item.name}
            </NavLink>
          ))}
        </nav>

        <div className="recent">
          <div className="section-label">最近研究</div>
          {recent.isSuccess && visibleRecent.length === 0 && <p className="zh-muted zh-recent-empty">暂无最近研究</p>}
          {visibleRecent.map((conversation) => (
            <div className="zh-recent-row" key={conversation.conversation_id}>
              <button className="zh-recent-open" onClick={() => navigate(`/conversations/${conversation.conversation_id}`)} title={conversation.title}>
                <span>{conversation.title || "研究对话"}</span>
                <small>{new Date(conversation.updated_at).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })}</small>
              </button>
              <DeleteButton label={`删除对话：${conversation.title || "研究对话"}`}
                message="删除整个对话及其全部研究记录、报告和对话记忆？此操作无法撤销。"
                disabled={["queued", "running", "cancelling", "waiting_input"].includes(conversation.last_status ?? "")}
                onError={(error) => setSubmitError(error)} onDelete={async () => {
                  await removeConversation(conversation.conversation_id);
                  if (conversationId === conversation.conversation_id) startNewConversation();
                }} />
            </div>
          ))}
        </div>

        <div className="sidebar-bottom">
          <button className="user-card" title={guest ? "登录后按账号保存历史和报告" : userEmail}
            onClick={() => { if (guest) navigate("/login"); else { onLogout(); navigate("/"); } }}>
            <div className="avatar">{(displayName || userEmail).slice(0, 1).toUpperCase()}</div>
            <span>
              <b>{guest ? "登录 / 注册" : displayName || userEmail}</b>
              <small>{guest ? "访客内容仅当前页面保留" : "点击退出登录"}</small>
            </span>
            <Icon name={guest ? "user" : "close"} size={16} />
          </button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="context-pill" title={conversationId ?? ""}>
            {conversationId ? `当前对话 ${conversationId.slice(-6)}` : "新对话"}
          </div>
          <div className="context-pill">{guest ? "访客模式 · 关闭或刷新后清空" : "同一对话内最近 3 轮进入上下文"}</div>
        </header>
        {submitError && <div className="zh-notice error zh-topnotice">提交失败：{submitError}</div>}
        <Routes>
          <Route path="/" element={<HomeView onRun={(q) => submit(q)} busy={submitting} initialQuery={prefill} />} />
          <Route path="/runs/:runId" element={<LegacyRunRedirect />} />
          <Route path="/conversations/:conversationId" element={<ConversationPage key={location.pathname} onFollowUp={(q, id) => submit(q, id)} submitting={submitting} />} />
          <Route path="/reports" element={<ReportCenter />} />
          <Route path="/reports/:runId/:taskId" element={<ReportReader />} />
          <Route path="/history" element={<HistoryPage />} />
        </Routes>
      </main>
    </div>
  );
}
