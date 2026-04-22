'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useTaskStore } from '@/stores/taskStore';
import { useHouseholdStore } from '@/stores/householdStore';
import { createClient } from '@/lib/supabase';

// ── Types ──────────────────────────────────────────────────────────────────────
type Step =
  | 'household_size' | 'children' | 'children_detail' | 'constraints'
  | 'external_help' | 'equipment' | 'energy' | 'groceries' | 'laundry'
  | 'dinner' | 'generating' | 'done';

type Message = { role: 'yova' | 'user'; text: string };

type Ctx = {
  householdSize: number;
  hasChildren: boolean;
  childrenRaw: string;
  constraints: string;
  hasExternalHelp: boolean;
  externalHelpRaw: string;
  equipment: string[];
  energyLevel: 'low' | 'medium' | 'high';
  groceriesDone: 'done' | 'todo' | 'delivery';
  laundryDone: 'done' | 'todo';
  dinnerPlanned: 'yes' | 'no';
};

type EquipmentItem = {
  id: string; name: string; icon: string;
  category: string; is_default: boolean;
};

// ── Constants ──────────────────────────────────────────────────────────────────
const HELP_OPTIONS = [
  { id: 'cleaning',     label: '🧹 Femme de ménage' },
  { id: 'babysitter',   label: '👶 Baby-sitter / Nounou' },
  { id: 'family',       label: '👨‍👩‍👧 Famille proche' },
  { id: 'meal_delivery',label: '📦 Livraison de repas' },
  { id: 'none',         label: 'Aucune aide' },
];

const EQUIP_CAT_LABELS: Record<string, string> = {
  cuisine:      '🍳 Cuisine',
  salle_de_bain:'🚿 Salle de bain',
  linge:        '👕 Linge',
  sols:         '🧹 Sols & Ménage',
  exterieur:    '🌿 Extérieur',
  vehicule:     '🚗 Véhicule',
  animaux:      '🐾 Animaux',
};

const CATEGORY_IDS: Record<string, string> = {
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
};

// ── Chip button component ──────────────────────────────────────────────────────
function Chip({
  label, active, onClick,
}: { label: string; active?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-2xl px-4 py-3 text-[14px] font-semibold transition-all active:scale-[0.95]"
      style={{
        background: active
          ? 'linear-gradient(135deg,#007aff,#5856d6)'
          : 'white',
        color: active ? 'white' : '#1c1c1e',
        boxShadow: active
          ? '0 4px 12px rgba(0,122,255,0.3)'
          : '0 1px 4px rgba(0,0,0,0.08)',
      }}
    >
      {label}
    </button>
  );
}

