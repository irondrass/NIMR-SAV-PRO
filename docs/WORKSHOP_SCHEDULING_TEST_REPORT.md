# Rapport de tests - Planification atelier

## Couverture ajoutee

- horaires, pauses et indisponibilites ;
- niveaux de competence ;
- pieces obligatoires ;
- dependances ;
- chevauchements technicien, materiel, vehicule et tache ;
- duree complete avec preparation, sechage, qualite et marges ;
- premier creneau et alternatives ;
- replanification sans mouvement des taches verrouillees ;
- capacite et KPI ;
- idempotence, retry borne et resolution de conflit ;
- contrats SQL, contraintes GiST, RLS, audit et RPC ;
- acces E2E Directeur, Lecture seule et Technicien.

## Commandes

```text
npm run lint
npm test
npm run build
npx playwright test e2e/50-workshop-operations.spec.ts
```

## Resultats

- `npm run lint` : OK, aucune erreur TypeScript.
- `npm test` : OK, suite historique et nouveaux tests.
- `npm run build` : OK, 1 746 modules transformes.
- `WorkshopOperationsView` charge dynamiquement : 25,62 kB (8,80 kB gzip).
- Bundle principal : 1 107,44 kB (274,34 kB gzip), contre environ
  1 130,53 kB (281,09 kB gzip) avant extraction.
- `npm run qa:agent` : 155 controles OK, 0 KO.
- `npm run check:no-secrets` : OK.
- `npm run backend:v2:check` : dry-run OK.
- E2E cible `50-workshop-operations` : 9/9.
- Shard desktop : 229/229.
- Shard mobile : 229/229.
- Shard tablette : 229/229.
- Total E2E complet : 687/687.

Le build conserve un avertissement de taille sur le bundle principal malgre
l'extraction du module de pilotage atelier. D'autres vues devront etre chargees
dynamiquement dans un lot de performance distinct.

La CLI Supabase 2.110.0 a ete rendue disponible via `npx` et le projet local a
ete initialise. La migration SQL reste non executee : `npx supabase start`
echoue car le moteur Docker Linux est indisponible et WSL est desactive
(`Wsl/0x80070422`). `npm run db:test:workshop` confirme le blocage avec
`LegacyDbConnectError: Failed to connect`. Les tests concurrence et RLS reels
sont prepares mais non executes. Ils restent obligatoires avant production.

## Tentative Supabase DEV distante

- `npm run supabase:dev:preflight` : FAIL attendu et securise ;
- fichier `.env.supabase-dev.local` dans le depot courant : absent ;
- verification DEV : FAIL ;
- verification anti-production : FAIL faute de references comparables ;
- commande distante executee : aucune ;
- secret affiche ou ecrit dans Git : aucun.

Le bootstrap `supabase:dev:fixtures`, le nettoyage cible
`supabase:dev:cleanup-workshop` et l'orchestrateur
`supabase:dev:validate-workshop` sont syntaxiquement valides mais non executes.

## Recette manuelle

- creer un dossier et plusieurs taches ;
- declarer une piece indisponible et verifier le blocage ;
- rechercher un creneau commun ;
- confirmer avec une session Chef Atelier ;
- lancer simultanement la meme confirmation dans une seconde session ;
- verifier le conflit lisible et l'absence de doublon ;
- executer pause, reprise et fin ;
- refuser puis valider le controle qualite ;
- verifier l'audit, les notifications et le passage a la livraison ;
- couper puis retablir le reseau et verifier la file de synchronisation.
