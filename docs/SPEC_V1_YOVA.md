# Yova V1 — Spec produit

> **Doc de référence épinglé.** Toute feature V1 doit être traçable à cette spec.
> Dernière mise à jour : 2026-04-27 (sprint 16 v1 abandonné, v2 backloggé en tool use)

---

## 🎯 Positionnement

> **« Le 3e adulte de ton foyer. Pour les parents qui en ont plein le dos. »**

Yova n'est pas un outil de gestion, c'est un **compagnon** qui porte la charge mentale invisible d'un foyer en surcharge. Quand les deux parents sont au bout du rouleau, Yova pense, rappelle, anticipe — avec douceur, sans jugement.

---

## 👥 Persona cible

**Primaire** :
- 30-45 ans
- En couple, 1-3 enfants (généralement < 10 ans)
- Deux adultes actifs en surcharge (job + parentalité + charge mentale)
- Conscient de ses dérives mais impuissant à les corriger seul
- Revenus moyens+ (peut payer un premium)
- À l'aise avec le digital mais **pas power user IA**

**Contexte d'usage typique** :
> *« Ça fait 10 jours qu'on mange des plats industriels. Personne n'a fait les courses. Barbara dort 5h. J'oublie les rendez-vous pédiatre. On vit en mode survie. Je sais que ça va pas, mais j'ai pas la force de reprendre le contrôle. »*

---

## 🏛️ Les 4 piliers (le moat)

Chaque feature V1 doit renforcer au moins un de ces piliers. Sinon on ne la build pas.

| # | Pilier | Ce que ça veut dire |
|---|--------|----------------------|
| **1** | **Connaissance intime du foyer** | Yova construit une mémoire vivante : membres, âges, contraintes, routines, épisodes. Pas juste des données, du contexte narratif. |
| **2** | **Détection de dérives** | Jobs quotidiens qui repèrent les patterns inquiétants (10 jours sans cuisiner, sommeil en berne, événement non préparé). Yova voit ce que les parents ne voient plus. |
| **3** | **Proactivité douce** | Notifications et suggestions au bon ton, au bon moment. Jamais culpabilisant, toujours constructif. « Tu m'as dit que cuisiner te pèse — voici 3 repas 15 min que vous aimez tous les 4. » |
| **4** | **Mode crise** | Quand tout dérape, Yova réduit le périmètre au minimum vital (dîner, linge propre, devoirs) et porte le reste. L'app devient plus simple, pas plus compliquée. |

---

## 📱 Navigation V1 — 3 onglets (et pas 4)

Un foyer en surcharge ne peut pas gérer 4 onglets.

| Onglet | Rôle |
|--------|------|
| **Aujourd'hui** | Inbox unique : ce qui compte aujourd'hui, rien de plus. Remplace Journal + Tâches + Planning actuels. |
| **Foyer** | Le foyer vivant : membres, contraintes, ce que Yova sait, observations. |
| **Parler à Yova** | Chat/vocal avec l'agent (rituel du soir + sessions libres). |

Le Score 4 axes et le Dashboard analytique **sortent de la nav principale**. Archivés, accessibles via Foyer → Paramètres → Statistiques (feature Premium curieux).

---

## 🖥️ Spec écran par écran

### 📅 Aujourd'hui

**Principe** : *« Ouvre l'app, vois ce qui compte, zéro charge mentale. »*

**Structure** (haut en bas) :
1. **Banner contextuel** — visible uniquement si Mode crise ON : *« Yova te tient cette semaine. Juste l'essentiel. »*
2. **Card « Maintenant »** — 1 seule chose urgente s'il y en a une (ex: 18h30 → *« Dîner à préparer »*)
3. **À faire aujourd'hui** — 3-5 items max, triés par urgence
   - Par item : titre, durée estimée, bouton `✓ fait` ou swipe `Report demain`
4. **Sur le radar** (collapsible) — anticipations Yova (anniv, rdv, saisons)
5. **Check-in du soir** (après 20h) — CTA vers Parler à Yova

**Ce qui n'est PAS là** :
- ❌ Liste exhaustive des tâches
- ❌ Score ou métriques
- ❌ Planning calendrier à grille (trop lourd cognitivement)

**Accessible depuis Aujourd'hui** :
- 📅 **"Cette semaine"** (`/week`) — vue légère avec toggle **7 jours / 30 jours roulants**, groupée par jour, avec badges assignation foyer. Coordination entre adultes. Read-only, pas de drag & drop. En vue 30 jours : seuls les jours avec des tâches sont affichés.

---

### 🏠 Foyer

**Principe** : *« Ce que Yova sait de vous. »*

**Sous-sections** :

1. **Membres**
   - Adultes : prénom, rôle, contraintes actuelles
   - Enfants : prénom, âge, classe, spécificités (allergies, activités, routines bed-time)
   - Chaque membre = fiche vivante, enrichissable

2. **Contexte actuel du foyer**
   - Niveau d'énergie global (low / medium / high)
   - Périodes de vie difficiles (déménagement, nouveau job, deuil, maladie)
   - Aides externes (grands-parents, nounou, auxiliaire de vie)

3. **Routines & équipements** (héritage Yova actuel, allégé)

