"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState } from "react";

import { tokenStore } from "@/lib/api-client";
import { authApi, type RegisterOrgPayload } from "@/lib/auth-api";
import type { Me, Session } from "@/lib/types";

interface AuthState {
  me: Me | null;
  loading: boolean; // initial hydration in progress
  login: (email: string, password: string) => Promise<void>;
  register: (payload: RegisterOrgPayload) => Promise<void>;
  consumeSession: (session: Session) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

function sessionToMe(s: Session): Me {
  return { org_role: s.org_role, user: s.user, org: s.org };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  // Hydrate from a stored token on first load.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!tokenStore.access) {
        setLoading(false);
        return;
      }
      try {
        const data = await authApi.me();
        if (!cancelled) setMe(data);
      } catch {
        tokenStore.clear();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const consumeSession = useCallback((session: Session) => {
    tokenStore.set(session.access_token, session.refresh_token);
    setMe(sessionToMe(session));
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      consumeSession(await authApi.login(email, password));
    },
    [consumeSession],
  );

  const register = useCallback(
    async (payload: RegisterOrgPayload) => {
      consumeSession(await authApi.registerOrg(payload));
    },
    [consumeSession],
  );

  const logout = useCallback(() => {
    tokenStore.clear();
    setMe(null);
    router.replace("/auth/login");
  }, [router]);

  return (
    <AuthContext.Provider value={{ me, loading, login, register, consumeSession, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
