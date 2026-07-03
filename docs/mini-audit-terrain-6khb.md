# NIMR SAV PRO - Lot 6K-H-B - Mini-audit terrain ciblé post Hotfix 6K-H-A

Date audit : 2026-07-02  
Base validée : `f92603d Fix mobile E2E drawer navigation`  
Application auditée : https://irondrass.github.io/NIMR-SAV-PRO/  
Périmètre : vérification live ciblée des corrections Hotfix 6K-H-A uniquement.  
Méthode : audit sur build GitHub Pages live avec Chrome/Playwright, scénarios isolés en stockage navigateur local. Aucune correction code, aucun tag, aucun commit.

## A-001 - QC conforme avec tâches ouvertes

ID : A-001  
Statut : OK  
Rôle testé : qc / 4444  
Étapes testées : création locale d'un dossier `NIMR-6KHB-A001` en contrôle qualité avec une tâche atelier encore en cours et une tâche terminée ; ouverture du module Contrôle Qualité ; tentative de validation QC conforme ; confirmation de la modale.  
Résultat observé : QC bloqué avec le message exact `QC impossible : des tâches atelier sont encore ouvertes. (Nombre : 1)`. Le dossier reste au statut `Contrôle qualité` et `validationGlobale` reste `en_attente`.  
Résultat attendu : QC bloqué, message clair avec nombre de tâches ouvertes, aucun passage en `Prêt à livrer`.  
Écart restant : Aucun.  
Gravité restante : Aucune.  
Capture ou remarque : vérification réalisée sur le build live ; stockage navigateur contrôlé pour isoler le dossier de test.  
Décision : Correction validée.

## A-002 - Livraison faux prêts

ID : A-002  
Statut : OK  
Rôle testé : livraison / 5555  
Étapes testées : ouverture du module Livraison avec un dossier réellement livrable `NIMR-6KHB-DELIV-OK` et un faux prêt `NIMR-6KHB-DELIV-BLOCK` au statut `Prêt à livrer` mais avec tâches non terminées.  
Résultat observé : le dossier livrable apparait dans `Prêts à livrer`; le faux prêt n'y apparait pas et est affiché dans `Bloqués livraison`.  
Résultat attendu : les dossiers non livrables ne doivent pas apparaitre dans `Prêts à livrer`; ils doivent être listés comme bloqués avec raison claire.  
Écart restant : Aucun.  
Gravité restante : Aucune.  
Capture ou remarque : Le faux prêt affiche une raison exploitable : `Livraison impossible : 1 tâche bloquée, 1 tâche en pause, 1 tâche en cours, 1 tâche en attente.`  
Décision : Correction validée.

## A-003 - Ressources atelier en base propre

ID : A-003  
Statut : OK  
Rôle testé : chefatelier / 2222  
Étapes testées : ouverture du Planning Atelier en base locale sans ressource ; vérification du message vide ; création d'une ressource mécanicien puis d'une ressource peintre ; réouverture du planning.  
Résultat observé : en base vide, le message `Aucune ressource atelier configurée. Créez les ressources avant planification.` est affiché. Après création de `Mecanicien Audit 6KHB` et `Peintre Audit 6KHB`, les ressources sont enregistrées et le Gantt devient visible/utilisable.  
Résultat attendu : message clair en absence de ressources, puis planning utilisable avec ressources compatibles.  
Écart restant : Aucun.  
Gravité restante : Aucune.  
Capture ou remarque : ressources observées en stockage live : mécanicien zone `Grands Travaux Mécaniques`, peintre zone `Peinture`.  
Décision : Correction validée.

## A-004 - Mobile

ID : A-004  
Statut : OK  
Rôle testé : directeur / 0000  
Étapes testées : ouverture du live en viewport téléphone 390x844 ; vérification initiale de la sidebar ; ouverture du drawer ; contrôle largeur page et visibilité contenu.  
Résultat observé : sidebar repliée hors champ, bouton menu mobile visible et ouvrable, contenu visible après ouverture, `scrollWidth` = `clientWidth` = 390, aucun overflow horizontal détecté.  
Résultat attendu : sidebar repliée, drawer ouvrable, contenu visible, aucun overflow horizontal, boutons utilisables.  
Écart restant : Aucun.  
Gravité restante : Aucune.  
Capture ou remarque : vérification effectuée en viewport 390x844 sur le build live.  
Décision : Correction validée.

## A-005 - Déconnexion

ID : A-005  
Statut : OK  
Rôle testé : directeur / 0000 puis reception / 1111  
Étapes testées : connexion directeur ; vérification du rôle affiché ; déconnexion ; retour écran login ; connexion reception.  
Résultat observé : rôle initial `Directeur SAV`, retour au login après déconnexion, puis rôle actif `Receptionnaire` après connexion reception.  
Résultat attendu : déconnexion effective, retour login, aucune persistance incorrecte du rôle précédent.  
Écart restant : Aucun.  
Gravité restante : Aucune.  
Capture ou remarque : changement de session validé sans rafraîchissement manuel.  
Décision : Correction validée.

