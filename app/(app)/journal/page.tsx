'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import BackButton from '@/components/BackButton';
import { useAuthStore } from '@/stores/authStore';
import { useTaskStore } from '@/stores/taskStore';
import { useHouseholdStore } from '@/stores/householdStore';
import { useMemoryStore, FACT_TYPE_EMOJI, FACT_TYPE_LABEL } from '@/stores/memoryStore';
import { createClient } from '@/lib/supabase';
import { detectProjectIntent } from '@/utils/projectDecomposition';
import { TaskActionsSheet } from '@/components/TaskActionsSheet';
import type { TaskListItem, HouseholdMember } from '@/types/database';

// ── Types ──────────────────────────────────────────────────────────────────────

type ParsedCompletion = {
  task_id: string;
  task_name: string;
  completed_by: string | null;
  completed_by_name?: string | null;
  duration_minutes: number | null;
  note: string | null;
  confidence: number;
};

type AutoCreatedTask = { name: string; task_id: string };

type ProjectDecomposed = {
  parent_task_id: string;
  title: string;
  description: string | null;
  target_date: string | null;
  subtask_count: number;
  subtasks: Array<{
    name: string;
    duration_minutes: number;
    next_due_at: string;
    assigned_to: string | null;
    assigned_phantom_id: string | null;
    notes: string | null;
  }>;
};

type ParseResponse = {
  journalId?: string;
  needs_clarification?: boolean;
  clarification_question?: string;
  completions: ParsedCompletion[];
  auto_created?: AutoCreatedTask[];
  project_created?: { type: string; name: string; reference_date: string; taskCount: number } | null;
  project_decomposed?: ProjectDecomposed | null;
  unmatched: string[];
  ai_response: string;
  mood_tone: string | null;
  error?: string;
  code?: string;
  refused_scope?: boolean;
  structured_updates?: StructuredUpdate[];
};

type HistoryMessage = { role: 'user' | 'assistant'; content: string };

type StructuredUpdate = {
  phantom_id: string;
  member_name: string;
  field: 'birth_date' | 'school_class' | 'allergies';
  value: string | string[];
};

type ChatMessage =
  | { id: string; type: 'user'; content: string }
  | { id: string; type: 'yova'; content: string; moodTone?: string | null; isQuestion?: boolean }
  | { id: string; type: 'result'; data: ParseResponse }
  | { id: string; type: 'memory_note'; updates: StructuredUpdate[] }
  | { id: string; type: 'typing' };

type PastJournal = {
  id: string;
  raw_text: string;
  ai_response: string | null;
  parsed_completions: ParsedCompletion[];
  mood_tone: string | null;
  created_at: string;
};

// ── Constantes ─────────────────────────────────────────────────────────────────

const MOOD_EMOJI: Record<string, string> = {
  happy: '😊', tired: '😴', overwhelmed: '😰',
  satisfied: '😌', frustrated: '😤', neutral: '😐',
};

let _msgCounter = 0;
function uid() { return `msg-${++_msgCounter}`; }

// ── Composants chat ────────────────────────────────────────────────────────────

function UserBubble({ content }: { content: string }) {
  return (
    <div className="flex justify-end mb-3">
      <div
        className="max-w-[78%] rounded-[20px] rounded-tr-[6px] px-4 py-3 text-[15px] text-white leading-relaxed"
        style={{ background: 'linear-gradient(135deg, #007aff, #5856d6)', boxShadow: '0 2px 8px rgba(0,122,255,0.2)' }}
      >
        {content}
      </div>
    </div>
  );
}

function YovaBubble({ content, moodTone, isQuestion }: { content: string; moodTone?: string | null; isQuestion?: boolean }) {
  const emoji = moodTone ? (MOOD_EMOJI[moodTone] ?? '🤖') : '🤖';
  return (
    <div className="flex items-end gap-2 mb-3">
      <div
        className="flex h-8 w-8 items-center justify-center rounded-full text-[16px] flex-shrink-0 mb-0.5"
        style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)' }}
      >
        {emoji}
      </div>
      <div
        className="max-w-[78%] rounded-[20px] rounded-tl-[6px] px-4 py-3 text-[15px] text-white leading-relaxed"
        style={{
          background: isQuestion
            ? 'linear-gradient(135deg, #5856d6, #764ba2)'
            : 'linear-gradient(135deg, #667eea, #764ba2)',
          boxShadow: '0 2px 8px rgba(118,75,162,0.2)',
        }}
      >
        {content}
        {isQuestion && (
          <span className="block mt-1 text-[12px] text-white/60">↩ Réponds ci-dessous</span>
        )}
      </div>
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="flex items-end gap-2 mb-3">
      <div
        className="flex h-8 w-8 items-center justify-center rounded-full text-[16px] flex-shrink-0"
        style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)' }}
      >
        🤖
      </div>
      <div
        className="rounded-[20px] rounded-tl-[6px] px-4 py-3"
        style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)' }}
      >
        <div className="flex gap-1 items-center h-5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-white/70 animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Sprint 14 — Note discrète quand Yova met à jour la fiche d'un membre */
