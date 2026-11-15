# InvestAgentV4

任务型智能投研助手的产品化版本：LangGraph 多专家后端 + React 工作台前端。

```text
backend/    Python 核心库（src/）、FastAPI 服务层（api/）、Streamlit 调试面板（app/）、规格（spec/）
frontend/   Vite + React + TypeScript 工作台
reference/  原型与历史代码，只读，不纳入版本库
```

## 开发

```bash
make backend-install     # backend/.venv 与依赖
make backend-test        # 全部单元测试
make backend-lint        # ruff + 结构 lint
make backend-run         # Streamlit 调试面板
```

架构决策见 `backend/spec/project-architecture.md`；V4 多轮会话与 checkpointer 设计见 `backend/spec/conversation-memory.md`。
