# Backend v2 Supabase Staging Checklist

## Installation CLI

Installer la CLI si nécessaire :

```bash
npm install -g supabase
supabase --version
```

Ou utiliser la méthode officielle adaptée au poste de recette.

## Avant activation staging

- Projet Supabase de développement/staging uniquement.
- Aucune donnée client réelle, VIN réel, téléphone réel, plaque réelle, photo réelle ou fichier réel.
- `VITE_NIMR_BACKEND_MODE=backend-enabled`.
- `VITE_NIMR_ENV=staging`.
- `VITE_SUPABASE_URL` défini localement.
- `VITE_SUPABASE_ANON_KEY` défini localement.
- Aucune `SUPABASE_SERVICE_ROLE_KEY` dans Vite ou le repo.
- Migration `20260704000000_backend_v2_foundation.sql` appliquée.
- Migration `20260705000000_backend_v2_b_staging_activation.sql` appliquée.
- RLS activé sur `profiles`, `dossiers`, `vehicles`, `workshop_tasks`, `reservations`, `audit_logs`, `file_metadata`.
- Rôles validés : `directeur`, `reception`, `chefatelier`, `technicien`, `qc`, `livraison`, `lecture`.
- Rôle absent ou inconnu : accès refusé.
- `audit_logs` append-only.
- `file_metadata` sans URL publique directe.

## Commandes

```bash
npm run backend:v2:check
npm test
```

Ne jamais lancer de migration automatique de données réelles. Le mode migration reste dry-run.
