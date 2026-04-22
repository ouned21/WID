# Changelog Yova

Toutes les évolutions notables sont listées ici. Une entrée par release (merge main).

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/). Versionning : `AAAA-MM-JJ` (calendar versioning, one bump per merged sprint).

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
