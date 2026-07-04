# Backend v2 Migration Strategy

## Implemented

- Dry-run schema checker: `scripts/export-local-data-schema-check.ts`.
- Backend schema and repositories identify the target collections.
- No upload or live import path is executed by this phase.

## Prepared Only

- Real export UI hardening for pilot.
- Supabase import scripts.
- Duplicate merge workflow.
- Rollback rehearsal.

## Export Local Data

1. Use the existing local backup/export workflow.
2. Save the JSON outside the repository.
3. Run a dry-run shape check:

```bash
npx tsx scripts/export-local-data-schema-check.ts local-export.json
```

The checker validates structure only. It does not upload.

## Mapping

- Local dossier IDs map to backend UUIDs and keep `dossier_number` for user-facing identity.
- Clients are deduplicated by normalized name plus phone/email when available.
- Vehicles are deduplicated by VIN first, then immatriculation.
- Repair order lines map to `repair_order_lines`.
- Workshop reservations map to `workshop_reservations`.
- Audit logs map to append-only `audit_events`.
- File metadata maps to `file_attachments`; binaries remain in local mode until secured Drive upload is live.

## Rollback

- Keep original export untouched.
- Apply imports first to a development Supabase project.
- Validate counts, sample dossiers, QC status, delivery status, audit events, and file metadata.
- Delete the development import if validation fails.

## Pilot Protocol

- Use synthetic or approved pilot data only.
- Run dry-run checks before import.
- Confirm RLS with each role.
- Confirm no raw Drive URL is exposed.
- Confirm downloads are audited.

## Variables

Migration scripts must receive server credentials from the execution environment only. No `.env` with real values is committed.

## Limits

- No real client data is migrated in this phase.
- No Google Drive binary migration is performed.

## Risks

- Duplicate client and vehicle records can affect reporting if not reconciled.
- Local browser exports may differ by workstation and need a merge policy.

## Tests

- `tests/backend-migration-strategy.test.ts`
- Existing Lot 7 migration tests remain active.

## Decision

GO migration strategy documentation and dry-run checker.

NO GO real migration until pilot protocol is approved.
