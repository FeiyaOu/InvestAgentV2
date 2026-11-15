import { useState } from "react";
import { Icon } from "../../components/Icon";
import { useAuth } from "../../state/auth";

export function LoginPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const canSubmit = /\S+@\S+\.\S+/.test(email) && password.length >= 8 && !busy;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === "login") await login(email, password);
      else await register(email, password, displayName);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="zh-auth">
      <form
        className="zh-auth-card"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="brand zh-auth-brand">
          <div className="brand-mark">
            <Icon name="spark" size={20} />
          </div>
          <span>知衡研究</span>
          <span className="beta">BETA</span>
        </div>
        <h1>{mode === "login" ? "登录工作区" : "创建账号"}</h1>
        <p className="zh-muted">研究记录、对话与报告按账号保存。</p>
        <label>
          邮箱
          <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          密码（至少 8 位）
          <input
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {mode === "register" && (
          <label>
            显示名称（可选）
            <input value={displayName} maxLength={40} onChange={(e) => setDisplayName(e.target.value)} />
          </label>
        )}
        {error && <div className="zh-notice error">{error}</div>}
        <button className="run-button" type="submit" disabled={!canSubmit}>
          {busy ? "请稍候…" : mode === "login" ? "登录" : "注册并登录"}
        </button>
        <button type="button" className="zh-auth-switch" onClick={() => setMode(mode === "login" ? "register" : "login")}>
          {mode === "login" ? "还没有账号？注册" : "已有账号？登录"}
        </button>
      </form>
    </div>
  );
}
