/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { User, UserRole, UserSession } from "./types";

const AUTH_HASH_PREFIX = "sha256";
const AUTH_SALT = "nimr-sav-pro-local-auth-v1";
const DEFAULT_CREATED_AT = "2026-06-11T00:00:00.000Z";

export const DEFAULT_USER_CREDENTIALS = [
  { id: "user_directeur", username: "directeur", pin: "0000", displayName: "Directeur SAV", role: UserRole.DIRECTEUR_SAV },
  { id: "user_reception", username: "reception", pin: "1111", displayName: "Réception SAV", role: UserRole.RECEPTIONNAIRE },
  { id: "user_chefatelier", username: "chefatelier", pin: "2222", displayName: "Chef Atelier", role: UserRole.CHEF_ATELIER },
  { id: "user_technicien", username: "technicien", pin: "3333", displayName: "Technicien Atelier", role: UserRole.TECHNICIEN },
  { id: "user_qc", username: "qc", pin: "4444", displayName: "Contrôle Qualité", role: UserRole.CONTROLE_QUALITE },
  { id: "user_livraison", username: "livraison", pin: "5555", displayName: "Livraison SAV", role: UserRole.LIVRAISON },
  { id: "user_lecture", username: "lecture", pin: "9999", displayName: "Lecture Seule", role: UserRole.LECTURE_SEULE },
] as const;

export type LoginResult =
  | { ok: true; user: User; users: User[]; session: UserSession }
  | { ok: false; reason: "invalid-credentials" | "disabled-user" | "locked-out"; message: string };

export interface CreateUserInput {
  username: string;
  displayName: string;
  role: UserRole;
  pin: string;
}

export async function createDefaultUsers(now = new Date(DEFAULT_CREATED_AT)): Promise<User[]> {
  const timestamp = now.toISOString();
  return Promise.all(DEFAULT_USER_CREDENTIALS.map(async credential => ({
    id: credential.id,
    username: normalizeUsername(credential.username),
    displayName: credential.displayName,
    role: credential.role,
    pinHash: await hashPin(credential.username, credential.pin),
    active: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  })));
}

export async function ensureDefaultUsers(storedUsers: User[], now = new Date(DEFAULT_CREATED_AT)): Promise<User[]> {
  if (storedUsers.length === 0) return createDefaultUsers(now);
  return storedUsers.map(user => ({
    ...user,
    username: normalizeUsername(user.username),
    displayName: user.displayName.trim() || user.username,
  }));
}

export const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
export const LOGIN_MAX_ATTEMPTS = 5;
export const LOGIN_LOCKOUT_MS = 5 * 60 * 1000; // 5 minutes

export interface LoginAttemptState {
  count: number;
  firstAttemptAt: string;
  lockedUntil?: string;
}

let globalAttemptsInMemory: Record<string, LoginAttemptState> = {};

