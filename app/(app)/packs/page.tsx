'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useTaskStore } from '@/stores/taskStore';
import { createClient } from '@/lib/supabase';

type Pack = {
  id: string;
  name: string;
  emoji: string;
  description: string;
  taskCount: number;
  color: string;
  gradient: string;
  triggerValue: string;
};

const PACKS: Pack[] = [
  {
    id: 'demenagement', name: 'Déménagement', emoji: '📦',
    description: '17 tâches sur 3 mois : cartons, résiliations, changement d\'adresse, état des lieux...',
    taskCount: 17, color: '#ff9500', gradient: 'linear-gradient(135deg, #ff9500, #ff6b00)',
    triggerValue: 'demenagement',
  },
  {
    id: 'mariage', name: 'Mariage', emoji: '💍',
    description: '15 tâches sur 12 mois : salle, traiteur, photographe, robe, faire-part, plan de table...',
    taskCount: 15, color: '#af52de', gradient: 'linear-gradient(135deg, #af52de, #5856d6)',
    triggerValue: 'mariage',
  },
  {
    id: 'bebe', name: 'Bébé arrive', emoji: '👶',
    description: '11 tâches sur 9 mois : chambre, matériel, pédiatre, valise maternité, congé, CAF...',
    taskCount: 11, color: '#ff6b9d', gradient: 'linear-gradient(135deg, #ff6b9d, #ff3b30)',
    triggerValue: 'bebe',
  },
];

export default function PacksPage() {
  const router = useRouter();
  const { profile } = useAuthStore();
  const { fetchTasks } = useTaskStore();

  const [activating, setActivating] = useState<string | null>(null);
  const [activated, setActivated] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  // Date de référence pour le pack (l'utilisateur la choisira)
  const [packDate, setPackDate] = useState('');
  const [selectedPack, setSelectedPack] = useState<Pack | null>(null);

  const handleActivate = useCallback(async () => {
    if (!profile?.household_id || !profile?.id || !selectedPack || !packDate) return;

    setActivating(selectedPack.id);
    setError(null);

    try {
      const supabase = createClient();

      // 1. Récupérer les associations du pack
      const { data: associations } = await supabase
        .from('task_associations')
        .select('*')
        .eq('trigger_type', 'pack')
        .eq('trigger_value', selectedPack.triggerValue)
        .order('sort_order');

      if (!associations || associations.length === 0) {
        setError('Pack non trouvé en base.');
        setActivating(null);
        return;
      }

      // 2. Date de référence
      const refDate = new Date(`${packDate}T09:00:00`);

      // 3. Récupérer une catégorie par défaut
      const { data: defaultCat } = await supabase.from('task_categories').select('id').limit(1);
      const defaultCatId = defaultCat?.[0]?.id ?? '';

      // 4. Créer les tâches
      for (const assoc of associations) {
        const taskDate = new Date(refDate);
        taskDate.setDate(taskDate.getDate() + (assoc.relative_days || 0));

        await supabase.from('household_tasks').insert({
          household_id: profile.household_id,
          name: assoc.suggested_name,
          category_id: assoc.suggested_category_id || defaultCatId,
          frequency: 'once',
          mental_load_score: assoc.suggested_mental_load_score || 3,
          scoring_category: assoc.suggested_scoring_category || 'misc',
          duration_estimate: assoc.suggested_duration || 'short',
          physical_effort: assoc.suggested_physical || 'light',
          is_active: true,
          is_fixed_assignment: false,
          notifications_enabled: true,
          created_by: profile.id,
          assigned_to: null,
          next_due_at: taskDate.toISOString(),
        });
      }

      // 5. Rafraîchir
      await fetchTasks(profile.household_id);

      setActivated((prev) => new Set(prev).add(selectedPack.id));
      setSelectedPack(null);
      setPackDate('');
      setActivating(null);
    } catch (err) {
      console.error('[packs] Erreur:', err);
      setError('Erreur lors de l\'activation.');
      setActivating(null);
    }
  }, [profile, selectedPack, packDate, fetchTasks]);

  return (
    <div className="pt-4 pb-28">
      <div className="px-4 mb-6">
        <button onClick={() => router.back()} className="text-[15px] font-medium mb-3" style={{ color: '#007aff' }}>← Retour</button>
        <h2 className="text-[28px] font-bold text-[#1c1c1e]">Packs Projets</h2>
        <p className="text-[15px] text-[#8e8e93] mt-1">Des dizaines de tâches pré-organisées pour vos grands projets.</p>
      </div>

      {error && (
        <div className="mx-4 mb-4 rounded-xl px-4 py-3 text-[14px]" style={{ background: '#fff2f2', color: '#ff3b30' }}>{error}</div>
      )}

      {/* Overlay choix de date */}
      {selectedPack && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4" onClick={() => { setSelectedPack(null); setPackDate(''); }}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-6" onClick={(e) => e.stopPropagation()}
            style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
            <p className="text-[20px] font-bold text-[#1c1c1e] mb-1">{selectedPack.emoji} {selectedPack.name}</p>
            <p className="text-[14px] text-[#8e8e93] mb-4">
              {selectedPack.id === 'mariage' ? 'Quelle est la date du mariage ?' :
               selectedPack.id === 'bebe' ? 'Quelle est la date prévue d\'accouchement ?' :
               'Quelle est la date du déménagement ?'}
            </p>
            <input type="date" value={packDate} onChange={(e) => setPackDate(e.target.value)}
              className="w-full rounded-xl px-4 py-3 text-[17px] text-[#1c1c1e] mb-4"
              style={{ background: '#f0f2f8' }} />
            <button onClick={handleActivate}
              disabled={!packDate || activating === selectedPack.id}
              className="w-full rounded-xl py-[14px] text-[17px] font-semibold text-white disabled:opacity-50"
              style={{ background: selectedPack.color }}>
              {activating === selectedPack.id ? 'Création...' : `Créer ${selectedPack.taskCount} tâches`}
            </button>
            <button onClick={() => { setSelectedPack(null); setPackDate(''); }}
              className="w-full mt-2 py-2 text-[15px] text-[#8e8e93]">
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Liste des packs */}
      <div className="mx-4 space-y-4">
        {PACKS.map((pack) => {
          const isActivated = activated.has(pack.id);

          return (
            <div key={pack.id} className="rounded-2xl overflow-hidden" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
              {/* Header gradient */}
              <div className="p-5 text-white" style={{ background: pack.gradient }}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[24px] mb-1">{pack.emoji}</p>
                    <h3 className="text-[20px] font-bold">{pack.name}</h3>
                  </div>
                  <div className="text-right">
                    <p className="text-[28px] font-black">{pack.taskCount}</p>
                    <p className="text-[12px] text-white/70">tâches</p>
                  </div>
                </div>
              </div>

              {/* Description + CTA */}
              <div className="bg-white p-5">
                <p className="text-[14px] text-[#3c3c43] mb-4">{pack.description}</p>

                {isActivated ? (
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-semibold" style={{ color: '#34c759' }}>✓ Activé</span>
                    <button onClick={() => router.push('/tasks')} className="text-[14px] font-medium" style={{ color: '#007aff' }}>
                      Voir les tâches →
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setSelectedPack(pack)}
                    className="w-full rounded-xl py-3 text-[15px] font-bold text-white"
                    style={{ background: pack.color }}>
                    Activer ce pack
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Note */}
      <p className="mx-4 mt-6 text-[12px] text-[#c7c7cc] text-center">
        Les tâches sont positionnées automatiquement dans votre calendrier par rapport à la date choisie.
      </p>
    </div>
  );
}
