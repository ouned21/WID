'use client';

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import DeleteButton from '@/components/DeleteButton';
import { useAuthStore } from '@/stores/authStore';
import { useTaskStore } from '@/stores/taskStore';
import { useHouseholdStore } from '@/stores/householdStore';
import { createClient } from '@/lib/supabase';

// =============================================================================
// TYPES
// =============================================================================

type Equipment = {
  id: string;
  name: string;
  icon: string;
  category: string;
  is_default: boolean;
};

type FamilyMember = {
  id: string;
  type: 'adult' | 'teen' | 'child' | 'baby' | 'pet';
  emoji: string;
  name: string;
  birthdate?: string;   // YYYY-MM-DD
  school_class?: string;
  allergies?: string;   // virgule-séparé
  activities?: string;  // virgule-séparé
  notes?: string;
  expanded?: boolean;   // UI : détails dépliés
};

type TaskTemplate = {
  id: string;
  name: string;
  scoring_category: string;
  default_frequency: string;
  default_duration?: string;
  default_physical?: string;
  default_mental_load_score?: number;
  sort_order?: number;
  equipment_tags?: string[];
};

type Step =
  | 'equipment'  // Écran 1 : Sélection équipements
  | 'family'     // Écran 2 : Composition familiale
  | 'thinking'   // Écran 3 : Yova crée les tâches en silence
  | 'results';   // Écran 4 : Résultats

// =============================================================================
// CONSTANTS
// =============================================================================

const EQUIPMENT_CATEGORY_LABELS: Record<string, string> = {
  cuisine: '🍳 Cuisine',
  salle_de_bain: '🚿 Salle de bain',
  linge: '👕 Linge',
  sols: '🧹 Sols & Ménage',
  exterieur: '🌿 Extérieur',
  vehicule: '🚗 Véhicule',
  animaux: '🐾 Animaux',
};

const SCORING_CAT_DISPLAY: Record<string, { label: string; emoji: string }> = {
  meals:                { label: 'Cuisine',       emoji: '🍳' },
  cleaning:             { label: 'Ménage',         emoji: '🧹' },
  tidying:              { label: 'Rangement',      emoji: '🗂' },
  shopping:             { label: 'Courses',        emoji: '🛒' },
  laundry:              { label: 'Linge',          emoji: '👕' },
  children:             { label: 'Enfants',        emoji: '🧒' },
  admin:                { label: 'Admin',          emoji: '📋' },
  outdoor:              { label: 'Extérieur',      emoji: '🌿' },
  hygiene:              { label: 'Hygiène',        emoji: '🚿' },
  pets:                 { label: 'Animaux',        emoji: '🐾' },
  vehicle:              { label: 'Voiture',        emoji: '🚗' },
  household_management: { label: 'Gestion foyer',  emoji: '🏠' },
};

const SCORING_TO_CAT_ID: Record<string, string> = {
  cleaning:             '11111111-1111-1111-1111-111111111111',
  tidying:              '22222222-2222-2222-2222-222222222222',
  shopping:             '33333333-3333-3333-3333-333333333333',
  laundry:              '44444444-4444-4444-4444-444444444444',
  children:             '55555555-5555-5555-5555-555555555555',
  meals:                '66666666-6666-6666-6666-666666666666',
  admin:                '77777777-7777-7777-7777-777777777777',
  outdoor:              '88888888-8888-8888-8888-888888888888',
  hygiene:              '99999999-9999-9999-9999-999999999999',
  pets:                 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  vehicle:              'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  household_management: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
  transport:            'dddddddd-dddd-dddd-dddd-dddddddddddd',
};

const FAMILY_TYPES = [
  { type: 'adult' as const, emoji: '👤', label: 'Adulte' },
  { type: 'teen' as const, emoji: '🧑', label: 'Ado (13-17)' },
  { type: 'child' as const, emoji: '🧒', label: 'Enfant (3-12)' },
  { type: 'baby' as const, emoji: '👶', label: 'Bébé (0-2)' },
  { type: 'pet' as const, emoji: '🐶', label: 'Animal' },
];

const FREQ_WINDOW: Record<string, number> = {
  daily: 1, weekly: 7, biweekly: 14, monthly: 30,
  quarterly: 90, semiannual: 180, yearly: 365,
};

// =============================================================================
// PAGE
// =============================================================================

