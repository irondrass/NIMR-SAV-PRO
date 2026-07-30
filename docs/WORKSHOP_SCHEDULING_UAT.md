# Workshop Scheduling - UAT preproduction

## Statut

- Verdict technique : `GO_PREPRODUCTION_TECHNIQUE`.
- Validation DEV automatisée : `APPLIED_VALID`.
- Recette métier NIMR : validée GO le 30/07/2026.
- Aucune donnée client réelle ne doit être utilisée.

## Prerequis

- Projet Supabase preproduction distinct de la production.
- `npm run supabase:dev:preflight` retourne `PASS`.
- Comptes de recette crees uniquement pour les roles ci-dessous.
- Jeu de donnees anonymise charge et identifie par un `runId`.
- Navigateur ordinateur, tablette et mobile disponibles.
- Testeur metier habilite et responsable de la signature.

## Jeu de donnees anonymise

- Atelier : `WS_UAT_ATELIER`.
- Equipe : `WS_UAT_EQUIPE_A`.
- Deux techniciens, niveaux Junior/Autonome/Expert, horaires 08:00-17:00.
- Une absence temporaire et une ressource indisponible.
- Deux vehicules anonymises `WS_UAT_VIN_A` et `WS_UAT_VIN_B`.
- Deux dossiers sans identite client reelle.
- Taches diagnostic de 60 minutes avec competence, ressource, dependance et piece indisponible.
- Une ressource exclusive et une ressource partageable capacite 2.

## Recette par role

### Directeur SAV

- [x] Se connecter avec le compte Directeur SAV.
- [x] Consulter les ateliers, equipes, ressources, competences et planning.
- [x] Modifier un parametre de planification et verifier l'audit.
- [x] Creer, confirmer, rejouer et annuler une reservation.
- [x] Verifier qu'un conflit de ressource est refuse ou explicitement surbooke avec motif.
- Résultat attendu : acces complet au perimetre autorise, aucune action silencieuse, audit append-only.
- Résultat obtenu : PASS

### Chef Atelier

- [x] Consulter les techniciens, horaires, absences et taches de son atelier.
- [x] Affecter une tache a un technicien compatible.
- [x] Planifier une tache avec ressource disponible.
- [x] Tenter une ressource indisponible et verifier le refus explicite.
- [x] Executer deux confirmations concurrentes avec deux sessions Chef.
- Résultat attendu : une seule confirmation `server_confirmed`, un conflit explicite pour l'autre, rejeu idempotent.
- Résultat obtenu : PASS

### Reception

- [x] Creer ou consulter un dossier et ses lignes de reparation.
- [x] Associer un vehicule anonymise et une demande d'intervention.
- [x] Consulter l'ETA et les disponibilites exposees.
- [x] Tenter une modification reservee au pilotage atelier.
- Résultat attendu : gestion reception autorisee, changement de planning protege par RLS et permissions.
- Résultat obtenu : PASS

### Technicien

- [x] Ouvrir uniquement ses taches et son planning.
- [x] Demarrer, mettre en pause, reprendre et terminer une tache.
- [x] Tenter de lire la tache d'un autre atelier ou technicien.
- [x] Tenter de modifier une reservation qui ne lui appartient pas.
- Résultat attendu : perimetre strict, refus RLS hors perimetre, evenements de temps audites.
- Résultat obtenu : PASS

### Controle Qualite

- [x] Consulter les taches pretes pour controle.
- [x] Saisir un controle conforme puis non conforme.
- [x] Verifier le blocage de livraison apres non-conformite.
- [x] Reouvrir une tache corrective et verifier la trace d'audit.
- Résultat attendu : actions QC disponibles, aucune planification ou modification de role.
- Résultat obtenu : PASS

### Magasin PDR

- [x] Consulter les pieces et leurs disponibilites.
- [x] Marquer une piece comme indisponible ou disponible selon le scenario.
- [x] Verifier qu'une tache bloquee par piece ne demarre pas prematurement.
- [x] Tenter de modifier une tache ou une reservation.
- Résultat attendu : gestion PDR limitee aux stocks/pieces autorises, tache correctement bloquee.
- Résultat obtenu : PASS

### Lecture seule

- [x] Consulter le tableau de bord, les dossiers et le planning autorise.
- [x] Tenter une creation, modification, suppression et reservation.
- [x] Tenter de modifier un role ou un audit.
- Résultat attendu : lectures autorisees, toutes les mutations refusees, audits inchanges.
- Résultat obtenu : PASS

## Scenarios transverses

- [x] RLS : anonyme, perimetre atelier, perimetre technicien et lecture seule.
- [x] Concurrence : deux sessions Chef sur ressources identiques.
- [x] Idempotence : meme `operation_id` rejoue, puis payload different avec le meme identifiant.
- [x] Audit : insertion via le mecanisme prevu, lecture, tentative UPDATE et DELETE refusees.
- [x] Retention : suppression d'une fixture avec conservation de l'audit associe.
- [x] Responsive : ordinateur, tablette et mobile sans chevauchement ni action critique hors ecran.

## Résultat global

Résultat attendu : tous les scenarios obligatoires passent sans anomalie bloquante.
Résultat obtenu : PASS, GO metier NIMR confirme.

## Anomalies

Aucune anomalie bloquante ou majeure ouverte.

## Validation finale

- Nom : Khaled Mhadhbi
- Fonction : Directeur Service Après-Vente
- Date : 30/07/2026
- Environnement : Supabase DEV / préproduction technique
- Décision : GO
- Mode de validation : validation électronique confirmée