4. **Ce que Yova a remarqué** ⭐
   - Feed des observations agent : *« J'ai noté 8 livraisons ce mois / Barbara < 6h sur 5 nuits / salon pas rangé depuis dimanche »*
   - C'est ICI que Yova montre qu'elle connaît. Feature wow.

---

### 💬 Parler à Yova

**Principe** : *« Ton espace pour lui parler. Comme à un confident qui agit. »*

**3 entrées** :

1. **Check-in du soir** (bouton principal, voice-first)
   - Session vocale guidée, 3-5 min
   - Yova pose 2-3 questions : *« Comment ça va ? Quelqu'un a fait les courses ? Les filles, ça va ? »*
   - Extrait les infos + propose actions pour demain
   - Fin : résumé humain + CTA `OK je m'en occupe` / `Plus tard`

2. **Conversation libre** — chat texte ou vocal à tout moment, avec accès à toute la mémoire du foyer

3. **Historique** — toutes les conversations, searchable, pour la continuité émotionnelle

---

## 🧠 Architecture data — la mémoire vivante

C'est **la** brique technique centrale. Plus critique que l'IA elle-même.

### 3 couches de mémoire

1. **Mémoire structurée** (Postgres)
   - Membres, contraintes, routines, équipements, tâches, événements
   - Source de vérité factuelle, éditable par user

2. **Mémoire narrative** (pgvector)
   - Chaque conversation, check-in, note vocale → stockée en embeddings
   - Recherchable sémantiquement par l'agent à chaque session
   - *« Yova se souvient vraiment »*

3. **Observations** (Postgres + jobs)
   - Jobs quotidiens analysent l'activité et émettent des observations
   - Ex: 10 jours sans tâche « cuisine » → observation `cooking_drift`
   - Remontées dans onglet Foyer + déclenchent rappels doux

### Schéma simplifié des nouvelles tables

```sql
-- Profil foyer enrichi (un par household)
household_profile
  - household_id (PK, FK households)
  - energy_level: 'low' | 'medium' | 'high'
  - current_life_events: text[]  -- ex: ['déménagement', 'nouveau job']
  - external_help: jsonb  -- ex: [{type: 'grandparent', freq: 'weekly'}]
  - crisis_mode_active: boolean
  - updated_at: timestamp

-- Membres enrichis (adultes ET enfants)
household_members (table existante, colonnes à ajouter)
  + birth_date: date  -- pour enfants surtout
  + role: 'adult_primary' | 'adult_secondary' | 'child' | 'other'
  + school_class: text  -- pour enfants
  + specifics: jsonb  -- allergies, activités, routines

-- Tours de conversation (nouvelle table)
conversation_turns
  - id (PK)
  - household_id (FK)
  - speaker: 'user' | 'agent'
  - content: text
  - embedding: vector(1536)  -- pgvector
  - extracted_facts: jsonb
  - created_at: timestamp

-- Observations agent (nouvelle table)
observations
  - id (PK)
  - household_id (FK)
  - type: text  -- ex: 'cooking_drift', 'sleep_deficit', 'event_unprepared'
  - severity: 'info' | 'notice' | 'alert'
  - payload: jsonb
  - detected_at: timestamp
  - user_acknowledged_at: timestamp | null
  - user_action_taken: text | null

-- Faits durables (nouvelle table)
agent_memory_facts
  - id (PK)
  - household_id (FK)
  - subject: text  -- ex: 'Barbara'
  - fact_text: text  -- ex: 'travaille tard le jeudi'
  - confidence: float  -- 0-1
  - source_turn_id: uuid | null
  - last_confirmed_at: timestamp
```

---

## 🤖 Stack IA et coûts

### Rôles des modèles

| Usage | Modèle | Pourquoi |
|-------|--------|----------|
| Extraction faits (vocal/texte) | Claude Haiku 4.5 | Rapide, pas cher, volume |
| Détection dérives (jobs) | Claude Haiku 4.5 | Volume élevé |
| Conversation check-in du soir | Claude Sonnet 4.5 | Empathie + raisonnement |
| Anticipations complexes | Claude Sonnet 4.5 | Raisonnement multi-facteurs |
| Transcription vocal (STT) | Deepgram Nova 2 (FR) ou Whisper | Qualité français |
| Voix agent (TTS) | ElevenLabs v2 multilingual | Naturelle en FR |

### Coût estimé par foyer actif/mois

- Haiku (extractions + jobs) : ~0,50 €
- Sonnet (check-ins + anticipations) : ~1,20 €
- STT (~90 min/mois) : ~0,50 €
- TTS (~60 min/mois) : ~0,80 €
- Infra Supabase/Vercel : ~0,10 €
- **Total : ~3,10 €/foyer/mois**

### Pricing recommandé

| Plan | Prix | Contenu |
|------|------|---------|
| **Free** | 0 € | Onboarding, 1 check-in/semaine, tâches basiques, pas de mémoire longue, pas de mode crise |
| **Premium mensuel** | 14,99 €/mois | Tout illimité, 4 piliers actifs, 2 users foyer |
| **Premium annuel** | 149 €/an | −17 %, même contenu |

**Marge brute** : ~80 % sur le premium mensuel.

---

## 🔄 Migration depuis Yova actuel

### On GARDE (refactor léger)
- Auth Supabase
- Modèle données foyer + membres + tâches (avec ajustements)
- Service worker PWA
- Journal quotidien (devient la brique « Parler à Yova »)

