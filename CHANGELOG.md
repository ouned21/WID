# Changelog Yova

Toutes les évolutions notables sont listées ici. Une entrée par release (merge main).

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/). Versionning : `AAAA-MM-JJ` (calendar versioning, one bump per merged sprint).

---

## [2026-04-22] — Sprint 6 : Vue semaine + assignation des tâches

### Ajouté
- `app/(app)/week/page.tsx` — NEW : vue "Cette semaine" — 7 jours groupés par date, badges assignation colorés (bleu = moi, vert = autre adulte, violet = enfant/fantôme), légende membres, compteur total, état vide élégant ; accessible depuis Aujourd'hui
- `app/(app)/today/page.tsx` — badge assignation cliquable sur chaque card de tâche (bulle d'initiales colorée, icône 👥 si non assignée)
- `app/(app)/today/page.tsx` — `AssignSheet` bottom sheet : liste tous les membres du foyer (vrais + fantômes) + option "Foyer" (désassigner) ; coche sur l'assigné courant ; mise à jour DB immédiate via `updateTask`
- `app/(app)/today/page.tsx` — lien "📅 Cette semaine →" entre Sur le radar et Check-in du soir
- `docs/SPEC_V1_YOVA.md` — planning ❌ lourd remplacé par vue `/week` légère (liste 7 jours, read-only, pas de grille calendrier)

### Décision produit
- **Assignation optionnelle (Option A)** : chaque tâche a un assigné facultatif (vrai user ou membre fantôme) ; pas de score d'équité ; l'icône foyer 👥 signifie "n'importe qui peut le faire"
- **Vue semaine maintenant, pas en V2** : Barbara a besoin de voir son planning pour se coordonner avec Jonathan — la confiance dans Yova nécessite une soupape de vérification

### Pilier spec
- Pilier 1 — Connaissance intime du foyer (Yova sait qui fait quoi)
- Pilier 3 — Proactivité douce (Barbara voit sa semaine d'un coup d'œil)

---

## [2026-04-22] — Sprint 5 : Hotfixes live testing + Deepgram STT

### Ajouté
- `app/api/voice/transcribe/route.ts` — NEW : proxy Deepgram STT (nova-2, FR, smart_format, numerals=true) ; timeout 15s AbortController ; fallback gracieux si `DEEPGRAM_API_KEY` absente
- `app/(app)/onboarding/page.tsx` — generating screen : logo Y pulsant + points orbitaux, messages cyclants, "ça prend du temps" après 20s ; `generateError` affiché avec bouton Réessayer
- `app/(app)/onboarding/page.tsx` — collecte des adultes du foyer : Yova demande les prénoms des autres adultes → `phantom_members` de type `adult`
- `app/api/onboarding/chat/route.ts` — chips allergies auto : si Claude pose une question sur les allergies, chips `[Aucune allergie 👍|On a des allergies]` injectés automatiquement

### Modifié
- `app/(app)/onboarding/page.tsx` — double message Yova corrigé : guard `step === 'consent'` empêche double appel `startConversation()`
- `app/(app)/onboarding/page.tsx` — fin d'onboarding : navigation auto vers `/today` après 1,5 s (suppression bouton intermédiaire)
- `app/(app)/onboarding/page.tsx` — micro : MediaRecorder → `/api/voice/transcribe` + fallback Web Speech API ; banner orange "🎤 Vérifie la transcription" après dictée
- `app/api/onboarding/chat/route.ts` — fréquences alignées sur la contrainte DB CHECK : suppression `every_other_day` / `twice_weekly` / `bimonthly`, ajout `semiannual` / `once`
- `app/api/onboarding/chat/route.ts` — timeout AbortController 30s sur l'appel Claude
- `app/api/onboarding/create-tasks/route.ts` — validation strict + déduplication par nom : fréquence/durée/effort hors contrainte remplacés par défaut, doublons ignorés
- `app/(auth)/household/page.tsx` — bouton "Créer le foyer" désactivé tant que `isInitialized === false` (fix race condition authStore)
- `app/(auth)/register/page.tsx` — champ "Confirmer le mot de passe" : label et placeholder visibles
- `app/(app)/family/page.tsx` — titre `"Notre famille"` → `"Notre foyer"` ; suppression code mort ; modal de confirmation avant suppression d'un fait mémoire
- `app/(app)/today/page.tsx` — `fetchTasks` appelé après "Reporter demain" (liste rafraîchie immédiatement)
- `app/(app)/journal/page.tsx` — brouillon sauvegardé dans `localStorage` (survit aux navigations)
- `app/api/ai/parse-journal/route.ts` — filtre strict : seuls les messages `role: user/assistant` avec `content: string` envoyés à Claude

### Fix critique
- **Contrainte DB `frequency`** : Claude générait `every_other_day` / `twice_weekly` → erreur 500. Fix : prompt + validation côté serveur.
- **Spin infini** : erreurs de `persistTasks` silencieuses → `generateError` state visible sur l'écran de génération.

### Requis (action Jonathan)
- Ajouter `DEEPGRAM_API_KEY` dans les variables d'environnement Vercel pour activer la transcription Deepgram

---

## [2026-04-22] — Sprint 4 : Onboarding agent Claude (conversation libre)

### Modifié
- `app/(app)/onboarding/page.tsx` — rewrite : Claude pilote la conversation de bout en bout, questions adaptées au foyer, chips optionnelles, 4-8 échanges selon la complexité
- `app/api/onboarding/chat/route.ts` — nouvelle route : loop Claude stateless, détecte YOVA_DONE, génère les tâches calibrées dans la réponse finale, parse les chips [opt1|opt2]

### Supprimé (absorbé)
- `/api/onboarding/generate-tasks` — plus nécessaire, Claude génère les tâches directement dans la réponse finale de /api/onboarding/chat

### Pilier spec
- Pilier 1 — Connaissance intime (Claude extrait le contexte naturellement)
- Pilier 4 — Mode crise (énergie=low → tâches vitales uniquement)

### À valider
- Test sur device réel (Jonathan) avant merge → main

---

## [2026-04-22] — Sprint 3 : Onboarding conversationnel Yova

### Ajouté
- `app/(app)/onboarding/page.tsx` — rewrite complet : onboarding conversationnel chat-style (11 questions, chips + texte libre), remplace le formulaire multi-étapes + catalogue statique
- `app/api/onboarding/generate-tasks/route.ts` — Claude Haiku génère 12-18 tâches calibrées (énergie, état courses/lessive/dîner, équipements, enfants, aides extérieures)
- Calibration J0 : courses faites→+5j, lessive faite→+4j, dîner prévu→demain pour repas
- Fallback catalogue statique si Claude timeout ou erreur

### Modifié
- `app/api/onboarding/create-tasks/route.ts` — accepte `householdMeta` et upsert dans `household_profile` (energy_level, external_help)

### Pilier spec
- Pilier 1 — Connaissance intime du foyer (calibrage J0 précis)
- Pilier 4 — Mode crise (energy=low → périmètre réduit aux tâches vitales)
- Spec : `docs/SPEC_V1_YOVA.md` §Onboarding

### Renommé
- Onglet "Famille" → **"Foyer"** dans la nav bar (`app/(app)/layout.tsx`) — plus inclusif (solo, couple, coloc)
- `docs/SPEC_V1_YOVA.md` mis à jour en conséquence (toutes occurrences)

### À valider
- Test sur device réel (Jonathan) avant merge → main

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
