/**
 * JWT session: token in localStorage, user profile from /api/auth/me, 401 anywhere logs out.
 *
 * The token the API client reads lives in a module-level variable that is updated synchronously
 * in accept()/logout(). Registering it from an effect would race with child components whose
 * effects (react-query fetches) run before the provider's own effects.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ApiError, login as loginRequest, me, register as registerRequest, setAuthHandlers } from "../api/client";

export interface UserProfile {
  id: string;
  email: string;
  display_name: string;
}

interface AuthValue {
  user: UserProfile | null;
  token: string | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => void;
}

const KEY = "investagent.token.v1";
const AuthContext = createContext<AuthValue | null>(null);

function readToken(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function writeToken(token: string | null) {
  try {
    if (token) localStorage.setItem(KEY, token);
    else localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
}

let currentToken: string | null = readToken();
let unauthorizedListener: () => void = () => undefined;
setAuthHandlers({ getToken: () => currentToken, onUnauthorized: () => unauthorizedListener() });

function setCurrentToken(token: string | null) {
  currentToken = token;
  writeToken(token);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(currentToken);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [ready, setReady] = useState(false);

  const logout = useCallback(() => {
    setCurrentToken(null);
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    unauthorizedListener = logout;
    return () => {
      unauthorizedListener = () => undefined;
    };
  }, [logout]);

  useEffect(() => {
    if (!token) {
      setUser(null);
      setReady(true);
      return;
    }
    let cancelled = false;
    me()
      .then((profile) => !cancelled && setUser(profile))
      .catch((err) => {
        if (!cancelled && err instanceof ApiError && err.status === 401) logout();
      })
      .finally(() => !cancelled && setReady(true));
    return () => {
      cancelled = true;
    };
  }, [token, logout]);

  const accept = (body: { access_token: string; user: UserProfile }) => {
    setCurrentToken(body.access_token); // Synchronous: any fetch in the next render already carries it.
    setUser(body.user);
    setToken(body.access_token);
  };

  const value = useMemo<AuthValue>(
    () => ({
      user,
      token,
      ready,
      login: async (email, password) => accept(await loginRequest(email, password)),
      register: async (email, password, displayName) => accept(await registerRequest(email, password, displayName)),
      logout,
    }),
    [user, token, ready, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
