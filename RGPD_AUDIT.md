# Audit RGPD — FairShare / WID / Aura
**Date de l'audit** : 16 avril 2026  
**Auditeur** : Analyse automatisée (Claude)  
**Responsable de traitement** : Jonathan (fondateur solo)  
**Application** : Aura — suivi des tâches ménagères pour couples/familles  
**Stack** : Next.js 16, Supabase (PostgreSQL), Claude API (Anthropic), Vercel  

---

## 1. Registre de traitement (Article 30 RGPD)

### Traitements identifiés

| # | Finalité | Données traitées | Base légale | Durée de conservation |
|---|----------|-----------------|-------------|----------------------|
| T1 | Authentification et gestion du compte | Email, mot de passe (bcrypt), UUID | Exécution du contrat (Art. 6.1.b) | Durée de vie du compte + 30 jours |
| T2 | Gestion du profil utilisateur | Prénom (display_name), statut premium, compteurs IA | Exécution du contrat (Art. 6.1.b) | Durée de vie du compte |
| T3 | Gestion du foyer | Nom du foyer, invite_code, liste des membres | Exécution du contrat (Art. 6.1.b) | Durée de vie du compte |
| T4 | Suivi des tâches ménagères | Nom des tâches, catégorie, fréquence, assignation, durée, scores | Exécution du contrat (Art. 6.1.b) | Durée de vie du compte |
| T5 | Historique des complétions | Tâche complétée, qui, quand, durée, notes, méthode | Exécution du contrat (Art. 6.1.b) | 3 ans glissants |
| T6 | Journal conversationnel (IA) | Texte libre en langage naturel, humeur (mood_tone), parsing IA | Consentement (Art. 6.1.a) — fonctionnalité optionnelle | 2 ans glissants |
| T7 | Préférences personnelles | Tâches aimées/détestées, créneaux horaires, jours indisponibles, note libre | Consentement (Art. 6.1.a) | Durée de vie du compte |
| T8 | Patterns comportementaux | Heure préférée, cadence, affinités par catégorie, mémoire IA | Intérêt légitime (Art. 6.1.f) — amélioration du service | 2 ans glissants |
| T9 | Logs d'usage IA | Tokens, coût USD, endpoint, modèle, statut, métadonnées | Intérêt légitime (Art. 6.1.f) — facturation et lutte contre les abus | 1 an glissant |
| T10 | Événements d'usage fonctionnel | Nom de l'événement, catégorie, métadonnées | Intérêt légitime (Art. 6.1.f) — amélioration UX | 1 an glissant |
| T11 | Membres fantômes | Prénom, part cible, lien vers profil réel | Exécution du contrat (Art. 6.1.b) — représentation de tiers non-utilisateurs | Durée de vie du compte créateur |
| T12 | Échanges de tâches | Proposant, destinataire, tâche, message, statut | Exécution du contrat (Art. 6.1.b) | 1 an glissant |

### Manquements Article 30
- **CRITIQUE** : Aucun registre de traitement formalisé n'existe (obligatoire dès le traitement de données de personnes physiques, même pour les TPE/solo)
- Pas de responsable désigné avec coordonnées formelles
- Recommandation : créer un document registre_traitement.xlsx à conserver en interne

---

## 2. Base légale (Article 6 RGPD)

