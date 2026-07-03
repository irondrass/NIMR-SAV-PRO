# Lot 7 - Migration stockage localStorage vers IndexedDB

## Ce qui est livre

La migration Lot 7 copie les cles existantes `nimr-sav-pro-*` vers IndexedDB sans supprimer localStorage.

Cles couvertes :

- dossiers
- reclamations
- ressources atelier
- logs activite locale
- reservations planning
- disponibilites atelier
- referentiel vehicules
- audit trail
- parametres
- metadonnees fichiers futures
- version de schema

## Strategie

1. L'application charge d'abord localStorage pour garder le comportement historique.
2. `bootstrapLot7Storage()` ouvre IndexedDB si disponible.
3. Les donnees localStorage sont copiees vers IndexedDB.
4. Les tableaux sont fusionnes par identifiant metier pour eviter les doublons.
5. Si localStorage est vide mais IndexedDB contient une cle, la valeur IndexedDB est restauree dans localStorage.
6. Les ecritures locales sont ensuite miroir vers IndexedDB.

## Fallback

Si IndexedDB est indisponible ou echoue :

- l'application reste utilisable ;
- le mode affiche est `localStorage fallback` ;
- aucune donnee metier existante n'est ecrasee ;
- le diagnostic signale le statut.

## Schema

Version locale : `7`.

La version est stockee dans `nimr-sav-pro-storage-schema-version`.

## Backend futur

Cette migration prepare la future extraction vers Supabase, mais elle ne cree aucun backend actif.

## Google Drive futur

Les metadonnees fichiers sont stockees localement via `nimr-sav-pro-file-attachments-v1`.

Compte proprietaire Google Drive prevu : `mhadhbikhaled@gmail.com`.

Ce compte reste une information documentaire et ne declenche aucune authentification.

## Limites

- Pas de resolution de conflit multi-poste.
- Pas de chiffrement serveur.
- Pas de backup automatique hors navigateur.

## Tests

- migration localStorage vers IndexedDB ;
- fallback localStorage ;
- base vide ;
- non-duplication par identifiant ;
- conservation des cles `nimr-sav-pro-*` ;
- diagnostics coherents.

## Decision

GO recette locale lourde.

NO GO production large sans backend v2.0.
