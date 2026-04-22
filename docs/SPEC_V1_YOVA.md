# Yova V1 — Spec produit

> **Doc de référence épinglé.** Toute feature V1 doit être traçable à cette spec.
> Dernière mise à jour : 2026-04-22

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
- 📅 **"Cette semaine"** (`/week`) — vue légère 7 jours, groupée par jour, avec badges assignation foyer. Coordination entre adultes (Barbara voit ce qui lui est assigné cette semaine). Read-only, pas de drag & drop.

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

**Génération** : Claude Haiku avec tout le contexte → 10-20 tâches JSON avec `next_due_at` calibré.
**Fallback** : catalogue statique si Claude timeout.
**Sauvegarde** : conversation → `conversation_turns` (première mémoire Yova).

### On RETIRE de la nav (code archivé, pas supprimé)
- Score 4 axes (plus visible par défaut)
- Dashboard/Distribution
- Planning calendrier semaine → remplacé par vue légère `/week` (liste 7 jours, pas de grille)

### On AJOUTE
- Fiches membres enrichies (enfants âges/contraintes)
- Table `household_profile` (contexte foyer)
- Table `observations` + jobs détection
- Table `agent_memory_facts` + pgvector embeddings
- Surface « Parler à Yova » avec vocal (STT + TTS)
- Mode crise (toggle manuel V1, automatisation V2)

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

### Mois 3 — Parler à Yova (vocal)
- Surface chat + vocal (STT + TTS)
- Check-in du soir guidé
- Historique conversations
- **Livrable** : rituel vocal du soir fonctionnel

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

- ❌ Score d'équité / dashboard analytique (plus dans l'ADN)
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
