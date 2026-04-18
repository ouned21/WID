'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useTaskStore } from '@/stores/taskStore';
import { useHouseholdStore } from '@/stores/householdStore';
import { splitTasksIntoSections } from '@/utils/taskSelectors';
import { computeNextDueAt } from '@/utils/taskDueDate';
import { createClient } from '@/lib/supabase';
import type { TaskListItem, TaskTemplate, HouseholdMember } from '@/types/database';

// =============================================================================
// COMPONENTS (dark theme)
// =============================================================================

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
      className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors active:opacity-70"
      style={{ opacity: preChecked ? 0.45 : 1 }}
    >
      {/* Circle checkbox */}
      <span
        className="flex-shrink-0 flex items-center justify-center rounded-full transition-all"
        style={{
          width: 26,
          height: 26,
          background: isActive ? (preChecked ? 'rgba(255,255,255,0.3)' : 'linear-gradient(135deg,#5856d6,#007aff)') : 'transparent',
          border: isActive ? 'none' : '1.5px solid rgba(255,255,255,0.25)',
        }}
      >
        {isActive && (
          <svg width="12" height="12" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" viewBox="0 0 24 24">
            <path d="M5 13l4 4L19 7" />
          </svg>
        )}
      </span>

      <span className={`flex-1 text-[14px] ${preChecked ? 'line-through' : ''}`}
        style={{ color: preChecked ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.88)' }}>
        {label}
      </span>

      {icon && <span className="text-[15px] flex-shrink-0">{icon}</span>}
    </button>
  );
}

// =============================================================================
// PAGE
// =============================================================================

