// =============================================================================
// Types alignes sur le schema Supabase (Sprints 1-4)
// =============================================================================

/** Frequences de recurrence des taches */
export type Frequency =
  | 'daily'
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'quarterly'
  | 'semiannual'
  | 'yearly'
  | 'once'
  | 'custom';

/** Role d'un membre dans un foyer */
export type HouseholdRole = 'admin' | 'member';

// -----------------------------------------------------------------------------
// Tables principales
// -----------------------------------------------------------------------------

export type Profile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  household_id: string | null;
  role: HouseholdRole | null;
  joined_at: string | null;
  notification_token: string | null;
  left_at: string | null;
  vacation_mode: boolean;
  vacation_started_at: string | null;
  target_share_percent: number | null; // Objectif de répartition (ex: 50 = vise 50%)
  // ── Premium + rate limit IA ──
  is_premium: boolean;
  premium_until: string | null;
  ai_calls_this_month: number;
  ai_calls_month_reset: string | null;
  // ── Consentement RGPD ──
  ai_journal_consent_at: string | null; // Date du consentement explicite pour le journal IA
  // ── Check-in du soir (sprint 15) ──
  last_checkin_at: string | null; // Dernier message journal envoyé en fenêtre 20h-04h (masque la CTA /today)
  created_at: string;
  updated_at: string;
};

export type Household = {
  id: string;
  name: string;
  invite_code: string;
  invite_code_expires_at: string | null;
  is_active: boolean;
  created_by: string;
  created_at: string;
};

export type TaskCategory = {
  id: string;
  name: string;
  icon: string;
  color_hex: string;
  sort_order: number;
};

export type TaskTemplate = {
  id: string;
  category_id: string;
  name: string;
  default_frequency: Frequency;
  default_mental_load_score: number;
  // Colonnes enrichies (scoring V2 + récap du soir)
  scoring_category: string | null;
  default_duration: string | null;
  default_physical: string | null;
  typical_time: string | null; // 'matin' | 'midi' | 'soir' | 'flexible'
  description: string | null;
  sort_order: number | null;
};

export type HouseholdTask = {
  id: string;
  household_id: string;
  name: string;
  category_id: string;
  frequency: Frequency;
  assigned_to: string | null;
  mental_load_score: number; // ancien score 0-5, conservé pour compatibilité
  duration_estimate: string | null; // very_short, short, medium, long, very_long
  physical_effort: string | null; // none, light, medium, high
  scoring_category: string | null; // catégorie de scoring (children, meals, etc.)
  user_score: number | null; // score choisi par l'utilisateur (0-10), pré-rempli par l'algo
  assigned_to_phantom_id: string | null; // assigné à un membre fantôme
  is_fixed_assignment: boolean; // true = toujours assignée à la même personne
  notifications_enabled: boolean; // false = pas de rappels pour cette tâche
  estimated_cost: number | null; // coût estimé en euros (optionnel)
  next_due_at: string | null;
  is_active: boolean;
  created_by: string;
  created_at: string;
  // Sprint 12 — décomposition de projets : FK self-ref vers la tâche parent.
  // NULL pour une tâche normale OU pour le parent lui-même. Un parent est
  // reconnu à l'UI par : au moins une row référence son id via parent_project_id.
  parent_project_id?: string | null;
};

export type TaskCompletion = {
  id: string;
  task_id: string;
  completed_by: string;
  completed_by_phantom_id: string | null; // si complété au nom d'un membre fantôme
  completed_at: string;
  mental_load_score: number | null;
  duration_minutes: number | null;
  note: string | null;
};

/** Membre fantôme — membre du foyer sans compte (partenaire, enfant…) */
export type PhantomMember = {
  id: string;
  household_id: string;
  display_name: string;
  target_share_percent: number | null;
  created_by: string;
  linked_profile_id: string | null;
  // ── Sprint 1 : fiches membres enrichies ──
  member_type: 'adult' | 'child' | 'other';
  birth_date: string | null;       // ISO date 'YYYY-MM-DD'
  school_class: string | null;     // ex: 'CP', 'CE1', '6ème'
  specifics: PhantomMemberSpecifics;
  created_at: string;
};

/** Données libres enrichies d'un membre fantôme */
export type PhantomMemberSpecifics = {
  allergies?: string[];
  activities?: { name: string; day?: string; time?: string }[];
  bedtime_routine?: string;
  notes?: string;
};

/** Contexte vivant du foyer (énergie, événements, aides, mode crise) */
export type HouseholdProfile = {
  household_id: string;
  energy_level: 'low' | 'medium' | 'high';
  current_life_events: string[];
  external_help: ExternalHelp[];
  crisis_mode_active: boolean;
  crisis_started_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

/** Aide externe disponible pour le foyer */
export type ExternalHelp = {
  type: 'grandparent' | 'nanny' | 'au_pair' | 'cleaner' | 'other';
  label?: string;    // libellé custom ex: 'Mamie Jacqueline'
  freq?: string;     // ex: 'weekly', 'twice_a_week'
  days?: string[];   // ex: ['lun', 'mer']
};

/** Type unifié pour l'UI — un membre est soit un vrai profil, soit un fantôme */
export type HouseholdMember = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  isPhantom: boolean;
  target_share_percent: number | null;
  vacation_mode: boolean;
};

