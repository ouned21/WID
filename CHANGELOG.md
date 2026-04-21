# Changelog Yova

Toutes les évolutions notables sont listées ici. Une entrée par release (merge main).

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/). Versionning : `AAAA-MM-JJ` (calendar versioning, one bump per merged sprint).

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
