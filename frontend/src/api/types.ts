/** Domain contracts mirrored from backend Pydantic models (src/orchestration, src/specialists, api/). */

export type TaskCategory = "market_data" | "analytics" | "investment_strategy" | "report";
export type TaskStatus = "completed" | "partial" | "failed" | "blocked" | "unsupported";
export type RunStatus = "queued" | "running" | "completed" | "failed" | "waiting_input";

export interface TaskError {
  type: string;
  message: string;
}

export interface PlanTask {
  task_id: string;
  category: TaskCategory;
  question: string;
  depends_on: string[];
}

export interface TaskPlan {
  status: "ready" | "needs_clarification";
  tasks: PlanTask[];
  clarification_questions: string[];
}

export interface TaskResult extends PlanTask {
  status: TaskStatus;
  result: Record<string, unknown> | null;
  error: TaskError | null;
}

export interface MarketEvidence {
  tool_call_id: string;
  tool_name: string;
  content: string;
  retrieved_at: string;
  status: "returned" | "error";
  data_mode: string;
  source_url?: string | null;
  as_of_date?: string | null;
}

export interface MarketDataResult {
  answer: string;
  evidence_ids: string[];
  evidence: MarketEvidence[];
  missing_information: string[];
  dataset_refs?: DatasetRef[];
}

export interface DatasetRef {
  dataset_id?: string;
  symbol?: string;
  security_name?: string;
  kind?: string;
  provider?: string;
  source_url?: string;
  start_date?: string;
  end_date?: string;
  retrieved_at?: string;
  data_mode?: string;
  adjustment?: string | null;
  currency?: string;
}

export interface AnalyticsFinding {
  analysis_id: string;
  tool_name: string;
  metrics: Record<string, number | null>;
  metric_units: Record<string, string>;
  table: Record<string, unknown>[];
}

export interface MissingDataRequest {
  kind: string;
  subjects: string[];
  time_range: string;
  reason: string;
}

export interface AnalyticsResult {
  summary: string;
  findings: AnalyticsFinding[];
  analysis_refs: Record<string, unknown>[];
  chart_refs: { analysis_id: string; series_key: string }[];
  dataset_refs: DatasetRef[];
  assumptions: Record<string, unknown>;
  limitations: string[];
  missing_information: string[];
  missing_data_requests: MissingDataRequest[];
}

export interface SeriesPoint {
  date: string;
  value: number;
}

export interface AnalysisArtifact {
  analysis_id: string;
  tool_name: string;
  dataset_refs: DatasetRef[];
  created_at: string;
  start_date: string;
  end_date: string;
  sample_size: number;
  metrics: Record<string, number | null>;
  metric_units: Record<string, string>;
  assumptions: Record<string, unknown>;
  limitations: string[];
  table: Record<string, unknown>[];
  series: Record<string, SeriesPoint[]>;
}

export interface StrategyClaim {
  text: string;
  evidence_ids: string[];
}

export interface StrategyResult {
  summary: string;
  opportunities: StrategyClaim[];
  risks: StrategyClaim[];
  artifact_refs: Record<string, unknown>[];
  scenario_results: Record<string, unknown>[];
  constraint_checks: Record<string, unknown>[];
  risk_results: Record<string, unknown>[];
  dataset_refs: DatasetRef[];
  analysis_refs: Record<string, unknown>[];
  evidence: Record<string, unknown>[];
  assumptions: Record<string, unknown>;
  limitations: string[];
  missing_information: string[];
  missing_data_requests: MissingDataRequest[];
}

export interface ReportDimension {
  summary: string;
  confidence: number;
}

export interface FinalReport {
  research_topic: string;
  industry_focus: string;
  time_horizon: string;
  report_date: string;
  dimensions: Record<string, ReportDimension>;
  investment_thesis: string;
  supporting_evidence: string[];
  overall_rating: "buy" | "hold" | "sell";
  risk_factors: string[];
  sources: string[];
}

export interface ValidationError {
  type: string;
  detail: string;
  fix?: string;
}

export interface ReportTaskResult {
  final_report?: FinalReport | string | null;
  validation_errors?: ValidationError[] | null;
  perception_data?: unknown;
  world_model?: unknown;
  reasoning_plans?: unknown;
  selected_plan?: unknown;
  current_phase?: string;
}

export interface ParentState {
  user_query?: string;
  conversation_context?: string;
  plan?: TaskPlan | null;
  planning_status?: "ready" | "needs_clarification" | "failed" | null;
  planning_error?: TaskError | null;
  planning_attempts?: number;
  task_results?: Record<string, TaskResult>;
  supervisor_status?: "running" | "completed" | "partial" | "failed" | "needs_clarification" | null;
  supervisor_error?: TaskError | null;
  final_response?: string | null;
  composition_status?: "completed" | "fallback" | "needs_clarification" | "failed" | null;
  composition_error?: TaskError | null;
  composition_summary?: string | null;
  clarification_rounds?: number;
  clarifications?: string[];
  turns?: ConversationTurn[];
}

export interface ClarificationInterrupt {
  type: "clarification";
  questions: string[];
  round: number;
  max_rounds: number;
  error?: string;
}

export interface RunSnapshot {
  run_id: string;
  conversation_id: string;
  query: string;
  status: RunStatus;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  error: { type: string; message: string; detail?: string } | null;
  elapsed_seconds: number | null;
  event_count: number;
  state: ParentState;
  report_progress: Record<string, Record<string, unknown>>;
  analysis_snapshots: Record<string, Record<string, AnalysisArtifact>>;
  strategy_series: Record<string, Record<string, Record<string, SeriesPoint[]>>>;
  planner_attempts: Record<string, unknown>[];
  active_task: string | null;
  active_category: TaskCategory | null;
  interrupt: ClarificationInterrupt | null;
}

export interface RunEvent {
  seq: number;
  run_id: string;
  type: string;
  at: string;
  scope: string;
  task_id: string | null;
  category: TaskCategory | null;
  payload: Record<string, unknown>;
}

export interface ConversationTurn {
  query: string;
  response_preview: string;
  status: string;
  clarifications?: string[];
  completed_at: string;
}

export interface ConversationView {
  conversation_id: string;
  title: string;
  turn_count: number;
  turns: ConversationTurn[];
  runs: RunSnapshot[];
}

export interface RunListItem {
  run_id: string;
  conversation_id: string;
  query: string;
  status: RunStatus;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  elapsed_seconds: number | null;
  error: { type: string; message: string } | null;
  event_count: number;
}

export interface ConversationSummary {
  conversation_id: string;
  title: string;
  turn_count: number;
  last_status: string | null;
  run_count: number;
  created_at: string;
  updated_at: string;
}

export interface ReportSummary {
  id: string;
  run_id: string;
  task_id: string;
  conversation_id: string;
  question: string;
  title: string;
  industry_focus: string;
  time_horizon: string;
  report_date: string;
  overall_rating: string;
  status: "completed" | "partial";
  draft: boolean;
  validation_errors: ValidationError[];
  created_at: string;
}

export interface ReportDetail extends ReportSummary {
  report: FinalReport;
}
