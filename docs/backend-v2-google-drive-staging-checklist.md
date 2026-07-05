# Backend v2 Google Drive Staging Checklist

Google Drive réel n'est pas activé dans le frontend. Les Edge Functions sont prepared-only et attendent une configuration future via secrets Supabase contrôlés.

Compte Google Drive propriétaire prévu pour staging/prod : `mhadhbikhaled@gmail.com`.

Ce compte est documenté uniquement. Il ne doit pas être hardcodé dans le frontend et ne doit pas être committé dans `.env.example` comme secret.

## Contrôles obligatoires futurs

- Aucun téléchargement direct public.
- Aucun lien `drive.google.com` exposé au frontend.
- Download via Edge Function uniquement.
- Vérification utilisateur authentifié.
- Vérification rôle.
- Vérification dossier.
- Vérification ownership/folder Drive.
- Audit `audit_logs` à chaque accès fichier.
- Métadonnées dans `file_metadata`, pas de binaire dans Supabase.
- Photos/vidéos prévues pour Google Drive via Edge Functions.

## Secrets Supabase futurs

Les secrets OAuth/Drive ne doivent jamais être dans Git :

- client secret
- refresh token
- service account JSON
- clé privée
- `GOOGLE_APPLICATION_CREDENTIALS`

## Validation

```bash
npm run backend:v2:check
node scripts/check-no-secrets.mjs
```

Statut actuel : staging prêt côté contrat, Google Drive réel non configuré.
