'use client';

import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useTaskStore } from '@/stores/taskStore';
import {
  SCORING_CATEGORY_OPTIONS,
  DURATION_OPTIONS,
  PHYSICAL_OPTIONS,
  computeTaskScore,
  type DurationEstimate,
  type PhysicalEffort,
  type TaskCategory as ScoringCategory,
} from '@/utils/taskScoring';
import { createClient } from '@/lib/supabase';
import type { TaskListItem } from '@/types/database';

export default function QuickLogPage() {
  const router = useRouter();
  const { profile } = useAuthStore();
  const { tasks, completeTask, fetchTasks } = useTaskStore();

  const [name, setName] = useState('');
  const [scoringCategory, setScoringCategory] = useState<ScoringCategory>('misc');
  const [duration, setDuration] = useState<DurationEstimate>('short');
  const [physical, setPhysical] = useState<PhysicalEffort>('light');
  const [durationMinutes, setDurationMinutes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tâche existante qui correspond à la saisie
  const [matchedTask, setMatchedTask] = useState<TaskListItem | null>(null);

  // Rechercher une tâche existante quand le nom change
  const suggestions = useMemo(() => {
    if (name.trim().length < 2) return [];
    const q = name.trim().toLowerCase();
    return tasks
      .filter((t) => t.name.toLowerCase().includes(q))
      .slice(0, 5);
  }, [name, tasks]);

  const score = computeTaskScore({ title: name, category: scoringCategory, duration, physical, frequency: 'once' });

  const handleSelectMatch = (task: TaskListItem) => {
    setMatchedTask(task);
    setName(task.name);
  };

  const handleClearMatch = () => {
    setMatchedTask(null);
  };

  const handleSubmit = useCallback(async () => {
    if (!name.trim() || !profile?.household_id || !profile?.id) {
      setError('Remplissez le nom de la tâche.');
      return;
    }
    setSubmitting(true);
    setError(null);

    const durationMin = durationMinutes ? parseInt(durationMinutes, 10) : null;

    if (matchedTask) {
      // Compléter la tâche existante
      await completeTask(matchedTask.id, {
        duration_minutes: durationMin,
        note: null,
      });
    } else {
      // Créer une tâche ponctuelle + complétion
      const supabase = createClient();
      const { data: cats } = await supabase.from('task_categories').select('id').limit(1);
      const categoryId = cats?.[0]?.id ?? '';

      const { data: taskData, error: taskError } = await supabase
        .from('household_tasks')
        .insert({
          household_id: profile.household_id,
          name: name.trim(),
          category_id: categoryId,
          frequency: 'once',
          mental_load_score: Math.round(score.global_score / 7),
          scoring_category: scoringCategory,
          duration_estimate: duration,
          physical_effort: physical,
          global_score: score.global_score,
          score_breakdown: score,
          assigned_to: profile.id,
          next_due_at: null,
          is_active: false,
          created_by: profile.id,
        })
        .select('id')
        .single();

      if (taskError || !taskData) {
        setError(taskError?.message ?? 'Erreur lors de la création.');
        setSubmitting(false);
        return;
      }

      await supabase.from('task_completions').insert({
        task_id: taskData.id,
        household_id: profile.household_id,
        completed_by: profile.id,
        completed_at: new Date().toISOString(),
        mental_load_score: Math.round(score.global_score / 7),
        duration_minutes: durationMin,
      });
    }

    setSubmitting(false);
    setSuccess(true);
    fetchTasks(profile.household_id);
    setTimeout(() => router.push('/dashboard'), 1500);
  }, [name, profile, matchedTask, scoringCategory, duration, physical, score, durationMinutes, completeTask, fetchTasks, router]);

  if (success) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
        <div className="text-[48px] mb-3">✅</div>
        <p className="text-[20px] font-bold text-[#1c1c1e]">Enregistré !</p>
        <p className="text-[15px] text-[#8e8e93] mt-1">{name}</p>
        {matchedTask && (
          <p className="text-[13px] mt-1" style={{ color: '#007aff' }}>Tâche existante complétée</p>
        )}
      </div>
    );
  }

  return (
    <div className="pt-4">
      <div className="flex items-center justify-between px-4 mb-4">
        <button onClick={() => router.back()} className="text-[17px] font-medium" style={{ color: '#007aff' }}>← Retour</button>
        <h2 className="text-[17px] font-semibold text-[#1c1c1e]">J&apos;ai fait une tâche</h2>
        <div className="w-16" />
      </div>

      {error && (
        <div className="mx-4 mb-4 rounded-xl px-4 py-3 text-[14px]" style={{ background: '#fff2f2', color: '#ff3b30' }}>{error}</div>
      )}

      <div className="mx-4 rounded-xl bg-white overflow-hidden" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
        {/* Nom + suggestions */}
        <div className="px-4 py-3" style={{ borderBottom: '0.5px solid var(--ios-separator)' }}>
          <label className="text-[13px] text-[#8e8e93] block mb-1">Qu&apos;avez-vous fait ?</label>

          {matchedTask ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[17px] font-semibold" style={{ color: '#007aff' }}>{matchedTask.name}</p>
                <p className="text-[12px] text-[#8e8e93]">Tâche existante — sera complétée</p>
              </div>
              <button onClick={handleClearMatch} className="text-[13px] text-[#8e8e93]">✕ Changer</button>
            </div>
          ) : (
            <>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} autoFocus
                className="w-full text-[17px] text-[#1c1c1e] bg-transparent outline-none placeholder:text-[#c7c7cc]"
                placeholder="Ex : Préparé le dîner" />

              {/* Suggestions de tâches existantes */}
              {suggestions.length > 0 && !matchedTask && (
                <div className="mt-2 rounded-lg overflow-hidden border" style={{ borderColor: 'var(--ios-separator)' }}>
                  <p className="px-3 py-1.5 text-[11px] font-semibold text-[#8e8e93] uppercase" style={{ background: '#f0f2f8' }}>
                    Tâches existantes
                  </p>
                  {suggestions.map((t, i) => (
                    <button key={t.id} onClick={() => handleSelectMatch(t)}
                      className="w-full px-3 py-2.5 text-left text-[15px] text-[#1c1c1e] flex items-center justify-between"
                      style={i < suggestions.length - 1 ? { borderBottom: '0.5px solid var(--ios-separator)' } : {}}>
                      <span>{t.name}</span>
                      <span className="text-[12px]" style={{ color: '#007aff' }}>Compléter</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Le reste du formulaire seulement si pas de match */}
        {!matchedTask && (
          <>
            <div className="px-4 py-3" style={{ borderBottom: '0.5px solid var(--ios-separator)' }}>
              <label className="text-[13px] text-[#8e8e93] block mb-2">Type</label>
              <div className="flex flex-wrap gap-1.5">
                {SCORING_CATEGORY_OPTIONS.slice(0, 8).map((opt) => (
                  <button key={opt.value} type="button" onClick={() => setScoringCategory(opt.value)}
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

            <div className="px-4 py-3" style={{ borderBottom: '0.5px solid var(--ios-separator)' }}>
              <label className="text-[13px] text-[#8e8e93] block mb-2">Ça a pris combien de temps ?</label>
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
          </>
        )}

        {/* Durée exacte */}
        <div className="px-4 py-3">
          <label className="text-[13px] text-[#8e8e93] block mb-1">Minutes exactes (optionnel)</label>
          <input type="number" min={0} max={999} value={durationMinutes}
            onChange={(e) => setDurationMinutes(e.target.value)}
            className="w-full text-[17px] text-[#1c1c1e] bg-transparent outline-none placeholder:text-[#c7c7cc]"
            placeholder="Ex : 25" />
        </div>
      </div>

      {/* Score (seulement si nouvelle tâche) */}
      {name.trim() && !matchedTask && (
        <div className="mx-4 mt-4 rounded-xl p-3 flex items-center justify-between" style={{ background: '#f0f2f8' }}>
          <span className="text-[14px] text-[#1c1c1e]">Score : <strong>{score.global_label}</strong></span>
          <span className="text-[17px] font-bold" style={{
            color: score.global_score <= 8 ? '#34c759' : score.global_score <= 16 ? '#007aff' : score.global_score <= 24 ? '#ff9500' : '#ff3b30'
          }}>{score.global_score}/36</span>
        </div>
      )}

      <div className="px-4 pt-4 pb-8">
        <button onClick={handleSubmit} disabled={submitting || !name.trim()}
          className="w-full rounded-xl py-[14px] text-[17px] font-semibold text-white disabled:opacity-50"
          style={{ background: matchedTask ? '#007aff' : '#34c759' }}>
          {submitting ? 'Enregistrement...' : matchedTask ? '✓ Compléter cette tâche' : '✓ Enregistrer'}
        </button>
      </div>
    </div>
  );
}
