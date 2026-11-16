const KEY = "investagent.token.v1";
type TokenStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function browserStorage(): TokenStorage | undefined {
  try { return localStorage; } catch { return undefined; }
}

/** Only account credentials may survive a page reload. */
export class Credentials {
  token: string | null = null;
  isGuest = false;
  constructor(private storage = browserStorage()) {
    try { this.token = storage?.getItem(KEY) ?? null; } catch { /* storage unavailable */ }
  }
  accept(token: string, guest: boolean) {
    this.token = token;
    this.isGuest = guest;
    try {
      if (guest) this.storage?.removeItem(KEY);
      else this.storage?.setItem(KEY, token);
    } catch { /* memory-only fallback */ }
  }
  clear() {
    this.token = null;
    this.isGuest = false;
    try { this.storage?.removeItem(KEY); } catch { /* storage unavailable */ }
  }
  releaseGuest(): string | null {
    if (!this.isGuest) return null;
    const token = this.token;
    this.token = null;
    this.isGuest = false;
    return token;
  }
}
