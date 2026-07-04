/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BackendRuntimeConfig, resolveBackendRuntimeConfig } from "../data/backendMode";
import { User, UserSession } from "../types";
import { BackendBusinessRole } from "./roleMapping";

export interface AuthLoginInput {
  username: string;
  password: string;
}

export type AuthProviderLoginResult =
  | { ok: true; user: User; session: UserSession; backendRole: BackendBusinessRole | null }
  | { ok: false; reason: string; message: string };

export interface AuthProvider {
  mode: BackendRuntimeConfig["mode"];
  login(input: AuthLoginInput): Promise<AuthProviderLoginResult>;
  logout(): Promise<void>;
  getSession(): Promise<UserSession | null>;
  refreshSession(): Promise<UserSession | null>;
}

export function shouldUseServerAuth(config = resolveBackendRuntimeConfig()): boolean {
  return config.backendEnabled;
}
