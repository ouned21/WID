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
  global_score: number | null; // score global calculé (2-36)
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
  completed_at: string;
  mental_load_score: number | null;
  duration_minutes: number | null;
  note: string | null;
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
