# Old App Planning and Quote Parity

Reference analyzed: `https://irondrass.github.io/NIMR-SAV/` on 2026-07-01.

Downloaded reference files used for analysis:
- `index.html?v=23.2.6`
- `js/estimate-import.js?v=23.2.6`
- `js/business-rules-v2187.js?v=23.2.6`
- `js/planning.js?v=23.2.6`
- `js/ui-cases.js?v=23.2.6`
- `js/ui-planning.js?v=23.2.6`
- `js/state.js?v=23.2.6`

## Observed Old Behavior

| Old function / screen | Old behavior observed | Expected in PRO | Status | Notes |
|---|---|---|---|---|
| `handleEstimateImportFile` / quote import | Reads PDF/CSV/XLSX/text, rejects unsupported or unreadable files, parses labor and parts, then opens a preview. | PRO parser should keep text/PDF/CSV support and reject non-readable PDFs without creating tasks. | Adapted | PRO remains browser-local and keeps no finance/stock import. |
| `parseEstimateText` | Builds `laborLines`, `partsLines`, `distributedLines`, ignored lines, detected hours. | PRO quote lines carry old-app allocation metadata for each MO line. | Adapted | Source of truth is `src/core/old-app-quote-rules.ts`. |
| `distributeLaborHours` | D/P -> body + reassembly 50/50; Peinture et finition -> prep + paint; Dressage -> body + prep + paint; vidange -> oil service; electrical/mechanical keywords map to their phases. | PRO uses the copied distribution function through `distributeLaborHours`. | Copied/adapted | Kept as pure TypeScript, no DOM/global state. |
| `normalizeOriginalLineForPlanning` | Recalculates allocations from checked phases. Prep has weight 2, paint weight 1, other phases weight 1. | PRO review panel recalculates allocations when phase checkboxes change. | Copied/adapted | This preserves the old 2/3 prep + 1/3 paint rule. |
| `renderImportedLaborReview` | Shows line number, MO label, source order/code, duration, phase checkboxes, allocation badges, piece state, paint side, paint group, and total. | PRO `QuoteImportModal` now renders an old-app duration review panel with those fields. | Adapted | Existing import table remains for compatibility. |
| `optimizeEstimateAllocationsFromOriginalLines` | Non-paint phases sum directly. Paint is grouped by zone/cote: max item + 25% of others per group; global paint = largest group + 40% of other groups. Finish = 50% paint. Quality = 0.25h. | PRO imports use old-app applied lines, including mutualized paint, finish, and quality. | Copied/adapted | No price/payment/stock fields are created. |
| Paint piece state | New/replaced pieces may need two sides for porte/capot/malle; repair/dressage stays outside. | PRO lines carry `oldAppPieceKind` and `oldAppPaintFaces`. | Copied/adapted | Editable in the review panel. |
| Paint group inference | DR/right, GH/left, front, rear, center, general groups. | PRO lines carry `oldAppPaintGroup` and expose the same group choices. | Copied/adapted | Labels are adapted without changing behavior. |
| `schedulePipeline` | Uses validated duration phases, schedules steps sequentially, then computes delivery with a 20% working-time margin. | PRO reservation logic already schedules validated tasks and updates ETA; parity remains under test. | Partially adapted | Full old appointment proposal screen is not copied; PRO has Planning & Charge workflow. |
| `findBestResourceSlot` / `findEarliestSlot` | Chooses earliest non-conflicting primary resource + equipment pair, preserving preferred toliers/peintres when possible. | PRO reservation helpers search first available technician/bay and validate collisions. | Partially adapted | Resource roles differ in PRO (`TechnicienResource`, bays). |
| `renderPlanning` | Gantt rows by display resource, 08:00-17:00 grid, booking blocks clipped per day. | PRO Gantt remains the visible planning surface. | Adapted | Existing Gantt tests cover rendering and collision checks. |

## Parity Matrix

| Function | Old behavior | PRO current | Gap | Correction |
|---|---|---|---|---|
| Import devis | Parse labor, parts, ignored lines; preview before apply. | Parser existed but preview was task-line oriented. | Missing old allocation review. | Added old-app duration review panel. |
| Durées estimées | Per-stage duration cards plus imported labor review. | PRO had editable imported line duration only. | Missing row allocation controls and total atelier. | Added old-app line review and live total. |
| Mapping MO | Exact legacy regex phase mapping. | PRO had similar parser plus separate task text inference. | Risk of divergent mappings. | Added `old-app-quote-rules.ts` and routed `distributeLaborHours` through it. |
| Multi-étapes | One MO can create multiple allocations. | One selected MO created one task. | Critical. | Import now creates applied stage tasks from old allocations. |
| Préparation / peinture | Checked prep+paint uses prep weight 2, paint weight 1. | Not represented in UI/task creation. | Critical. | Added weighted allocation helper and review controls. |
| Mutualisation peinture | Cabin paint optimized by zone/cote. | Not represented in task creation. | Critical. | Added old paint optimization and mutualized paint task. |
| Total atelier | Sum applied phases including finish and quality. | Total detected hours only. | Critical. | Added old-app total atelier in preview. |
| Validation Chef Atelier | Applying import updates durations/tasks and clears planning if needed. | PRO creates quote-import tasks with validated durations. | Partial semantic difference. | New imported tasks carry stage IDs and validated durations. |
| Création tâches | Applied lines become workshop tasks. | One line -> one task. | Critical. | Applied lines -> stage-specific tasks. |
| Réservation premier slot | Earliest non-conflicting resource/equipment pair. | PRO has first-slot reservation helpers with collision validation. | Partial architecture difference. | Covered by planning parity tests; no new independent algorithm added. |
| Planning Gantt | Booking blocks visible by resource/day. | PRO Gantt already exists. | No critical gap in this pass. | Existing and new tests verify slot appears. |

