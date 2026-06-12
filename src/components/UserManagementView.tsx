/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { FormEvent, useState } from "react";
import { KeyRound, Plus, ShieldCheck, UserCog } from "lucide-react";
import { canDeactivateUser } from "../auth";
import { User, UserRole } from "../types";

interface UserManagementViewProps {
  users: User[];
  currentUser: User;
  onCreateUser: (input: { username: string; displayName: string; role: UserRole; pin: string }) => Promise<{ ok: boolean; message: string }>;
  onUpdateUser: (userId: string, changes: { displayName: string; role: UserRole }) => { ok: boolean; message: string };
  onToggleUserActive: (userId: string, active: boolean) => { ok: boolean; message: string };
  onResetPin: (userId: string, pin: string) => Promise<{ ok: boolean; message: string }>;
}

const roleOptions = Object.values(UserRole);

export default function UserManagementView({
  users,
  currentUser,
  onCreateUser,
  onUpdateUser,
  onToggleUserActive,
  onResetPin,
}: UserManagementViewProps) {
  const [newUsername, setNewUsername] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newRole, setNewRole] = useState<UserRole>(UserRole.RECEPTIONNAIRE);
  const [newPin, setNewPin] = useState("");
  const [message, setMessage] = useState("");

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    const result = await onCreateUser({
      username: newUsername,
      displayName: newDisplayName,
      role: newRole,
      pin: newPin,
    });
    setMessage(result.message);
    if (result.ok) {
      setNewUsername("");
      setNewDisplayName("");
      setNewRole(UserRole.RECEPTIONNAIRE);
      setNewPin("");
    }
  };

  const showResult = (result: { ok: boolean; message: string }) => {
    setMessage(result.message);
  };

  return (
    <div data-testid="user-management-page" className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-lg font-black uppercase text-slate-950">Gestion utilisateurs</h2>
            <p className="text-sm font-semibold text-slate-500">
              Comptes internes locaux de démonstration, préparés pour une migration future vers une authentification serveur.
            </p>
          </div>
          <ShieldCheck className="h-7 w-7 text-blue-600" />
        </div>
        {message ? (
          <div data-testid="user-management-message" className="mt-4 rounded-md border border-blue-100 bg-blue-50 p-3 text-sm font-bold text-blue-800">
            {message}
          </div>
        ) : null}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Plus className="h-5 w-5 text-blue-600" />
          <h3 className="font-display text-sm font-black uppercase text-slate-950">Créer un utilisateur</h3>
        </div>
        <form onSubmit={handleCreate} className="grid grid-cols-1 gap-3 lg:grid-cols-5">
          <Input label="Identifiant" testId="user-create-username" value={newUsername} onChange={setNewUsername} />
          <Input label="Nom affiché" testId="user-create-display-name" value={newDisplayName} onChange={setNewDisplayName} />
          <label className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wide text-slate-500">Rôle</span>
            <select
              data-testid="user-create-role"
              value={newRole}
              onChange={event => setNewRole(event.target.value as UserRole)}
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-800"
            >
              {roleOptions.map(role => <option key={role} value={role}>{role}</option>)}
            </select>
          </label>
          <Input label="PIN" testId="user-create-pin" value={newPin} onChange={setNewPin} type="password" />
          <button
            type="submit"
            data-testid="user-create-submit"
            className="self-end rounded-md bg-slate-950 px-4 py-3 text-xs font-black uppercase text-white hover:bg-blue-700"
          >
            Créer
          </button>
        </form>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <UserCog className="h-5 w-5 text-blue-600" />
          <h3 className="font-display text-sm font-black uppercase text-slate-950">Utilisateurs internes</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[940px] text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-[10px] uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-3">Identifiant</th>
                <th className="py-2 pr-3">Nom affiché</th>
                <th className="py-2 pr-3">Rôle</th>
                <th className="py-2 pr-3">État</th>
                <th className="py-2 pr-3">Nouveau PIN</th>
                <th className="py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map(user => (
                <UserRow
                  key={user.id}
                  user={user}
                  users={users}
                  currentUser={currentUser}
                  onUpdateUser={onUpdateUser}
                  onToggleUserActive={onToggleUserActive}
                  onResetPin={onResetPin}
                  showResult={showResult}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function UserRow({
  user,
  users,
  currentUser,
  onUpdateUser,
  onToggleUserActive,
  onResetPin,
  showResult,
}: {
  key?: string;
  user: User;
  users: User[];
  currentUser: User;
  onUpdateUser: UserManagementViewProps["onUpdateUser"];
  onToggleUserActive: UserManagementViewProps["onToggleUserActive"];
  onResetPin: UserManagementViewProps["onResetPin"];
  showResult: (result: { ok: boolean; message: string }) => void;
}) {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [role, setRole] = useState(user.role);
  const [pin, setPin] = useState("");
  const isSelf = user.id === currentUser.id;
  const canToggle = user.active ? canDeactivateUser(users, user.id) : true;

  return (
    <tr data-testid={`user-row-${user.username}`}>
      <td className="py-3 pr-3 font-mono font-black text-slate-900">{user.username}</td>
      <td className="py-3 pr-3">
        <input
          data-testid={`user-display-name-${user.username}`}
          value={displayName}
          onChange={event => setDisplayName(event.target.value)}
          className="w-full rounded-md border border-slate-200 px-2 py-1.5 font-bold"
        />
      </td>
      <td className="py-3 pr-3">
        <select
          data-testid={`user-role-${user.username}`}
          value={role}
          disabled={isSelf}
          onChange={event => setRole(event.target.value as UserRole)}
          className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 font-bold disabled:bg-slate-100 disabled:text-slate-400"
        >
          {roleOptions.map(item => <option key={item} value={item}>{item}</option>)}
        </select>
      </td>
      <td className="py-3 pr-3">
        <span className={`rounded-full px-2 py-0.5 font-black ${user.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
          {user.active ? "Actif" : "Désactivé"}
        </span>
      </td>
      <td className="py-3 pr-3">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-slate-400" />
          <input
            data-testid={`user-reset-pin-${user.username}`}
            value={pin}
            onChange={event => setPin(event.target.value)}
            type="password"
            className="w-full rounded-md border border-slate-200 px-2 py-1.5 font-bold"
            placeholder="Nouveau PIN"
          />
        </div>
      </td>
      <td className="py-3 text-right">
        <div className="flex justify-end gap-2">
          <button
            type="button"
            data-testid={`user-save-${user.username}`}
            onClick={() => showResult(onUpdateUser(user.id, { displayName, role }))}
            className="rounded-md border border-slate-200 px-3 py-1.5 font-black text-blue-700 hover:border-blue-300"
          >
            Enregistrer
          </button>
          <button
            type="button"
            data-testid={`user-toggle-${user.username}`}
            disabled={!canToggle}
            onClick={() => showResult(onToggleUserActive(user.id, !user.active))}
            className="rounded-md border border-slate-200 px-3 py-1.5 font-black text-slate-700 hover:border-blue-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {user.active ? "Désactiver" : "Activer"}
          </button>
          <button
            type="button"
            data-testid={`user-reset-submit-${user.username}`}
            onClick={async () => {
              const result = await onResetPin(user.id, pin);
              showResult(result);
              if (result.ok) setPin("");
            }}
            className="rounded-md bg-slate-950 px-3 py-1.5 font-black text-white hover:bg-blue-700"
          >
            Réinitialiser PIN
          </button>
        </div>
      </td>
    </tr>
  );
}

function Input({
  label,
  testId,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  testId: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="space-y-1">
      <span className="text-[10px] font-black uppercase tracking-wide text-slate-500">{label}</span>
      <input
        data-testid={testId}
        value={value}
        type={type}
        onChange={event => onChange(event.target.value)}
        className="w-full rounded-md border border-slate-200 px-3 py-2.5 text-sm font-bold"
      />
    </label>
  );
}
