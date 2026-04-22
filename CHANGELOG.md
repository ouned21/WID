# Changelog Yova

Toutes les évolutions notables sont listées ici. Une entrée par release (merge main).

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/). Versionning : `AAAA-MM-JJ` (calendar versioning, one bump per merged sprint).

---

## [2026-04-24] — Sprint 15bis : Check-in conversationnel contextualisé (Piliers 1+3)

### Ajouté
- `utils/checkinOpener.ts` — logique pure pour choisir le signal d'ouverture depuis la mémoire du foyer : `buildOpenerCandidates`, `pickOpenerWithRotation`, `isMemoryEmpty`, `buildContextBlock`, `daysUntilNextBirthday`. Priorité validée Jonathan : `upcoming_event_urgent` (< 3j) > `observation_alert` > `upcoming_event_near` (3-7j) > `recent_mention` (< 48h) > `narrative` > `fallback`
- `utils/checkinOpener.test.ts` — 25 tests (priorité, rotation anti-harcèlement, fallback mémoire vide, troncature contexte, ignore turns > 72h)
- `app/api/ai/checkin-opener/route.ts` — POST Sonnet 4.6, max 25 mots, ton confident. Charge en parallèle profiles + phantoms + households.yova_narrative + agent_memory_facts + observations non-ack + conversation_turns + dernier opener < 30h (rotation). Timeout 8s, fallback silencieux. Garde-fou serveur : refuse hors fenêtre soir (coût)
- `supabase/migrations/20260424_sprint15bis_checkin_openers_log.sql` — table `checkin_openers_log` (household_id, user_id, question, source, source_detail, is_static_fallback, generated_at, was_answered, answered_at) + index (household_id, generated_at DESC) + RLS select membres foyer / insert service_role uniquement

### Modifié
- `app/(app)/journal/page.tsx` — **Option A (swap non-bloquant)** : la bubble statique sprint 15 s'affiche instantanément au mount (zéro latence perçue) ; un useEffect parallèle déclenche `POST /api/ai/checkin-opener` SI `isInEveningWindow(now) && !hasCheckinForCurrentWindow(now, profile.last_checkin_at)`. Quand la réponse Sonnet arrive (2-5s typique), on swap silencieusement la bubble par la version tailored — **sauf** si l'user a déjà commencé à écrire ou à envoyer (verrou `openerLockedRef` sur `text.length > 0 || messages.length > 0`). Résultat : aucune attente visible, le tailored remplace gracieusement s'il arrive à temps, le statique tient sinon. Import `checkinWindow` helpers

### Règles produit (décisions sprint 15bis)
- **Marqueur tailored = muet** : Yova ne signale pas visuellement que la question vient de sa mémoire. La question doit taper juste, pas la badge "✦ depuis ta mémoire". Discrétion de confident
- **Rotation anti-harcèlement** : si `source_detail` du pick = celui du dernier opener < 30h → on descend d'un cran. Jamais deux soirs de suite sur le même signal précis. Retombe au fallback si tous les candidats sont épuisés
- **Premier check-in (mémoire vide) = court-circuit Sonnet** : helper `isMemoryEmpty` détecte l'absence totale de facts/narrative/obs/turns/birthdays. Retourne directement l'accroche statique *"On apprend à se connaître — raconte-moi ta soirée, je retiens tout pour la suite."* Pas d'appel Sonnet gaspillé au premier contact (coût + latence + évite le fallback générique qui sonne faux)
- **Priorité priorise l'imminent sur le chronique** : un anniv dans 2 jours prime un `cooking_drift` alert de 12 jours. Un événement familial raté fait plus mal qu'une observation chronique (choix produit Jonathan, ordre gravé dans `buildOpenerCandidates`)
- **User qui esquive = on lâche** : la spec 15bis dit "conv 100% libre après la question d'ouverture". Aucune logique d'insistance prévue — si l'user répond "rien de spécial", Yova bascule en conv ouverte, pas de relance sur le topic. Un confident qui relance après "ça va" passe pour lourd
- **Sonnet uniquement dans la fenêtre soir** : garde-fou serveur (rejet 400 hors 20h-04h) + garde-fou client (useEffect skip). Zéro appel gaspillé hors fenêtre check-in
- **Swap non-bloquant (option A)** : l'user ne doit jamais attendre Sonnet. La bubble statique s'affiche au mount, le tailored la remplace en arrière-plan si Sonnet répond à temps (avant interaction). Décision Jonathan : pas de skeleton bloquant, pas de pré-génération cron (infra à ajouter), pas de streaming (UX bizarre sur 25 mots). Le statique devient la vraie fondation UX ; le tailored = bonus qui tombe quand il tombe