### Analyse par traitement
- **Compte + profil + foyer + tâches + complétions** → Base : **Exécution du contrat** ✅ (le service ne peut pas fonctionner sans ces données)
- **Journal conversationnel (texte libre)** → Base : **Consentement** ⚠️ — L'utilisateur doit être informé que son texte libre sera envoyé à Anthropic. Actuellement aucun bandeau ou case à cocher explicite avant la première utilisation du journal.
- **Préférences IA** → Base : **Consentement** ⚠️ — Idem, pas de consentement explicite avant activation
- **Patterns / mémoire IA** → Base : **Intérêt légitime** — Acceptable si l'utilisateur peut s'y opposer (droit d'opposition Art. 21)
- **Logs IA (coût/tokens)** → Base : **Intérêt légitime** — Justifié pour la sécurité et la facturation
- **Événements d'usage** → Base : **Intérêt légitime** — Acceptable pour amélioration du produit

### Manquements base légale
- **CRITIQUE** : Absence de recueil du consentement avant l'envoi des journaux texte libres à l'API Anthropic (Art. 6.1.a + Art. 13 RGPD)
- **MOYEN** : La nature du traitement "patterns comportementaux" (profiling léger) devrait être mentionnée dans la politique de confidentialité
- Recommandation : ajouter un écran de consentement lors de la première utilisation du journal IA

---

## 3. Information des personnes (Articles 13-14 RGPD)

### État actuel
La page `/legal/privacy` existait mais était **incomplète** sur les points suivants :
- ❌ Identité et coordonnées du responsable de traitement non précisées (juste "Aura" sans nom/adresse)
- ❌ Bases légales non détaillées par traitement
- ❌ Durées de conservation non spécifiées
- ❌ Coordonnées DPO/contact RGPD non formalisées
- ❌ Transferts hors UE (Anthropic US, Vercel US) non mentionnés ou insuffisamment détaillés
- ❌ Droits des personnes listés mais procédure concrète d'exercice insuffisante
- ❌ Droit à la portabilité mentionné sans implémentation technique réelle (bouton "exporter")
- ✅ Cookies : correctement traités (uniquement techniques)
- ✅ Supabase EU (Frankfurt) correctement mentionné

### Actions correctives effectuées
- Réécriture complète de `/app/legal/privacy/page.tsx` avec toutes les mentions obligatoires

---

## 4. Droits des personnes (Articles 15-22 RGPD)

| Droit | Article | État avant | État après |
|-------|---------|-----------|-----------|
| Droit d'accès | Art. 15 | Partiel (profil visible dans l'app) | ✅ Export JSON via /api/user/export-data |
| Droit de rectification | Art. 16 | ✅ Possible via l'interface | ✅ Inchangé |
| Droit à l'effacement | Art. 17 | ✅ Route /api/account/delete existante | ✅ Amélioré + documenté |
| Droit à la portabilité | Art. 20 | ❌ Absent | ✅ Implémenté via /api/user/export-data |
| Droit d'opposition | Art. 21 | ❌ Absent | ⚠️ Mentionné dans la politique, à implémenter UI |
| Droit à la limitation | Art. 18 | ❌ Absent | ⚠️ Sur demande par email uniquement |
| Droit contre le profilage | Art. 22 | ❌ Absent | ⚠️ Mentionné, pas de profilage automatisé avec effets juridiques |

---

## 5. Conservation des données (Article 5.1.e RGPD)

### Manquements identifiés
- **CRITIQUE** : Aucune politique de suppression automatique des données n'était implémentée
- Les journaux (texte libre sensible) étaient conservés indéfiniment
- Les logs IA étaient conservés indéfiniment
- Les événements d'usage étaient conservés indéfiniment

### Actions correctives
- Création de `supabase/add_rgpd_retention.sql` avec :
  - Suppression automatique des journaux > 2 ans
  - Suppression automatique des logs IA > 1 an
  - Suppression automatique des événements d'usage > 1 an
  - Suppression automatique des échanges de tâches expirés > 1 an
  - Fonction de nettoyage mensuel activable via pg_cron

---

## 6. Sous-traitants (Article 28 RGPD)

### Inventaire des sous-traitants

