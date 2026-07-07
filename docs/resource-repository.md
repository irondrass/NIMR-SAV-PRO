# Référentiel Ressources Atelier (Workshop Resource Repository)

Le module **Référentiel Atelier** permet de structurer et d'auditer l'ensemble des ressources de l'atelier planifiables au Gantt, et de préparer la transition vers le Backend v2 réel en définissant des entités synchronisées (comptes, compagnons et zones matérielles).

---

## 1. Modèles de Données Étendus

### Utilisateurs (`User`)
- `linkedHumanResourceId`?: ID de la ressource humaine (compagnon) liée.

### Ressources Humaines (Compagnons, `TechnicienResource`)
- `metierPrincipal`: Métier principal (`AtelierMetier`).
- `metiersSecondaires`: Liste de métiers secondaires compatibles.
- `planifiable`: Détermine si la ressource apparaît et peut être planifiée au planning Gantt.
- `actif`: Activation ou désactivation de la ressource.
- `linkedUserId`?: ID du compte utilisateur réel associé.

### Ressources Matérielles (Zones / Ponts, `WorkshopBay`)
- `nom` / `name`: Libellé de la ressource.
- `type`: Toujours `"MATERIAL"`.
- `categorie`: Catégorie technique (`MaterialCategory`).
- `actif`: Activation ou désactivation de la ressource.
- `planifiable`: Détermine si elle peut recevoir des réservations au planning.
- `capaciteVehicules`: Nombre maximal de véhicules admis en simultané (par défaut `1`).
- `compatibleTaskTypes`: Liste optionnelle de types de tâches compatibles (ex: `["quick", "oilService"]`).
- `localisation`: Emplacement physique.

---

## 2. Rôles et Permissions

Le module applique les règles strictes de contrôle d'accès suivantes :

| Profil / Rôle | Accès Onglet | Modification Utilisateurs | Modification Compagnons / Matériel |
| :--- | :--- | :--- | :--- |
| **Directeur SAV** | Oui | Lecture + Écriture | Lecture + Écriture |
| **Chef d'atelier** | Oui | Lecture Seule | Lecture + Écriture |
| **Réceptionnaire** | Oui | Lecture Seule | Lecture Seule |
| **Lecture seule** | Oui | Lecture Seule | Lecture Seule |
| **Technicien** | Non (Invisible) | Aucun | Aucun |
| **Livraison** | Non (Invisible) | Aucun | Aucun |

---

## 3. Règles d'Intégrité et de Planification

Lors de la planification (manuelle ou par l'algorithme d'auto-planification), les contraintes suivantes sont validées :

1. **Ressource Active et Planifiable** : Un compagnon ou équipement inactif/non planifiable ne peut pas recevoir d'affectation de tâche.
2. **Compatibilité Métier / Catégorie** :
   - Les tâches de type peinture requièrent une ressource matérielle de type `CABINE_PEINTURE` et un compagnon peintre.
   - Les tâches d'électricité requièrent une ressource de type `ZONE_DIAGNOSTIC_ELECTRIQUE` ou `ZONE_REPARATION_ELECTRIQUE`.
   - Les grands travaux requièrent un pont de type `PONT_GRAND_TRAVAUX`.
3. **Collision de Capacité Matérielle** : Une zone de capacité `C` ne peut recevoir plus de `C` véhicules sur le même créneau horaire.
4. **Indisponibilité / Maintenance** : Les créneaux de maintenance ou d'indisponibilité bloquent toute affectation.

---

## 4. Diagnostics et Alertes de Cohérence (Français)

Le tableau de bord de diagnostic analyse en continu le référentiel pour lever les alertes suivantes :
- `TECH_ACTIVE_NO_HR` : Technicien actif sans ressource compagnon liée.
- `HR_ACTIVE_NO_USER` : Compagnon actif sans compte utilisateur lié.
- `USER_LINKED_TO_INACTIVE_HR` : Utilisateur lié à une ressource inactive.
- `MATERIAL_ACTIVE_NO_COMPATIBILITY` : Équipement actif sans métier ou type de tâche configuré.
- `MATERIAL_INACTIVE_USED_FUTURE` : Ressource matérielle inactive utilisée dans des dossiers en cours ou réservations futures.
- `PAINT_TASK_NO_CABIN` : Tâche peinture planifiée alors qu'aucune cabine active n'est disponible.
- `ELEC_TASK_NO_ZONE` : Tâche électrique sans zone diagnostic active.
- `GT_TASK_NO_PONT` : Tâche grands travaux sans pont de levage lourd actif.
- `RESOURCE_DUPLICATE_NAME` : Doublon de ressource par nom ou identifiant.
- `MATERIAL_DOUBLE_BOOKING` : Équipement de capacité 1 réservé pour plus d'un véhicule sur le même créneau.
- `BAYSLIST_EMPTY_FALLBACK` : Liste des équipements vide, bascule sur les valeurs par défaut.

---

## 5. Import/Export et Sauvegarde JSON

Toutes les configurations de ressources, y compris le paramétrage étendu et le statut actif/inactif, sont entièrement sérialisées dans les exports de base NIMR SAV PRO sous le champ `baysList`. L'importation d'une base écrase de façon sécurisée le référentiel local après confirmation.
