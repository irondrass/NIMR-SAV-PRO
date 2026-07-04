/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  createDefaultUsers,
  isSessionValid,
  loginUser,
  touchSession,
} from "../auth";
import { BackendRuntimeConfig, resolveBackendRuntimeConfig } from "../data/backendMode";
import { User, UserSession } from "../types";
import { AuthLoginInput, AuthProvider, AuthProviderLoginResult } from "./authProvider";
import { toBackendRole } from "./roleMapping";

export interface LocalAuthProviderOptions {
  config?: BackendRuntimeConfig;
  users?: User[];
  session?: UserSession | null;
}

export function createLocalAuthProvider(options: LocalAuthProviderOptions = {}): AuthProvider {
  const config = options.config ?? resolveBackendRuntimeConfig({ VITE_BACKEND_MODE: "local-only" });
  let usersPromise = Promise.resolve(options.users).then(value => value ?? createDefaultUsers()).then(value => value);
  let currentSession = options.session ?? null;

  return {
    mode: config.mode,
    async login(input: AuthLoginInput): Promise<AuthProviderLoginResult> {
      const users = await usersPromise;
      const result = await loginUser(users, input.username, input.password);
      if (result.ok === false) {
        return { ok: false, reason: result.reason, message: result.message };
      }
      usersPromise = Promise.resolve(result.users);
      currentSession = result.session;
      return {
        ok: true,
        user: result.user,
        session: result.session,
        backendRole: toBackendRole(result.user.role),
      };
    },
    async logout() {
      currentSession = null;
    },
    async getSession() {
      const users = await usersPromise;
      return isSessionValid(currentSession, users) ? currentSession : null;
    },
    async refreshSession() {
      const users = await usersPromise;
      if (!isSessionValid(currentSession, users)) {
        currentSession = null;
        return null;
      }
      currentSession = touchSession(currentSession!);
      return currentSession;
    },
  };
}