function getAttemptsStorage(): Record<string, LoginAttemptState> {
  if (typeof window === "undefined" || !window.localStorage) {
    return globalAttemptsInMemory;
  }
  const raw = localStorage.getItem("nimr-sav-pro-login-attempts");
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveAttemptsStorage(attempts: Record<string, LoginAttemptState>): void {
  if (typeof window === "undefined" || !window.localStorage) {
    globalAttemptsInMemory = attempts;
    return;
  }
  localStorage.setItem("nimr-sav-pro-login-attempts", JSON.stringify(attempts));
}

export async function loginUser(users: User[], username: string, pin: string, now = new Date()): Promise<LoginResult> {
  const normalizedUsername = normalizeUsername(username);
  const attempts = getAttemptsStorage();
  const attempt = attempts[normalizedUsername];

  if (attempt && attempt.lockedUntil) {
    const lockedUntilTime = new Date(attempt.lockedUntil).getTime();
    if (now.getTime() < lockedUntilTime) {
      const remainingMin = Math.ceil((lockedUntilTime - now.getTime()) / 60000);
      return {
        ok: false,
        reason: "locked-out",
        message: `Trop de tentatives. Compte temporairement bloqué. Réessayez dans ${remainingMin} minute(s).`
      };
    } else {
      delete attempts[normalizedUsername];
      saveAttemptsStorage(attempts);
    }
  }

  const user = users.find(item => normalizeUsername(item.username) === normalizedUsername);
  if (!user || !(await verifyPin(user, pin))) {
    const currentAttempt = attempts[normalizedUsername] || { count: 0, firstAttemptAt: now.toISOString() };
    currentAttempt.count += 1;
    if (currentAttempt.count >= LOGIN_MAX_ATTEMPTS) {
      currentAttempt.lockedUntil = new Date(now.getTime() + LOGIN_LOCKOUT_MS).toISOString();
    }
    attempts[normalizedUsername] = currentAttempt;
    saveAttemptsStorage(attempts);

    if (currentAttempt.count >= LOGIN_MAX_ATTEMPTS) {
      return {
        ok: false,
        reason: "locked-out",
        message: "Trop de tentatives. Compte temporairement bloqué. Réessayez dans 5 minute(s)."
      };
    }
    return { ok: false, reason: "invalid-credentials", message: "Identifiant ou PIN incorrect." };
  }

  if (!user.active) {
    return { ok: false, reason: "disabled-user", message: "Utilisateur désactivé." };
  }

  delete attempts[normalizedUsername];
  saveAttemptsStorage(attempts);

  const timestamp = now.toISOString();
  const updatedUser: User = { ...user, lastLoginAt: timestamp, updatedAt: timestamp };
  const updatedUsers = users.map(item => item.id === user.id ? updatedUser : item);
  return {
    ok: true,
    user: updatedUser,
    users: updatedUsers,
    session: createSession(updatedUser, now),
  };
}

export function createSession(user: User, now = new Date()): UserSession {
  return {
    userId: user.id,
    displayName: user.displayName,
    role: user.role,
    loginAt: now.toISOString(),
    lastActivityAt: now.toISOString(),
  };
}

export function isSessionValid(session: UserSession | null, users: User[], now = new Date()): boolean {
  if (!session) return false;
  const user = users.find(item => item.id === session.userId);
  if (!user || !user.active || user.role !== session.role || user.displayName !== session.displayName) {
    return false;
  }
  const activityTime = session.lastActivityAt ? new Date(session.lastActivityAt).getTime() : new Date(session.loginAt).getTime();
  const currentTime = now.getTime();
  const testTimeout = typeof window !== "undefined" ? (window as any).__TEST_SESSION_TIMEOUT__ : undefined;
  const timeoutMs = testTimeout !== undefined && testTimeout !== null ? Number(testTimeout) : SESSION_TTL_MS;
  return (currentTime - activityTime) < timeoutMs;
}

export function touchSession(session: UserSession, now = new Date()): UserSession {
  return {
    ...session,
    lastActivityAt: now.toISOString(),
  };
}

export async function createUser(input: CreateUserInput, existingUsers: User[], now = new Date()): Promise<User> {
  const username = normalizeUsername(input.username);
  const timestamp = now.toISOString();
  return {
    id: createUserId(username, existingUsers),
    username,
    displayName: input.displayName.trim() || username,
    role: input.role,
    pinHash: await hashPin(username, input.pin),
    active: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function updateUserProfile(
  users: User[],
  userId: string,
  changes: Pick<User, "displayName" | "role">,
  currentUserId: string,
  now = new Date()
): { ok: true; users: User[] } | { ok: false; message: string } {
  const target = users.find(user => user.id === userId);
  if (!target) return { ok: false, message: "Utilisateur introuvable." };
  if (target.id === currentUserId && target.role !== changes.role) {
    return { ok: false, message: "Un utilisateur ne peut pas modifier son propre rôle." };
  }

  const updated: User = {
    ...target,
    displayName: changes.displayName.trim() || target.displayName,
    role: changes.role,
    updatedAt: now.toISOString(),
  };
  return { ok: true, users: users.map(user => user.id === userId ? updated : user) };
}

export function setUserActive(
  users: User[],
  userId: string,
  active: boolean,
  now = new Date()
): { ok: true; users: User[] } | { ok: false; message: string } {
  const target = users.find(user => user.id === userId);
  if (!target) return { ok: false, message: "Utilisateur introuvable." };
  if (!active && target.role === UserRole.DIRECTEUR_SAV && countActiveDirectors(users) <= 1) {
    return { ok: false, message: "Impossible de désactiver le dernier Directeur SAV actif." };
  }

  const updated: User = { ...target, active, updatedAt: now.toISOString() };
  return { ok: true, users: users.map(user => user.id === userId ? updated : user) };
}

export async function resetUserPin(
  users: User[],
  userId: string,
  nextPin: string,
  now = new Date()
): Promise<{ ok: true; users: User[] } | { ok: false; message: string }> {
  const target = users.find(user => user.id === userId);
  if (!target) return { ok: false, message: "Utilisateur introuvable." };
  if (!nextPin.trim()) return { ok: false, message: "Le nouveau PIN est obligatoire." };
  const updated: User = {
    ...target,
    pinHash: await hashPin(target.username, nextPin),
    updatedAt: now.toISOString(),
  };
  return { ok: true, users: users.map(user => user.id === userId ? updated : user) };
}

export function canManageUsers(role: UserRole): boolean {
  return role === UserRole.DIRECTEUR_SAV;
}

export function canDeactivateUser(users: User[], userId: string): boolean {
  const target = users.find(user => user.id === userId);
  if (!target) return false;
  return !(target.active && target.role === UserRole.DIRECTEUR_SAV && countActiveDirectors(users) <= 1);
}

export async function verifyPin(user: User, pin: string): Promise<boolean> {
  if (!user.pinHash) return false;
  return user.pinHash === await hashPin(user.username, pin);
}

export async function hashPin(username: string, pin: string): Promise<string> {
  const payload = `${AUTH_SALT}:${normalizeUsername(username)}:${pin}`;
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload));
    return `${AUTH_HASH_PREFIX}:${Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, "0")).join("")}`;
  }
  return `${AUTH_HASH_PREFIX}:fallback:${fallbackHash(payload)}`;
}

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

