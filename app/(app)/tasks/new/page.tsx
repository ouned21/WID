'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useTaskStore } from '@/stores/taskStore';
import { useHouseholdStore } from '@/stores/householdStore';
import { FREQUENCY_OPTIONS, frequencyLabel } from '@/utils/frequency';
import {
  computeTaskScore,
  DURATION_OPTIONS,
  PHYSICAL_OPTIONS,
  SCORING_CATEGORY_OPTIONS,
  timeLabel,
  physicalLabel,
  mentalLabel,
  impactLabel,
  dominantEmoji,
  type DurationEstimate,
  type PhysicalEffort,
  type TaskCategory as ScoringCategory,
  type ScoreBreakdown,
} from '@/utils/taskScoring';
import { loadTo10, scoreColor10 } from '@/utils/designSystem';
import type { Frequency, TaskCategory } from '@/types/database';
import { inferTaskMetadata } from '@/utils/taskInference';
import { createClient } from '@/lib/supabase';

// ─── Moteur d'autocomplétion intelligent ────────────────────────────────────

/** Supprime les accents pour la comparaison (ménage → menage) */
function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Score de pertinence d'un template pour une requête.
 * Retourne -1 si aucun match. Plus le score est élevé, plus c'est pertinent.
 *
 * Niveaux (ordre décroissant) :
 *   10000 exact · 9000 préfixe · 8000 début-de-mot · 7000 substring · 3000 fuzzy
 * Bonus : popularité foyer (+2000 max) + sort_order global (+500 max)
 */
function scoreTemplate(
  name: string,
  query: string,
  usageCount: number,
  sortOrder: number,
): number {
  const n = normalize(name);
  const q = normalize(query);
  if (!q) return -1;

  let base = 0;

  if (n === q) {
    base = 10000;
  } else if (n.startsWith(q)) {
    base = 9000;
  } else if (n.split(/[\s\-'']/g).some((w) => w.startsWith(q))) {
    base = 8000;
  } else if (n.includes(q)) {
    // Plus c'est tôt dans le nom, meilleur c'est
    base = 7000 - n.indexOf(q) * 10;
  } else {
    // Fuzzy : tous les caractères de la requête présents dans l'ordre
    let qi = 0;
    let streak = 0;
    let best = 0;
    for (let i = 0; i < n.length && qi < q.length; i++) {
      if (n[i] === q[qi]) {
        qi++;
        streak++;
        if (streak > best) best = streak;
      } else {
        streak = 0;
      }
    }
    if (qi < q.length) return -1; // pas de match du tout
    base = 3000 + best * 100;
  }

  // +2000 max selon popularité dans ce foyer
  base += Math.min(usageCount * 400, 2000);
  // +500 max selon popularité globale (sort_order bas = plus populaire)
  base += Math.max(0, 500 - (sortOrder ?? 999));

  return base;
}

/**
 * Retourne des fragments JSX avec les lettres correspondantes en gras.
 * Fonctionne sur le nom original (avec accents) mais match en normalisé.
 */
function highlightMatch(name: string, query: string): React.ReactNode[] {
  const nNorm = normalize(name);
  const qNorm = normalize(query);
  if (!qNorm || !nNorm.includes(qNorm)) {
    // Pour les matches fuzzy / mot-début : on bold juste la query dans le nom si substring simple
    const idx = nNorm.indexOf(qNorm);
    if (idx === -1) return [name];
    return [
      name.slice(0, idx),
      <strong key="m" style={{ color: '#007aff' }}>{name.slice(idx, idx + qNorm.length)}</strong>,
      name.slice(idx + qNorm.length),
    ];
  }
  const idx = nNorm.indexOf(qNorm);
  return [
    name.slice(0, idx),
    <strong key="m" style={{ color: '#007aff' }}>{name.slice(idx, idx + qNorm.length)}</strong>,
    name.slice(idx + qNorm.length),
  ];
}

// ─── Auto-détection de catégorie par mots-clés du titre ─────────────────────

// Auto-détection de catégorie par mots-clés du titre
function detectCategory(title: string): ScoringCategory | null {
  const t = title.toLowerCase();
  if (['école', 'ecole', 'enfant', 'bébé', 'bebe', 'devoirs', 'bain', 'cartable', 'goûter', 'gouter', 'crèche', 'creche', 'nounou'].some(k => t.includes(k))) return 'children';
  if (['dîner', 'diner', 'repas', 'cuisine', 'menu', 'petit-déjeuner', 'déjeuner'].some(k => t.includes(k))) return 'meals';
  if (['courses', 'supermarché', 'magasin', 'acheter', 'stock'].some(k => t.includes(k))) return 'shopping';
  if (['laver', 'nettoyer', 'aspirateur', 'serpillère', 'ménage', 'menage', 'vaisselle', 'décrasser'].some(k => t.includes(k))) return 'cleaning';
  if (['linge', 'machine', 'repasser', 'étendre', 'plier'].some(k => t.includes(k))) return 'laundry';
  if (['ranger', 'rangement', 'trier', 'organiser'].some(k => t.includes(k))) return 'tidying';
  if (['facture', 'impôt', 'assurance', 'banque', 'rdv', 'document', 'dossier', 'paiement', 'administratif'].some(k => t.includes(k))) return 'admin';
  if (['conduire', 'voiture', 'garagiste', 'vidange', 'pneu', 'plein', 'contrôle technique'].some(k => t.includes(k))) return 'vehicle';
  if (['jardin', 'pelouse', 'tondre', 'arroser', 'terrasse', 'poubelle', 'gouttière'].some(k => t.includes(k))) return 'outdoor';
  if (['douche', 'salle de bain', 'toilettes', 'miroir', 'hygiène'].some(k => t.includes(k))) return 'hygiene';
  if (['chien', 'chat', 'animal', 'litière', 'promener', 'vétérinaire', 'nourrir'].some(k => t.includes(k))) return 'pets';
  return null;
}

