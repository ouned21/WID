'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useTaskStore } from '@/stores/taskStore';
import { splitTasksIntoSections } from '@/utils/taskSelectors';
import { computeNextDueAt } from '@/utils/taskDueDate';
import { createClient } from '@/lib/supabase';
import type { TaskListItem, TaskTemplate } from '@/types/database';

// -- Checkbox -----------------------------------------------------------------

function CheckRow({
  label,
  icon,
  checked,
  preChecked,
  onToggle,
}: {
  label: string;
  icon?: string;
  checked: boolean;
  preChecked?: boolean;
  onToggle?: () => void;
}) {
  const isActive = checked || preChecked;
  return (
    <button
      type="button"
      onClick={preChecked ? undefined : onToggle}
      disabled={preChecked}
      className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
      style={preChecked ? { opacity: 0.5 } : {}}
    >
      {/* Checkbox cercle 28px (touch target 44px via padding) */}
      <span
        className="flex-shrink-0 flex items-center justify-center rounded-full transition-all"
        style={{
          width: 28,
          height: 28,
          background: isActive ? (preChecked ? '#8e8e93' : '#007aff') : 'transparent',
          border: isActive ? 'none' : '2px solid #c7c7cc',
        }}
      >
        {isActive && (
          <svg width="14" height="14" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" viewBox="0 0 24 24">
            <path d="M5 13l4 4L19 7" />
          </svg>
        )}
      </span>

      {/* Nom */}
      <span
        className={`flex-1 text-[15px] ${preChecked ? 'line-through text-[#8e8e93]' : 'text-[#1c1c1e]'}`}
      >
        {label}
      </span>

      {/* Icône catégorie */}
      {icon && <span className="text-[16px] flex-shrink-0">{icon}</span>}
    </button>
  );
}

// -- Section label ------------------------------------------------------------

function SectionLabel({ title }: { title: string }) {
  return (
    <p className="text-[11px] font-bold text-[#8e8e93] uppercase tracking-[0.15em] mb-2 px-1">
      {title}
    </p>
  );
}

// -- Page principale ----------------------------------------------------------

