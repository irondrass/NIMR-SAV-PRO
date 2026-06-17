# Rapport de Validation NIMR SAV PRO v1.1.0 — Lots 1 à 6E

Ce document résume l'implémentation et la validation des modifications apportées dans la version **v1.1.0** (Lots 1, 2, 3, 4A, 4C, 5, 5B, 5C, 5D, 5E, 5F-1, 5F-2, 5F-3, 5F-3B, 5F-4A, 5F-4B, 5F-5, 6, 6B, 6C et 6E) de l'application **NIMR SAV PRO**.

---

## 1. Lot 1 : Modals Tactiles & Motifs Standardisés

Nous avons remplacé tous les appels à `prompt()` natifs (et `window.prompt`) par des fenêtres modales internes, interactives, tactiles et testables :
* **Refus QC** (`modal-qc-refuse`) : Motifs prédéfinis (*"Essai routier non validé"*, etc.).
* **Réouverture de tâche** (`modal-task-reopen`) : Motifs prédéfinis (*"Retour client sous garantie"*, etc.).
* **Blocage de tâche** (`modal-task-block`) : Motifs prédéfinis (*"Attente pièce de rechange (Magasin)"*, etc.).

Chaque action confirmée ajoute une entrée structurée dans l'historique du dossier sous le format :
* `[Rôle] - [Action] - Motif: [Motif] (Observations: [Complément])` avec date/heure.

---

## 2. Lot 2 : Réception Rapide Tablette

Nous avons optimisé le wizard de réception guidée pour accélérer la saisie sur tablette tout en conservant la flexibilité de saisie manuelle :
* **Presets Clients Fictifs** (Étape 1) : Choix rapide entre `Client Démo Flotte 001`, `Client Démo Particulier 002` et `Société Démo Transport 003` (avec remplissage automatique du numéro de téléphone associé).
* **Synchronisation Déposant/Propriétaire** : Liaison robuste à l'aide d'un état React `deposantSame`. Si actif, toute modification du client (via preset ou saisie libre) synchronise le déposant. Si désactivé, le déposant peut être saisi de manière indépendante. La saisie manuelle sur le déposant désactive automatiquement cette case.
* **Presets Modèles NIMR** (Étape 2) : Boutons tactiles pour les 8 modèles NIMR officiels (`DFSK Glory 500`, `DFSK Glory 580`, `DFSK E5`, `DFSK BOX`, `Dongfeng Shine`, `Dongfeng Shine Max`, `Forthing T5 EVO`, `Forthing Friday`), qui remplissent à la fois la marque et le modèle du véhicule.
* **Presets Couleurs** (Étape 2) : Choix rapide de teintes courantes (`Blanc`, `Noir`, `Gris`, `Bleu`, `Rouge`).
* **Presets Plaintes Fréquentes** (Étape 3) : Raccourcis tactiles pour les plaintes types (`Entretien périodique / Vidange`, `Bruit train avant`, `Voyant moteur allumé`, etc.). Cliquer sur un preset ajoute le motif ou l'ajoute à la suite d'un texte existant avec une virgule.
* **Boutons Carburant Rapides** (Étape 4) : Boutons pour sélectionner en un clic `Réserve` (5%), `25%`, `50%`, `75%`, ou `100%`. L'indicateur visuel affiche `"Réserve (5%)"` de façon élégante.

---

## 3. Lot 3 : Mode Technicien Tactile