### Onboarding — conversation guidée Yova (sprint 3)
Remplace le formulaire multi-étapes + catalogue statique.

**Principe** : chat guidé, mix chips/boutons + texte libre. Chaque question a un objectif technique précis.

| Question | Donnée produite | Effet concret |
|---|---|---|
| Taille du foyer | `household_size` | Volume de tâches |
| Prénoms/âges enfants | `phantom_members` (nom, birth_date) | Active tâches enfants |
| Classe scolaire | `phantom_members.school_class` | Tâches scolaires |
| Allergies/contraintes | `phantom_members.specifics.allergies` | Informe cuisine/courses |
| Prénoms adultes du foyer | `phantom_members` (type adult, nom) | Mémoire foyer complète |
| Aide extérieure | `household_profile.external_help` | Désactive tâches couvertes |
| Équipements (grille chips) | `household_profile` | Active/désactive blocs tâches |
| Niveau d'énergie | `household_profile.energy_level` | low → mode vital |
| Courses faites ou à faire ? | `next_due_at` courses | Calibrage J0 |
| Lessive lancée ou à faire ? | `next_due_at` lessive | Calibrage J0 |
| Dîner ce soir prévu ? | `next_due_at` repas | Calibrage J0 |

**Génération** : Claude Haiku avec tout le contexte → 10-18 tâches JSON avec `next_due_at` calibré.
**Fallback** : catalogue statique si Claude timeout.
**Sauvegarde** : conversation → `conversation_turns` (première mémoire Yova).

**Règles de génération des tâches (onboarding) — NON NÉGOCIABLES** :
- 🔴 **Zéro improvisation** : Claude ne génère QUE des tâches dont le besoin a été explicitement mentionné par l'user. Si l'user n'a pas dit "j'ai un bébé en couches" → pas de réappro couches. Si pas d'animal mentionné → pas de tâches animaux.
- ✅ Tâches autorisées sans mention explicite (besoins universels) : courses, lessive, cuisine du soir, ménage, admin
- ❌ Exclure les rituels automatiques : bain, brossage dents, coucher enfants, repas matin, vaisselle, faire son lit, préparer les enfants pour l'école, préparer le cartable
- ❌ Exclure "plier/ranger le linge" si lessive déjà dans la liste (implicite)
- ❌ Exclure poubelles quotidiennes (collecte hebdo ou tri sélectif uniquement)
- Déduplication : vérification contre les tâches déjà en DB (anti-doublons si onboarding relancé)

### On RETIRE de la nav (code archivé, pas supprimé)
- Score 4 axes (plus visible par défaut)
- Dashboard/Distribution
- Planning calendrier semaine → remplacé par vue légère `/week` (liste 7j/30j roulants, pas de grille)
- Section "Ce qu'Yova sait de toi" (formulaire manuel) → remplacé par mémoire narrative via conversations
- Slider "Mon objectif" / "Niveau de charge souhaité" → score d'équité, hors ADN V1
- Liste membres dans Profil → appartient uniquement à l'onglet Foyer

### On AJOUTE
- Fiches membres enrichies (enfants âges/contraintes)
- Table `household_profile` (contexte foyer)
- Table `observations` + jobs détection
- Table `agent_memory_facts` + pgvector embeddings
- Surface « Parler à Yova » avec vocal (STT + TTS)
- Mode crise (toggle manuel V1, automatisation V2)

---

## ✅ État actuel du build (2026-04-25 — sprint 16 inclus)

### ~~Sprint 16 v1 — Consolidation de tâches chevauchantes (2026-04-25, PR #12 ABANDONNÉE)~~

**ABANDONNÉ — voir CHANGELOG entrée 2026-04-27.** Architecture regex (router `interpretOverlapAnswer` + state via `conversation_turns.pending_overlap`) jugée anti-pattern par Jonathan en cours de tests. Refacto v2 en tool use Haiku planifié (voir backlog ci-dessous).

Conservé pour v2 : migration `covers_project_ids uuid[]`, `detectOverlaps` + `buildOverlapQuestion`, pattern de découpage parent/non-overlap/pending.

<details><summary>Description originale v1 (référence)</summary>
- `utils/overlapDetection.ts` (logique pure, 24 tests) — Yova détecte quand une sous-tâche d'un projet décomposé recoupe une tâche récurrente existante (Jaccard ≥ 0.33 sur tokens significatifs, fenêtre ±3 jours). Calibré sur le cas canonique "Faire les courses" mer. ↔ "Faire les courses pour le déjeuner dimanche". Seuil distinct du sprint 14 anti-doublon (0.5) — ici on cherche un **recoupement utile**, pas un clone strict.
- Migration `20260425_sprint16_overlap_consolidation.sql` : colonne `household_tasks.covers_project_ids uuid[]` (default `'{}'`) + index GIN. Liste des `parent_project_id` qu'une tâche récurrente couvre AUSSI suite à un groupement. Affichée comme badge discret vert "↻ couvre aussi : <projet>" sur `/week`.
- `lib/decomposeProjectCore.ts` : nouveau retour `kind: 'overlap_question'`. Après validation Sonnet, **avant insert enfants**, si overlaps détectés → insère parent + sous-tâches NON-overlap, stocke contexte complet dans `conversation_turns.extracted_facts.pending_overlap`, retourne question groupée. Helpers `findPendingOverlap` + `clearCoversForProject` (cascade idempotente).
- `app/api/ai/parse-journal/route.ts` : router `pending_overlap` interprète la réponse user en 4 décisions :
  - **`group`** → UPDATE récurrente `next_due_at = subtask_next_due_at` (déplacement à la date du projet, preco Jonathan) + append `parent_id` à `covers_project_ids` (dedup)
  - **`keep_both`** → INSERT pending_subtasks tel quel (2 tâches séparées sur /week)
  - **`reschedule`** → UPDATE récurrente `next_due_at = new_date_iso` (extraction "demain", "samedi", "27 mai") + covers ; pas de date claire = reformule UNE fois puis fallback
  - **`ambiguous`** → fallback `keep_both` silencieux ("je garde les deux côtés. Tu peux ajuster sur /week.") — esprit "user qui esquive = on lâche" sprint 15bis
