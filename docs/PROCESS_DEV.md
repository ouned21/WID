# Process de développement Yova V1

> Process pro, solo-dev avec assistant IA, avec validations intermédiaires pour consolider chaque étape.
> Dernière mise à jour : 2026-04-21

---

## 🎯 Principes

1. **Un sprint = un incrément livrable et testable**. Pas de chantier qui traîne 3 semaines sans démo.
2. **Validation humaine à chaque fin de sprint** (Jonathan teste → go/no-go).
3. **Pas de merge `main` sans démo validée**.
4. **Tout est documenté au fil de l'eau** (SPEC_V1_YOVA.md = source de vérité, PROCESS_DEV.md = comment on bosse).
5. **Non-régression non négociable** : l'app actuelle doit rester utilisable pendant le pivot.

---

## 🔁 Cycle d'un sprint (1-2 semaines)

### Étape 1 — Kick-off (30 min)
- Revue du sprint précédent (rétro 5 min : ce qui a marché, ce qui a bloqué)
- Sélection du prochain sprint (ref. roadmap dans SPEC_V1_YOVA.md)
- Définition du **scope exact** (liste des items, périmètre fermé)
- Définition du **critère de succès** (démo X fonctionne sans bug sur cas Y)
- Création d'une **branche dédiée** : `feat/sprint-N-nom-court`

### Étape 2 — Build (3-8 jours)
- Code + tests unitaires sur la logique critique
- Commits petits, atomiques, messages clairs
- Push quotidien vers la branche (pas direct sur main)
- Déploiement automatique en **preview Vercel** (branch preview, URL temporaire)
- **Jonathan teste la preview** dès qu'une brique est prête (pas en fin de sprint)

