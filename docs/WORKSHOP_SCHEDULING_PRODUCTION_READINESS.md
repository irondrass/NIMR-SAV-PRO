# Production readiness - Planification atelier

Date d'audit : 2026-07-30

## Verdict

**GO preproduction technique / NO GO production avant signature UAT.**

La validation PostgreSQL Supabase DEV est reussie. La migration d'autonomie des
audits est appliquee en DEV, les tests Auth/RLS/concurrence/idempotence/audit
passent, et le cleanup conserve les audits append-only. Aucun deploiement de
production ne doit etre effectue avant la recette metier signee.

## Etat des controles

| Controle | Etat | Preuve |
| --- | --- | --- |
| TypeScript et tests unitaires | Execute | `npm run lint`, `npm test` |
| Build production | Execute | chunk atelier separe |
| Detection de secrets | Execute | `npm run check:no-secrets` |
| Contrat Backend v2 | Execute | `npm run backend:v2:check` |
| Migration PostgreSQL complete | PASS DEV | `migration_state=APPLIED_VALID` |
| Catalogue tables/index/contraintes/policies | PASS DEV | Management API read-only |
| Double reservation concurrente | PASS DEV | `workshop-scheduling-concurrency: OK` |
| Idempotence meme payload/different payload | PASS DEV | concurrence + rejeu |
| Matrice Auth/RLS multi-role | PASS DEV | `workshop-scheduling-rls: OK` |
| Retention append-only des audits | PASS DEV | `audit-events-retention: OK` |
| Cleanup DEV | PASS | `PASS_AUDIT_RETAINED`, 45 audits conserves |
| UAT metier formelle | En attente | signature requise |

## Limites preproduction

- Supabase CLI disponible via `npx`, version observee `2.110.0`.
- `supabase/config.toml` initialise pour le projet local.
- `npx supabase start` echoue sur l'inspection du moteur Docker Linux.
- `npm run db:test:workshop` atteint la CLI mais echoue avec
  `LegacyDbConnectError: Failed to connect`, aucune base locale n'etant demarree.
- WSL retourne `Wsl/0x80070422`, service desactive.
- Docker Desktop Linux reste indisponible localement ; les controles distants
  utilisent le Management API read-only lorsque cela est possible.

## Conditions de passage en GO

1. Activer WSL/Docker Desktop Linux, puis appliquer toutes les migrations sur
   une base locale jetable.
2. Obtenir un resultat vert de `npm run db:test:workshop`.
3. Charger des fixtures sans donnees client reelles et executer les tests
   concurrence, idempotence et RLS.
4. Verifier les audits produits par confirmation, surreservation, changement
   de parametres et evenements de temps.
5. Tester un reset complet et la procedure de rollback sur DEV.
6. Faire valider la matrice de droits par le Directeur SAV et le responsable
   securite.

## Risques residuels

- La migration reste non compilee par un serveur PostgreSQL dans cet audit.
- Le modele ajoute `workshop_id` et `assigned_employee_id` aux anciennes taches :
  une strategie de backfill DEV doit etre validee avant toute contrainte
  `NOT NULL`.
- Le bundle principal depasse encore le seuil Vite de 500 kB malgre l'extraction
  du module atelier.
- Les tests de concurrence mutent leur fixture et exigent donc une tache DEV
  neuve a chaque execution.

## Validation Supabase DEV distante

La recette DEV distante du 2026-07-30 a retourne :

- `migration_state=APPLIED_VALID` ;
- `schema=PASS`, `auth=PASS`, `rls=PASS` ;
- `concurrency=PASS`, `idempotence=PASS`, `audit=PASS` ;
- `cleanup=PASS_AUDIT_RETAINED` ;
- `auth_test_users_remaining=0` ;
- `mutable_fixture_rows_remaining=0` ;
- `verdict=GO_PREPRODUCTION_TECHNIQUE`.

Le verdict production reste bloque jusqu'a la signature de la recette metier.