- Cascade clear `clearCoversForProject` appelée sur tous les chemins d'archivage parent : sprint 14 replace flow (parse-journal), `taskStore.archiveTask` (TaskActionsSheet "Pas pertinent"), `journal/page.tsx` DecomposedProjectCard archive. Cohérence mémoire vivante : si un projet meurt, son contexte "couvre aussi" disparaît automatiquement des récurrentes.
- `app/(app)/week/page.tsx` : `WeekTaskRow` affiche "↻ couvre aussi : <titre projet>" en vert sobre (11px) sous le nom de tâche quand `covers_project_ids` non vide. Lookup `archivedParentTitles` étendu pour résoudre les titres de projets référencés via covers (pas seulement parent_project_id).
</details>

### Sprint 15bis — Check-in conversationnel contextualisé (2026-04-24, PR #10 mergée)
- `POST /api/ai/checkin-opener` (Sonnet 4.6, timeout 8s, max_tokens 120) : une seule question tailored, max 25 mots, ton confident. Charge en parallèle profiles + phantoms + `households.yova_narrative` + `agent_memory_facts` (10) + `observations` non-ack (10) + `conversation_turns` (10) + dernier opener < 30h (pour rotation).
- `utils/checkinOpener.ts` (logique pure, testable) : `buildOpenerCandidates` ordonne les signaux selon la priorité validée Jonathan (`upcoming_event_urgent` < 3j > `observation_alert` > `upcoming_event_near` 3-7j > `recent_mention` < 48h > `narrative` > `fallback`). `pickOpenerWithRotation` descend d'un cran si `source_detail` identique au dernier opener (anti-harcèlement). `isMemoryEmpty` court-circuite Sonnet au premier contact (retourne *"On apprend à se connaître — raconte-moi ta soirée"*). `buildContextBlock` formate le contexte injecté dans le prompt (tronqué à 8 facts, 3 user turns < 72h, 3 alerts max).
- Migration `20260424_sprint15bis_checkin_openers_log.sql` : table `checkin_openers_log` (question, source, source_detail, is_static_fallback, was_answered post-hoc) + index + RLS (select membres foyer, insert service_role).
- `app/(app)/journal/page.tsx` : **option A non-bloquant** — la bubble statique sprint 15 s'affiche instantanément au mount, un useEffect parallèle appelle l'opener SI `isInEveningWindow(now) && !hasCheckinForCurrentWindow(now, profile.last_checkin_at)`. Quand Sonnet répond (2-5s), swap silencieux de la bubble par la version tailored — verrouillé dès que l'user écrit ou envoie (évite le swap pendant que l'user tape). Fallback gracieux sur les 3 accroches sprint 15 si timeout/échec.
- Règles non négociables gravées dans le code : garde-fou serveur hors fenêtre (400), marqueur "tailored" muet (pas de badge visuel — Yova ne se vante pas de sa mémoire), aucune logique d'insistance après réponse esquive (conv 100% libre post-opener, acquis sprint 15 préservé).
- 25/25 tests unitaires sur `checkinOpener.ts` (priorité inter-buckets, rotation, fallback mémoire vide, ignore turns > 72h, troncature facts, observations non-alert ignorées).

### Sprint 15 — Nettoyage bugs UX critiques pré-Barbara (2026-04-23, PR #9 mergée)
- **(A) Parent de projet jamais completable auto** : `app/api/ai/parse-journal/route.ts` select `parent_project_id` sur `household_tasks`, puis skip toute completion dont `task_id` est référencé comme parent (via helper `utils/projectParent.ts`). Un parent se complète uniquement via 100% sous-tâches done (règle sprint 12 intacte). Plus jamais de "Anniversaire d'Eva FAIT" quand l'user tape *"l'anniv d'Eva c'est le 13 mai"*.
- **(B) CTA check-in du soir ne réapparaît plus après complétion** : migration `20260423_sprint15_checkin_tracking.sql` (colonne `profiles.last_checkin_at timestamptz`). `parse-journal` met à jour `last_checkin_at = NOW()` si le message tombe dans la fenêtre 20h→04h (heure Paris via `Intl.DateTimeFormat`, robuste aux fuseaux serveur). `/today` masque la CTA via helper `hasCheckinForCurrentWindow(now, last_checkin_at)`. Fenêtre fixe 20h → 04h ; reset 20h le lendemain.
- **(C) Journal en conversation libre 100%** : suppression du flow check-in imposé (`CHECKIN_QUESTIONS`, `checkinStep`, `checkinAnswers`, `sendCheckin`, progress bar 3 points, branche conditionnelle `isEveningTime` du welcome). Bouton envoyer + Cmd+Enter routent toujours vers `send()`. Accroche Yova adaptée à l'heure locale conservée comme bubble d'ouverture. Décision Jonathan : les 3 questions hardcodées "font formulaire, pas IA/Yova" → refonte conversationnelle contextualisée planifiée en sprint 15bis.
- Helpers + tests : `utils/checkinWindow.ts` (+ 16 tests), `utils/projectParent.ts` (+ 8 tests). 24/24 nouveaux tests sprint 15 passent.

