# Lot 7 - Readiness Google Drive photos et videos

## Ce qui est livre

Lot 7 prepare uniquement les metadonnees locales et la documentation pour un stockage futur Google Drive.

Google Drive = stockage binaire photos / videos.
Supabase = metadonnees, droits, audit, `dossierId`.

Compte proprietaire Google Drive prevu : `mhadhbikhaled@gmail.com`.

Ce compte est documente uniquement. Il ne doit pas etre hardcode dans le frontend comme compte d'authentification.

## Architecture future

Frontend NIMR SAV PRO
-> Backend / Supabase Edge Function futur
-> Google Drive API compte Google Pro
-> stockage photos / videos dans Google Drive
-> metadonnees stockees dans Supabase

## Contrat metadata-only

Le type `FileAttachment` prepare :

- `id`
- `dossierId`
- `category`
- `fileName`
- `mimeType`
- `size`
- `createdAt`
- `uploadedBy`
- `storageProvider: "future-google-drive"`
- `ownerAccountHint`
- `futureDriveFileId`
- `futureDownloadUrl`
- `status`

`ownerAccountHint` est une information documentaire ou metadata future. Ce champ ne sert pas d'identifiant d'authentification et ne declenche aucun appel Google.

## Telechargement futur

Le telechargement depuis l'application devra passer par un backend securise :

1. verification role utilisateur ;
2. verification acces dossier ;
3. journalisation consultation/telechargement ;
4. generation d'un lien temporaire ou streaming backend ;
5. aucune cle Google exposee au frontend.

## Audit trail futur

Evenements a journaliser :

- ajout photo ;
- ajout video ;
- consultation ;
- telechargement ;
- suppression metadata ;
- echec upload ;
- refus droits.

Ne jamais journaliser prix, paiement, caisse, montant, stock reel ou facturation reelle.

## Structure Drive future recommandee

```text
NIMR-SAV-PRO/
  2026/
    NIMR-2026-0001/
      reception/
      atelier/
      qc/
      livraison/
      videos/
      documents/
```

## Interdictions Lot 7

- pas d'OAuth Google ;
- aucune clé Google API ;
- pas d'upload réel ;
- pas de téléchargement réel Google Drive ;
- pas de secret dans le repo ;
- pas de vrai fichier client ;
- pas d'identifiants Google exposes cote frontend.

## Limites actuelles

- Les fichiers binaires ne sont pas stockes.
- Les champs `futureDriveFileId` et `futureDownloadUrl` restent inactifs.
- Les droits reels devront etre controles par backend.

## Tests

- contrat metadata sans upload ;
- compte proprietaire documente ;
- absence du compte proprietaire dans `src/types/fileAttachments.ts` et `src/data/fileAttachmentRepository.ts` ;
- absence de token/secret/cle Google ;
- repository local metadata-only.

## Decision

GO preparation Google Drive.

NO GO upload reel tant que backend securise, OAuth serveur et controle d'acces ne sont pas livres.
