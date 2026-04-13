'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useTaskStore } from '@/stores/taskStore';
import { useHouseholdStore } from '@/stores/householdStore';
import { createClient } from '@/lib/supabase';

// -- Types -------------------------------------------------------------------

type Equipment = {
  id: string;
  name: string;
  icon: string;
  category: string;
  is_default: boolean;
};

type Child = {
  name: string;
  age: number;
};

type Step = 'equipment' | 'family' | 'ready' | 'swipe';

const CATEGORY_LABELS: Record<string, string> = {
  cuisine: 'Cuisine',
  salle_de_bain: 'Salle de bain',
  linge: 'Linge',
  sols: 'Sols & Ménage',
  exterieur: 'Extérieur',
  vehicule: 'Véhicule',
  animaux: 'Animaux',
};

// -- Page --------------------------------------------------------------------

export default function OnboardingPage() {
  const router = useRouter();
  const { profile } = useAuthStore();
  const { fetchTasks } = useTaskStore();
  const { allMembers } = useHouseholdStore();

  const [step, setStep] = useState<Step>('equipment');
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<Set<string>>(new Set());
  const [children, setChildren] = useState<Child[]>([]);
  const [hasChildren, setHasChildren] = useState<boolean | null>(null);
  const [generatedTasks, setGeneratedTasks] = useState<{ id: string; name: string; category_name?: string }[]>([]);
  const [swipeIndex, setSwipeIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        // Pré-cocher les défauts
        const defaults = new Set<string>();
        for (const eq of data as Equipment[]) {
          if (eq.is_default) defaults.add(eq.id);
        }
        setSelectedEquipment(defaults);
      }
    }
    load();
  }, []);

  // Toggle équipement
  const toggleEquipment = useCallback((id: string) => {
    setSelectedEquipment((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Ajouter un enfant
  const addChild = useCallback(() => {
    setChildren((prev) => [...prev, { name: '', age: 5 }]);
  }, []);

  const updateChild = useCallback((index: number, field: 'name' | 'age', value: string | number) => {
    setChildren((prev) => prev.map((c, i) => i === index ? { ...c, [field]: value } : c));
  }, []);

  const removeChild = useCallback((index: number) => {
    setChildren((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Générer les tâches
  const generateTasks = useCallback(async () => {
    if (!householdId || !userId) return;
    setGenerating(true);
    setError(null);

    try {
    const supabase = createClient();

    // 1. Récupérer les associations pour les équipements sélectionnés
    const { data: equipAssoc } = await supabase
      .from('task_associations')
      .select('*')
      .eq('trigger_type', 'equipment')
      .in('trigger_value', [...selectedEquipment]);

    // 2. Récupérer les associations pour les enfants par tranche d'âge
    const childAgeRanges = new Set<string>();
    for (const child of children) {
      if (child.age <= 2) childAgeRanges.add('0-2');
      else if (child.age <= 5) childAgeRanges.add('3-5');
      else if (child.age <= 12) childAgeRanges.add('6-12');
      else childAgeRanges.add('13+');
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

    // 3. Récupérer une catégorie par défaut
    const { data: defaultCat } = await supabase.from('task_categories').select('id').limit(1);
    const defaultCatId = defaultCat?.[0]?.id ?? '';

    // 4. Créer les tâches en base (non assignées)
    const created: { id: string; name: string; category_name?: string }[] = [];
    const seen = new Set<string>(); // éviter les doublons

    for (const assoc of allAssoc) {
      const key = assoc.suggested_name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      const { data: taskData } = await supabase
        .from('household_tasks')
        .insert({
          household_id: householdId,
          name: assoc.suggested_name,
          category_id: assoc.suggested_category_id || defaultCatId,
          frequency: assoc.suggested_frequency || 'weekly',
          mental_load_score: assoc.suggested_mental_load_score || 3,
          scoring_category: assoc.suggested_scoring_category,
          duration_estimate: assoc.suggested_duration,
          physical_effort: assoc.suggested_physical,
          is_active: true,
          is_fixed_assignment: false,
          notifications_enabled: true,
          estimated_cost: null,
          created_by: userId,
          assigned_to: null, // non assigné → pool
        })
        .select('id, name')
        .single();

      if (taskData) {
        created.push({ id: taskData.id, name: taskData.name });
      }
    }

    setGeneratedTasks(created);
    setGenerating(false);
    if (created.length === 0) {
      setError('Aucune tâche générée. Sélectionne au moins un équipement.');
    } else {
      setStep('ready');
    }
    } catch (err) {
      console.error('[onboarding] Erreur génération:', err);
      setError('Une erreur est survenue. Réessaie.');
      setGenerating(false);
    }
  }, [householdId, userId, selectedEquipment, children]);

  // Swipe : assigner une tâche à un membre
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

  // Fin du swipe
  const handleFinish = useCallback(async () => {
    if (householdId) await fetchTasks(householdId);
    router.push('/tasks');
  }, [householdId, fetchTasks, router]);

  // Grouper les équipements par catégorie
  const groupedEquipment = equipment.reduce((acc, eq) => {
    if (!acc[eq.category]) acc[eq.category] = [];
    acc[eq.category].push(eq);
    return acc;
  }, {} as Record<string, Equipment[]>);

  // =========================================================================
  // RENDU
  // =========================================================================

  // Écran 1 : Équipements
  if (step === 'equipment') {
    return (
      <div className="pt-4 pb-28">
        <div className="px-4 mb-6">
          <h2 className="text-[28px] font-bold text-[#1c1c1e]">Ton logement</h2>
          <p className="text-[15px] text-[#8e8e93] mt-1">Sélectionne ce que tu as chez toi. On crée les tâches automatiquement.</p>
        </div>

        {Object.entries(groupedEquipment).map(([category, items]) => (
          <div key={category} className="mb-4">
            <p className="text-[11px] font-bold text-[#8e8e93] uppercase tracking-[0.15em] mb-2 px-5">
              {CATEGORY_LABELS[category] ?? category}
            </p>
            <div className="flex flex-wrap gap-2 px-4">
              {items.map((eq) => {
                const selected = selectedEquipment.has(eq.id);
                return (
                  <button key={eq.id} onClick={() => toggleEquipment(eq.id)}
                    className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-[14px] font-medium transition-all"
                    style={{
                      background: selected ? '#007aff' : 'white',
                      color: selected ? 'white' : '#1c1c1e',
                      boxShadow: selected ? '0 2px 8px rgba(0,122,255,0.3)' : '0 0.5px 3px rgba(0,0,0,0.06)',
                    }}>
                    <span className="text-[18px]">{eq.icon}</span>
                    <span>{eq.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <div className="fixed bottom-0 left-0 right-0 px-4 pb-6 pt-3" style={{ background: 'linear-gradient(transparent, #f6f8ff 30%)' }}>
          <button onClick={() => setStep('family')}
            className="w-full rounded-xl py-[14px] text-[17px] font-semibold text-white"
            style={{ background: '#007aff' }}>
            Suivant — Ta famille →
          </button>
          <p className="text-[12px] text-[#8e8e93] text-center mt-2">{selectedEquipment.size} équipement{selectedEquipment.size > 1 ? 's' : ''} sélectionné{selectedEquipment.size > 1 ? 's' : ''}</p>
        </div>
      </div>
    );
  }

  // Écran 2 : Famille
  if (step === 'family') {
    return (
      <div className="pt-4 pb-28">
        <div className="px-4 mb-6">
          <button onClick={() => setStep('equipment')} className="text-[15px] font-medium mb-3" style={{ color: '#007aff' }}>← Retour</button>
          <h2 className="text-[28px] font-bold text-[#1c1c1e]">Ta famille</h2>
          <p className="text-[15px] text-[#8e8e93] mt-1">On adapte les tâches selon tes enfants.</p>
        </div>

        {hasChildren === null ? (
          <div className="mx-4 space-y-3">
            <button onClick={() => { setHasChildren(true); addChild(); }}
              className="w-full rounded-2xl p-5 text-left flex items-center gap-4"
              style={{ background: 'white', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
              <span className="text-[32px]">👶</span>
              <div>
                <p className="text-[17px] font-bold text-[#1c1c1e]">Oui, j&apos;ai des enfants</p>
                <p className="text-[13px] text-[#8e8e93]">On génère les tâches associées</p>
              </div>
            </button>
            <button onClick={() => { setHasChildren(false); generateTasks(); }}
              className="w-full rounded-2xl p-5 text-left flex items-center gap-4"
              style={{ background: 'white', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
              <span className="text-[32px]">🏠</span>
              <div>
                <p className="text-[17px] font-bold text-[#1c1c1e]">Non, pas d&apos;enfants</p>
                <p className="text-[13px] text-[#8e8e93]">On se concentre sur le logement</p>
              </div>
            </button>
          </div>
        ) : (
          <div className="mx-4 space-y-3">
            {children.map((child, i) => (
              <div key={i} className="rounded-2xl bg-white p-4 flex items-center gap-3" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
                <input type="text" value={child.name} onChange={(e) => updateChild(i, 'name', e.target.value)}
                  placeholder="Prénom" className="flex-1 text-[17px] font-semibold text-[#1c1c1e] bg-transparent outline-none placeholder:text-[#c7c7cc]" />
                <div className="flex items-center gap-2">
                  <span className="text-[13px] text-[#8e8e93]">{child.age} an{child.age > 1 ? 's' : ''}</span>
                  <input type="range" min={0} max={18} value={child.age}
                    onChange={(e) => updateChild(i, 'age', parseInt(e.target.value))}
                    className="w-20" />
                </div>
                <button onClick={() => removeChild(i)} className="text-[#ff3b30] text-[15px]">✕</button>
              </div>
            ))}

            <button onClick={addChild}
              className="w-full rounded-xl py-3 text-[15px] font-medium text-center"
              style={{ color: '#007aff', background: '#EEF4FF' }}>
              + Ajouter un enfant
            </button>
          </div>
        )}

        {hasChildren && children.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 px-4 pb-6 pt-3" style={{ background: 'linear-gradient(transparent, #f6f8ff 30%)' }}>
            <button onClick={generateTasks} disabled={generating}
              className="w-full rounded-xl py-[14px] text-[17px] font-semibold text-white disabled:opacity-50"
              style={{ background: '#007aff' }}>
              {generating ? 'Génération...' : 'Générer les tâches →'}
            </button>
          </div>
        )}

        {error && (
          <div className="mx-4 mb-4 rounded-xl px-4 py-3 text-[14px]" style={{ background: '#fff2f2', color: '#ff3b30' }}>{error}</div>
        )}

        {generating && (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#e5e5ea] border-t-[#007aff]" />
          </div>
        )}
      </div>
    );
  }

  // Écran 3 : C'est prêt
  if (step === 'ready') {
    return (
      <div className="pt-4 pb-28 flex flex-col items-center justify-center min-h-[60vh] px-4">
        <div className="text-[64px] mb-4" style={{ animation: 'scaleIn 0.4s ease-out' }}>🎉</div>
        <h2 className="text-[28px] font-bold text-[#1c1c1e] text-center">{generatedTasks.length} tâches créées</h2>
        <p className="text-[15px] text-[#8e8e93] text-center mt-2 mb-8">Maintenant, assigne-les en swipant !</p>

        <button onClick={() => setStep('swipe')}
          className="w-full max-w-sm rounded-xl py-[14px] text-[17px] font-semibold text-white"
          style={{ background: '#007aff' }}>
          Assigner les tâches →
        </button>

        <button onClick={handleFinish}
          className="mt-3 text-[15px] font-medium" style={{ color: '#8e8e93' }}>
          Plus tard
        </button>
      </div>
    );
  }

  // Écran 4 : Swipe d'assignation
  if (step === 'swipe') {
    const currentTask = generatedTasks[swipeIndex];
    const isFinished = swipeIndex >= generatedTasks.length;
    const realMembers = allMembers.filter((m) => !m.isPhantom || true); // tous les membres

    if (isFinished) {
      return (
        <div className="pt-4 pb-28 flex flex-col items-center justify-center min-h-[60vh] px-4">
          <div className="text-[64px] mb-4">✅</div>
          <h2 className="text-[28px] font-bold text-[#1c1c1e] text-center">Tout est assigné !</h2>
          <p className="text-[15px] text-[#8e8e93] text-center mt-2 mb-8">Ton foyer est prêt.</p>
          <button onClick={handleFinish}
            className="w-full max-w-sm rounded-xl py-[14px] text-[17px] font-semibold text-white"
            style={{ background: '#34c759' }}>
            Voir mes tâches →
          </button>
        </div>
      );
    }

    return (
      <div className="pt-4 pb-28">
        {/* Progress */}
        <div className="px-4 mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[13px] text-[#8e8e93]">{swipeIndex + 1} / {generatedTasks.length}</span>
            <button onClick={handleFinish} className="text-[13px]" style={{ color: '#007aff' }}>Terminer</button>
          </div>
          <div className="h-1 rounded-full" style={{ background: '#e5e5ea' }}>
            <div className="h-1 rounded-full transition-all" style={{
              width: `${((swipeIndex + 1) / generatedTasks.length) * 100}%`,
              background: '#007aff',
            }} />
          </div>
        </div>

        {/* Carte tâche */}
        <div className="mx-4 rounded-3xl bg-white p-6 text-center" style={{
          boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
          minHeight: 200,
        }}>
          <p className="text-[24px] font-bold text-[#1c1c1e] mb-2">{currentTask.name}</p>
          <p className="text-[14px] text-[#8e8e93]">Qui s&apos;en occupe ?</p>
        </div>

        {/* Boutons membres */}
        <div className="mx-4 mt-6 space-y-2">
          {realMembers.map((member) => (
            <button key={member.id} onClick={() => handleSwipe(member.id)}
              className="w-full rounded-xl py-3.5 text-[17px] font-semibold text-white transition-all active:scale-[0.97]"
              style={{ background: member.isPhantom ? '#8e8e93' : '#007aff' }}>
              {member.isPhantom ? '👻 ' : ''}{member.display_name}
            </button>
          ))}
          <button onClick={() => handleSwipe(null)}
            className="w-full rounded-xl py-3.5 text-[15px] font-medium transition-all"
            style={{ color: '#8e8e93', background: '#f0f2f8' }}>
            Passer (non assigné)
          </button>
        </div>
      </div>
    );
  }

  return null;
}
