# Roadmap Yova

Source de vérité unique pour ce qui est fait, ce qui attend, et ce qui est volontairement reporté.
Tenue à jour à chaque commit structurant.

---

## 🟢 Prêt à tester avec Barbara

- [x] Fresh restart BDD propre (29 équipements, 13 catégories, 456 templates, 185 associations)
- [x] Onboarding IA (Claude Haiku via Edge Function Supabase, 150s timeout)
- [x] Fallback catalogue statique si IA échoue
- [x] Dashboard skin **Score** unique (Vivid / Dark / Clean / Galaxy supprimés)
- [x] Page Tâches : chips regroupés Portée + Horizon, liste 1 col, label "Charge"
- [x] Planning : bottom sheet iOS, dates cliquables, deep-link `?date=`
- [x] Création tâche : options avancées repliées, ⓘ tooltips, solo auto-assigné
- [x] Journal : toggle historique, récap dimanche, notif 21h + dimanche 9h
- [x] Catalogue fusionné `/tasks/catalog` (anciens Packs Projets inclus)
- [x] Filtre Tout / Disponibles / Installées, catégories repliables
- [x] Statistiques `/distribution` : Score cumulé = charge complétée, empty states pédagogiques
- [x] Badge Déséquilibre cliquable → `/tasks/rebalance`
- [x] Profil : fondateur foyer, Associer fantôme, tap-copy code, jours Di Lu Ma Me Je Ve Sa, objectif dynamique, accordéon RGPD
- [x] Bouton renouveler le code d'invitation (admin)
- [x] IA journal : scope strict + détection projet logistique + refus sujets hors scope
- [x] Plan de test `PLAN_TESTS_PRE_BARBARA.xlsx` (13 onglets, 245 cas dont 53 cause-effet)
- [x] Nettoyage code legacy (23 fichiers supprimés, -5308 lignes)

---

## 🟡 À développer (features prévues, pas encore branchées)

- [ ] **Wire up `/api/ai/anticipate`** — l'app doit anticiper proactivement et proposer des rééquilibrages. Endpoint existe côté serveur, à brancher au dashboard avec un appel hebdomadaire.
- [ ] **Wire up `/api/ai/insights`** — insights IA hebdomadaires (version Premium de ce que DashboardFree fait côté client).
- [ ] **Wire up `/api/ai/weekly-summary`** — version IA enrichie du récap dimanche (actuellement calculé client-side sans Claude).
- [x] **Décomposition auto des tâches complexes** — déjà en place dans `/tasks/new` : à la création, l'app appelle `/api/ai/subtasks` en fallback du catalogue local. Si Claude retourne ≥ 1 sous-tâche, écran de review avec tout coché par défaut. User peut décocher ou sortir avec "Juste la tâche principale". Polissage UX : carte Yova gradient, toggle Tout cocher/décocher, dates relatives lisibles, opacité sur items décochés.

---

## 🔴 Dette technique (à traiter avant V1 publique)

- [ ] **Fix les 22 `as unknown as never`** — hacks TypeScript autour de `getHouseholdPreferences` et assimilés. Retyper proprement. ~30-45 min. Risque de régression, à faire post-test Barbara.
- [ ] **DROP TABLE `task_exchanges`** — feature supprimée du code mais table encore en base. Migration SQL à écrire + virer la purge défensive dans `/api/account/delete`.
- [ ] **Tests E2E** Cypress ou Playwright — zéro test actuellement (vitest configuré mais seulement 2 fichiers de test).
- [ ] **TypeScript strict mode** — activer `"strict": true` et corriger les retombées.
- [ ] **Accessibilité ARIA** — attributs aria-label sur actions principales, navigation clavier.
- [ ] **Performance** — lazy loading, optimisation images, Lighthouse > 80.
- [ ] **Monitoring Sentry** — aucune alerte sur erreurs prod actuellement.

---

## 💰 Avant lancement commercial

- [ ] **Réactiver les 3 gates freemium** (TODO marqués dans le code — `grep -r "TODO: réactiver"`) :
  - Limite mensuelle IA journal (`FREE_AI_MONTHLY_LIMIT` dans `utils/aiRateLimit.ts`)
  - `requirePremium` dans `utils/aiRateLimit.ts`
  - Limite 1 membre fantôme (`atFreeLimit` dans onboarding)
- [ ] **Stripe** — aucun système de paiement actuellement.
- [ ] **Email confirmation** — désactivé pour les tests, à réactiver côté Supabase Auth.
- [ ] **Domaine** — `yova.app` pris, trouver alternative (`yova.fr` ?).
- [ ] **CGU + Privacy** — pages existent, relecture juridique avant lancement.
- [ ] **Hard delete 30j** — politique de rétention RGPD à vérifier / automatiser.
- [ ] **Export données** — tester le flow complet `/api/user/export-data`.

---

## 🚀 Phase 2 (après lancement)

- [ ] **React Native / Expo** — portage natif iOS/Android pour App Store + Play Store.
- [ ] **Gamification tamagochi** (abandonnée V1, à reconsidérer).
- [ ] **Push notifications natives** — actuellement limitées à la PWA (iOS background peu fiable).
- [ ] **Intégration calendrier** (Google Cal, Apple Cal) — synchro bidirectionnelle.
- [ ] **Multi-foyers** — permettre à un user d'appartenir à plusieurs foyers (parents séparés, colocations multiples).

---

## 📝 Notes de design

**Principes qu'on respecte :**
- **Scope IA strict** : la logistique uniquement. Pas de conseil relationnel/santé/juridique/psy.
- **Score cumulé = charge portée**, pas charge assignée. Barbara arrive à 0, pas à 59.
- **Assigner ≠ faire seul·e** — note pédagogique dans l'onboarding et `/tasks/assign`.
- **Données insuffisantes** : seuil 5 complétions avant d'afficher des tendances.
- **Onboarding = rite d'initiation** unique. Gestion continue du catalogue via `/tasks/catalog`.
