# Backend v2 GO / NO GO

## Implemented

- Branch foundation for Backend v2.
- Supabase schema, RLS, and critical action functions.
- Auth and data provider contracts.
- Google Drive Edge Function placeholders.
- Metadata-only secure files UI.
- Secret scanning and environment examples.
- Documentation and readiness tests.

## Still Local-Only

- Current operational app data remains localStorage/IndexedDB unless backend variables are deliberately enabled.
- Existing photo capture stores local browser data.
- Existing login can keep using local users/PINs.

## Ready For Supabase

- Database schema.
- RLS policy contract.
- Role mapping.
- Provider boundary.
- Auth provider boundary.
- Migration dry-run strategy.

## Ready For Google Drive

- Metadata table.
- Edge Function names and contracts.
- Download UI path through backend only.
- Server variable checklist.

## Requires Real Server Credentials

- Supabase project URL and anon key for frontend opt-in.
- Supabase service role key in Supabase/server context only.
- Google Drive owner/root folder configuration.
- Google OAuth or service account credentials in Supabase secrets only.

## Production Blockers

- No development Supabase deployment has been validated.
- RLS has not been tested with real Auth sessions.
- Edge Functions do not yet stream real Drive files.
- Multi-user conflict resolution is prepared, not proven live.
- Pilot migration has not run with approved data.

## Tests

Required before production consideration:
- `npm run lint`
- `npm test`
- `npm run build`
- `npm run qa:agent`
- targeted E2E specs 31 through 46
- full Playwright shards

## Decision

GO Backend v2 Foundation.

NO GO production large until Supabase real project, RLS, Edge Functions, and secured Google Drive downloads are tested in a server environment.
