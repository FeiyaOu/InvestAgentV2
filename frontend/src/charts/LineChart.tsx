import ReactECharts from "echarts-for-react";
import type { SeriesPoint } from "../api/types";

export interface LineSeries {
  name: string;
  points: SeriesPoint[];
  area?: boolean;
}

const PALETTE = ["#397c67", "#b9aa7b", "#5b7fa6", "#a85c50", "#7a6fa0"];

export function formatByUnit(value: number | null | undefined, unit?: string): string {
  if (value == null || !Number.isFinite(value)) return "不可用";
  if (unit === "fraction") return `${(value * 100).toFixed(2)}%`;
  if (unit === "percent") return `${value.toFixed(2)}%`;
  if (unit === "multiple") return `${value.toFixed(2)} 倍`;
  if (Math.abs(value) >= 1000) return value.toLocaleString("zh-CN", { maximumFractionDigits: 2 });
  return value.toFixed(Math.abs(value) < 1 ? 4 : 2);
}

/** Multi-series time line; gaps (null) are not connected, matching the Plotly dashboards. */
export function LineChart({ series, unit, height = 280 }: { series: LineSeries[]; unit?: string; height?: number }) {
  const dates = Array.from(new Set(series.flatMap((s) => s.points.map((p) => p.date)))).sort();
  const option = {
    animation: false,
    color: PALETTE,
    grid: { containLabel: true, left: 56, right: 16, top: 28, bottom: 36 },
    tooltip: {
      trigger: "axis",
      valueFormatter: (value: number) => formatByUnit(value, unit),
    },
    legend: series.length > 1 ? { top: 0, textStyle: { fontSize: 13.2 } } : undefined,
    xAxis: { type: "category", data: dates, boundaryGap: false, axisLabel: { fontSize: 12, hideOverlap: true } },
    yAxis: {
      type: "value",
      scale: true,
      axisLabel: { fontSize: 12, formatter: (value: number) => formatByUnit(value, unit) },
      splitLine: { lineStyle: { color: "#e4e8e5" } },
    },
    series: series.map((s) => {
      const byDate = new Map(s.points.map((p) => [p.date, p.value]));
      return {
        name: s.name,
        type: "line",
        showSymbol: false,
        connectNulls: false,
        smooth: false,
        lineStyle: { width: 2 },
        areaStyle: s.area ? { opacity: 0.18 } : undefined,
        data: dates.map((d) => byDate.get(d) ?? null),
      };
    }),
  };
  return <ReactECharts option={option} style={{ height }} notMerge lazyUpdate opts={{ renderer: "svg" }} />;
}

export function BarChart({
  categories,
  values,
  unit,
  height = 240,
}: {
  categories: string[];
  values: number[];
  unit?: string;
  height?: number;
}) {
  const option = {
    animation: false,
    color: PALETTE,
    grid: { containLabel: true, left: 56, right: 16, top: 20, bottom: 36 },
    tooltip: { trigger: "axis", valueFormatter: (value: number) => formatByUnit(value, unit) },
    xAxis: { type: "category", data: categories, axisLabel: { fontSize: 13.2 } },
    yAxis: { type: "value", axisLabel: { fontSize: 12, formatter: (value: number) => formatByUnit(value, unit) } },
    series: [{ type: "bar", data: values, barMaxWidth: 48, itemStyle: { borderRadius: [4, 4, 0, 0] } }],
  };
  return <ReactECharts option={option} style={{ height }} notMerge lazyUpdate opts={{ renderer: "svg" }} />;
}

export function Heatmap({
  labels,
  matrix,
  height = 280,
}: {
  labels: string[];
  matrix: (number | null)[][];
  height?: number;
}) {
  const data: [number, number, number][] = [];
  matrix.forEach((row, i) => row.forEach((v, j) => v != null && data.push([j, i, Number(v.toFixed(3))])));
  const option = {
    animation: false,
    grid: { containLabel: true, left: 90, right: 60, top: 10, bottom: 50 },
    tooltip: { position: "top" },
    xAxis: { type: "category", data: labels, axisLabel: { fontSize: 12 } },
    yAxis: { type: "category", data: labels, axisLabel: { fontSize: 12 } },
    visualMap: { min: -1, max: 1, calculable: false, orient: "horizontal", left: "center", bottom: 0, inRange: { color: ["#a85c50", "#f4f6f2", "#397c67"] } },
    series: [{ type: "heatmap", data, label: { show: true, fontSize: 12 } }],
  };
  return <ReactECharts option={option} style={{ height }} notMerge lazyUpdate opts={{ renderer: "svg" }} />;
}
