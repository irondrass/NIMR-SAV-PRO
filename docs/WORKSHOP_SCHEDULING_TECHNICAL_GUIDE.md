# Guide technique - Planification atelier

## Composants

- `src/workshop-scheduling/types.ts` : modele de domaine.
- `src/workshop-scheduling/engine.ts` : fonctions pures de disponibilite,
  conflit, score, dependances, pieces, capacite et replanification.
- `src/workshop-scheduling/service.ts` : persistance locale et passerelle RPC.
- `src/workshop-scheduling/sync.ts` : file idempotente, retry borne et conflits.
- `src/components/WorkshopOperationsView.tsx` : pilotage et propositions.
- `supabase/migrations/20260728000000_workshop_scheduling.sql` : schema, RLS,
  contraintes, audit et RPC.

## Reservation atomique

Le frontend appelle `public.confirm_workshop_booking`. La fonction delegue a
`app.confirm_workshop_booking`, qui :

1. controle le role et le motif de surbooking ;
2. rejoue une operation deja appliquee grace a `operation_id` ;
3. verrouille la tache puis les ressources avec des advisory locks ;
4. controle les pieces, competences, etats et capacites ;
5. insere la reservation et toutes ses ressources dans la meme transaction ;
6. met a jour la tache et ecrit l'audit ;
7. retourne un conflit lisible si une autre transaction a gagne la course.

Les contraintes GiST constituent la derniere barriere contre les
chevauchements. Les bornes `[)` autorisent deux reservations consecutives.

## Authentification

Le client REST utilise la cle anonyme pour `apikey` et le jeton de session
Supabase pour `Authorization`. Le jeton reste en memoire via
`setSupabaseAccessToken`; il n'est pas persiste dans le stockage local.

## Mode local

`local-only` et `backend-ready` peuvent calculer et conserver un
`local_pending`. Ils ne peuvent pas produire `server_confirmed`. Le passage en
production exige `backend-enabled`, une session Auth et une migration appliquee.

## Synchronisation

Chaque operation possede un UUID stable. `enqueueIdempotent` ignore les
doublons. Le retry utilise un backoff exponentiel borne et passe en conflit
apres cinq essais. Une reservation est toujours confirmee directement par la
RPC et non par une ecriture locale rejouee aveuglement.

## Performance

Les index couvrent la periode des reservations, les absences, les
indisponibilites, les recherches par atelier/type/etat, les taches par dossier
et les files de retry. Les vues doivent charger uniquement la periode visible.
