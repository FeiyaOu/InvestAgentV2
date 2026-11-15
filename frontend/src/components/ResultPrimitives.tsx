import type { ReactNode } from "react";
import type { TaskStatus } from "../api/types";

const BADGES: Record<TaskStatus, { label: string; tone: string }> = {
  completed: { label: "已完成", tone: "green" },
  partial: { label: "部分完成", tone: "orange" },
  failed: { label: "失败", tone: "red" },
  blocked: { label: "前置任务不可用", tone: "red" },
  unsupported: { label: "尚未接入", tone: "gray" },
};

export function StatusBadge({ status }: { status: TaskStatus }) {
  const badge = BADGES[status] ?? { label: status, tone: "gray" };
  return <span className={`zh-badge ${badge.tone}`}>{badge.label}</span>;
}

export function SectionTitle({
  index,
  title,
  subtitle,
  aside,
}: {
  index: number;
  title: string;
  subtitle?: string;
  aside?: ReactNode;
}) {
  return (
    <div className="result-title">
      <span>{String(index).padStart(2, "0")}</span>
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {aside && <small>{aside}</small>}
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn" | "error"; children: ReactNode }) {
  return <div className={`zh-notice ${tone}`}>{children}</div>;
}

export function KeyValueList({ items }: { items: [string, ReactNode][] }) {
  if (!items.length) return null;
  return (
    <dl className="zh-kv">
      {items.map(([key, value]) => (
        <div key={key}>
          <dt>{key}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Generic table for backend row lists; column order follows the first row. */
export function RecordTable({ rows, columns }: { rows: Record<string, unknown>[]; columns?: string[] }) {
  if (!rows.length) return null;
  const keys = columns ?? Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  return (
    <div className="data-table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {keys.map((key) => (
              <th key={key}>{key}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {keys.map((key) => (
                <td key={key}>{formatCell(row[key])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function formatCell(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "number") return Number.isFinite(value) ? (Math.abs(value) < 1 && value !== 0 ? value.toFixed(4) : value.toLocaleString("zh-CN", { maximumFractionDigits: 4 })) : "不可用";
  if (typeof value === "boolean") return value ? "是" : "否";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

export function Details({ summary, children }: { summary: string; children: ReactNode }) {
  return (
    <details className="zh-details">
      <summary>{summary}</summary>
      {children}
    </details>
  );
}
