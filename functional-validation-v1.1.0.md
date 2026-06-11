# Validation fonctionnelle NIMR SAV PRO v1.1.0

Date audit : 2026-06-11  
Périmètre : pré-Lot 5, après Lot 4A Planning Chef Atelier avancé.  
Décision : **Corrections obligatoires avant Lot 5**.

## A. Recette par rôle

| Rôle | Recette couverte | Résultat | Points de vigilance |
| --- | --- | --- | --- |
| Directeur SAV | Tableau de bord, accès global, changement rôle, dossier, QC, livraison, paramètres, import/export | OK fonctionnel | Le forçage manuel de statut reste trop puissant pour un usage terrain. |
| Chef Atelier | Planning Gantt, affectation technicien, blocage/reprise, réouverture tâche, planification | OK avec réserve | Collisions planning visibles mais pas toutes bloquantes à l'enregistrement. |
| Réceptionnaire | Réception guidée, photos, dossier, livraison | OK avec réserve | Champs critiques téléphone/VIN peuvent rester faux ou générés automatiquement. |
| Technicien | Vue tactile, démarrage/pause/reprise/blocage/fin tâche, photos, notes | OK avec réserve | Une tâche peut encore être lancée depuis certains écrans si le dossier n'a pas de technicien. |
| Contrôle Qualité | Checklist, acceptation, refus avec motif | OK | Le statut forcé peut contourner indirectement le verrou QC. |
| Livraison | Signature simulée, restitution, prêt facturation | Partiel | Signature non persistée et garde-fous livraison insuffisants si statut forcé/importé. |
| Lecture seule | Consultation sans actions critiques | OK | Continuer à vérifier l'absence DOM des actions sensibles à chaque lot. |

Validation automatique disponible au dernier passage Lot 4A :
- `npm test` OK
- `npm run lint` OK
- `npm run build` OK
- `npm run test:e2e` OK, 135 tests passés desktop/mobile/tablette

## B. Audit métier SAV

| Module | Rôle concerné | Problème | Impact SAV | Gravité | Recommandation | Priorité |
| --- | --- | --- | --- | --- | --- | --- |
| Planning | Chef Atelier | Les alertes collision technicien/pont/surcharge sont affichées mais `handleSaveManualPlanning` ne bloque réellement que hors horaires/dimanche/samedi après-midi. | Double réservation possible malgré alerte, planning terrain non fiable. | Bloquant | Interdire l'enregistrement si collision technicien, collision pont ou surcharge. Autoriser seulement la scission pause si elle produit des segments valides. | P0 |
| Livraison | Réceptionnaire, Directeur SAV | `confirmDelivery` ne vérifie pas en dur QC accepté + toutes tâches terminées. L'UI affiche les prérequis, mais le statut `PRET_A_LIVRER` peut être forcé ou importé. | Véhicule livrable avec tâche active ou QC refusé si statut incohérent. | Bloquant | Ajouter une fonction métier `canDeliverDossier` utilisée par UI et `confirmDelivery`; bloquer livraison si QC non valide ou OR non terminés. | P0 |
| Dossier SAV | Directeur SAV, Chef Atelier | Le contrôle "Forcer le statut (Démo)" reste visible pour Directeur/Chef. | Permet de sauter réception, travaux, QC ou livraison sans historique métier complet. | Bloquant | Déplacer en mode diagnostic protégé dans Paramètres, masqué par défaut, avec motif obligatoire et log d'audit. | P0 |
| Tâches / OR | Directeur SAV, Chef Atelier, Technicien | `startRepairOrder` ne bloque pas explicitement une tâche si le dossier n'a aucun `technicienId`. | Tâche démarrable sans responsable identifié selon l'écran utilisé. | Majeur | Interdire `startRepairOrder` sans technicien affecté, ou exiger `plannedTechnicianId` au niveau tâche. | P1 |
| Chef Atelier | Chef Atelier | L'affectation simple par dossier met `technicienId` et `EN_TRAVAUX`, sans pont/poste ni champs planning tâche. | Incohérence entre ancien modèle dossier et nouveau modèle tâche/Gantt. | Majeur | Remplacer l'affectation simple par une affectation/planning au niveau tâche, ou marquer le dossier "à planifier". | P1 |
| Tâches / OR | Chef Atelier, Directeur SAV | Une tâche bloquée peut être reprise par "Démarrer/Reprendre" sans étape métier claire de déblocage. | Historique de levée de blocage insuffisant pour atelier/pièces/QC. | Majeur | Créer action "Lever blocage" avec motif/rôle, puis autoriser reprise. | P1 |
| Historique | Tous rôles opérationnels | L'historique `line.history` existe mais n'est pas clairement visible dans l'UI tâche. | Traçabilité faible en cas de litige atelier/client. | Majeur | Afficher l'historique par ligne OR : démarrage, pause, blocage, reprise, fin, réouverture. | P1 |
| Réception | Réceptionnaire | Téléphone, VIN et déposant peuvent être vides ou remplacés par des valeurs par défaut. | Données SAV non exploitables pour rappel client, garantie, ERP. | Majeur | Rendre téléphone et immatriculation obligatoires; VIN obligatoire sauf motif "VIN indisponible" avec preset. | P1 |
| Réception | Réceptionnaire | Observations et plainte acceptent du texte libre sans presets métier suffisants. | Saisie lente et hétérogène sur tablette. | Mineur | Ajouter presets symptômes par type dossier, dégâts carrosserie, objets laissés. | P2 |
| QC | Contrôle Qualité | QC refusé bloque bien le dossier, mais la reprise atelier après refus n'est pas liée à une tâche précise. | Retour atelier moins actionnable. | Majeur | À refus QC, exiger tâche OR cible ou créer automatiquement une tâche de retouche. | P1 |
| Prêt facturation ERP | Réceptionnaire, Directeur SAV | Passage `LIVRE -> PRET_FACTURATION` possible après livraison, mais sans contrôle document/facture/ordre ERP détaillé. | Risque dossier incomplet envoyé ERP. | Mineur | Ajouter checklist facturation : signature, photos, objets remis, accord client, garantie/assurance. | P2 |

