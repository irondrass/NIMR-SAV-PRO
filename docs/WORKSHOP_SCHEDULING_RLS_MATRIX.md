# Matrice RLS - Planification atelier

## Principes

- Aucun acces anonyme aux donnees atelier.
- Le role backend canonique du controle qualite est `QC`.
- Les fonctions `SECURITY DEFINER` verifient toujours `auth.uid()`, le role et
  l'acces au dossier avant toute mutation.
- Les reservations et leurs ressources sont lisibles uniquement via
  `app.can_access_dossier`.
- Un technicien accede a un dossier seulement si une tache lui est affectee via
  `workshop_tasks.assigned_employee_id` et si `employees.profile_id = auth.uid()`.

## Matrice attendue

| Donnee ou action | Directeur SAV | Chef Atelier | Reception | Technicien | QC | Livraison | Lecture |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Referentiels atelier | Lecture/ecriture | Lecture | Lecture | Lecture | Lecture | Lecture | Lecture |
| Employes, horaires, absences | Tous/ecriture | Tous/lecture | Aucun | Soi-meme | Aucun | Aucun | Aucun |
| Taches et donnees associees | Dossiers autorises | Dossiers autorises | Lecture dossier | Taches affectees | Lecture dossier | Lecture dossier | Lecture dossier |
| Reservations | Lecture + RPC | Lecture + RPC | Lecture dossier | Lecture taches affectees | Lecture dossier | Lecture dossier | Lecture dossier |
| Evenements de temps | Lecture + RPC | Lecture + RPC | Lecture | RPC sur tache affectee | Lecture + RPC | Lecture | Lecture |
| Controle qualite | Lecture/ecriture | Lecture | Lecture | Lecture affectee | Lecture/ecriture | Lecture | Lecture |
| Parametres atelier | Lecture/ecriture | Lecture | Aucun | Aucun | Aucun | Aucun | Lecture |
| Regles de planification | Lecture/ecriture | Lecture/ecriture | Aucun | Aucun | Aucun | Aucun | Lecture |
| Notifications | Propres/role | Propres/role | Propres/role | Propres/role | Propres/role | Propres/role | Propres/role |
| Operations de synchronisation | Propres | Propres | Propres | Propres | Propres | Propres | Propres |

## Validation automatisee

Le test catalogue est execute avec :

```text
npm run db:test:workshop
```

La matrice Auth/RLS est produite automatiquement dans le manifeste du bootstrap.
Le test consomme ce manifeste sans identifiants saisis manuellement :

```text
node scripts/test-workshop-scheduling-rls.mjs --fixtures <manifest>
```

Les mots de passe restent uniquement dans le manifeste temporaire ignore par Git
et sont supprimes avec lui apres un nettoyage reussi.
