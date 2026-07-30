/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BackendRuntimeConfig, resolveBackendRuntimeConfig, shouldAttemptSupabase } from "../data/backendMode";
import { User, UserSession } from "../types";
import { AuthLoginInput, AuthProvider, AuthProviderLoginResult } from "./authProvider";
import { BackendBusinessRole, toAppRole } from "./roleMapping";
import { setSupabaseAccessToken } from "../data/supabaseProvider";

export interface SupabaseUserProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  role?: BackendBusinessRole | string | null;
  active: boolean;
}

export interface SupabaseAuthClientLike {
  signInWithPassword(input: { email: string; password: string }): Promise<{ userId: string; email: string | null; accessToken?: string }>;
  signOut(): Promise<void>;
  getProfile(userId: string): Promise<SupabaseUserProfile | null>;
}

export interface SupabaseAuthProviderOptions {
  config?: BackendRuntimeConfig;
  client?: SupabaseAuthClientLike;
}

export class SupabaseAuthRoleError extends Error {
  reason: "missing-role" | "unknown-role";

  constructor(reason: "missing-role" | "unknown-role", role?: string | null) {
    super(reason === "missing-role" ? "Role Supabase absent." : `Role backend inconnu: ${role}`);
    this.name = "SupabaseAuthRoleError";
    this.reason = reason;
  }
}

export function mapSupabaseProfileToLocalUser(profile: SupabaseUserProfile, now = new Date()): User {
  if (!profile.role) throw new SupabaseAuthRoleError("missing-role", profile.role);
  const role = toAppRole(profile.role);
  if (!role) throw new SupabaseAuthRoleError("unknown-role", profile.role);
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
      setSupabaseAccessToken(auth.accessToken ?? null);
      const profile = await client!.getProfile(auth.userId);
      if (!profile) {
        await client!.signOut();
        setSupabaseAccessToken(null);
        return { ok: false, reason: "missing-profile", message: "Profil utilisateur introuvable." };
      }
      if (!profile.active) {
        await client!.signOut();
        setSupabaseAccessToken(null);
        return { ok: false, reason: "disabled-user", message: "Utilisateur inactif." };
      }
      let user: User;
      try {
        user = mapSupabaseProfileToLocalUser(profile);
      } catch (error) {
        await client!.signOut();
        setSupabaseAccessToken(null);
        if (error instanceof SupabaseAuthRoleError) {
          return {
            ok: false,
            reason: error.reason,
            message: error.reason === "missing-role" ? "Rôle Supabase absent : accès refusé." : "Rôle Supabase non autorisé : accès refusé.",
          };
        }
        throw error;
      }
      currentSession = {
        userId: user.id,
        displayName: user.displayName,
        role: user.role,
        loginAt: new Date().toISOString(),
        lastActivityAt: new Date().toISOString(),
      };
      return { ok: true, user, session: currentSession, backendRole: profile.role as BackendBusinessRole };
    },
    async logout() {
      if (client && shouldAttemptSupabase(config)) await client.signOut();
      setSupabaseAccessToken(null);
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