### Étape 3 — Revue qualité (1 jour)
- Pass auto : TypeScript build OK, lint OK, tests auto OK
- Revue manuelle du diff par Jonathan (ou demande d'explication à Claude)
- Tests de non-régression sur les chemins critiques (voir `PLAN_TESTS_PRE_BARBARA.xlsx`)

### Étape 4 — Démo + validation (30 min)
- Démo sur le device réel de Jonathan (pas juste en dev local)
- Go → merge sur main (déploiement prod auto)
- No-go → ticket d'ajustement, on reprend étape 2

### Étape 5 — Documentation (15 min)
- Mise à jour du `CHANGELOG.md` (nouveau fichier à créer)
- Mise à jour SPEC_V1_YOVA.md si le périmètre a bougé
- Mise à jour plan de test si nouveaux cas à tester

---

## 🌳 Stratégie de branches

```
main                     ← prod (Vercel déploie auto)
  │
  ├── feat/sprint-1-member-profiles    ← sprint 1
  ├── feat/sprint-2-today-screen       ← sprint 2
  ├── feat/sprint-3-memory-facts       ← sprint 3
  └── fix/xxx                          ← hotfix quand besoin
```

**Règles** :
- Jamais de push direct sur `main`
- Une branche = un sprint (ou un hotfix)
- Les branches sprint vivent en **preview Vercel** (URL temporaire) jusqu'au merge
- Merge main = squash + message descriptif

---

## 🚦 Feature flags (pour les gros changements)

Quand un sprint casse l'UX (ex: nav 4→3 onglets), on met un **feature flag** :

```tsx
// lib/flags.ts
export const FLAGS = {
  newNav3Tabs: process.env.NEXT_PUBLIC_FLAG_NEW_NAV === 'true',
  cristalMemory: process.env.NEXT_PUBLIC_FLAG_CRISTAL_MEMORY === 'true',
};
```

- Branche merge sur main avec flag **OFF** par défaut
- On teste en prod avec flag **ON** pour Jonathan + Barbara
- On active pour tous les users quand stable (env var Vercel)

Avantage : on peut merger souvent sans casser les users existants.

---

## ✅ Checklist pre-merge (à copier sur chaque PR)

- [ ] Build Next.js OK (`pnpm build`)
- [ ] Aucune erreur TypeScript
- [ ] Aucune régression sur les flows critiques (auth, onboarding, tâche fait)
- [ ] Plan de test mis à jour si nouveaux cas
- [ ] SPEC_V1_YOVA.md mis à jour si scope changé
- [ ] Feature flag posé si le changement peut casser l'UX existante
- [ ] Démo OK sur device réel (pas juste localhost)
- [ ] Jonathan valide go

---

## 🧪 Tests

### Tests automatiques (minimum)
- **Unit** : logique métier critique (scoring, extraction IA, détection dérives)
- **Integration** : auth, création tâche, check-in vocal (quand présent)
- **E2E** : pas prioritaire en V1 (trop de friction pour solo-dev)

### Tests manuels (principal)
- `docs/PLAN_TESTS_PRE_BARBARA.xlsx` — 278 cas, maintenu à jour à chaque sprint
- Checklist de non-régression à chaque merge
- Test sur device réel (iOS Safari, Android Chrome)

---

## 📐 Standards de code

- **TypeScript strict** (no `any` sauf justifié)
- **Conventions Next.js 16** (App Router, Server Components par défaut, Client Components explicites)
- **Naming** : composants PascalCase, hooks camelCase `useXxx`, utils camelCase
- **Structure fichiers** : 1 composant = 1 fichier, < 300 lignes idéal
- **Commits** : [Conventional Commits](https://www.conventionalcommits.org/)
  - `feat:` nouvelle feature
  - `fix:` bug fix
  - `refactor:` réorganisation sans changement fonctionnel
  - `docs:` documentation
  - `chore:` maintenance, configs

---

## 📝 Documentation vivante

3 docs principaux à maintenir :

| Doc | Rôle | Qui le maintient |
|-----|------|------------------|
| `SPEC_V1_YOVA.md` | **La** référence produit. Toute feature V1 est tracée ici. | À jour fin de sprint |
| `PROCESS_DEV.md` | Comment on bosse (ce doc). Rarement modifié. | Ad hoc |
| `CHANGELOG.md` | Ce qui change à chaque release. | À chaque merge main |

---

## 🏃 Sprint 1 — Kick-off

**Nom** : `feat/sprint-1-member-profiles`
**Durée estimée** : 3-5 jours
**Objectif** : fiches membres enrichies (enfants âges/contraintes adultes)

**Scope** :
- Migration BDD : `household_members` étendu (birth_date, role, school_class, specifics jsonb) + nouvelle table `household_profile` (energy_level, current_life_events, external_help, crisis_mode_active)
- UI `Famille` (ou fallback `Profile`) : fiches membres enrichies avec formulaire édition
- UI : bloc « Contexte actuel du foyer » (energy_level, events, aides externes)
- Onboarding famille : champs âges enfants, contraintes adultes
- Préserver le reste de l'app (nav 4 onglets existante, dashboard, tâches)

**Critère de succès** :
- Je peux ajouter « Léa, 7 ans, allergie aux arachides, cours de danse mercredi »
- Je peux marquer « energy_level = low » pour le foyer
- Barbara et moi voyons la même chose
- Les autres fonctions existantes (tâches, journal, etc.) n'ont pas bougé
- Démo sur device réel OK

**Branch** : `feat/sprint-1-member-profiles`
**Feature flag** : pas nécessaire (extension, pas de régression UX)

---

## 🎭 Rôles et responsabilités

| Qui | Fait quoi |
|-----|-----------|
| **Jonathan** | Vision produit, priorisation, validation démo, tests sur device réel, décisions stratégiques |
| **Claude (Sonnet)** | Implémentation code, debug, docs, migrations, tests manuels techniques |
| **Claude (Opus)** | Sollicité ponctuellement sur décisions produit majeures ou bugs complexes |
| **Barbara** | Beta-testeuse du foyer (sprint 5+) |

### ⚠️ Ce que Jonathan NE tranche PAS (kick-off sprint & en cours de route)

Jonathan n'est **pas** là pour arbitrer des questions techniques. Ne jamais lui poser :
- Choix d'implémentation (quelle table, quelle colonne, quel hook, quel fichier toucher)
- Choix d'architecture ou de refacto
- Choix de lib/dép/framework
- Stratégies de test unitaire ou de structure de code
- Nommage de variables, de fonctions, de routes API

Ces décisions reviennent à Claude, qui les prend en s'appuyant sur SPEC_V1_YOVA.md, AGENTS.md et le code existant.

Jonathan tranche uniquement :
- **Design & ergonomie** (ex : 2 boutons vs toggle ? bloquant ou non ?)
- **Fonctionnalité produit** (ex : un check-in abandonné compte-t-il comme fait ?)
- **Utilisation de l'app** (ex : quelle fenêtre temporelle a du sens pour un user en surcharge ?)
- **Priorisation & scope** (ex : on bundle ou on sort de la scope ?)

En kick-off sprint, lister les ambiguïtés produit/UX **uniquement**. Formuler les questions côté user, pas côté code (❌ "on ajoute une colonne `last_checkin_at` ou on query `user_journals` ?" → ✅ "un check-in abandonné avant la 3e question compte-t-il comme fait ?").