## Adaptation Justifications

- The old app stores `cases`, `claims`, `estimate.originalLines`, and `bookings` as browser globals. PRO stores `DossierSAV`, `RepairOrderLine`, and `WorkshopReservation`. The old behavior is copied as pure helpers and mapped to PRO types.
- The old UI was embedded in the dossier detail page. PRO uses a modal for quote import; the old review panel is rendered inside that modal to preserve existing workflows.
- Old resource roles (`tolier`, `peintre`, `pont_vidange`, `cabine`) do not directly match PRO resource/bay models. Planning parity is therefore asserted at the behavior level: validated duration, first available slot, no technician collision, no bay collision, Gantt visible, ETA updated.


## Hotfix 6K-F-C: Analysis & Implementation Details

### 1. Écran "Étapes à modifier" (renderDurations)
- **Ancienne fonction :** `renderDurations`
- **Comportement exact ancien :** Affiche 9 cartes d'étapes chronologiques. Les cartes avec durée > 0 sont encadrées/actives. Permet de modifier le temps de l'étape, de sélectionner le "technicien à réserver" (choix filtré sur les techniciens actifs dont le rôle correspond à l'étape, par défaut "Auto - meilleur disponible"), et le "service à réserver dans le planning" (pour les étapes autorisées). Modifier la durée ou le technicien/service annule le planning existant pour forcer un recalcul.
- **Comportement PRO avant correction :** Les cartes d'étapes étaient affichées de manière purement informative et statique (lecture seule), sans champs de formulaire pour modifier la durée, choisir le technicien à réserver ou modifier le type de service.
- **Écart :** Absence des contrôles interactifs cruciaux pour l'affectation manuelle et la personnalisation des étapes.
- **Correction appliquée :** Rendre les cartes interactives : inputs pour la durée (synchronisée avec les tâches associées), select pour le technicien à réserver (filtré par compatibilité), select pour le service (avec motif d'override obligatoire et audit log).
- **Amélioration éventuelle :** Intégration soignée avec le style moderne de PRO tout en gardant l'aide contextuelle obligatoire.
- **Impact métier :** Permet au Chef d'Atelier de moduler précisément chaque étape avant de lancer la réservation.
- **Test ajouté :** `tests/old-app-stage-editor-parity.test.ts`

### 2. Compatibilité Technicien / Métier
- **Ancienne fonction :** Contrôle de la compatibilité des ressources (`getSelectableTechniciansForStep`).
- **Comportement exact ancien :** Associe chaque étape à un rôle de technicien requis (`tolier`, `mecanicien`, `peintre`, `electricien`, `controle`). Empêche d'affecter un technicien ayant une autre spécialité.
- **Comportement PRO avant correction :** La compatibilité était testée de façon globale sur le type de dossier (ex: dossier vidange -> mécanicien), permettant des aberrations comme l'affectation d'une tâche peinture à un mécanicien.
- **Écart :** Non-respect des restrictions par étape métier.
- **Correction appliquée :** Implémentation de `isTechnicianCompatibleForStep` et filtrage strict dans la validation de planification (qui renvoie le code d'erreur `planning-tech-incompatible` en cas d'incompatibilité). Pas de fallback vers le technicien du dossier s'il est incompatible (affiche "Aucun technicien compatible affecté.").
- **Amélioration éventuelle :** None.
- **Impact métier :** Garantie absolue que seules les personnes formées et affectées à la bonne zone effectuent le travail.
- **Test ajouté :** `tests/planning-trade-compatibility.test.ts`

### 3. Sélection Automatique "Auto - meilleur disponible"
- **Ancienne fonction :** Algorithme de planification séquentielle (`findBestResourceSlot`).
- **Comportement exact ancien :** L'auto-planification affecte le meilleur technicien disponible parmi ceux qui ont le rôle compatible pour l'étape.
- **Comportement PRO avant correction :** L'auto-réservation ne restreignait pas la recherche aux techniciens compatibles avec l'étape spécifique de la tâche.
- **Écart :** L'auto-réservation pouvait attribuer des tâches de carrosserie ou peinture à des mécaniciens.
- **Correction appliquée :** Filtrage strict des techniciens testés par `isTechnicianCompatibleForStep` dans `buildVehicleAutoReservationPlan` et `suggestWorkshopSlot`.
- **Amélioration éventuelle :** None.
- **Impact métier :** Planification automatique réaliste sans intervention corrective manuelle requise après coup.
- **Test ajouté :** `tests/old-app-planning-parity.test.ts`

### 4. Synchronisation Réservation Planning → Ordre de Travail
- **Ancienne fonction :** Persistance des affectations de ressources (`convertReservationToPlanning`).
- **Comportement exact ancien :** Dès qu'un créneau est réservé ou planifié, le technicien et le pont associés s'affichent sur la tâche et dans les fiches de travail.
- **Comportement PRO avant correction :** Les réservations de planification n'écrivaient pas immédiatement le technicien sur les lignes d'ordres de réparation, ce qui laissait ces lignes afficher "Non assigné" dans certains écrans.
- **Écart :** Désynchronisation entre le planning Gantt (réservé) et le détail du dossier (non assigné).
- **Correction appliquée :** Lecture unifiée de l'affectation résolvant le technicien/pont depuis la réservation active si le planning Gantt n'est pas encore finalisé. Écriture systématique des affectations lors de la création de réservations automatiques.
- **Amélioration éventuelle :** None.
- **Impact métier :** Alignement total des écrans pour éviter les confusions en atelier.
- **Test ajouté :** `tests/planning-technician-assignment-sync.test.ts`
