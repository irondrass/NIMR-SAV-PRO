# Audit Cleanup 6K-G

## Périmètre

Lot 6K-G appliqué sur la base `135e537 Rework workshop tasks from quote intake`.

Objectif : nettoyer le runtime local avant migration, centraliser les règles métier sensibles et retirer les données de démonstration imposées au démarrage.

## Constats traités

- Chargement initial : `App.tsx` ne charge plus `INITIAL_DOSSIERS`, `MOCK_TECHNICIENS`, `INITIAL_RECLAMATIONS` ni `INITIAL_ACTIVITE_LOGS`.
- Réception : les presets client fictifs ont été retirés. Les champs client doivent être saisis ou remplis via base véhicules importée.
- États vides : dossiers, clients et véhicules affichent un message explicite lorsqu'aucune donnée locale n'existe.
- Comptes locaux : les libellés par défaut ne portent plus la mention Démo.
- Tâches atelier : les règles de suppression, libération de réservation et annulation administrative sont centralisées dans `src/core/workshop-tasks.ts`.
- QC : une annulation administrative après QC conforme invalide le QC via `invalidateQCAfterWorkshopChange`.
- Planning : une tâche annulée administrativement est terminale et n'est plus planifiable.

## Règles atelier consolidées

- Tâche non démarrée, non réservée : suppression physique autorisée avec motif obligatoire.
- Tâche réservée ou planifiée : suppression bloquée tant que la réservation n'est pas libérée.
- Tâche en cours : suppression interdite.
- Tâche suspendue : suppression interdite.
- Tâche bloquée : suppression interdite.
- Tâche terminée : suppression physique interdite, annulation administrative autorisée avec motif obligatoire.
- Tâche passée QC conforme : toute modification atelier autorisée invalide le QC.

## Garanties ajoutées

- Tests unitaires ajoutés :
  - `tests/business-rules-cleanup.test.ts`
  - `tests/workshop-task-deletion-rules.test.ts`
  - `tests/role-permissions-cleanup.test.ts`
  - `tests/planning-single-source.test.ts`
  - `tests/no-demo-data-runtime.test.ts`
  - `tests/backend-migration-readiness.test.ts`
- Specs E2E ajoutées :
  - `e2e/39-business-rules-cleanup.spec.ts`
  - `e2e/40-no-demo-data-and-backend-readiness.spec.ts`

## Points volontairement non faits

- Aucun tag release créé.
- Aucun backend, serveur API, authentification serveur ou synchronisation distante ajouté.
- Les fixtures historiques de `src/data.ts` restent disponibles pour les tests et exports legacy, mais ne sont plus injectées dans le runtime à vide.

