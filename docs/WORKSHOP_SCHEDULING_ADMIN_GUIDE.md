# Guide administrateur - Planification atelier

## Parametrage

Configurer dans cet ordre :

1. sites, ateliers et zones ;
2. niveaux de competence et competences ;
3. equipes, collaborateurs, horaires et absences ;
4. types de ressources, ressources et indisponibilites ;
5. statuts, familles et modeles de taches ;
6. regles de planification, pieces et alternatives ;
7. checklists de controle qualite ;
8. notifications par role.

Les reglages courants sont stockes dans `workshop_settings` et
`planning_rules`. Les changements sont audites automatiquement.

## Droits

- `DIRECTEUR_SAV` et `ADMINISTRATEUR` gerent le referentiel et les parametres.
- `CHEF_ATELIER` planifie, affecte, verrouille et replanifie.
- `RECEPTION` demande et consulte les creneaux.
- `TECHNICIEN` agit uniquement sur ses taches.
- `CONTROLE_QUALITE` gere les checklists et non-conformites.
- `MAGASIN_PIECES` met a jour la disponibilite des pieces.
- `LECTURE` ne modifie aucune donnee.

Le role est determine cote serveur. Aucune politique RLS ne permet a un
utilisateur de modifier son propre role.

## Ressources partageables

Pour une ressource partageable, renseigner `simultaneous_capacity`. La
reservation atomique attribue un emplacement de capacite libre. Une ressource
exclusive conserve une capacite de 1.

## Surbooking

Le surbooking est limite au Directeur et a l'Administrateur. Un motif est
obligatoire et l'action est auditee. Il ne doit servir qu'a une decision
operationnelle explicite.

## Maintenance

Placer une ressource en `maintenance`, `broken`, `blocked` ou
`out_of_service` avant la periode concernee. Elle ne sera plus proposee par le
moteur. Replanifier ensuite les reservations non verrouillees.
