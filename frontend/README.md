# 知衡研究工作台（frontend）

Vite + React 19 + TypeScript。所有结果页由后端事件驱动，不含任何硬编码研究数据。

```bash
npm install
npm run dev        # http://localhost:5173，/api 代理到 http://127.0.0.1:8000
npm run typecheck
npm test           # vitest：事件归并、报告导出、结果页服务端渲染
npm run build
```

## 结构

```text
src/
  api/        types.ts（后端 Pydantic 契约镜像）· client.ts（fetch）· runView.ts（事件归并与进度）· useRun.ts（快照 + SSE）
  state/      session.tsx：当前 conversation_id 与本浏览器发起的 runs（localStorage，仅作便利）
  components/ Icon · Markdown（禁用原始 HTML）· ResultPrimitives（状态徽标、表格、提示）
  charts/     ECharts 封装：LineChart / BarChart / Heatmap
  features/
    home/       首页：输入框、示例卡片（与 backend/app/example_queries.py 一致）、能力介绍
    research/   RunPage：进度面板、澄清卡片、Answer（核心结论 + 按 category 分发的四类任务面板）
    reports/    报告中心与阅读页；Markdown 导出结构与 backend/app/report_viewer.py 一致
    history/    研究记录：GET /api/conversations/{id} 的 turns + 本地 runs
```

## 数据流

1. 首页提交 → `POST /api/runs` → 记入 session → 跳转 `/runs/:runId`。
2. `useRun` 先 `GET /api/runs/:id` 取完整快照，未终止则用 `EventSource` 订阅 `/events?after=event_count`，
   用 `applyEvent` 按 seq 合并（规则与 backend/api/events.py 一致），收到 run_finished / run_waiting 后关闭。
3. `waiting_input` 时显示澄清卡片，`POST /resume` 后重新订阅。
4. 结果页按 `state.plan.tasks` 的 category 渲染：MarketDataPanel、AnalyticsPanel（指标 + 图表来自
   `analysis_snapshots` 的结构化 series）、StrategyPanel（`strategy_series`）、ReportPanel（阶段进度 + 跳转报告中心）。

## 约定

- 图表只画后端结构化产物（AnalysisArtifact.series / 策略 series / 同口径估值表），不从文字猜数字。
- 不展示规格已否决的内容：置信度百分比（报告维度置信度除外，且注明含义）、领先方、已交叉验证、数据服务正常。
- 模型文本经 react-markdown 渲染，`skipHtml`，仅 http(s) 链接可点击。
- 新增样式使用 `zh-*` 前缀追加在 index.css 末尾，原型样式类保持可复用。
- 持久化（用户、对话列表、报告库、HTML/PDF 下载）由第 4 步后端接口提供；当前报告中心与本地 runs 列表依赖服务进程内存。
