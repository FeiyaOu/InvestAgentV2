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
  state/      auth.tsx：JWT 与用户资料（401 自动登出）· session.tsx：当前 conversation_id（服务端分配）
  components/ Icon · Markdown（禁用原始 HTML）· ResultPrimitives（状态徽标、表格、提示）
  charts/     ECharts 封装：LineChart / BarChart / Heatmap
  features/
    auth/       登录/注册页
    home/       首页：输入框、示例卡片（与 backend/app/example_queries.py 一致）、能力介绍
    research/   ConversationPage：连续对话；RunPage 中 ResearchTurn：每轮进度、澄清卡片、Answer（核心结论 + 按 category 分发的四类任务面板）
    reports/    报告中心与阅读页：GET /api/reports，下载走 /api/reports/{id}/download
    history/    研究记录：按对话聚合，打开后查看各轮内容并继续追问
```

## 数据流

首页默认公开，可用访客模式开展研究。访客身份和内容仅保留于当前页面内存，关闭或刷新后清空；
点击侧栏“登录 / 注册”进入账号模式。账号历史和报告持久保存，访客内容不自动转存。
身份切换时清空查询缓存，当前对话按账号隔离保存；访客对话不写浏览器存储。

侧栏和研究记录每个对话只显示一条，删除会确认并删除整个对话；对话页每轮按钮只删除该轮。
报告中心删除只移除报告库条目。
删除单次研究连同事件和关联报告，但保留对话记忆；删除整个对话才清除 checkpoint。
未结束的研究须先停止。轮次列表使用服务端返回的 run_id，删除按钮独立于导航链接。

1. 首页提交 → `POST /api/runs` → 记入 session → 打开 `/conversations/:conversationId`；追问留在同一 URL，追加新一轮。
   旧 `/runs/:runId` 链接会自动定位到所属对话的对应轮次。
2. 对话页通过 `GET /api/conversations/:id` 加载全部轮次；每轮 `useRun` 先 `GET /api/runs/:id` 取完整快照，未终止则用 `EventSource` 订阅 `/events?after=event_count`，
   用 `applyEvent` 按 seq 合并（规则与 backend/api/events.py 一致），收到 run_finished / run_waiting 后关闭。
3. `waiting_input` 时显示澄清卡片，`POST /resume` 后重新订阅。
   运行、排队或等待补充时可点“停止研究”：`POST /cancel`，显示 cancelling → cancelled。
   离开页面只清理订阅，后台任务继续；SSE 具名事件和断线退避续订由 `api/runStream.ts` 管理。
4. 每轮默认展示核心观点、精选图表（每个分析产物最多两张）与关键指标（每项最多六个），附图表说明、日期和数据限制。
   “展开详细分析”默认收起，展开后才挂载全部任务面板及全文；报告阅读入口直接保留。
   完整结果按 `state.plan.tasks` 的 category 渲染：MarketDataPanel、AnalyticsPanel（指标 + 图表来自
   `analysis_snapshots` 的结构化 series）、StrategyPanel（`strategy_series`）、ReportPanel（阶段进度 + 跳转报告中心）。

## 约定

- 主题变量集中在 `src/theme.css`：低饱和板岩蓝／雾霾蓝为品牌色，冷灰白为基底，暖沙色仅作点缀。
- 金融颜色独立使用 `--color-up`（红涨）、`--color-down`（绿跌）及风险等级变量；完成状态使用 success 色。
- ECharts 从 CSS 主题变量读取配色，趋势线、坐标、网格与页面保持一致。

- 图表只画后端结构化产物（AnalysisArtifact.series / 策略 series / 同口径估值表），不从文字猜数字。
- 不展示规格已否决的内容：置信度百分比（报告维度置信度除外，且注明含义）、领先方、已交叉验证、数据服务正常。
- 模型文本经 react-markdown 渲染，`skipHtml`，仅 http(s) 链接可点击。
- 新增样式使用 `zh-*` 前缀追加在 index.css 末尾，原型样式类保持可复用。
- 所有列表按当前身份读取；账号模式在浏览器保存 JWT 与按用户区分的当前对话 id，访客模式仅用页面内存。
  SSE 以 `?token=` 携带 JWT（EventSource 不能设请求头）。

数据采集失败的轮次可点“重新执行本轮”，沿用原计划与run_id，在原位置更新进度。按钮注明会重跑全部任务，旧结果可在“之前的执行记录”中展开。

行业行情首页示例明确使用最近5个已完成交易日，避免“近期”被理解成单日或自然日。
