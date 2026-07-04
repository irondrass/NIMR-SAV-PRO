# Backend v2 Supabase Schema

## Implemented

Migration:

- `supabase/migrations/20260704000000_backend_v2_foundation.sql`

Tables:

- `users_profile`
- `user_roles`
- `clients`
- `vehicles`
- `dossiers`
- `repair_order_lines`
- `workshop_tasks`
- `technician_resources`
- `workshop_reservations`
- `quality_controls`
- `deliveries`
- `audit_events`
- `file_attachments`
- `app_settings`

## Prepared Only

- Production indexes after observing pilot query patterns.
- Data import from local IndexedDB/localStorage exports.
- Reconciliation of duplicate clients and vehicles from existing local browsers.

## Variables

Frontend:
- `VITE_BACKEND_MODE`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Server:
- Supabase project URL, anon key, and service role key configured outside Git.

## Limits

- No migration has been applied to a live project in this phase.
- No real customer data is included.
- File binaries are not stored in Supabase.

## Risks

- Numeric duration precision and status vocabularies should be validated against pilot workflow data.
- Existing local IDs need deterministic mapping to backend UUIDs.

## Tests

- `tests/supabase-provider-contract.test.ts`
- `tests/rls-policy-contract.test.ts`
- `tests/backend-migration-strategy.test.ts`

## Decision

GO schema foundation.

NO GO production until migration dry-run and Supabase development deployment pass.