### Pourquoi
Sprint 15 a supprimé la séquence de 3 questions hardcodées ("formulaire, pas IA"). Restait à refonder le rituel du soir côté mémoire active — montrer que Yova connaît le foyer. L'opener tailored est le signal le plus lisible de la mémoire longue : une question qui tape juste = Pilier 1 (connaissance intime) rendu visible + Pilier 3 (proactivité douce) activé au bon moment, sans jamais se transformer en coach.

### Fix post-démo (2026-04-24, même sprint)
Tests device Jonathan : l'opener tombait systématiquement en `fallback` malgré 10 faits actifs + anniv Eva dans 20j. Deux gaps comblés :
- **Fenêtre anniv étendue à 30j** (alignement brief : *"Eva a 5 ans dans 20 jours — tu veux qu'on commence à préparer ?"*). Nouveau bucket `upcoming_event_far` (8-30j) placé sous `recent_mention` et au-dessus de `narrative`. Les buckets urgent (<3j) et near (3-7j) restent prioritaires
- **Nouveau bucket `facts` ≥ 3 faits actifs** : exploite `agent_memory_facts` quand aucun signal structuré ne sort. Sonnet reçoit la directive "pioche UN élément concret". Placé entre `narrative` et `fallback`. Évite le fallback générique ("C'était quoi, le moment le plus marquant...") quand Yova connaît manifestement le foyer
- `isMemoryEmpty` recalibré : seuil passe de 1 à 3 faits (aligné sur le bucket `facts`). Un foyer avec 1-2 faits isolés reste en court-circuit statique

