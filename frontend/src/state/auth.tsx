/** Accounts persist in localStorage; guests exist only for this page lifetime. */
import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ApiError, createGuest, endGuest, login as loginRequest, me, register as registerRequest, setAuthHandlers, type TokenResponse } from "../api/client";
import { Credentials } from "./credentials";

export interface UserProfile {
  id: string;
  email: string;
  display_name: string;
  is_guest?: boolean;
}
interface AuthValue {
  user: UserProfile | null;
  token: string | null;
  ready: boolean;
  ensureGuest: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);
const credentials = new Credentials();
let unauthorizedListener: () => void = () => undefined;
let guestRequest: Promise<TokenResponse> | null = null;
setAuthHandlers({ getToken: () => credentials.token, onUnauthorized: () => unauthorizedListener() });

function obtainGuest() {
  // StrictMode and simultaneous first queries share one bootstrap request.
  if (!guestRequest) guestRequest = createGuest().finally(() => { guestRequest = null; });
  return guestRequest;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [token, setToken] = useState(credentials.token);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [ready, setReady] = useState(!credentials.token);

  const accept = useCallback((body: TokenResponse) => {
    const oldGuest = credentials.releaseGuest();
    if (oldGuest && oldGuest !== body.access_token) void endGuest(oldGuest);
    credentials.accept(body.access_token, Boolean(body.user.is_guest));
    queryClient.clear();
    setUser(body.user);
    setToken(body.access_token);
    setReady(true);
  }, [queryClient]);

  const ensureGuest = useCallback(async () => {
    if (credentials.token) return;
    const body = await obtainGuest();
    // An account login may have completed while the guest bootstrap was pending.
    if (!credentials.token) accept(body);
    else if (credentials.token !== body.access_token) void endGuest(body.access_token);
  }, [accept]);

  const logout = useCallback(() => {
    const oldGuest = credentials.releaseGuest();
    if (oldGuest) void endGuest(oldGuest);
    credentials.clear();
    queryClient.clear();
    setToken(null);
    setUser(null);
    setReady(true);
  }, [queryClient]);

  useEffect(() => {
    unauthorizedListener = logout;
    return () => { unauthorizedListener = () => undefined; };
  }, [logout]);

  useEffect(() => {
    if (!token) {
      // Homepage is immediately public; guest API failure must not hide it.
      void ensureGuest().catch(() => undefined);
      return;
    }
    if (credentials.isGuest) return;
    let disposed = false;
    me().then((profile) => { if (!disposed) setUser(profile); })
      .catch((err) => { if (!disposed && err instanceof ApiError && err.status === 401) logout(); })
      .finally(() => { if (!disposed) setReady(true); });
    return () => { disposed = true; };
  }, [token, ensureGuest, logout]);

  useEffect(() => {
    const closePage = () => {
      const guest = credentials.releaseGuest();
      if (!guest) return;
      const body = new Blob([JSON.stringify({ token: guest })], { type: "application/json" });
      if (!navigator.sendBeacon?.("/api/auth/guest/end", body)) void endGuest(guest);
    };
    const restorePage = (event: PageTransitionEvent) => {
      if (event.persisted) void ensureGuest().catch(() => undefined);
    };
    window.addEventListener("pagehide", closePage);
    window.addEventListener("pageshow", restorePage);
    return () => {
      window.removeEventListener("pagehide", closePage);
      window.removeEventListener("pageshow", restorePage);
    };
  }, [ensureGuest]);

  useEffect(() => {
    if (!user?.is_guest) return;
    const timer = window.setInterval(() => {
      if (credentials.token === token) void me().catch(() => undefined);
    }, 60000);
    return () => window.clearInterval(timer);
  }, [user?.is_guest, token]);

  const value = useMemo<AuthValue>(() => ({
    user, token, ready, ensureGuest,
    login: async (email, password) => accept(await loginRequest(email, password)),
    register: async (email, password, name) => accept(await registerRequest(email, password, name)),
    logout,
  }), [user, token, ready, ensureGuest, accept, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
