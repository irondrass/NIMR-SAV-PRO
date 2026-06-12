/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { User, UserRole, UserSession } from "./types";

const AUTH_HASH_PREFIX = "sha256";
const AUTH_SALT = "nimr-sav-pro-local-auth-v1";
const DEFAULT_CREATED_AT = "2026-06-11T00:00:00.000Z";

export const DEFAULT_USER_CREDENTIALS = [
  { id: "user_directeur", username: "directeur", pin: "0000", displayName: "Directeur Démo SAV", role: UserRole.DIRECTEUR_SAV },
  { id: "user_reception", username: "reception", pin: "1111", displayName: "Réception Démo", role: UserRole.RECEPTIONNAIRE },
  { id: "user_chefatelier", username: "chefatelier", pin: "2222", displayName: "Chef Atelier Démo", role: UserRole.CHEF_ATELIER },
  { id: "user_technicien", username: "technicien", pin: "3333", displayName: "Technicien Démo", role: UserRole.TECHNICIEN },
  { id: "user_qc", username: "qc", pin: "4444", displayName: "Contrôle Qualité Démo", role: UserRole.CONTROLE_QUALITE },
  { id: "user_livraison", username: "livraison", pin: "5555", displayName: "Livraison Démo", role: UserRole.LIVRAISON },
  { id: "user_lecture", username: "lecture", pin: "9999", displayName: "Lecture Seule Démo", role: UserRole.LECTURE_SEULE },
] as const;

export type LoginResult =
  | { ok: true; user: User; users: User[]; session: UserSession }
  | { ok: false; reason: "invalid-credentials" | "disabled-user"; message: string };

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

export async function loginUser(users: User[], username: string, pin: string, now = new Date()): Promise<LoginResult> {
  const normalizedUsername = normalizeUsername(username);
  const user = users.find(item => normalizeUsername(item.username) === normalizedUsername);
  if (!user || !(await verifyPin(user, pin))) {
    return { ok: false, reason: "invalid-credentials", message: "Identifiant ou PIN incorrect." };
  }
  if (!user.active) {
    return { ok: false, reason: "disabled-user", message: "Utilisateur désactivé." };
  }

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
  };
}

export function isSessionValid(session: UserSession | null, users: User[]): boolean {
  if (!session) return false;
  const user = users.find(item => item.id === session.userId);
  return Boolean(user && user.active && user.role === session.role && user.displayName === session.displayName);
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
    typeof value.loginAt === "string"
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
