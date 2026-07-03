# Lot 7 - Supabase readiness sans backend actif

## Ce qui est livre

Ce document prepare l'architecture Supabase future. Il n'ajoute aucun client Supabase actif, aucune URL, aucune cle, aucun appel reseau et aucun backend reel.

Mention obligatoire : aucun client Supabase actif.

## Tables futures recommandees

- `users`
- `user_roles`
- `vehicles`
- `clients`
- `dossiers`
- `repair_order_lines`
- `workshop_tasks`
- `workshop_reservations`
- `technician_resources`
- `quality_controls`
- `deliveries`
- `audit_events`
- `file_attachments`
- `app_settings`

## Mapping frontend vers Supabase

- `User` -> `users`
- role utilisateur -> `user_roles`
- `VehicleMasterRecord` -> `vehicles`
- donnees client dossier -> `clients`
- `DossierSAV` -> `dossiers`
- `RepairOrderLine` -> `repair_order_lines`
- taches atelier derivees -> `workshop_tasks`
- `WorkshopReservation` -> `workshop_reservations`
- `TechnicienResource` -> `technician_resources`
- `ChecklistQualite` -> `quality_controls`
- livraison dossier -> `deliveries`
- `AuditTrailEntry` -> `audit_events`
- `FileAttachment` -> `file_attachments`
- configuration atelier/application -> `app_settings`

## Strategie RLS

RLS devra etre activee sur toutes les tables metier.

Principes :

- Directeur SAV : lecture/ecriture complete operationnelle.
- Chef atelier : planning, taches, ressources, reservations, lecture dossiers.
- Technicien : lecture taches affectees, mise a jour execution, pas d'acces financier.
- Controle qualite : QC, lecture dossier/taches.
- Livraison : livraison et lecture statut QC.
- Reception : creation dossier et reception, pas de diagnostic stockage.
- Lecture seule : consultation technique limitee.

## Droits serveur

Les droits devront etre appliques cote API ou Edge Functions. Le frontend ne devra jamais etre la seule barriere.

## Audit trail serveur

La table `audit_events` devra etre append-only autant que possible.

Evenements minimum :

- import devis ;
- affectation par tache ;
- affectation en masse ;
- remplacement compagnon avec motif ;
- proposition creneau ;
- reservation automatique ;
- ETA recalculee ;
- QC ;
- livraison ;
- logout.

Ne jamais journaliser prix, paiement, caisse, montant, stock reel ou facturation reelle.

## Verrouillage concurrent

Les operations planning devront utiliser transactions ou verrous optimistes :

- version de dossier ;
- version de reservation ;
- controle de collision serveur ;
- rejet si un creneau est pris entre lecture et ecriture.

## Conflits planning

La validation serveur devra reprendre :

- compatibilite technicien / metier ;
- compatibilite baie / pont ;
- horaires atelier ;
- absences ;
- indisponibilites pont ;
- jours fermes ;
- collisions reservations et taches planifiees.

## Migration IndexedDB vers Supabase

Etapes futures :

1. Export local IndexedDB.
2. Validation schema.
3. Import serveur par lots.
4. Deduplication par identifiants metier.
5. Journalisation migration.
6. Bascule lecture seule locale.
7. Activation backend.

## Google Drive futur

Supabase stockera les metadonnees et droits des fichiers. Google Drive stockera les binaires photos/videos.

Compte proprietaire Google Drive prevu : `mhadhbikhaled@gmail.com`.

## Limites actuelles client-side

- Authentification non serveur.
- RLS absente.
- Donnees locales navigateur.
- Pas de sauvegarde centralisee.
- Pas de verrouillage concurrent reel.

## Interdictions Lot 7

- pas de client Supabase actif ;
- pas de cle Supabase ;
- pas d'URL Supabase ;
- pas d'appel reseau ;
- pas de backend reel.

## Decision

GO preparation architecture.

NO GO production sans backend.

NO GO production large tant que RLS, droits serveur, audit serveur et verrouillage concurrent ne sont pas livres.