function MemoryNote({ updates }: { updates: StructuredUpdate[] }) {
  const FIELD_LABEL: Record<string, string> = {
    birth_date: 'anniversaire',
    school_class: 'classe',
    allergies: 'allergies',
  };
  function formatValue(u: StructuredUpdate): string {
    if (u.field === 'birth_date' && typeof u.value === 'string') {
      const d = new Date(u.value);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
      }
    }
    if (Array.isArray(u.value)) return u.value.join(', ');
    return String(u.value);
  }
  return (
    <div className="mb-3 flex justify-center">
      <div
        className="inline-flex items-start gap-2 rounded-2xl px-3 py-2 text-[12px] text-[#3c3c43]"
        style={{ background: '#f5f3ff', maxWidth: '90%' }}
      >
        <span>📌</span>
        <div className="flex flex-col gap-0.5">
          {updates.map((u) => (
            <span key={`${u.phantom_id}-${u.field}`}>
              <span className="font-semibold">{u.member_name}</span>
              {' · '}
              <span className="text-[#6e6e73]">{FIELD_LABEL[u.field] ?? u.field}</span>
              {' : '}
              <span>{formatValue(u)}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Card projet avec lien cliquable vers /week */
function ProjectCard({
  project,
  regularTasksCount,
}: {
  project: NonNullable<ParseResponse['project_created']>;
  regularTasksCount: number;
}) {
  return (
    <Link
      href="/week"
      className="block px-4 py-3"
      style={regularTasksCount > 0 ? { borderTop: '0.5px solid #f2f2f7' } : {}}
    >
      <div className="flex items-center gap-3">
        <span className="text-[22px]">📋</span>
        <div className="flex-1">
          <p className="text-[13px] font-semibold text-[#1c1c1e]">{project.name}</p>
          <p className="text-[11px] text-[#8e8e93] mt-0.5">
            {project.taskCount} tâche{project.taskCount > 1 ? 's' : ''} planifiée{project.taskCount > 1 ? 's' : ''} · échéance{' '}
            {new Date(project.reference_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full flex-shrink-0"
          style={{ background: '#EEF4FF', color: '#007aff' }}>
          Planning
          <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" viewBox="0 0 24 24">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </div>
      </div>
    </Link>
  );
}

const DURATION_LABEL_FR: Record<number, string> = {
  5: '5 min', 15: '15 min', 30: '30 min', 60: '1h', 120: '2h+',
};

/** Sprint 13 — Card de confirmation après décomposition Yova, avec actions inline.
 *  Chaque sous-tâche est tappable → ouvre TaskActionsSheet (Fait / Reporter / Réassigner / Pas pertinent).
 *  Fetch dédié (inclut is_active=false) pour afficher les tâches archivées grisées + rayées,
 *  cohérent avec l'ADN "réversible en DB". */
const DURATION_LABEL_BY_ESTIMATE: Record<string, string> = {
  very_short: '5 min', short: '15 min', medium: '30 min', long: '1h', very_long: '2h+',
};

function DecomposedProjectCard({
  project,
  householdId,
  allMembers,
  currentUserId,
}: {
  project: ProjectDecomposed;
  householdId: string | null;
  allMembers: HouseholdMember[];
  currentUserId: string;
}) {
  // Note : on N'utilise PAS taskStore pour les mutations depuis cette card.
  // Raison : taskStore.updateTask/archiveTask/completeTask exigent que la tâche
  // soit déjà dans `store.tasks` (sinon return silencieux "Tâche introuvable").
  // Or juste après une décomposition, il y a une fenêtre où la card est rendue
  // mais le store n'est pas encore resync — l'action paraîtrait sans effet.
  // On fait les écritures en direct et on refetch les enfants localement.
  const { fetchTasks } = useTaskStore();
  const [childTasks, setChildTasks] = useState<TaskListItem[] | null>(null);
  const [actionsTaskId, setActionsTaskId] = useState<string | null>(null);

  const fetchChildren = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('household_tasks')
      .select(`
        *,
        category:task_categories(id, name, icon, color_hex, sort_order),
        assignee:profiles!household_tasks_assigned_to_fkey(id, display_name, avatar_url),
        task_completions(id, completed_at, completed_by, mental_load_score, duration_minutes, note)
      `)
      .eq('parent_project_id', project.parent_task_id)
      .order('next_due_at', { ascending: true, nullsFirst: false });

    const rows = (data ?? []).map((row: Record<string, unknown>) => {
      const completions = (row.task_completions as Array<{ completed_at: string }>) ?? [];
      const sorted = completions.sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime());
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { task_completions: _, ...rest } = row;
      return { ...rest, last_completion: sorted[0] ?? null } as TaskListItem;
    });
    setChildTasks(rows);
  }, [project.parent_task_id]);

  useEffect(() => { fetchChildren(); }, [fetchChildren]);

  const afterMutation = async () => {
    await fetchChildren();
    if (householdId) fetchTasks(householdId); // sync store pour les autres surfaces
  };

  const handleComplete = async () => {
    if (!actionsTaskId || !householdId) return;
    const id = actionsTaskId;
    setActionsTaskId(null);
    const supabase = createClient();
    const { data: task } = await supabase
      .from('household_tasks')
      .select('household_id, mental_load_score')
      .eq('id', id).maybeSingle();
    if (!task) return;
    const now = new Date().toISOString();
    await supabase.from('task_completions').insert({
      task_id: id,
      household_id: task.household_id,
      completed_by: currentUserId,
      completed_at: now,
      mental_load_score: task.mental_load_score,
    });
    // Pour les sous-tâches de projet (frequency='once'), next_due_at passe à null
    // après complétion (cohérent avec computeNextDueAt('once') dans le store).
    await supabase.from('household_tasks').update({ next_due_at: null }).eq('id', id);
    await afterMutation();
  };
  const handlePostpone = async (nextDueIso: string) => {
    if (!actionsTaskId) return;
    const id = actionsTaskId;
    setActionsTaskId(null);
    const supabase = createClient();
    const { error } = await supabase
      .from('household_tasks')
      .update({ next_due_at: nextDueIso })
      .eq('id', id);
    if (error) console.error('[decomposed-card] postpone error:', error);
    await afterMutation();
  };
  const handleReassign = async (userId: string | null, phantomId: string | null) => {
    if (!actionsTaskId) return;
    const id = actionsTaskId;
    setActionsTaskId(null);
    const supabase = createClient();
    const { error } = await supabase
      .from('household_tasks')
      .update({ assigned_to: userId, assigned_to_phantom_id: phantomId })
      .eq('id', id);
    if (error) console.error('[decomposed-card] reassign error:', error);
    await afterMutation();
  };
  const handleArchive = async () => {
    if (!actionsTaskId) return;
    const id = actionsTaskId;
    setActionsTaskId(null);
    const supabase = createClient();
    const { error } = await supabase
      .from('household_tasks')
      .update({ is_active: false })
      .eq('id', id);
    if (error) console.error('[decomposed-card] archive error:', error);
    await afterMutation();
  };

  const targetLabel = project.target_date
    ? new Date(project.target_date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
    : null;

  // Fallback : tant que le fetch n'a pas encore renvoyé, on affiche le JSON renvoyé
  // par l'endpoint (read-only, pour éviter un flash vide).
  const useLiveRows = childTasks !== null && childTasks.length > 0;

  const selectedTask = actionsTaskId && childTasks
    ? childTasks.find((t) => t.id === actionsTaskId) ?? null
    : null;

  return (
    <div className="mb-3 ml-10">
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #5856d6, #764ba2)',
          boxShadow: '0 4px 16px rgba(88,86,214,0.25)',
        }}
      >
        {/* En-tête */}
        <div className="px-4 py-3.5 flex items-center gap-3">
          <span className="text-[22px]">📋</span>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-white/60 uppercase tracking-wider">Projet préparé</p>
            <p className="text-[15px] font-bold text-white truncate">{project.title}</p>
            <p className="text-[12px] text-white/80 mt-0.5">
              {project.subtask_count} tâche{project.subtask_count > 1 ? 's' : ''} planifiée{project.subtask_count > 1 ? 's' : ''}
              {targetLabel ? ` · ${targetLabel}` : ''}
            </p>
          </div>
        </div>

        {/* Liste des sous-tâches — live (clickable) ou fallback (JSON) */}
        <div style={{ background: 'rgba(255,255,255,0.08)' }}>
          {useLiveRows
            ? childTasks!.map((task, i) => {
                const dueDate = task.next_due_at ? new Date(task.next_due_at) : null;
                const dateShort = dueDate
                  ? dueDate.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })
                  : '—';
                const durationLabel = task.duration_estimate
                  ? DURATION_LABEL_BY_ESTIMATE[task.duration_estimate] ?? task.duration_estimate
                  : '';
                const isArchived = !task.is_active;
                const isDone = !isArchived && task.last_completion !== null;
                const dim = isArchived || isDone;
                return (
                  <button
                    key={task.id}
                    onClick={() => setActionsTaskId(task.id)}
                    className="w-full px-4 py-2.5 flex items-start gap-2.5 text-left active:bg-white/10 transition-colors"
                    style={i > 0 ? { borderTop: '0.5px solid rgba(255,255,255,0.12)' } : {}}
                    aria-label={`Actions sur ${task.name}`}
                  >
                    <span
                      className="text-[11px] font-semibold leading-[1.2] mt-0.5 flex-shrink-0 w-4"
                      style={{ color: dim ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.5)' }}
                    >
                      {isDone ? '✓' : isArchived ? '—' : `${i + 1}.`}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-[13px] font-medium leading-snug"
                        style={{
                          color: dim ? 'rgba(255,255,255,0.45)' : 'white',
                          textDecoration: dim ? 'line-through' : 'none',
                        }}
                      >
                        {task.name}
                      </p>
                      <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.55)' }}>
                        {dateShort}{durationLabel ? ` · ⏱ ${durationLabel}` : ''}
                        {isArchived && ' · archivée'}
                        {isDone && ' · fait'}
                      </p>
                    </div>
                  </button>
                );
              })
            : project.subtasks.map((s, i) => {
                const dueDate = new Date(s.next_due_at);
                const dateShort = dueDate.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' });
                const durationLabel = DURATION_LABEL_FR[s.duration_minutes] ?? `${s.duration_minutes} min`;
                return (
                  <div
                    key={i}
                    className="px-4 py-2.5 flex items-start gap-2.5"
                    style={i > 0 ? { borderTop: '0.5px solid rgba(255,255,255,0.12)' } : {}}
                  >
                    <span className="text-[11px] font-semibold text-white/50 leading-[1.2] mt-0.5 flex-shrink-0 w-4">{i + 1}.</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-white leading-snug">{s.name}</p>
                      <p className="text-[11px] text-white/60 mt-0.5">{dateShort} · ⏱ {durationLabel}</p>
                    </div>
                  </div>
                );
              })}
        </div>

        {/* Footer : hint d'action */}
        <div
          className="flex items-center justify-center gap-2 px-4 py-2.5"
          style={{ background: 'rgba(255,255,255,0.12)', borderTop: '0.5px solid rgba(255,255,255,0.18)' }}
        >
          <span className="text-[11px] font-medium text-white/75">
            {useLiveRows ? 'Tape une tâche pour l\'ajuster' : 'Préparation…'}
          </span>
        </div>
      </div>

      {/* Sheet d'actions inline */}
      {actionsTaskId && selectedTask && householdId && (
        <TaskActionsSheet
          task={selectedTask}
          allMembers={allMembers}
          currentUserId={currentUserId}
          onComplete={handleComplete}
          onPostpone={handlePostpone}
          onReassign={handleReassign}
          onArchive={handleArchive}
          onClose={() => setActionsTaskId(null)}
        />
      )}
    </div>
  );
}

