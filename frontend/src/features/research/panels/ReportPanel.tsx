import { Link } from "react-router-dom";
import type { ReportTaskResult, TaskResult } from "../../../api/types";
import { Icon } from "../../../components/Icon";
import { Notice, StatusBadge } from "../../../components/ResultPrimitives";

const STAGES: [string, string][] = [
  ["perception_data", "感知"],
  ["world_model", "建模"],
  ["reasoning_plans", "推理"],
  ["selected_plan", "决策"],
];

export function ReportPanel({
  record,
  runId,
  progress,
  active,
}: {
  record: TaskResult | undefined;
  runId: string;
  progress: Record<string, unknown> | undefined;
  active: boolean;
  question: string;
  taskId: string;
}) {
  const result = (record?.result ?? null) as ReportTaskResult | null;
  const readable = record && (record.status === "completed" || record.status === "partial") && result?.final_report;
  const stages = STAGES.map(([key, label]) => ({ key, label, done: Boolean(progress?.[key] || (result as Record<string, unknown> | null)?.[key]) }));
  return (
    <article className="zh-task">
      <header className="zh-task-head">
        <div>
          <b>{record?.question}</b>
          <small>任务 {record?.task_id} · Report</small>
        </div>
        {record ? <StatusBadge status={record.status} /> : <span className="zh-badge gray">{active ? "生成中" : "排队中"}</span>}
      </header>
      <div className="zh-stages">
        {stages.map((stage, i) => (
          <span key={stage.key} className={stage.done ? "done" : active && !record && stages.slice(0, i).every((s) => s.done) ? "active" : ""}>
            {stage.label}
          </span>
        ))}
        <span className={record ? "done" : ""}>校验</span>
      </div>
      {record?.error && <Notice tone="error">[{record.error.type}] {record.error.message}</Notice>}
      {record?.status === "partial" && <Notice tone="warn">报告未完全通过 C1–C7 校验，以草稿形式提供阅读与下载。</Notice>}
      {readable ? (
        <Link className="zh-link-button" to={`/reports/${runId}/${record!.task_id}`}>
          <Icon name="report" size={16} /> 前往报告中心阅读与下载
        </Link>
      ) : (
        <p className="zh-muted">报告正文不在此处重复展示；完成后可在「报告中心」阅读与下载。</p>
      )}
    </article>
  );
}