export default function NewTaskPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profile } = useAuthStore();
  const { createTask, creating } = useTaskStore();
  const { allMembers } = useHouseholdStore();

  // Mode : yova (minimal, laisse l'IA inférer) | advanced (formulaire complet)
  const [mode, setMode] = useState<'yova' | 'advanced'>('yova');
  // Étape dans le mode Yova : 'input' = saisie + preview, 'assign' = swipe assignation
  const [yovaStep, setYovaStep] = useState<'input' | 'assign'>('input');

  // Batch : tâches en attente d'assignation (saisies successivement, assignées en masse)
  type PendingTask = {
    name: string;
    scoringCategory: ScoringCategory;
    frequency: Frequency;
    duration: DurationEstimate;
    physical: PhysicalEffort;
    userScore: number | null;
    algoScore36: number;
    dueDate: string;
    dueTime: string;
    templateId: string | null;
  };
  const [pendingTasks, setPendingTasks] = useState<PendingTask[]>([]);
  const [swipeIndex, setSwipeIndex] = useState(0);
  const [batchCreating, setBatchCreating] = useState(false);

  // Drag state pour le swipe de la carte
  const [dragX, setDragX] = useState(0);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [exitDirection, setExitDirection] = useState<'left' | 'right' | 'up' | 'down' | null>(null);

  // Charger le brouillon depuis l'URL ou localStorage
  useEffect(() => {
    const draft = searchParams.get('draft') || localStorage.getItem('yova_task_draft');
    if (draft) {
      setName(draft);
      localStorage.removeItem('yova_task_draft');
    }
    const nameParam = searchParams.get('name');
    if (nameParam) setName(nameParam);

    const dateParam = searchParams.get('date');
    if (dateParam) setDueDate(dateParam);

    // Pré-remplissage depuis le journal Yova (suggested_tasks)
    const categoryParam = searchParams.get('category') as ScoringCategory | null;
    if (categoryParam) setScoringCategory(categoryParam);

    const frequencyParam = searchParams.get('frequency') as Frequency | null;
    if (frequencyParam) setFrequency(frequencyParam);

    const durationParam = searchParams.get('duration') as DurationEstimate | null;
    if (durationParam) setDuration(durationParam);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- montage uniquement (draft/date URL)

  // Catégories DB + templates (pour autocomplétion)
  const [dbCategories, setDbCategories] = useState<TaskCategory[]>([]);
  const [allTemplates, setAllTemplates] = useState<{
    id: string;
    name: string;
    scoring_category: string | null;
    default_duration: string | null;
    default_physical: string | null;
    default_frequency: string | null;
    sort_order: number | null;
  }[]>([]);
  // Usage count par template_id dans ce foyer (pour boost personnalisé)
  const [templateUsage, setTemplateUsage] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const householdId = profile?.household_id;
      const [catRes, tplRes, usageRes] = await Promise.all([
        supabase.from('task_categories').select('*').order('sort_order'),
        supabase.from('task_templates').select('id, name, scoring_category, default_duration, default_physical, default_frequency, sort_order').order('sort_order'),
        householdId
          ? supabase.from('household_tasks').select('template_id').eq('household_id', householdId).not('template_id', 'is', null)
          : Promise.resolve({ data: [] }),
      ]);
      if (catRes.data) setDbCategories(catRes.data as TaskCategory[]);
      if (tplRes.data) setAllTemplates(tplRes.data);
      // Compter les usages par template
      if (usageRes.data && usageRes.data.length > 0) {
        const counts = new Map<string, number>();
        for (const row of usageRes.data) {
          if (row.template_id) counts.set(row.template_id, (counts.get(row.template_id) ?? 0) + 1);
        }
        setTemplateUsage(counts);
      }
    }
    load();
  }, [profile?.household_id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Inputs
  const [name, setName] = useState('');
  const [scoringCategory, setScoringCategory] = useState<ScoringCategory>('misc');
  const [autoDetected, setAutoDetected] = useState(false);
  const [duration, setDuration] = useState<DurationEstimate>('medium');
  const [physical, setPhysical] = useState<PhysicalEffort>('light');
  const [frequency, setFrequency] = useState<Frequency>('weekly');
  const [assignedTo, setAssignedTo] = useState('');
  const [customIntervalDays, setCustomIntervalDays] = useState('');
  const [isFixedAssignment, setIsFixedAssignment] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  // Date pré-remplie à demain
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const [dueDate, setDueDate] = useState(tomorrow.toISOString().split('T')[0]);
  const [dueTime, setDueTime] = useState('09:00');

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [startsAt, setStartsAt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  // Sous-tâches suggérées après création
  const [subTaskSuggestions, setSubTaskSuggestions] = useState<{ id: string; suggested_name: string; suggested_frequency: string; relative_days: number }[]>([]);
  const [selectedSubTasks, setSelectedSubTasks] = useState<Set<string>>(new Set());
  const [showSubTasks, setShowSubTasks] = useState(false);
  const [creatingSubTasks, setCreatingSubTasks] = useState(false);

  // Autocomplétion intelligente : fuzzy + scoring multi-facteurs
  const templateSuggestions = useMemo(() => {
    if (name.trim().length < 2 || !showSuggestions) return [];
    const q = name.trim();
    return allTemplates
      .map((t) => ({
        ...t,
        _score: scoreTemplate(t.name, q, templateUsage.get(t.id) ?? 0, t.sort_order ?? 999),
      }))
      .filter((t) => t._score >= 0)
      .sort((a, b) => b._score - a._score)
      .slice(0, 6);
  }, [name, allTemplates, showSuggestions, templateUsage]);

  // Index de la suggestion sélectionnée au clavier (-1 = aucune)
  const [focusedSuggestion, setFocusedSuggestion] = useState(-1);

  // Reset focus quand les suggestions changent
  useEffect(() => { setFocusedSuggestion(-1); }, [templateSuggestions]);

  // Appliquer un template (partagé entre Yova et Advanced, clavier et clic)
  const applyTemplate = useCallback((tpl: typeof templateSuggestions[0]) => {
    setName(tpl.name);
    if (tpl.scoring_category) setScoringCategory(tpl.scoring_category as ScoringCategory);
    if (tpl.default_duration) setDuration(tpl.default_duration as DurationEstimate);
    if (tpl.default_physical) setPhysical(tpl.default_physical as PhysicalEffort);
    if (tpl.default_frequency) setFrequency(tpl.default_frequency as Frequency);
    setSelectedTemplateId(tpl.id);
    setShowSuggestions(false);
    setFocusedSuggestion(-1);
  }, []);

  // Navigation clavier dans les suggestions
  const handleSuggestionKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!templateSuggestions.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedSuggestion((i) => Math.min(i + 1, templateSuggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedSuggestion((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Enter' && focusedSuggestion >= 0) {
      e.preventDefault();
      applyTemplate(templateSuggestions[focusedSuggestion]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setFocusedSuggestion(-1);
    }
  }, [templateSuggestions, focusedSuggestion, applyTemplate]);

  // Score utilisateur : pré-rempli par l'algo, ajustable via slider
  const [userScore, setUserScore] = useState<number | null>(null);
  const [userHasAdjusted, setUserHasAdjusted] = useState(false);

  // Auto-inférence complète (catégorie + fréquence + durée + effort) quand le nom change
  useEffect(() => {
    if (name.trim().length >= 3) {
      const inferred = inferTaskMetadata(name);
      if (inferred.confidence !== 'low') {
        setScoringCategory(inferred.category);
        setFrequency(inferred.frequency);
        setDuration(inferred.duration);
        setPhysical(inferred.physical);
        setAutoDetected(true);
      } else if (autoDetected) {
        setAutoDetected(false);
      }
    }
  }, [name]); // eslint-disable-line react-hooks/exhaustive-deps

  // Score en temps réel (algo)
  const score: ScoreBreakdown = useMemo(() => {
    return computeTaskScore({ title: name, category: scoringCategory, duration, physical, frequency });
  }, [name, scoringCategory, duration, physical, frequency]);

  // Score algo converti en /10 pour le slider
  const algoScore10 = useMemo(() => loadTo10(score.global_score), [score.global_score]);

  // Pré-remplir le slider avec le score algo (tant que l'utilisateur n'a pas touché)
  useEffect(() => {
    if (!userHasAdjusted) {
      setUserScore(algoScore10);
    }
  }, [algoScore10, userHasAdjusted]);

  // Pas d'auto-assignation : l'utilisateur choisit explicitement qui fait la tâche.

  // Labels pour la preview Yova
  const categoryLabel = useMemo(() => {
    const opt = SCORING_CATEGORY_OPTIONS.find((o) => o.value === scoringCategory);
    return opt ? `${opt.emoji} ${opt.label}` : scoringCategory;
  }, [scoringCategory]);
  const durationLabelText = useMemo(() => {
    return DURATION_OPTIONS.find((o) => o.value === duration)?.label ?? duration;
  }, [duration]);
  const physicalLabelText = useMemo(() => {
    return PHYSICAL_OPTIONS.find((o) => o.value === physical)?.label ?? physical;
  }, [physical]);
  const frequencyLabelText = useMemo(() => frequencyLabel(frequency), [frequency]);
  const assigneeName = useMemo(() => {
    if (!assignedTo) return null;
    return allMembers.find((m) => m.id === assignedTo)?.display_name ?? null;
  }, [assignedTo, allMembers]);

  // Mapper scoring category vers DB category
  const findDbCategoryId = (): string => {
    const mappings: Record<string, string[]> = {
      cleaning: ['Nettoyage', 'Ménage'],
      tidying: ['Rangement'],
      shopping: ['Courses'],
      laundry: ['Linge'],
      meals: ['Cuisine', 'Courses'],
      children: ['Enfants'],
      admin: ['Administratif'],
      outdoor: ['Extérieur & Jardin', 'Extérieur'],
      hygiene: ['Hygiène & Soin', 'Hygiène'],
      pets: ['Animaux'],
      vehicle: ['Voiture'],
      transport: ['Voiture', 'Transport'],
    };
    const names = mappings[scoringCategory] ?? [];
    for (const n of names) {
      const found = dbCategories.find((c) => c.name === n);
      if (found) return found.id;
    }
    return dbCategories[0]?.id ?? '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!profile?.household_id) return;
    if (!name.trim()) { setError('Le nom est obligatoire.'); return; }
    if (!dueDate && frequency !== 'once') { setError('La date prévue est obligatoire.'); return; }

    const categoryId = findDbCategoryId();
    if (!categoryId) { setError('Aucune catégorie disponible.'); return; }

    let nextDueAt: string | null = null;
    if (dueDate) {
      nextDueAt = new Date(`${dueDate}T${dueTime || '09:00'}:00`).toISOString();
    }

    const result = await createTask(profile.household_id, {
      name: name.trim(),
      category_id: categoryId,
      frequency,
      mental_load_score: Math.round(score.global_score / 7), // legacy 0-5
      assigned_to: assignedTo || null,
      next_due_at: nextDueAt,
      // Scoring V2
      user_score: userScore, // ce que l'utilisateur a choisi (0-10)
      duration_estimate: duration,
      physical_effort: physical,
      scoring_category: scoringCategory,
      is_fixed_assignment: isFixedAssignment,
      notifications_enabled: notificationsEnabled,
      // Catalogue
      template_id: selectedTemplateId,
    });
    if (result.ok) {
      // Collecte silencieuse : tâche sans template → suggestion personnalisée
      if (!selectedTemplateId) {
        const supabaseSugg = createClient();
        supabaseSugg.from('custom_task_suggestions').insert({
          name: name.trim(),
          household_id: profile.household_id,
          source: 'task_creation',
        }).then(() => {}); // fire-and-forget
      }
      // Chercher des sous-tâches associées (événements, mots-clés)
      const supabase2 = createClient();
      const keywords = name.trim().toLowerCase().split(/\s+/);
      const { data: associations } = await supabase2
        .from('task_associations')
        .select('*')
        .in('trigger_type', ['event', 'keyword'])
        .eq('is_premium', false);

      // Matching par mot entier (pas de substring) — minimum 4 caractères pour éviter les faux positifs
      const taskNameLower = name.trim().toLowerCase();
      const matching = (associations ?? []).filter((a: { trigger_value: string }) => {
        const trigger = a.trigger_value.toLowerCase();
        if (trigger.length < 4) return false; // ignorer les triggers trop courts
        // Le trigger doit apparaître comme mot entier dans le nom de la tâche
        const regex = new RegExp(`\\b${trigger.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        return regex.test(taskNameLower);
      });

      if (matching.length > 0) {
        setSubTaskSuggestions(matching);
        setSelectedSubTasks(new Set(matching.map((a: { id: string }) => a.id)));
        setShowSubTasks(true);
      } else {
        // Fallback IA : demander à Claude de générer des sous-tâches
        try {
          const aiRes = await fetch('/api/ai/subtasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ taskName: name.trim(), dueDate }),
          });
          if (!aiRes.ok) { router.push('/tasks'); return; }
          let aiData: { subtasks?: { name: string; relativeDays: number; duration: string; category: string }[] };
          try { aiData = await aiRes.json(); } catch { router.push('/tasks'); return; }
          if (aiData.subtasks && aiData.subtasks.length > 0) {
            // Convertir le format IA en format compatible avec le composant
            const aiSuggestions = aiData.subtasks.map((s: { name: string; relativeDays: number; duration: string; category: string }, i: number) => ({
              id: `ai-${i}`,
              trigger_type: 'ai',
              trigger_value: 'ai',
              suggested_name: s.name,
              suggested_frequency: 'once',
              suggested_duration: s.duration || 'short',
              suggested_physical: 'light',
              suggested_scoring_category: s.category || 'misc',
              suggested_mental_load_score: 3,
              relative_days: s.relativeDays || 0,
            }));
            setSubTaskSuggestions(aiSuggestions);
            setSelectedSubTasks(new Set(aiSuggestions.map((s: { id: string }) => s.id)));
            setShowSubTasks(true);
          } else {
            router.push('/tasks');
          }
        } catch {
          router.push('/tasks');
        }
      }
    } else {
      setError(result.error ?? 'Erreur inconnue.');
    }
  };

  // Créer les sous-tâches sélectionnées
  const handleCreateSubTasks = async () => {
    if (!profile?.household_id || selectedSubTasks.size === 0) {
      router.push('/tasks');
      return;
    }
    setCreatingSubTasks(true);
    const supabase3 = createClient();
    const defaultCatId = dbCategories[0]?.id ?? '';

    // Date de référence = la date de la tâche parent
    const parentDate = dueDate ? new Date(`${dueDate}T${dueTime || '09:00'}:00`) : new Date();

    for (const assoc of subTaskSuggestions) {
      if (!selectedSubTasks.has(assoc.id)) continue;
      const a = assoc as Record<string, unknown>;
      const subDate = new Date(parentDate);
      subDate.setDate(subDate.getDate() + (a.relative_days as number || 0));

      await supabase3.from('household_tasks').insert({
        household_id: profile.household_id,
        name: a.suggested_name as string,
        category_id: (a.suggested_category_id as string) || defaultCatId,
        frequency: (a.suggested_frequency as string) || 'once',
        mental_load_score: (a.suggested_mental_load_score as number) || 3,
        scoring_category: a.suggested_scoring_category as string || 'misc',
        duration_estimate: a.suggested_duration as string || 'short',
        physical_effort: a.suggested_physical as string || 'light',
        is_active: true,
        created_by: profile.id,
        assigned_to: null,
        next_due_at: subDate.toISOString(),
      });
    }

    setCreatingSubTasks(false);
    router.push('/tasks');
  };

  // ═══════════════════════════════════════════════════════════════════════════════
  // BATCH — ajouter la tâche courante à la liste locale puis reset l'input
  // ═══════════════════════════════════════════════════════════════════════════════
  const addCurrentToBatch = useCallback(() => {
    if (!name.trim()) return;
    const newPending: PendingTask = {
      name: name.trim(),
      scoringCategory,
      frequency,
      duration,
      physical,
      userScore,
      algoScore36: score.global_score,
      dueDate,
      dueTime,
      templateId: selectedTemplateId,
    };
    setPendingTasks((prev) => [...prev, newPending]);
    // Reset pour saisir la prochaine
    setName('');
    setUserScore(null);
    setUserHasAdjusted(false);
    setScoringCategory('misc');
    setDuration('medium');
    setPhysical('light');
    setFrequency('weekly');
    setAutoDetected(false);
    setSelectedTemplateId(null);
  }, [name, scoringCategory, frequency, duration, physical, userScore, score.global_score, dueDate, dueTime, selectedTemplateId]);

  // Transition vers l'écran de swipe assignation (en s'assurant que la tâche courante est commit si l'input est rempli)
  const goToAssign = useCallback(() => {
    if (name.trim()) {
      // Commit la tâche courante avant de transitionner
      const newPending: PendingTask = {
        name: name.trim(),
        scoringCategory,
        frequency,
        duration,
        physical,
        userScore,
        algoScore36: score.global_score,
        dueDate,
        dueTime,
        templateId: selectedTemplateId,
      };
      setPendingTasks((prev) => [...prev, newPending]);
    }
    setSwipeIndex(0);
    setYovaStep('assign');
  }, [name, scoringCategory, frequency, duration, physical, userScore, score.global_score, dueDate, dueTime, selectedTemplateId]);

  // Assignation d'une tâche du batch à un membre → passage à la suivante ou création finale
  const assignBatchTask = useCallback(async (memberId: string | null) => {
    const currentIdx = swipeIndex;
    const nextIdx = currentIdx + 1;

    // Stocke l'assignation sur la tâche en attente
    setPendingTasks((prev) => prev.map((t, i) =>
      i === currentIdx ? { ...t, assignedTo: memberId } as PendingTask & { assignedTo: string | null } : t
    ));

    // S'il reste des tâches à assigner, on passe à la suivante
    if (nextIdx < pendingTasks.length) {
      setSwipeIndex(nextIdx);
      return;
    }

    // Toutes assignées : on crée en base
    if (!profile?.household_id) return;
    setBatchCreating(true);

    // Récupérer la liste à jour avec l'assignation courante
    const finalTasks = pendingTasks.map((t, i) => ({
      ...t,
      assignedTo: i === currentIdx ? memberId : (t as PendingTask & { assignedTo?: string | null }).assignedTo ?? null,
    }));

    const supabase2 = createClient();
    const { data: cats } = await supabase2.from('task_categories').select('id, name');
    const catMap = new Map<string, string>();
    for (const c of (cats ?? [])) catMap.set(c.name, c.id);
    const mappings: Record<string, string[]> = {
      cleaning: ['Nettoyage', 'Ménage'],
      tidying: ['Rangement'],
      shopping: ['Courses'],
      laundry: ['Linge'],
      meals: ['Cuisine', 'Courses'],
      children: ['Enfants'],
      admin: ['Administratif'],
      outdoor: ['Extérieur & Jardin', 'Extérieur'],
      hygiene: ['Hygiène & Soin', 'Hygiène'],
      pets: ['Animaux'],
      vehicle: ['Voiture'],
      transport: ['Voiture', 'Transport'],
    };
    const resolveCatId = (sc: ScoringCategory): string => {
      const names = mappings[sc] ?? [];
      for (const n of names) {
        const id = catMap.get(n);
        if (id) return id;
      }
      return cats?.[0]?.id ?? '';
    };

    // Insert toutes les tâches
    for (const t of finalTasks) {
      const catId = resolveCatId(t.scoringCategory);
      const nextDueAt = t.dueDate ? new Date(`${t.dueDate}T${t.dueTime || '09:00'}:00`).toISOString() : null;
      await supabase2.from('household_tasks').insert({
        household_id: profile.household_id,
        name: t.name,
        category_id: catId,
        frequency: t.frequency,
        mental_load_score: Math.round(t.algoScore36 / 7),
        assigned_to: t.assignedTo || null,
        next_due_at: nextDueAt,
        user_score: t.userScore,
        duration_estimate: t.duration,
        physical_effort: t.physical,
        scoring_category: t.scoringCategory,
        is_active: true,
        is_fixed_assignment: false,
        notifications_enabled: true,
        created_by: profile.id,
        template_id: t.templateId ?? null,
      });
      // Collecte silencieuse : tâche sans template → suggestion personnalisée
      if (!t.templateId) {
        supabase2.from('custom_task_suggestions').insert({
          name: t.name,
          household_id: profile.household_id,
          source: 'task_creation',
        }).then(() => {}); // fire-and-forget
      }
    }

    setBatchCreating(false);
    // Recharger les tâches et retourner à la liste
    if (profile.household_id) {
      await useTaskStore.getState().fetchTasks(profile.household_id);
    }
    router.push('/tasks');
  }, [swipeIndex, pendingTasks, profile, router]);

  const globalColor =
    score.global_score <= 8 ? '#34c759' :
    score.global_score <= 16 ? '#007aff' :
    score.global_score <= 24 ? '#ff9500' :
    '#ff3b30';

  // ═══════════════════════════════════════════════════════════════════════════════
  // MODE AURA — 2 étapes : input+preview → swipe assignation
  // ═══════════════════════════════════════════════════════════════════════════════
  if (mode === 'yova' && !showSubTasks) {
    const showPreview = name.trim().length >= 3;
    const realMembers = allMembers.filter((m) => !m.isPhantom);

    // ─── ÉTAPE 1 : Input + Preview ────────────────────────────────────────────
    if (yovaStep === 'input') {
      return (
        <div className="pt-4 pb-8">
          {/* Header */}
          <div className="flex items-center justify-between px-4 mb-6">
            <button onClick={() => router.back()} className="text-[17px] font-medium" style={{ color: '#007aff' }}>← Retour</button>
            <h2 className="text-[17px] font-semibold text-[#1c1c1e]">Nouvelle tâche</h2>
            <div className="w-16" />
          </div>

          {/* Liste des tâches en attente (batch) */}
          {pendingTasks.length > 0 && (
            <div className="mx-4 mb-4 rounded-2xl bg-white overflow-hidden" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
              <div className="px-4 py-2.5 flex items-center justify-between" style={{ background: '#EEF4FF', borderBottom: '0.5px solid var(--ios-separator)' }}>
                <p className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: '#007aff' }}>
                  {pendingTasks.length} tâche{pendingTasks.length > 1 ? 's' : ''}{' '}en attente d&apos;assignation
                </p>
              </div>
              {pendingTasks.map((pt, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-2.5"
                  style={i < pendingTasks.length - 1 ? { borderBottom: '0.5px solid var(--ios-separator)' } : {}}>
                  <span className="text-[14px] text-[#1c1c1e] flex-1 truncate">{pt.name}</span>
                  <button
                    onClick={() => setPendingTasks((prev) => prev.filter((_, idx) => idx !== i))}
                    className="text-[12px] text-[#ff3b30] ml-2 px-2">
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="mx-4 mb-6">
            <label className="text-[13px] text-[#8e8e93] block mb-2">Qu&apos;est-ce que tu dois faire ?</label>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setSelectedTemplateId(null); setShowSuggestions(true); }}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={handleSuggestionKeyDown}
              autoFocus
              maxLength={100}
              className="w-full text-[20px] font-semibold text-[#1c1c1e] bg-transparent outline-none border-b-2"
              style={{ borderColor: showPreview ? '#007aff' : '#e5e5ea', paddingBottom: '8px' }}
              placeholder="Ex : Repasser le linge" />

            {/* Autocomplétion intelligente */}
            {templateSuggestions.length > 0 && name.trim().length >= 2 && (
              <div className="mt-3 rounded-xl bg-white overflow-hidden" style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.08)', border: '0.5px solid rgba(0,0,0,0.06)' }}>
                {templateSuggestions.map((tpl, i) => {
                  const catOpt = SCORING_CATEGORY_OPTIONS.find((o) => o.value === tpl.scoring_category);
                  const durOpt = DURATION_OPTIONS.find((o) => o.value === tpl.default_duration);
                  const isFocused = focusedSuggestion === i;
                  const usageCount = templateUsage.get(tpl.id) ?? 0;
                  return (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => applyTemplate(tpl)}
                      className="w-full px-4 py-3 text-left flex items-center gap-3 transition-colors"
                      style={{
                        background: isFocused ? '#f0f4ff' : 'transparent',
                        borderBottom: i < templateSuggestions.length - 1 ? '0.5px solid var(--ios-separator)' : 'none',
                      }}>
                      {/* Emoji catégorie */}
                      <span className="text-[18px] flex-shrink-0">{catOpt?.emoji ?? '📋'}</span>
                      <div className="flex-1 min-w-0">
                        {/* Nom avec highlight */}
                        <p className="text-[15px] text-[#1c1c1e] font-medium truncate">
                          {highlightMatch(tpl.name, name.trim())}
                        </p>
                        {/* Méta : durée + badge "Utilisé" si déjà dans le foyer */}
                        <p className="text-[11px] text-[#8e8e93] mt-0.5">
                          {durOpt?.label ?? ''}
                          {usageCount > 0 && <span className="ml-2 text-[10px] font-semibold text-[#34c759]">✓ Déjà utilisé {usageCount}×</span>}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Preview card : ce qu'Yova a compris */}
          {showPreview && (
            <div className="mx-4 rounded-2xl bg-white overflow-hidden mb-6" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div className="p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-[20px]">🤖</span>
                  <p className="text-[12px] font-semibold text-[#8e8e93] uppercase tracking-wide">J&apos;ai compris :</p>
                </div>

                <div>
                  <h3 className="text-[20px] font-bold text-[#1c1c1e]">{name}</h3>
                  <p className="text-[13px] text-[#8e8e93] mt-2">
                    {categoryLabel} · {frequencyLabelText} · {durationLabelText}
                  </p>
                </div>

                <div className="flex items-center gap-2 text-[13px] text-[#8e8e93]">
                  <span>📅</span>
                  <span>{dueDate ? new Date(`${dueDate}T09:00`).toLocaleDateString('fr-FR', { weekday: 'long', month: 'long', day: 'numeric' }) : 'Demain'}</span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full" style={{ background: `linear-gradient(to right, #34c759 0%, #ff9500 50%, #ff3b30 100%)` }} />
                  <span className="text-[14px] font-bold" style={{ color: scoreColor10(userScore ?? algoScore10) }}>
                    {userScore ?? algoScore10}<span className="text-[11px]">/10</span>
                  </span>
                </div>
              </div>

              <div className="px-5 py-4 space-y-3" style={{ borderTop: '0.5px solid var(--ios-separator)' }}>
                {/* 1. Nouvelle tâche : ajoute à la file et reset l'input */}
                <button
                  type="button"
                  onClick={addCurrentToBatch}
                  className="w-full rounded-xl py-3 text-[16px] font-semibold text-white"
                  style={{ background: '#007aff' }}>
                  + Nouvelle tâche
                </button>
                {/* 2. Valider et terminer : crée la tâche sans assigner */}
                <button
                  type="button"
                  onClick={async () => {
                    await addCurrentToBatch();
                    router.push('/tasks');
                  }}
                  className="w-full rounded-xl py-3 text-[15px] font-semibold"
                  style={{ background: '#34c759', color: 'white' }}>
                  ✓ Valider et terminer
                </button>
                {/* 3. Assigner : commit la courante et passe à l'assignation */}
                <button
                  type="button"
                  onClick={goToAssign}
                  className="w-full rounded-xl py-3 text-[15px] font-semibold"
                  style={{ background: '#f0f2f8', color: '#1c1c1e' }}>
                  Assigner →
                </button>
                {/* 4. Options avancées : mode avancé */}
                <button
                  type="button"
                  onClick={() => setMode('advanced')}
                  className="w-full rounded-xl py-2 text-[14px] font-medium"
                  style={{ background: 'transparent', color: '#8e8e93' }}>
                  Options avancées ▾
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="mx-4 rounded-xl px-4 py-3 text-[14px]" style={{ background: '#fff2f2', color: '#ff3b30' }}>{error}</div>
          )}
        </div>
      );
    }

    // ─── ÉTAPE 2 : Assignation du batch ─────────────────────────────────────
    if (yovaStep === 'assign') {
      const currentPending = pendingTasks[swipeIndex];

      // Si aucune tâche en attente ou déjà toutes assignées : fallback
      if (!currentPending) {
        return (
          <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
            <div className="text-[48px] mb-4">✅</div>
            <p className="text-[17px] font-semibold text-[#1c1c1e] mb-2">Tâches créées !</p>
            <button
              onClick={() => router.push('/tasks')}
              className="mt-4 rounded-xl px-6 py-3 text-[15px] font-semibold text-white"
              style={{ background: '#007aff' }}
            >
              Voir mes tâches
            </button>
          </div>
        );
      }

      // Solo : auto-assign au premier membre et passer à la suivante
      if (realMembers.length === 1) {
        assignBatchTask(realMembers[0].id);
        return null;
      }

      const currentCatEmoji = SCORING_CATEGORY_OPTIONS.find((o) => o.value === currentPending.scoringCategory)?.emoji ?? '📋';

      // Mapping : chaque direction → un membre (ou skip)
      // Gauche = membre 0, Droite = membre 1, Haut = membre 2 (si existe), Bas = skip
      const leftMember = realMembers[0] ?? null;
      const rightMember = realMembers[1] ?? null;
      const upMember = realMembers[2] ?? null;

      const SWIPE_THRESHOLD = 120; // px pour valider un swipe
      const ROTATION_FACTOR = 0.1; // degrés par pixel

      const resolveExit = (dir: 'left' | 'right' | 'up' | 'down') => {
        let memberId: string | null = null;
        if (dir === 'left' && leftMember) memberId = leftMember.id;
        else if (dir === 'right' && rightMember) memberId = rightMember.id;
        else if (dir === 'up' && upMember) memberId = upMember.id;
        else if (dir === 'down') memberId = null; // skip
        else return; // direction sans cible
        setExitDirection(dir);
        setTimeout(() => {
          assignBatchTask(memberId);
          setDragX(0);
          setDragY(0);
          setExitDirection(null);
        }, 280);
      };

      const handlePointerDown = (e: React.PointerEvent) => {
        if (batchCreating || exitDirection) return;
        setIsDragging(true);
        setDragStart({ x: e.clientX, y: e.clientY });
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
      };

      const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDragging || !dragStart) return;
        setDragX(e.clientX - dragStart.x);
        setDragY(e.clientY - dragStart.y);
      };

      const handlePointerUp = () => {
        if (!isDragging) return;
        setIsDragging(false);
        setDragStart(null);

        const absX = Math.abs(dragX);
        const absY = Math.abs(dragY);

        // Direction horizontale prioritaire
        if (absX > SWIPE_THRESHOLD && absX > absY) {
          resolveExit(dragX > 0 ? 'right' : 'left');
          return;
        }
        // Direction verticale
        if (absY > SWIPE_THRESHOLD) {
          resolveExit(dragY < 0 ? 'up' : 'down');
          return;
        }
        // Pas assez loin : retour au centre
        setDragX(0);
        setDragY(0);
      };

      // Calculs visuels
      const rotation = dragX * ROTATION_FACTOR;
      let transform = `translate(${dragX}px, ${dragY}px) rotate(${rotation}deg)`;
      if (exitDirection === 'left') transform = 'translate(-150%, 50px) rotate(-25deg)';
      else if (exitDirection === 'right') transform = 'translate(150%, 50px) rotate(25deg)';
      else if (exitDirection === 'up') transform = 'translate(0, -150%) rotate(0deg)';
      else if (exitDirection === 'down') transform = 'translate(0, 150%) rotate(0deg)';

      // Opacité des indicateurs de direction
      const leftOpacity = Math.min(1, Math.max(0, -dragX / SWIPE_THRESHOLD));
      const rightOpacity = Math.min(1, Math.max(0, dragX / SWIPE_THRESHOLD));
      const upOpacity = Math.min(1, Math.max(0, -dragY / SWIPE_THRESHOLD));
      const downOpacity = Math.min(1, Math.max(0, dragY / SWIPE_THRESHOLD));

      return (
        <div className="pt-4 pb-8 overflow-hidden">
          {/* Header + progression */}
          <div className="px-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <button onClick={() => setYovaStep('input')} className="text-[15px] font-medium" style={{ color: '#007aff' }}>
                ← Retour
              </button>
              <span className="text-[13px] text-[#8e8e93]">
                {swipeIndex + 1} / {pendingTasks.length}
              </span>
            </div>
            <div className="h-1.5 rounded-full" style={{ background: '#e5e5ea' }}>
              <div className="h-1.5 rounded-full transition-all" style={{
                width: `${((swipeIndex + 1) / pendingTasks.length) * 100}%`,
                background: 'linear-gradient(90deg, #007aff, #5856d6)',
              }} />
            </div>
          </div>

          {/* Étiquettes de direction autour de la carte */}
          <div className="relative mx-4" style={{ minHeight: '320px' }}>
            {/* Label gauche */}
            {leftMember && (
              <div className="absolute top-1/2 -translate-y-1/2 z-10 pointer-events-none"
                style={{ left: '4px', opacity: 0.3 + leftOpacity * 0.7 }}>
                <div className="rounded-xl px-2 py-3 text-center" style={{
                  background: leftOpacity > 0.5 ? '#007aff' : 'transparent',
                  color: leftOpacity > 0.5 ? 'white' : '#007aff',
                  border: '2px solid #007aff',
                  transform: `scale(${1 + leftOpacity * 0.15})`,
                }}>
                  <span className="text-[11px] font-bold block">←</span>
                  <span className="text-[10px] font-semibold block mt-0.5">{leftMember.display_name}</span>
                </div>
              </div>
            )}
            {/* Label droite */}
            {rightMember && (
              <div className="absolute top-1/2 -translate-y-1/2 z-10 pointer-events-none"
                style={{ right: '4px', opacity: 0.3 + rightOpacity * 0.7 }}>
                <div className="rounded-xl px-2 py-3 text-center" style={{
                  background: rightOpacity > 0.5 ? '#5856d6' : 'transparent',
                  color: rightOpacity > 0.5 ? 'white' : '#5856d6',
                  border: '2px solid #5856d6',
                  transform: `scale(${1 + rightOpacity * 0.15})`,
                }}>
                  <span className="text-[11px] font-bold block">→</span>
                  <span className="text-[10px] font-semibold block mt-0.5">{rightMember.display_name}</span>
                </div>
              </div>
            )}
            {/* Label haut (3e membre) */}
            {upMember && (
              <div className="absolute left-1/2 -translate-x-1/2 z-10 pointer-events-none"
                style={{ top: '4px', opacity: 0.3 + upOpacity * 0.7 }}>
                <div className="rounded-full px-3 py-1 text-center" style={{
                  background: upOpacity > 0.5 ? '#34c759' : 'transparent',
                  color: upOpacity > 0.5 ? 'white' : '#34c759',
                  border: '2px solid #34c759',
                }}>
                  <span className="text-[10px] font-semibold">↑ {upMember.display_name}</span>
                </div>
              </div>
            )}
            {/* Label bas (skip) */}
            <div className="absolute left-1/2 -translate-x-1/2 z-10 pointer-events-none"
              style={{ bottom: '4px', opacity: 0.2 + downOpacity * 0.8 }}>
              <div className="rounded-full px-3 py-1 text-center" style={{
                background: downOpacity > 0.5 ? '#8e8e93' : 'transparent',
                color: downOpacity > 0.5 ? 'white' : '#8e8e93',
                border: '2px solid #8e8e93',
              }}>
                <span className="text-[10px] font-semibold">↓ Passer</span>
              </div>
            </div>

            {/* Carte tâche draggable */}
            <div
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              className="rounded-3xl p-6 text-center min-h-[280px] flex flex-col justify-center select-none cursor-grab active:cursor-grabbing"
              style={{
                background: 'linear-gradient(135deg, #ffffff, #f6f8ff)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
                transform,
                transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
                touchAction: 'none',
                marginLeft: '52px',
                marginRight: '52px',
              }}
            >
              <div className="text-[40px] mb-2">{currentCatEmoji}</div>
              <p className="text-[22px] font-black text-[#1c1c1e] mb-2">{currentPending.name}</p>
              <p className="text-[13px] text-[#8e8e93]">
                {DURATION_OPTIONS.find((o) => o.value === currentPending.duration)?.label} · {currentPending.frequency}
              </p>
              <p className="text-[11px] text-[#c7c7cc] mt-6">
                {realMembers.length >= 2 ? 'Swipe pour assigner' : 'Tape un membre'}
              </p>
            </div>
          </div>

          {/* Boutons membres (fallback swipe + accessibilité) */}
          <div className="mx-4 mt-4 space-y-2">
            {realMembers.length === 0 && (
              <p className="text-center text-[13px] text-[#8e8e93] py-4">
                Aucun membre dans ce foyer. Invite quelqu&apos;un depuis ton profil.
              </p>
            )}
            {realMembers.length >= 2 && (
              <div className="rounded-2xl bg-white overflow-hidden" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <p className="text-[12px] font-semibold text-[#8e8e93] uppercase tracking-wide px-4 py-2.5"
                  style={{ borderBottom: '0.5px solid #f0f2f8' }}>
                  Qui s&apos;en occupe ?
                </p>
                {realMembers.map((member, i) => (
                  <button
                    key={member.id}
                    onClick={() => assignBatchTask(member.id)}
                    disabled={batchCreating}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors active:bg-[#f0f2f8] disabled:opacity-50"
                    style={i < realMembers.length - 1 ? { borderBottom: '0.5px solid #f0f2f8' } : {}}
                  >
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[14px] font-bold flex-shrink-0"
                      style={{ background: member.isPhantom ? '#8e8e93' : 'linear-gradient(135deg, #007aff, #5856d6)' }}>
                      {member.display_name[0].toUpperCase()}
                    </div>
                    <span className="text-[15px] font-semibold text-[#1c1c1e]">
                      {member.isPhantom ? '👻 ' : ''}{member.display_name}
                    </span>
                  </button>
                ))}
                <button
                  onClick={() => assignBatchTask(null)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left"
                  style={{ borderTop: '0.5px solid #f0f2f8' }}
                >
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: '#f0f2f8' }}>
                    <span className="text-[14px]">—</span>
                  </div>
                  <span className="text-[15px] text-[#8e8e93]">Passer (non assigné)</span>
                </button>
              </div>
            )}
          </div>

          {error && (
            <div className="mx-4 mt-4 rounded-xl px-4 py-3 text-[14px]" style={{ background: '#fff2f2', color: '#ff3b30' }}>{error}</div>
          )}
        </div>
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // MODE AVANCÉ — Formulaire complet
  // ═══════════════════════════════════════════════════════════════════════════════
  // Overlay sous-tâches
  if (showSubTasks) {
    return (
      <div className="pt-4 pb-28">
        <div className="px-4 mb-4">
          <h2 className="text-[22px] font-bold text-[#1c1c1e]">Tâches associées</h2>
          <p className="text-[14px] text-[#8e8e93] mt-1">On a trouvé des sous-tâches pour &laquo; {name} &raquo;. Coche celles que tu veux créer.</p>
        </div>

        <div className="mx-4 rounded-2xl bg-white overflow-hidden" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
          {subTaskSuggestions.map((s, i) => {
            const checked = selectedSubTasks.has(s.id);
            return (
              <button key={s.id} type="button"
                onClick={() => {
                  setSelectedSubTasks((prev) => {
                    const next = new Set(prev);
                    if (next.has(s.id)) next.delete(s.id); else next.add(s.id);
                    return next;
                  });
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-left"
                style={i < subTaskSuggestions.length - 1 ? { borderBottom: '0.5px solid var(--ios-separator)' } : {}}>
                <span className="flex-shrink-0 flex items-center justify-center rounded-full"
                  style={{ width: 24, height: 24, background: checked ? '#007aff' : 'transparent', border: checked ? 'none' : '2px solid #c7c7cc' }}>
                  {checked && <svg width="12" height="12" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" /></svg>}
                </span>
                <div className="flex-1">
                  <p className="text-[15px] text-[#1c1c1e]">{s.suggested_name}</p>
                  {s.relative_days !== 0 && (
                    <p className="text-[11px] text-[#8e8e93]">
                      {s.relative_days < 0 ? `${Math.abs(s.relative_days)} jours avant` : s.relative_days > 0 ? `${s.relative_days} jours après` : 'Le jour même'}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <div className="px-4 pt-4 space-y-2">
          <button onClick={handleCreateSubTasks} disabled={creatingSubTasks}
            className="w-full rounded-xl py-[14px] text-[17px] font-semibold text-white disabled:opacity-50"
            style={{ background: '#007aff' }}>
            {creatingSubTasks ? 'Création...' : `Créer ${selectedSubTasks.size} sous-tâche${selectedSubTasks.size > 1 ? 's' : ''}`}
          </button>
          <button onClick={() => router.push('/tasks')}
            className="w-full rounded-xl py-[14px] text-[15px] font-medium text-[#8e8e93]">
            Passer
          </button>
        </div>
      </div>
    );
  }

  if (mode === 'advanced') {
    return (
      <div className="pt-4">
        <div className="flex items-center justify-between px-4 mb-4">
          <button onClick={() => setMode('yova')} className="text-[17px] font-medium" style={{ color: '#007aff' }}>← Mode rapide</button>
          <h2 className="text-[17px] font-semibold text-[#1c1c1e]">Nouvelle tâche</h2>
          <div className="w-16" />
        </div>

      {error && (
        <div className="mx-4 mb-4 rounded-xl px-4 py-3 text-[14px]" style={{ background: '#fff2f2', color: '#ff3b30' }}>{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="mx-4 rounded-xl bg-white overflow-hidden" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
          {/* 1. Nom — premier champ, le plus important */}
          <div className="px-4 py-4" style={{ borderBottom: '0.5px solid var(--ios-separator)' }}>
            <label className="text-[13px] text-[#8e8e93] block mb-1">Qu&apos;est-ce que c&apos;est ?</label>
            <input type="text" required maxLength={100} value={name}
              onChange={(e) => { setName(e.target.value); setShowSuggestions(true); setSelectedTemplateId(null); }}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={handleSuggestionKeyDown}
              autoFocus
              className="w-full text-[20px] font-semibold text-[#1c1c1e] bg-transparent outline-none placeholder:text-[#c7c7cc]"
              placeholder="Ex : Préparer le dîner" />

            {/* Autocomplétion intelligente */}
            {templateSuggestions.length > 0 && (
              <div className="mt-2 rounded-lg overflow-hidden" style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.08)', border: '0.5px solid rgba(0,0,0,0.06)' }}>
                {templateSuggestions.map((tpl, i) => {
                  const catOpt = SCORING_CATEGORY_OPTIONS.find((o) => o.value === tpl.scoring_category);
                  const durOpt = DURATION_OPTIONS.find((o) => o.value === tpl.default_duration);
                  const isFocused = focusedSuggestion === i;
                  const usageCount = templateUsage.get(tpl.id) ?? 0;
                  return (
                    <button key={tpl.id} type="button"
                      onClick={() => applyTemplate(tpl)}
                      className="w-full px-3 py-2.5 text-left flex items-center gap-3 transition-colors"
                      style={{
                        background: isFocused ? '#f0f4ff' : 'transparent',
                        borderBottom: i < templateSuggestions.length - 1 ? '0.5px solid var(--ios-separator)' : 'none',
                      }}>
                      <span className="text-[16px] flex-shrink-0">{catOpt?.emoji ?? '📋'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[15px] text-[#1c1c1e] truncate">
                          {highlightMatch(tpl.name, name.trim())}
                        </p>
                        <p className="text-[11px] text-[#8e8e93]">
                          {durOpt?.label ?? ''}
                          {usageCount > 0 && <span className="ml-2 text-[10px] font-semibold text-[#34c759]">✓ {usageCount}×</span>}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 2. Type de tâche — auto-détecté + modifiable */}
          <div className="px-4 py-3" style={{ borderBottom: '0.5px solid var(--ios-separator)' }}>
            <div className="flex items-center gap-2 mb-2">
              <label className="text-[13px] text-[#8e8e93]">Type</label>
              {autoDetected && (
                <span className="text-[11px] font-medium" style={{ color: '#34c759' }}>Détecté auto</span>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {SCORING_CATEGORY_OPTIONS.map((opt) => (
                <button key={opt.value} type="button" onClick={() => { setScoringCategory(opt.value); setAutoDetected(false); }}
                  className="rounded-full px-2.5 py-1 text-[12px] font-medium transition-all"
                  style={scoringCategory === opt.value
                    ? { background: '#007aff', color: 'white' }
                    : { background: '#f0f2f8', color: '#3c3c43' }
                  }>
                  {opt.emoji} {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 3. Durée */}
          <div className="px-4 py-3" style={{ borderBottom: '0.5px solid var(--ios-separator)' }}>
            <label className="text-[13px] text-[#8e8e93] block mb-2">Durée estimée</label>
            <div className="flex gap-1.5">
              {DURATION_OPTIONS.map((opt) => (
                <button key={opt.value} type="button" onClick={() => setDuration(opt.value)}
                  className="flex-1 rounded-lg py-2 text-[12px] font-medium text-center transition-all"
                  style={duration === opt.value ? { background: '#007aff', color: 'white' } : { background: '#f0f2f8', color: '#3c3c43' }}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 4. Effort physique */}
          <div className="px-4 py-3" style={{ borderBottom: '0.5px solid var(--ios-separator)' }}>
            <label className="text-[13px] text-[#8e8e93] block mb-2">Effort physique</label>
            <div className="flex gap-1.5">
              {PHYSICAL_OPTIONS.map((opt) => (
                <button key={opt.value} type="button" onClick={() => setPhysical(opt.value)}
                  className="flex-1 rounded-lg py-2 text-[12px] font-medium text-center transition-all"
                  style={physical === opt.value ? { background: '#007aff', color: 'white' } : { background: '#f0f2f8', color: '#3c3c43' }}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 5. Fréquence */}
          <div className="px-4 py-3" style={{ borderBottom: '0.5px solid var(--ios-separator)' }}>
            <label className="text-[13px] text-[#8e8e93] block mb-1">Fréquence</label>
            <select value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)}
              className="w-full text-[17px] text-[#1c1c1e] bg-transparent outline-none">
              {FREQUENCY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {frequency === 'custom' && (
            <div className="px-4 py-3" style={{ borderBottom: '0.5px solid var(--ios-separator)' }}>
              <label className="text-[13px] text-[#8e8e93] block mb-1">Intervalle en jours</label>
              <input type="number" min={1} max={365} value={customIntervalDays}
                onChange={(e) => setCustomIntervalDays(e.target.value)}
                className="w-full text-[17px] text-[#1c1c1e] bg-transparent outline-none placeholder:text-[#c7c7cc]"
                placeholder="Ex : 10" />
            </div>
          )}

          {/* 6. Assignation */}
          <div className="px-4 py-3" style={{ borderBottom: '0.5px solid var(--ios-separator)' }}>
            <label className="text-[13px] text-[#8e8e93] block mb-1">Assigner à</label>
            <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}
              className="w-full text-[17px] text-[#1c1c1e] bg-transparent outline-none">
              <option value="">Non assigné</option>
              {allMembers.map((m) => (<option key={m.id} value={m.id}>{m.isPhantom ? '👻 ' : ''}{m.display_name}</option>))}
            </select>
          </div>

          {/* 7. Date / Heure */}
          <div className="px-4 py-3 flex gap-3">
            <div className="flex-1">
              <label className="text-[13px] text-[#8e8e93] block mb-1">Date prévue</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
                className="w-full text-[15px] text-[#1c1c1e] bg-transparent outline-none" />
            </div>
            <div className="w-24">
              <label className="text-[13px] text-[#8e8e93] block mb-1">Heure</label>
              <input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)}
                className="w-full text-[15px] text-[#1c1c1e] bg-transparent outline-none" />
            </div>
          </div>
        </div>

        {/* Score — slider utilisateur */}
        {name.trim() && (
          <div className="mx-4 rounded-2xl overflow-hidden" style={{ background: 'white', boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
            {/* Slider principal */}
            <div className="p-4 pb-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[13px] font-semibold text-[#8e8e93] uppercase tracking-wide">Score</p>
                <span className="text-[28px] font-bold" style={{ color: scoreColor10(userScore ?? algoScore10) }}>
                  {userScore ?? algoScore10}<span className="text-[14px] text-[#8e8e93] font-normal">/10</span>
                </span>
              </div>
              <p className="text-[12px] text-[#8e8e93] mb-3">
                Pré-rempli par notre algo. Ajustez selon votre ressenti.
              </p>

              {/* Slider */}
              <div className="relative">
                <input
                  type="range"
                  min={0}
                  max={10}
                  step={1}
                  value={userScore ?? algoScore10}
                  onChange={(e) => {
                    setUserScore(parseInt(e.target.value, 10));
                    setUserHasAdjusted(true);
                  }}
                  className="w-full h-2 rounded-full appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, #34c759 0%, #ff9500 50%, #ff3b30 100%)`,
                    accentColor: scoreColor10(userScore ?? algoScore10),
                  }}
                />
                <div className="flex justify-between mt-1 px-0.5">
                  <span className="text-[10px] text-[#c7c7cc]">Légère</span>
                  <span className="text-[10px] text-[#c7c7cc]">Lourde</span>
                </div>
              </div>

              {/* Indicateur si l'utilisateur a modifié vs algo */}
              {userHasAdjusted && userScore !== algoScore10 && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[11px] text-[#8e8e93]">
                    Algo suggère {algoScore10}/10
                  </span>
                  <button
                    type="button"
                    onClick={() => { setUserScore(algoScore10); setUserHasAdjusted(false); }}
                    className="text-[11px] font-medium"
                    style={{ color: '#007aff' }}
                  >
                    Restaurer
                  </button>
                </div>
              )}
            </div>

            {/* Détail algo (repliable) */}
            <details className="group">
              <summary className="px-4 py-2 text-[12px] font-medium cursor-pointer select-none" style={{ color: '#007aff', borderTop: '0.5px solid var(--ios-separator)' }}>
                Voir le détail du calcul
              </summary>
              <div className="px-4 pb-4 pt-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[12px] text-[#8e8e93]">Score algo</span>
                  <div className="flex items-center gap-1">
                    <span className="text-[11px]">{dominantEmoji(score.dominant)}</span>
                    <span className="text-[15px] font-bold" style={{ color: globalColor }}>{score.global_score}</span>
                    <span className="text-[11px] text-[#8e8e93]">/ 36</span>
                  </div>
                </div>
                <p className="text-[12px] font-medium mb-2" style={{ color: globalColor }}>{score.global_label}</p>
                <div className="space-y-1.5">
                  <ScoreBar label="⏱ Temps" value={score.time_score} max={8} sublabel={timeLabel(score.time_score)} />
                  <ScoreBar label="💪 Physique" value={score.physical_score} max={5} sublabel={physicalLabel(score.physical_score)} />
                  <ScoreBar label="🧠 Mental" value={score.mental_load_score} max={18} sublabel={mentalLabel(score.mental_load_score)} />
                  <ScoreBar label="👨‍👩‍👧 Impact" value={score.household_impact_score} max={4} sublabel={impactLabel(score.household_impact_score)} />
                </div>
              </div>
            </details>
          </div>
        )}

        {/* Options avancées */}
        <div className="px-4">
          <button type="button" onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-[14px] font-medium" style={{ color: '#007aff' }}>
            {showAdvanced ? '▾ Masquer les options avancées' : '▸ Options avancées'}
          </button>
        </div>

        {showAdvanced && (
          <div className="mx-4 rounded-xl bg-white overflow-hidden" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
            {/* Assignation fixe / variable */}
            <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '0.5px solid var(--ios-separator)' }}>
              <div>
                <p className="text-[15px] text-[#1c1c1e]">Assignation fixe</p>
                <p className="text-[11px] text-[#c7c7cc]">{isFixedAssignment ? 'Toujours la même personne' : 'Rotation possible entre membres'}</p>
              </div>
              <button type="button" onClick={() => setIsFixedAssignment(!isFixedAssignment)}
                className="relative w-[51px] h-[31px] rounded-full transition-colors"
                style={{ background: isFixedAssignment ? '#007aff' : '#e5e5ea' }}>
                <span className="absolute top-[2px] w-[27px] h-[27px] rounded-full bg-white shadow transition-transform"
                  style={{ left: isFixedAssignment ? '22px' : '2px' }} />
              </button>
            </div>

            {/* Notifications */}
            <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '0.5px solid var(--ios-separator)' }}>
              <div>
                <p className="text-[15px] text-[#1c1c1e]">Rappels</p>
                <p className="text-[11px] text-[#c7c7cc]">{notificationsEnabled ? 'Notifications activées' : 'Pas de rappel pour cette tâche'}</p>
              </div>
              <button type="button" onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                className="relative w-[51px] h-[31px] rounded-full transition-colors"
                style={{ background: notificationsEnabled ? '#34c759' : '#e5e5ea' }}>
                <span className="absolute top-[2px] w-[27px] h-[27px] rounded-full bg-white shadow transition-transform"
                  style={{ left: notificationsEnabled ? '22px' : '2px' }} />
              </button>
            </div>

            {/* Date de début différée */}
            <div className="px-4 py-3">
              <label className="text-[13px] text-[#8e8e93] block mb-1">Date de début différée</label>
              <input type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)}
                className="w-full text-[15px] text-[#1c1c1e] bg-transparent outline-none" />
              <p className="text-[11px] text-[#c7c7cc] mt-1">La tâche n&apos;apparaîtra qu&apos;à partir de cette date</p>
            </div>
          </div>
        )}

        {/* Créer */}
        <div className="px-4 pt-2 pb-8">
          <button type="submit" disabled={creating}
            className="w-full rounded-xl py-[14px] text-[17px] font-semibold text-white disabled:opacity-50"
            style={{ background: '#007aff' }}>
            {creating ? 'Création...' : 'Créer la tâche'}
          </button>
        </div>
        </form>
      </div>
    );
  }

  return null;
}

function ScoreBar({ label, value, max, sublabel }: { label: string; value: number; max: number; sublabel: string }) {
  const pct = Math.min(100, (value / max) * 100);
  const color = pct <= 33 ? '#34c759' : pct <= 66 ? '#ff9500' : '#ff3b30';
  return (
    <div className="flex items-center gap-3">
      <span className="text-[12px] w-20 flex-shrink-0">{label}</span>
      <div className="flex-1 h-2 rounded-full" style={{ background: '#f0f2f8' }}>
        <div className="h-2 rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-[11px] text-[#8e8e93] w-16 text-right flex-shrink-0">{sublabel}</span>
    </div>
  );
}