export default function RecapPage() {
  const router = useRouter();
  const { profile } = useAuthStore();
  const { tasks, fetchTasks } = useTaskStore();

  // État local
  const [checkedTaskIds, setCheckedTaskIds] = useState<Set<string>>(new Set());
  const [preCheckedIds, setPreCheckedIds] = useState<Set<string>>(new Set());
  const [checkedTemplateIds, setCheckedTemplateIds] = useState<Set<string>>(new Set());
  const [freeText, setFreeText] = useState('');
  const [freeTextChecked, setFreeTextChecked] = useState(false);
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const userId = profile?.id;
  const householdId = profile?.household_id;

  // Charger les données au montage
  useEffect(() => {
    if (!userId || !householdId) return;

    async function loadData() {
      setLoading(true);
      const supabase = createClient();

      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      // Charger en parallèle
      const [completionsResult, templatesResult] = await Promise.all([
        // 1. Complétions d'aujourd'hui par cet utilisateur
        supabase
          .from('task_completions')
          .select('task_id')
          .eq('completed_by', userId)
          .gte('completed_at', startOfToday.toISOString()),

        // 2. Templates du soir / flexibles
        supabase
          .from('task_templates')
          .select('*')
          .in('typical_time', ['soir', 'flexible'])
          .order('sort_order', { ascending: true }),
      ]);

      // Pré-cocher les tâches déjà faites
      const doneIds = new Set<string>(
        (completionsResult.data ?? []).map((c: { task_id: string }) => c.task_id)
      );
      setPreCheckedIds(doneIds);

      // Templates
      setTemplates((templatesResult.data as TaskTemplate[]) ?? []);

      // S'assurer que les tâches sont chargées
      if (tasks.length === 0) {
        await fetchTasks(householdId!);
      }

      setLoading(false);
    }

    loadData();
  }, [userId, householdId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sections dérivées
  const sections = useMemo(() => {
    if (!userId) return { myTasks: [], otherTasks: [], suggestions: [] };

    const allSections = splitTasksIntoSections(tasks);
    const todayAndOverdue = [...allSections.overdue, ...allSections.today];

    // Section 1 : mes tâches (assignées à moi, dues aujourd'hui ou en retard)
    const myTasks = todayAndOverdue.filter((t) => t.assigned_to === userId);

    // Section 2 : tâches des autres (non assignées ou assignées à d'autres)
    const otherTasks = allSections.today.filter(
      (t) => t.assigned_to !== userId
    );

    // Section 3 : suggestions (templates pas encore dans le foyer)
    const existingNames = new Set(tasks.map((t) => t.name.toLowerCase()));
    const suggestions = templates
      .filter((t) => !existingNames.has(t.name.toLowerCase()))
      .slice(0, 8);

    return { myTasks, otherTasks, suggestions };
  }, [tasks, templates, userId]);

  // Toggle checkbox tâche
  const toggleTask = useCallback((taskId: string) => {
    setCheckedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }, []);

  // Toggle checkbox template
  const toggleTemplate = useCallback((templateId: string) => {
    setCheckedTemplateIds((prev) => {
      const next = new Set(prev);
      if (next.has(templateId)) next.delete(templateId);
      else next.add(templateId);
      return next;
    });
  }, []);

  // Nombre de nouvelles sélections
  const newCheckedCount = useMemo(() => {
    let count = 0;
    for (const id of checkedTaskIds) {
      if (!preCheckedIds.has(id)) count++;
    }
    count += checkedTemplateIds.size;
    if (freeTextChecked && freeText.trim()) count++;
    return count;
  }, [checkedTaskIds, preCheckedIds, checkedTemplateIds, freeTextChecked, freeText]);

  // Soumission
  const handleSubmit = useCallback(async () => {
    if (!userId || !householdId || newCheckedCount === 0) return;

    setSubmitting(true);
    setError(null);

    try {
      const supabase = createClient();
      const now = new Date();
      const nowISO = now.toISOString();

      // 1. Compléter les tâches existantes nouvellement cochées
      const newTaskIds = [...checkedTaskIds].filter((id) => !preCheckedIds.has(id));

      for (const taskId of newTaskIds) {
        const task = tasks.find((t) => t.id === taskId);
        if (!task) continue;

        // Insérer la complétion
        await supabase.from('task_completions').insert({
          task_id: taskId,
          household_id: householdId,
          completed_by: userId,
          completed_at: nowISO,
          mental_load_score: task.mental_load_score,
        });

        // Mettre à jour next_due_at
        const nextDueAt = computeNextDueAt(task.frequency, now, task.custom_interval_days);
        await supabase
          .from('household_tasks')
          .update({ next_due_at: nextDueAt?.toISOString() ?? null })
          .eq('id', taskId);
      }

      // 2. Quick log pour les templates cochés
      for (const templateId of checkedTemplateIds) {
        const template = templates.find((t) => t.id === templateId);
        if (!template) continue;

        const { data: taskData } = await supabase
          .from('household_tasks')
          .insert({
            household_id: householdId,
            name: template.name,
            category_id: template.category_id,
            frequency: 'once',
            mental_load_score: template.default_mental_load_score,
            scoring_category: template.scoring_category,
            duration_estimate: template.default_duration,
            physical_effort: template.default_physical,
            assigned_to: userId,
            is_active: false,
            created_by: userId,
          })
          .select('id')
          .single();

        if (taskData) {
          await supabase.from('task_completions').insert({
            task_id: taskData.id,
            household_id: householdId,
            completed_by: userId,
            completed_at: nowISO,
            mental_load_score: template.default_mental_load_score,
          });
        }
      }

      // 3. Quick log pour le texte libre
      if (freeTextChecked && freeText.trim()) {
        const { data: cats } = await supabase.from('task_categories').select('id').limit(1);
        const categoryId = cats?.[0]?.id ?? '';

        const { data: taskData } = await supabase
          .from('household_tasks')
          .insert({
            household_id: householdId,
            name: freeText.trim(),
            category_id: categoryId,
            frequency: 'once',
            mental_load_score: 3,
            scoring_category: 'misc',
            duration_estimate: 'short',
            physical_effort: 'light',
            assigned_to: userId,
            is_active: false,
            created_by: userId,
          })
          .select('id')
          .single();

        if (taskData) {
          await supabase.from('task_completions').insert({
            task_id: taskData.id,
            household_id: householdId,
            completed_by: userId,
            completed_at: nowISO,
            mental_load_score: 3,
          });
        }
      }

      // 4. Rafraîchir le store une seule fois
      await fetchTasks(householdId);

      // Succès
      setCompletedCount(newCheckedCount);
      setShowSuccess(true);
      setTimeout(() => router.push('/dashboard'), 2500);
    } catch (err) {
      console.error('[recap] Erreur:', err);
      setError('Une erreur est survenue. Réessaie.');
      setSubmitting(false);
    }
  }, [userId, householdId, checkedTaskIds, preCheckedIds, checkedTemplateIds, freeTextChecked, freeText, tasks, templates, newCheckedCount, fetchTasks, router]);

  // Écran de succès
  if (showSuccess) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center px-4">
        <div
          className="text-[72px] font-black mb-2"
          style={{
            color: '#34c759',
            animation: 'scaleIn 0.4s ease-out',
          }}
        >
          {completedCount}
        </div>
        <p className="text-[22px] font-bold text-[#1c1c1e]">
          {completedCount === 1 ? 'tâche enregistrée' : 'tâches enregistrées'}
        </p>
        <p className="text-[17px] text-[#8e8e93] mt-2">Bravo, bonne soirée 💪</p>
      </div>
    );
  }

  // Date formatée
  const dateStr = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const hasContent = sections.myTasks.length > 0 || sections.otherTasks.length > 0 || sections.suggestions.length > 0;

  return (
    <div className="pt-4 pb-28">
      {/* Header */}
      <div className="flex items-center justify-between px-4 mb-2">
        <button onClick={() => router.back()} className="text-[17px] font-medium" style={{ color: '#007aff' }}>
          ← Retour
        </button>
        <h2 className="text-[17px] font-semibold text-[#1c1c1e]">Ma journée</h2>
        <div className="w-16" />
      </div>

      {/* Date */}
      <p className="px-4 text-[13px] text-[#8e8e93] mb-4 capitalize">{dateStr}</p>

      {error && (
        <div className="mx-4 mb-4 rounded-xl px-4 py-3 text-[14px]" style={{ background: '#fff2f2', color: '#ff3b30' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 rounded-full border-2 border-[#007aff] border-t-transparent animate-spin" />
        </div>
      ) : !hasContent ? (
        /* État vide — seulement le champ libre */
        <div className="mx-4 space-y-4">
          <div className="rounded-2xl bg-white p-6 text-center" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
            <p className="text-[32px] mb-2">🌙</p>
            <p className="text-[17px] font-semibold text-[#1c1c1e]">Rien de prévu ce soir</p>
            <p className="text-[14px] text-[#8e8e93] mt-1">Tu peux quand même noter ce que tu as fait</p>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Section 1 : Tes tâches */}
          {sections.myTasks.length > 0 && (
            <div className="mx-4">
              <SectionLabel title="Tes tâches" />
              <div className="rounded-2xl bg-white overflow-hidden" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
                {sections.myTasks.map((task, i) => (
                  <div key={task.id} style={i < sections.myTasks.length - 1 ? { borderBottom: '0.5px solid var(--ios-separator)' } : {}}>
                    <CheckRow
                      label={task.name}
                      icon={task.category?.icon}
                      checked={checkedTaskIds.has(task.id)}
                      preChecked={preCheckedIds.has(task.id)}
                      onToggle={() => toggleTask(task.id)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 2 : Aussi fait aujourd'hui ? */}
          {sections.otherTasks.length > 0 && (
            <div className="mx-4">
              <SectionLabel title="Aussi fait aujourd'hui ?" />
              <div className="rounded-2xl bg-white overflow-hidden" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
                {sections.otherTasks.map((task, i) => (
                  <div key={task.id} style={i < sections.otherTasks.length - 1 ? { borderBottom: '0.5px solid var(--ios-separator)' } : {}}>
                    <CheckRow
                      label={task.name}
                      icon={task.category?.icon}
                      checked={checkedTaskIds.has(task.id)}
                      onToggle={() => toggleTask(task.id)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 3 : Suggestions */}
          {sections.suggestions.length > 0 && (
            <div className="mx-4">
              <SectionLabel title="Suggestions" />
              <div className="rounded-2xl bg-white overflow-hidden" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
                {sections.suggestions.map((tpl, i) => (
                  <div key={tpl.id} style={i < sections.suggestions.length - 1 ? { borderBottom: '0.5px solid var(--ios-separator)' } : {}}>
                    <CheckRow
                      label={tpl.name}
                      checked={checkedTemplateIds.has(tpl.id)}
                      onToggle={() => toggleTemplate(tpl.id)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Section 4 : Texte libre */}
      <div className="mx-4 mt-5">
        <SectionLabel title="Autre chose..." />
        <div className="rounded-2xl bg-white overflow-hidden flex items-center" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
          {/* Checkbox pour le texte libre */}
          {freeText.trim() && (
            <button
              type="button"
              onClick={() => setFreeTextChecked(!freeTextChecked)}
              className="pl-4 flex-shrink-0"
            >
              <span
                className="flex items-center justify-center rounded-full transition-all"
                style={{
                  width: 28,
                  height: 28,
                  background: freeTextChecked ? '#007aff' : 'transparent',
                  border: freeTextChecked ? 'none' : '2px solid #c7c7cc',
                }}
              >
                {freeTextChecked && (
                  <svg width="14" height="14" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" viewBox="0 0 24 24">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </span>
            </button>
          )}
          <input
            type="text"
            value={freeText}
            onChange={(e) => {
              setFreeText(e.target.value);
              if (!e.target.value.trim()) setFreeTextChecked(false);
            }}
            className="flex-1 px-4 py-3 text-[15px] text-[#1c1c1e] bg-transparent outline-none placeholder:text-[#c7c7cc]"
            placeholder="Autre chose fait aujourd'hui ?"
          />
        </div>
      </div>

      {/* Bouton Terminé — sticky en bas */}
      <div className="fixed bottom-0 left-0 right-0 px-4 pb-6 pt-3" style={{ background: 'linear-gradient(transparent, #f6f8ff 30%)' }}>
        <button
          onClick={handleSubmit}
          disabled={submitting || newCheckedCount === 0}
          className="w-full rounded-xl py-[14px] text-[17px] font-semibold text-white disabled:opacity-40 transition-all"
          style={{ background: newCheckedCount > 0 ? '#34c759' : '#8e8e93' }}
        >
          {submitting
            ? 'Enregistrement...'
            : newCheckedCount > 0
              ? `Terminé (${newCheckedCount})`
              : 'Coche ce que tu as fait'
          }
        </button>
      </div>
    </div>
  );
}
