# Backend Migration Readiness

## Statut actuel

Le runtime reste local et pilote :

- stockage effectif : `localStorage`
- backend actif : non
- serveur API actif : non
- authentification serveur : non
- données réelles client : non ajoutées

## Couche dépôt ajoutée

La couche `src/data/*Repository.ts` prépare une migration progressive sans changer le comportement runtime :

- `dossierRepository`
- `vehicleRepository`
- `clientRepository`
- `workshopTaskRepository`
- `planningRepository`
- `qcRepository`
- `deliveryRepository`
- `auditRepository`

Ces dépôts reposent sur `createLocalCollectionRepository` et acceptent un `StorageLike`, ce qui permet :

- tests avec `MemoryStorageLike`
- maintien `localStorage` côté navigateur
- futur adaptateur IndexedDB
- futur adaptateur backend API sans réécrire les composants

## Contrat de migration

`BACKEND_MIGRATION_READINESS` documente l'état attendu :

- `currentRuntime = localStorage`
- `preparedTargets = IndexedDB, backend-api`
- `backendEnabled = false`
- `authServerEnabled = false`

## Prochaine étape recommandée

1. Migrer progressivement les accès directs `localStorage` des vues vers les dépôts.
2. Ajouter un adaptateur IndexedDB local.
3. Définir un contrat API seulement après stabilisation des règles métier locales.
4. Ajouter l'auth serveur et la synchronisation distante dans un lot séparé.

## Risques surveillés

- Les composants historiques écrivent encore directement certaines clés `localStorage`.
- Les fixtures `src/data.ts` doivent rester hors du runtime de démarrage.
- Toute migration backend devra préserver les règles de suppression tâche, QC et livraison déjà couvertes par tests.

