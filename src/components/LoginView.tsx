/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { FormEvent, useState } from "react";
import { LockKeyhole, LogIn } from "lucide-react";
import { APP_NAME, APP_VERSION_LABEL } from "../app-identity";
import { LoginResult } from "../auth";

interface LoginViewProps {
  onLogin: (username: string, pin: string) => Promise<LoginResult>;
}

export default function LoginView({ onLogin }: LoginViewProps) {
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    const result = await onLogin(username, pin);
    setLoading(false);
    if (result.ok === false) {
      setError(result.message);
    }
  };

  return (
    <main data-testid="login-page" className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md flex-col justify-center">
        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-md bg-blue-600 text-sm font-black tracking-tight text-white">
              SAV
            </div>
            <div>
              <h1 className="font-display text-lg font-black uppercase tracking-wide">{APP_NAME}</h1>
              <p className="text-xs font-bold text-slate-500">{APP_VERSION_LABEL}</p>
            </div>
          </div>

          <div className="mb-5 rounded-md border border-blue-100 bg-blue-50 p-3 text-sm font-bold text-blue-800">
            Connexion interne SAV
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block space-y-1">
              <span className="text-xs font-black uppercase tracking-wide text-slate-500">Identifiant utilisateur</span>
              <input
                data-testid="login-username"
                value={username}
                onChange={event => setUsername(event.target.value)}
                autoComplete="username"
                className="w-full rounded-md border border-slate-200 bg-white px-4 py-3 text-base font-bold outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder="directeur"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-black uppercase tracking-wide text-slate-500">Mot de passe ou PIN</span>
              <input
                data-testid="login-pin"
                value={pin}
                onChange={event => setPin(event.target.value)}
                type="password"
                inputMode="numeric"
                autoComplete="current-password"
                className="w-full rounded-md border border-slate-200 bg-white px-4 py-3 text-base font-bold outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder="0000"
              />
            </label>

            {error ? (
              <div data-testid="login-error" className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              data-testid="login-submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-4 py-3 text-sm font-black uppercase tracking-wide text-white transition hover:bg-blue-700 disabled:bg-slate-300"
            >
              {loading ? <LockKeyhole className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
              Connexion
            </button>
          </form>

          <p className="mt-5 text-xs font-semibold leading-relaxed text-slate-500">
            Authentification locale de démonstration pour usage interne monoposte. Une authentification serveur pourra remplacer ce module en v2.0.0.
          </p>
        </section>
      </div>
    </main>
  );
}
