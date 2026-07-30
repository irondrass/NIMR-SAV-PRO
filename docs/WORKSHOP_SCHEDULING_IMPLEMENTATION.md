# Workshop Scheduling Implementation

## Etat actuel

NIMR SAV PRO utilise React 19, TypeScript, Vite et une PWA. Le fonctionnement
terrain est actuellement local-first avec `localStorage` et IndexedDB. Le
backend Supabase est disponible selon trois modes (`local-only`,
`backend-ready`, `backend-enabled`) et les migrations Backend v2 préparent
PostgreSQL, Auth, RLS et les fonctions RPC.

Les fonctions existantes couvrent déjà :

- les dossiers SAV et leurs lignes d'ordre de réparation ;
- les techniciens, métiers, compétences et ressources matérielles ;
- les horaires, pauses, absences et indisponibilités ;
- la proposition et la validation locale de créneaux ;
- le planning atelier, le technicien, le contrôle qualité et la livraison ;
- le journal d'audit local et le référentiel atelier.

## Ecarts constates

- Le modèle de tâche existant ne porte pas toutes les exigences de compétences,
  pièces, dépendances, préparation, séchage et contrôle qualité.
- La réservation historique est principalement locale et ne garantit pas
  l'atomicité multi-ressources entre plusieurs postes.
- Les ressources matérielles ne sont pas encore normalisées en base.
- Les paramètres opérationnels sont partiellement stockés localement.
- Le calcul de capacité, le classement multi-critères et l'identification de la
  ressource limitante ne sont pas centralisés.
- Les tables de synchronisation, notifications, modèles de tâches et calendriers
  avancés doivent être ajoutées.

## Architecture retenue

1. Un domaine TypeScript `src/workshop-scheduling` contient les types, fonctions
   pures, services et dépôts du module.
2. PostgreSQL reste l'autorité finale. La RPC
   `confirm_workshop_booking` vérifie et crée toutes les réservations dans une
   transaction. Des contraintes d'exclusion empêchent les chevauchements.
3. Le frontend calcule des recommandations et peut enregistrer des brouillons.
   En mode local, une réservation reste `local_pending` et n'est jamais présentée
   comme confirmée.
4. Les paramètres, compétences, calendriers, ressources et modèles de tâches
   sont persistés dans des tables dédiées en mode backend et dans le dépôt local
   existant en mode local.
5. La vue `Pilotage atelier` fournit une lecture opérationnelle commune sans
   remplacer le planning existant.

## Decisions techniques

- Réutiliser `DossierSAV`, `RepairOrderLine`, `TechnicienResource` et
  `WorkshopBay` comme adaptateurs de compatibilité.
- Utiliser des plages `tstzrange` et `btree_gist` pour les exclusions.
- Réserver le surbooking aux rôles autorisés et exiger un motif audité.
- Conserver les tâches verrouillées lors d'une replanification.
- Utiliser des fonctions pures pour la disponibilité, les conflits, le score, la
  date de fin et les KPI.
- Ne pas ajouter de bibliothèque de calendrier payante. Le Gantt existant reste
  la vue chronologique principale.

## Etapes d'implementation

1. Migration additive : tables, contraintes, index, RLS, audit et RPC.
2. Domaine TypeScript : disponibilité, scoring, dépendances, pièces, capacité,
   KPI, replanification et passerelle backend.
3. Vue de pilotage et paramétrage, intégrée aux rôles existants.
4. File de synchronisation idempotente et états local/serveur.
5. Tests unitaires, contrats SQL et E2E par rôle.
6. Guides utilisateur, administrateur, technique, test et déploiement.

## Risques identifies

- Le projet Supabase réel n'est pas fourni : les migrations et contrats peuvent
  être validés localement, mais la recette RLS concurrente exige un environnement
  Supabase de développement.
- Les identifiants frontend historiques sont textuels alors que Backend v2
  utilise des UUID. La migration des données doit conserver une table de
  correspondance.
- La confirmation hors ligne est impossible par conception ; l'interface doit
  conserver un brouillon clairement identifié.
- Les anciennes réservations locales doivent être importées de manière
  idempotente avant activation multi-poste.
- Les opérations concurrentes doivent être testées avec deux sessions Auth
  distinctes avant production.
