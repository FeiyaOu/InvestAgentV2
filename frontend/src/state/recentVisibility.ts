type RecentStorage = Pick<Storage, "getItem" | "setItem">;
const key = (userId: string) => `investagent.hidden-recent.v1.${userId}`;
function browserStorage(): RecentStorage | undefined {
  try { return localStorage; } catch { return undefined; }
}
export function readHiddenRecent(userId: string | null, storage = browserStorage()): string[] {
  if (!userId) return [];
  try {
    const value: unknown = JSON.parse(storage?.getItem(key(userId)) ?? "[]");
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
  } catch { return []; }
}
export function hideRecent(ids: string[], runId: string, userId: string | null, storage = browserStorage()): string[] {
  const next = [...new Set([...ids, runId])];
  if (userId) {
    try { storage?.setItem(key(userId), JSON.stringify(next)); } catch { /* memory fallback */ }
  }
  return next;
}