export function isUser(value: unknown): value is User {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.username === "string" &&
    typeof value.displayName === "string" &&
    Object.values(UserRole).includes(value.role as UserRole) &&
    typeof value.active === "boolean" &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string" &&
    (value.pinHash === undefined || typeof value.pinHash === "string") &&
    (value.lastLoginAt === undefined || typeof value.lastLoginAt === "string")
  );
}

export function isUserSession(value: unknown): value is UserSession {
  if (!isRecord(value)) return false;
  return (
    typeof value.userId === "string" &&
    typeof value.displayName === "string" &&
    Object.values(UserRole).includes(value.role as UserRole) &&
    typeof value.loginAt === "string" &&
    (value.lastActivityAt === undefined || typeof value.lastActivityAt === "string")
  );
}

function createUserId(username: string, existingUsers: User[]): string {
  const base = `user_${username.replace(/[^a-z0-9]+/g, "_") || "local"}`;
  if (!existingUsers.some(user => user.id === base)) return base;
  let index = 2;
  while (existingUsers.some(user => user.id === `${base}_${index}`)) {
    index += 1;
  }
  return `${base}_${index}`;
}

function countActiveDirectors(users: User[]): number {
  return users.filter(user => user.active && user.role === UserRole.DIRECTEUR_SAV).length;
}

function fallbackHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function resetLoginAttempts(username?: string): void {
  const attempts = getAttemptsStorage();
  if (username) {
    delete attempts[normalizeUsername(username)];
  } else {
    for (const key in attempts) {
      delete attempts[key];
    }
  }
  saveAttemptsStorage(attempts);
}