// ── CTA button ─────────────────────────────────────────────────────────────────
function CTA({
  label, onClick, disabled, loading,
}: { label: string; onClick: () => void; disabled?: boolean; loading?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className="w-full rounded-2xl py-4 text-[17px] font-bold text-white disabled:opacity-40 flex items-center justify-center gap-2"
      style={{
        background: 'linear-gradient(135deg,#007aff,#5856d6)',
        boxShadow: !disabled ? '0 8px 24px rgba(0,122,255,0.3)' : 'none',
      }}
    >
      {loading && (
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
      )}
      {label}
    </button>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function OnboardingPage() {
  const router = useRouter();
  const { profile, refreshProfile } = useAuthStore();
  const { fetchTasks } = useTaskStore();
  const { fetchHousehold } = useHouseholdStore();

  const [step, setStep]       = useState<Step>('household_size');
  const [messages, setMessages] = useState<Message[]>([]);
  const [textInput, setTextInput] = useState('');
  const [constraintMode, setConstraintMode] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [taskCount, setTaskCount] = useState(0);
  const [journalConsent, setJournalConsent] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);

  // Equipment
  const [equipmentList, setEquipmentList] = useState<EquipmentItem[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<Set<string>>(new Set());

  // External help (multi-select)
  const [selectedHelp, setSelectedHelp] = useState<Set<string>>(new Set());

  // Context ref — always up to date without triggering re-renders
  const ctxRef = useRef<Partial<Ctx>>({});
  const chatRef = useRef<HTMLDivElement>(null);
  const userId      = profile?.id;
  const householdId = profile?.household_id;

  // ── Init ───────────────────────────────────────────────────────────────────
  // Auto-create household if missing
  useEffect(() => {
    if (!userId || householdId) return;
    fetch('/api/onboarding/create-household', { method: 'POST' })
      .then(r => r.json())
      .then(async (d) => { if (d.ok) await refreshProfile(); })
      .catch(console.error);
  }, [userId, householdId, refreshProfile]);

  // Load equipment from DB
  useEffect(() => {
    createClient()
      .from('onboarding_equipment')
      .select('*')
      .order('sort_order')
      .then(({ data }) => {
        if (!data) return;
        setEquipmentList(data as EquipmentItem[]);
        setSelectedEquipment(new Set(
          (data as EquipmentItem[]).filter(e => e.is_default).map(e => e.id)
        ));
      });
  }, []);

  // First Yova message
  useEffect(() => {
    setMessages([{
      role: 'yova',
      text: 'Bonjour ! Je suis Yova 👋\nJe vais préparer votre foyer en quelques questions.\n\nCombien de personnes vivent chez vous ?',
    }]);
  }, []);

  // Scroll chat to bottom on new messages
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const addYova = (text: string) =>
    setMessages(m => [...m, { role: 'yova', text }]);

  const addUser = (text: string) =>
    setMessages(m => [...m, { role: 'user', text }]);

  /** User responds → wait 400ms → Yova replies → change step */
  const next = (userText: string, nextStep: Step, yovaText: string) => {
    addUser(userText);
    setTimeout(() => { addYova(yovaText); setStep(nextStep); }, 400);
  };

  const updateCtx = (patch: Partial<Ctx>) => {
    ctxRef.current = { ...ctxRef.current, ...patch };
  };

  // ── Step handlers ──────────────────────────────────────────────────────────

  const handleSize = (size: number) => {
    updateCtx({ householdSize: size });
    next(
      size >= 5 ? '5 personnes ou plus' : `${size} personne${size > 1 ? 's' : ''}`,
      'children',
      'Y a-t-il des enfants dans le foyer ?',
    );
  };

  const handleChildren = (has: boolean) => {
    updateCtx({ hasChildren: has, childrenRaw: has ? undefined : '' });
    if (has) {
      next('Oui', 'children_detail',
        'Leurs prénoms et âges ? (ex : Léa 7 ans, Tom 4 ans)');
    } else {
      next('Non', 'constraints',
        'Des allergies ou contraintes alimentaires dans votre foyer ?');
    }
  };

  const handleChildrenDetail = () => {
    const val = textInput.trim() || 'Non précisé';
    updateCtx({ childrenRaw: val });
    setTextInput('');
    next(val, 'constraints',
      'Des allergies ou contraintes alimentaires dans votre foyer ?');
  };

  const handleConstraints = (has: boolean) => {
    if (has) {
      setConstraintMode(true);
    } else {
      updateCtx({ constraints: '' });
      next('Aucune', 'external_help',
        'Avez-vous de l\'aide extérieure dans le foyer ?');
    }
  };

  const handleConstraintText = () => {
    const val = textInput.trim();
    if (!val) return;
    updateCtx({ constraints: val });
    setTextInput('');
    setConstraintMode(false);
    next(val, 'external_help',
      'Avez-vous de l\'aide extérieure dans le foyer ?');
  };

  const toggleHelp = (id: string) => {
    setSelectedHelp(prev => {
      const next = new Set(prev);
      if (id === 'none') return new Set(['none']);
      next.delete('none');
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleExternalHelp = () => {
    if (selectedHelp.size === 0) return;
    const isNone = selectedHelp.has('none');
    const labels = [...selectedHelp]
      .filter(id => id !== 'none')
      .map(id => HELP_OPTIONS.find(o => o.id === id)?.label.replace(/^\S+\s/, '') ?? id)
      .join(', ');
    updateCtx({ hasExternalHelp: !isNone, externalHelpRaw: isNone ? '' : labels });
    addUser(isNone ? 'Aucune aide' : labels);
    setTimeout(() => {
      addYova('Quels équipements avez-vous dans votre foyer ?');
      setStep('equipment');
    }, 400);
  };

  const handleEquipment = () => {
    const names = equipmentList
      .filter(e => selectedEquipment.has(e.id))
      .map(e => e.name);
    updateCtx({ equipment: names });
    addUser(`${names.length} équipement${names.length > 1 ? 's' : ''} sélectionné${names.length > 1 ? 's' : ''}`);
    setTimeout(() => {
      addYova('Comment vous sentez-vous en ce moment ?');
      setStep('energy');
    }, 400);
  };

  const handleEnergy = (level: 'low' | 'medium' | 'high') => {
    const labels = { low: '😴 Épuisé(e)', medium: '😊 Ça va', high: '💪 En forme' };
    updateCtx({ energyLevel: level });
    next(labels[level], 'groceries',
      'Les courses — faites récemment, à faire, ou par livraison habituelle ?');
  };

  const handleGroceries = (val: 'done' | 'todo' | 'delivery') => {
    const labels = { done: 'Faites ✓', todo: 'À faire', delivery: 'En livraison' };
    updateCtx({ groceriesDone: val });
    next(labels[val], 'laundry', 'La lessive — faite ou à lancer ?');
  };

  const handleLaundry = (val: 'done' | 'todo') => {
    updateCtx({ laundryDone: val });
    next(
      val === 'done' ? 'Faite ✓' : 'À lancer',
      'dinner',
      'Le dîner ce soir — déjà prévu ou pas encore ?',
    );
  };

  const handleDinner = (val: 'yes' | 'no') => {
    const finalCtx: Ctx = {
      householdSize:   ctxRef.current.householdSize   ?? 2,
      hasChildren:     ctxRef.current.hasChildren     ?? false,
      childrenRaw:     ctxRef.current.childrenRaw     ?? '',
      constraints:     ctxRef.current.constraints     ?? '',
      hasExternalHelp: ctxRef.current.hasExternalHelp ?? false,
      externalHelpRaw: ctxRef.current.externalHelpRaw ?? '',
      equipment:       ctxRef.current.equipment       ?? [],
      energyLevel:     ctxRef.current.energyLevel     ?? 'medium',
      groceriesDone:   ctxRef.current.groceriesDone   ?? 'todo',
      laundryDone:     ctxRef.current.laundryDone     ?? 'todo',
      dinnerPlanned:   val,
    };
    addUser(val === 'yes' ? 'Prévu ✓' : 'Pas encore');
    setTimeout(() => {
      addYova('Je prépare votre liste personnalisée... ✨');
      setStep('generating');
      void runGeneration(finalCtx);
    }, 400);
  };

  // ── Generation ─────────────────────────────────────────────────────────────
  const loadFallbackTasks = async (fctx: Ctx) => {
    const { data } = await createClient()
      .from('task_templates')
      .select('name,scoring_category,default_frequency,default_duration,default_physical,default_mental_load_score,equipment_tags')
      .eq('is_system', true)
      .order('sort_order')
      .limit(15);
    if (!data) return [];

    const now = new Date();
    now.setHours(9, 0, 0, 0);

    return data
      .filter(t => {
        if (!fctx.hasChildren && t.scoring_category === 'children') return false;
        const hasPetEquip = fctx.equipment.some(e =>
          e.toLowerCase().includes('animal') || e.toLowerCase().includes('chat') || e.toLowerCase().includes('chien')
        );
        if (!hasPetEquip && t.scoring_category === 'pets') return false;
        return true;
      })
      .map(t => ({
        name: t.name,
        category_id: CATEGORY_IDS[t.scoring_category] ?? CATEGORY_IDS.cleaning,
        frequency: t.default_frequency ?? 'weekly',
        duration_estimate: t.default_duration ?? 'short',
        physical_effort: t.default_physical ?? 'medium',
        mental_load_score: t.default_mental_load_score ?? 3,
        scoring_category: t.scoring_category ?? 'cleaning',
        is_active: true,
        is_fixed_assignment: false,
        notifications_enabled: true,
        assigned_to: null,
        next_due_at: now.toISOString(),
      }));
  };

  const runGeneration = async (fctx: Ctx) => {
    try {
      // Ensure household is ready
      let hid = useAuthStore.getState().profile?.household_id;
      if (!hid) {
        await refreshProfile();
        hid = useAuthStore.getState().profile?.household_id;
      }
      if (!hid) throw new Error('Foyer introuvable — rechargez la page.');

      // 1. Claude generates calibrated tasks
      const genRes = await fetch('/api/onboarding/generate-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fctx),
      });
      const genData = await genRes.json() as {
        taskRows?: Record<string, unknown>[];
        children?: { name: string; age: number; school_class: string | null }[];
        householdMeta?: { energy_level: string; has_external_help: boolean; external_help_description: string | null };
        fallback?: boolean;
        error?: string;
      };

      let taskRows   = genData.taskRows   ?? [];
      let children   = genData.children   ?? [];
      let householdMeta = genData.householdMeta;
      const isFallback = genData.fallback || !genRes.ok || taskRows.length === 0;

      if (isFallback) {
        console.warn('[onboarding] Claude fallback — using catalog');
        taskRows = await loadFallbackTasks(fctx);
        children = [];
        householdMeta = {
          energy_level: fctx.energyLevel,
          has_external_help: fctx.hasExternalHelp,
          external_help_description: fctx.externalHelpRaw || null,
        };
      }

      // 2. Persist tasks + members + household profile
      const phantomMembers = children.map(c => ({
        display_name:  c.name,
        member_type:   'child',
        birth_date:    null,
        school_class:  c.school_class ?? null,
        specifics:     {},
      }));

      const createRes = await fetch('/api/onboarding/create-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskRows,
          phantomMembers,
          householdMeta,
          customSuggestions: [],
        }),
      });
      const createData = await createRes.json() as { tasks?: { id: string }[]; error?: string };
      if (!createRes.ok) throw new Error(createData.error ?? `Erreur ${createRes.status}`);

      const count = createData.tasks?.length ?? taskRows.length;

      // Reload stores
      await fetchHousehold(hid);
      await fetchTasks(hid);

      setTaskCount(count);
      addYova(
        `✨ C'est prêt !\n` +
        `J'ai organisé ${count} tâche${count > 1 ? 's' : ''} pour votre foyer.\n` +
        `Je m'adapterai au fil du temps.`
      );
      setStep('done');
    } catch (err) {
      console.error('[onboarding] runGeneration error:', err);
      setError(err instanceof Error ? err.message : 'Une erreur est survenue. Rechargez la page.');
    }
  };

  const handleFinish = async () => {
    if (finishing) return;
    setFinishing(true);
    if (journalConsent && userId && !profile?.ai_journal_consent_at) {
      await createClient()
        .from('profiles')
        .update({ ai_journal_consent_at: new Date().toISOString() })
        .eq('id', userId);
      await refreshProfile();
    }
    router.push('/today');
  };

  // ── Equipment screen (special full-page picker) ────────────────────────────
  if (step === 'equipment') {
    const grouped: Record<string, EquipmentItem[]> = {};
    for (const e of equipmentList) {
      if (!grouped[e.category]) grouped[e.category] = [];
      grouped[e.category].push(e);
    }
    return (
      <div className="pt-4 pb-28">
        {/* Yova bubble at top */}
        <div className="px-4 mb-5">
          <div className="flex items-start gap-2">
            <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-white text-[12px] font-black"
              style={{ background: 'linear-gradient(135deg,#007aff,#5856d6)' }}>
              Y
            </div>
            <div className="rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%]"
              style={{ background: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <p className="text-[15px] text-[#1c1c1e] leading-relaxed">
                Quels équipements avez-vous dans votre foyer ?
              </p>
            </div>
          </div>
          <p className="text-[12px] text-[#8e8e93] mt-2 ml-9">
            Tapez sur tout ce que vous avez.
          </p>
        </div>

        {Object.entries(grouped).map(([cat, items]) => (
          <div key={cat} className="mb-5">
            <p className="text-[12px] font-bold text-[#8e8e93] uppercase tracking-wide mb-2 px-5">
              {EQUIP_CAT_LABELS[cat] ?? cat}
            </p>
            <div className="flex flex-wrap gap-2 px-4">
              {items.map(eq => {
                const sel = selectedEquipment.has(eq.id);
                return (
                  <button
                    key={eq.id}
                    onClick={() => setSelectedEquipment(prev => {
                      const n = new Set(prev);
                      sel ? n.delete(eq.id) : n.add(eq.id);
                      return n;
                    })}
                    className="flex items-center gap-2 rounded-2xl px-3 py-2 text-[13px] font-semibold transition-all active:scale-[0.95]"
                    style={{
                      background: sel ? 'linear-gradient(135deg,#007aff,#5856d6)' : 'white',
                      color: sel ? 'white' : '#1c1c1e',
                      boxShadow: sel ? '0 4px 16px rgba(0,122,255,0.3)' : '0 1px 4px rgba(0,0,0,0.06)',
                    }}
                  >
                    <span className="text-[18px]">{eq.icon}</span>
                    <span>{eq.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <div
          className="fixed bottom-0 left-0 right-0 px-4 pb-6 pt-3"
          style={{ background: 'linear-gradient(transparent, #f6f8ff 30%)' }}
        >
          <CTA
            label={`Continuer (${selectedEquipment.size}) →`}
            onClick={handleEquipment}
          />
        </div>
      </div>
    );
  }

  // ── Generating screen ──────────────────────────────────────────────────────
  if (step === 'generating') {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-6"
        style={{ background: 'linear-gradient(180deg,#0a1628 0%,#1a2f52 100%)' }}
      >
        <div
          className="h-16 w-16 rounded-full flex items-center justify-center mb-6"
          style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
        >
          <div className="h-6 w-6 animate-spin rounded-full border-[3px] border-white/20 border-t-white" />
        </div>
        <h2 className="text-[24px] font-black text-white text-center leading-tight mb-2">
          Yova prépare votre foyer…
        </h2>
        <p className="text-[14px] text-center max-w-[280px] leading-relaxed"
          style={{ color: 'rgba(255,255,255,0.6)' }}>
          Analyse de vos réponses et calibrage des tâches
        </p>
        {error && (
          <p className="mt-6 text-[13px] text-red-400 text-center max-w-[280px]">{error}</p>
        )}
      </div>
    );
  }

  // ── Chat UI (all other steps + done) ──────────────────────────────────────
  const renderInput = () => {
    switch (step) {
      case 'household_size':
        return (
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map(n => (
              <button key={n}
                onClick={() => handleSize(n)}
                className="flex-1 rounded-2xl py-4 text-[18px] font-bold"
                style={{ background: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', color: '#1c1c1e' }}>
                {n === 5 ? '5+' : n}
              </button>
            ))}
          </div>
        );

      case 'children':
        return (
          <div className="flex gap-3">
            <CTA label="Oui" onClick={() => handleChildren(true)} />
            <button onClick={() => handleChildren(false)}
              className="flex-1 rounded-2xl py-4 text-[17px] font-bold"
              style={{ background: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', color: '#1c1c1e' }}>
              Non
            </button>
          </div>
        );

      case 'children_detail':
        return (
          <div className="flex gap-2">
            <input
              type="text"
              value={textInput}
              onChange={e => setTextInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleChildrenDetail()}
              placeholder="Léa 7 ans, Tom 4 ans…"
              autoFocus
              className="flex-1 rounded-2xl px-4 py-3 text-[15px] outline-none"
              style={{ background: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}
            />
            <button onClick={handleChildrenDetail}
              className="rounded-2xl px-5 text-white text-[20px] font-bold"
              style={{ background: 'linear-gradient(135deg,#007aff,#5856d6)' }}>
              →
            </button>
          </div>
        );

      case 'constraints':
        if (constraintMode) {
          return (
            <div className="flex gap-2">
              <input
                type="text"
                value={textInput}
                onChange={e => setTextInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleConstraintText()}
                placeholder="Ex : gluten, arachides, végétarien…"
                autoFocus
                className="flex-1 rounded-2xl px-4 py-3 text-[15px] outline-none"
                style={{ background: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}
              />
              <button onClick={handleConstraintText}
                className="rounded-2xl px-5 text-white text-[20px] font-bold"
                style={{ background: 'linear-gradient(135deg,#007aff,#5856d6)' }}>
                →
              </button>
            </div>
          );
        }
        return (
          <div className="flex gap-3">
            <button onClick={() => handleConstraints(false)}
              className="flex-1 rounded-2xl py-4 text-[16px] font-bold"
              style={{ background: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', color: '#1c1c1e' }}>
              Aucune
            </button>
            <CTA label="Oui, ajouter" onClick={() => handleConstraints(true)} />
          </div>
        );

      case 'external_help':
        return (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {HELP_OPTIONS.map(o => (
                <Chip
                  key={o.id}
                  label={o.label}
                  active={selectedHelp.has(o.id)}
                  onClick={() => toggleHelp(o.id)}
                />
              ))}
            </div>
            <CTA
              label="Confirmer →"
              onClick={handleExternalHelp}
              disabled={selectedHelp.size === 0}
            />
          </div>
        );

      case 'energy':
        return (
          <div className="flex flex-col gap-2">
            {([
              { val: 'low',    label: '😴 Épuisé(e) — mode survie' },
              { val: 'medium', label: '😊 Ça va — rythme normal' },
              { val: 'high',   label: '💪 En forme — on gère !' },
            ] as { val: 'low' | 'medium' | 'high'; label: string }[]).map(o => (
              <button key={o.val} onClick={() => handleEnergy(o.val)}
                className="rounded-2xl py-3 text-[15px] font-bold"
                style={{ background: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', color: '#1c1c1e' }}>
                {o.label}
              </button>
            ))}
          </div>
        );

      case 'groceries':
        return (
          <div className="flex flex-col gap-2">
            {([
              { val: 'done',     label: '✓ Faites récemment' },
              { val: 'todo',     label: '→ À faire bientôt' },
              { val: 'delivery', label: '📦 Livraison habituellement' },
            ] as { val: 'done' | 'todo' | 'delivery'; label: string }[]).map(o => (
              <button key={o.val} onClick={() => handleGroceries(o.val)}
                className="rounded-2xl py-3 text-[15px] font-bold"
                style={{ background: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', color: '#1c1c1e' }}>
                {o.label}
              </button>
            ))}
          </div>
        );

      case 'laundry':
        return (
          <div className="flex gap-3">
            <button onClick={() => handleLaundry('done')}
              className="flex-1 rounded-2xl py-4 text-[16px] font-bold"
              style={{ background: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', color: '#1c1c1e' }}>
              ✓ Faite
            </button>
            <CTA label="À lancer" onClick={() => handleLaundry('todo')} />
          </div>
        );

      case 'dinner':
        return (
          <div className="flex gap-3">
            <button onClick={() => handleDinner('yes')}
              className="flex-1 rounded-2xl py-4 text-[16px] font-bold"
              style={{ background: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', color: '#1c1c1e' }}>
              ✓ Prévu
            </button>
            <CTA label="Pas encore" onClick={() => handleDinner('no')} />
          </div>
        );

      case 'done': {
        const hasConsent = !!profile?.ai_journal_consent_at || journalConsent;
        return (
          <div className="space-y-3">
            {!profile?.ai_journal_consent_at && (
              <div className="rounded-2xl overflow-hidden bg-white"
                style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
                <button
                  onClick={() => setConsentOpen(v => !v)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left"
                >
                  <span className="text-[18px]">🔒</span>
                  <div className="flex-1">
                    <p className="text-[13px] font-bold text-[#1c1c1e]">Consentement IA</p>
                    <p className="text-[11px] text-[#8e8e93]">
                      Yova utilise Claude (Anthropic, US). {consentOpen ? 'Réduire.' : 'Détails ↓'}
                    </p>
                  </div>
                </button>
                {consentOpen && (
                  <div className="px-4 pb-3 text-[11px] leading-relaxed"
                    style={{ color: '#3a6fcc', background: '#f0f6ff' }}>
                    📍 Envoyé : texte journal + liste tâches (sans noms réels)<br />
                    🔒 Conservé : résultat uniquement, serveurs Supabase (UE)<br />
                    🗑️ Suppression : avec votre compte (Profil → Mes données)
                  </div>
                )}
                <label className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                  style={{ borderTop: '0.5px solid #f0f2f8' }}>
                  <input
                    type="checkbox"
                    checked={journalConsent}
                    onChange={e => setJournalConsent(e.target.checked)}
                    style={{ width: 20, height: 20, accentColor: '#007aff' }}
                  />
                  <span className="text-[12px] text-[#1c1c1e]">
                    J&apos;accepte le traitement par Yova via Claude.
                  </span>
                </label>
              </div>
            )}
            {!hasConsent && (
              <p className="text-center text-[11px] text-[#8e8e93]">
                Acceptez le traitement IA ci-dessus pour continuer
              </p>
            )}
            <CTA
              label={finishing ? 'Lancement…' : 'Commencer avec Yova →'}
              onClick={handleFinish}
              disabled={!hasConsent}
              loading={finishing}
            />
          </div>
        );
      }

      default:
        return null;
    }
  };

  // Step count for progress indicator (excluding generating/done)
  const STEPS_ORDER: Step[] = [
    'household_size','children','children_detail','constraints',
    'external_help','equipment','energy','groceries','laundry','dinner',
  ];
  const currentIdx = STEPS_ORDER.indexOf(step);
  const totalSteps = STEPS_ORDER.length;

  return (
    <div className="flex flex-col h-screen" style={{ background: '#f6f8ff' }}>
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center gap-3 flex-shrink-0"
        style={{ background: 'linear-gradient(135deg,#007aff,#5856d6)' }}
      >
        <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
          <span className="text-white font-black text-[17px]">Y</span>
        </div>
        <div className="flex-1">
          <p className="text-white font-black text-[17px] leading-none">Yova</p>
          <p className="text-white/70 text-[11px] mt-0.5">Configuration du foyer</p>
        </div>
        {/* Progress dots */}
        {currentIdx >= 0 && (
          <div className="flex gap-1">
            {STEPS_ORDER.map((_, i) => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  background: i < currentIdx
                    ? 'rgba(255,255,255,0.9)'
                    : i === currentIdx
                    ? 'white'
                    : 'rgba(255,255,255,0.3)',
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Chat messages */}
      <div ref={chatRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-2">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'items-start gap-2'}`}>
            {msg.role === 'yova' && (
              <div
                className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-white text-[12px] font-black mt-0.5"
                style={{ background: 'linear-gradient(135deg,#007aff,#5856d6)' }}
              >
                Y
              </div>
            )}
            <div
              className={`rounded-2xl px-4 py-3 max-w-[82%] ${msg.role === 'user' ? 'rounded-tr-sm' : 'rounded-tl-sm'}`}
              style={{
                background: msg.role === 'user'
                  ? 'linear-gradient(135deg,#007aff,#5856d6)'
                  : 'white',
                color: msg.role === 'user' ? 'white' : '#1c1c1e',
                boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
              }}
            >
              <p className="text-[15px] leading-relaxed whitespace-pre-line">{msg.text}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Input area */}
      <div
        className="flex-shrink-0 px-4 pb-8 pt-3"
        style={{ background: 'linear-gradient(transparent, #f6f8ff 25%, #f6f8ff)' }}
      >
        {error ? (
          <div className="rounded-2xl px-4 py-3 text-[13px] text-center"
            style={{ background: '#fff0f0', border: '1px solid #ffcccc', color: '#cc0000' }}>
            {error}
          </div>
        ) : (
          renderInput()
        )}
      </div>
    </div>
  );
}