export default function OnboardingPage() {
  const router = useRouter();
  const { profile, refreshProfile, isPremium } = useAuthStore();
  const { fetchTasks } = useTaskStore();
  const { fetchHousehold, allMembers } = useHouseholdStore();

  const [step, setStep] = useState<Step>('equipment');

  // ── Équipements ──
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<Set<string>>(new Set());

  // ── Famille ──
  const [family, setFamily] = useState<FamilyMember[]>([]);

  // ── Catalogue ──
  const [catalogTemplates, setCatalogTemplates] = useState<TaskTemplate[]>([]);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<Set<string>>(new Set());
  // Templates "vus" = pré-sélectionnés au départ. Ils restent visibles même si décochés.
  const [shownTemplateIds, setShownTemplateIds] = useState<Set<string>>(new Set());
  const [customTaskInput, setCustomTaskInput] = useState('');
  const [customTaskNames, setCustomTaskNames] = useState<string[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [showAllTemplates, setShowAllTemplates] = useState(false);

  // ── Résultats ──
  const [generatedTasks, setGeneratedTasks] = useState<{
    id: string; name: string; category_id: string;
    category_name?: string; category_icon?: string; category_color?: string;
    next_due_at?: string | null; frequency?: string;
  }[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [householdCreating, setHouseholdCreating] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [journalConsent, setJournalConsent] = useState(false);
  const [consentDetailsOpen, setConsentDetailsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Assignments inline (écran résultats) ──
  // { taskId → { userId } | { phantomId } | null }
  type Assignment = { userId: string; phantomId?: never } | { phantomId: string; userId?: never } | null;
  const [assignments, setAssignments] = useState<Record<string, Assignment>>({});

  const assignTask = useCallback(async (taskId: string, assign: Assignment) => {
    // Mise à jour optimiste immédiate
    setAssignments((prev) => ({ ...prev, [taskId]: assign }));
    const supabase = createClient();
    await supabase.from('household_tasks').update({
      assigned_to: assign && 'userId' in assign ? assign.userId : null,
      assigned_to_phantom_id: assign && 'phantomId' in assign ? assign.phantomId : null,
    }).eq('id', taskId);
  }, []);

  const householdId = profile?.household_id;
  const userId = profile?.id;

  // ── Créer le foyer via API route (service role, bypass RLS) ──
  // Lancé dès que le profil est chargé et que household_id est absent.
  useEffect(() => {
    if (!userId || householdId) return; // déjà un foyer, ou pas encore authentifié
    setHouseholdCreating(true);
    fetch('/api/onboarding/create-household', { method: 'POST' })
      .then((r) => r.json())
      .then(async (data) => {
        if (data.ok) {
          await refreshProfile();
        } else {
          console.error('[onboarding] create-household failed:', data.error);
          setError(data.error ?? 'Impossible de créer le foyer. Recharge la page.');
        }
      })
      .catch((e) => {
        console.error('[onboarding] create-household error:', e);
        setError('Erreur réseau. Vérifie ta connexion et recharge la page.');
      })
      .finally(() => setHouseholdCreating(false));
  }, [userId, householdId, refreshProfile]);

  // ── Charger les équipements ──
  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from('onboarding_equipment')
        .select('*')
        .order('sort_order');
      if (data) {
        setEquipment(data as Equipment[]);
        const defaults = new Set<string>();
        for (const eq of data as Equipment[]) {
          if (eq.is_default) defaults.add(eq.id);
        }
        setSelectedEquipment(defaults);
      }
    }
    load();
  }, []);

  // ── Charger le catalogue ──
  const loadCatalogTemplates = useCallback(async () => {
    setCatalogLoading(true);
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from('task_templates')
        .select('id, name, scoring_category, default_frequency, default_duration, default_physical, default_mental_load_score, sort_order, equipment_tags')
        .eq('is_system', true)
        .order('sort_order');

      if (!data) return;
      setCatalogTemplates(data as TaskTemplate[]);

      // Catégories à exclure selon la composition familiale
      const hasKids = family.some((m) => m.type === 'child' || m.type === 'baby' || m.type === 'teen');
      const hasPets = family.some((m) => m.type === 'pet');
      const excludedCategories = new Set<string>();
      if (!hasKids) excludedCategories.add('children');
      if (!hasPets) excludedCategories.add('pets');

      // Pré-sélection : 1 tâche macro par catégorie parmi celles qui matchent
      // → démarre avec ~10-12 tâches essentielles. L'utilisateur affinera
      // au fil de l'usage via /tasks/catalog (pas d'écran d'arbitrage ici).
      const equipIds = [...selectedEquipment];
      const MAX_PER_CATEGORY = 1;
      const countByCategory: Record<string, number> = {};
      const preSelected = new Set<string>();
      // Les templates sont déjà triés par sort_order → on prend les premiers par catégorie
      for (const t of data as TaskTemplate[]) {
        const cat = t.scoring_category ?? 'other';
        // Exclure les catégories non pertinentes pour cette famille
        if (excludedCategories.has(cat)) continue;
        const tags = t.equipment_tags ?? [];
        const isUniversal = tags.length === 0;
        const matchesEquipment = tags.some((tag) => equipIds.includes(tag));
        if (!isUniversal && !matchesEquipment) continue;
        if ((countByCategory[cat] ?? 0) >= MAX_PER_CATEGORY) continue;
        countByCategory[cat] = (countByCategory[cat] ?? 0) + 1;
        preSelected.add(t.id);
      }
      setSelectedTemplateIds(preSelected);
      // Mémoriser les templates pré-sélectionnés — ils restent visibles même si décochés
      setShownTemplateIds(new Set(preSelected));
    } finally {
      setCatalogLoading(false);
    }
  }, [selectedEquipment, family]);

  // Auto-déclenche la création une fois les templates chargés en thinking
  const autoCreateTriggered = useRef(false);
  useEffect(() => {
    if (step !== 'thinking') {
      autoCreateTriggered.current = false;
      return;
    }
    if (catalogLoading || isCreating || householdCreating) return;
    if (catalogTemplates.length === 0) return;
    if (autoCreateTriggered.current) return;
    autoCreateTriggered.current = true;
    void createFromCatalog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, catalogLoading, catalogTemplates.length, isCreating, householdCreating]);

  // ── Grouper le catalogue par catégorie ──
  const catalogGroups = useMemo(() => {
    const groups: Record<string, TaskTemplate[]> = {};
    for (const t of catalogTemplates) {
      const cat = t.scoring_category ?? 'other';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(t);
    }
    return groups;
  }, [catalogTemplates]);

  // ── Grouper les équipements ──
  const groupedEquipment = useMemo(() => {
    const groups: Record<string, Equipment[]> = {};
    for (const eq of equipment) {
      if (!groups[eq.category]) groups[eq.category] = [];
      groups[eq.category].push(eq);
    }
    return groups;
  }, [equipment]);

  // ── Toggles ──
  const toggleEquipment = useCallback((id: string) => {
    setSelectedEquipment((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleTemplate = useCallback((id: string) => {
    setSelectedTemplateIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const addCustomTask = useCallback(() => {
    const name = customTaskInput.trim();
    if (!name) return;
    setCustomTaskNames((prev) => [...prev, name]);
    setCustomTaskInput('');
  }, [customTaskInput]);

  // ── Gestion famille ──
  const addFamilyMember = useCallback((type: FamilyMember['type'], emoji: string) => {
    setFamily((prev) => [...prev, { id: `f-${Date.now()}-${Math.random()}`, type, emoji, name: '' }]);
  }, []);

  const updateFamilyMember = useCallback((id: string, field: keyof FamilyMember, value: string) => {
    setFamily((prev) => prev.map((m) => (m.id === id ? { ...m, [field]: value } : m)));
  }, []);

  const toggleFamilyMemberExpanded = useCallback((id: string) => {
    setFamily((prev) => prev.map((m) => (m.id === id ? { ...m, expanded: !m.expanded } : m)));
  }, []);

  const removeFamilyMember = useCallback((id: string) => {
    setFamily((prev) => prev.filter((m) => m.id !== id));
  }, []);

  // ── Créer les tâches depuis le catalogue via API route (service role, bypass RLS) ──
  const createFromCatalog = useCallback(async () => {
    // Attendre que le foyer soit prêt si la création est en cours
    if (householdCreating) return;

    // Si householdId est encore absent malgré la fin du useEffect, tenter un dernier refresh
    let resolvedHouseholdId = householdId;
    if (!resolvedHouseholdId && userId) {
      await refreshProfile();
      resolvedHouseholdId = useAuthStore.getState().profile?.household_id ?? null;
    }
    if (!resolvedHouseholdId || !userId) {
      setError('Foyer introuvable. Recharge la page.');
      return;
    }
    setIsCreating(true);
    setError(null);

    try {
      const supabase = createClient();

      // Lire les catégories (lecture publique, pas de RLS)
      const { data: categories } = await supabase.from('task_categories').select('*').order('sort_order');
      const catMap = new Map<string, { id: string; name: string; icon: string; color_hex: string }>();
      for (const cat of (categories ?? [])) catMap.set(cat.id, cat);
      const defaultCatId = categories?.[0]?.id ?? '11111111-1111-1111-1111-111111111111';

      // Éviter les doublons avec les tâches existantes
      const { data: existingTasks } = await supabase
        .from('household_tasks').select('name').eq('household_id', resolvedHouseholdId).eq('is_active', true);
      const seen = new Set<string>((existingTasks ?? []).map((t: { name: string }) => t.name.toLowerCase()));

      type TaskRow = {
        name: string; category_id: string; frequency: string; mental_load_score: number;
        scoring_category: string; duration_estimate: string; physical_effort: string;
        is_active: boolean; is_fixed_assignment: boolean; notifications_enabled: boolean;
        assigned_to: null; next_due_at: string;
      };
      type CreatedMeta = { catId: string; cat: { id: string; name: string; icon: string; color_hex: string } | undefined; nextDueIso: string; frequency: string };

      const rowsToInsert: TaskRow[] = [];
      const metaByName: Record<string, CreatedMeta> = {};

      for (const t of catalogTemplates.filter((t) => selectedTemplateIds.has(t.id))) {
        const key = t.name.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        const catId = SCORING_TO_CAT_ID[t.scoring_category ?? ''] || defaultCatId;
        const freq = t.default_frequency || 'weekly';
        const dayOffset = freq === 'daily' ? 0 : Math.floor(Math.random() * (FREQ_WINDOW[freq] ?? 30));
        const nextDue = new Date(Date.now() + dayOffset * 86400000);
        nextDue.setHours(9, 0, 0, 0);
        const nextDueIso = nextDue.toISOString();
        rowsToInsert.push({
          name: t.name, category_id: catId, frequency: freq,
          mental_load_score: t.default_mental_load_score ?? 3,
          scoring_category: t.scoring_category ?? 'cleaning',
          duration_estimate: t.default_duration ?? 'short',
          physical_effort: t.default_physical ?? 'medium',
          is_active: true, is_fixed_assignment: false, notifications_enabled: true,
          assigned_to: null, next_due_at: nextDueIso,
        });
        metaByName[t.name] = { catId, cat: catMap.get(catId), nextDueIso, frequency: freq };
      }

      for (const name of customTaskNames) {
        const key = name.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        const nextDue = new Date(Date.now() + 7 * 86400000);
        nextDue.setHours(9, 0, 0, 0);
        const nextDueIso = nextDue.toISOString();
        rowsToInsert.push({
          name, category_id: defaultCatId, frequency: 'weekly', mental_load_score: 3,
          scoring_category: 'cleaning', duration_estimate: 'short', physical_effort: 'medium',
          is_active: true, is_fixed_assignment: false, notifications_enabled: true,
          assigned_to: null, next_due_at: nextDueIso,
        });
        metaByName[name] = { catId: defaultCatId, cat: catMap.get(defaultCatId), nextDueIso, frequency: 'weekly' };
      }

      // Appel API route (service role, contourne RLS)
      const phantomMembers = family
        .filter((m) => m.type !== 'pet' && m.name.trim())
        .map((m) => ({
          display_name: m.name.trim(),
          member_type: m.type === 'baby' || m.type === 'teen' ? 'child' : m.type,
          birth_date: m.birthdate ?? null,
          school_class: m.school_class?.trim() || null,
          specifics: {
            allergies: m.allergies ? m.allergies.split(',').map((s) => s.trim()).filter(Boolean) : [],
            activities: m.activities ? m.activities.split(',').map((s) => ({ name: s.trim() })).filter((a) => a.name) : [],
            notes: m.notes?.trim() || undefined,
          },
        }));

      const res = await fetch('/api/onboarding/create-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskRows: rowsToInsert, phantomMembers, customSuggestions: customTaskNames }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? `Erreur ${res.status}`);
      }

      const { tasks: insertedTasks } = await res.json() as { tasks: { id: string; name: string }[] };

      const created = (insertedTasks ?? []).map((t) => {
        const meta = metaByName[t.name];
        return {
          id: t.id, name: t.name,
          category_id: meta?.catId ?? defaultCatId,
          category_name: meta?.cat?.name,
          category_icon: meta?.cat?.icon,
          category_color: meta?.cat?.color_hex,
          next_due_at: meta?.nextDueIso,
          frequency: meta?.frequency ?? 'weekly',
        };
      });

      setGeneratedTasks(created);
      await fetchHousehold(resolvedHouseholdId);
      await fetchTasks(resolvedHouseholdId);
      setStep('results');
    } catch (err) {
      console.error('[onboarding] Erreur:', err);
      setError(err instanceof Error ? err.message : 'Une erreur est survenue. Réessaie.');
    } finally {
      setIsCreating(false);
    }
  }, [householdId, userId, householdCreating, catalogTemplates, selectedTemplateIds, customTaskNames, family, fetchHousehold, fetchTasks, refreshProfile]);

  const handleFinish = useCallback(async () => {
    if (finishing) return;
    setFinishing(true);
    if (journalConsent && userId && !profile?.ai_journal_consent_at) {
      const supabase = createClient();
      await supabase
        .from('profiles')
        .update({ ai_journal_consent_at: new Date().toISOString() })
        .eq('id', userId);
      await refreshProfile();
    }
    router.push('/today');
  }, [finishing, router, journalConsent, userId, profile?.ai_journal_consent_at, refreshProfile]);

  const deleteTask = useCallback(async (taskId: string) => {
    setGeneratedTasks((prev) => prev.filter((t) => t.id !== taskId));
    const supabase = createClient();
    const { error } = await supabase.from('household_tasks').delete().eq('id', taskId);
    if (error) {
      console.error('[onboarding] deleteTask failed:', error.message);
      // Restaurer la tâche en cas d'erreur (recharger depuis le store serait idéal, ici on log)
    }
  }, []);

  // =============================================================================
  // RENDER
  // =============================================================================

  // ─── Écran 1 : Équipements ───
  if (step === 'equipment') {
    return (
      <div className="pt-4 pb-28">
        <div className="px-4 mb-6">
          <p className="text-[12px] text-[#8e8e93] font-semibold uppercase tracking-wide mb-2">Étape 1 / 3</p>
          <h2 className="text-[26px] font-black text-[#1c1c1e] leading-tight">
            Qu&apos;as-tu dans<br />ton foyer ?
          </h2>
          <p className="text-[14px] text-[#8e8e93] mt-2">
            Tape sur tout ce que tu possèdes.
          </p>
        </div>

        {Object.entries(groupedEquipment).map(([category, items]) => (
          <div key={category} className="mb-5">
            <p className="text-[13px] font-bold text-[#1c1c1e] mb-2 px-5">
              {EQUIPMENT_CATEGORY_LABELS[category] ?? category}
            </p>
            <div className="flex flex-wrap gap-2 px-4">
              {items.map((eq) => {
                const selected = selectedEquipment.has(eq.id);
                return (
                  <button
                    key={eq.id}
                    onClick={() => toggleEquipment(eq.id)}
                    className="flex items-center gap-2 rounded-2xl px-4 py-3 text-[14px] font-semibold transition-all active:scale-[0.95]"
                    style={{
                      background: selected ? 'linear-gradient(135deg, #007aff, #5856d6)' : 'white',
                      color: selected ? 'white' : '#1c1c1e',
                      boxShadow: selected
                        ? '0 4px 16px rgba(0,122,255,0.3)'
                        : '0 1px 4px rgba(0,0,0,0.06)',
                    }}
                  >
                    <span className="text-[22px]">{eq.icon}</span>
                    <span>{eq.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <div className="fixed bottom-0 left-0 right-0 px-4 pb-6 pt-3"
          style={{ background: 'linear-gradient(transparent, #f6f8ff 30%)' }}>
          <button
            onClick={() => setStep('family')}
            disabled={selectedEquipment.size === 0}
            className="w-full rounded-2xl py-[16px] text-[17px] font-bold text-white disabled:opacity-40"
            style={{
              background: 'linear-gradient(135deg, #007aff, #5856d6)',
              boxShadow: '0 8px 24px rgba(0,122,255,0.3)',
            }}
          >
            Continuer ({selectedEquipment.size}) →
          </button>
        </div>
      </div>
    );
  }

  // ─── Écran 2 : Famille ───
  if (step === 'family') {
    const needsBirthdate = (type: FamilyMember['type']) => type !== 'pet';
    // Membres humains (pas animaux) — ceux qui deviennent des fantômes
    const humanMembers = family.filter((m) => m.type !== 'pet');
    const petMembers = family.filter((m) => m.type === 'pet');

    // Validation : tous les membres humains ont un prénom
    const hasUnnamedHuman = humanMembers.some((m) => !m.name.trim());

    // TODO: réactiver la limite freemium (1 membre) au lancement commercial
    const atFreeLimit = false;

    // Compte les membres valides pour le bouton
    const validHumans = humanMembers.filter((m) => m.name.trim()).length;
    const canContinue = !hasUnnamedHuman; // peut continuer avec 0 membres aussi (foyer solo)

    return (
      <div className="pt-4 pb-28">
        <div className="px-4 mb-6">
          <button
            onClick={() => setStep('equipment')}
            className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[14px] font-semibold mb-4 active:opacity-70"
            style={{ background: 'rgba(0,122,255,0.10)', color: '#007aff' }}>
            <svg width="8" height="14" viewBox="0 0 8 14" fill="none"><path d="M7 1L1 7L7 13" stroke="#007aff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Retour
          </button>
          <p className="text-[12px] text-[#8e8e93] font-semibold uppercase tracking-wide mb-2">Étape 2 / 3</p>
          <h2 className="text-[26px] font-black text-[#1c1c1e] leading-tight">
            Qui vit<br />avec toi ?
          </h2>
          <p className="text-[14px] text-[#8e8e93] mt-2">
            Tape pour ajouter chaque membre.
          </p>
        </div>

        {/* Chips type de membre */}
        <div className="mx-4 mb-4">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {FAMILY_TYPES.map((ft) => {
              const isPet = ft.type === 'pet';
              // Bloquer l'ajout d'humains si limite free atteinte
              const blocked = !isPet && atFreeLimit;
              return (
                <button
                  key={ft.type}
                  onClick={() => !blocked && addFamilyMember(ft.type, ft.emoji)}
                  className="flex-shrink-0 flex flex-col items-center gap-1 rounded-2xl px-4 py-3 bg-white relative"
                  style={{
                    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                    opacity: blocked ? 0.45 : 1,
                  }}
                >
                  <span className="text-[32px]">{ft.emoji}</span>
                  <span className="text-[11px] font-semibold text-[#1c1c1e]">{ft.label}</span>
                  {blocked && (
                    <span className="absolute -top-1 -right-1 text-[10px] bg-[#ff9500] text-white rounded-full w-4 h-4 flex items-center justify-center font-bold">🔒</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Message upsell si limite free atteinte */}
          {atFreeLimit && (
            <div className="mt-2 rounded-xl px-3 py-2.5 flex items-center gap-2"
              style={{ background: '#fff8e6', border: '1px solid #ffcc00' }}>
              <span className="text-[16px]">🔒</span>
              <div>
                <p className="text-[12px] font-bold" style={{ color: '#b8860b' }}>
                  Plan Free — 1 membre maximum
                </p>
                <p className="text-[11px]" style={{ color: '#b8860b' }}>
                  Passe au plan Foyer pour ajouter enfants et autres adultes.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Liste des membres */}
        {family.length > 0 && (
          <div className="mx-4 space-y-2">
            {family.map((m) => {
              const isPet = m.type === 'pet';
              const isEmpty = !m.name.trim();
              const isExpanded = m.expanded ?? false;
              return (
                <div key={m.id} className="rounded-2xl bg-white overflow-hidden" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  {/* Ligne principale */}
                  <div className="px-4 py-3 flex items-center gap-3">
                    <span className="text-[28px]">{m.emoji}</span>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={m.name}
                          onChange={(e) => updateFamilyMember(m.id, 'name', e.target.value)}
                          placeholder={isPet ? 'Nom (optionnel)' : 'Prénom *'}
                          className="flex-1 text-[15px] font-semibold text-[#1c1c1e] bg-transparent outline-none"
                        />
                        {!isPet && isEmpty && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md flex-shrink-0"
                            style={{ background: '#fff2f2', color: '#ff3b30' }}>requis</span>
                        )}
                      </div>
                      {needsBirthdate(m.type) && (
                        <input
                          type="date"
                          value={m.birthdate ?? ''}
                          onChange={(e) => updateFamilyMember(m.id, 'birthdate', e.target.value)}
                          className="text-[12px] text-[#8e8e93] bg-transparent outline-none"
                        />
                      )}
                      {isPet && (
                        <p className="text-[10px]" style={{ color: '#8e8e93' }}>
                          🐾 Utilisé pour les tâches animaux — pas un compte membre
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => removeFamilyMember(m.id)}
                      className="text-[13px] text-[#ff3b30] font-medium flex-shrink-0"
                    >
                      Retirer
                    </button>
                  </div>

                  {/* Toggle détails — sous la ligne principale */}
                  {!isPet && (
                    <button
                      onClick={() => toggleFamilyMemberExpanded(m.id)}
                      className="w-full text-center text-[12px] font-semibold py-1.5 border-t border-[#f0f2f8] transition-colors"
                      style={{ color: isExpanded ? '#007aff' : '#8e8e93' }}
                    >
                      {isExpanded ? '▲ Moins de détails' : '▼ Ajouter des détails pour Yova'}
                    </button>
                  )}

                  {/* Détails optionnels (collapsible) */}
                  {!isPet && isExpanded && (
                    <div className="border-t border-[#f0f2f8] px-4 py-3 space-y-3">
                      {(m.type === 'child' || m.type === 'teen') && (
                        <div>
                          <label className="text-[11px] text-[#8e8e93] font-semibold uppercase tracking-wide block mb-1">🏫 Classe</label>
                          <input
                            type="text"
                            value={m.school_class ?? ''}
                            onChange={(e) => updateFamilyMember(m.id, 'school_class', e.target.value)}
                            placeholder="Ex : CP, CE2, 6ème, Terminale…"
                            className="w-full text-[14px] text-[#1c1c1e] bg-[#f9f9f9] rounded-lg px-3 py-2 outline-none placeholder:text-[#c7c7cc]"
                          />
                        </div>
                      )}
                      <div>
                        <label className="text-[11px] text-[#8e8e93] font-semibold uppercase tracking-wide block mb-1">⚠️ Allergies</label>
                        <input
                          type="text"
                          value={m.allergies ?? ''}
                          onChange={(e) => updateFamilyMember(m.id, 'allergies', e.target.value)}
                          placeholder="Ex : arachides, gluten (virgule-séparées)"
                          className="w-full text-[14px] text-[#1c1c1e] bg-[#f9f9f9] rounded-lg px-3 py-2 outline-none placeholder:text-[#c7c7cc]"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-[#8e8e93] font-semibold uppercase tracking-wide block mb-1">🎯 Activités</label>
                        <input
                          type="text"
                          value={m.activities ?? ''}
                          onChange={(e) => updateFamilyMember(m.id, 'activities', e.target.value)}
                          placeholder="Ex : danse le mercredi, foot le samedi"
                          className="w-full text-[14px] text-[#1c1c1e] bg-[#f9f9f9] rounded-lg px-3 py-2 outline-none placeholder:text-[#c7c7cc]"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-[#8e8e93] font-semibold uppercase tracking-wide block mb-1">💬 Note libre</label>
                        <textarea
                          value={m.notes ?? ''}
                          onChange={(e) => updateFamilyMember(m.id, 'notes', e.target.value)}
                          rows={2}
                          placeholder="Tout ce qui peut être utile pour Yova…"
                          className="w-full text-[14px] text-[#1c1c1e] bg-[#f9f9f9] rounded-lg px-3 py-2 outline-none resize-none placeholder:text-[#c7c7cc]"
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Note si aucun membre ajouté */}
        {family.length === 0 && (
          <div className="mx-4 rounded-xl px-4 py-3 text-center"
            style={{ background: '#f8f8ff', border: '1px dashed #e0e0f0' }}>
            <p className="text-[13px]" style={{ color: '#8e8e93' }}>
              Tu vis seul·e ? Continue sans ajouter de membre.
            </p>
          </div>
        )}

        <div className="fixed bottom-0 left-0 right-0 px-4 pb-6 pt-3"
          style={{ background: 'linear-gradient(transparent, #f6f8ff 30%)' }}>
          {hasUnnamedHuman && (
            <p className="text-center text-[12px] font-semibold mb-2" style={{ color: '#ff3b30' }}>
              Renseigne le prénom de chaque membre avant de continuer
            </p>
          )}
          <button
            onClick={() => {
              setStep('thinking');
              loadCatalogTemplates();
            }}
            disabled={hasUnnamedHuman}
            className="w-full rounded-2xl py-[16px] text-[17px] font-bold text-white disabled:opacity-40"
            style={{
              background: 'linear-gradient(135deg, #007aff, #5856d6)',
              boxShadow: '0 8px 24px rgba(0,122,255,0.3)',
            }}
          >
            {validHumans > 0
              ? `Continuer (${validHumans} membre${validHumans > 1 ? 's' : ''}) →`
              : 'Continuer en solo →'}
          </button>
        </div>
      </div>
    );
  }

  // ─── Écran 3 : Thinking (création silencieuse) ───
  // Pas d'arbitrage par l'utilisateur : Yova crée ~12 tâches macro depuis les
  // équipements et la famille. L'utilisateur affinera plus tard dans /tasks/catalog.
  if (step === 'thinking') {
    return (
      <div className="min-h-screen flex flex-col" style={{
        background: 'linear-gradient(180deg, #0a1628 0%, #1a2f52 100%)',
      }}>
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
          <div className="h-16 w-16 rounded-full flex items-center justify-center mb-6"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
            <div className="h-6 w-6 animate-spin rounded-full border-[3px] border-white/20 border-t-white" />
          </div>
          <h2 className="text-[24px] font-black text-white text-center leading-tight mb-3">
            Yova organise ton foyer…
          </h2>
          <p className="text-[14px] text-center max-w-[280px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>
            {catalogLoading
              ? 'Analyse de ton foyer…'
              : isCreating
              ? 'Création de tes tâches…'
              : householdCreating
              ? 'Préparation du foyer…'
              : 'Presque prêt.'}
          </p>
        </div>
      </div>
    );
  }

  // ─── Écran 5 : Résultats ───
  if (step === 'results') {
    const FREQ_LABEL: Record<string, string> = {
      daily:       'Chaque jour',
      weekly:      'Chaque semaine',
      biweekly:    'Toutes les 2 sem.',
      monthly:     'Chaque mois',
      quarterly:   'Tous les 3 mois',
      semiannual:  'Tous les 6 mois',
      yearly:      'Chaque année',
    };
    const sortedTasks = [...generatedTasks].sort((a, b) => a.name.localeCompare(b.name, 'fr'));

    return (
      <div className="pt-4 pb-32">
        <div className="px-4 mb-6 text-center">
          <div className="text-[52px] mb-3">✨</div>
          <h2 className="text-[26px] font-black text-[#1c1c1e] leading-tight">
            C&apos;est prêt.
          </h2>
          <p className="text-[14px] text-[#8e8e93] mt-2 max-w-[300px] mx-auto leading-relaxed">
            Yova connaît <strong className="text-[#1c1c1e]">{generatedTasks.length} rythme{generatedTasks.length !== 1 ? 's' : ''}</strong> de ton foyer.
            Elle s&apos;adaptera à mesure qu&apos;elle te connaîtra mieux.
          </p>
        </div>

        <div className="px-4">
          <div className="rounded-2xl bg-white overflow-hidden" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            {sortedTasks.map((t, i) => (
              <div
                key={t.id}
                className="px-4 py-3 flex items-center gap-3"
                style={i < sortedTasks.length - 1 ? { borderBottom: '0.5px solid #f0f2f8' } : {}}
              >
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: t.category_color ?? '#8e8e93' }} />
                <p className="flex-1 text-[14px] font-medium text-[#1c1c1e] truncate">{t.name}</p>
                <p className="text-[11px] text-[#c7c7cc] flex-shrink-0">
                  {FREQ_LABEL[t.frequency ?? 'weekly'] ?? 'Régulier'}
                </p>
              </div>
            ))}
          </div>

          {generatedTasks.length === 0 && (
            <div className="text-center py-8">
              <p className="text-[15px] text-[#8e8e93]">Aucune tâche créée.</p>
            </div>
          )}
        </div>

        {/* Carte consent IA journal — affichée seulement si pas déjà consenti */}
        {!profile?.ai_journal_consent_at && (
          <div className="mx-4 mt-5 rounded-2xl overflow-hidden" style={{ background: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <button
              onClick={() => setConsentDetailsOpen((v) => !v)}
              className="w-full flex items-start gap-3 px-4 py-4 text-left"
              aria-expanded={consentDetailsOpen}>
              <span className="text-[20px] leading-none mt-0.5">🔒</span>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-bold text-[#1c1c1e]">Un dernier point avant de lancer</p>
                <p className="text-[12px] text-[#8e8e93] mt-0.5 leading-relaxed">
                  Yova utilise l&apos;IA <strong>Claude (Anthropic, US)</strong> pour comprendre ton journal.
                  {consentDetailsOpen ? ' Masquer les détails.' : ' Voir les détails.'}
                </p>
              </div>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#8e8e93" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                className="flex-shrink-0 mt-1"
                style={{ transform: consentDetailsOpen ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 0.15s' }}>
                <path d="M4 2l4 4-4 4" />
              </svg>
            </button>
            {consentDetailsOpen && (
              <div className="px-4 pb-3 -mt-1">
                <div className="rounded-xl p-3 text-[11px] leading-relaxed"
                  style={{ background: '#f0f6ff', color: '#3a6fcc' }}>
                  📍 <strong>Envoyé :</strong> ton texte libre + la liste de tes tâches (sans noms réels)<br />
                  🔒 <strong>Conservé :</strong> résultat uniquement, serveurs Supabase (UE)<br />
                  🗑️ <strong>Suppression :</strong> avec ton compte, depuis Profil → Mes données<br />
                  <span className="opacity-75 mt-1 inline-block">RGPD Art. 7 — révocable à tout moment depuis ton profil.</span>
                </div>
              </div>
            )}
            <label className="flex items-center gap-3 px-4 py-3 cursor-pointer" style={{ borderTop: '0.5px solid var(--ios-separator)' }}>
              <input
                type="checkbox"
                checked={journalConsent}
                onChange={(e) => setJournalConsent(e.target.checked)}
                className="flex-shrink-0"
                style={{ width: 20, height: 20, accentColor: '#007aff' }}
              />
              <span className="text-[13px] text-[#1c1c1e] leading-snug">
                J&apos;accepte que mes messages journal soient traités par Yova via Claude.
              </span>
            </label>
          </div>
        )}

        <div className="fixed bottom-0 left-0 right-0 px-4 pb-6 pt-3"
          style={{ background: 'linear-gradient(transparent, #f6f8ff 30%)' }}>
          {(() => {
            // Consent obligatoire pour débloquer le CTA, sauf si déjà consenti précédemment
            const hasConsent = !!profile?.ai_journal_consent_at || journalConsent;
            return (
              <>
                {!hasConsent && (
                  <p className="text-center text-[11px] text-[#8e8e93] mb-2">
                    Accepte le traitement IA ci-dessus pour continuer
                  </p>
                )}
                <button
                  onClick={handleFinish}
                  disabled={!hasConsent || finishing}
                  className="w-full rounded-2xl py-[16px] text-[17px] font-bold text-white disabled:opacity-40 flex items-center justify-center gap-2"
                  style={{
                    background: 'linear-gradient(135deg, #007aff, #5856d6)',
                    boxShadow: hasConsent && !finishing ? '0 8px 24px rgba(0,122,255,0.3)' : 'none',
                  }}
                >
                  {finishing ? (
                    <>
                      <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3"/>
                        <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                      </svg>
                      Lancement…
                    </>
                  ) : 'Commencer avec Yova →'}
                </button>
              </>
            );
          })()}
        </div>
      </div>
    );
  }

  return null;
}
