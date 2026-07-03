# Lot 7 - IndexedDB, performance et readiness backend

## Ce qui est livre

- Couche IndexedDB locale via `src/data/indexedDbProvider.ts`.
- Migration progressive localStorage vers IndexedDB via `src/data/storageMigration.ts`.
- Fallback localStorage si IndexedDB est indisponible.
- Version de schema locale `7`.
- Diagnostic stockage visible Directeur SAV / lecture technique.
- Pagination simple de la liste dossiers.
- Limitation du rendu des besoins de reservation atelier.
- Filtrage Gantt par date visible.
- Audit trail local limite/pagine pour les gros volumes.
- Contrats metadata-only pour les fichiers photos/videos futurs.

## Ce qui reste local

Le runtime reste local et client-side. localStorage est conserve pour compatibilite et pour les tests historiques. IndexedDB sert de miroir durable et de source de restauration locale si localStorage est vide.

## Prepare pour backend

Les repositories et contrats preparent une future migration backend, mais aucun backend actif n'est ajoute dans ce lot. Aucun appel reseau, aucune URL Supabase et aucune cle Supabase ne sont introduits.

## Prepare pour Google Drive

Google Drive est documente comme stockage binaire futur des photos/videos. Les metadonnees locales utilisent `storageProvider: "future-google-drive"`. Aucun upload reel, aucun OAuth Google et aucune cle Google API ne sont presents.

Compte proprietaire Google Drive prevu : `mhadhbikhaled@gmail.com`.

Ce compte est documente uniquement. Il ne doit pas etre hardcode comme identifiant d'authentification frontend.

## Limites actuelles

- Pas de securite serveur.
- Pas de verrouillage concurrent serveur.
- Pas de synchronisation multi-poste.
- Pas de stockage binaire reel pour photos/videos.
- Bundle Vite encore volumineux.

## Risques

- Perte de donnees possible si l'utilisateur efface tout le stockage navigateur.
- Conflits non resolus entre deux postes car pas de backend.
- IndexedDB peut etre bloque par certains modes navigateur, d'ou le fallback localStorage.

## Tests

- `tests/indexeddb-provider.test.ts`
- `tests/storage-migration-lot7.test.ts`
- `tests/performance-4000-dossiers.test.ts`
- `tests/planning-gantt-performance.test.ts`
- `tests/audit-trail-performance.test.ts`
- `tests/storage-diagnostics.test.ts`
- `tests/pwa-cache-session.test.ts`
- `e2e/45-lot7-storage-performance.spec.ts`

## Decision

GO Lot 7 pour recette pilote encadree.

NO GO production large sans backend v2.0, authentification serveur, base centralisee, droits serveur et audit trail serveur.
