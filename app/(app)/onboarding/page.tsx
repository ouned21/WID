'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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

type Step =
  | 'equipment'   // Écran 1 : Sélection des équipements
  | 'family'      // Écran 2 : Composition familiale
  | 'thinking'    // Animation "Aura réfléchit..."
  | 'results';    // Écran résultats : liste des tâches créées

const CATEGORY_LABELS: Record<string, string> = {
  cuisine: '🍳 Cuisine',
  salle_de_bain: '🚿 Salle de bain',
  linge: '👕 Linge',
  sols: '🧹 Sols & Ménage',
  exterieur: '🌿 Extérieur',
  vehicule: '🚗 Véhicule',
  animaux: '🐾 Animaux',
};

const FAMILY_TYPES = [
  { type: 'adult' as const, emoji: '👤', label: 'Adulte' },
  { type: 'teen' as const, emoji: '🧑', label: 'Ado (13-17)' },
  { type: 'child' as const, emoji: '🧒', label: 'Enfant (3-12)' },
  { type: 'baby' as const, emoji: '👶', label: 'Bébé (0-2)' },
  { type: 'pet' as const, emoji: '🐶', label: 'Animal' },
];

// =============================================================================
// COMPOSANTS
// =============================================================================

function AnimatedThinking({ steps, onDone, isReady }: { steps: string[]; onDone: () => void; isReady: boolean }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);

  // Animation des étapes
  useEffect(() => {
    if (currentStep >= steps.length) {
      setMinTimeElapsed(true);
      return;
    }
    const t = setTimeout(() => setCurrentStep((s) => s + 1), 700);
    return () => clearTimeout(t);
  }, [currentStep, steps.length]);

  // Déclenche onDone quand animation finie ET generate terminé
  useEffect(() => {
    if (minTimeElapsed && isReady) {
      const t = setTimeout(onDone, 500);
      return () => clearTimeout(t);
    }
  }, [minTimeElapsed, isReady, onDone]);

  return (
    <div className="flex flex-col justify-center items-center min-h-[60vh] px-6">
      <div className="text-[48px] mb-6 animate-pulse">🤖</div>
      <p className="text-[18px] font-bold text-white mb-6">Aura analyse ton foyer</p>
      <div className="space-y-3 text-left max-w-sm">
        {steps.map((step, i) => (
          <div key={i} className="flex items-center gap-3 text-[15px] transition-opacity duration-300" style={{
            opacity: i <= currentStep ? 1 : 0.2,
          }}>
            <span className="text-[18px]">{i < currentStep ? '✓' : i === currentStep ? '⋯' : '○'}</span>
            <span className="text-white">{step}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// PAGE
// =============================================================================

export default function OnboardingPage() {
  const router = useRouter();
  const { profile } = useAuthStore();
  const { fetchTasks } = useTaskStore();
  const { fetchHousehold } = useHouseholdStore();

  const [step, setStep] = useState<Step>('equipment');
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<Set<string>>(new Set());
  const [family, setFamily] = useState<FamilyMember[]>([]);
  const [generatedTasks, setGeneratedTasks] = useState<{ id: string; name: string; category_id: string; category_name?: string; category_icon?: string; category_color?: string; next_due_at?: string | null }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [generationDone, setGenerationDone] = useState(false);

  const householdId = profile?.household_id;
  const userId = profile?.id;

  // Charger les équipements
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

  // Grouper équipements par catégorie
  const groupedEquipment = useMemo(() => {
    const groups: Record<string, Equipment[]> = {};
    for (const eq of equipment) {
      if (!groups[eq.category]) groups[eq.category] = [];
      groups[eq.category].push(eq);
    }
    return groups;
  }, [equipment]);

  const toggleEquipment = useCallback((id: string) => {
    setSelectedEquipment((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Gestion famille
  const addFamilyMember = useCallback((type: FamilyMember['type'], emoji: string) => {
    setFamily((prev) => [...prev, {
      id: `f-${Date.now()}-${Math.random()}`,
      type,
      emoji,
      name: '',
    }]);
  }, []);

  const updateFamilyMember = useCallback((id: string, field: keyof FamilyMember, value: string) => {
    setFamily((prev) => prev.map((m) => (m.id === id ? { ...m, [field]: value } : m)));
  }, []);

  const removeFamilyMember = useCallback((id: string) => {
    setFamily((prev) => prev.filter((m) => m.id !== id));
  }, []);

  // Générer les tâches
  const generateTasks = useCallback(async () => {
    if (!householdId || !userId) return;
    setError(null);

    try {
      const supabase = createClient();

      type TaskInput = { name: string; scoring_category: string; frequency: string; duration_estimate: string; physical_effort: string; mental_load_score: number; description?: string };

      // Appel IA : générer les tâches via Claude
      // Timeout 25s pour éviter le blocage si Claude est lent
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      let aiTasks: TaskInput[] = [];
      try {
        const response = await fetch('/api/onboarding/generate-tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ equipment: [...selectedEquipment], family }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (response.ok) {
          const json = await response.json();
          aiTasks = Array.isArray(json.tasks) ? json.tasks : [];
        }
      } catch {
        clearTimeout(timeoutId);
        // Timeout ou erreur réseau → fallback catalogue statique ci-dessous
      }

      // Fallback sur le catalogue statique si Claude échoue ou retourne vide
      let tasksToInsert: TaskInput[] = aiTasks;

      if (tasksToInsert.length === 0) {
        const { data: fallbackAssoc } = await supabase
          .from('task_associations')
          .select('*')
          .eq('trigger_type', 'equipment')
          .in('trigger_value', [...selectedEquipment]);
        if (fallbackAssoc && fallbackAssoc.length > 0) {
          tasksToInsert = fallbackAssoc.map((a: Record<string, unknown>) => ({
            name: String(a.suggested_name ?? ''),
            scoring_category: String(a.suggested_scoring_category ?? 'cleaning'),
            frequency: String(a.suggested_frequency ?? 'weekly'),
            duration_estimate: String(a.suggested_duration ?? 'short'),
            physical_effort: String(a.suggested_physical ?? 'light'),
            mental_load_score: Number(a.suggested_mental_load_score) || 3,
            description: a.description ? String(a.description) : undefined,
          }));
        } else {
          setGeneratedTasks([]);
          setGenerationDone(true);
          return;
        }
      }

      // Catégorie : mapping scoring_category → UUID (UUIDs fixes définis dans reset_part1)
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

      const { data: categories } = await supabase.from('task_categories').select('*').order('sort_order');
      const catMap = new Map<string, { id: string; name: string; icon: string; color_hex: string }>();
      for (const cat of (categories ?? [])) catMap.set(cat.id, cat);
      const defaultCatId = categories?.[0]?.id ?? '';

      // Récupérer les tâches existantes pour éviter les doublons (si l'onboarding est relancé)
      const { data: existingTasks } = await supabase
        .from('household_tasks')
        .select('name')
        .eq('household_id', householdId)
        .eq('is_active', true);

      // Créer les tâches (pas de doublon par nom, ni entre suggestions, ni avec l'existant)
      const created: typeof generatedTasks = [];
      const seen = new Set<string>(
        (existingTasks ?? []).map((t: { name: string }) => t.name.toLowerCase()),
      );

      const freqWindow: Record<string, number> = {
        daily: 1, weekly: 7, biweekly: 14, monthly: 30,
        quarterly: 90, semiannual: 180, yearly: 365,
      };

      // Préparer toutes les lignes à insérer en une seule fois
      type TaskRow = {
        household_id: string; name: string; category_id: string; frequency: string;
        mental_load_score: number; scoring_category: string; duration_estimate: string;
        physical_effort: string; is_active: boolean; is_fixed_assignment: boolean;
        notifications_enabled: boolean; created_by: string; assigned_to: null; next_due_at: string;
      };
      type CreatedTask = { catId: string; cat: { id: string; name: string; icon: string; color_hex: string } | undefined; nextDueIso: string };
      const rowsToInsert: TaskRow[] = [];
      const metaByName: Record<string, CreatedTask> = {};

      for (const aiTask of tasksToInsert) {
        const key = aiTask.name.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);

        const catId = SCORING_TO_CAT_ID[aiTask.scoring_category ?? ''] || defaultCatId;
        const freq = aiTask.frequency || 'weekly';
        const freqDays = freqWindow[freq] ?? 30;
        const dayOffset = freq === 'daily' ? 0 : Math.floor(Math.random() * freqDays);
        const nextDue = new Date(Date.now() + dayOffset * 86400000);
        nextDue.setHours(9, 0, 0, 0);
        const nextDueIso = nextDue.toISOString();

        rowsToInsert.push({
          household_id: householdId,
          name: aiTask.name,
          category_id: catId,
          frequency: freq,
          mental_load_score: aiTask.mental_load_score || 3,
          scoring_category: aiTask.scoring_category,
          duration_estimate: aiTask.duration_estimate,
          physical_effort: aiTask.physical_effort,
          is_active: true,
          is_fixed_assignment: false,
          notifications_enabled: true,
          created_by: userId,
          assigned_to: null,
          next_due_at: nextDueIso,
        });
        metaByName[aiTask.name] = { catId, cat: catMap.get(catId), nextDueIso };
      }

      // Un seul insert groupé au lieu de N inserts séquentiels
      if (rowsToInsert.length > 0) {
        const { data: insertedTasks } = await supabase
          .from('household_tasks')
          .insert(rowsToInsert)
          .select('id, name');

        for (const t of (insertedTasks ?? [])) {
          const meta = metaByName[t.name];
          if (meta) {
            created.push({
              id: t.id,
              name: t.name,
              category_id: meta.catId,
              category_name: meta.cat?.name,
              category_icon: meta.cat?.icon,
              category_color: meta.cat?.color_hex,
              next_due_at: meta.nextDueIso,
            });
          }
        }
      }

      setGeneratedTasks(created);

      // Créer aussi les membres fantômes pour la famille (sans doublon)
      const { data: existingPhantoms } = await supabase
        .from('phantom_members')
        .select('display_name')
        .eq('household_id', householdId);
      const existingNames = new Set((existingPhantoms ?? []).map((p: { display_name: string }) => p.display_name.toLowerCase()));

      for (const member of family) {
        if (member.type === 'pet') continue; // on ne crée pas de fantôme pour les animaux
        const name = member.name.trim();
        if (!name) continue;
        if (existingNames.has(name.toLowerCase())) continue; // déjà existant
        await supabase.from('phantom_members').insert({
          household_id: householdId,
          display_name: name,
          created_by: userId,
        });
      }

      await fetchHousehold(householdId);
      setGenerationDone(true);
    } catch (err) {
      console.error('[onboarding] Erreur:', err);
      setError('Une erreur est survenue.');
      setGenerationDone(true); // débloque l'animation même en cas d'erreur
    }
  }, [householdId, userId, selectedEquipment, family, fetchHousehold]);

  const handleShowResults = useCallback(async () => {
    if (householdId) await fetchTasks(householdId);
    setStep('results');
  }, [householdId, fetchTasks]);

  const handleFinish = useCallback(() => {
    router.push('/planning');
  }, [router]);

  // =============================================================================
  // RENDU
  // =============================================================================

  // ─── Écran 1 : Équipements ───
  if (step === 'equipment') {
    return (
      <div className="pt-4 pb-28">
        <div className="px-4 mb-6">
          <p className="text-[12px] text-[#8e8e93] font-semibold uppercase tracking-wide mb-2">Étape 1 / 2</p>
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
              {CATEGORY_LABELS[category] ?? category}
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

        <div className="fixed bottom-0 left-0 right-0 px-4 pb-6 pt-3" style={{ background: 'linear-gradient(transparent, #f6f8ff 30%)' }}>
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
          <p className="text-[12px] text-[#8e8e93] font-semibold uppercase tracking-wide mb-2">Étape 2 / 2</p>
          <h2 className="text-[26px] font-black text-[#1c1c1e] leading-tight">
            Qui vit<br />avec toi ?
          </h2>
          <p className="text-[14px] text-[#8e8e93] mt-2">
            Tape pour ajouter chaque membre.
          </p>
        </div>

        {/* Sélecteur de types */}
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

        {/* Liste famille */}
        {family.length > 0 && (
          <div className="mx-4 rounded-2xl bg-white overflow-hidden" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            {family.map((m, i) => (
              <div
                key={m.id}
                className="px-4 py-3 flex items-center gap-3"
                style={i < family.length - 1 ? { borderBottom: '0.5px solid var(--ios-separator)' } : {}}
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

        <div className="fixed bottom-0 left-0 right-0 px-4 pb-6 pt-3" style={{ background: 'linear-gradient(transparent, #f6f8ff 30%)' }}>
          <button
            onClick={async () => {
              setStep('thinking');
              await generateTasks();
            }}
            className="w-full rounded-2xl py-[16px] text-[17px] font-bold text-white"
            style={{
              background: 'linear-gradient(135deg, #007aff, #5856d6)',
              boxShadow: '0 8px 24px rgba(0,122,255,0.3)',
            }}
          >
            Créer mes tâches et mon planning →
          </button>
          <p className="text-center text-[11px] text-[#8e8e93] mt-2 leading-relaxed">
            En continuant, tu acceptes qu&apos;une IA analyse ton foyer pour générer tes tâches.{' '}
            <a href="/legal/privacy" target="_blank" style={{ color: '#007aff' }}>Confidentialité</a>
          </p>
        </div>
      </div>
    );
  }

  // ─── Écran 5 : Animation "Aura réfléchit" ───
  if (step === 'thinking') {
    const steps = [
      `${selectedEquipment.size} équipements analysés`,
      family.length > 0 ? `${family.length} membre${family.length > 1 ? 's' : ''} pris en compte` : 'Foyer solo',
      'Génération des tâches personnalisées',
      'Calcul des fréquences optimales',
      'Placement dans le calendrier',
    ];
    return (
      <div style={{
        background: 'linear-gradient(180deg, #0a1628 0%, #1e3a5f 100%)',
        minHeight: '100vh',
        marginLeft: '-16px',
        marginRight: '-16px',
        marginTop: '-24px',
        paddingTop: '100px',
      }}>
        <AnimatedThinking
          steps={steps}
          isReady={generationDone}
          onDone={handleShowResults}
        />
      </div>
    );
  }

  // Supprimer une tâche générée (depuis l'écran résultats)
  const deleteTask = useCallback(async (taskId: string) => {
    const supabase = createClient();
    await supabase.from('household_tasks').delete().eq('id', taskId);
    setGeneratedTasks((prev) => prev.filter((t) => t.id !== taskId));
  }, []);

  // ─── Écran résultats ───
  if (step === 'results') {
    // Liste plate triée par date croissante
    const sortedTasks = [...generatedTasks].sort((a, b) => {
      const da = a.next_due_at ? new Date(a.next_due_at).getTime() : Infinity;
      const db = b.next_due_at ? new Date(b.next_due_at).getTime() : Infinity;
      return da - db;
    });

    return (
      <div className="pt-4 pb-32">
        {/* Header */}
        <div className="px-4 mb-6 text-center">
          <div className="text-[52px] mb-3">✅</div>
          <h2 className="text-[26px] font-black text-[#1c1c1e] leading-tight">
            Aura a créé<br />{generatedTasks.length} tâche{generatedTasks.length > 1 ? 's' : ''} pour ton foyer
          </h2>
          <p className="text-[13px] text-[#8e8e93] mt-2">
            Appuie sur la poubelle pour retirer une tâche.
          </p>
        </div>

        {/* Liste plate chronologique */}
        <div className="px-4">
          <div className="rounded-2xl bg-white overflow-hidden" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            {sortedTasks.map((t, i) => (
              <div
                key={t.id}
                className="flex items-center gap-3 px-4 py-3"
                style={i < sortedTasks.length - 1 ? { borderBottom: '0.5px solid #f0f2f8' } : {}}
              >
                {/* Point couleur catégorie */}
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: t.category_color ?? '#8e8e93' }} />
                {/* Nom tâche */}
                <p className="flex-1 text-[14px] text-[#1c1c1e]">{t.name}</p>
                {/* Date */}
                {t.next_due_at && (
                  <p className="text-[11px] text-[#8e8e93] flex-shrink-0">
                    {new Date(t.next_due_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                  </p>
                )}
                {/* Bouton supprimer */}
                <button
                  onClick={() => deleteTask(t.id)}
                  className="flex-shrink-0 ml-1 w-8 h-8 rounded-full flex items-center justify-center transition-opacity active:opacity-50"
                  style={{ background: 'rgba(255,59,48,0.1)' }}
                  aria-label="Supprimer"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ff3b30" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                    <path d="M10 11v6M14 11v6" />
                    <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                  </svg>
                </button>
              </div>
            ))}
          </div>

          {generatedTasks.length === 0 && (
            <div className="text-center py-8">
              <p className="text-[15px] text-[#8e8e93]">Aucune tâche générée.</p>
            </div>
          )}
        </div>

        {/* CTA fixe */}
        <div className="fixed bottom-0 left-0 right-0 px-4 pb-6 pt-3" style={{ background: 'linear-gradient(transparent, #f6f8ff 30%)' }}>
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
