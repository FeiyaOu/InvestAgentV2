import type { ConversationView, RunEvent, RunSnapshot } from "./types";

const BASE = "/api";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(BASE + path, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = await response.json();
      detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail ?? body);
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(response.status, detail);
  }
  return (await response.json()) as T;
}

export function createRun(query: string, conversationId: string) {
  return request<{ run_id: string; conversation_id: string; status: string }>("/runs", {
    method: "POST",
    body: JSON.stringify({ query, conversation_id: conversationId }),
  });
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

export function getConversation(conversationId: string) {
  return request<ConversationView>(`/conversations/${conversationId}`);
}

export function eventStreamUrl(runId: string, after: number) {
  return `${BASE}/runs/${runId}/events?after=${after}`;
}