Nous avons amélioré l'usage de l'interface technicien sur tablette et mobile en atelier :
* **Boutons XL Tactiles** : Boutons d'actions agrandis (`py-3.5`, texte gras, icônes contrastées) pour les commandes `Démarrer`, `Pause`, `Reprendre`, `Bloquer` et `Terminer` de pilotage de tâche.
* **Tâche Active Très Visible** : Si une tâche est active (`in_progress`), la carte du dossier reçoit une bordure bleue contrastée, une ombre accentuée, et affiche un bandeau clair *"⚡ TRAVAIL EN COURS SUR CE VÉHICULE"* avec `data-testid="technician-active-task-banner"`.
* **Verrouillage Visuel Strict** : Si le technicien possède déjà une tâche active en cours (sur n'importe quel dossier), tous les autres boutons de démarrage sont désactivés/grisés et accompagnés d'un message d'avertissement explicite *"⚠️ Impossible de démarrer : une tâche est déjà en cours."* avec `data-testid="technician-task-locked-message"`.
* **Notification d'Erreur/Succès DOM** : Suppression des `alert()` natifs pour les actions de pilotage de tâche, remplacés par de beaux bandeaux de messages DOM visibles (`technician-error-message` et `technician-success-message`) avec boutons de fermeture.
* **Observations Rapides (Presets)** : Ajout d'une zone `textarea` (`technician-observation-textarea`) accompagnée de 6 boutons d'observations rapides (ex. *"Vis/Écrou grippé débloqué"*, *"Essai statique conforme"*) pour faciliter la saisie rapide en atelier.
* **Photos Dossier Visibles** : Affichage d'une galerie de photos existantes du dossier (`technician-photo-gallery`), avec vignettes (`technician-photo-thumbnail`) cliquables pour ouvrir une modale de zoom/visionneuse (`technician-photo-viewer`) en lecture seule. La pastille de catégorie sur l'image utilise la propriété `pointer-events-none` pour garantir la stabilité des clics en environnement E2E.
* **Historique Simplifié** : Journalisation chronologique des actions liées au dossier (`technician-task-history`) basée directement sur la structure de données `dossier.historiqueLogs`.

---

## 4. Lot 4A / 4C : Planning Gantt Avancé & Garde-fous Métier

Nous avons développé et intégré la planification visuelle et robuste pour le Chef d'Atelier :
* **Gantt Interactif Avancé** : Lignes par ressource (techniciens/ponts), colonnes par heures de travail quotidiennes.
* **Scission de Pause Déjeuner** : Les heures 12:00 → 13:00 ne sont jamais comptées comme temps travaillé. Une tâche planifiée à cheval sur la pause est scindée automatiquement en deux blocs visuels.
* **Jours Ouvrables Atelier** : Du Lundi au Vendredi (08:00-12:00 / 13:00-17:00) et le Samedi matin (08:00-12:00 uniquement). Le dimanche est fermé.
* **Garde-fous Métier Stricts** : Détection automatique de collisions techniciens ou ponts, alertes en cas de dépassement, et suggestions intelligentes décalant vers le prochain créneau ou jour ouvrable disponible.

---

## 5. Lot 5 : Dashboard KPI Directeur

* **Dashboard Directeur SAV** : En lecture/pilotage uniquement.
* **Aucun ERP** : Aucune caisse, aucun paiement, aucune marge, aucun stock pièces.
* **KPI Opérationnels** :
  * Dossiers ouverts
  * Dossiers en cours
  * Dossiers bloqués
  * Dossiers prêts à livrer
  * Dossiers livrés
  * Dossiers prêts facturation ERP
  * Dossiers en attente clôture ERP
* **Vue Atelier** :
  * Charge techniciens
  * Charge ponts/postes
  * Tâches bloquées
  * Tâches en retard
  * Planning saturé
* **Vue Qualité** :
  * QC accepté
  * QC refusé
  * Motifs de refus QC
  * First Time Right
* **Alertes Directeur** :
  * Dossiers critiques
  * Retards planning
  * Tâches actives anormales
  * Techniciens surchargés
  * Ponts saturés
* **Filtres** : Période, statut, technicien, priorité.
* **Graphiques SVG simples** : Sans dépendance lourde.
* **Moteur KPI pur** : Centralisé dans `src/dashboard-kpis.ts`. Calculs testables sans UI.
* **Réutilisation des garde-fous métier existants** : Comme `canDeliverDossier`.
* **Absence volontaire de chiffre d'affaires** : Paiement, caisse, stock, marge non gérés.

---

## 6. Lot 5B : Connexion locale + Gestion utilisateurs

* **Authentification Locale** : Remplacement du rôle démo visible par une authentification locale.
* **Page Login** : Visible avant accès à l'application.
* **Connexion** : Par username + PIN. PIN hashé localement avec SHA-256.
* **Session Utilisateur** : Session locale et fonctionnalité de déconnexion.
* **Rôle Réel** : Appliqué après connexion. Suppression du sélecteur de rôle démo visible.
* **Gestion Utilisateurs** : Réservée au Directeur SAV.
  * Liste utilisateurs.
  * Création utilisateur.
  * Modification nom affiché / rôle.
  * Activation / désactivation.
  * Réinitialisation PIN.
  * Protection contre la désactivation du dernier Directeur actif.
* **Comptes Démo Intégrés** :
  * `directeur` / `0000`
  * `reception` / `1111`
  * `chefatelier` / `2222`
  * `technicien` / `3333`
  * `qc` / `4444`
  * `livraison` / `5555`
  * `lecture` / `9999`
* **Limites de la Connexion** : Mentionnons clairement que cette authentification reste locale (PWA/localStorage) et que la vraie authentification serveur est prévue plus tard en v2.0.0 avec Supabase/Auth.

---

## 7. Lot 5C : Stabilisation Architecture & Sécurité Locale

Pour clore le cycle de stabilisation locale de la v1.1.0, nous avons structuré la base de code :
* **Permissions Centralisées** : Création du module `src/permissions.ts` regroupant 14 fonctions d'habilitations métiers. Toutes les vérifications de permissions inline dans `App.tsx`, `DossierDetail.tsx` et `SettingsView.tsx` y ont été substituées.
* **Sécurité & TTL de Session** : Implémentation initiale d'un TTL de session glissant basé sur `lastActivityAt`. Ce délai est resserré à 30 minutes au Lot 6E, avec rafraîchissement sur activité utilisateur.
* **Rate Limiting Local** : Limitation à 5 tentatives de connexion incorrectes par nom d'utilisateur (`username`). En cas de dépassement, l'utilisateur est verrouillé pour 5 minutes, empêchant toute tentative d'authentification brutale.
* **Refactoring Kanban** : Extraction de la vue Kanban de `App.tsx` vers un composant dédié `src/components/KanbanBoard.tsx` utilisant des `useMemo` optimisés pour filtrer les colonnes et alléger le rendu de `App.tsx`.
* **Accessibilité et Nettoyage** : Ajout de rôles ARIA standard (`role="navigation"`, `aria-live="polite"`, `aria-label`), de l'`autoFocus` sur le champ de saisie de login, et suppression du code mort relié au `darkMode` pour forcer le thème clair de manière uniforme.

---

## 8. Lot 5D : Planning Intelligent & Agent QA Fonctionnel

### Planning Intelligent
- Correction du moteur de suggestion planning.
- Aucune suggestion dans le passé pour la journée courante.
- Si l’heure actuelle est 09:53, le prochain créneau proposé doit être au minimum 10:00.
- Arrondi automatique au prochain créneau de 15 minutes.
- Scission correcte des tâches traversant la pause déjeuner.
  - Exemple : 10:00 + 2h30 = 10:00-12:00 puis 13:00-13:30.
- Refus strict des dates passées.
- Bascule automatique au prochain jour ouvrable si l’heure actuelle dépasse la fermeture atelier.
- Injection de l’heure système dans `suggestWorkshopSlot` et `validatePlanningAssignment` pour permettre des tests stables.
- Correction du statut technicien :
  - Disponible
  - Occupé maintenant
  - Planifié aujourd’hui
  - Non disponible
- Correction du statut pont/poste :
  - Libre maintenant
  - Occupé maintenant
  - Planifié aujourd’hui
- Ajout de la ligne verticale rouge “Maintenant” dans le Gantt uniquement sur la date du jour.
- Grisement des blocs passés.
- Validation stricte de la sauvegarde planning :
  - collision technicien
  - collision pont
  - planning dans le passé
  - dimanche
  - samedi après-midi
  - hors horaires
  - pause midi non scindée
  - dossier/tâche/technicien/pont inexistant
- Désactivation du bouton sauvegarde si validation bloquante.
- Capture propre des erreurs, sans crash React ni erreur console incontrôlée.

### Agent QA Fonctionnel
- Ajout du script `npm run qa:agent`.
- Mise à jour automatique de `qa-report.md`.
- 18 invariants métiers vérifiés.
- Contrôles couverts :
  - planning dans le passé interdit
  - collisions bloquées
  - dimanche/samedi après-midi interdits
  - pause midi non comptée
  - technicien planifié plus tard ≠ occupé maintenant
  - livraison protégée par QC
  - tâche terminée non redémarrable sans réouverture
  - lecture seule sans modification
  - aucun `prompt()`
  - aucun `alert()`
  - aucun `force-status-select` opérationnel
  - aucune ancienne clé `nimr-sav` ou `nimr_sav`

---

## 9. Lot 5E : Statut Planning + Recherche Véhicule/Dossier

Le Lot 5E finalise la lisibilité atelier du planning et ajoute une recherche véhicule/dossier exploitable sur l'historique SAV :

### Statut Planning
- Affichage du statut tâche dans chaque bloc Gantt :
  - À faire
  - En cours
  - En pause
  - Bloquée
  - Terminée
  - Réouverte
- Ajout de la légende statut tâche dans le planning.
- Séparation claire entre :
  - statut ressource
  - statut tâche
  - statut dossier
  - statut véhicule

### Recherche Véhicule/Dossier
- Ajout du module pur `vehicle-status.ts`.
- Groupement des dossiers par véhicule.
- Recherche par :
  - numéro dossier
  - immatriculation
  - VIN / châssis
  - client
  - modèle
- Gestion d'un véhicule avec plusieurs dossiers SAV.
- Calcul du statut véhicule agrégé.
- Garantie métier : un ancien dossier livré ne masque pas un dossier actif.
- Ajout de la sous-vue **Recherche par véhicule** dans Dossiers SAV.
- Filtres rapides véhicules :
  - Tous
  - dossier actif
  - bloqués
  - en cours
  - prêts à livrer
  - livrés
  - plusieurs dossiers
- Recherche dans Planning par immatriculation / VIN / dossier / client.
- Recherche dans Dashboard Directeur.

---

## 10. Lot 5F-1 : Nettoyage opérationnel Technicien & Dossiers actifs

Le Lot 5F-1 nettoie les vues opérationnelles afin que l'atelier voie uniquement ce qui reste réellement à traiter, sans masquer l'historique métier utile :

### Mode Technicien nettoyé
- Les dossiers terminés, livrés, clôturés ou prêts facturation ERP sont masqués.
- Seules les tâches utiles restent visibles :
  - à faire
  - en cours
  - en pause
  - bloquées
  - réouvertes

### Dossiers SAV
- Vue par défaut **Actifs**.
- Ajout des filtres :
  - **Prêts facturation ERP**
  - **Livrés**
  - **Tous**
- Les dossiers prêts ERP, livrés ou clôturés ne polluent plus la vue active.

### Kanban Atelier
- Vue de production uniquement.
- Exclusion des dossiers prêts ERP, livrés et clôturés.

### Recherche véhicule
- Historique complet conservé pour chaque véhicule.
- Ajout des badges :
  - **Actif**
  - **Prêt facturation ERP**
  - **Livré**
  - **Clôturé**

### Dashboard Directeur
- Conservation des KPI ERP/livrés.
- Distinction claire entre **Opérationnel actif** et **Clôturé / ERP**.

---

## 11. Lot 5F-2 : Workflow Réclamations SAV

Le Lot 5F-2 transforme la page Réclamations SAV en module de suivi opérationnel complet.

- Ajout des statuts :
  - Nouvelle
  - En analyse
  - Action corrective en cours
  - En attente client
  - Résolue
  - Clôturée
  - Réouverte
- Création du module pur `src/complaints-workflow.ts`.
- Gestion des actions :
  - création réclamation
  - modification
  - affectation responsable
  - changement criticité
  - changement statut
  - action corrective
  - commentaire de suivi
  - résolution
  - clôture
  - réouverture
- Historique obligatoire à chaque action.
- Timeline en lecture seule avec :
  - date / heure
  - utilisateur
  - rôle
  - action
  - ancien statut
  - nouveau statut
  - commentaire
  - responsable modifié
- Permissions :
  - Directeur SAV : accès complet
  - Réceptionnaire : création et suivi
  - Chef Atelier : traitement action corrective
  - Contrôle Qualité : consultation / intervention
  - Livraison : consultation
  - Technicien : pas d'accès global
  - Lecture seule : consultation uniquement
- Lecture seule ne voit aucun bouton de modification.
- Réclamation clôturée non modifiable sauf réouverture autorisée.

---

## 12. Lot 5F-3 : Import Devis & Durées Main-d'œuvre

Le Lot 5F-3 intègre proprement l'importation de devis et la gestion de la validation des durées de main-d'œuvre :
- **Module pur d'importation** (`src/quote-import.ts`) : normalisation de texte, extraction intelligente des heures (`2.5H`, `1H30`, `90 min`), classification automatique (Main-d'œuvre, Pièces, Divers) et construction de la prévisualisation d'import.
- **QuoteImportModal** (`src/components/QuoteImportModal.tsx`) : interface interactive permettant de copier-coller un texte de devis brut ou d'importer un fichier CSV, de prévisualiser les lignes, de modifier les descriptions/durées et de valider la sélection avant d'ajouter les tâches (avec source `"quote-import"`).
- **Garanties et validation de durée** :
  - Blocage strict de la planification de toute tâche n'ayant pas de durée valide ou n'ayant pas été validée.
  - Bouton **"Valider durée"** pour valider manuellement les tâches générées automatiquement (`preset` / `demo`) avant de pouvoir les planifier.
  - Formulaire d'ajout manuel renforcé (description obligatoire, durée > 0 obligatoire, bouton d'ajout désactivé si invalide).
