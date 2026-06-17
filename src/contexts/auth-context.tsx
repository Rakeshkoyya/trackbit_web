"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState } from "react";

import { tokenStore } from "@/lib/api-client";
import { authApi, type RegisterOrgPayload } from "@/lib/auth-api";
import type { Me, Session } from "@/lib/types";

interface AuthState {
  me: Me | null;
  loading: boolean; // initial hydration in progress
  mustSetPassword: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  register: (payload: RegisterOrgPayload) => Promise<void>;
  consumeSession: (session: Session) => void;
  setPassword: (password: string, name?: string) => Promise<void>;
  updateProfile: (name: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

function sessionToMe(s: Session): Me {
  return { org_role: s.org_role, must_set_password: s.must_set_password, user: s.user, org: s.org };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [mustSetPassword, setMustSetPassword] = useState(false);
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
        if (!cancelled) {
          setMe(data);
          setMustSetPassword(data.must_set_password);
        }
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
    setMustSetPassword(session.must_set_password);
  }, []);

  const login = useCallback(
    async (identifier: string, password: string) => {
      consumeSession(await authApi.login(identifier, password));
    },
    [consumeSession],
  );

  const register = useCallback(
    async (payload: RegisterOrgPayload) => {
      consumeSession(await authApi.registerOrg(payload));
    },
    [consumeSession],
  );

  const setPassword = useCallback(async (password: string, name?: string) => {
    await authApi.setPassword(password, name);
    setMustSetPassword(false);
    // Reflect the new name (and cleared flag) locally — set-password returns no
    // session, so patch the cached `me` instead of refetching.
    const trimmed = name?.trim();
    setMe((prev) =>
      prev
        ? {
            ...prev,
            must_set_password: false,
            user: { ...prev.user, name: trimmed || prev.user.name },
          }
        : prev,
    );
  }, []);

  const updateProfile = useCallback(async (name: string) => {
    const data = await authApi.updateProfile(name);
    setMe(data);
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    setMe(null);
    setMustSetPassword(false);
    router.replace("/auth/login");
  }, [router]);

  return (
    <AuthContext.Provider
      value={{ me, loading, mustSetPassword, login, register, consumeSession, setPassword, updateProfile, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
