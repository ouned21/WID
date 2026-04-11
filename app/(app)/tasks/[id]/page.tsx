'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useTaskStore } from '@/stores/taskStore';
import { useHouseholdStore } from '@/stores/householdStore';
import { frequencyLabel, FREQUENCY_OPTIONS } from '@/utils/frequency';
import type { TaskCompletion, Frequency } from '@/types/database';

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuthStore();
  const { tasks, completeTask, updateTask, archiveTask, fetchTaskDetail, completing, updating, archiving } = useTaskStore();
  const { members } = useHouseholdStore();
  const task = tasks.find((t) => t.id === id);

  const [completions, setCompletions] = useState<TaskCompletion[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editFrequency, setEditFrequency] = useState<Frequency>('weekly');
  const [editScore, setEditScore] = useState(3);
  const [editAssignedTo, setEditAssignedTo] = useState('');

  // Completion avec duree optionnelle
  const [showCompleteForm, setShowCompleteForm] = useState(false);
  const [completeDuration, setCompleteDuration] = useState<string>('');
  const [completeNote, setCompleteNote] = useState('');

  useEffect(() => {
    if (id) { setLoadingHistory(true); fetchTaskDetail(id).then((data) => { setCompletions(data); setLoadingHistory(false); }); }
  }, [id, fetchTaskDetail]);

  useEffect(() => {
    if (task) { setEditName(task.name); setEditFrequency(task.frequency); setEditScore(task.mental_load_score); setEditAssignedTo(task.assigned_to ?? ''); }
  }, [task]);

  if (!task) {
    return (
      <div className="pt-4 px-4">
        <button onClick={() => router.back()} className="text-[17px] font-medium" style={{ color: '#007aff' }}>← Retour</button>
        <div className="mt-8 text-center">
          <p className="text-[17px] text-[#8e8e93]">Tâche introuvable</p>
        </div>
      </div>
    );
  }

  const handleComplete = async () => {
    if (completing) return;
    const duration = completeDuration ? parseInt(completeDuration, 10) : null;
    await completeTask(task.id, {
      duration_minutes: duration,
      note: completeNote || null,
    });
    setShowCompleteForm(false);
    setCompleteDuration('');
    setCompleteNote('');
    const data = await fetchTaskDetail(task.id);
    setCompletions(data);
  };

  const handleSaveEdit = async () => {
    const result = await updateTask(task.id, { name: editName.trim(), frequency: editFrequency, mental_load_score: editScore, assigned_to: editAssignedTo || null });
    if (result.ok) setEditing(false);
  };

  const handleArchive = async () => {
    if (!confirm('Archiver cette tâche ?')) return;
    const result = await archiveTask(task.id);
    if (result.ok) router.push('/tasks');
  };

  const catColor = task.category?.color_hex ?? '#8e8e93';
  const scoreColor = task.mental_load_score >= 7 ? '#ff3b30' : task.mental_load_score >= 4 ? '#ff9500' : '#34c759';
  const editScoreColor = editScore >= 7 ? '#ff3b30' : editScore >= 4 ? '#ff9500' : '#34c759';

  return (
    <div className="pt-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between px-4">
        <button onClick={() => router.back()} className="text-[17px] font-medium" style={{ color: '#007aff' }}>
          ← Retour
        </button>
        {!editing && (
          <button onClick={() => setEditing(true)} className="text-[17px] font-medium" style={{ color: '#007aff' }}>
            Modifier
          </button>
        )}
      </div>

      {!editing ? (
        <>
          {/* Fiche tâche */}
          <div className="mx-4 rounded-2xl bg-white p-5" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-[22px] font-bold text-[#1c1c1e]">{task.name}</h2>
                <span className="inline-block mt-1 rounded-full px-2.5 py-0.5 text-[12px] font-semibold text-white" style={{ background: catColor }}>
                  {task.category?.name}
                </span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-[28px] font-bold" style={{ color: scoreColor }}>{task.mental_load_score}</span>
                <span className="text-[11px] text-[#8e8e93]">/10</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl p-3" style={{ background: '#f2f2f7' }}>
                <p className="text-[11px] text-[#8e8e93] uppercase">Fréquence</p>
                <p className="text-[15px] font-semibold text-[#1c1c1e]">{frequencyLabel(task.frequency)}</p>
              </div>
              <div className="rounded-xl p-3" style={{ background: '#f2f2f7' }}>
                <p className="text-[11px] text-[#8e8e93] uppercase">Assignée à</p>
                <p className="text-[15px] font-semibold text-[#1c1c1e]">{task.assignee?.display_name ?? 'Non assigné'}</p>
              </div>
              {task.next_due_at && (
                <div className="rounded-xl p-3 col-span-2" style={{ background: '#f2f2f7' }}>
                  <p className="text-[11px] text-[#8e8e93] uppercase">Prochaine échéance</p>
                  <p className="text-[15px] font-semibold text-[#1c1c1e]">
                    {new Date(task.next_due_at).toLocaleDateString('fr-FR', { dateStyle: 'full' })}
                  </p>
                </div>
              )}
            </div>

            {!showCompleteForm ? (
              <button onClick={() => setShowCompleteForm(true)}
                className="w-full mt-4 rounded-xl py-[12px] text-[17px] font-semibold text-white"
                style={{ background: '#34c759' }}>
                ✓ Marquer comme fait
              </button>
            ) : (
              <div className="mt-4 rounded-xl p-4 space-y-3" style={{ background: '#f2f2f7' }}>
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

          {/* Archiver */}
          <div className="mx-4 pb-8">
            <button onClick={handleArchive} disabled={archiving}
              className="w-full rounded-xl bg-white py-3 text-[17px] font-medium disabled:opacity-50"
              style={{ color: '#ff3b30', boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
              {archiving ? 'Archivage...' : 'Archiver cette tâche'}
            </button>
          </div>
        </>
      ) : (
        /* Mode édition */
        <div className="mx-4 space-y-4">
          <div className="rounded-xl bg-white overflow-hidden" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
            <div className="px-4 py-3" style={{ borderBottom: '0.5px solid var(--ios-separator)' }}>
              <label className="text-[13px] text-[#8e8e93] block mb-1">Nom</label>
              <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
                className="w-full text-[17px] text-[#1c1c1e] bg-transparent outline-none" />
            </div>
            <div className="px-4 py-3" style={{ borderBottom: '0.5px solid var(--ios-separator)' }}>
              <label className="text-[13px] text-[#8e8e93] block mb-1">Fréquence</label>
              <select value={editFrequency} onChange={(e) => setEditFrequency(e.target.value as Frequency)}
                className="w-full text-[17px] text-[#1c1c1e] bg-transparent outline-none">
                {FREQUENCY_OPTIONS.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
              </select>
            </div>
            <div className="px-4 py-3" style={{ borderBottom: '0.5px solid var(--ios-separator)' }}>
              <label className="text-[13px] text-[#8e8e93] block mb-1">Assigner à</label>
              <select value={editAssignedTo} onChange={(e) => setEditAssignedTo(e.target.value)}
                className="w-full text-[17px] text-[#1c1c1e] bg-transparent outline-none">
                <option value="">Non assigné</option>
                {members.map((m) => (<option key={m.id} value={m.id}>{m.display_name}</option>))}
              </select>
            </div>
            <div className="px-4 py-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-[13px] text-[#8e8e93]">Charge mentale</label>
                <span className="text-[17px] font-bold" style={{ color: editScoreColor }}>{editScore}/10</span>
              </div>
              <input type="range" min={0} max={10} value={editScore} onChange={(e) => setEditScore(Number(e.target.value))}
                className="w-full" style={{ accentColor: editScoreColor }} />
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={handleSaveEdit} disabled={updating}
              className="flex-1 rounded-xl py-[12px] text-[17px] font-semibold text-white disabled:opacity-50"
              style={{ background: '#007aff' }}>
              {updating ? 'Enregistrement...' : 'Enregistrer'}
            </button>
            <button onClick={() => setEditing(false)}
              className="rounded-xl px-6 py-[12px] text-[17px] text-[#8e8e93] bg-white"
              style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