## C. Audit UI/UX

| Module | Rôle concerné | Problème | Impact SAV | Gravité | Recommandation | Priorité |
| --- | --- | --- | --- | --- | --- | --- |
| Planning Gantt | Chef Atelier | Gantt lisible en tests, mais blocs très petits avec texte 7-9 px sur mobile/tablette. | Lecture difficile en atelier, erreurs de sélection possibles. | Majeur | Ajouter zoom jour, mode plein écran tablette, info bulle/panneau latéral au tap. | P1 |
| Planning manuel | Chef Atelier | Les alertes collision cohabitent avec un bouton "Enregistrer" toujours très visible. | L'utilisateur peut ignorer l'alerte et sauvegarder une collision. | Bloquant | Désactiver le bouton si collision bloquante; libellé "Corriger le créneau". | P0 |
| Dossier SAV / OR | Chef Atelier, Technicien | Boutons tâche dans la fiche dossier restent petits par rapport au mode technicien tactile. | Usage tablette atelier moins confortable. | Mineur | Harmoniser avec boutons XL du mode technicien pour les actions critiques. | P2 |
| Livraison | Réceptionnaire | Signature client est une zone simulée qui déclenche un `alert`, sans vraie capture. | Expérience non crédible en remise véhicule. | Majeur | Remplacer par composant signature canvas, stocker `signatureClientUri`. | P1 |
| Réception guidée | Réceptionnaire | Alertes navigateur pour erreurs de formulaire/photo. | Rupture UX tablette et messages non homogènes. | Mineur | Remplacer par modals tactiles standardisées. | P2 |
| Paramètres | Directeur SAV | "Exporter Base de données (JSON / CSV)" annonce CSV mais l'action exporte JSON. | Confusion utilisateur. | Mineur | Renommer "Exporter Base JSON" ou ajouter vrai export CSV. | P2 |
| Dossier SAV | Directeur SAV, Chef Atelier | "Forcer le statut (Démo)" visible dans une fiche opérationnelle. | Action dangereuse trop accessible. | Bloquant | Retirer de la fiche opérationnelle avant usage terrain. | P0 |
| Réception / Dossier | Réceptionnaire | Champs VIN, téléphone, immatriculation affichés mais validation métier légère. | Les champs semblent sérieux mais acceptent des valeurs de démo. | Majeur | Validation format + messages inline, pas uniquement `alert`. | P1 |

