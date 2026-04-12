'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import { useTaskStore } from '@/stores/taskStore';
import { useHouseholdStore } from '@/stores/householdStore';
import { frequencyLabel, FREQUENCY_OPTIONS } from '@/utils/frequency';
import type { TaskCompletion, Frequency } from '@/types/database';

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuthStore();
  const { tasks, completeTask, updateTask, archiveTask, deleteTask, fetchTaskDetail, completing, archiving } = useTaskStore();
  const { members } = useHouseholdStore();
  const task = tasks.find((t) => t.id === id);

  const [completions, setCompletions] = useState<TaskCompletion[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showCompleteForm, setShowCompleteForm] = useState(false);
  const [completeDuration, setCompleteDuration] = useState('');
  const [completeNote, setCompleteNote] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  useEffect(() => {
    if (id) { setLoadingHistory(true); fetchTaskDetail(id).then((data) => { setCompletions(data); setLoadingHistory(false); }); }
  }, [id, fetchTaskDetail]);

  // Sauvegarde automatique d'un champ
  const autoSave = useCallback(async (field: string, value: unknown) => {
    if (!task) return;
    setSaveStatus('saving');
    const result = await updateTask(task.id, { [field]: value });
    setSaveStatus(result.ok ? 'saved' : 'error');
    setTimeout(() => setSaveStatus('idle'), 1500);
  }, [task, updateTask]);

  if (!task) {
    return (
      <div className="pt-4 px-4">
        <button onClick={() => router.back()} className="text-[17px] font-medium" style={{ color: '#007aff' }}>← Retour</button>
        <div className="mt-8 text-center"><p className="text-[17px] text-[#8e8e93]">Tâche introuvable</p></div>
      </div>
    );
  }

  const handleComplete = async () => {
    if (completing) return;
    const duration = completeDuration ? parseInt(completeDuration, 10) : null;
    await completeTask(task.id, { duration_minutes: duration, note: completeNote || null });
    setShowCompleteForm(false); setCompleteDuration(''); setCompleteNote('');
    const data = await fetchTaskDetail(task.id);
    setCompletions(data);
  };

  const handleArchive = async () => {
    if (!confirm('Archiver cette tâche ?')) return;
    await archiveTask(task.id);
    router.push('/tasks');
  };

  const catColor = task.category?.color_hex ?? '#8e8e93';

  return (
    <div className="pt-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between px-4">
        <button onClick={() => router.back()} className="text-[17px] font-medium" style={{ color: '#007aff' }}>← Retour</button>
        {saveStatus !== 'idle' && (
          <span className="text-[13px] font-medium" style={{
            color: saveStatus === 'saving' ? '#8e8e93' : saveStatus === 'saved' ? '#34c759' : '#ff3b30'
          }}>
            {saveStatus === 'saving' ? 'Sauvegarde...' : saveStatus === 'saved' ? '✓ Sauvegardé' : 'Erreur'}
          </span>
        )}
      </div>

      {/* Fiche tâche */}
      <div className="mx-4 rounded-2xl bg-white overflow-hidden" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>

        {/* Nom — éditable inline, sauvegarde au blur */}
        <div className="px-4 py-3" style={{ borderBottom: '0.5px solid var(--ios-separator)' }}>
          <input
            type="text"
            defaultValue={task.name}
            onBlur={(e) => {
              const val = e.target.value.trim();
              if (val && val !== task.name) autoSave('name', val);
            }}
            className="w-full text-[20px] font-bold text-[#1c1c1e] bg-transparent outline-none"
          />
        </div>

        {/* Catégorie + Score */}
        <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '0.5px solid var(--ios-separator)' }}>
          <span className="rounded-full px-2.5 py-0.5 text-[12px] font-semibold text-white" style={{ background: catColor }}>
            {task.category?.name}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[#8e8e93]">Charge mentale</span>
            <select
              defaultValue={task.mental_load_score}
              onChange={(e) => autoSave('mental_load_score', Number(e.target.value))}
              className="text-[17px] font-bold bg-transparent outline-none"
              style={{ color: task.mental_load_score >= 4 ? '#ff3b30' : task.mental_load_score >= 3 ? '#ff9500' : '#34c759' }}
            >
              {[0,1,2,3,4,5].map((v) => <option key={v} value={v}>{v * 2}/10</option>)}
            </select>
          </div>
        </div>

        {/* Fréquence — select direct */}
        <div className="px-4 py-3" style={{ borderBottom: '0.5px solid var(--ios-separator)' }}>
          <p className="text-[11px] text-[#8e8e93] uppercase mb-1">Fréquence</p>
          <select
            defaultValue={task.frequency}
            onChange={(e) => autoSave('frequency', e.target.value)}
            className="w-full text-[17px] font-medium text-[#1c1c1e] bg-transparent outline-none"
          >
            {FREQUENCY_OPTIONS.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
          </select>
        </div>

        {/* Assignée à — select direct */}
        <div className="px-4 py-3" style={{ borderBottom: '0.5px solid var(--ios-separator)' }}>
          <p className="text-[11px] text-[#8e8e93] uppercase mb-1">Assignée à</p>
          <select
            defaultValue={task.assigned_to ?? ''}
            onChange={(e) => autoSave('assigned_to', e.target.value || null)}
            className="w-full text-[17px] font-medium text-[#1c1c1e] bg-transparent outline-none"
          >
            <option value="">Non assigné</option>
            {members.map((m) => (<option key={m.id} value={m.id}>{m.display_name}</option>))}
          </select>
        </div>

        {/* Prochaine échéance — date/time directs */}
        <div className="px-4 py-3">
          <p className="text-[11px] text-[#8e8e93] uppercase mb-1">Prochaine échéance</p>
          <div className="flex gap-2">
            <input
              type="date"
              defaultValue={task.next_due_at ? new Date(task.next_due_at).toISOString().split('T')[0] : ''}
              onChange={(e) => {
                if (!e.target.value) return;
                const time = task.next_due_at ? new Date(task.next_due_at).toTimeString().substring(0, 5) : '09:00';
                autoSave('next_due_at', new Date(`${e.target.value}T${time}:00`).toISOString());
              }}
              className="flex-1 text-[17px] text-[#1c1c1e] bg-transparent outline-none"
            />
            <input
              type="time"
              defaultValue={task.next_due_at ? new Date(task.next_due_at).toTimeString().substring(0, 5) : '09:00'}
              onChange={(e) => {
                const date = task.next_due_at ? new Date(task.next_due_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
                autoSave('next_due_at', new Date(`${date}T${e.target.value}:00`).toISOString());
              }}
              className="w-24 text-[17px] text-[#1c1c1e] bg-transparent outline-none"
            />
          </div>
        </div>
      </div>

      {/* Bouton complétion */}
      <div className="mx-4">
        {!showCompleteForm ? (
          <button onClick={() => setShowCompleteForm(true)}
            className="w-full rounded-xl py-[12px] text-[17px] font-semibold text-white"
            style={{ background: '#34c759' }}>
            ✓ Marquer comme fait
          </button>
        ) : (
          <div className="rounded-xl p-4 space-y-3" style={{ background: '#f0f2f8' }}>
            <p className="text-[15px] font-semibold text-[#1c1c1e]">Compléter la tâche</p>
            <div>
              <label className="text-[13px] text-[#8e8e93] block mb-1">Temps passé (minutes) — optionnel</label>
              <input type="number" min={0} max={999} value={completeDuration}
                onChange={(e) => setCompleteDuration(e.target.value)}
                className="w-full rounded-lg bg-white px-3 py-2.5 text-[17px] text-[#1c1c1e] outline-none"
                placeholder="Ex : 30" />
            </div>
            <div>
              <label className="text-[13px] text-[#8e8e93] block mb-1">Note — optionnel</label>
              <input type="text" value={completeNote}
                onChange={(e) => setCompleteNote(e.target.value)}
                className="w-full rounded-lg bg-white px-3 py-2.5 text-[17px] text-[#1c1c1e] outline-none"
                placeholder="Ex : Fait avec Barbara" />
            </div>
            <div className="flex gap-2">
              <button onClick={handleComplete} disabled={completing}
                className="flex-1 rounded-xl py-[10px] text-[15px] font-semibold text-white disabled:opacity-50"
                style={{ background: '#34c759' }}>
                {completing ? 'En cours...' : '✓ Valider'}
              </button>
              <button onClick={() => setShowCompleteForm(false)}
                className="rounded-xl px-4 py-[10px] text-[15px] text-[#8e8e93] bg-white">
                Passer
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bouton échange */}
      {task.assigned_to && (
        <div className="mx-4">
          <Link href={`/exchanges?offer=${task.id}`}
            className="flex items-center justify-center gap-2 w-full rounded-xl bg-white py-3 text-[15px] font-medium"
            style={{ color: '#007aff', boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24">
              <path d="M7 16l-4-4m0 0l4-4m-4 4h18M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
            Proposer un échange
          </Link>
        </div>
      )}

      {/* Historique */}
      <div className="mx-4">
        <p className="text-[13px] font-semibold text-[#8e8e93] uppercase tracking-wide mb-2 px-1">Historique</p>
        <div className="rounded-xl bg-white overflow-hidden" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
          {loadingHistory ? (
            <div className="flex justify-center py-6">
              <div className="h-6 w-6 animate-spin rounded-full border-[3px] border-[#e5e5ea] border-t-[#007aff]" />
            </div>
          ) : completions.length === 0 ? (
            <p className="text-[15px] text-[#8e8e93] text-center py-6">Aucune complétion</p>
          ) : (
            completions.map((c, i) => (
              <div key={c.id} className="flex items-center justify-between px-4 py-3"
                style={i < completions.length - 1 ? { borderBottom: '0.5px solid var(--ios-separator)' } : {}}>
                <div className="flex items-center gap-2">
                  <span className="text-[14px]" style={{ color: '#34c759' }}>✓</span>
                  <span className="text-[15px] text-[#1c1c1e]">
                    {new Date(c.completed_at).toLocaleDateString('fr-FR', { dateStyle: 'medium' })}
                  </span>
                </div>
                {c.duration_minutes != null && (
                  <span className="text-[13px] text-[#8e8e93]">{c.duration_minutes} min</span>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Archiver + Supprimer */}
      <div className="mx-4 pb-8 space-y-2">
        <button onClick={handleArchive} disabled={archiving}
          className="w-full rounded-xl bg-white py-3 text-[15px] font-medium disabled:opacity-50"
          style={{ color: '#ff9500', boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
          {archiving ? 'Archivage...' : '📁 Archiver (garder en historique)'}
        </button>
        <button onClick={async () => {
          if (!confirm('Supprimer définitivement cette tâche et tout son historique ? Cette action est irréversible.')) return;
          const result = await deleteTask(task.id);
          if (result.ok) router.push('/tasks');
        }}
          className="w-full rounded-xl bg-white py-3 text-[15px] font-medium"
          style={{ color: '#ff3b30', boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
          🗑️ Supprimer définitivement
        </button>
      </div>
    </div>
  );
}
