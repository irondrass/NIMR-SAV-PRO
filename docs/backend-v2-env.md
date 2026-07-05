# Backend v2 Environment

Variables publiques Vite autorisées :

| Variable | Valeurs | Usage |
| --- | --- | --- |
| `VITE_NIMR_BACKEND_MODE` | `local-only`, `backend-ready`, `backend-enabled` | Sélection du mode runtime. Défaut : `local-only`. |
| `VITE_NIMR_ENV` | `local`, `staging`, `production` | Verrou environnement. `production` est bloqué. |
| `VITE_SUPABASE_URL` | placeholder ou URL staging locale | Requise seulement en `backend-enabled`. |
| `VITE_SUPABASE_ANON_KEY` | placeholder ou ANON KEY staging | Seule clé acceptée côté frontend. |

Variables interdites côté Vite/frontend :

- `SUPABASE_SERVICE_ROLE_KEY`
- `service_role`
- `private_key`
- `client_secret`
- `refresh_token`
- `GOOGLE_APPLICATION_CREDENTIALS`
- service account JSON Google
- token OAuth
- clé API privée
- mot de passe réel

`.env.example` ne contient que des placeholders. `.env.local` doit rester ignoré par Git et peut contenir les valeurs staging locales de l'opérateur.

## Commandes utiles

```bash
npm run backend:v2:check
node scripts/check-no-secrets.mjs
git check-ignore .env.local
```

La production large réelle reste NO GO.