export default function RecapPage() {
  const router = useRouter();
  const { profile, isInitialized } = useAuthStore();
  const { tasks, fetchTasks } = useTaskStore();
  const { allMembers } = useHouseholdStore();

  const [checkedTaskIds, setCheckedTaskIds] = useState<Set<string>>(new Set());
  const [preCheckedIds, setPreCheckedIds] = useState<Set<string>>(new Set());
  const [checkedTemplateIds, setCheckedTemplateIds] = useState<Set<string>>(new Set());
  const [completedByMap, setCompletedByMap] = useState<Record<string, string>>({});
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

  // ── Load data ──
  useEffect(() => {
    // Attendre que l'auth soit initialisée
    if (!isInitialized) return;
    // Auth ok mais pas de foyer → rien à charger
    if (!userId || !householdId) {
      setLoading(false);
      return;
    }

    async function loadData() {
      setLoading(true);
      const supabase = createClient();
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      const [completionsResult, templatesResult] = await Promise.all([
        supabase
          .from('task_completions')
          .select('task_id')
          .eq('completed_by', userId)
          .gte('completed_at', startOfToday.toISOString()),
        supabase
          .from('task_templates')
          .select('*')
          .in('typical_time', ['soir', 'flexible'])
          .order('sort_order', { ascending: true }),
      ]);

      const doneIds = new Set<string>(
        (completionsResult.data ?? []).map((c: { task_id: string }) => c.task_id)
      );
      setPreCheckedIds(doneIds);
      setTemplates((templatesResult.data as TaskTemplate[]) ?? []);

      if (tasks.length === 0 && householdId) {
        await fetchTasks(householdId);
      }

      setLoading(false);
    }

    loadData();
  }, [isInitialized, userId, householdId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sections ──
  const sections = useMemo(() => {
    if (!userId) return { myTasks: [], otherTasks: [], suggestions: [] };

    const allSections = splitTasksIntoSections(tasks);
    const todayAndOverdue = [...allSections.overdue, ...allSections.today];

    const myTasks = todayAndOverdue.filter((t) => t.assigned_to === userId);
    const otherTasks = allSections.today.filter((t) => t.assigned_to !== userId);
    const existingNames = new Set(tasks.map((t) => t.name.toLowerCase()));
    const suggestions = templates
      .filter((t) => !existingNames.has(t.name.toLowerCase()))
      .slice(0, 8);

    return { myTasks, otherTasks, suggestions };
  }, [tasks, templates, userId]);

  const toggleTask = useCallback((taskId: string, defaultCompletedBy?: string) => {
    setCheckedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
        if (defaultCompletedBy) {
          setCompletedByMap((m) => ({ ...m, [taskId]: defaultCompletedBy }));
        }
      }
      return next;
    });
  }, []);

  const toggleTemplate = useCallback((templateId: string) => {
    setCheckedTemplateIds((prev) => {
      const next = new Set(prev);
      if (next.has(templateId)) next.delete(templateId); else next.add(templateId);
      return next;
    });
  }, []);

  const newCheckedCount = useMemo(() => {
    let count = 0;
    for (const id of checkedTaskIds) {
      if (!preCheckedIds.has(id)) count++;
    }
    count += checkedTemplateIds.size;
    if (freeTextChecked && freeText.trim()) count++;
    return count;
  }, [checkedTaskIds, preCheckedIds, checkedTemplateIds, freeTextChecked, freeText]);

  const handleSubmit = useCallback(async () => {
    if (!userId || !householdId || newCheckedCount === 0) return;
    setSubmitting(true);
    setError(null);

    try {
      const supabase = createClient();
      const now = new Date();
      const nowISO = now.toISOString();

      const newTaskIds = [...checkedTaskIds].filter((id) => !preCheckedIds.has(id));

      for (const taskId of newTaskIds) {
        const task = tasks.find((t) => t.id === taskId);
        if (!task) continue;

        const chosenMemberId = completedByMap[taskId];
        const chosenMember = chosenMemberId ? allMembers.find((m) => m.id === chosenMemberId) : null;
        const isChosenPhantom = chosenMember?.isPhantom ?? false;
        const completedByReal = isChosenPhantom ? userId : (chosenMemberId ?? userId);
        const completedByPhantom = isChosenPhantom ? chosenMemberId : (task.assigned_to_phantom_id ?? null);

        await supabase.from('task_completions').insert({
          task_id: taskId,
          household_id: householdId,
          completed_by: completedByReal,
          completed_by_phantom_id: completedByPhantom,
          completed_at: nowISO,
          mental_load_score: task.mental_load_score,
        });

        const nextDueAt = computeNextDueAt(task.frequency, now);
        await supabase.from('household_tasks')
          .update({ next_due_at: nextDueAt?.toISOString() ?? null })
          .eq('id', taskId);
      }

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

      await fetchTasks(householdId);
      setCompletedCount(newCheckedCount);
      setShowSuccess(true);
      setTimeout(() => router.push('/dashboard'), 2500);
    } catch (err) {
      console.error('[recap] Erreur:', err);
      setError('Une erreur est survenue. Réessaie.');
      setSubmitting(false);
    }
  }, [userId, householdId, checkedTaskIds, preCheckedIds, checkedTemplateIds, completedByMap, allMembers, freeTextChecked, freeText, tasks, templates, newCheckedCount, fetchTasks, router]);

  // ── Succès ──
  if (showSuccess) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center px-4"
        style={{ background: '#15152a' }}>
        <div className="text-[72px] font-black mb-2" style={{ color: '#34c759' }}>
          {completedCount}
        </div>
        <p className="text-[22px] font-bold text-white">
          {completedCount === 1 ? 'tâche enregistrée' : 'tâches enregistrées'}
        </p>
        <p className="text-[17px] mt-2" style={{ color: 'rgba(255,255,255,0.5)' }}>
          Bravo, bonne soirée 💪
        </p>
      </div>
    );
  }

  const dateStr = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  const hasContent =
    sections.myTasks.length > 0 ||
    sections.otherTasks.length > 0 ||
    sections.suggestions.length > 0;

  // =============================================================================
  // RENDER — dark theme (mockup Screen 3)
  // =============================================================================
  return (
    <div className="min-h-screen pb-40"
      style={{
        background: '#15152a',
        // Compensate for the app layout padding
        marginLeft: '-16px',
        marginRight: '-16px',
        marginTop: '-24px',
        paddingLeft: '16px',
        paddingRight: '16px',
        paddingTop: '16px',
      }}>

      {/* ── Header ── */}
      <div className="mb-5">
        <h2 className="text-[22px] font-black text-white leading-tight">
          Comment se passe ta journée ?
        </h2>
        <p className="text-[13px] mt-1 capitalize" style={{ color: 'rgba(255,255,255,0.4)' }}>
          {dateStr}
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-xl px-4 py-3 text-[13px]"
          style={{ background: 'rgba(255,59,48,0.18)', border: '1px solid rgba(255,59,48,0.28)', color: '#ff8c8c' }}>
          {error}
        </div>
      )}

      {/* ── Contenu ── */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: 'rgba(255,255,255,0.15)', borderTopColor: '#5856d6' }} />
        </div>
      ) : !hasContent ? (
        <div className="rounded-2xl px-5 py-8 text-center mb-4"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <p className="text-[32px] mb-2">🌙</p>
          <p className="text-[16px] font-bold text-white">Rien de prévu ce soir</p>
          <p className="text-[13px] mt-1" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Tu peux quand même noter ce que tu as fait
          </p>
        </div>
      ) : (
        <div className="space-y-5">

          {/* Section : Tes tâches */}
          {sections.myTasks.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[1.5px] mb-2 px-1"
                style={{ color: 'rgba(255,255,255,0.35)' }}>
                Tes tâches
              </p>
              <div className="rounded-2xl overflow-hidden"
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.08)' }}>
                {sections.myTasks.map((task, i) => (
                  <div key={task.id}
                    style={i < sections.myTasks.length - 1 ? { borderBottom: '0.5px solid rgba(255,255,255,0.07)' } : {}}>
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

          {/* Section : Aussi fait aujourd'hui ? */}
          {sections.otherTasks.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[1.5px] mb-2 px-1"
                style={{ color: 'rgba(255,255,255,0.35)' }}>
                Aussi fait aujourd&apos;hui ?
              </p>
              <div className="rounded-2xl overflow-hidden"
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.08)' }}>
                {sections.otherTasks.map((task: TaskListItem, i) => {
                  const defaultMemberId =
                    task.assigned_to_phantom_id ?? task.assigned_to ?? userId ?? '';
                  const isChecked = checkedTaskIds.has(task.id);
                  return (
                    <div key={task.id}
                      style={i < sections.otherTasks.length - 1 ? { borderBottom: '0.5px solid rgba(255,255,255,0.07)' } : {}}>
                      <CheckRow
                        label={task.name}
                        icon={task.category?.icon}
                        checked={isChecked}
                        onToggle={() => toggleTask(task.id, defaultMemberId)}
                      />
                      {isChecked && allMembers.length > 1 && (
                        <div className="flex items-center gap-2 px-4 pb-3 flex-wrap"
                          style={{ borderTop: '0.5px solid rgba(255,255,255,0.07)' }}>
                          <span className="text-[11px] flex-shrink-0"
                            style={{ color: 'rgba(255,255,255,0.4)' }}>
                            Fait par :
                          </span>
                          {allMembers.map((member: HouseholdMember) => {
                            const selected = (completedByMap[task.id] ?? defaultMemberId) === member.id;
                            return (
                              <button key={member.id} type="button"
                                onClick={() => setCompletedByMap((m) => ({ ...m, [task.id]: member.id }))}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[12px] font-semibold transition-all"
                                style={{
                                  background: selected
                                    ? 'linear-gradient(135deg,#5856d6,#007aff)'
                                    : 'rgba(255,255,255,0.1)',
                                  color: selected ? 'white' : 'rgba(255,255,255,0.7)',
                                }}>
                                {member.display_name}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section : Suggestions */}
          {sections.suggestions.length > 0 && (
            <div>
              {/* Bulle Yova — comme le mockup */}
              <div className="flex gap-2 mb-3 px-1">
                <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white"
                  style={{ background: 'linear-gradient(135deg,#5856d6,#007aff)' }}>
                  Y
                </div>
                <div className="rounded-2xl rounded-tl-sm px-3 py-2 max-w-[84%]"
                  style={{ background: 'rgba(255,255,255,0.09)' }}>
                  <p className="text-[10px] font-bold uppercase tracking-[1.5px] mb-1"
                    style={{ color: 'rgba(255,255,255,0.35)' }}>
                    Yova
                  </p>
                  <p className="text-[12px]" style={{ color: 'rgba(255,255,255,0.8)' }}>
                    Tu as peut-être aussi fait…
                  </p>
                </div>
              </div>

              <div className="rounded-2xl overflow-hidden"
                style={{ background: 'rgba(88,86,214,0.1)', border: '1px solid rgba(88,86,214,0.22)' }}>
                {sections.suggestions.map((tpl, i) => (
                  <div key={tpl.id}
                    style={i < sections.suggestions.length - 1 ? { borderBottom: '0.5px solid rgba(88,86,214,0.15)' } : {}}>
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

      {/* ── Barre saisie libre (style chat-bar du mockup) ── */}
      <div className="mt-6">
        <p className="text-[10px] font-bold uppercase tracking-[1.5px] mb-2 px-1"
          style={{ color: 'rgba(255,255,255,0.35)' }}>
          Autre chose…
        </p>
        <div className="flex items-center gap-2 rounded-[22px] px-4 py-2"
          style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}>
          {freeText.trim() && (
            <button type="button" onClick={() => setFreeTextChecked(!freeTextChecked)} className="flex-shrink-0">
              <span className="flex items-center justify-center rounded-full transition-all"
                style={{
                  width: 24, height: 24,
                  background: freeTextChecked ? 'linear-gradient(135deg,#5856d6,#007aff)' : 'transparent',
                  border: freeTextChecked ? 'none' : '1.5px solid rgba(255,255,255,0.25)',
                }}>
                {freeTextChecked && (
                  <svg width="11" height="11" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" viewBox="0 0 24 24">
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
            className="flex-1 py-2 text-[13px] bg-transparent outline-none"
            style={{ color: 'rgba(255,255,255,0.85)' }}
            placeholder="Autre chose fait aujourd'hui ?"
          />
          {/* Placeholder style override */}
          <style>{`input::placeholder { color: rgba(255,255,255,0.28); }`}</style>
          {freeText.trim() && !freeTextChecked && (
            <button
              type="button"
              onClick={() => setFreeTextChecked(true)}
              className="flex-shrink-0 flex items-center justify-center rounded-full w-7 h-7"
              style={{ background: 'linear-gradient(135deg,#5856d6,#1a7fe8)' }}>
              <svg width="10" height="10" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" viewBox="0 0 24 24">
                <path d="M5 13l4 4L19 7" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* ── Boutons fixés en bas — au-dessus de la nav bar ── */}
      <div className="fixed left-0 right-0 px-4 pb-4 pt-3"
        style={{ bottom: 76, background: 'linear-gradient(transparent, #15152a 35%)' }}>

        {/* Premium teaser — style mockup */}
        <button
          onClick={() => router.push('/upgrade?feature=journal')}
          className="w-full mb-3 rounded-2xl overflow-hidden text-left active:opacity-90 transition-opacity"
          style={{ background: 'linear-gradient(135deg,#5856d6,#764ba2)', boxShadow: '0 4px 16px rgba(88,86,214,0.3)' }}>
          <div className="px-4 py-3 flex items-center gap-3">
            <span className="text-[28px]">🤖</span>
            <div className="flex-1">
              <p className="text-[14px] font-bold text-white">Laisse Yova analyser ta journée</p>
              <p className="text-[12px] text-white/70">Dicte, elle s&apos;occupe du reste</p>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
              style={{ background: 'rgba(255,255,255,0.18)', color: 'white' }}>
              Premium
            </span>
          </div>
        </button>

        <button
          onClick={handleSubmit}
          disabled={submitting || newCheckedCount === 0}
          className="w-full rounded-2xl py-[15px] text-[17px] font-bold text-white disabled:opacity-35 transition-all"
          style={{
            background: newCheckedCount > 0
              ? 'linear-gradient(135deg,#34c759,#30d158)'
              : 'rgba(255,255,255,0.12)',
          }}>
          {submitting
            ? 'Enregistrement…'
            : newCheckedCount > 0
              ? `Terminé · ${newCheckedCount} tâche${newCheckedCount > 1 ? 's' : ''} ✓`
              : 'Coche ce que tu as fait'}
        </button>
      </div>
    </div>
  );
}
