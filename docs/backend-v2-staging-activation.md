# Backend v2-B Staging Activation

Backend v2-B active une capacité Supabase réelle uniquement pour développement ou staging encadré. Le mode par défaut reste `local-only`; sans variables Supabase, l'application continue à fonctionner en localStorage/IndexedDB.

## Modes

- `VITE_NIMR_BACKEND_MODE=local-only` : mode local actuel, aucun appel Supabase ou Google Drive.
- `VITE_NIMR_BACKEND_MODE=backend-ready` : contrats backend et diagnostic disponibles, sans écriture réelle obligatoire.
- `VITE_NIMR_BACKEND_MODE=backend-enabled` : Supabase autorisé seulement si `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` sont présents.

`VITE_NIMR_ENV=production` bloque l'application avec un message NO GO. Production large réelle interdite tant que Supabase réel, RLS réel, Edge Functions et Google Drive OAuth réel ne sont pas validés.

## Exemple `.env.local`

```bash
VITE_NIMR_BACKEND_MODE=backend-enabled
VITE_NIMR_ENV=staging
VITE_SUPABASE_URL=YOUR_SUPABASE_URL
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

Ne jamais committer `.env.local`. Ne jamais utiliser de service role key côté frontend.

## Validation

```bash
npm run backend:v2:check
node scripts/check-no-secrets.mjs
npm test
```

Le script `backend:v2:check` est un dry-run : il vérifie variables, migrations, RLS, Edge Functions prepared-only, absence de secrets et blocage production. Il ne pousse aucune donnée vers Supabase.

## Rollback

Remettre ou supprimer les variables locales :

```bash
VITE_NIMR_BACKEND_MODE=local-only
VITE_NIMR_ENV=local
```

Puis relancer l'application. Les données restent locales.