/** Préférences explicites d'un utilisateur (personnalisation IA) */
export type UserPreferences = {
  id: string;
  user_id: string;
  hated_tasks: string[];
  loved_tasks: string[];
  preferred_time_slot: 'morning' | 'evening' | 'weekend' | 'flexible';
  unavailable_days: number[]; // 0=dim, 1=lun, ..., 6=sam
  load_preference: 'light' | 'balanced' | 'heavy';
  freeform_note: string | null;
  created_at: string;
  updated_at: string;
};

/** Entrée de journal conversationnel (raconte-moi ta journée) */
export type UserJournal = {
  id: string;
  user_id: string;
  household_id: string;
  raw_text: string;
  input_method: 'text' | 'voice';
  parsed_completions: ParsedCompletion[];
  unmatched_items: string[];
  ai_response: string | null;
  tokens_input: number;
  tokens_output: number;
  cost_usd: number;
  model_used: string;
  processing_time_ms: number;
  error: string | null;
  mood_tone: 'happy' | 'tired' | 'overwhelmed' | 'satisfied' | 'frustrated' | 'neutral' | null;
  created_at: string;
};

/** Complétion parsée depuis un journal */
export type ParsedCompletion = {
  task_id: string;
  task_name: string;
  completed_by: string | null;        // user_id si match, null = fantôme
  completed_by_phantom_id?: string | null;
  duration_minutes: number | null;
  note: string | null;
  confidence: number;                  // 0.0 à 1.0
};

/** Fait mémorisé par Yova sur un membre ou le foyer */
export type AgentMemoryFact = {
  id: string;
  household_id: string;
  about_user_id: string | null;
  about_phantom_id: string | null;
  fact_type: 'preference' | 'pattern' | 'context' | 'tension' | 'milestone';
  content: string;
  confidence: number;
  source_journal_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

/** Log d'appel IA (pour tracking coûts et usage) */
export type AiTokenUsage = {
  id: string;
  user_id: string;
  household_id: string | null;
  endpoint: string;
  model: string;
  tokens_input: number;
  tokens_output: number;
  cost_usd: number;
  duration_ms: number;
  status: 'success' | 'error' | 'rate_limited' | 'premium_required';
  error_message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

// ── Sprint 5 ──────────────────────────────────────────────────────────────

/** Observation détectée par Yova (dérive douce, alerte constructive) */
export type ObservationType =
  | 'cooking_drift'
  | 'balance_drift'
  | 'journal_silence'
  | 'task_overdue_cluster';

export type ObservationSeverity = 'info' | 'notice' | 'alert';

export type Observation = {
  id: string;
  household_id: string;
  type: ObservationType;
  severity: ObservationSeverity;
  payload: Record<string, unknown>;
  detected_at: string;
  user_acknowledged_at: string | null;
  user_action_taken: string | null;
  created_at: string;
};

/** Patterns appris sur un utilisateur */
export type UserPatterns = {
  id: string;
  user_id: string;
  preferred_completion_hour: number | null;
  avg_tasks_per_day: number | null;
  most_active_day: number | null;
  category_affinity: Record<string, number>;
  avg_duration_by_category: Record<string, number>;
  completion_streak_days: number;
  longest_streak_days: number;
  ai_memory_summary: string | null;
  ai_memory_updated_at: string | null;
  updated_at: string;
  created_at: string;
};

// -----------------------------------------------------------------------------
// Types denormalises pour l'UI (prets a afficher, pas de join cote composant)
// -----------------------------------------------------------------------------

/** Tache avec sa categorie, son assignee et sa derniere completion */
export type TaskListItem = HouseholdTask & {
  category: TaskCategory;
  assignee: Pick<Profile, 'id' | 'display_name' | 'avatar_url'> | null;
  last_completion: (TaskCompletion & {
    completed_by_profile: Pick<Profile, 'id' | 'display_name' | 'avatar_url'> | null;
  }) | null;
};

/** Sections de tâches pour l'écran principal */
export type TaskSections = {
  overdue: TaskListItem[];
  today: TaskListItem[];
  tomorrow: TaskListItem[];
  week: TaskListItem[];
  later: TaskListItem[];
};

/** Filtres de la vue taches */
export type TaskFilters = {
  categoryId: string | 'all';
  assignment: 'all' | 'mine';
};

/** Statut d'un échange de tâches */
export type TaskExchangeStatus = 'pending' | 'accepted' | 'refused' | 'expired';

/** Proposition d'échange de tâches entre membres */
export type TaskExchange = {
  id: string;
  household_id: string;
  /** Membre qui propose l'échange */
  proposed_by: string;
  /** Membre à qui la proposition est faite */
  proposed_to: string;
  /** Tâche proposée à l'échange */
  task_id: string | null;
  status: TaskExchangeStatus;
  message: string | null;
  created_at: string;
  responded_at: string | null;
};

/** Échange enrichi pour l'UI */
export type TaskExchangeWithDetails = TaskExchange & {
  proposer: Pick<Profile, 'id' | 'display_name'>;
  recipient: Pick<Profile, 'id' | 'display_name'>;
  task: Pick<HouseholdTask, 'id' | 'name'> | null;
};

/** Resume analytics par membre */
export type MemberAnalytics = {
  memberId: string;
  displayName: string;
  taskCount: number;
  taskPercentage: number;
  totalMentalLoad: number;
  mentalLoadPercentage: number;
};
