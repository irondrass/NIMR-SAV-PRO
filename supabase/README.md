# Backend v2 Supabase Foundation

This folder prepares the Backend v2 server surface for NIMR SAV PRO.

Implemented in this foundation:
- database schema for business data, roles, audit events, and file metadata;
- strict RLS policy contracts;
- SQL functions for critical actions that must not be trusted to the frontend;
- Edge Function placeholders for secured Google Drive upload/download flow.

Prepared only:
- live Supabase deployment;
- real Google Drive OAuth/service-account integration;
- migration of real client data.

No secret belongs in this repository. Use `supabase/.env.example` as a placeholder-only checklist, then configure real values in Supabase project secrets.

GO Backend v2 Foundation. NO GO production until a development Supabase project validates Auth, RLS, Edge Functions, and secured Drive downloads.
