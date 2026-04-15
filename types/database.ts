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
  template_id: string | null;
  name: string;
  category_id: string;
  frequency: Frequency;
  custom_interval_days: number | null;
  assigned_to: string | null;
  mental_load_score: number; // ancien score 0-5, conservé pour compatibilité
  duration_estimate: string | null; // very_short, short, medium, long, very_long
  physical_effort: string | null; // none, light, medium, high
  scoring_category: string | null; // catégorie de scoring (children, meals, etc.)
  score_breakdown: Record<string, unknown> | null; // ScoreBreakdown JSON
  global_score: number | null; // score global calculé par l'algo (2-36)
  user_score: number | null; // score choisi par l'utilisateur (0-10), pré-rempli par l'algo
  assigned_to_phantom_id: string | null; // assigné à un membre fantôme
  is_fixed_assignment: boolean; // true = toujours assignée à la même personne
  notifications_enabled: boolean; // false = pas de rappels pour cette tâche
  estimated_cost: number | null; // coût estimé en euros (optionnel)
  next_due_at: string | null;
  starts_at: string | null;
  is_active: boolean;
  created_by: string;
  created_at: string;
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

/** Membre fantôme — membre du foyer sans compte */
export type PhantomMember = {
  id: string;
  household_id: string;
  display_name: string;
  target_share_percent: number | null;
  created_by: string;
  linked_profile_id: string | null;
  created_at: string;
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
export type TaskExchangeStatus = 'pending' | 'accepted' | 'rejected' | 'expired';

/** Proposition d'échange de tâches entre membres */
export type TaskExchange = {
  id: string;
  household_id: string;
  from_user_id: string;
  to_user_id: string;
  offered_task_id: string;
  requested_task_id: string;
  status: TaskExchangeStatus;
  created_at: string;
  updated_at: string;
};

/** Échange enrichi pour l'UI */
export type TaskExchangeWithDetails = TaskExchange & {
  from_user: Pick<Profile, 'id' | 'display_name'>;
  to_user: Pick<Profile, 'id' | 'display_name'>;
  offered_task: Pick<HouseholdTask, 'id' | 'name'>;
  requested_task: Pick<HouseholdTask, 'id' | 'name'>;
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
