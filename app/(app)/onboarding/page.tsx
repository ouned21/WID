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
  | 'welcome'     // Écran d'accueil ("Prêt à décharger ta tête ?")
  | 'equipment'   // Sélection des équipements par catégories visuelles
  | 'size'        // Caractéristiques du foyer (slider)
  | 'family'      // Composition familiale
  | 'thinking'    // Animation "Aura réfléchit..."
  | 'brief'       // Brief 5 chiffres-choc
  | 'calendar'    // Scroll vertical du calendrier pré-rempli
  | 'swipe'       // Assignation par swipe
  | 'done';       // Fin

const CATEGORY_LABELS: Record<string, string> = {
  cuisine: '🍳 Cuisine',
  salle_de_bain: '🚿 Salle de bain',
  linge: '👕 Linge',
  sols: '🧹 Sols & Ménage',
  exterieur: '🌿 Extérieur',
  vehicule: '🚗 Véhicule',
  animaux: '🐾 Animaux',
};

const HOME_SIZES = [
  { value: 'small', label: 'Petit', icon: '🏠', desc: 'Studio ou 2 pièces' },
  { value: 'medium', label: 'Moyen', icon: '🏡', desc: '3-4 pièces' },
  { value: 'large', label: 'Grand', icon: '🏘', desc: '5+ pièces ou maison' },
];

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
      <p className="text-[18px] font-bold text-[#1c1c1e] mb-6">Aura analyse ton foyer</p>
      <div className="space-y-3 text-left max-w-sm">
        {steps.map((step, i) => (
          <div key={i} className="flex items-center gap-3 text-[15px] transition-opacity duration-300" style={{
            opacity: i <= currentStep ? 1 : 0.2,
          }}>
            <span className="text-[18px]">{i < currentStep ? '✓' : i === currentStep ? '⋯' : '○'}</span>
            <span className="text-[#3c3c43]">{step}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BigNumber({ value, label, show }: { value: number | string; label: string; show: boolean }) {
  return (
    <div className={`flex flex-col items-center justify-center min-h-[70vh] px-6 transition-opacity duration-500`} style={{
      opacity: show ? 1 : 0,
    }}>
      <span className="text-[120px] font-black leading-none text-white text-center" style={{
        letterSpacing: '-0.05em',
        textShadow: '0 8px 40px rgba(0,0,0,0.3)',
      }}>
        {value}
      </span>
      <p className="text-[20px] text-white/80 text-center font-semibold mt-4 max-w-xs">
        {label}
      </p>
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
  const { allMembers, fetchHousehold } = useHouseholdStore();

  const [step, setStep] = useState<Step>('welcome');
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<Set<string>>(new Set());
  const [homeSize, setHomeSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [family, setFamily] = useState<FamilyMember[]>([]);
  const [generatedTasks, setGeneratedTasks] = useState<{ id: string; name: string; category_id: string; category_name?: string; category_icon?: string; category_color?: string; next_due_at?: string | null }[]>([]);
  const [swipeIndex, setSwipeIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [generationDone, setGenerationDone] = useState(false);

  // Brief chiffres-choc
  const [briefStep, setBriefStep] = useState(0);
  const briefNumbers = useMemo(() => {
    const total = generatedTasks.length;
    const recurring = Math.floor(total * 0.7);
    const forgotten = Math.floor(total * 0.35);
    const critical = Math.min(5, Math.floor(total * 0.1));
    const hours = Math.round(total * 0.15);
    return [
      { value: total, label: 'tâches planifiées' },
      { value: `${hours}h`, label: 'de travail par semaine économisées' },
      { value: forgotten, label: 'tâches que tu aurais oubliées' },
      { value: critical, label: 'rappels critiques détectés' },
      { value: '0', label: 'décision à prendre maintenant' },
    ];
  }, [generatedTasks.length]);

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

      // Récupérer associations équipements
      const { data: equipAssoc } = await supabase
        .from('task_associations')
        .select('*')
        .eq('trigger_type', 'equipment')
        .in('trigger_value', [...selectedEquipment]);

      // Récupérer associations enfants
      const childAgeRanges = new Set<string>();
      for (const member of family) {
        if (member.type === 'baby') childAgeRanges.add('0-2');
        else if (member.type === 'child') {
          // Deviner si petit (3-5) ou grand (6-12) selon date de naissance
          if (member.birthdate) {
            const age = Math.floor((Date.now() - new Date(member.birthdate).getTime()) / (365.25 * 24 * 3600 * 1000));
            if (age <= 5) childAgeRanges.add('3-5');
            else childAgeRanges.add('6-12');
          } else {
            childAgeRanges.add('6-12');
          }
        }
        else if (member.type === 'teen') childAgeRanges.add('13+');
      }

      let childAssoc: typeof equipAssoc = [];
      if (childAgeRanges.size > 0) {
        const { data } = await supabase
          .from('task_associations')
          .select('*')
          .eq('trigger_type', 'child_age')
          .in('trigger_value', [...childAgeRanges]);
        childAssoc = data ?? [];
      }

      const allAssoc = [...(equipAssoc ?? []), ...(childAssoc ?? [])];

      // Catégorie par défaut
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

      for (const assoc of allAssoc) {
        const key = assoc.suggested_name.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);

        const catId = assoc.suggested_category_id || defaultCatId;
        const cat = catMap.get(catId);

        // Calculer next_due_at aléatoire dans les 30 prochains jours
        const dayOffset = Math.floor(Math.random() * 30);
        const nextDue = new Date(Date.now() + dayOffset * 86400000);
        nextDue.setHours(9, 0, 0, 0);

        const { data: taskData } = await supabase
          .from('household_tasks')
          .insert({
            household_id: householdId,
            name: assoc.suggested_name,
            category_id: catId,
            frequency: assoc.suggested_frequency || 'weekly',
            mental_load_score: assoc.suggested_mental_load_score || 3,
            scoring_category: assoc.suggested_scoring_category,
            duration_estimate: assoc.suggested_duration,
            physical_effort: assoc.suggested_physical,
            is_active: true,
            is_fixed_assignment: false,
            notifications_enabled: true,
            created_by: userId,
            assigned_to: null,
            next_due_at: nextDue.toISOString(),
          })
          .select('id, name')
          .single();

        if (taskData) {
          created.push({
            id: taskData.id,
            name: taskData.name,
            category_id: catId,
            category_name: cat?.name,
            category_icon: cat?.icon,
            category_color: cat?.color_hex,
            next_due_at: nextDue.toISOString(),
          });
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

  // Swipe : assigner une tâche
  const handleSwipe = useCallback(async (memberId: string | null) => {
    if (swipeIndex >= generatedTasks.length) return;
    const task = generatedTasks[swipeIndex];

    if (memberId) {
      const supabase = createClient();
      const member = allMembers.find((m) => m.id === memberId);
      await supabase
        .from('household_tasks')
        .update({
          assigned_to: member?.isPhantom ? null : memberId,
          assigned_to_phantom_id: member?.isPhantom ? memberId : null,
        })
        .eq('id', task.id);
    }

    setSwipeIndex((prev) => prev + 1);
  }, [swipeIndex, generatedTasks, allMembers]);

  const handleFinish = useCallback(async () => {
    if (householdId) await fetchTasks(householdId);
    router.push('/dashboard');
  }, [householdId, fetchTasks, router]);

  // =============================================================================
  // RENDU
  // =============================================================================

  // ─── Écran 1 : Welcome ───
  if (step === 'welcome') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] px-6 text-center">
        <div className="text-[64px] mb-6">✨</div>
        <h1 className="text-[32px] font-black text-[#1c1c1e] mb-3 leading-tight">
          Prêt à décharger<br />ta tête ?
        </h1>
        <p className="text-[16px] text-[#8e8e93] mb-8 max-w-sm leading-relaxed">
          En 2 minutes, Aura va découvrir ton foyer et planifier les 3 prochains mois pour toi.
        </p>
        <button
          onClick={() => setStep('equipment')}
          className="w-full max-w-sm rounded-2xl py-[16px] text-[17px] font-bold text-white"
          style={{
            background: 'linear-gradient(135deg, #007aff, #5856d6)',
            boxShadow: '0 8px 24px rgba(0,122,255,0.3)',
          }}
        >
          Commencer →
        </button>
      </div>
    );
  }

  // ─── Écran 2 : Équipements ───
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
            onClick={() => setStep('size')}
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

  // ─── Écran 3 : Taille du foyer ───
  if (step === 'size') {
    return (
      <div className="pt-4 pb-28">
        <div className="px-4 mb-8">
          <p className="text-[12px] text-[#8e8e93] font-semibold uppercase tracking-wide mb-2">Étape 2 / 3</p>
          <h2 className="text-[26px] font-black text-[#1c1c1e] leading-tight">
            Ton foyer,<br />c&apos;est quelle taille ?
          </h2>
          <p className="text-[14px] text-[#8e8e93] mt-2">
            Ça aide Aura à estimer le travail.
          </p>
        </div>

        <div className="mx-4 space-y-3">
          {HOME_SIZES.map((size) => {
            const selected = homeSize === size.value;
            return (
              <button
                key={size.value}
                onClick={() => setHomeSize(size.value as typeof homeSize)}
                className="w-full rounded-2xl p-5 flex items-center gap-4 text-left transition-all active:scale-[0.98]"
                style={{
                  background: selected ? 'linear-gradient(135deg, #007aff, #5856d6)' : 'white',
                  boxShadow: selected
                    ? '0 8px 24px rgba(0,122,255,0.3)'
                    : '0 1px 4px rgba(0,0,0,0.06)',
                }}
              >
                <span className="text-[48px]">{size.icon}</span>
                <div>
                  <p className="text-[18px] font-bold" style={{ color: selected ? 'white' : '#1c1c1e' }}>
                    {size.label}
                  </p>
                  <p className="text-[13px]" style={{ color: selected ? 'rgba(255,255,255,0.8)' : '#8e8e93' }}>
                    {size.desc}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="fixed bottom-0 left-0 right-0 px-4 pb-6 pt-3" style={{ background: 'linear-gradient(transparent, #f6f8ff 30%)' }}>
          <button
            onClick={() => setStep('family')}
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

  // ─── Écran 4 : Famille ───
  if (step === 'family') {
    const needsBirthdate = (type: FamilyMember['type']) => type === 'baby' || type === 'child' || type === 'teen';

    return (
      <div className="pt-4 pb-28">
        <div className="px-4 mb-6">
          <p className="text-[12px] text-[#8e8e93] font-semibold uppercase tracking-wide mb-2">Étape 3 / 3</p>
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
            Générer mon planning →
          </button>
          <p className="text-center text-[11px] text-[#8e8e93] mt-2">
            Tu peux aussi passer sans ajouter personne
          </p>
        </div>
      </div>
    );
  }

  // ─── Écran 5 : Animation "Aura réfléchit" ───
  if (step === 'thinking') {
    const steps = [
      `Analyse de ${selectedEquipment.size} équipements`,
      `Prise en compte de ${family.length || 'ton'} foyer`,
      'Génération des tâches récurrentes',
      'Détection des rappels saisonniers',
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
          onDone={() => {
            // Si aucune tâche générée, skip le brief (chiffres à 0)
            if (generatedTasks.length === 0) {
              setStep('calendar');
            } else {
              setStep('brief');
            }
          }}
        />
      </div>
    );
  }

  // ─── Écran 6 : Brief 5 chiffres-choc ───
  if (step === 'brief') {
    const current = briefNumbers[briefStep];
    const isLast = briefStep === briefNumbers.length - 1;

    return (
      <div
        onClick={() => {
          if (isLast) setStep('calendar');
          else setBriefStep((s) => s + 1);
        }}
        style={{
          background: 'linear-gradient(180deg, #0a1628 0%, #1e3a5f 50%, #3a1c71 100%)',
          minHeight: '100vh',
          marginLeft: '-16px',
          marginRight: '-16px',
          marginTop: '-24px',
          cursor: 'pointer',
        }}
      >
        <BigNumber value={current.value} label={current.label} show={true} />
        <div className="absolute bottom-12 left-0 right-0 flex justify-center gap-2">
          {briefNumbers.map((_, i) => (
            <div key={i} className="h-1 w-8 rounded-full" style={{
              background: i <= briefStep ? 'white' : 'rgba(255,255,255,0.3)',
              transition: 'background 0.3s',
            }} />
          ))}
        </div>
        <p className="absolute bottom-4 left-0 right-0 text-center text-[12px] text-white/50">
          Tape pour continuer
        </p>
      </div>
    );
  }

  // ─── Écran 7 : Calendrier pré-rempli (scroll auto) ───
  if (step === 'calendar') {
    // Grouper tâches par mois
    const tasksByMonth: Record<string, typeof generatedTasks> = {};
    for (const t of generatedTasks) {
      if (!t.next_due_at) continue;
      const date = new Date(t.next_due_at);
      const key = date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      if (!tasksByMonth[key]) tasksByMonth[key] = [];
      tasksByMonth[key].push(t);
    }

    return (
      <div className="pb-28">
        <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-xl -mx-4 px-4 py-4 mb-4">
          <p className="text-[12px] text-[#8e8e93] font-semibold uppercase tracking-wide">Ton planning</p>
          <h2 className="text-[22px] font-black text-[#1c1c1e]">
            Aura a tout organisé pour toi.
          </h2>
          <p className="text-[13px] text-[#8e8e93] mt-1">Regarde les 3 prochains mois.</p>
        </div>

        {Object.entries(tasksByMonth).slice(0, 3).map(([month, tasks]) => (
          <div key={month} className="mb-6">
            <p className="text-[15px] font-bold text-[#1c1c1e] mb-3 capitalize">{month}</p>
            <div className="space-y-2">
              {tasks.slice(0, 8).map((t) => (
                <div
                  key={t.id}
                  className="rounded-xl bg-white p-3 flex items-center gap-3"
                  style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
                >
                  <div className="h-10 w-10 rounded-xl flex items-center justify-center text-[16px]" style={{
                    background: (t.category_color ?? '#007aff') + '22',
                  }}>
                    {t.category_icon ?? '📋'}
                  </div>
                  <div className="flex-1">
                    <p className="text-[14px] font-semibold text-[#1c1c1e]">{t.name}</p>
                    <p className="text-[11px] text-[#8e8e93]">
                      {t.next_due_at && new Date(t.next_due_at).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                </div>
              ))}
              {tasks.length > 8 && (
                <p className="text-center text-[12px] text-[#8e8e93]">+ {tasks.length - 8} autres</p>
              )}
            </div>
          </div>
        ))}

        <div className="fixed bottom-0 left-0 right-0 px-4 pb-6 pt-3" style={{ background: 'linear-gradient(transparent, #f6f8ff 30%)' }}>
          <button
            onClick={() => {
              if (generatedTasks.length > 0) setStep('swipe');
              else handleFinish();
            }}
            className="w-full rounded-2xl py-[16px] text-[17px] font-bold text-white"
            style={{
              background: 'linear-gradient(135deg, #007aff, #5856d6)',
              boxShadow: '0 8px 24px rgba(0,122,255,0.3)',
            }}
          >
            Assigner les tâches →
          </button>
        </div>
      </div>
    );
  }

  // ─── Écran 8 : Swipe assignation ───
  if (step === 'swipe') {
    const isFinished = swipeIndex >= generatedTasks.length;
    const currentTask = generatedTasks[swipeIndex];

    if (isFinished) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center">
          <div className="text-[72px] mb-4">✅</div>
          <h2 className="text-[28px] font-black text-[#1c1c1e] mb-2">Tout est prêt.</h2>
          <p className="text-[15px] text-[#8e8e93] mb-8 max-w-sm">
            Aura s&apos;occupe du reste. Tu peux te concentrer sur l&apos;essentiel.
          </p>
          <button
            onClick={handleFinish}
            className="w-full max-w-sm rounded-2xl py-[16px] text-[17px] font-bold text-white"
            style={{
              background: 'linear-gradient(135deg, #34c759, #30d158)',
              boxShadow: '0 8px 24px rgba(52,199,89,0.3)',
            }}
          >
            Ouvrir Aura →
          </button>
        </div>
      );
    }

    return (
      <div className="pt-4 pb-28">
        <div className="px-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[13px] text-[#8e8e93]">{swipeIndex + 1} / {generatedTasks.length}</span>
            <button onClick={handleFinish} className="text-[13px] font-medium" style={{ color: '#007aff' }}>
              Terminer
            </button>
          </div>
          <div className="h-1.5 rounded-full" style={{ background: '#e5e5ea' }}>
            <div className="h-1.5 rounded-full transition-all" style={{
              width: `${((swipeIndex + 1) / generatedTasks.length) * 100}%`,
              background: 'linear-gradient(90deg, #007aff, #5856d6)',
            }} />
          </div>
        </div>

        {/* Carte tâche */}
        <div className="mx-4 rounded-3xl p-6 text-center min-h-[220px] flex flex-col justify-center" style={{
          background: 'linear-gradient(135deg, #ffffff, #f6f8ff)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
        }}>
          <div className="text-[40px] mb-2">{currentTask.category_icon ?? '📋'}</div>
          <p className="text-[22px] font-black text-[#1c1c1e] mb-2">{currentTask.name}</p>
          <p className="text-[13px] text-[#8e8e93]">{currentTask.category_name}</p>
          <p className="text-[13px] text-[#8e8e93] mt-4">Qui s&apos;en occupe ?</p>
        </div>

        {/* Boutons membres */}
        <div className="mx-4 mt-6 space-y-2">
          {allMembers.map((member) => (
            <button
              key={member.id}
              onClick={() => handleSwipe(member.id)}
              className="w-full rounded-2xl py-[14px] text-[16px] font-bold text-white transition-transform active:scale-[0.97]"
              style={{
                background: member.isPhantom
                  ? 'linear-gradient(135deg, #8e8e93, #636366)'
                  : 'linear-gradient(135deg, #007aff, #5856d6)',
                boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
              }}
            >
              {member.isPhantom ? '👻 ' : ''}{member.display_name}
            </button>
          ))}
          <button
            onClick={() => handleSwipe(null)}
            className="w-full rounded-2xl py-[14px] text-[15px] font-semibold bg-white"
            style={{ color: '#8e8e93', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
          >
            Passer (non assigné)
          </button>
        </div>

        {error && (
          <div className="mx-4 mt-4 rounded-xl px-4 py-3 text-[13px]" style={{ background: '#fff2f2', color: '#ff3b30' }}>
            {error}
          </div>
        )}
      </div>
    );
  }

  return null;
}
