# Backend v2 Production NO GO

Production large réelle interdite tant que Supabase réel, RLS réel, Edge Functions et Google Drive OAuth réel ne sont pas validés.

## Blocage runtime

Si `VITE_NIMR_ENV=production`, l'application affiche un blocage clair :

- `NO GO production`
- `Production réelle non autorisée`
- aucun accès applicatif normal

## Critères avant future production

- Projet Supabase production séparé et validé.
- Auth Supabase validée avec rôles serveur.
- RLS testé table par table.
- Edge Functions auditées.
- Google Drive OAuth réel validé.
- Aucun secret dans GitHub Actions ou le repo.
- Aucun bypass de rôle frontend.
- Aucun accès public non authentifié aux données métier.
- Plan de rollback vers `local-only`.
- Recette sécurité validée avec données anonymisées avant toute donnée réelle.

Statut actuel : NO production large réelle.
