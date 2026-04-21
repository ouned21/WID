# Changelog Yova

Toutes les évolutions notables sont listées ici. Une entrée par release (merge main).

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/). Versionning : `AAAA-MM-JJ` (calendar versioning, one bump per merged sprint).

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