| Sous-traitant | Pays | Type de données | Garanties RGPD |
|--------------|------|----------------|----------------|
| **Supabase Inc.** | US (hébergement AWS Frankfurt, DE) | Toutes les données utilisateurs | ✅ Clauses contractuelles types (CCT) + DPA disponible. Hébergement EU. |
| **Anthropic PBC** | US | Journaux texte libre, noms de tâches, prénoms membres | ⚠️ Politique zéro-rétention API (les données ne servent pas à l'entraînement). DPA disponible sur demande. Transfert US sous CCT à vérifier. |
| **Vercel Inc.** | US | Logs applicatifs, variables d'environnement | ⚠️ DPA Vercel disponible. Edge Network EU disponible. Logs applicatifs potentiellement US. |

### Manquements sous-traitants
- **MOYEN** : DPA (Data Processing Agreement) avec Anthropic non formellement signé
- **MOYEN** : DPA avec Vercel non formellement signé
- **INFO** : Supabase DPA applicable automatiquement selon leurs CGV
- Recommandation : télécharger et conserver les DPA Anthropic et Vercel

### Transferts hors UE (Article 46 RGPD)
Les données de journaux texte libre transitent vers les serveurs Anthropic aux États-Unis. Le mécanisme de transfert applicable est :
- Les **Clauses Contractuelles Types (CCT)** de la Commission Européenne, intégrées dans les CGV d'Anthropic
- A défaut, l'**exception pour exécution du contrat** (Art. 49.1.b) peut s'appliquer ponctuellement
- **Recommandation** : vérifier et documenter les CCT avec Anthropic avant de dépasser 100 utilisateurs

---

## 7. Cookies et traceurs (Directive ePrivacy)

### Analyse de l'app
- **Cookies de session Supabase** : `sb-*` cookies — cookies techniques strictement nécessaires → **pas de consentement requis** ✅
- **Aucun cookie analytics** (pas de Google Analytics, Mixpanel, etc.) ✅
- **Aucun cookie publicitaire** ✅
- **localStorage** : utilisé pour le style du dashboard (`dashboard-style`) — donnée non-personnelle ✅

### Conclusion cookies
**Aucun bandeau de consentement cookies n'est requis** pour l'état actuel de l'app. Les seuls cookies sont techniques/nécessaires (session Supabase). Si Analytics est ajouté dans le futur, un bandeau devra être implémenté.

---

## 8. Violations de données (Articles 33-34 RGPD)

### État actuel
- **CRITIQUE** : Aucune procédure de notification de violation n'existe
- Pas de logging de sécurité centralisé
- Pas de détection d'intrusion

### Procédure minimale à mettre en place (non implémenté dans ce sprint)
1. **Détection** : surveiller les logs Vercel et Supabase pour détecter les accès anormaux
2. **Évaluation** : dans les 24h, évaluer la nature, l'étendue et les risques de la violation
3. **Notification CNIL** : dans les **72 heures** via le portail notifications.cnil.fr (si risque pour les droits/libertés)
4. **Notification aux personnes** : si risque élevé, notification individuelle sans délai
5. **Documentation** : registre des violations tenu à la disposition de la CNIL (Art. 33.5)

### Contact CNIL
- Portail : https://notifications.cnil.fr
- Téléphone : 01 53 73 22 22

---

## 9. Résumé des priorités

### CRITIQUE (à traiter immédiatement)
- [x] Politique de confidentialité complète et conforme (réécrite)
- [x] Droit à la portabilité implémenté (export JSON)
- [x] Durées de rétention sur les données sensibles (SQL migration)
- [ ] Consentement explicite avant première utilisation du journal IA (à faire dans sprint suivant)
- [ ] Registre de traitement interne (document Excel/Word)

### MOYEN (à traiter dans les 3 mois)
- [ ] Signer formellement les DPA Anthropic et Vercel
- [ ] Mettre en place pg_cron pour les suppressions automatiques
- [ ] Ajouter un écran d'onboarding avec acceptation des CGU/politique de confidentialité
- [ ] Droit d'opposition implémenté dans l'UI (paramètre pour désactiver les patterns)

### INFO (améliorations souhaitables)
- [ ] Procédure de violation de données documentée
- [ ] Logs de sécurité centralisés
- [ ] Enregistrement DPD (optionnel pour une structure solo sans DPO obligatoire)
- [ ] Mise à jour annuelle de l'audit RGPD

---

## 10. Note sur l'obligation de DPO

Pour une structure solo sans traitement à grande échelle ni données sensibles (au sens Art. 9), la **désignation d'un DPO (Délégué à la Protection des Données) n'est pas obligatoire**. Jonathan est de facto le responsable de traitement. L'adresse `privacy@fairshare.app` (ou `privacy@aura.app`) suffit comme point de contact RGPD.

---

*Document généré automatiquement — à valider par un juriste avant démarche CNIL*
