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
  login: (identifier: string, password: string) =>
    api.post<Session>("/auth/login", { identifier, password }, false),
  verifyToken: (token: string) => api.post<Session>("/auth/verify", { token }, false),
  setPassword: (password: string) =>
    api.post<{ message: string }>("/auth/set-password", { password }),
  forgotPassword: (email: string) =>
    api.post<{ message: string }>("/auth/forgot-password", { email }, false),
  resetPassword: (token: string, password: string) =>
    api.post<Session>("/auth/reset-password", { token, password }, false),
  me: () => api.get<Me>("/auth/me"),
};
