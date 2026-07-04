/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BackendRuntimeConfig, resolveBackendRuntimeConfig, shouldAttemptSupabase } from "../data/backendMode";
import { User, UserSession } from "../types";
import { AuthLoginInput, AuthProvider, AuthProviderLoginResult } from "./authProvider";
import { BackendBusinessRole, toAppRole } from "./roleMapping";

export interface SupabaseUserProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  role: BackendBusinessRole;
  active: boolean;
}

export interface SupabaseAuthClientLike {
  signInWithPassword(input: { email: string; password: string }): Promise<{ userId: string; email: string | null }>;
  signOut(): Promise<void>;
  getProfile(userId: string): Promise<SupabaseUserProfile | null>;
}

export interface SupabaseAuthProviderOptions {
  config?: BackendRuntimeConfig;
  client?: SupabaseAuthClientLike;
}

export function mapSupabaseProfileToLocalUser(profile: SupabaseUserProfile, now = new Date()): User {
  const role = toAppRole(profile.role);
  if (!role) throw new Error(`Role backend inconnu: ${profile.role}`);
  const timestamp = now.toISOString();
  return {
    id: profile.id,
    username: profile.email ?? profile.id,
    displayName: profile.full_name?.trim() || profile.email || profile.id,
    role,
    active: profile.active,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function createSupabaseAuthProvider(options: SupabaseAuthProviderOptions = {}): AuthProvider {
  const config = options.config ?? resolveBackendRuntimeConfig();
  const client = options.client;
  let currentSession: UserSession | null = null;

  const assertEnabled = () => {
    if (!shouldAttemptSupabase(config) || !client) {
      throw new Error("Supabase auth inactive. Backend v2 must be enabled with server-safe configuration.");
    }
  };

  return {
    mode: config.mode,
    async login(input: AuthLoginInput): Promise<AuthProviderLoginResult> {
      assertEnabled();
      const auth = await client!.signInWithPassword({ email: input.username, password: input.password });
      const profile = await client!.getProfile(auth.userId);
      if (!profile) {
        await client!.signOut();
        return { ok: false, reason: "missing-profile", message: "Profil utilisateur introuvable." };
      }
      if (!profile.active) {
        await client!.signOut();
        return { ok: false, reason: "disabled-user", message: "Utilisateur inactif." };
      }
      const user = mapSupabaseProfileToLocalUser(profile);
      currentSession = {
        userId: user.id,
        displayName: user.displayName,
        role: user.role,
        loginAt: new Date().toISOString(),
        lastActivityAt: new Date().toISOString(),
      };
      return { ok: true, user, session: currentSession, backendRole: profile.role };
    },
    async logout() {
      if (client && shouldAttemptSupabase(config)) await client.signOut();
      currentSession = null;
    },
    async getSession() {
      return currentSession;
    },
    async refreshSession() {
      if (!currentSession) return null;
      currentSession = { ...currentSession, lastActivityAt: new Date().toISOString() };
      return currentSession;
    },
  };
}