function ResultCard({
  data,
  currentUserName,
  householdId,
  allMembers,
  currentUserId,
}: {
  data: ParseResponse;
  currentUserName?: string;
  householdId: string | null;
  allMembers: HouseholdMember[];
  currentUserId: string;
}) {
  const regularTasks = [
    ...(data.completions ?? []).map((c) => ({
      name: c.task_name,
      isNew: false,
      byName: c.completed_by_name && c.completed_by_name !== currentUserName ? c.completed_by_name : null,
    })),
    ...(data.auto_created ?? []).map((t) => ({ name: t.name, isNew: true, byName: null })),
  ];
  const project = data.project_created ?? null;
  const decomposed = data.project_decomposed ?? null;

  // Sprint 12/13 — si la réponse est uniquement une décomposition, card live avec actions
  if (decomposed && regularTasks.length === 0 && !project) {
    return (
      <DecomposedProjectCard
        project={decomposed}
        householdId={householdId}
        allMembers={allMembers}
        currentUserId={currentUserId}
      />
    );
  }
  if (regularTasks.length === 0 && !project && !decomposed) return null;

  return (
    <div className="mb-3 ml-10">
      <div className="rounded-2xl bg-white overflow-hidden" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>

        {/* Tâches normales (complétées aujourd'hui) */}
        {regularTasks.length > 0 && (
          <>
            <div className="px-4 pt-3 pb-1.5">
              <p className="text-[11px] font-bold text-[#34c759] uppercase tracking-wide">✓ Fait aujourd&apos;hui</p>
            </div>
            {regularTasks.map((t, i) => (
              <div
                key={i}
                className="px-4 py-2.5 flex items-center gap-2.5"
                style={{ borderTop: '0.5px solid #f2f2f7' }}
              >
                <span className="text-[14px]">{t.isNew ? '✨' : '✅'}</span>
                <span className="flex-1 text-[13px] text-[#1c1c1e] font-medium">{t.name}</span>
                {t.byName && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full mr-1"
                    style={{ background: '#FFF0F0', color: '#ff3b30' }}>{t.byName}</span>
                )}
                {t.isNew && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                    style={{ background: '#EEF4FF', color: '#007aff' }}>Nouveau</span>
                )}
              </div>
            ))}
          </>
        )}

        {/* Tâches de projet créées */}
        {project && (
          <ProjectCard project={project} regularTasksCount={regularTasks.length} />
        )}

        <div className="px-4 py-2" style={{ borderTop: '0.5px solid #f2f2f7' }}>
          <p className="text-[11px] text-[#8e8e93]">
            {project ? 'Visible dans ton planning.' : 'Bien noté — Yova s\'en souvient.'}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Page principale ────────────────────────────────────────────────────────────