- **Zéro CA / Caisse / Paiement / Stock** : Aucune donnée financière, facturation réelle ou gestion de stock n'a été ajoutée, respectant le cahier des charges strict du lot.

### Lot 5F-3B : Import devis PDF multi-pages NIMR

* **Intégration du lecteur PDF texte multi-pages** :
  - Reprise de la logique legacy `extractPdfTextFallback` de l'ancienne application pour extraire et décompresser les flux `/FlateDecode` en JavaScript pur sans dépendance externe lourde.
  - Détection dynamique de la disponibilité de l'API standard `DecompressionStream` avec fallback contrôlé pour garantir la stabilité des tests Node.
  - Lecture complète de toutes les pages dans l'ordre, sans coupure prématurée.
  - Message clair si le PDF est scanné ou illisible : *“PDF non exploitable automatiquement. Copier-coller le texte complet du devis ou utiliser CSV.”*
* **Gestion correcte des pages et des sauts de page** :
  - Les mentions de `Report` et `Montant à reporter` sont ignorées en tant que lignes administratives sans interrompre le parsing.
  - Les marqueurs `Total DT`, `TVA`, `Timbre fiscal` ferment seulement le segment courant. Le parser reprend l'analyse si un nouveau tableau apparaît plus loin ou sur une page suivante.