### Piliers spec
- Pilier 1 — Connaissance intime du foyer (la question d'ouverture prouve que Yova retient les faits, anniversaires, derniers échanges, observations)
- Pilier 3 — Proactivité douce (timing = fenêtre check-in, ton = confident, rotation = pas de harcèlement, lâcher-prise = pas de coach)

### Pré-merge — validation
- `npx tsc --noEmit` : OK
- `npx vitest run utils/checkinOpener.test.ts` : 25/25 sprint 15bis
- Suite globale : 120/121 (1 fail pré-existant `utils/security.test.ts` sans rapport, noté sprint 14 & 15)
- `npx next build` : à compiler avant merge
- Démo device réel : 5 scénarios attendus (cooking_drift / anniv < 7j / mention récente / mémoire vide / hors fenêtre) — à faire par Jonathan

---

## [2026-04-23] — Sprint 15 : Nettoyage bugs UX critiques (confiance produit pré-Barbara)

### Ajouté
- `supabase/migrations/20260423_sprint15_checkin_tracking.sql` — colonne `profiles.last_checkin_at timestamptz` (idempotent). Horodate le dernier message journal dans la fenêtre soir (20h-04h) ; masque la CTA `/today` dès qu'un message y a été envoyé
- `utils/checkinWindow.ts` — helpers `parisHour`, `isInEveningWindow`, `currentWindowStart`, `hasCheckinForCurrentWindow` (fenêtre fixe 20h Paris → 04h du lendemain, robuste aux fuseaux serveur via `Intl.DateTimeFormat`). Heure Paris, pas UTC ni local runner
- `utils/checkinWindow.test.ts` — 16 tests unitaires (transitions 20h/04h, traversée de minuit, fenêtre courante vs last_checkin_at passé/présent/précédent)
- `utils/projectParent.ts` — helpers `buildProjectParentIdSet` + `isProjectParent` pour factoriser la règle "un parent de projet ne se complète jamais auto"
- `utils/projectParent.test.ts` — 8 tests unitaires dont un scénario end-to-end (filtre completions sur parents préserve uniquement les tâches simples)

### Modifié
- `app/api/ai/parse-journal/route.ts` — (A) select `household_tasks` étend à `parent_project_id` + skip systématique des completions sur tasks référencées comme parents (règle "se complète implicitement quand 100% sous-tâches done" sprint 12, préservée). (B) Après insert `user_journals`, si `isInEveningWindow(now)` → UPDATE `profiles.last_checkin_at = NOW()` pour l'user courant. Aucune condition sur la longueur/qualité du message : ≥ 1 message dans la fenêtre = check-in compté
- `app/(app)/today/page.tsx` — CTA check-in : `isEvening = hour >= 20` remplacé par `showCheckinCta = isInEveningWindow(now) && !hasCheckinForCurrentWindow(now, profile.last_checkin_at)`. Disparaît dès qu'un message a été envoyé dans la fenêtre courante ; réapparaît naturellement à la prochaine fenêtre (20h le lendemain)
- `app/(app)/journal/page.tsx` — refonte en conversation libre 100% (C). Suppression : `checkinStep`, `checkinAnswers`, `CHECKIN_QUESTIONS` (3 questions hardcodées), `sendCheckin`, `isEveningTime`, la progress bar 3 points, la branche conditionnelle 20h du welcome, import `detectProjectIntent`. Le bouton envoyer et Cmd+Enter routent toujours vers `send()`. Le bouton "+ Nouveau" reset uniquement le thread. Accroche Yova adaptée à l'heure locale conservée comme bubble d'ouverture
- `types/database.ts` — ajout `Profile.last_checkin_at: string | null`

### Pourquoi
Sprint 14 a livré les fondations data (auto-sync faits + anti-doublon projet) mais 3 bugs démo tuaient la confiance : (A) le parseur marquait le parent "Anniversaire d'Eva" comme FAIT quand l'user parlait de la date d'anniversaire, (B) la CTA check-in du soir réapparaissait en boucle même après complétion, (C) impossible d'ouvrir le journal en conv libre après 20h — le flow 3-questions était imposé. Sprint 15 ferme ces 3 fuites avant tests Barbara.

### Règles produit (décisions sprint 15)
- **Parent de projet jamais completable auto** : règle mécanique, aucune exception. Un parent se complète seulement via 100% de ses sous-tâches (règle sprint 12 intacte)
- **Fenêtre soir fixe 20h Paris → 04h du lendemain** : pas de fenêtre glissante 24h. Reset à 20h chaque soir. Hors fenêtre = CTA invisible (pas "toujours visible la journée")
- **≥ 1 message = check-in compté** : pas de détection sémantique. Si l'user a parlé à Yova dans la fenêtre soir, c'est compté. Check-in abandonné ou juste un "ok merci" → compte quand même. Reformulation vers conv contextualisée = sprint 15bis
- **Check-in guidé supprimé, pas mis en feature flag** : décision Jonathan — les 3 questions hardcodées "font formulaire, pas IA/Yova". Refonte dédiée en sprint 15bis (Sonnet génère une ouverture tailored depuis mémoire narrative + facts + observations)

### Piliers spec
- Pilier 1 — Connaissance intime du foyer (un parent de projet ne se "souvient" plus à tort)
- Pilier 3 — Proactivité douce (plus de rappel CTA qui harcèle après complétion)

### Pré-merge — validation
- `npx tsc --noEmit` : OK
- `npx vitest run utils/checkinWindow.test.ts utils/projectParent.test.ts` : 24/24 nouveaux tests sprint 15
- Suite globale : 95/96 (1 fail pré-existant `utils/security.test.ts` sans rapport, noté sprint 14)
- `npx next build` : compile OK (`✓ Compiled successfully`, TypeScript OK). Échec "page data collection" local par `.env.local` absent dans le worktree — reproduit identique sur main, levé en prod Vercel via env injectées

---

## [2026-04-22h] — Sprint 14 : Auto-sync faits structurés + nettoyage data legacy

### Ajouté
- `app/api/ai/extract-memory/route.ts` — extension Haiku pour détecter 3 champs structurés (`birth_date`, `school_class`, `allergies`) et les écrire direct dans `phantom_members`. Matching prénom : exact (normalisé) prioritaire, fallback Levenshtein ≤ 2 avec gap ≥ 1 vs second candidat. Skip silencieux si confidence < 0.8 ou prénom ambigu. Trace audit systématique dans `agent_memory_facts` (visible sous "Ce que Yova sait")
- `app/api/ai/extract-memory/memory.test.ts` — 14 tests unitaires (normalizeName, levenshtein, matchPhantomByName, applyStructuredUpdates avec merge allergies)
- `utils/projectDecomposition.ts` — helper `projectTitleSimilarity` (Jaccard sur tokens, stop-words FR filtrés, seuil strict 0.6 pour détection doublon) + 4 tests
- `lib/decomposeProjectCore.ts` — détection de doublon projet (< 14 j, similarité ≥ 0.6) avant appel Sonnet. Émet `kind: 'duplicate'` avec question "remplacer / ajouter à côté ?" stockée dans `conversation_turns.extracted_facts.pending_project_duplicate`. Helpers exportés : `findPendingDuplicate`, `interpretDuplicateAnswer`. Flag `skipDuplicateCheck` pour bypass après décision user
- `scripts/backfill-orphan-project-tasks.ts` — script Node dry-run/--apply qui détecte les tâches `once` avec `parent_project_id=null` candidates à être ratachées à un parent existant (similarité titre + fenêtre ±7 j autour du parent)

### Modifié
- `app/api/ai/parse-journal/route.ts` — router étendu : détecte `pending_project_duplicate` récent (< 10 min), interprète la réponse user (remplacer/ajouter/ambigu), archive l'ancien parent + enfants si "remplacer", bypass dup-check si "ajouter". Re-pose la question si décision ambiguë
- `app/api/ai/decompose-project/route.ts` — handle `kind: 'duplicate'` dans la réponse JSON (champ `pending_duplicate`)
- `app/(app)/journal/page.tsx` — nouveau type message `memory_note` : bubble discrète "📌 Fiche Eva · anniversaire : 13 mai" rendue après la réponse Yova quand `extract-memory` retourne des `structured_updates`. Refresh du store household pour propager la MAJ dans `/family`
- `app/(app)/week/page.tsx` — masque les tâches parent de projet du grid jour-par-jour (cohérent avec `/today` qui les masque déjà via `ProjectGroupCard`). Sous-tâches continuent à porter leur chip coloré. Section "Projets à venir" (> 7 j) garde les parents visibles — c'est la vue projets

### Pourquoi
Sprint 13 avait livré des fondations solides (actions inline, assignation phantom, chips projet) mais laissait 4 frictions issues de la démo : (1) l'user devait toujours resaisir l'anniv / la classe / les allergies dans `/family` même après l'avoir dit à Yova, (2) lancer 2 fois le même projet créait des doublons silencieux, (3) les rows parent polluaient le grid `/week`, (4) la migration sprint 12 avait laissé des sous-tâches orphelines en DB. Sprint 14 referme la boucle de mémoire structurée et nettoie la dette.

### Règles produit (décisions sprint 14)
- **Dates relatives ignorées** : "dans 2 mois" / "la semaine prochaine" ne sont PAS extraites. Uniquement dates explicites convertibles en ISO (year défaulte à l'année courante si la date n'est pas passée, sinon année suivante)
- **school_class tel quel** : "Grande Section", "CE1", "6ème" écrits sans normalisation
- **Allergies merge dédupliqué** : jamais d'écrasement — perdre une allergie = danger réel
- **Feedback discret** : bubble "📌" après la réponse Yova (pas de confirmation bloquante, mais zéro signal fait douter — compromis trouvé)
- **Anti-doublon strict** : seuil Jaccard 0.6 — mieux laisser passer un doublon (fix en 2 clics) que bloquer un vrai projet avec une question inutile

### Piliers spec
- Pilier 1 — Connaissance intime du foyer (fiches membres se mettent à jour toutes seules)
- Pilier 3 — Proactivité douce (Yova détecte le doublon et demande avant de ré-empiler des tâches)

### Pré-merge — validation
- `npx tsc --noEmit` : OK
- `npx vitest run` : 37/37 sprint 14 (14 memory + 23 projectDecomposition dont 4 nouveaux anti-doublon). Suite globale : 65 passed + 1 failed pré-existant sur `utils/security.test.ts` (sanitizeUserInput, sans rapport avec sprint 14)
- `npx next build` : OK

---

## [2026-04-22g] — Sprint 13 : Actions inline chat + phantom assignation + chip projet /week

### Ajouté
- `utils/projectDecomposition.ts` — champ `assigned_phantom_id: string | null` dans `DecomposedSubtask` (mutex avec `assigned_to`). Validator UUID + rejette si les deux champs non-null simultanés. 3 nouveaux tests unitaires (19 au total)
- `lib/decomposeProjectCore.ts` — les phantom_members exposent leur UUID à Sonnet via marqueur `[phantom:UUID]` (distinct de `[UUID]` pour les profiles). Prompt système mis à jour : règle "mutex + n'assigne PAS à un phantom par défaut, seulement si fait mémoire clair". Insert `household_tasks.assigned_to_phantom_id` côté DB
- `app/(app)/week/page.tsx` — helpers `projectChipColor(parent_project_id)` (hash stable → palette 6 couleurs) et `ProjectChip` (✨ + titre parent, tappable). Banner filtre actif "Projet : X ✕" affichée en tête quand un chip est cliqué

### Modifié
- `app/(app)/journal/page.tsx` — `DecomposedProjectCard` refactorisée en composant "live" : fetch dédié des sous-tâches via `parent_project_id` (inclut `is_active=false` pour afficher les archivées grisées+rayées+badge "archivée"), tap sur une sous-tâche → `TaskActionsSheet`, refetch après chaque action. Fallback sur le JSON renvoyé par l'endpoint pendant le premier render pour éviter un flash vide. Footer remplacé "Voir sur Aujourd'hui" → "Tape une tâche pour l'ajuster" (l'user n'a plus besoin de naviguer)
- `app/(app)/week/page.tsx` — `WeekTaskRow` affiche le chip projet inline à droite du nom (couleur stable par `parent_project_id`, label = nom du parent). Tap sur chip (stopPropagation) → filtre la vue sur les tâches de ce projet (enfants + parent). Appliqué aussi à la section "Projets à venir". Pas de regroupement — le tri par jour reste la valeur de /week (coordination temporelle)
- `types/database.ts` : inchangé (`assigned_to_phantom_id` déjà présent depuis sprint 1)

### Pourquoi
Sprint 12 a livré la décomposition mais laissait deux frictions : (1) après "organise le déjeuner dimanche", l'user devait naviguer sur `/today` pour ajuster la moindre sous-tâche — rupture conversationnelle, (2) Barbara (phantom member sans compte) ne pouvait jamais être ciblée par Sonnet même si un fait mémoire le justifiait. Sprint 13 referme ces boucles : l'user ajuste dans le chat sans changer d'onglet, et Sonnet peut cibler n'importe quel membre du foyer. Le chip /week est un bonus de lisibilité quand plusieurs projets coexistent.

### Règles produit respectées (ref spec M3)
- **Zéro improvisation d'assignation phantom** : Sonnet n'assigne un phantom QUE si un fait mémoire établit un pattern clair. Même règle stricte que pour les profiles, étendue aux phantoms
- **Pas de CRUD UI** : la sheet chat propose les mêmes 4 micro-actions (Fait / Reporter / Réassigner / Pas pertinent) — pas de nouvelle action, pas de création manuelle
- **Réversible en DB** : "Pas pertinent" archive (`is_active=false`), la sous-tâche reste visible grisée + rayée + badge "archivée" dans la card chat. Pas de hard delete UI

### Piliers spec
- Pilier 1 — Connaissance intime du foyer (phantoms adressables = mémoire foyer complète)
- Pilier 3 — Proactivité douce (l'user ajuste inline, il ne gère pas une todo-list)

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
