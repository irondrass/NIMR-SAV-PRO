# Backend v2 Google Drive

## Implemented

- Server-only Edge Function placeholders:
  - `supabase/functions/drive-create-upload-session`
  - `supabase/functions/drive-confirm-upload`
  - `supabase/functions/drive-download`
  - `supabase/functions/drive-delete-metadata`
- Frontend metadata-only panel in dossier photos tab.
- Download button is disabled unless Backend v2 is fully enabled.
- Download flow points to the Edge Function path only and never to a public Drive URL.

## Prepared Only

- Real Google Drive folder creation.
- Real upload session creation.
- Real file verification.
- Real backend streaming or temporary backend download URL.
- Binary deletion.

## Target Drive Structure

```text
NIMR-SAV-PRO/
  2026/
    NIMR-2026-0001/
      reception/
      atelier/
      qc/
      livraison/
      videos/
      documents/
```

Owner account planned: `mhadhbikhaled@gmail.com`

## Variables

Server-only variable names are documented in `supabase/.env.example` with placeholders. Real values must be configured as Supabase secrets, never in Git.

## Limits

- No Google API request is made in local-only mode.
- No upload of real photos or videos is part of this phase.
- `file_attachments` stores metadata only.

## Risks

- Drive permission inheritance must be tested carefully before any pilot file.
- Download audit must be verified with real authenticated sessions.

## Tests

- `tests/google-drive-edge-contract.test.ts`
- `tests/file-download-security-contract.test.ts`
- `e2e/46-backend-v2-readiness.spec.ts`

## Decision

GO Google Drive readiness.

NO GO real upload/download until Edge Functions are configured and tested in a server environment.
