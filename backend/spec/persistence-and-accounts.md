# 持久化与账号（V4 第 4 步）

决策日期：2026-11-15。业务表与 LangGraph checkpoint 表放在同一个数据库：开发期 SQLite 单文件，
生产 PostgreSQL（`INVEST_DATABASE_URL=postgresql+psycopg://...`，自动改用 PostgresSaver）。
核心库 `src/` 不变；checkpointer 仍只负责线程状态，归属、列表、报告库都在业务表。

## 表

| 表 | 关键字段 | 说明 |
|---|---|---|
| users | id, email(unique), password_hash(argon2), display_name | 邮箱密码账号 |
| conversations | id(=thread_id), user_id, title, turn_count, last_status, updated_at | 首次提问时创建；title 取首个问题 |
| runs | run_id, conversation_id, user_id, query, status, started/finished_at, elapsed_seconds, error, snapshot(JSON), event_count | `snapshot` 在终止态写入 RunView，重启后仍可 GET |
| run_events | run_id, seq, type, at, scope, task_id, category, payload(JSON) | 每个事件写穿，支持 `after` 回放 |
| reports | id, run_id, task_id, user_id, conversation_id, title, industry_focus, …, status, draft, report(JSON), validation_errors(JSON) | run 终止时从 completed/partial 的 report 任务提取；校验只用 validate_report |
| checkpoints / checkpoint_writes / checkpoint_blobs … | LangGraph 自建 | 不直接读写 |

## 鉴权与归属

- `POST /api/auth/register`（可用 `INVEST_ALLOW_REGISTRATION=false` 关闭）、`POST /api/auth/login` 返回 JWT（HS256，
  `INVEST_JWT_SECRET`，默认 72 小时）；`GET /api/auth/me`。
- 除 `/api/health` 与 auth 外全部需要 `Authorization: Bearer`。SSE 端点额外接受 `?token=`，因为 EventSource 不能带头。
- run / conversation / report 均按 user_id 过滤；他人资源返回 404，不泄露存在性。
  向他人的 conversation_id 发起 run 返回 403。
- 未设置 `INVEST_JWT_SECRET` 时每次进程启动随机密钥并告警，重启后全部会话失效；生产必须显式配置。

## 运行生命周期

`RunStore` 保留运行中的记录在内存以供低延迟 SSE，同时每个事件写入 run_events，状态变化写入 runs。
终止（completed/failed）时写 snapshot、提取 reports、更新 conversation（turn_count+1、last_status）并从内存移除。
`waiting_input` 的 run 继续驻留内存等待 resume。进程启动时 `queued/running` 的残留 run 标为
failed（`service_restarted`），因为同步图无法跨进程续跑；checkpoint 中的 turns 不受影响。

2026-11-16 补充：主动停止新增 cancelling/cancelled；取消终态同样保存 snapshot、已完成报告及事件，
对话 last_status 使用 cancelled。重启遗留 cancelling 任务归为 cancelled。取消不会删除历史或 checkpoint，
详见 `api-service.md` 的“主动停止与 SSE 生命周期”。数据库状态列为字符串，无需 schema 迁移。

## 接口变化

```text
POST /api/auth/register | login        GET /api/auth/me
GET  /api/runs?limit=                  当前用户最近的 run（不含 snapshot）
GET  /api/conversations                当前用户对话列表（title、turn_count、run_count、last_status）
GET  /api/conversations/{id}           + title/turn_count；turns 仍来自 checkpointer
GET  /api/reports                      报告库
GET  /api/reports/{id}                 含完整 report JSON
GET  /api/reports/{id}/download?format=md|html   services/report_export 生成，草稿文件名带 -draft
```

`services/report_export.py` 是报告 Markdown/HTML 导出的唯一实现，Streamlit 的 report_viewer 改为引用。

## 前端

登录页（注册/登录切换）；token 存 localStorage，任何 401 自动登出。会话仅记住“当前对话 id”，
对话列表、最近研究、报告库全部来自服务端；报告下载走后端接口。

## 未做

密码重置与邮箱验证；多设备会话撤销；checkpoint 保留策略与清理任务；PDF 导出；
Postgres 实机验证（代码路径已写，待部署步骤在 ECS 上验证）。

## 验收

`tests/test_api_persistence.py`：注册/登录/me/重复邮箱/弱密码；跨用户 404/403；
重启后 run 快照、事件回放、报告详情与 md/html 下载可用；partial 报告标草稿且校验错误来自 validate_report；
重启时残留 run 标 failed。`tests/test_api_runs.py` 全部改为带鉴权运行。