export default function JournalPage() {
  const router = useRouter();
  const { profile, refreshProfile } = useAuthStore();
  const { fetchTasks } = useTaskStore();
  const { allMembers, fetchHousehold } = useHouseholdStore();
  const { facts, fetchMemory, invalidateFact } = useMemoryStore();

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [convHistory, setConvHistory] = useState<HistoryMessage[]>([]);
  const [isDone, setIsDone] = useState(false);
  const [text, setText] = useState(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('yova_journal_draft') ?? '';
  });
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Draft localStorage ──
  useEffect(() => {
    if (text) localStorage.setItem('yova_journal_draft', text);
    else localStorage.removeItem('yova_journal_draft');
  }, [text]);

  // ── Check-in du soir ──
  const currentHour = new Date().getHours();
  const isEveningTime = currentHour >= 20 || currentHour < 4;

  // ── Vocal STT ──
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const textBeforeRecognitionRef = useRef(''); // texte dans la zone avant de démarrer le micro
  // Détecté côté client uniquement (évite hydration mismatch SSR/client)
  const [isSpeechSupported, setIsSpeechSupported] = useState(false);
  useEffect(() => {
    setIsSpeechSupported('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
  }, []);

  const toggleListening = () => {
    if (!isSpeechSupported) return;
    setSpeechError(null);
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    const recognition = new SR();
    recognition.lang = 'fr-FR';
    recognition.continuous = true;
    recognition.interimResults = true;
    let finalTranscript = '';
    textBeforeRecognitionRef.current = text; // snapshot du texte avant de démarrer
    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (e: SpeechRecognitionEvent) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalTranscript += t + ' ';
        else interim = t;
      }
      // Toujours reconstruire depuis le texte de base : base + finals + interim courant
      // Évite l'accumulation des résultats intermédiaires
      const base = textBeforeRecognitionRef.current.trimEnd();
      const finals = finalTranscript.trimEnd();
      setText((base ? base + ' ' : '') + (finals ? finals + (interim ? ' ' + interim : '') : interim));
    };
    recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
      setIsListening(false);
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        setSpeechError('Micro non autorisé — ouvre le site dans Safari (pas en app), puis autorise le micro dans les réglages.');
      } else if (e.error === 'no-speech') {
        setSpeechError(null); // silence normal
      } else if (e.error === 'audio-capture') {
        setSpeechError('Aucun micro détecté.');
      } else if (e.error === 'network') {
        setSpeechError('Connexion requise pour la dictée.');
      } else {
        setSpeechError('Erreur micro : ' + e.error);
      }
    };
    recognition.onend = () => { setIsListening(false); finalTranscript = ''; };
    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (err) {
      setSpeechError('Impossible de démarrer : ' + (err instanceof Error ? err.message : String(err)));
    }
  };
  const [checkinStep, setCheckinStep] = useState<0 | 1 | 2 | 3>(0);
  const [checkinAnswers, setCheckinAnswers] = useState<string[]>([]);

  const CHECKIN_QUESTIONS = [
    'Comment ça va, vraiment ?',
    'Et à la maison — les enfants, les courses, le dîner ?',
    'Y\'a quelque chose qui t\'a pesé aujourd\'hui, ou qui t\'inquiète pour demain ?',
  ];

  // Historique journaux
  const [history, setHistory] = useState<PastJournal[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);


  // Consentement RGPD
  const [consentGiven, setConsentGiven] = useState<boolean | null>(null);
  const [consentLoading, setConsentLoading] = useState(false);

  // ── Scroll auto vers le bas quand nouveaux messages ──
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Consentement depuis profil ──
  useEffect(() => {
    if (profile === null) return;
    setConsentGiven(!!profile.ai_journal_consent_at);
  }, [profile?.ai_journal_consent_at]);

  // ── Mémoire Yova ──
  useEffect(() => {
    if (profile?.household_id) fetchMemory(profile.household_id);
  }, [profile?.household_id, fetchMemory]);

  // ── Foyer (membres pour la sheet d'actions sur sous-tâches) ──
  useEffect(() => {
    if (profile?.household_id) fetchHousehold(profile.household_id);
  }, [profile?.household_id, fetchHousehold]);

  // ── Historique journaux ──
  useEffect(() => {
    async function loadHistory() {
      if (!profile?.id) return;
      const supabase = createClient();
      const { data } = await supabase
        .from('user_journals')
        .select('id, raw_text, ai_response, parsed_completions, mood_tone, created_at')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(20);
      setHistory((data ?? []) as PastJournal[]);
      setHistoryLoaded(true);
    }
    if (isDone) {
      const t = setTimeout(loadHistory, 1200);
      return () => clearTimeout(t);
    } else {
      loadHistory();
    }
  }, [profile?.id, isDone]);

  // ── Handlers consentement ──
  const handleAcceptConsent = async () => {
    if (!profile?.id) return;
    setConsentLoading(true);
    const supabase = createClient();
    await supabase.from('profiles').update({ ai_journal_consent_at: new Date().toISOString() }).eq('id', profile.id);
    await refreshProfile();
    setConsentGiven(true);
    setConsentLoading(false);
  };

  // ── Check-in : avance d'une étape ou envoie tout ──
  const sendCheckin = async () => {
    const trimmed = text.trim();
    if (!trimmed || trimmed.length < 2 || sending) return;

    // Sprint 12 — bypass check-in si l'user énonce un projet clair.
    // checkinStep=3 suffit pour cacher la bulle Q1 welcome ET router les
    // inputs suivants vers send() (cf. conditions `checkinStep < 3`).
    // Ne PAS toucher isDone sinon l'input disparaît.
    if (detectProjectIntent(trimmed)) {
      setCheckinStep(3);
      await send();
      return;
    }

    setText('');

    const newAnswers = [...checkinAnswers, trimmed];
    const newStep = (checkinStep + 1) as 0 | 1 | 2 | 3;

    // Affiche la question courante + la réponse utilisateur
    // (Q1 était dans la zone "welcome" hors thread — on la réinjecte dans le thread au premier envoi)
    setMessages((prev) => [
      ...prev,
      ...(checkinStep === 0
        ? [{ id: uid(), type: 'yova' as const, content: CHECKIN_QUESTIONS[0], isQuestion: true, moodTone: null }]
        : []),
      { id: uid(), type: 'user', content: trimmed },
    ]);

    if (newStep < 3) {
      // Encore une question
      setCheckinAnswers(newAnswers);
      setCheckinStep(newStep);
      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          { id: uid(), type: 'yova', content: CHECKIN_QUESTIONS[newStep], isQuestion: true, moodTone: null },
        ]);
      }, 400);
    } else {
      // 3 réponses collectées → envoi groupé à parse-journal
      setCheckinStep(3);
      setCheckinAnswers(newAnswers);
      setSending(true);
      const typingId = uid();
      setTimeout(() => {
        setMessages((prev) => [...prev, { id: typingId, type: 'typing' }]);
      }, 400);

      const combinedText = newAnswers
        .map((a, i) => `${CHECKIN_QUESTIONS[i]}\n${a}`)
        .join('\n\n');

      try {
        const res = await fetch('/api/ai/parse-journal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: combinedText, inputMethod: 'text' }),
        });
        const data: ParseResponse = await res.json();
        setMessages((prev) => prev.filter((m) => m.id !== typingId));
        setMessages((prev) => [
          ...prev,
          { id: uid(), type: 'yova', content: data.ai_response ?? 'Merci pour ce check-in. Bonne nuit !', moodTone: data.mood_tone },
          ...((data.structured_updates?.length ?? 0) > 0
            ? [{ id: uid(), type: 'memory_note' as const, updates: data.structured_updates! }]
            : []),
          ...((data.completions?.length ?? 0) > 0 || (data.auto_created?.length ?? 0) > 0 || data.project_decomposed
            ? [{ id: uid(), type: 'result' as const, data }]
            : []),
        ]);
        setIsDone(true);
        if (profile?.household_id) {
          fetchTasks(profile.household_id);
          const hid = profile.household_id;
          if ((data.structured_updates?.length ?? 0) > 0) {
            fetchHousehold(hid);
          }
          fetch('/api/ai/extract-memory', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ journalId: data.journalId, text: combinedText, householdId: hid }),
          })
            .then((r) => r.json())
            .then((memRes) => {
              if (!memRes?.ok) return;
              const updates = Array.isArray(memRes.structured_updates) ? memRes.structured_updates : [];
              if (updates.length > 0) {
                setMessages((prev) => [...prev, { id: uid(), type: 'memory_note', updates }]);
                fetchHousehold(hid);
              }
            })
            .catch(() => {});
        }
      } catch {
        setMessages((prev) => prev.filter((m) => m.id !== typingId));
        setMessages((prev) => [...prev, { id: uid(), type: 'yova', content: 'Erreur réseau. Réessaye.', moodTone: null }]);
      } finally {
        setSending(false);
      }
    }
  };

  // ── Envoi d'un message ──
  const send = async () => {
    const trimmed = text.trim();
    if (!trimmed || trimmed.length < 3 || sending || isDone) return;
    setSending(true);
    setText('');

    // Ajouter le message utilisateur + indicateur typing
    const userMsgId = uid();
    const typingId = uid();
    setMessages((prev) => [
      ...prev,
      { id: userMsgId, type: 'user', content: trimmed },
      { id: typingId, type: 'typing' },
    ]);

    try {
      const res = await fetch('/api/ai/parse-journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: trimmed,
          inputMethod: 'text',
          conversation_history: convHistory.length > 0 ? convHistory : undefined,
        }),
      });

      const data: ParseResponse = await res.json();

      // Retirer l'indicateur typing
      setMessages((prev) => prev.filter((m) => m.id !== typingId));

      // ── Rate limit ──
      if (data.code === 'AI_LIMIT_REACHED') {
        setMessages((prev) => [
          ...prev,
          { id: uid(), type: 'yova', content: data.error ?? 'Limite mensuelle atteinte.', moodTone: null },
        ]);
        setSending(false);
        return;
      }

      // ── Clarification : Yova pose une question ──
      if (data.needs_clarification) {
        const question = data.clarification_question ?? data.ai_response;
        setMessages((prev) => [
          ...prev,
          { id: uid(), type: 'yova', content: question, isQuestion: true, moodTone: null },
        ]);
        setConvHistory((prev) => [
          ...prev,
          { role: 'user', content: trimmed },
          { role: 'assistant', content: question },
        ]);
        setSending(false);
        return;
      }

      // ── Réponse finale ──
      setMessages((prev) => [
        ...prev,
        { id: uid(), type: 'yova', content: data.ai_response, moodTone: data.mood_tone },
        ...((data.structured_updates?.length ?? 0) > 0
          ? [{ id: uid(), type: 'memory_note' as const, updates: data.structured_updates! }]
          : []),
        ...((data.completions?.length ?? 0) > 0 || (data.auto_created?.length ?? 0) > 0 || data.project_created || data.project_decomposed
          ? [{ id: uid(), type: 'result' as const, data }]
          : []),
      ]);
      setIsDone(true);
      setConvHistory([]);

      // Recharger tâches + extraire mémoire (silencieux)
      if (profile?.household_id) {
        await fetchTasks(profile.household_id);
        const capturedHouseholdId = profile.household_id;
        if ((data.structured_updates?.length ?? 0) > 0) {
          fetchHousehold(capturedHouseholdId);
        }
        fetch('/api/ai/extract-memory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            journalId: data.journalId,
            text: trimmed,
            householdId: capturedHouseholdId,
          }),
        })
          .then((r) => r.json())
          .then((memRes) => {
            if (!memRes?.ok) return;
            const updates = Array.isArray(memRes.structured_updates) ? memRes.structured_updates : [];
            if (updates.length > 0) {
              setMessages((prev) => [...prev, { id: uid(), type: 'memory_note', updates }]);
              fetchHousehold(capturedHouseholdId);
            }
            setTimeout(() => fetchMemory(capturedHouseholdId), 800);
          })
          .catch(() => {});
      }

    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== typingId));
      setMessages((prev) => [
        ...prev,
        { id: uid(), type: 'yova', content: 'Erreur réseau. Réessaye.', moodTone: null },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      isEveningTime && checkinStep < 3 && !isDone ? sendCheckin() : send();
    }
  };

  const handleNewConversation = () => {
    setMessages([]);
    setConvHistory([]);
    setIsDone(false);
    setText('');
    setCheckinStep(0);
    setCheckinAnswers([]);
  };

  // ── Consentement non chargé ──
  if (consentGiven === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 rounded-full border-2 border-[#007aff] border-t-transparent animate-spin" />
      </div>
    );
  }

  // ── Consentement refusé ──
  if (consentGiven === false) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12" style={{ background: '#f2f2f7' }}>
        <div className="w-full max-w-sm rounded-3xl overflow-hidden" style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
          <div className="px-6 pt-8 pb-6 text-center"
            style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full text-[32px]"
              style={{ background: 'rgba(255,255,255,0.2)' }}>🤖</div>
            <h1 className="text-[22px] font-bold text-white mb-1">Parler à Yova</h1>
            <p className="text-[13px] text-white/80">Consentement requis avant utilisation</p>
          </div>
          <div className="bg-white px-6 py-6">
            <p className="text-[15px] text-[#1c1c1e] font-semibold mb-3">Comment ça fonctionne&nbsp;?</p>
            <p className="text-[14px] text-[#3c3c43] leading-relaxed mb-4">
              Quand tu décris ta journée, ton texte est envoyé à l&apos;IA <strong>Anthropic Claude</strong>
              {' '}(hébergée aux États-Unis) pour identifier les tâches effectuées.
              Aucun de ces textes n&apos;est utilisé pour entraîner des modèles d&apos;IA.
            </p>
            <div className="rounded-2xl p-4 mb-5" style={{ background: '#f2f2f7' }}>
              <p className="text-[13px] text-[#3c3c43] leading-relaxed">
                📍 <strong>Données envoyées :</strong> ton texte libre + la liste de tes tâches (sans noms réels des membres)<br />
                🔒 <strong>Données conservées :</strong> résultat uniquement, sur serveurs Supabase (UE)<br />
                🗑️ <strong>Suppression :</strong> avec ton compte, depuis Profil → Mes données
              </p>
            </div>
            <p className="text-[12px] text-[#8e8e93] mb-5 text-center">
              Conformément au RGPD Art. 7, tu peux retirer ce consentement à tout moment depuis ton profil.
            </p>
            <button onClick={handleAcceptConsent} disabled={consentLoading}
              className="w-full rounded-2xl py-[14px] text-[16px] font-bold text-white mb-3 disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)', boxShadow: '0 4px 16px rgba(118,75,162,0.25)' }}>
              {consentLoading ? 'Enregistrement...' : "J'accepte et je continue"}
            </button>
            <button onClick={() => router.back()}
              className="w-full rounded-2xl py-[14px] text-[15px] font-medium text-[#8e8e93]"
              style={{ background: '#f2f2f7' }}>
              Refuser — revenir en arrière
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Interface principale ──
  return (
    <div className="pt-4 pb-8 flex flex-col gap-4">

      {/* Header */}
      <div className="px-4 flex items-center justify-between">
        <BackButton />
        <h2 className="text-[17px] font-semibold text-[#1c1c1e]">Parler à Yova</h2>
        {isDone ? (
          <button onClick={handleNewConversation}
            className="text-[13px] font-semibold px-3 py-1.5 rounded-full"
            style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)', color: 'white' }}>
            Nouveau
          </button>
        ) : (
          <div className="w-16" />
        )}
      </div>

      {/* ── Zone de chat ── */}
      <div className="mx-4">

        {/* Message d'accueil Yova si conversation vide */}
        {messages.length === 0 && !isDone && (
          <div className="mb-4">
            {isEveningTime ? (
              <>
                {/* ── Check-in du soir ── */}
                <div className="flex items-center gap-2 mb-3 px-1">
                  <span className="text-[18px]">🌙</span>
                  <div>
                    <p className="text-[11px] font-bold text-[#8e8e93] uppercase tracking-wide">Check-in du soir</p>
                    <div className="flex gap-1 mt-1">
                      {[0, 1, 2].map((i) => (
                        <div key={i} className="h-1 w-6 rounded-full transition-all duration-300"
                          style={{ background: i < checkinStep ? '#34c759' : i === checkinStep ? '#007aff' : '#e5e5ea' }} />
                      ))}
                    </div>
                  </div>
                </div>
                <YovaBubble
                  content={CHECKIN_QUESTIONS[checkinStep]}
                  moodTone={null}
                  isQuestion
                />
              </>
            ) : (
              <YovaBubble
                content={
                  currentHour >= 20 || currentHour < 4
                    ? "Bonsoir. Comment s'est passée la journée ? Raconte-moi ce que t'as géré — je retiens tout pour alléger la suite."
                    : currentHour < 12
                    ? "Salut. T'as quelque chose à me raconter sur hier soir ou ce matin ? Je prends note."
                    : "Raconte. Ce que t'as fait, ce qui t'a pesé, ce qui t'inquiète — je m'en souviens pour toi."
                }
                moodTone={null}
              />
            )}
          </div>
        )}

        {/* Thread de messages */}
        {messages.map((msg) => {
          if (msg.type === 'user') return <UserBubble key={msg.id} content={msg.content} />;
          if (msg.type === 'yova') return <YovaBubble key={msg.id} content={msg.content} moodTone={msg.moodTone} isQuestion={msg.isQuestion} />;
          if (msg.type === 'typing') return <TypingBubble key={msg.id} />;
          if (msg.type === 'result') return (
            <ResultCard
              key={msg.id}
              data={msg.data}
              currentUserName={profile?.display_name ?? undefined}
              householdId={profile?.household_id ?? null}
              allMembers={allMembers}
              currentUserId={profile?.id ?? ''}
            />
          );
          if (msg.type === 'memory_note') return <MemoryNote key={msg.id} updates={msg.updates} />;
          return null;
        })}

        <div ref={messagesEndRef} />

        {/* Input */}
        {!isDone && (
          <div className="mt-2">
            {/* Indicateur écoute */}
            {isListening && (
              <div className="flex items-center gap-2 mb-2 px-1">
                <div className="flex gap-0.5 items-center">
                  {[0,1,2].map(i => (
                    <div key={i} className="w-1 rounded-full bg-[#ff3b30] animate-bounce"
                      style={{ height: `${8 + i * 4}px`, animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
                <span className="text-[12px] font-medium text-[#ff3b30]">Yova t'écoute… parle !</span>
              </div>
            )}
            {/* Erreur micro */}
            {speechError && (
              <div className="flex items-center gap-2 mb-2 px-1">
                <span className="text-[12px] text-[#ff3b30]">⚠️ {speechError}</span>
              </div>
            )}
            <div className="flex gap-2 items-end">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                maxLength={2000}
                rows={2}
                disabled={sending}
                placeholder={
                  isListening
                    ? 'Parle, je transcris…'
                    : isEveningTime && checkinStep < 3 && !isDone
                    ? 'Ta réponse…'
                    : convHistory.length > 0
                    ? 'Ta réponse…'
                    : 'Raconte ta journée à Yova…'
                }
                className="flex-1 text-[15px] rounded-2xl px-4 py-3 bg-white text-[#1c1c1e] outline-none placeholder:text-[#c7c7cc] resize-none disabled:opacity-50"
                style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
                autoFocus
              />
              {/* Bouton micro — masqué si non supporté (iOS PWA notamment) */}
              {isSpeechSupported ? (
                <button
                  onClick={toggleListening}
                  disabled={sending}
                  className="flex-shrink-0 w-[46px] h-[46px] rounded-2xl flex items-center justify-center transition-all duration-200 disabled:opacity-40"
                  style={{
                    background: isListening
                      ? 'linear-gradient(135deg, #ff3b30, #ff6b6b)'
                      : 'rgba(0,122,255,0.1)',
                    boxShadow: isListening ? '0 2px 8px rgba(255,59,48,0.35)' : 'none',
                  }}
                  aria-label={isListening ? 'Arrêter la dictée' : 'Dicter à voix haute'}
                >
                  {isListening ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="#ff3b30" stroke="none">
                      <rect x="6" y="6" width="12" height="12" rx="2" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#007aff" strokeWidth="2" strokeLinecap="round">
                      <rect x="9" y="2" width="6" height="12" rx="3" />
                      <path d="M5 10a7 7 0 0014 0" />
                      <line x1="12" y1="19" x2="12" y2="22" />
                      <line x1="9" y1="22" x2="15" y2="22" />
                    </svg>
                  )}
                </button>
              ) : (
                /* Micro non disponible — indice discret */
                <div
                  className="flex-shrink-0 w-[46px] h-[46px] rounded-2xl flex items-center justify-center opacity-30"
                  style={{ background: 'rgba(0,0,0,0.05)' }}
                  title="Dictée non disponible — ouvre dans Safari pour activer"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8e8e93" strokeWidth="2" strokeLinecap="round">
                    <rect x="9" y="2" width="6" height="12" rx="3" />
                    <path d="M5 10a7 7 0 0014 0" />
                    <line x1="12" y1="19" x2="12" y2="22" />
                    <line x1="9" y1="22" x2="15" y2="22" />
                    <line x1="3" y1="3" x2="21" y2="21" stroke="#ff3b30" strokeWidth="2" />
                  </svg>
                </div>
              )}
              <button
                onClick={isEveningTime && checkinStep < 3 && !isDone ? sendCheckin : send}
                disabled={sending || text.trim().length < 2}
                className="flex-shrink-0 px-4 py-2.5 rounded-2xl text-[15px] font-semibold text-white disabled:opacity-40 flex items-center gap-2"
                style={{ background: 'linear-gradient(135deg, #007aff, #5856d6)', boxShadow: '0 2px 8px rgba(0,122,255,0.25)' }}
              >
                {sending ? (
                  <>
                    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3"/>
                      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                    </svg>
                    Yova réfléchit…
                  </>
                ) : 'Envoyer'}
              </button>
            </div>
          </div>
        )}

        {/* Bouton "Nouvelle conversation" après résultat final */}
        {isDone && (
          <div className="mt-4 text-center">
            <button
              onClick={handleNewConversation}
              className="rounded-2xl px-6 py-3 text-[15px] font-semibold text-white"
              style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)', boxShadow: '0 4px 12px rgba(118,75,162,0.25)' }}
            >
              + Nouvelle conversation
            </button>
          </div>
        )}
      </div>

      {/* ── Mémoire Yova — lien discret vers le profil ── */}
      {facts.length > 0 && (
        <div className="mx-4">
          <button
            onClick={() => router.push('/profile')}
            className="w-full flex items-center justify-between px-4 py-3 rounded-2xl bg-white text-left"
            style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}
          >
            <div className="flex items-center gap-2.5">
              <span className="text-[16px]">✦</span>
              <span className="text-[13px] text-[#3c3c43]">
                Yova mémorise au fil de tes récits
              </span>
            </div>
            <span className="text-[12px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1"
              style={{ background: '#f2f2f7', color: '#8e8e93' }}>
              {facts.length} fait{facts.length > 1 ? 's' : ''} →
            </span>
          </button>
        </div>
      )}

      {/* ── Historique journaux (masqué par défaut) ── */}
      <div className="mx-4">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="flex items-center gap-2 text-[13px] font-semibold text-[#8e8e93] uppercase tracking-wide mb-2 px-1"
        >
          <span>Derniers journaux</span>
          <svg
            width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2"
            className="transition-transform"
            style={{ transform: showHistory ? 'rotate(180deg)' : 'rotate(0deg)' }}
          >
            <polyline points="2,4 6,8 10,4" />
          </svg>
        </button>

        {showHistory && (
          <>
            {!historyLoaded ? (
              <div className="text-center py-4">
                <div className="w-5 h-5 rounded-full border-2 border-[#007aff] border-t-transparent animate-spin mx-auto" />
              </div>
            ) : history.length === 0 ? (
              <p className="text-center text-[13px] text-[#c7c7cc] py-6">Aucun journal pour l&apos;instant.</p>
            ) : (
              <div className="rounded-2xl bg-white overflow-hidden" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
                {history.map((h, i) => {
                  const isExpanded = expandedHistoryId === h.id;
                  const dateStr = new Date(h.created_at).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
                  const timeStr = new Date(h.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                  const preview = h.raw_text.length > 55 ? h.raw_text.slice(0, 55) + '…' : h.raw_text;

                  return (
                    <div key={h.id} style={i < history.length - 1 ? { borderBottom: '0.5px solid #f2f2f7' } : {}}>
                      {/* Ligne compacte — toujours visible */}
                      <button
                        onClick={() => setExpandedHistoryId(isExpanded ? null : h.id)}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left"
                      >
                        <span className="text-[15px] flex-shrink-0">
                          {h.mood_tone ? (MOOD_EMOJI[h.mood_tone] ?? '💬') : '💬'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] text-[#1c1c1e] truncate">{preview}</p>
                          <p className="text-[11px] text-[#8e8e93] mt-0.5">{dateStr} · {timeStr}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {h.parsed_completions.length > 0 && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                              style={{ background: '#e8fbe8', color: '#34c759' }}>
                              ✓{h.parsed_completions.length}
                            </span>
                          )}
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#c7c7cc" strokeWidth="2"
                            className="transition-transform"
                            style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                            <polyline points="2,4 6,8 10,4" />
                          </svg>
                        </div>
                      </button>

                      {/* Détail déplié */}
                      {isExpanded && (
                        <div className="px-4 pb-4" style={{ borderTop: '0.5px solid #f2f2f7' }}>
                          <p className="text-[13px] text-[#1c1c1e] leading-relaxed mt-3 mb-2">{h.raw_text}</p>
                          {h.ai_response && (
                            <div className="rounded-xl px-3 py-2.5"
                              style={{ background: 'linear-gradient(135deg,rgba(102,126,234,0.08),rgba(118,75,162,0.08))' }}>
                              <p className="text-[12px] text-[#3c3c43] leading-relaxed">🤖 {h.ai_response}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

    </div>
  );
}
