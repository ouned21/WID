'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
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
  birthdate?: string; // YYYY-MM-DD
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
  | 'baseline'   // Écran 3 : Baseline émotionnelle (qui fait le plus ?)
  | 'catalog'    // Écran 4 : Sélection tâches catalogue
  | 'results';   // Écran 5 : Résultats

type BaselineChoice = 'me' | 'partner' | 'balanced';

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
  const { profile } = useAuthStore();
  const { fetchTasks } = useTaskStore();
  const { fetchHousehold } = useHouseholdStore();

  const [step, setStep] = useState<Step>('equipment');

  // ── Équipements ──
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<Set<string>>(new Set());

  // ── Famille ──
  const [family, setFamily] = useState<FamilyMember[]>([]);

  // ── Baseline ──
  const [baselineChoice, setBaselineChoice] = useState<BaselineChoice | null>(null);

  // ── Catalogue ──
  const [catalogTemplates, setCatalogTemplates] = useState<TaskTemplate[]>([]);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<Set<string>>(new Set());
  const [customTaskInput, setCustomTaskInput] = useState('');
  const [customTaskNames, setCustomTaskNames] = useState<string[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [showAllTemplates, setShowAllTemplates] = useState(false);

  // ── Résultats ──
  const [generatedTasks, setGeneratedTasks] = useState<{
    id: string; name: string; category_id: string;
    category_name?: string; category_icon?: string; category_color?: string;
    next_due_at?: string | null;
  }[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const householdId = profile?.household_id;
  const userId = profile?.id;

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

      // Pré-sélection : templates universels (aucun tag) OU correspondant aux équipements
      const equipIds = [...selectedEquipment];
      const preSelected = new Set<string>();
      for (const t of data as TaskTemplate[]) {
        const tags = t.equipment_tags ?? [];
        const isUniversal = tags.length === 0;
        const matchesEquipment = tags.some((tag) => equipIds.includes(tag));
        if (isUniversal || matchesEquipment) preSelected.add(t.id);
      }
      setSelectedTemplateIds(preSelected);
    } finally {
      setCatalogLoading(false);
    }
  }, [selectedEquipment]);

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

  const removeFamilyMember = useCallback((id: string) => {
    setFamily((prev) => prev.filter((m) => m.id !== id));
  }, []);

  // ── Créer les tâches depuis le catalogue via API route (service role, bypass RLS) ──
  const createFromCatalog = useCallback(async () => {
    if (!householdId || !userId) {
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
        .from('household_tasks').select('name').eq('household_id', householdId).eq('is_active', true);
      const seen = new Set<string>((existingTasks ?? []).map((t: { name: string }) => t.name.toLowerCase()));

      type TaskRow = {
        name: string; category_id: string; frequency: string; mental_load_score: number;
        scoring_category: string; duration_estimate: string; physical_effort: string;
        is_active: boolean; is_fixed_assignment: boolean; notifications_enabled: boolean;
        assigned_to: null; next_due_at: string;
      };
      type CreatedMeta = { catId: string; cat: { id: string; name: string; icon: string; color_hex: string } | undefined; nextDueIso: string };

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
        metaByName[t.name] = { catId, cat: catMap.get(catId), nextDueIso };
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
        metaByName[name] = { catId: defaultCatId, cat: catMap.get(defaultCatId), nextDueIso };
      }

      // Appel API route (service role, contourne RLS)
      const phantomMembers = family
        .filter((m) => m.type !== 'pet' && m.name.trim())
        .map((m) => ({ display_name: m.name.trim() }));

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
        };
      });

      setGeneratedTasks(created);
      await fetchHousehold(householdId);
      if (householdId) await fetchTasks(householdId);
      setStep('results');
    } catch (err) {
      console.error('[onboarding] Erreur:', err);
      setError(err instanceof Error ? err.message : 'Une erreur est survenue. Réessaie.');
    } finally {
      setIsCreating(false);
    }
  }, [householdId, userId, catalogTemplates, selectedTemplateIds, customTaskNames, family, fetchHousehold, fetchTasks]);

  const handleFinish = useCallback(() => {
    router.push('/planning');
  }, [router]);

  const deleteTask = useCallback((taskId: string) => {
    setGeneratedTasks((prev) => prev.filter((t) => t.id !== taskId));
    const supabase = createClient();
    supabase.from('household_tasks').delete().eq('id', taskId);
  }, []);

  // =============================================================================
  // RENDER
  // =============================================================================

  // ─── Écran 1 : Équipements ───
  if (step === 'equipment') {
    return (
      <div className="pt-4 pb-28">
        <div className="px-4 mb-6">
          <p className="text-[12px] text-[#8e8e93] font-semibold uppercase tracking-wide mb-2">Étape 1 / 4</p>
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
    const needsBirthdate = (type: FamilyMember['type']) => type === 'baby' || type === 'child' || type === 'teen';

    return (
      <div className="pt-4 pb-28">
        <div className="px-4 mb-6">
          <p className="text-[12px] text-[#8e8e93] font-semibold uppercase tracking-wide mb-2">Étape 2 / 4</p>
          <h2 className="text-[26px] font-black text-[#1c1c1e] leading-tight">
            Qui vit<br />avec toi ?
          </h2>
          <p className="text-[14px] text-[#8e8e93] mt-2">
            Tape pour ajouter chaque membre.
          </p>
        </div>

        <div className="mx-4 mb-4">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {FAMILY_TYPES.map((ft) => (
              <button
                key={ft.type}
                onClick={() => addFamilyMember(ft.type, ft.emoji)}
                className="flex-shrink-0 flex flex-col items-center gap-1 rounded-2xl px-4 py-3 bg-white"
                style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
              >
                <span className="text-[32px]">{ft.emoji}</span>
                <span className="text-[11px] font-semibold text-[#1c1c1e]">{ft.label}</span>
              </button>
            ))}
          </div>
        </div>

        {family.length > 0 && (
          <div className="mx-4 rounded-2xl bg-white overflow-hidden" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            {family.map((m, i) => (
              <div
                key={m.id}
                className="px-4 py-3 flex items-center gap-3"
                style={i < family.length - 1 ? { borderBottom: '0.5px solid #f0f2f8' } : {}}
              >
                <span className="text-[28px]">{m.emoji}</span>
                <div className="flex-1 space-y-1">
                  <input
                    type="text"
                    value={m.name}
                    onChange={(e) => updateFamilyMember(m.id, 'name', e.target.value)}
                    placeholder="Prénom"
                    className="w-full text-[15px] font-semibold text-[#1c1c1e] bg-transparent outline-none"
                  />
                  {needsBirthdate(m.type) && (
                    <input
                      type="date"
                      value={m.birthdate ?? ''}
                      onChange={(e) => updateFamilyMember(m.id, 'birthdate', e.target.value)}
                      className="text-[12px] text-[#8e8e93] bg-transparent outline-none"
                    />
                  )}
                </div>
                <button
                  onClick={() => removeFamilyMember(m.id)}
                  className="text-[13px] text-[#ff3b30] font-medium"
                >
                  Retirer
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="fixed bottom-0 left-0 right-0 px-4 pb-6 pt-3"
          style={{ background: 'linear-gradient(transparent, #f6f8ff 30%)' }}>
          <button
            onClick={() => setStep('baseline')}
            className="w-full rounded-2xl py-[16px] text-[17px] font-bold text-white"
            style={{
              background: 'linear-gradient(135deg, #007aff, #5856d6)',
              boxShadow: '0 8px 24px rgba(0,122,255,0.3)',
            }}
          >
            Continuer →
          </button>
        </div>
      </div>
    );
  }

  // ─── Écran 3 : Baseline émotionnelle ───
  if (step === 'baseline') {
    const OPTIONS: { value: BaselineChoice; emoji: string; label: string; sub: string; target: number }[] = [
      { value: 'me',       emoji: '🙋',  label: 'Moi, clairement',         sub: 'Je gère l\'essentiel du foyer',   target: 45 },
      { value: 'partner',  emoji: '🤷',  label: 'Mon partenaire',           sub: 'Il ou elle fait plus que moi',    target: 55 },
      { value: 'balanced', emoji: '⚖️',  label: 'C\'est plutôt équilibré',  sub: 'On partage à peu près à égalité', target: 50 },
    ];

    const handleBaseline = async (choice: BaselineChoice, target: number) => {
      setBaselineChoice(choice);
      if (userId) {
        const supabase = createClient();
        await supabase.from('profiles').update({ target_share_percent: target }).eq('id', userId);
      }
      setStep('catalog');
      loadCatalogTemplates();
    };

    return (
      <div className="min-h-screen flex flex-col" style={{
        background: 'linear-gradient(180deg, #0a1628 0%, #1a2f52 100%)',
      }}>
        <div className="flex-1 flex flex-col justify-center px-6 py-12">
          {/* Step indicator */}
          <p className="text-[12px] font-semibold uppercase tracking-[0.2em] mb-8 text-center"
            style={{ color: 'rgba(255,255,255,0.45)' }}>
            Étape 3 / 4
          </p>

          {/* Question */}
          <div className="text-center mb-10">
            <div className="text-[52px] mb-5">🏠</div>
            <h2 className="text-[26px] font-black text-white leading-tight mb-3">
              En ce moment,<br />qui fait le plus<br />à la maison ?
            </h2>
            <p className="text-[14px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
              Un tap. Pas de jugement.<br />C&apos;est le point de départ de ton score.
            </p>
          </div>

          {/* Options */}
          <div className="space-y-3">
            {OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleBaseline(opt.value, opt.target)}
                className="w-full rounded-2xl px-5 py-4 flex items-center gap-4 transition-transform active:scale-[0.97] text-left"
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  backdropFilter: 'blur(10px)',
                }}
              >
                <span className="text-[32px] flex-shrink-0">{opt.emoji}</span>
                <div className="flex-1">
                  <p className="text-[16px] font-bold text-white">{opt.label}</p>
                  <p className="text-[12px] mt-0.5" style={{ color: 'rgba(255,255,255,0.55)' }}>{opt.sub}</p>
                </div>
                <svg width="7" height="12" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" viewBox="0 0 7 12">
                  <path d="M1 1l5 5-5 5" />
                </svg>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─── Écran 4 : Catalogue ───
  if (step === 'catalog') {
    const totalSelected = selectedTemplateIds.size + customTaskNames.length;

    return (
      <div className="pt-4 pb-32">
        <div className="px-4 mb-5">
          <p className="text-[12px] text-[#8e8e93] font-semibold uppercase tracking-wide mb-2">Étape 4 / 4</p>
          <h2 className="text-[26px] font-black text-[#1c1c1e] leading-tight">
            Quelles tâches<br />veux-tu suivre ?
          </h2>
          <p className="text-[14px] text-[#8e8e93] mt-1">
            On a pré-sélectionné selon tes équipements. Ajuste à ta guise.
          </p>
        </div>

        {catalogLoading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#e5e5ea] border-t-[#007aff]" />
          </div>
        ) : (
          <>
            {Object.entries(catalogGroups).map(([cat, templates]) => {
              // En mode compact, ne montrer que les tâches pré-sélectionnées
              const visible = showAllTemplates
                ? templates
                : templates.filter((t) => selectedTemplateIds.has(t.id));

              // Ignorer les catégories sans tâches pertinentes
              if (visible.length === 0) return null;

              const { label, emoji } = SCORING_CAT_DISPLAY[cat] ?? { label: cat, emoji: '📌' };
              return (
                <div key={cat} className="mb-5">
                  <p className="text-[13px] font-bold text-[#1c1c1e] mb-2 px-5">
                    {emoji} {label}
                  </p>
                  <div className="flex flex-wrap gap-2 px-4">
                    {visible.map((t) => {
                      const sel = selectedTemplateIds.has(t.id);
                      return (
                        <button
                          key={t.id}
                          onClick={() => toggleTemplate(t.id)}
                          className="rounded-2xl px-4 py-2.5 text-[13px] font-semibold transition-all active:scale-[0.95]"
                          style={{
                            background: sel ? 'linear-gradient(135deg, #007aff, #5856d6)' : 'white',
                            color: sel ? 'white' : '#1c1c1e',
                            boxShadow: sel
                              ? '0 4px 12px rgba(0,122,255,0.25)'
                              : '0 1px 4px rgba(0,0,0,0.06)',
                          }}
                        >
                          {t.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Lien "voir toutes les tâches" */}
            {!showAllTemplates && (
              <div className="px-4 mb-4">
                <button
                  onClick={() => setShowAllTemplates(true)}
                  className="text-[13px] font-semibold"
                  style={{ color: '#007aff' }}
                >
                  + Voir toutes les tâches disponibles ({catalogTemplates.length - selectedTemplateIds.size} autres)
                </button>
              </div>
            )}

            {/* Tâche personnalisée */}
            <div className="mx-4 mt-2 mb-4">
              <p className="text-[13px] font-bold text-[#1c1c1e] mb-2">📌 Autre chose ?</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customTaskInput}
                  onChange={(e) => setCustomTaskInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') addCustomTask(); }}
                  placeholder="Ex : Arroser les plantes"
                  className="flex-1 rounded-xl px-4 py-3 text-[14px] text-[#1c1c1e] outline-none"
                  style={{ background: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
                />
                <button
                  onClick={addCustomTask}
                  disabled={!customTaskInput.trim()}
                  className="rounded-xl px-5 py-3 text-[20px] font-bold text-white disabled:opacity-40"
                  style={{ background: '#007aff' }}
                >
                  +
                </button>
              </div>
              {customTaskNames.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {customTaskNames.map((name, i) => (
                    <div key={i}
                      className="flex items-center gap-1 rounded-2xl px-3 py-2 text-[13px] font-semibold text-white"
                      style={{ background: 'linear-gradient(135deg, #34c759, #30d158)' }}>
                      <span>{name}</span>
                      <button
                        onClick={() => setCustomTaskNames((prev) => prev.filter((_, j) => j !== i))}
                        className="ml-1 opacity-70 hover:opacity-100 text-[16px] leading-none"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {error && (
          <p className="px-4 text-[13px] text-[#ff3b30] mb-3">{error}</p>
        )}

        <div className="fixed bottom-0 left-0 right-0 px-4 pb-6 pt-3"
          style={{ background: 'linear-gradient(transparent, #f6f8ff 30%)' }}>
          <button
            onClick={createFromCatalog}
            disabled={totalSelected === 0 || isCreating}
            className="w-full rounded-2xl py-[16px] text-[17px] font-bold text-white disabled:opacity-40"
            style={{
              background: 'linear-gradient(135deg, #007aff, #5856d6)',
              boxShadow: '0 8px 24px rgba(0,122,255,0.3)',
            }}
          >
            {isCreating
              ? 'Création en cours…'
              : `Créer ${totalSelected} tâche${totalSelected !== 1 ? 's' : ''} →`}
          </button>
        </div>
      </div>
    );
  }

  // ─── Écran 5 : Résultats ───
  if (step === 'results') {
    const sortedTasks = [...generatedTasks].sort((a, b) => {
      const da = a.next_due_at ? new Date(a.next_due_at).getTime() : Infinity;
      const db = b.next_due_at ? new Date(b.next_due_at).getTime() : Infinity;
      return da - db;
    });

    return (
      <div className="pt-4 pb-32">
        <div className="px-4 mb-6 text-center">
          <div className="text-[52px] mb-3">✅</div>
          <h2 className="text-[26px] font-black text-[#1c1c1e] leading-tight">
            Yova a créé<br />{generatedTasks.length} tâche{generatedTasks.length !== 1 ? 's' : ''} pour ton foyer
          </h2>
          <p className="text-[13px] text-[#8e8e93] mt-2">
            Appuie sur la poubelle pour retirer une tâche.
          </p>
        </div>

        <div className="px-4">
          <div className="rounded-2xl bg-white overflow-hidden" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            {sortedTasks.map((t, i) => (
              <div
                key={t.id}
                className="flex items-center gap-3 px-4 py-3"
                style={i < sortedTasks.length - 1 ? { borderBottom: '0.5px solid #f0f2f8' } : {}}
              >
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: t.category_color ?? '#8e8e93' }} />
                <p className="flex-1 text-[14px] text-[#1c1c1e]">{t.name}</p>
                {t.next_due_at && (
                  <p className="text-[11px] text-[#8e8e93] flex-shrink-0">
                    {new Date(t.next_due_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                  </p>
                )}
                <DeleteButton onDelete={() => deleteTask(t.id)} />
              </div>
            ))}
          </div>

          {generatedTasks.length === 0 && (
            <div className="text-center py-8">
              <p className="text-[15px] text-[#8e8e93]">Aucune tâche créée.</p>
            </div>
          )}
        </div>

        <div className="fixed bottom-0 left-0 right-0 px-4 pb-6 pt-3"
          style={{ background: 'linear-gradient(transparent, #f6f8ff 30%)' }}>
          <button
            onClick={handleFinish}
            className="w-full rounded-2xl py-[16px] text-[17px] font-bold text-white"
            style={{
              background: 'linear-gradient(135deg, #007aff, #5856d6)',
              boxShadow: '0 8px 24px rgba(0,122,255,0.3)',
            }}
          >
            Voir mon planning →
          </button>
        </div>
      </div>
    );
  }

  return null;
}
