import { api } from "@/lib/api-client";
import type { Me, Session } from "@/lib/types";

export interface RegisterOrgPayload {
  org_name: string;
  name: string;
  email: string;
  password: string;
  timezone: string;
}

export const authApi = {
  registerOrg: (payload: RegisterOrgPayload) =>
    api.post<Session>("/auth/register-org", payload, false),
  login: (email: string, password: string) =>
    api.post<Session>("/auth/login", { email, password }, false),
  verifyToken: (token: string) => api.post<Session>("/auth/verify", { token }, false),
  requestMagicLink: (email: string) =>
    api.post<{ message: string }>("/auth/magic-link/request", { email }, false),
  me: () => api.get<Me>("/auth/me"),
};
