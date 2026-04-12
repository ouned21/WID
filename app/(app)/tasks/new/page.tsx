'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useTaskStore } from '@/stores/taskStore';
import { useHouseholdStore } from '@/stores/householdStore';
import { FREQUENCY_OPTIONS } from '@/utils/frequency';
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
import { createClient } from '@/lib/supabase';

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
  const { profile } = useAuthStore();
  const { createTask, creating } = useTaskStore();
  const { members } = useHouseholdStore();

  // Catégories DB (pour l'assignation en base)
  const [dbCategories, setDbCategories] = useState<TaskCategory[]>([]);
  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase.from('task_categories').select('*').order('sort_order');
      if (data) setDbCategories(data as TaskCategory[]);
    }
    load();
  }, []);

  // Inputs
  const [name, setName] = useState('');
  const [scoringCategory, setScoringCategory] = useState<ScoringCategory>('misc');
  const [autoDetected, setAutoDetected] = useState(false);
  const [duration, setDuration] = useState<DurationEstimate>('medium');
  const [physical, setPhysical] = useState<PhysicalEffort>('light');
  const [frequency, setFrequency] = useState<Frequency>('weekly');
  const [assignedTo, setAssignedTo] = useState('');
  const [customIntervalDays, setCustomIntervalDays] = useState('');

  // Date pré-remplie à demain
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const [dueDate, setDueDate] = useState(tomorrow.toISOString().split('T')[0]);
  const [dueTime, setDueTime] = useState('09:00');

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [startsAt, setStartsAt] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Score utilisateur : pré-rempli par l'algo, ajustable via slider
  const [userScore, setUserScore] = useState<number | null>(null);
  const [userHasAdjusted, setUserHasAdjusted] = useState(false);

  // Auto-détection de catégorie quand le nom change
  useEffect(() => {
    if (name.trim().length >= 3) {
      const detected = detectCategory(name);
      if (detected) {
        setScoringCategory(detected);
        setAutoDetected(true);
      } else if (autoDetected) {
        setAutoDetected(false);
      }
    }
  }, [name]);

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
      custom_interval_days: frequency === 'custom' && customIntervalDays ? parseInt(customIntervalDays, 10) : null,
      starts_at: startsAt ? new Date(`${startsAt}T00:00:00`).toISOString() : null,
      // Scoring V2 — dual score
      user_score: userScore, // ce que l'utilisateur a choisi (0-10)
      global_score: score.global_score, // ce que l'algo a calculé (2-36)
      score_breakdown: score as unknown as Record<string, unknown>,
      duration_estimate: duration,
      physical_effort: physical,
      scoring_category: scoringCategory,
    });
    if (result.ok) router.push('/tasks');
    else setError(result.error ?? 'Erreur inconnue.');
  };

  const globalColor =
    score.global_score <= 8 ? '#34c759' :
    score.global_score <= 16 ? '#007aff' :
    score.global_score <= 24 ? '#ff9500' :
    '#ff3b30';

  return (
    <div className="pt-4">
      <div className="flex items-center justify-between px-4 mb-4">
        <button onClick={() => router.back()} className="text-[17px] font-medium" style={{ color: '#007aff' }}>← Retour</button>
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
            <input type="text" required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} autoFocus
              className="w-full text-[20px] font-semibold text-[#1c1c1e] bg-transparent outline-none placeholder:text-[#c7c7cc]"
              placeholder="Ex : Préparer le dîner" />
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
              {members.map((m) => (<option key={m.id} value={m.id}>{m.display_name}</option>))}
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

        {/* Charge mentale — slider utilisateur */}
        {name.trim() && (
          <div className="mx-4 rounded-2xl overflow-hidden" style={{ background: 'white', boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
            {/* Slider principal */}
            <div className="p-4 pb-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[13px] font-semibold text-[#8e8e93] uppercase tracking-wide">Charge mentale</p>
                <span className="text-[28px] font-bold" style={{ color: scoreColor10(userScore ?? algoScore10) }}>
                  {userScore ?? algoScore10}<span className="text-[14px] text-[#8e8e93] font-normal">/10</span>
                </span>
              </div>
              <p className="text-[12px] text-[#8e8e93] mb-3">
                Pré-rempli par notre algo. Ajustez si vous ressentez différemment.
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
