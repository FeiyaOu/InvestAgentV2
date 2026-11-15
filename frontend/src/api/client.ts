import type { ConversationSummary, ConversationView, ReportDetail, ReportSummary, RunEvent, RunListItem, RunSnapshot } from "./types";

const BASE = "/api";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

let getToken: () => string | null = () => null;
let onUnauthorized: () => void = () => undefined;

export function setAuthHandlers(handlers: { getToken: () => string | null; onUnauthorized: () => void }) {
  getToken = handlers.getToken;
  onUnauthorized = handlers.onUnauthorized;
}

async function request<T>(path: string, init?: RequestInit, { auth = true }: { auth?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = { "content-type": "application/json", ...((init?.headers as Record<string, string>) ?? {}) };
  const token = auth ? getToken() : null;
  if (token) headers.authorization = `Bearer ${token}`;
  const response = await fetch(BASE + path, { ...init, headers });
  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = await response.json();
      detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail ?? body);
    } catch {
      /* non-JSON error body */
    }
    if (response.status === 401 && auth) onUnauthorized();
    throw new ApiError(response.status, detail);
  }
  return (await response.json()) as T;
}

// ---- auth ----

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: { id: string; email: string; display_name: string };
}

export function register(email: string, password: string, display_name: string) {
  return request<TokenResponse>("/auth/register", { method: "POST", body: JSON.stringify({ email, password, display_name }) }, { auth: false });
}

export function login(email: string, password: string) {
  return request<TokenResponse>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }, { auth: false });
}

export function me() {
  return request<TokenResponse["user"]>("/auth/me");
}

// ---- runs ----

export function createRun(query: string, conversationId: string | null) {
  return request<{ run_id: string; conversation_id: string; status: string }>("/runs", {
    method: "POST",
    body: JSON.stringify({ query, conversation_id: conversationId }),
  });
}

export function listRuns(limit = 50) {
  return request<RunListItem[]>(`/runs?limit=${limit}`);
}

export function getRun(runId: string) {
  return request<RunSnapshot>(`/runs/${runId}`);
}

export function listEvents(runId: string, after = 0) {
  return request<RunEvent[]>(`/runs/${runId}/events/list?after=${after}`);
}

export function resumeRun(runId: string, answer: string) {
  return request<RunSnapshot>(`/runs/${runId}/resume`, { method: "POST", body: JSON.stringify({ answer }) });
}

/** EventSource cannot set headers, so the token travels as a query parameter on this endpoint only. */
export function eventStreamUrl(runId: string, after: number) {
  const token = getToken();
  return `${BASE}/runs/${runId}/events?after=${after}${token ? `&token=${encodeURIComponent(token)}` : ""}`;
}

// ---- conversations ----

export function listConversations() {
  return request<ConversationSummary[]>("/conversations");
}

export function getConversation(conversationId: string) {
  return request<ConversationView>(`/conversations/${conversationId}`);
}

// ---- reports ----

export function listReports() {
  return request<ReportSummary[]>("/reports");
}

export function getReport(reportId: string) {
  return request<ReportDetail>(`/reports/${reportId}`);
}

export async function downloadReport(reportId: string, format: "md" | "html") {
  const token = getToken();
  const response = await fetch(`${BASE}/reports/${reportId}/download?format=${format}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    if (response.status === 401) onUnauthorized();
    throw new ApiError(response.status, response.statusText);
  }
  const disposition = response.headers.get("content-disposition") ?? "";
  const match = /filename\*=UTF-8''([^;]+)/.exec(disposition);
  const filename = match ? decodeURIComponent(match[1]) : `report.${format}`;
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
