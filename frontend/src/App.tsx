import { useState } from "react";
import { NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { createRun } from "./api/client";
import { Icon, type IconName } from "./components/Icon";
import { HistoryPage } from "./features/history/HistoryPage";
import { HomeView } from "./features/home/HomeView";
import { ReportCenter, ReportReader } from "./features/reports/ReportCenter";
import { RunPage } from "./features/research/RunPage";
import { useSession } from "./state/session";

const NAV: { name: string; to: string; icon: IconName }[] = [
  { name: "当前对话", to: "/", icon: "chat" },
  { name: "报告中心", to: "/reports", icon: "file" },
  { name: "研究记录", to: "/history", icon: "clock" },
];

export default function App() {
  const { conversationId, runs, newConversation, addRun } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const submit = async (query: string, conversation = conversationId) => {
    if (submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const created = await createRun(query, conversation);
      addRun({ runId: created.run_id, conversationId: created.conversation_id, query, createdAt: new Date().toISOString() });
      navigate(`/runs/${created.run_id}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const startNewConversation = () => {
    newConversation();
    navigate("/");
  };

  const recent = runs.slice(0, 3);
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
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) => (isActive || (item.to === "/" && location.pathname.startsWith("/runs")) ? "nav-item active" : "nav-item")}
            >
              <Icon name={item.icon} size={17} /> {item.name}
            </NavLink>
          ))}
        </nav>

        <div className="recent">
          <div className="section-label">最近研究</div>
          {recent.length === 0 && <p className="zh-muted zh-recent-empty">还没有研究记录</p>}
          {recent.map((run) => (
            <button key={run.runId} onClick={() => navigate(`/runs/${run.runId}`)} title={run.query}>
              <span>{run.query}</span>
              <small>{new Date(run.createdAt).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })}</small>
            </button>
          ))}
        </div>

        <div className="sidebar-bottom">
          <button className="user-card">
            <div className="avatar">研</div>
            <span>
              <b>研究员</b>
              <small>个人工作区</small>
            </span>
            <Icon name="more" size={18} />
          </button>
          <button className="settings" aria-label="设置">
            <Icon name="settings" size={18} />
          </button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="context-pill" title={conversationId}>
            当前对话 {conversationId.slice(-6)}
          </div>
          <div className="context-pill">同一对话内最近 3 轮进入上下文</div>
        </header>
        {submitError && <div className="zh-notice error zh-topnotice">提交失败：{submitError}</div>}
        <Routes>
          <Route path="/" element={<HomeView onRun={(q) => submit(q)} busy={submitting} initialQuery={prefill} />} />
          <Route path="/runs/:runId" element={<RunPage onFollowUp={(q) => submit(q)} submitting={submitting} />} />
          <Route path="/reports" element={<ReportCenter />} />
          <Route path="/reports/:runId/:taskId" element={<ReportReader />} />
          <Route path="/history" element={<HistoryPage />} />
        </Routes>
      </main>
    </div>
  );
}
