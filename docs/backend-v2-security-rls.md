# Backend v2 Security and RLS

## Implemented

- RLS is enabled on all Backend v2 business tables in `supabase/migrations/20260704000000_backend_v2_foundation.sql`.
- Business roles are represented server-side:
  - `DIRECTEUR_SAV`
  - `CHEF_ATELIER`
  - `RECEPTION`
  - `TECHNICIEN`
  - `QC`
  - `LIVRAISON`
  - `LECTURE`
- Frontend role names are mapped explicitly in `src/auth/roleMapping.ts`.
- `audit_events` are append-only through trigger and policies.

## Prepared Only

- Production hardening of every policy against real pilot identities.
- Service-role-only maintenance scripts.
- Advanced per-site technician scoping.

## Critical Server Rules

Implemented in SQL function contracts:
- `validate_qc`: refuses conforming QC while workshop tasks are still open.
- `create_delivery`: refuses delivery while QC is not conforming or tasks remain open.
- `reserve_workshop_tasks`: refuses reservation slot collisions.
- `assign_task_resource`: refuses incompatible technician specialty.
- `create_audit_event`: central append-only audit creation path.

## Variables

No server secret is used by frontend RLS code. Supabase service role credentials must only be configured in the Supabase environment.

## Limits

- RLS policies are foundation contracts and must be executed against a development Supabase database before production.
- `TECHNICIEN` scoping needs real user-to-resource assignment data during pilot setup.

## Risks

- Misconfigured Supabase Auth users could block access until profiles and roles are seeded.
- Security-definer functions require ownership review after deployment.

## Tests

- `tests/rls-policy-contract.test.ts`
- `tests/role-permissions-server-readiness.test.ts`
- `tests/no-secrets-backend-v2.test.ts`

## Decision

GO for Backend v2 security foundation.

NO GO production large until policy behavior is tested with real Supabase Auth sessions in a development project.
