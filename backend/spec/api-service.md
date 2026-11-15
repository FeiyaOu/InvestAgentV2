# FastAPI 服务层（V4 第 2 步）

决策日期：2026-11-15。在核心库之上加一层薄 HTTP 服务，供 React 工作台调用。
核心库 `src/` 不变；Streamlit 调试面板继续直连图。

## 组成

| 模块 | 职责 |
|---|---|
| `api/main.py` | 应用工厂 `create_app(graph=None, settings=None, max_workers=None)`；生产启动时打开 SqliteSaver 并构建 `create_invest_agent(checkpointer=...)` |
| `api/events.py` | 纯函数事件归并器：把 `graph.stream(subgraphs=True, stream_mode=["updates","custom"])` 的三元组归一为有序事件，并维护可回放的 `RunView` |
| `api/runs.py` | `RunRecord` / `RunStore`（内存）/ `RunManager`（有界线程池，thread_id = conversation_id） |
| `api/routes/runs.py` | 创建、查询、事件列表、SSE 流、恢复澄清 |
| `api/routes/conversations.py` | 从 checkpointer 读 turns，合并本进程已知 runs |
| `api/settings.py` | `INVEST_CHECKPOINT_DB`、`INVEST_MAX_CONCURRENT_RUNS`、`INVEST_CORS_ORIGINS`、`INVEST_SSE_POLL_SECONDS` |

## 接口

```text
GET  /api/health
POST /api/runs                        {query, conversation_id?} → 202 {run_id, conversation_id, status}
GET  /api/runs/{id}                   快照：status、state、report_progress、analysis_snapshots、strategy_series、interrupt…
GET  /api/runs/{id}/events?after=N    SSE：先回放 seq>N 的事件，再实时跟随，直到 completed/failed/waiting_input
GET  /api/runs/{id}/events/list?after=N  同一事件序列的 JSON 数组（调试/非流式客户端）
POST /api/runs/{id}/resume            {answer} → 202；仅 waiting_input 可恢复，否则 409
GET  /api/conversations/{id}          {conversation_id, turns, runs}
```

run 状态机：`queued → running → completed | failed | waiting_input`；`waiting_input` 经 resume 回到 `queued`。

## 事件

每个事件：`{seq, run_id, type, at, scope, task_id, category, payload}`。`scope` 为 `parent` 或子图命名空间。

| type | 来源 | payload |
|---|---|---|
| run_queued / run_started / run_waiting / run_finished | RunManager | query、resumed、status、error、elapsed_seconds |
| planner_attempt、task_started、analysis_artifacts、strategy_artifacts、strategy_diagnostic、analytics_diagnostic | custom 流 | 原始自定义事件 |
| node_update | updates 流 | `node`、`details`（白名单字段，消息已脱敏）、`state`（仅根节点或子图 task_results 的增量） |
| report_progress | report 子图 | `task_id`、`fields`（perception_data / world_model / reasoning_plans / selected_plan） |
| clarification_required | `__interrupt__` | `{type, questions, round, max_rounds}` |
| clarification_answered | resume | `answer` |

归并规则与原 Streamlit `_run` 一致：只有根节点更新进入父快照；子图更新仅在包含 `task_results` 时提升；
`last_task_id` 等局部通道不进入快照。前端按 seq 顺序把 `payload.state` 合并即可重建 `state`。

## 运行边界

- 同步图在线程池中执行，`max_workers` 即并发上限，超出的请求保持 `queued`。
- 图异常不外泄：run 标记 failed，`error.detail` 只含异常类名。
- SSE 采用短轮询内存事件列表（默认 0.2s），Nginx 需 `X-Accel-Buffering: no`（响应头已带）。
- LangFuse 回调可选，未配置时静默跳过。

## 暂未实现（第 4 步）

用户与鉴权、conversation 归属校验、runs/events/reports 落库、重启后 run 恢复、报告中心接口、Markdown/HTML 下载。
当前 RunStore 为进程内存，重启后 `GET /api/runs/{id}` 丢失；checkpoint 中的 turns 不受影响。

## 验收

`tests/test_api_events.py`（归并器）与 `tests/test_api_runs.py`（TestClient + 脚本化 graph）：
创建/轮询/事件回放/SSE/中断-恢复-409/异常脱敏/校验与 404/会话读取。
真实启动：`make api` 后 `/api/health`、`/openapi.json` 可用，SqliteSaver 自动建表。