* **Fusion des lignes multi-lignes** :
  - Fusion automatique des lignes `MO-TOL` coupées sur plusieurs lignes.
  - Détection correcte des lignes `MO-TOL` réparties sur les pages 1 et 2.
* **Exclusion stricte des produits de peinture** :
  - Les consommables/peinture suivants ne deviennent jamais des tâches de main-d'œuvre :
    - `MO-002067 PRODUIT DE PEINTURE`
    - `PRODUIT DE PEINTURE`
    - `PRODUT DE PEINTURE`
  - Ces lignes restent identifiées comme `paint`, décochées et non importables comme tâches.
* **Gestion des tâches à durée 0h** :
  - Visibles en prévisualisation mais décochées par défaut (`selected = false`).
  - La case à cocher (checkbox) est désactivée tant que la durée est `<= 0` (l'utilisateur doit compléter la durée dans l'UI pour pouvoir l'activer).
  - Aucune tâche `RepairOrderLine` n'est créée avec une durée nulle (validation bloquante avec le message *“Durée à compléter avant import.”*).

### Lot 5F-4A : Reprise Planning & Réservation Legacy

Le Lot 5F-4A intègre le flux de réservation d'atelier issu de l'application legacy, s'interfaçant avec le planning Gantt sans le remplacer :
* **Flux de Statuts de Réservation** :
  - `A_RESERVER` : Indique qu'un dossier nécessite une réservation (aucune plage bloquée).
  - `CRENEAU_PROPOSE` : Bloque temporairement un créneau pour le dossier afin d'éviter les doubles suggestions.
  - `RESERVATION_CONFIRMEE` : Bloque réellement le créneau.
  - `ANNULEE` : Libère le créneau immédiatement.
  - `TRANSFORMEE_PLANNING` : Remplacée par les segments Gantt opérationnels.
* **Calculateur de Durée de Réservation** :
  - Exclut les tâches terminées (`done`), les tâches sans durée, les presets non validés, les dossiers livrés, prêts facturation ou clôturés.
  - Ne prend en compte que les tâches non terminées/non livrées avec une durée estimée valide et validée.
* **Calque de Réservation dans le Gantt** :
  - Les réservations proposées ou confirmées sont affichées dans le Gantt sur un calque distinct (les ressources concernées reçoivent des blocs transparents en pointillés bleus pour `CRENEAU_PROPOSE` et bleus avec bordures nettes pour `RESERVATION_CONFIRMEE`).
  - Ajout d'une légende claire dans le planning pour distinguer les types de blocs.
* **Algorithme Anti-Collision et de Placement** :
  - La suggestion de créneau évite automatiquement les blocs Gantt planifiés, les créneaux proposés et les réservations confirmées. Elle ignore les statuts non-bloquants.
  - La conversion distribue les tâches séquentiellement en créant des segments par tâche dans l'ordre de leurs IDs, tout en respectant les horaires de l'atelier, la pause déjeuner (12:00 - 13:00) et en affectant le même technicien/pont si la réservation est globale.
* **Permissions du Workflow** :
  - Directeur SAV et Chef Atelier : Accès complet.
  - Réceptionnaire : Consultation et demande de suggestion simple (ne peut pas confirmer/convertir).
  - Technicien, QC/Livraison, Lecture seule : Consultation uniquement ou accès masqué selon les rôles.
* **Historique Obligatoire** : Chaque changement de statut de réservation est journalisé avec la date, l'utilisateur, son rôle, l'action, l'ancien/nouveau statut et un commentaire.

### Lot 5F-4A.1 : Réservation multi-jours façon legacy

Le Lot 5F-4A.1 fiabilise la gestion des réservations importantes (ex. 52 heures) en implémentant une répartition automatique multi-jours de type legacy :
* **Répartition automatique sur jours ouvrés** : Les durées importantes ne sont plus rejetées pour surcharge journalière, mais scindées automatiquement en créneaux successifs respectant :
  - Les horaires d'ouverture de l'atelier (08:00 - 12:00 et 13:00 - 17:00).
  - La pause déjeuner (12:00 - 13:00) sur les jours de semaine.
  - Le samedi matin (08:00 - 12:00 uniquement).
  - La fermeture le dimanche et le samedi après-midi.
  - Les collisions avec d'autres plannings ou réservations actives.
* **Affichage détaillé des segments** : L'interface utilisateur (`WorkshopPlanning.tsx`) affiche le début et la fin estimée de la charge globale, le nombre de jours sur lesquels la charge est répartie, et propose une vue détaillée collapsible de chaque segment individuel (date, heure de début, heure de fin) via le bouton "Voir les segments".
* **Rendu Gantt ciblé par jour** : Pour éviter toute accumulation visuelle ou superposition, le Gantt filtre les segments de réservations ou tâches planifiées pour n'afficher que ceux qui tombent exactement sur la date sélectionnée.

### Lot 5F-4B : Horaires, absences, indisponibilités et jours fériés

Le Lot 5F-4B gère de façon fine et dynamique la disponibilité globale de l'atelier pour la réservation et la planification de tâches :
* **Horaires hebdomadaires par défaut** : Du lundi au vendredi (08:00 - 12:00 et 13:00 - 17:00), le samedi matin (08:00 - 12:00 uniquement) et fermeture le dimanche.
* **Absences et Indisponibilités** : Formulaire de gestion permettant au Directeur SAV et au Chef d'Atelier de configurer les absences de techniciens (avec horaires optionnels) et les indisponibilités de ponts (avec horaires optionnels). Ces ressources sont alors marquées visuellement et exclues des suggestions intelligentes.
* **Jours Fériés et Fermetures Exceptionnelles** : Possibilité de déclarer des fermetures exceptionnelles d'atelier, affichées sous forme de bannières grises dans le Gantt et bloquant toute affectation.
* **Algorithme d'affectation préservé** : Les réservations de longue durée sautent automatiquement les jours ou tranches d'indisponibilité pour reprendre sur les prochains créneaux disponibles.

### Lot 5F-5 : Base véhicules vendus NIMR + aide réception

Le Lot 5F-5 implémente une base de données locale des véhicules vendus par NIMR pour aider à la saisie lors de la réception :
* **Importation CSV flexible** : Permet au Réceptionnaire et au Directeur SAV d'importer la liste des véhicules vendus via un fichier CSV (support des séparateurs virgule `,` et point-virgule `;`, des guillemets et du mapping intelligent des colonnes françaises ou anglaises).
* **Détection des doublons et erreurs** : Le parseur retourne un rapport d'importation précis détaillant le nombre de lignes importées, ignorées, ainsi que les doublons de VIN ou d'immatriculation.
* **Recherche instantanée** : Champ de recherche multi-critères à l'étape 1 de la réception guidée (recherche par VIN, immatriculation, nom client, modèle ou téléphone).
* **Statut de Garantie dynamique** : Calcul automatique à partir de la date courante (Garantie active, Garantie expirée, Garantie inconnue) avec affichage de notes détaillées sur les dates de fin de garantie pièces et main-d'œuvre.
* **Aide au pré-remplissage sécurisé** : Un clic sur le bouton "Utiliser ce véhicule" remplit automatiquement la marque, le modèle, la version, le VIN et l'immatriculation. En cas de champs déjà renseignés, un modal de confirmation évite tout écrasement accidentel.
* **Confidentialité par rôle (RGPD)** : Le numéro de téléphone client est un champ sensible uniquement visible pour le Directeur SAV et le Réceptionnaire. Il est masqué par des astérisques pour le Chef Atelier, le Technicien, le Contrôle Qualité, la Livraison et la Lecture seule.
* **Vidage sécurisé** : Possibilité de vider entièrement la base locale (localStorage) avec demande de confirmation obligatoire.

---

## 13. Lot 6 : Historique & Rapports SAV Opérationnels

Nous avons développé un module d'historique et rapports opérationnels permettant d'analyser l'activité de l'atelier sans aucune dimension financière :
* **Module pur Rapports** (`src/sav-reports.ts`) : implémentation de fonctions pures pour construire les rapports de Réception, Atelier, Planning, Contrôle Qualité, Livraison, Réclamations et Blocages.
* **Historique Véhicule & Dossier** : Reconstruction chronologique unifiée de toutes les actions enregistrées sur un véhicule ou un dossier à partir des logs d'activité.
* **Interface "Rapports SAV"** : Intégration de l'onglet dans la navigation globale avec filtres par période, statut de dossier, technicien, pont, et type d'intervention.
* **Zéro Finance** : Absence totale de concepts de chiffre d'affaires, marges, prix, coûts, caisse ou facturation réelle, assurant un périmètre purement opérationnel.

---

## 14. Lot 6B : Recette Terrain & Corrections P0 avant Release

Nous avons résolu les 5 blocages terrain P0 identifiés lors de l'audit d'intégration :
1. **BUG-001 — NaN% Charge Techniciens** :
   - Sécurisation du calcul de charge dans le Gantt.
   - En cas de capacité nulle ou absente (ex: dimanche), affichage de `"Non mesurable"` ou `"0%"`.
   - Si charge > 0 avec capacité absente, aucun pourcentage faux n'est généré.
2. **BUG-002 — Occupation Atelier 0%** :
   - Prise en compte de la charge planifiée (Gantt segments), de la charge réservée (confirmée/affectée) et des tâches en cours non planifiées (temps estimé validé).
   - Intégration de `availabilityConfig` pour le calcul de la capacité effective.
   - Forçage à au moins 1% d'occupation réelle dès qu'une charge active existe (aucun affichage de 0% par arrondi).
   - Correction orthographique de `"Capacité lisible"` en `"Capacité réelle"`.
3. **BUG-003 — Délais "Non mesurable"** :
   - Exploitation dynamique des logs d'activité et des dates de réception réelles.
   - Ajout d'un dossier démo fictif complet (`NIMR-2026-006`) dans `data.ts` avec historique de logs complet pour avoir des délais mesurables dès le premier chargement.
   - Interdiction de fabriquer des timestamps artificiels pour les dossiers existants.
4. **BUG-004 — Module Contrôle Qualité Dédié** :
   - Création du composant dédié `src/components/ControleQualiteView.tsx` pour le rôle Contrôle Qualité (et accessible en lecture pour Directeur/Chef d'atelier).
   - Liste des dossiers en statut `CONTROLE_QUALITE`.
   - Checklist obligatoire de 8 points avant validation.
   - Validation transite vers `PRET_A_LIVRER`. Refus transite vers `EN_TRAVAUX` avec motif de refus obligatoire.
   - Historique des contrôles effectués et calcul du KPI First Time Right (FTR).
5. **BUG-005 — Module Livraison Dédié** :
   - Création du composant dédié `src/components/LivraisonView.tsx` pour le rôle Livraison (et accessible au Réceptionnaire).
   - Liste des dossiers prêts à livrer.
   - Checklist de restitution, saisie du kilométrage de sortie obligatoire (avec validation : km sortie >= km entrée), et commentaire.
   - Confirmation de livraison passe le dossier en statut `LIVRE`.
   - Historique des livraisons.

### Polissage & Sécurisations additionnelles
* **Kanban responsive à 5 colonnes** : Intégration des colonnes "Contrôle qualité" et "Prêt à livrer" avec conteneur à défilement horizontal en responsive.
* **Securisation Technicien** : Les boutons désactivés "Démarrer" ne déclenchent aucun handler d'action s'ils sont cliqués (sécurité renforcée). Résolution des doublons de logs lors du démarrage des tâches.

## 15. Lot 6C : Corrections terrain persistantes post-ré-audit

Nous avons résolu toutes les anomalies terrain persistantes identifiées lors du ré-audit :
1. **BUG-001-P & NEW-003 — Charge Techniciens et Ponts fiables** :
   - Mise à jour de `calculateTechnicianDailyLoad` et implémentation de `calculateBayDailyLoad` pour éviter le double comptage et prendre en compte les segments Gantt, les tâches `in_progress` non couvertes par le planning, et les réservations confirmées/affectées.
   - Intégration de `availabilityConfig` et `getEffectiveWorkshopWindows` pour calculer dynamiquement la capacité effective quotidienne.
   - Application des règles d'affichage UI (surcharge, "Non mesurable", "Charge hors capacité" ou pourcentage, pas de `NaN` ou `0h/0h` pour les ressources actives).
2. **BUG-002-P — Occupation Atelier et détails de calcul** :
   - Exposition détaillée des calculs dans `buildWorkshopKpis` via `detailsCalcul` (totalCapacity, plannedHours, reservedHours, inProgressHours, usedCapacityHours).
   - Intégration des 4 tuiles distinctes (Occupation réelle, charge planifiée, charge réservée, charge en cours) dans la section "Vue atelier" du tableau de bord Directeur.
3. **BUG-013-P — Horaires d'atelier harmonisés** :
   - Remplacement de toutes les valeurs par défaut de fermeture à `18:00` par `17:00` (semaine) et `12:00` (samedi) dans l'interface et les tests unitaires/E2E.
4. **Sécurisation du Sélecteur de Compagnon (Simulateur)** :
   - Ajout de la permission `canSimulateTechnicianAccess` pour n'autoriser la simulation que pour le Directeur SAV et le Chef Atelier.
   - Masquage du sélecteur compagnon pour les techniciens standard et verrouillage sur leur profil via matching case-insensitive (avec message d'avertissement si aucun profil n'est lié).
5. **Sécurisation du bouton Démarrer et messages de blocage** :
   - Retour immédiat dans le handler du bouton "Démarrer" si la tâche n'est pas démarrable.
   - Suppression du message de tâche verrouillée dupliqué en conservant une seule instance avec `data-testid="technician-task-locked-message"`.

---

## 16. Lot 6E : Hardening métier pré-RC

Le Lot 6E renforce les parcours critiques avant Release Candidate sans introduire de périmètre finance, ERP, stock réel ou données réelles :
* **Validations métier** : contrôle strict du téléphone, VIN, immatriculation, kilométrage, client, plainte réception et diagnostic technicien via `src/field-validations.ts`.
* **Neutralisation XSS locale** : sanitization des champs libres réception, réclamations et diagnostic avant stockage et affichage.
* **Anti double-clic** : garde pur `src/action-guard.ts` et verrous UI sur création dossier, clôture technicien, décision QC et livraison.
* **Confirmations obligatoires** : modals internes pour réception, validation/refus QC, validation détail dossier et confirmation livraison, sans `prompt()` natif.
* **Bloc atelier structuré** : diagnostic technicien final obligatoire, lisible et contextualisé avant passage en contrôle qualité.
* **Refus QC et livraison** : commentaires obligatoires sur refus/blocage, kilométrage de sortie contrôlé et signature/checklist de restitution exigée.
* **Documents imprimables internes** : bons réception, ordre de réparation, contrôle qualité et livraison disponibles depuis le dossier, sans vocabulaire financier ni stock réel.
* **Audit trail** : journal structuré horodaté pour actions sensibles (authentification, dossiers, QC, livraison, import/export, utilisateurs, planning).
* **Session 30 minutes** : expiration locale après inactivité, rafraîchie au clic/clavier/navigation, avec retour login et message clair.
* **Lecture seule nettoyée** : actions critiques masquées ou bloquées selon rôle.

---

## 17. Résultats de la Validation Globale

Le pipeline complet de validation locale a été ré-exécuté avec succès après intégration du hardening Lot 6E :

| Étape de Validation | Commande | Statut | Résultat |
| :--- | :--- | :--- | :--- |
| **Vérification des Types** | `npm run lint` | **RÉUSSI** | Zéro erreur de typage ou avertissement du compilateur TypeScript. |
| **Tests Unitaires Core** | `npm test` | **RÉUSSI** | Toutes les suites unitaires au vert, incluant validations champs, audit trail, anti double-clic et documents imprimables Lot 6E. |
| **Build de Production** | `npm run build` | **RÉUSSI** | Bundle de production Vite généré sans erreurs. Avertissement de taille de chunks non bloquant conservé. |
| **Tests E2E Playwright** | `npm run test:e2e -- --reporter=line` | **RÉUSSI** | **318 tests E2E Playwright validés** sur Desktop, Tablette et Mobile, incluant Lot 6E. |
| **Agent QA Fonctionnel** | `npm run qa:agent` | **RÉUSSI** | **RÉUSSI — 116/116 invariants validés**. |

---

## 18. Nouveaux Tests E2E Playwright (Lot 6, Lot 6B, Lot 6C & Lot 6E)

La suite E2E a été complétée avec les spécifications suivantes :
1. `e2e/23-sav-reports.spec.ts` : Valide l'accès aux rapports par rôle, les filtres de période, l'exportation et l'absence stricte de données financières.
2. `e2e/24-qc-view.spec.ts` : Valide le module Contrôle Qualité dédié (checklist, validation, refus avec motif obligatoire et FTR KPI).
3. `e2e/25-delivery-view.spec.ts` : Valide le module Livraison dédié (checklist, km de sortie >= km d'entrée, confirmation).
4. `e2e/26-lot6b-recette.spec.ts` : Valide le bouton démarrer technicien protégé contre les clics forcés, l'occupation dashboard > 0% si des charges existent, et les délais mesurables sur le dossier démo.
5. `e2e/27-lot6c-terrain-fixes.spec.ts` : Valide la charge des techniciens/ponts non nulle, l'occupation cohérente, l'harmonisation des horaires, l'absence du sélecteur compagnon pour les techniciens standards, le bouton Démarrer bloqué et le message non dupliqué.
6. `e2e/28-hardening-pre-rc.spec.ts` : Valide les contrôles réception, diagnostic technicien, documents imprimables et expiration de session 30 minutes.

---

## 19. Décision Finale avant Tag v1.1.0

**Décision :**
Les Lots 1 à 6E sont entièrement validés en environnement de test local.
Conformément aux exigences du Lot 6E, **aucun tag Git `v1.1.0` n'est créé à ce stade**.
Aucune donnée réelle n'a été committée, et aucun tag Git `v1.1.0` n'a été créé.

---

## 20. Recette finale v1.1.0-rc1

Recette exécutée sur l'état courant de `main` après validation des Lots 1 à 6E.

| Contrôle RC | Résultat | Détail |
| :--- | :--- | :--- |
| **Hash recetté** | **OK** | `830342b Add Lot 6E pre-RC business hardening` |
| **Statut Git** | **OK** | `main...origin/main`, workspace propre avant modification du présent rapport. |
| **Tags Git `v1.1.0` / `v1.1.0-rc1`** | **NON CONFIRMÉ** | La commande `git tag --list` est bloquée par l'environnement d'approbation. Aucun tag n'a été créé pendant cette recette. |
| **Fichiers sensibles / générés** | **OK** | Aucun `.env` réel, aucun `Liste Vehicule.xlsx`, aucun PDF réel détecté. `.env.example` seul présent. `dist/`, `node_modules/`, `playwright-report/` et `test-results/` sont locaux/ignorés et non dans le statut suivi. |
| **GitHub Pages** | **OK** | `https://irondrass.github.io/NIMR-SAV-PRO/` répond `200 OK`, titre publié `NIMR SAV PRO v1.1.0`, bundle distant `assets/index-C_Nsmykf.js` aligné avec le build local. |
| **Cache / manifest / service worker** | **OK** | Aucun `manifest.webmanifest` ni `sw.js` publié ; aucune ancienne version PWA détectée. |
| **Zéro finance** | **OK** | Aucun CA, marge, paiement, caisse, facture réelle, montant client, solde ou stock réel ajouté aux parcours opérationnels et documents internes. |
| **Aucune donnée réelle** | **OK** | Données de recette fictives uniquement ; pas de fichier véhicule réel ni PDF réel committé. |

### Résultats des validations rejouées

| Commande | Statut | Résultat |
| :--- | :--- | :--- |
| `npm run lint` | **RÉUSSI** | TypeScript sans erreur. |
| `npm test` | **RÉUSSI** | Suites unitaires au vert, incluant validations, audit, anti double-clic et impressions. |
| `npm run build` | **RÉUSSI** | Build Vite généré. Warning chunk size `> 500 kB` noté comme non bloquant. |
| `npm run test:e2e -- --reporter=line` | **RÉUSSI** | **318/318 tests Playwright** sur Desktop, Mobile et Tablette. |
| `npm run qa:agent` | **NON REJOUÉ EN FINAL** | Dernier `qa-report.md` connu : **116/116 OK**. La relance finale est bloquée par l'environnement d'approbation après l'E2E complet. |

### Validation stress test réception

Statut : **OK via E2E + tests unitaires**.
Les scénarios couvrent l'import/recherche base véhicules, le bouton "Utiliser ce véhicule", le pré-remplissage focus-out immatriculation, le blocage de doublon actif VIN/immatriculation, les validations téléphone/VIN/kilométrage/plainte, la confirmation de création et l'anti double-clic.

### Validation stress test atelier

Statut : **OK via E2E + tests unitaires**.
Les scénarios couvrent affectation, suggestion planning, démarrage/pause/reprise, bouton démarrer désactivé non exécutable, diagnostic final `"ok"` refusé, diagnostic valide accepté, blocage avec motif/commentaire, alerte pièces manquantes, Gantt, charges techniciens/ponts, absence de `NaN` et absence de `0h/0h` incohérent.

### Validation stress test contrôle qualité

Statut : **OK via E2E**.
Les scénarios couvrent checklist obligatoire, validation QC, refus sans motif/commentaire bloqué, refus avec motif/commentaire, retour atelier, badge/état qualité et historique QC.

### Validation stress test livraison

Statut : **OK via E2E**.
Les scénarios couvrent accès module Livraison, refus avant QC validé, checklist obligatoire, kilométrage sortie obligatoire et cohérent, blocage si km sortie < km entrée, signature client, confirmation finale et historique de livraison.

### Validation lecture seule

Statut : **OK via E2E**.
Login `lecture / 9999` validé, badge Lecture seule visible, gestion utilisateurs masquée et actions critiques de modification/affectation/démarrage/blocage/terminaison/QC/livraison/suppression cachées ou interdites. Téléphone masqué pour les rôles non autorisés.

### Validation impressions

Statut : **OK via E2E + tests unitaires**.
Les documents disponibles sont :
1. Fiche réception.
2. Ordre de réparation interne.
3. Fiche contrôle qualité.
4. Bon de restitution / livraison.

Chaque document affiche `Document interne NIMR SAV PRO`, date/heure, dossier, client, véhicule, VIN, immatriculation et kilométrage. Le CSS `@media print` masque l'application et imprime uniquement `#nimr-print-container`.

### Validation sécurité locale

Statut : **OK via tests unitaires + QA connu**.
Les entrées `<script>alert(1)</script>` sont neutralisées par `sanitizeFreeText`, aucun `dangerouslySetInnerHTML` n'est présent dans `src`, et le test de session timeout via `window.__TEST_SESSION_TIMEOUT__` est couvert en E2E.

### Validation audit trail

Statut : **OK via tests unitaires + inspection code**.
Les actions critiques journalisées couvrent création dossier, changement de statut, import/export, référentiel véhicules, réclamations, réservations/disponibilités atelier, utilisateurs, auth/session, QC et livraison via `logAuditEvent`.

### Décision RC

**Décision : non prêt pour création immédiate du tag `v1.1.0-rc1` dans cet environnement.**

Raison : la recette applicative est verte jusqu'à l'E2E complet, mais deux contrôles obligatoires restent non confirmés localement :
1. absence effective des tags `v1.1.0` et `v1.1.0-rc1` via `git tag --list` ;
2. relance finale de `npm run qa:agent` après l'E2E complet.

Recommandation : créer le tag `v1.1.0-rc1` uniquement après confirmation de ces deux points. Ne pas créer `v1.1.0` final.

