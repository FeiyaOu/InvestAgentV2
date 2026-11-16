import { expect, it } from "vitest";
import { Credentials } from "./credentials";

function storage() {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, v); },
    removeItem: (k: string) => { data.delete(k); } };
}

it("keeps guest credentials only in memory, while account credentials survive reopening", () => {
  const disk = storage();
  const page = new Credentials(disk);
  page.accept("guest-secret", true);
  expect(page.token).toBe("guest-secret");
  expect(new Credentials(disk).token).toBeNull();
  page.accept("account-secret", false);
  expect(new Credentials(disk).token).toBe("account-secret");
  page.clear();
  expect(new Credentials(disk).token).toBeNull();
});

it("clears a guest on page close but retains a signed-in account", () => {
  const disk = storage();
  const page = new Credentials(disk);
  page.accept("guest-secret", true);
  expect(page.releaseGuest()).toBe("guest-secret");
  expect(page.token).toBeNull();
  page.accept("account-secret", false);
  expect(page.releaseGuest()).toBeNull();
  expect(page.token).toBe("account-secret");
  expect(new Credentials(disk).token).toBe("account-secret");
});
