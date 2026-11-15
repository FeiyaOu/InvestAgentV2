# 多轮会话与 Checkpointer（V4 第 1 步）

决策日期：2026-11-15。取代此前“无 checkpoint、Streamlit 显式传入三轮摘要”的权宜做法。
本节只改父图状态与接线；Planner、Supervisor、Composer 与四个专家子图内部不变。

## 两层状态

| 层 | 字段 | 生命周期 |
|---|---|---|
| 本轮请求 | user_query、conversation_context、plan、planning_*、task_results、supervisor_*、final_response、composition_*、clarification_rounds、clarifications | 每次 invoke 由 `initialize` 全量重建 |
| 线程累积 | `turns`（append-only reducer `add_turns`） | 仅在 checkpointer 下跨 invoke 保留；`initialize` 从不写它 |

每个 turn 记录 `query`、`response_preview`（≤1200 字）、`status`、`clarifications`、`completed_at`，
由 `record_turn` 节点在 Composer 之后追加。无效输入（空问题）不生成 turn。

## 上下文推导

`initialize` 中：线程已有 turns 时，`conversation_context = summarize_turns(turns)`（最近 3 轮，
格式与原 Streamlit 摘要一致）；线程为空时才使用调用方传入的 `conversation_context`。
调用方传入的上下文在后续轮次被视为可能过期，一律忽略。

### Docker 验收补充（2026-11-15）

最近三轮摘要同时经父图、Supervisor 传给 Market Data 子图的 `conversation_context`，
用于回答“刚才查询哪只股票”等追问。摘要是待分析数据，不是新指令或实时行情证据；
不跨轮复用 DatasetStore。仅让 Planner 读取摘要时，任务改写遗漏主体会导致专家丢失指代。

## 澄清中断

仅在传入 checkpointer 时接入 `clarify` 节点。Planner 返回 needs_clarification 且
`clarification_rounds < MAX_CLARIFICATION_ROUNDS`（=2）时路由到 `clarify`，调用 `interrupt` 挂起：

```json
{"type": "clarification", "questions": ["哪家公司？"], "round": 1, "max_rounds": 2}
```

调用方以 `Command(resume="<用户回答>")` 恢复。空白回答原地重新中断并附 `error`，不消耗轮次。
有效回答追加到 `user_query`（“补充说明：…”）与 `clarifications`，重置 planning 字段后回到 Planner。
轮次耗尽或无 checkpointer 时沿用原路径：Composer 直接返回澄清问题文本。

## 公共入口

- `create_invest_agent(checkpointer=None)`：默认无状态，与旧行为一致。
- 开发/测试用 `SqliteSaver`（`langgraph-checkpoint-sqlite`），生产用 `PostgresSaver`，与业务表同库。
- `run_invest_agent` 保持 request-local；不接受 thread_id。
- Streamlit 调试面板暂不接 checkpointer，继续显式传摘要。

## 明确不做

- 不把 DatasetStore / AnalysisStore / StrategyStore 放进状态；跨轮复用分析产物另行设计。
- checkpointer 不承担报告列表、用户归属、权限；这些属于 API 层业务表。
- 不做 checkpoint 自动清理；保留策略随 API 层持久化一起定。

## 验收

`tests/test_conversation_memory.py`：同线程两轮上下文推导与 turns 累积、线程隔离、显式上下文仅首轮生效、
中断/恢复/空回答重问/轮次上限、无 checkpointer 时无 clarify 节点、无效输入不写历史、门面默认无状态。
原有 test_parent_graph / test_agent / test_parent_state 全部保持通过。
