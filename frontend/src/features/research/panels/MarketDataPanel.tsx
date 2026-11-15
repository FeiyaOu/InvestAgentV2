import type { MarketDataResult, TaskResult } from "../../../api/types";
import { Markdown } from "../../../components/Markdown";
import { Details, Notice, RecordTable, StatusBadge } from "../../../components/ResultPrimitives";

export function MarketDataPanel({ record }: { record: TaskResult }) {
  const result = record.result as MarketDataResult | null;
  const evidence = result?.evidence ?? [];
  return (
    <article className="zh-task">
      <header className="zh-task-head">
        <div>
          <b>{record.question}</b>
          <small>任务 {record.task_id} · Market Data</small>
        </div>
        <StatusBadge status={record.status} />
      </header>
      {record.error && <Notice tone="error">[{record.error.type}] {record.error.message}</Notice>}
      {result?.answer ? <Markdown text={result.answer} /> : !record.error && <p className="zh-muted">数据查询未完成。</p>}
      {result?.missing_information?.map((text) => (
        <Notice key={text} tone="warn">{text}</Notice>
      ))}
      {evidence.length > 0 && (
        <Details summary={`数据证据 · ${evidence.length} 条`}>
          <RecordTable
            columns={["工具", "状态", "数据模式", "数据日期", "采集时间", "来源"]}
            rows={evidence.map((item) => ({
              工具: item.tool_name,
              状态: item.status,
              数据模式: item.data_mode,
              数据日期: item.as_of_date ?? "未提供",
              采集时间: item.retrieved_at,
              来源: item.source_url ?? "",
            }))}
          />
        </Details>
      )}
      {result?.dataset_refs && result.dataset_refs.length > 0 && (
        <Details summary={`结构化数据集 · ${result.dataset_refs.length} 个`}>
          <RecordTable
            columns={["symbol", "security_name", "kind", "provider", "start_date", "end_date", "adjustment", "data_mode"]}
            rows={result.dataset_refs as Record<string, unknown>[]}
          />
        </Details>
      )}
    </article>
  );
}
