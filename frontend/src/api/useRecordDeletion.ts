import { useQueryClient } from "@tanstack/react-query";
import { deleteConversation, deleteReport, deleteRun } from "./client";

export const canDeleteRun = (status: string) => ["completed", "failed", "cancelled"].includes(status);
export const DELETE_RUN_MESSAGE = "删除这次研究及其关联报告？此操作无法撤销。对话上下文仍会保留；如需一并清除，请删除整个对话。";

export function useRecordDeletion() {
  const client = useQueryClient();
  const refresh = async () => {
    await Promise.all(["runs", "conversations", "conversation", "reports"].map((key) => client.invalidateQueries({ queryKey: [key] })));
  };
  return {
    removeRun: async (id: string) => { await deleteRun(id); await refresh(); },
    removeReport: async (id: string) => {
      await deleteReport(id);
      client.removeQueries({ queryKey: ["report", id] });
      await refresh();
    },
    removeConversation: async (id: string) => { await deleteConversation(id); await refresh(); },
  };
}
