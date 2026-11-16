import ReactECharts from "echarts-for-react";
import type { SeriesPoint } from "../api/types";

export interface LineSeries {
  name: string;
  points: SeriesPoint[];
  area?: boolean;
}

/** Read CSS theme tokens; fallbacks also support server-rendered result previews. */
function chartTheme() {
  const style = typeof document === "undefined" ? undefined : getComputedStyle(document.documentElement);
  const token = (name: string, fallback: string) => style?.getPropertyValue(`--color-${name}`).trim() || fallback;
  return {
    primary: token("chart-primary", "#557d98"),
    light: token("chart-primary-light", "#8ba9bc"),
    secondary: token("chart-secondary", "#b5a066"),
    benchmark: token("chart-benchmark", "#aaa28f"),
    grid: token("chart-grid", "#e8ecef"),
    axis: token("chart-axis", "#9aa5ad"),
    text: token("text-secondary", "#5f7180"),
    background: token("page-bg", "#f4f6f8"),
    up: token("up", "#bd5b50"),
    down: token("down", "#4f8068"),
  };
}

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
  const colors = chartTheme();
  const option = {
    animation: false,
    color: [colors.primary, colors.secondary, colors.light, colors.benchmark, colors.up],
    textStyle: { color: colors.text },
    grid: { containLabel: true, left: 56, right: 16, top: 28, bottom: 36 },
    tooltip: {
      trigger: "axis",
      valueFormatter: (value: number) => formatByUnit(value, unit),
    },
    legend: series.length > 1 ? { top: 0, textStyle: { fontSize: 13.2, color: colors.text } } : undefined,
    xAxis: { type: "category", data: dates, boundaryGap: false, axisLabel: { color: colors.axis, fontSize: 12, hideOverlap: true } },
    yAxis: {
      type: "value",
      scale: true,
      axisLabel: { color: colors.axis, fontSize: 12, formatter: (value: number) => formatByUnit(value, unit) },
      splitLine: { lineStyle: { color: colors.grid, type: "dashed" } },
    },
    series: series.map((s, index) => {
      const byDate = new Map(s.points.map((p) => [p.date, p.value]));
      return {
        name: s.name,
        type: "line",
        showSymbol: false,
        connectNulls: false,
        smooth: false,
        lineStyle: { width: 2 },
        areaStyle: s.area ? {
          color: {
            type: "linear", x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: [colors.primary, colors.secondary, colors.light, colors.benchmark, colors.up][index % 5] },
              { offset: 1, color: "transparent" },
            ],
          },
          opacity: 0.2,
        } : undefined,
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
  const colors = chartTheme();
  const option = {
    animation: false,
    color: [colors.primary, colors.secondary, colors.light, colors.benchmark, colors.up],
    textStyle: { color: colors.text },
    grid: { containLabel: true, left: 56, right: 16, top: 20, bottom: 36 },
    tooltip: { trigger: "axis", valueFormatter: (value: number) => formatByUnit(value, unit) },
    xAxis: { type: "category", data: categories, axisLabel: { color: colors.axis, fontSize: 13.2 } },
    yAxis: { type: "value", splitLine: { lineStyle: { color: colors.grid, type: "dashed" } }, axisLabel: { color: colors.axis, fontSize: 12, formatter: (value: number) => formatByUnit(value, unit) } },
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
  const colors = chartTheme();
  const option = {
    animation: false,
    grid: { containLabel: true, left: 90, right: 60, top: 10, bottom: 50 },
    tooltip: { position: "top" },
    xAxis: { type: "category", data: labels, axisLabel: { color: colors.axis, fontSize: 12 } },
    yAxis: { type: "category", data: labels, axisLabel: { color: colors.axis, fontSize: 12 } },
    visualMap: { textStyle: { color: colors.axis }, min: -1, max: 1, calculable: false, orient: "horizontal", left: "center", bottom: 0, inRange: { color: [colors.down, colors.background, colors.up] } },
    series: [{ type: "heatmap", data, label: { show: true, fontSize: 12 } }],
  };
  return <ReactECharts option={option} style={{ height }} notMerge lazyUpdate opts={{ renderer: "svg" }} />;
}