## A-006 - Import devis mapping cohérent

ID : A-006  
Statut : OK  
Rôle testé : chefatelier / 2222  
Étapes testées : import live d'un devis mixte contenant vidange, contrôle géométrie, diagnostic valise électrique, faisceau, tôlerie/préparation et peinture ; contrôle preview import ; confirmation ; contrôle des tâches créées ; contrôle planning sur une tâche peinture.  
Résultat observé : les tâches créées sont cohérentes avec le tableau final et les métiers planning : vidange -> `quick-service`, contrôle géométrie -> `mechanical`, diagnostic valise -> `electrical`, faisceau -> `electrical`, D/P préparation -> `body-disassembly` + `reassembly`, peinture -> `preparation` + `paint` + `finish`. La tâche `Peinture mutualisee par zone/cote cabine` est au stage `paint`. Dans le planning, peinture + mécanicien bloque le bouton (`Corriger le créneau`), tandis que peinture + peintre rend le bouton `Enregistrer` disponible.  
Résultat attendu : carte et tableau import cohérents avec la tâche créée et le métier planning ; contrôle géométrie en réparation mécanique ; diagnostic/faisceau en réparation électrique ; peinture jamais vers mécanicien.  
Écart restant : Aucun écart fonctionnel.  
Gravité restante : Aucune.  
Capture ou remarque : le preview affiche aussi deux lignes techniques à faible confiance (`MO`, `MO-TOL`) non importées comme tâches ; elles ne génèrent pas d'OR atelier.  
Décision : Correction validée.

## A-007 - QC forfaitaire

ID : A-007  
Statut : OK  
Rôle testé : chefatelier / 2222  
Étapes testées : import live d'un devis contenant `MO CONTROLE QUALITE FORFAITAIRE` entre deux lignes MO atelier ; confirmation import ; contrôle OR créés ; contrôle options de planification.  
Résultat observé : le forfait QC apparait en preview comme ligne `Divers` sans stage atelier. Seules les tâches `Vidange MOTEUR` et `Remplacement PLAQUETTES FREIN AVANT` sont créées. Aucune tâche atelier QC n'est créée, aucune option planning ne contient QC/qualité, le module Controle Qualite reste accessible comme module séparé.  
Résultat attendu : aucune tâche atelier QC créée ; QC reste dans le module QC ; rien n'est planifié dans le Gantt comme tâche atelier QC.  
Écart restant : Aucun.  
Gravité restante : Aucune.  
Capture ou remarque : options planning observées : vidange et plaquettes uniquement.  
Décision : Correction validée.

## A-011 - Placeholder démo réception

ID : A-011  
Statut : OK  
Rôle testé : reception / 1111  
Étapes testées : ouverture reception ; contrôle champ VIN ; contrôle champ kilométrage vide ; tentative de passage d'étape sans kilométrage.  
Résultat observé : absence du placeholder `DEMOVIN000000001`, placeholder VIN `Ex : L...`, kilométrage vide, blocage de validation avec `Le kilométrage est obligatoire.`  
Résultat attendu : absence du VIN démo, kilométrage vide, passage d'étape bloqué si kilométrage vide.  
Écart restant : Aucun.  
Gravité restante : Aucune.  
Capture ou remarque : contrôle effectué sur base propre live.  
Décision : Correction validée.

## A-014 - Messages livraison

ID : A-014  
Statut : OK  
Rôle testé : livraison / 5555  
Étapes testées : contrôle d'un dossier avec tâches bloquée, en pause, en cours et en attente ; contrôle d'un dossier avec uniquement trois tâches en attente/non terminées.  
Résultat observé : message détaillé pour statuts mixtes : `Livraison impossible : 1 tâche bloquée, 1 tâche en pause, 1 tâche en cours, 1 tâche en attente.` Message agrégé pour attente seule : `Livraison impossible : 3 tâches non terminées.`  
Résultat attendu : raisons de blocage précises et exploitables terrain : nombre de tâches non terminées, tâches bloquées, en pause et en cours.  
Écart restant : Aucun.  
Gravité restante : Aucune.  
Capture ou remarque : les messages sont suffisamment précis pour action atelier/livraison.  
Décision : Correction validée.

## Décision finale

Décision : GO Lot 7

Justification : tous les critères GO demandés sont OK sur le build live : A-001, A-002, A-003, A-004, A-005, A-006, A-007, A-011 et A-014. Aucune anomalie P0 ou P1 importante restante n'a été observée dans le périmètre ciblé Hotfix 6K-H-A.

Actions non réalisées conformément aux interdictions : aucune modification code, aucune correction directe, aucun commit, aucun tag, aucune création `v1.1.1-rc4`, aucun démarrage Lot 7, aucun démarrage Backend.