## D. Audit technique

| Module | Rôle concerné | Problème | Impact SAV | Gravité | Recommandation | Priorité |
| --- | --- | --- | --- | --- | --- | --- |
| Code global | Tous | Occurrences `alert(...)` en production : import/export, réception, réclamation, dossier, planning, signature. | UX inconsistante, difficile à tester et à internationaliser. | Majeur | Remplacer par composant modal/toast unique. | P1 |
| Livraison | Réceptionnaire | Signature non persistée alors que `signatureClientUri` existe dans le type. | Preuve livraison absente en export/import. | Majeur | Implémenter capture canvas et sauvegarde dans dossier. | P1 |
| Planning | Chef Atelier | `DEFAULT_WORKSHOP_BAYS` est codé dans `WorkshopPlanning.tsx`. | Impossible d'administrer les postes atelier sans livraison code. | Mineur | Déplacer en configuration/settings ou données métier versionnées. | P2 |
| Tests | Équipe dev | `console.log("sav-core tests passed")` présent uniquement dans test. | Pas d'impact production. | Mineur | Optionnel : garder ou remplacer par sortie test standard. | P3 |
| Storage | Tous | Recherche ancienne clé : pas d'usage applicatif `nimr_sav` ou `nimr-sav` hors tests de détection. | OK côté isolation nouvelle app. | Mineur | Continuer test `e2e/11-persistence.spec.ts`. | P3 |
| Données démo | Tous | Téléphones, VIN, immatriculations fictifs présents dans `src/data.ts` et E2E. | OK car données clairement "Client Démo", mais à surveiller. | Mineur | Conserver convention "Démo"; ajouter scan anti-données réelles avant release. | P3 |
| Import JSON | Directeur SAV | Validation schéma globale existe, mais pas de normalisation métier complète pour champs planning incohérents importés. | Planning invalide possible après import manuel. | Majeur | Étendre `validateBackupPayload` ou normalisation à `planningStart/end/segments`, collisions et QC/livraison. | P1 |
| Assets / console | Tous | Les derniers E2E smoke couvrent erreurs console bloquantes et assets 404. | OK actuellement. | Mineur | Garder obligatoire en CI avant merge/push. | P3 |

## E. Recommandations avant Lot 5

Mini-lot proposé : **NIMR SAV PRO v1.1.0 — Lot 4C Corrections Pré-Lot 5**

Priorité P0, à faire avant Lot 5 :
1. Bloquer l'enregistrement planning si collision technicien, collision pont ou surcharge.
2. Ajouter garde-fou métier central `canDeliverDossier` et bloquer `confirmDelivery` si QC non accepté ou tâche non terminée.
3. Retirer ou verrouiller "Forcer le statut (Démo)" hors fiche opérationnelle.

Priorité P1, fortement recommandé avant Lot 5 :
1. Interdire démarrage tâche sans technicien/tâche planifiée selon règle choisie.
2. Remplacer la livraison simulée par une vraie signature persistée.
3. Ajouter action "Lever blocage" avec motif et historique.
4. Afficher l'historique de tâche OR.
5. Valider téléphone/VIN/immatriculation avec messages inline.
6. Normaliser et valider les champs planning à l'import JSON.

Priorité P2/P3 :
1. Remplacer les `alert(...)` restants par modal/toast homogène.
2. Améliorer lisibilité Gantt mobile/tablette avec zoom ou panneau de détail.
3. Clarifier export JSON/CSV dans Paramètres.
4. Externaliser les ponts/postes atelier en configuration.

## Décision finale

**Corrections obligatoires avant Lot 5.**

La base v1.1.0 Lot 4A est techniquement stable et testée, mais le passage au Lot 5 doit attendre le mini-lot :

**NIMR SAV PRO v1.1.0 — Lot 4C Corrections Pré-Lot 5**

Raison : les collisions planning enregistrables, la livraison insuffisamment verrouillée et le forçage de statut opérationnel peuvent gêner ou fausser un circuit SAV réel.