### Sprint 14 — Auto-sync faits structurés + /week redesign + anti-doublon projet (2026-04-22h, PR #6 mergée)
- `lib/structuredMemory.ts` (module partagé) + extraction regex inline **synchrone** dans `parse-journal` → écrit `birth_date` / `school_class` / `specifics.allergies` direct dans `phantom_members` avant retour de la réponse. 3 patterns regex ("anniv de X le DD mois", "X rentre en CLASSE", "X allergique à Y"). Matching prénom exact prioritaire + fallback Levenshtein ≤ 2 (gap ≥ 1 vs 2e candidat). Skip silencieux si confidence < 0.8 ou ambigu. Allergies mergées sans écrasement. Trace audit dans `agent_memory_facts`.
- Bubble discrète "📌 Fiche Eva · anniversaire : 13 mai" après la réponse Yova dans `/journal` quand une fiche membre est mise à jour. Rafraîchit `fetchHousehold` pour propager la maj sur `/family`.
- Fiche membre : si `birth_date` est dans le futur (auto-sync sans année de naissance) → affiche "🎂 dans X j" au lieu de "-1 ans". Helper `daysUntilNextBirthday`.
- Anti-doublon projet dans `decomposeProjectCore` : avant appel Sonnet, check fuzzy (Jaccard ≥ 0.6) sur les parents actifs < 14 j. Si match → Yova demande "remplacer / ajouter ?". Stateful via `pending_project_duplicate` dans `conversation_turns`. Helpers `findPendingDuplicate` + `interpretDuplicateAnswer` + flag `skipDuplicateCheck`.
- `/week` redesign option B : grid chrono top-down (Aujourd'hui → Demain → …), section "PROJETS EN COURS" déplacée **sous** le grid. N'affiche que les **parents** (pas les sous-tâches) avec progress bar N/total + chip coloré + date prochaine échéance. Tap carte = filtre vue. Sous-tâches > 7 j basculées en mode Mois.
- `scripts/backfill-orphan-project-tasks.ts` — script dry-run/--apply pour rattacher les sous-tâches historiques orphelines à leurs parents de projet.
- `extract-memory` conservé en parallèle (Haiku fallback/complément pour faits narratifs) mais n'est plus critique — `parse-journal` est source de vérité pour l'écriture structurée.

### Sprint 13 — Actions inline chat + phantom assignation + chip /week (2026-04-22g)
- `DecomposedProjectCard` dans `/journal` devient tappable : chaque sous-tâche ouvre `TaskActionsSheet` (Fait / Reporter / Réassigner / Pas pertinent), refetch live après chaque action. Archivées affichées grisées + rayées + badge.
- Sonnet peut cibler `assigned_to_phantom_id` (Barbara, enfant…) — phantoms exposés dans le prompt via `[phantom:UUID]`, règle "seulement si fait mémoire clair" identique aux profiles. Validator mutex + 3 tests unitaires.
- `/week` : chip projet coloré (hash `parent_project_id` → palette 6 couleurs) à côté de chaque sous-tâche. Tap chip → filtre la vue sur ce projet. Pas de regroupement — tri par jour préservé.

### Sprint 12 — Décomposition de projets complexes M3 (2026-04-22f)
- Endpoint `/api/ai/decompose-project` + `lib/decomposeProjectCore.ts` : Sonnet 4.6 décompose un projet en parent + 3-6 sous-tâches datées/assignées en 1 tour.
- Router regex dans `parse-journal` : détection heuristique + single-question flow stateful via `conversation_turns`.
- `ProjectGroupCard` sur `/today` : groupe projet + sous-tâches (progress, expand/collapse, actions inline).
- Migration `parent_project_id` self-ref + index partiel.

### Sprint 11 — Nettoyage V1 (2026-04-22e)
Suppression de toute la dette V0 incompatible avec la spec :
- Routes retirées : `/tasks` (et toutes ses sous-routes CRUD), `/planning`, `/dashboard`, `/distribution`
- FAB `+` + popup quick-add retirés de `layout.tsx` (l'ajout de tâches passe uniquement par *Parler à Yova*)
- Composants `DeleteButton`, `ViewToggle` supprimés (plus d'utilisateurs)
- Widget "Bilan de la semaine" dimanche dans `/journal` retiré (barres % par membre = score d'équité, hors spec)
- `/admin/catalog` gate renforcée `profile.role === 'admin'`
- Colonnes scoring conservées en DB (historique), plus aucun affichage user-facing
- `/week` empty state 7 j : affiche "N tâches à venir plus tard" + CTA bascule Mois
- Redirections post-onboarding et notifications push repointées vers `/today`

### Implémenté et livré

**Aujourd'hui (`/today`)**
- Card "Maintenant" (tâche la plus urgente), section "À faire aujourd'hui" (5 max), "Sur le radar" (collapsible), lien "Cette semaine"
- Complétion tâche : feedback visuel immédiat (optimistic UI) + délai 1.5s avant suppression pour que l'animation soit visible
- Rafraîchissement automatique au retour depuis le journal (pathname comme dépendance useEffect)
- Assignation inline via bottom sheet (badge membre cliquable)

**Journal / Parler à Yova (`/journal`)**
- Saisie texte + dictée vocale (Web Speech API + Deepgram STT)
- Fix hydration iOS PWA : `isSpeechSupported` initialisé côté client uniquement
- Gestion erreur `service-not-allowed` (PWA iOS sans permission micro)
- Détection assignation : "je vais faire X" = toujours une ASSIGNATION, jamais une complétion → routé vers Sonnet
- Routage modèle : Haiku (complétions simples) / Sonnet (assignations, émotions, texte long)
- Check-in du soir guidé : actif dès 20h, 3 questions séquentielles, progression 3 points ✅
- Portrait narratif du foyer : Haiku maintient `yova_narrative` (3-6 phrases, réécrit après chaque journal) ✅
- Mémoire longue : `agent_memory_facts` — extraction auto 0-3 faits/journal, déduplication overlap mots ✅

**Onboarding (`/onboarding`)**
- Chat guidé SSE streaming avec Haiku
- Fix infinite loading : `maxDuration=60`, suppression des `await fetchHousehold/fetchTasks` bloquants
- Fix comptage adultes : arithmétique explicite dans le prompt (householdSize - enfants - 1)
- Règle zéro improvisation sur les tâches générées (voir section Onboarding)
- Déduplication DB : vérification contre tâches existantes avant insertion

**Cette semaine (`/week`)**
- Vue 7 jours groupée par jour, badges assignation colorés
- Toggle **7 jours / 30 jours roulants** (vue mois = jours avec tâches uniquement)
- Tap sur une ligne (jour ou "Projets à venir") ouvre la sheet d'actions

**Micro-actions tâches (transverse `/today` + `/week`)**
- Composant partagé `components/TaskActionsSheet.tsx` : bottom sheet unifiée avec 4 actions — **Fait** / **Reporter** (demain / +3j / +7j) / **Réassigner** (liste membres) / **Pas pertinent** (archive, pas delete)
- Ouverture sur `/today` : bouton `⋯` sur chaque carte + long-press 500 ms (vibration) + clic droit desktop
- Ouverture sur `/week` : tap sur la ligne entière
- **Philosophie** : l'user ajuste, il ne gère pas une todo-list. Pas de création manuelle (ça passe par *Parler à Yova*), pas de hard delete dans l'UI (seulement archive réversible en DB)

**Profil (`/profile`)**
- Informations compte (nom, avatar), foyer (nom, code invitation), mode vacances, notifications, déconnexion, légal
- "Ce que Yova sait" : affichage des faits `agent_memory_facts` avec emoji par type
- Supprimé : liste membres (→ onglet Foyer), "Ce qu'Yova sait de toi" (formulaires manuels), "Mon objectif" (slider %), "Niveau de charge souhaité", raccourcis

**Foyer (`/family`)**
- Mode crise (toggle manuel), énergie du foyer, "Ce qu'on traverse" (tags dynamiques depuis `agent_memory_facts`), fiches enfants, autres membres, invitation partenaire
- Détection de dérives : 4 patterns (`cooking_drift`, `balance_drift`, `journal_silence`, `task_overdue_cluster`)

### Prochains sprints (à prioriser avec Jonathan)

- **Sprint 16 v2 — Consolidation chevauchantes via tool use** ⭐⭐ (à reprendre en priorité, valeur Pilier 3 toujours non livrée) : refacto de la v1 abandonnée. Architecture : Haiku reçoit la réponse user à la question d'overlap + 3 tools strictement typés (`group_recurring`, `keep_both`, `reschedule_recurring`). Haiku choisit + paramètre + le système exécute → action garantie + message naturel. Conservé v1 : migration `covers_project_ids`, `detectOverlaps`, `buildOverlapQuestion`, pattern de découpage parent/non-overlap/pending. Jeté v1 : router regex `interpretOverlapAnswer`, state via `conversation_turns.pending_overlap` (mécanisme à investiguer en début de v2). Durée : 1.5-2 j.

- **Sprint 17 — TTS Yova** ⭐⭐ (priorité haute, débloque la métrique nord V1) : Yova répond à voix haute (ElevenLabs ou Web Speech TTS) pour le check-in du soir. Aujourd'hui STT (Deepgram) existe mais Yova n'a pas de voix → le check-in est à moitié vocal. La métrique nord V1 = "check-in vocal ≥ 4×/semaine" — sans TTS, on mesure pas ce qu'on prétend. À prioriser avant sprint 18. Mois 3 roadmap. Durée : 2-3 j.

- **Sprint 17bis — Onboarding → conversation_turns** : aujourd'hui le chat onboarding (10-18 questions guidées Haiku) n'écrit AUCUN turn dans `conversation_turns` (vérifié grep, sprint 16 audit). Conséquence : un user fraîchement onboardé démarre l'opener sprint 15bis avec `isMemoryEmpty=true` → fallback générique "On apprend à se connaître" alors qu'il vient de passer 10 min en chat. Le portrait foyer construit en onboarding est invisible pour le rituel du soir. Sprint court : insérer chaque échange onboarding dans `conversation_turns` (source: 'onboarding'), garder l'historique searchable dès J1. Durée : 1-2 j.

- **Sprint 17ter — Nettoyage scoring résiduel** : sprint 11 a retiré l'affichage user-facing du score 4 axes mais on continue d'écrire `mental_load_score`/`user_score` à 5 hardcodés un peu partout (decomposeProjectCore, generate-tasks, parse-journal). Plus dans l'ADN V1 → à supprimer (validé Jonathan sprint 16 audit). Migration : colonnes nullable + suppression des inserts hardcodés + nettoyage `taskScoring.ts` si plus appelé. Durée : 1-2 j.

- **Sprint 18 — Anticipations parentales** : jobs quotidiens détectent anniv enfants < 7 j, vacances scolaires, rdv pédiatre récurrents → observations proactives Pilier 2. Mois 4-5. Durée : ~1 semaine.

- **Sprint 19 — Mode crise automatique** : activation auto sur signal dérive sévère (3+ observations `alert` concomitantes). Mois 5, V2. Durée : 3-4 j.

- **Sprint 19bis — Premium infra** ⭐ (validé Jonathan sprint 16 audit, à planifier avant Barbara prend un tarif au sérieux) : aujourd'hui `/upgrade` page existe mais aucun gating réel (pas de Stripe, pas de paywall sur `aiRateLimit`, free vs premium = même expérience). À ne pas reporter à la veille du beta — risque de promesse cassée visible. Sprint dédié : Stripe integration + gating quota IA (Free = 1 check-in/semaine + tâches basiques + pas de mémoire longue per spec) + UX `/upgrade` avec CTA fonctionnel. Durée : ~1 semaine.

- **Sprint 20 — Beta prep** : onboarding 30-50 users, polish, instrumentation métrique nord (% foyers avec ≥ 4 check-ins vocaux/semaine à S+4). Mois 6. Durée : 1-2 semaines.

> **Process** : chaque sprint = nouvelle session Claude Code. Lire CHANGELOG.md + SPEC_V1_YOVA.md + PROCESS_DEV.md en début de session.

---

## 🧩 Décomposition de projets complexes (M3) — ✅ Implémenté sprint 12 (2026-04-22f)

Certains besoins ne sont pas une tâche unique mais un **projet multi-étapes**. Exemples : *« organise le déjeuner de dimanche »*, *« prépare l'anniversaire de Léa »*, *« planifie le week-end chez mes parents »*.

### Principe — proposition imparfaite, pas interrogatoire

Yova décompose en **un seul tour de parole**, sans poser de questions quand la réponse peut être devinée. Elle s'appuie sur :

1. **La mémoire structurée** (`household_members`, `household_profile`) : nb de convives = taille foyer par défaut, allergies connues, aides externes récurrentes
2. **La mémoire narrative** (`agent_memory_facts`, `conversation_turns` via pgvector) : repas aimés, budgets habituels, contraintes récurrentes mentionnées dans les journaux passés
3. **Les défauts nominaux** : créneau raisonnable (courses la veille, prépa H-2), budget standard, pas d'invités

Elle propose un **projet parent + 3-6 sous-tâches liées** avec `next_due_at` calibrés. L'user ajuste via les micro-actions (reporter, réassigner, pas pertinent) ou corrige en langage naturel (*« on sera 7, mes parents viennent »* → recalibrage).

### Ce qu'elle ne fait PAS

- ❌ Poser plus d'**une** question clarifiante (et seulement si un fait critique manque vraiment et n'a pas de défaut raisonnable)
- ❌ Demander ce qu'elle peut déduire de la mémoire (allergies, goûts, budget, qui cuisine)
- ❌ Demander des préférences catégorielles ("entrée ? dessert ? apéro ?") — elle propose, l'user écarte

### Règle des défauts

| Info manquante | Défaut assumé |
|---|---|
| Nb convives | `household_size` |
| Budget | "normal" (pas de contrainte évoquée dans la mémoire) |
| Invités | Aucun sauf mention explicite dans le prompt |
| Régimes spéciaux | Uniquement les allergies/préférences déjà en mémoire |
| Créneaux | Courses la veille après-midi · prépa H-2 avant repas |
| Qui fait quoi | Assignation selon les patterns passés (qui cuisine habituellement) |

### Stack technique

- **Modèle** : Sonnet 4.5 (pas Haiku — raisonnement multi-étapes + ton empathique)
- **Input** : prompt user + contexte mémoire complet (members, profile, last N facts, last M conversation turns pertinents via pgvector)
- **Output structuré** : `{ project: {title, description}, subtasks: [{name, duration, next_due_at, assigned_to, frequency:'once'}] }`
- **DB** : pas de nouvelle table — sous-tâches insérées dans `household_tasks` avec un champ `parent_project_id` (migration à prévoir) pour grouper dans l'UI

### Critère de succès M3

- Sur 10 prompts projets variés (repas, anniv, week-end, rentrée, rdv pédiatre avec courses associées), Yova produit en **1 tour** une décomposition utilisable sans plus de 1 correction user en moyenne.
- Temps de réponse < 8s.
- 0 % de questions superflues (faits déjà en mémoire).

---

## 🗓️ Roadmap de build — 6 mois

### Mois 1 — Fondations pivot
- Refactor nav 4 → 3 onglets
- Onglet « Aujourd'hui » (fusion journal + tâches)
- Onglet « Foyer » avec fiches membres enrichies
- Migration données existantes
- **Livrable** : Yova V1 avec nouvelle structure, IA inchangée

### Mois 2 — Mémoire longue
- pgvector setup + embeddings sur conversations
- Table `agent_memory_facts` + extraction auto
- Agent retrouve les faits pertinents
- **Livrable** : Yova se souvient vraiment

### Mois 3 — Parler à Yova (vocal) + décomposition de projets
- Surface chat + vocal (STT + TTS)
- Check-in du soir guidé
- Historique conversations
- **Décomposition de projets complexes** (voir section dédiée ci-dessous) : Sonnet décompose "organise le déjeuner dimanche" en 4-6 sous-tâches liées (menu, liste courses, courses, prépa) à partir de la mémoire foyer + défauts nominaux, sans interrogatoire — ✅ livré sprint 12 (2026-04-22f)
- **Actions inline dans chat Yova** : `TaskActionsSheet` accessible directement sur la card "Projet préparé" (reporter / réassigner / pas pertinent) sans quitter la conversation — ✅ livré sprint 13 (2026-04-22g)
- **Assignation Yova vers membres fantômes** : Sonnet peut cibler Barbara / tout phantom_member via `assigned_to_phantom_id` dès qu'un fait mémoire le justifie — ✅ livré sprint 13 (2026-04-22g)
- **Chip projet sur /week** : chaque sous-tâche d'un projet porte un chip coloré (couleur stable par `parent_project_id`) ; tap → filtre la vue sur ce projet. Aide à la lecture quand plusieurs projets coexistent — ✅ livré sprint 13 (2026-04-22g)
- **Consolidation de tâches chevauchantes** ⭐ : Yova détecte quand une sous-tâche de projet recoupe une tâche récurrente existante et propose proactivement de grouper. Essentiel au Pilier 3 "Proactivité douce". *Identifié lors des tests sprint 12 — le produit est incomplet sans ça.*
- **Livrable M3** : rituel vocal du soir fonctionnel + un seul tour de parole pour lancer un projet + Yova propose de grouper les tâches qui se chevauchent + ajustement sans quitter le chat

### Mois 4 — Détection de dérives
- Job quotidien analyse activité
- Table `observations` + UI Foyer
- Notifs douces avec bon ton
- **Livrable** : Yova commence à étonner

### Mois 5 — Mode crise + anticipations parentales
- Toggle Mode crise + UX simplifiée
- Jobs anticipation (anniv, vacances scolaires, rdv)
- **Livrable** : produit différenciant, prêt beta

### Mois 6 — Beta + polish
- 30-50 users beta (hors Jonathan+Barbara)
- Itération retours
- Pricing + paywall Premium
- **Livrable** : launch public fin mois 6

---

## 🚫 Ce qu'on ne fait PAS en V1

- ❌ Score d'équité / dashboard analytique / slider objectif % tâches (plus dans l'ADN)
- ❌ Préférences manuelles IA (tâches détestées/aimées, horaires, jours dispo) — Yova apprend par les conversations, pas par des formulaires
- ❌ Notifications matinales proactives (V2)
- ❌ Coach émotionnel poussé (risques éthiques, on reste sur soutien doux)
- ❌ Assistant généraliste (voyages, finances, etc.)
- ❌ Intégration email / SMS / WhatsApp (V2)
- ❌ Smart home (V2+)
- ❌ Natif iOS/Android via Expo (V3, post-validation PWA)

---

## 📊 Comment on mesure le succès de V1

**Métrique nord** : **% de foyers qui font un check-in vocal du soir ≥ 4 fois/semaine au bout de 4 semaines.**
- Si ≥ 40 % → produit trouve son rythme, on scale
- Si 20-40 % → itérer le rituel
- Si < 20 % → rework produit

**Métriques secondaires** :
- Taux d'ack des observations (user valide ce que Yova remarque) — cible > 60 %
- Taux de conversion Free → Premium — cible > 8 %
- Rétention D30 Premium — cible > 60 %
- NPS Premium — cible > 40

---

## 🧭 Positionnement face à la concurrence

| Concurrent | Différence |
|------------|-----------|
| **ChatGPT / Claude app** | Passif, ne connaît pas le foyer, pas proactif, mono-user |
| **Apple Intelligence / Siri v2** | Ne fera jamais multi-user foyer (coutures iCloud) |
| **Replika / Pi** | Compagnon solo, émotionnel uniquement, aucune action concrète |
| **Cozi / FamilyWall** | Outils collaboratifs passifs, zéro IA proactive |
| **Coaches parentaux humains** | Chers, occasionnels, pas en continu |

Yova = la seule app qui combine *mémoire foyer + détection dérives + proactivité douce + action concrète*.
