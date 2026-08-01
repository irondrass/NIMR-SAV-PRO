# Deploiement - Planification atelier

## Checklist preproduction

- [ ] Pull Request revue par le responsable technique et le responsable securite.
- [ ] Aucun secret, token ou fichier `.env.*.local` suivi par Git.
- [ ] Projet preproduction distinct de la production et project refs compares.
- [ ] `npm run supabase:dev:preflight` retourne `PASS`.
- [ ] `npx supabase migration list` confirme l'ordre et l'etat des migrations.
- [ ] Migration `20260730150000_decouple_audit_events_from_mutable_entities.sql` presente comme migration distincte.
- [ ] Backup ou justification DEV documentee avant toute mutation.
- [ ] Schema read-only `APPLIED_VALID`.
- [ ] Auth, RLS, concurrence, idempotence et audit PASS.
- [ ] UAT par role executee dans `docs/WORKSHOP_SCHEDULING_UAT.md`.
- [ ] Cleanup `PASS_AUDIT_RETAINED` avec zero fixture mutable et zero compte temporaire.
- [ ] Rapport de recette et signatures attaches a la Pull Request.
- [ ] Aucun acces production utilise pendant la recette.

## Checklist promotion vers preproduction

- [ ] Appliquer les migrations dans l'ordre sur la preproduction uniquement.
- [ ] Verifier que les migrations deja appliquees ne sont pas modifiees.
- [ ] Executer le test de retention des audits en transaction rollback-only.
- [ ] Verifier que les FK de `audit_events` vers les entites mutables ont disparu.
- [ ] Verifier que les FK et triggers de `audit_logs` hors perimetre restent inchanges.
- [ ] Executer la recette metier signee.
- [ ] Activer le frontend preproduction avec les seules cles preproduction.
- [ ] Verifier les logs, RLS, erreurs Auth et performances pendant la fenetre de recette.
- [ ] Declarer `GO_PREPRODUCTION_TECHNIQUE` uniquement apres signature UAT.

## Checklist rollback

- [ ] Stopper la promotion et remettre le frontend en mode precedent.
- [ ] Desactiver les nouvelles actions metier au niveau de la release, sans modifier les audits.
- [ ] Conserver les audits et les journaux de recette pour analyse.
- [ ] Ne jamais utiliser `db reset --linked`, `migration repair`, `TRUNCATE` ou suppression globale.
- [ ] Restaurer les donnees metier depuis la sauvegarde uniquement apres approbation.
- [ ] Ne pas tenter de re-creer les FK d'audit sur une base contenant des audits independants.
- [ ] Si un rollback de schema est requis, produire une migration corrective forward-only apres revue.
- [ ] Executer les tests RLS, audit et smoke avant reprise.
- [ ] Documenter la decision, l'heure, l'operateur et les preuves.

## Prerequis

- un projet Supabase de developpement distinct de la production ;
- Supabase Auth configure ;
- les migrations Backend v2 precedentes appliquees ;
- un compte de test par role ;
- une sauvegarde de la base avant migration.

## Procedure

1. Creer localement le fichier ignore `.env.supabase-dev.local` avec toutes les
   variables de securite documentees, sans les ajouter a Git.
2. Executer le preflight :

```text
npm run supabase:dev:preflight
```

3. Ne continuer que si `verification_dev`, `verification_anti_production` et
   `preflight` valent tous `PASS`.
4. Verifier la CLI puis lier uniquement le projet DEV :

```text
npx supabase --version
npx supabase link --project-ref <PROJECT_REF_DEV>
```

5. Inspecter `npx supabase migration list`.
6. Exporter le schema et, si autorise, les donnees DEV dans
   `.backups/supabase-dev/`.
7. Controler les differences puis appliquer reellement les migrations avec
   `npx supabase db push`.
8. Verifier la presence de `btree_gist`.
9. Executer le test catalogue PostgreSQL contre le projet DEV :

```text
npm run db:test:workshop
```

10. Charger les referentiels atelier dans un environnement de developpement.
11. Creer les profils et roles sans utiliser de compte client reel.
12. Executer `npm run test:workshop:rls`.
13. Executer `npm run test:workshop:concurrency` avec une tache DEV neuve.
14. Verifier qu'un seul appel retourne `server_confirmed`, que le rejeu retourne
    le meme identifiant et qu'un payload different est refuse.
15. Configurer temporairement le frontend local :

```text
VITE_BACKEND_MODE=backend-enabled
VITE_BACKEND_ENV=staging
VITE_SUPABASE_URL=<URL_STAGING>
VITE_SUPABASE_ANON_KEY=<CLE_ANONYME_STAGING>
```

16. Executer lint, tests, build et E2E sur ordinateur, tablette et mobile.
17. Tester le rollback sur une base DEV isolee ou clonee.
18. Nettoyer uniquement les comptes et fixtures prefixes par l'identifiant de
    recette.
19. Faire une recette terrain avant promotion vers la production.

Ne jamais utiliser les scripts de concurrence avec une URL de production. Les
scripts refusent toute URL dont l'hote ne ressemble pas explicitement a
`localhost`, `dev` ou `staging`.

## Verification RLS

Tester la lecture et l'ecriture pour chaque role. Verifier notamment que :

- Lecture seule ne peut rien modifier ;
- Reception ne modifie pas une reservation verrouillee ;
- Technicien ne voit et ne modifie que ses taches ;
- Controle Qualite ne planifie pas ;
- aucun utilisateur ne modifie son role ;
- l'audit ne peut etre modifie ni supprime.

## Rollback

La migration est additive. En cas d'incident :

1. remettre le frontend en `local-only` ;
2. stopper les nouvelles confirmations serveur ;
3. conserver les tables pour l'analyse et l'audit ;
4. restaurer la sauvegarde si des donnees doivent etre annulees ;
5. ne supprimer les nouvelles tables qu'apres export des audits et validation
   du responsable technique.

Ne pas tenter un rollback destructif automatique en production.

## Recette automatisee

Le bootstrap DEV cree automatiquement les comptes, les fixtures et le manifeste
temporaire. L'orchestrateur execute le preflight, la liaison, la sauvegarde,
les migrations, les controles PostgreSQL, les tests Auth/RLS/concurrence, puis
le nettoyage cible.

Commandes :

    npm run supabase:dev:preflight
    npm run supabase:dev:validate-workshop

En cas d'echec apres creation du manifeste :

    npm run supabase:dev:cleanup-workshop -- --fixtures <manifest>

Le preflight compare les project refs et accepte uniquement l'URL exacte du
projet DEV ou une cible locale explicitement autorisee. Il ne depend pas de la
presence des mots dev ou staging dans le hostname.
