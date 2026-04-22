# Changelog Yova

Toutes les évolutions notables sont listées ici. Une entrée par release (merge main).

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/). Versionning : `AAAA-MM-JJ` (calendar versioning, one bump per merged sprint).

---

## [2026-04-22f] — Sprint 12 : Décomposition de projets complexes (M3)

### Ajouté
- `supabase/migrations/20260422_sprint12_project_decomposition.sql` — colonne `household_tasks.parent_project_id` (FK self-ref, nullable, ON DELETE CASCADE) + index partiel. Permet de grouper un projet parent et ses sous-tâches
- `app/api/ai/decompose-project/route.ts` (POST) — endpoint Sonnet 4.6 qui décompose un prompt user en projet + 3-6 sous-tâches datées/assignées en 1 tour. Timeout 10s, contexte foyer complet (members, profile, 20 derniers facts, 5 derniers conversation_turns)
- `lib/decomposeProjectCore.ts` — cœur réutilisable (appelé par l'endpoint direct ET par le parseur journal). Prompt système applique la table des défauts M3 (nb convives = taille foyer, budget normal, créneaux courses J-1 après-midi / prépa H-2, etc.)
- `utils/projectDecomposition.ts` — heuristique `detectProjectIntent` (regex verbes "organise/prépare/planifie" + objets multi-tâches) + validator runtime hand-rolled (pas de dép zod — style aligné avec `utils/validation.ts`)
- `utils/projectDecomposition.test.ts` — 16 tests unitaires (router + validator)
- `components/ProjectGroupCard.tsx` — carte projet sur `/today` avec progress N/total, expand/collapse, sous-tâches actionables (complétion + ⋯ ouvre `TaskActionsSheet`) + helper `groupTasksByProject`
- `scripts/eval-decompose.ts` — script manuel pour taper les 10 prompts variés contre l'endpoint (staging), produit rapport Markdown pour revue humaine

### Modifié
- `app/api/ai/parse-journal/route.ts` — router sprint 12 : avant le parseur normal, détecte (A) un `pending_project` récent dans `conversation_turns` (< 10 min) pour relancer la décomposition avec le prompt fusionné, OU (B) un prompt projet via heuristique regex → appelle `decomposeProjectCore`. Si routé, court-circuite completions/auto_create/project-V0 et retourne `project_decomposed`
- `app/(app)/today/page.tsx` — section "Projets en cours" avant "À faire aujourd'hui". Les enfants de projet n'apparaissent plus dans les listes plates (maintenant, aTFaire, radar) mais sous leur parent groupé
- `app/(app)/journal/page.tsx` — nouveau type `ProjectDecomposed` dans `ParseResponse`, nouvelle card `DecomposedProjectCard` (confirmation "📋 Projet préparé" avec lien vers `/today`)
- `types/database.ts` — `HouseholdTask.parent_project_id?: string | null`

### Règles produit respectées (ref spec M3)
- **Proposition imparfaite, pas interrogatoire** : Yova ne pose JAMAIS plus d'une question. Les faits déductibles (allergies, taille foyer, patterns) viennent de la mémoire. Les manquants sans défaut → table des défauts nominaux
- **Single-question flow** (stateful) : quand Yova doit poser une question, elle stocke `{pending_project: {original_prompt, missing}}` dans `conversation_turns.extracted_facts` (speaker=agent). Au message user suivant (< 10 min), parse-journal fusionne la réponse avec le prompt original et relance la décomposition
- **Parent auto-complété** : le parent n'a pas de bouton "Fait" dans l'UI — il se complète implicitement quand tous ses enfants sont done (rendu visuel : progress bar 100 %)

### Ajustements post-démo (mêmes commits, sprint 12)
- **Fix /today — projets avec sous-tâches futures** (`0c24b9d`) : le filtre limitait les projets aux tâches overdue+today, donc un projet pour dimanche n'apparaissait nulle part. `groupTasksByProject` désormais appliqué à toutes les tâches filtrées
- **Fix durées Sonnet** (`3f5c856`) : prompt système sous-estimait systématiquement (courses 15 min, repas 30 min). Ajout d'une table de repères concrets : courses événement = long (60 min) mini, repas familial = long mini
- **Fix check-in bypass** (`92352fb`) : si le user tape un projet clair ("organise le déjeuner dimanche") pendant le check-in du soir, on route direct vers `send()` → `parse-journal` au lieu d'attendre que les 3 questions soient répondues
- **Fix assignation par défaut** : `assigned_to` reste `null` (foyer) si Sonnet ne détecte pas de pattern mémoire. Avant : on forçait l'assignation sur l'initiateur du prompt, ce qui dumpait tout sur une seule personne
- **UI /journal enrichie** : la card "Projet préparé" affiche maintenant inline les sous-tâches (nom + date + durée) plutôt qu'un simple décompte. Consultation directe sans quitter la conversation

### Pré-merge — validation
- `npx tsc --noEmit` : OK
- `npx vitest run utils/projectDecomposition.test.ts` : 16/16 passed
- `npx next build` : OK (route `/api/ai/decompose-project` compilée)
- Tests démo device réel OK : 2 projets décomposés ("déjeuner dimanche" 6 tâches, "week-end chez les parents" 5 tâches), cohérence validée

---

## [2026-04-22e] — Sprint 11 : Nettoyage V1

### Supprimé (alignement spec V1 "zéro charge mentale")
- `app/(app)/tasks/` (page.tsx, new, [id], assign, catalog, rebalance, recap, archived, log) — CRUD V0 avec scoring 4 axes
- `app/(app)/planning/` — remplacé par `/week` (déjà en place)
- `app/(app)/dashboard/`, `app/(app)/distribution/` — hors ADN V1 (score d'équité, analytics)
- `components/DeleteButton.tsx` (hard delete) et `components/ViewToggle.tsx` (liste/planning) — composants orphelins
- `app/(app)/layout.tsx` — FAB `+`, popup quick-add, brouillon localStorage `yova_task_draft`
- `utils/pushNotifications.ts` — `scheduleDraftReminders` + `checkDraftReminder` (pointaient vers `/tasks/new`)
- `app/(app)/journal/page.tsx` — widget "Bilan de la semaine" dimanche (barres % par membre basées sur `mental_load_score`) = score d'équité explicitement hors V1

### Modifié
- `app/(app)/layout.tsx` — `NAV_ITEMS.matches` nettoyé : `/today` ne matche plus `/tasks` et `/planning`
- `proxy.ts` — post-onboarding redirige vers `/today` (avant : `/dashboard`)
- `public/sw.js` — url par défaut des push `/today` (avant : `/tasks/recap`)
- `app/(app)/error.tsx` — bouton "Accueil" → `/today`
- `app/(app)/admin/catalog/page.tsx` — gate `profile.role === 'admin'` côté client (en plus du 403 API), redirect cassé `/dashboard` → `/today`
- `app/(app)/week/page.tsx` — empty state 7 j amélioré : si des tâches existent hors fenêtre → "N tâches à venir plus tard" + CTA bascule vue Mois

### Conservé en DB
- Colonnes `mental_load_score`, `time_weight`, `physical_weight`, `mental_weight`, `impact_weight` sur `household_tasks` — historique préservé, plus d'affichage user-facing
- `utils/taskScoring.ts` + `utils/distributionAnalytics.ts` — encore utilisés par API routes (parse-journal, enrich-templates)

### Pourquoi
L'app exposait toujours du CRUD V0 (FAB, `/tasks` avec scoring, `/planning`, `/dashboard`, `/distribution`) en contradiction avec la spec V1 « pas de gestion, Yova porte la charge ». Le sprint 10 (micro-actions via `TaskActionsSheet`) a rendu ces surfaces redondantes. Ce sprint supprime la dette V0 pour aligner l'app sur ses 3 onglets (Aujourd'hui · Parler à Yova · Foyer) et ses 4 piliers.

### Piliers spec
- Pilier 3 — Proactivité douce (l'user ajuste via sheet, il ne gère pas une todo-list)
- Pilier 4 — Mode crise (moins de surfaces = moins de charge cognitive)

---

## [2026-04-22d] — Sprint micro-actions tâches (+ undo toast)

### Ajouté (en plus de 22c)
- `components/UndoToast.tsx` — toast bas d'écran avec bouton **Annuler** (auto-dismiss 4s), pattern Gmail/iOS
- `stores/taskStore.ts` — méthode `unarchiveTask(taskId, householdId)` (restaure `is_active=true`, bypass du lookup store)
- `/today` + `/week` — toast d'annulation après "Pas pertinent" (remplace l'idée initiale de modale de confirmation — moins de friction, même filet de sécurité)

### Corrigé
- Bug unarchive : `updateTask({is_active:true})` échouait car la tâche était déjà retirée du store après archive → séparation claire entre `updateTask` (modif champs) et `unarchiveTask` (restauration)
- Race condition intermittente sur l'undo : `handleSheetArchive` appelait un `fetchTasks` redondant en plus de celui déjà fait par `archiveTask`. Si ce refetch non-awaited résolvait après `unarchiveTask`, il écrasait l'état restauré avec l'état archivé. Suppression du refetch redondant dans `/today` et `/week`.

### Pourquoi toast vs modale
Modale de confirmation envisagée, rejetée. L'archive est réversible en DB (pas de hard delete), friction à chaque action contre l'ADN "zéro charge mentale". Le toast offre un filet de sécurité réel (4s pour annuler) sans friction.

---

## [2026-04-22c] — Sprint micro-actions tâches

### Ajouté
- `components/TaskActionsSheet.tsx` — bottom sheet unifiée avec 4 actions sur une tâche : **Fait** / **Reporter** (demain, +3j, +7j) / **Réassigner** (liste membres) / **Pas pertinent** (archive, réversible en DB). Sous-vues intégrées, une seule entrée visuelle.
- `app/(app)/today/page.tsx` — bouton `⋯` sur chaque tâche + long-press (500 ms, vibration tactile si dispo) + clic droit desktop → ouvre la sheet d'actions.
- `app/(app)/week/page.tsx` — tap sur une ligne de tâche (y compris "Projets à venir") ouvre la même sheet. La vue reste read-only en apparence, mais chaque tâche est maintenant actionnable.

### Modifié
- `app/(app)/today/page.tsx` — `TodayTaskCard` simplifiée : suppression du swipe-left (archive/supprimer redondants avec la sheet), suppression du label "Demain" (remplacé par `⋯`), suppression du modal de confirmation de suppression (plus de hard delete dans l'UI — seulement archive).

### Supprimé
- `app/(app)/today/page.tsx` — modal "Supprimer la tâche ?" et `handleDeleteRequest/handleDeleteConfirm`. Respecte l'ADN V1 : l'user ajuste, il ne gère pas une todo-list. Les tâches archivées restent en DB, pas perdues.

### Pourquoi
Question produit ouverte en début de session : l'user doit-il pouvoir agir sur ses tâches s'il le décide ? Oui — mais en **micro-actions**, pas en mode gestion. Vision respectée : Yova porte la charge, l'user corrige (reporter, réassigner, « pas pertinent »). Pas de CRUD classique, pas de création manuelle (ça passe par *Parler à Yova*).

---

## [2026-04-22b] — Corrections onboarding + profil + vue semaine

### Ajouté
- `app/(app)/week/page.tsx` — toggle **7 jours / 30 jours roulants** (vue mois = jours avec tâches uniquement)
- `CHANGELOG.md` — restauré (avait été supprimé par erreur lors du nettoyage repo)

### Modifié (corrections onboarding)
- `app/api/onboarding/chat/route.ts` — règle "zéro improvisation" : Claude ne génère QUE les tâches explicitement mentionnées. Exclut couches, préparer enfants école, plier linge (si lessive déjà listée)
- `app/api/onboarding/create-tasks/route.ts` — déduplication DB : vérification contre tâches existantes avant insertion (anti-doublon si onboarding relancé)
- `app/(app)/today/page.tsx` — fix refresh automatique au retour depuis le journal (`pathname` comme dépendance useEffect)
- `app/(app)/today/page.tsx` — délai 1.5s dans `handleComplete` avant appel `completeTask()` (animation visible avant disparition)
- `app/api/ai/parse-journal/route.ts` — "je vais faire X" = toujours ASSIGNATION, jamais complétion + routage vers Sonnet

### Supprimé (profil — nettoyage spec V1)
- `app/(app)/profile/page.tsx` — "CE QU'YOVA SAIT DE TOI" (formulaires manuels)
- `app/(app)/profile/page.tsx` — slider "MON OBJECTIF" (score d'équité, hors spec V1)
- `app/(app)/profile/page.tsx` — "Niveau de charge souhaité" (même concept que score d'équité)
- `app/(app)/profile/page.tsx` — "RACCOURCIS" + liste membres + lien "Notre famille"
- ~450 lignes de code mort supprimées

### Docs
- `docs/SPEC_V1_YOVA.md` — mise à jour complète : état du build, règles onboarding, features retirées

### Pilier spec
- Pilier 1 — Connaissance intime du foyer (mémoire narrative remplace formulaires)
- Pilier 3 — Proactivité douce (zéro improvisation = tâches pertinentes uniquement)

---

## [2026-04-22] — Sprint 2 : Page Aujourd'hui inbox spec V1

### Ajouté
- Card "Maintenant" : 1 tâche urgente épinglée en haut, pleine largeur, gradient bleu
- Section "À faire aujourd'hui" : 3-5 items max avec durée estimée et bouton "Report demain"
- Section "Sur le radar" : collapsible, anticipations des tâches à venir cette semaine
- CTA "Check-in du soir" : bloc Yova visible uniquement après 20h
- Rechargement automatique au retour sur l'onglet (visibilitychange)

### Retiré (archivé, non supprimé)
- "Score & répartition" retiré de la nav Profil (hors spec V1 §Migration)
- "Statistiques détaillées" retiré des raccourcis Profil (même raison)

### Référence
- Spec : `docs/SPEC_V1_YOVA.md` §Navigation V1 + §Migration
- Branch : `feat/sprint-2-today-inbox` → validé Jonathan 2026-04-22

---

## [2026-04-21j] — Sprint 13 : Tags mémoire dynamiques + nettoyage famille

### Modifié
- `app/(app)/family/page.tsx` — "Ce qu'on traverse" : remplacement des options statiques (liste figée) par les faits extraits automatiquement par Yova (`fact_type: context/tension/milestone` depuis `agent_memory_facts`)
- `app/(app)/family/page.tsx` — dismiss d'un tag = `is_active: false` en DB (Yova retire la situation résolue)
- `app/(app)/family/page.tsx` — suppression section "Notes pour Yova" (textarea non validé, remplacé par le journal)
- `app/(app)/family/page.tsx` — suppression `toggleLifeEvent` + `LIFE_EVENTS_OPTIONS` + états `contextNotes/notesSaved/notesChanged`

### Pilier spec
- Pilier 1 — Connaissance intime du foyer (Yova remplit, l'utilisateur valide)
- Validé — 2026-04-21

---

## [2026-04-21h] — Sprint 11 : Déduplication mémoire Yova

### Modifié
- `app/api/ai/extract-memory/route.ts` — déduplication par overlap de mots avant insertion (seuil 50% : fait très similaire ignoré)
- `app/api/ai/extract-memory/route.ts` — désactivation (`is_active = false`) des anciens faits `tension`/`context` quand le modèle indique `replaces: true`
- `app/api/ai/extract-memory/route.ts` — prompt renforcé : règles anti-doublon explicites, comparaison imposée avec la liste existante
- `app/api/ai/extract-memory/route.ts` — sélection du champ `id` sur les faits existants (requis pour la désactivation)

### Pilier spec
- Pilier 1 — Connaissance intime du foyer (mémoire propre, sans redondance)
- Validé sur device réel Jonathan — 2026-04-21

---

## [2026-04-21g] — Sprint 10 : Dictée vocale (fix PC)

### Modifié
- `app/(app)/journal/page.tsx` — fix micro PC : permission audio explicite via `getUserMedia` avant `recognition.start()` (résout le bouton silencieux)
- `app/(app)/journal/page.tsx` — affichage visible de l'erreur micro (`speechError`) sous la zone de saisie

### Pilier spec
- Pilier 3 — Proactivité douce (saisie naturelle par la voix)
- Validé sur device réel Jonathan — 2026-04-21

---

## [2026-04-21f] — Sprint 9 : Portrait narratif Yova

### Ajouté
- `supabase/migrations/20260421_sprint9_narrative.sql` — colonnes `yova_narrative` + `yova_narrative_updated_at` sur `households`
- `app/api/ai/update-narrative/route.ts` — Haiku maintient un portrait vivant du foyer (3-6 phrases, réécrit après chaque journal)

### Modifié
- `app/api/ai/parse-journal/route.ts` — injection du portrait narratif dans le contexte Yova (priorité sur les faits plats)
- `app/api/ai/parse-journal/route.ts` — fire-and-forget vers `update-narrative` après chaque journal réussi
- `app/api/ai/parse-journal/route.ts` — fix : tâches dans parenthèses détectées ("j'avais X à faire (dont le pliage)")
- `app/api/ai/parse-journal/route.ts` — fix : inférences limitées aux actions, pas au contexte situationnel

### Pilier spec
- Pilier 1 — Connaissance intime du foyer (portrait narratif vivant)
- Validé sur device réel Jonathan — 2026-04-21

---

## [2026-04-21e] — Sprint 8 : Sonnet 4.6 + Qualité réponse Yova

### Modifié
- `app/api/ai/parse-journal/route.ts` — modèle Haiku → **Sonnet 4.6** (`claude-sonnet-4-6`)
- `app/api/ai/parse-journal/route.ts` — prompt `ai_response` enrichi : inférences implicites, utilisation mémoire longue, contexte check-in du soir, spécificité obligatoire
- `app/api/ai/parse-journal/route.ts` — matching tâche strict : même geste concret uniquement, sinon `auto_create` (fix "pliage de linge" → "Lancer une lessive")
- `app/api/ai/parse-journal/route.ts` — garde-fou UUID : validation que le `task_id` retourné par le modèle existe réellement dans le foyer avant insertion
- `utils/aiLogger.ts` — type `claude-sonnet-4-6` + commentaires coûts mis à jour

### Pilier spec
- Pilier 1 — Connaissance intime du foyer (mémoire utilisée dans la réponse)
- Pilier 3 — Proactivité douce (réponse Yova qualitative et personnalisée)
- Validé sur device réel Jonathan — 2026-04-21

---

## [2026-04-21d] — Sprint 7 : Check-in du soir guidé

### Ajouté
- `app/(app)/journal/page.tsx` — mode check-in du soir (actif dès 20h) : 3 questions séquentielles collectées localement puis envoyées groupées à parse-journal
- Indicateur de progression 3 points (bleu = actuel, vert = répondu, gris = à venir)
- Fix UX : Q1 réinjectée dans le thread au premier envoi (ne disparaît plus)

### Modifié
- `app/(app)/journal/page.tsx` — `sendCheckin` : collecte 3 réponses sans appel API intermédiaire, combine en texte structuré `Question\nRéponse` × 3, envoie une seule requête parse-journal
- `handleNewConversation` : reset de `checkinStep` et `checkinAnswers`

### Pilier spec
- Pilier 1 — Connaissance intime du foyer (Roadmap Mois 2)
- Pilier 3 — Proactivité douce (Yova initie le bilan du soir)
- Validé sur device réel Jonathan — 2026-04-21

---

## [2026-04-21c] — Sprint 6 : Mémoire longue Yova

### Ajouté
- `supabase/migrations/20260421_sprint6_memory_long.sql` — extension pgvector + table `conversation_turns` (embeddings 1536 dims, RLS)
- `app/api/ai/extract-memory/route.ts` — extraction auto de faits depuis le journal (Claude Haiku, 0-3 faits/journal, stockés dans `agent_memory_facts`)
- `app/api/ai/parse-journal/route.ts` — appel fire-and-forget vers extract-memory après chaque journal réussi

### Modifié
- `app/(app)/today/page.tsx` — greeting Yova enrichi par les faits mémoire (tension → context → life events → énergie)

### Pilier spec
- Pilier 1 — Connaissance intime du foyer (Roadmap Mois 2)
- Livrable : "Yova se souvient vraiment"
- Validé sur device réel Jonathan — 2026-04-21

---

## [2026-04-21b] — Sprint 5 : Détection de dérives + « Ce que Yova a remarqué »

### Ajouté
- `supabase/migrations/20260421_sprint5_observations.sql` — table `observations` (type, severity, payload, acknowledged_at) + RLS
- `types/database.ts` — types `Observation`, `ObservationType`, `ObservationSeverity`
- `app/api/agent/detect-observations/route.ts` — API POST détection 4 patterns : `cooking_drift`, `balance_drift`, `journal_silence`, `task_overdue_cluster`
- `app/(app)/family/page.tsx` — section « Ce que Yova a remarqué » avec cards colorées par sévérité + bouton acquittement

### Modifié
- `app/(app)/today/page.tsx` — suppression balance bar et métriques (❌ hors spec SPEC_V1_YOVA.md), page allégée conforme
- `CLAUDE.md` — @-références auto-chargées vers SPEC_V1_YOVA.md et PROCESS_DEV.md (prévention dérive contexte)

### Archivé
- `feat/fairshare-poc` — branche archive du code balance/équité (réutilisable pour app FairShare future)

### Pilier spec
- Pilier 2 — Détection de dérives (Roadmap Mois 4)
- Validé sur device réel Jonathan — 2026-04-21

---

## [2026-04-21] — Pivot produit V1 « Le 3e adulte du foyer »

### Ajouté
- `docs/SPEC_V1_YOVA.md` — doc de référence épinglé du nouveau positionnement
- `docs/PROCESS_DEV.md` — process de développement avec sprints et validations intermédiaires
- `docs/YOVA_PITCH.pptx` — pitch deck partageable (14 slides)
- `docs/generate_pitch_deck.cjs` — générateur du deck
- `CHANGELOG.md` (ce fichier)

### Modifié
- Plan de tests : 276 → 278 cas (ajout 1.5d autocomplete mdp + 1.6c timeout signup 15s)

### Décidé
- **Positionnement V1** : agent IA compagnon pour foyers en surcharge (parents épuisés + enfants)
- **Navigation** : 4 onglets → 3 onglets (Aujourd'hui · Famille · Parler à Yova)
- **Score/Dashboard** : sortis de la nav principale (archivés, pas supprimés)
- **Pricing** : Free + Premium 14,99 €/mois + Annuel 149 €/an

### À suivre
- Sprint 1 : `feat/sprint-1-member-profiles` (fiches membres enrichies)

---

## [2026-04-20] — Fixes auth et onboarding

### Modifié
- `stores/authStore.ts` — timeout 15s sur signUp pour éviter bouton bloqué
- `app/(auth)/register/page.tsx` — `autoComplete="new-password"` sur mdp + confirmation
- `app/page.tsx` — `force-dynamic` + `revalidate = 0` (tentative fix redirect Vercel)

### Connu
- Bug Vercel non résolu : `/` → 307 `/login` au lieu de `/landing`. Cause identifiée externe à notre code (probablement corruption projet Vercel). Contournement : utiliser directement `/login` ou `/landing`.
