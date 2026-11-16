import { expect, it } from "vitest";
import { hideRecent, readHiddenRecent } from "./recentVisibility";

it("persists sidebar hiding per account without persisting guest activity", () => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); } };
  expect(hideRecent([], "run-a", "alice", storage)).toEqual(["run-a"]);
  expect(readHiddenRecent("alice", storage)).toEqual(["run-a"]);
  expect(readHiddenRecent("bob", storage)).toEqual([]);
  hideRecent([], "guest-run", null, storage);
  expect(readHiddenRecent(null, storage)).toEqual([]);
  expect(values.size).toBe(1);
});
