# Backend v2 Architecture

## Implemented

- Frontend backend modes: `local-only`, `backend-ready`, `backend-enabled`.
- Public Vite configuration guard in `src/data/backendMode.ts`.
- Provider contracts for local, hybrid, and Supabase-ready data access.
- Auth provider contracts for local auth and future Supabase Auth.
- Supabase folder with migrations, Edge Function placeholders, and server env example.

## Prepared Only

- Live Supabase project connection.
- Supabase Auth session exchange in production.
- Real multi-poste persistence.
- Google Drive upload and download through Edge Functions.

## Modes

- `local-only`: current localStorage/IndexedDB behavior. Default when backend variables are absent.
- `backend-ready`: contracts and schema exist, but no network calls are attempted.
- `backend-enabled`: Supabase calls are allowed only when `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are present.

## Variables

Frontend allowed:
- `VITE_BACKEND_MODE`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Server-only:
- `SUPABASE_SERVICE_ROLE_KEY`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_SERVICE_ACCOUNT_JSON`
- `GOOGLE_REFRESH_TOKEN`
- `GOOGLE_PRIVATE_KEY`

## Limits

- No real backend is activated by this repository alone.
- No real client data migration is executed.
- Local photo capture remains local unless Backend v2 is enabled and tested.

## Risks

- RLS and Edge Functions must be validated in a development Supabase project before pilot data.
- Conflict resolution between multiple users remains prepared, not live.
- Google Drive binary deletion remains out of scope for this phase.

## Tests

- Unit contract tests cover mode selection, providers, auth mapping, RLS text contracts, Drive function contracts, and no-secret scanning.
- E2E readiness spec verifies local startup and no Supabase/Google calls when backend variables are absent.

## Decision

GO Backend v2 Foundation.

NO GO production large until Supabase real project, RLS, Auth, Edge Functions, and secured Google Drive are tested server-side.
