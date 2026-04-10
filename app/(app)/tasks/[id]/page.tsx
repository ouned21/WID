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

  useEffect(() => {
    if (id) {
      setLoadingHistory(true);
      fetchTaskDetail(id).then((data) => {
        setCompletions(data);
        setLoadingHistory(false);
      });
    }
  }, [id, fetchTaskDetail]);

  useEffect(() => {
    if (task) {
      setEditName(task.name);
      setEditFrequency(task.frequency);
      setEditScore(task.mental_load_score);
      setEditAssignedTo(task.assigned_to ?? '');
    }
  }, [task]);

  if (!task) {
    return (
      <div className="space-y-4">
        <button onClick={() => router.back()} className="text-sm text-indigo-600 font-medium hover:underline">
          ← Retour
        </button>
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-12 text-center">
          <p className="text-lg font-semibold text-slate-400">Tâche introuvable</p>
        </div>
      </div>
    );
  }

  const handleComplete = async () => {
    if (completing) return;
    await completeTask(task.id);
    const data = await fetchTaskDetail(task.id);
    setCompletions(data);
  };

  const handleSaveEdit = async () => {
    const result = await updateTask(task.id, {
      name: editName.trim(),
      frequency: editFrequency,
      mental_load_score: editScore,
      assigned_to: editAssignedTo || null,
    });
    if (result.ok) setEditing(false);
  };

  const handleArchive = async () => {
    if (!confirm('Archiver cette tâche ? Elle ne sera plus visible dans la liste.')) return;
    const result = await archiveTask(task.id);
    if (result.ok) router.push('/tasks');
  };

  const categoryColor = task.category?.color_hex ?? '#94a3b8';

  return (
    <div className="space-y-6">
      <button onClick={() => router.back()} className="text-sm text-indigo-600 font-medium hover:underline">
        ← Retour aux tâches
      </button>

      {/* En-tête */}
      <div className="rounded-2xl border-l-4 bg-white p-6 shadow-sm" style={{ borderLeftColor: categoryColor }}>
        {!editing ? (
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">{task.name}</h2>
                <span
                  className="mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
                  style={{ backgroundColor: categoryColor }}
                >
                  {task.category?.name}
                </span>
              </div>
              <div className={`flex h-14 w-14 flex-col items-center justify-center rounded-full ${
                task.mental_load_score >= 7 ? 'bg-red-100 text-red-700' :
                task.mental_load_score >= 4 ? 'bg-amber-100 text-amber-700' :
                'bg-emerald-100 text-emerald-700'
              }`}>
                <span className="text-lg font-bold leading-none">{task.mental_load_score}</span>
                <span className="text-[9px]">/10</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs text-slate-400">Fréquence</p>
                <p className="font-semibold text-slate-900">{frequencyLabel(task.frequency)}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs text-slate-400">Assignée à</p>
                <p className="font-semibold text-slate-900">{task.assignee?.display_name ?? 'Non assigné'}</p>
              </div>
              {task.next_due_at && (
                <div className="rounded-xl bg-slate-50 p-3 col-span-2">
                  <p className="text-xs text-slate-400">Prochaine échéance</p>
                  <p className="font-semibold text-slate-900">
                    {new Date(task.next_due_at).toLocaleDateString('fr-FR', { dateStyle: 'full' })}
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleComplete}
                disabled={completing}
                className="flex-1 rounded-xl bg-emerald-500 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50 transition-colors"
              >
                {completing ? 'En cours...' : '✓ Marquer comme fait'}
              </button>
              <button
                onClick={() => setEditing(true)}
                className="rounded-xl bg-slate-100 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-200 transition-colors"
              >
                Modifier
              </button>
            </div>
          </div>
        ) : (
          /* Formulaire d'édition */
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Modifier la tâche</h3>

            <div>
              <label className="block text-sm font-medium text-slate-700">Nom</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Fréquence</label>
              <select
                value={editFrequency}
                onChange={(e) => setEditFrequency(e.target.value as Frequency)}
                className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              >
                {FREQUENCY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Charge mentale : <span className="font-bold text-indigo-600">{editScore}/10</span>
              </label>
              <input
                type="range"
                min={0}
                max={10}
                value={editScore}
                onChange={(e) => setEditScore(Number(e.target.value))}
                className="mt-2 w-full accent-indigo-600"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Assigner à</label>
              <select
                value={editAssignedTo}
                onChange={(e) => setEditAssignedTo(e.target.value)}
                className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">Non assigné</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.display_name}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleSaveEdit}
                disabled={updating}
                className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {updating ? 'Enregistrement...' : 'Enregistrer'}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="rounded-xl bg-slate-100 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-200"
              >
                Annuler
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Historique des complétions */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">
          Historique
        </h3>
        {loadingHistory ? (
          <div className="flex justify-center py-4">
            <div className="h-6 w-6 animate-spin rounded-full border-3 border-indigo-200 border-t-indigo-600" />
          </div>
        ) : completions.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">Aucune complétion enregistrée.</p>
        ) : (
          <div className="space-y-2">
            {completions.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-xl bg-emerald-50 px-4 py-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-emerald-500">✓</span>
                  <span className="font-medium text-slate-700">
                    {new Date(c.completed_at).toLocaleDateString('fr-FR', { dateStyle: 'medium' })}
                  </span>
                </div>
                {c.duration_minutes != null && (
                  <span className="text-xs text-slate-400">{c.duration_minutes} min</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Archiver */}
      <button
        onClick={handleArchive}
        disabled={archiving}
        className="w-full rounded-xl border border-red-200 bg-red-50 py-3 text-sm font-semibold text-red-600 hover:bg-red-100 disabled:opacity-50 transition-colors"
      >
        {archiving ? 'Archivage...' : 'Archiver cette tâche'}
      </button>
    </div>
  );
}
