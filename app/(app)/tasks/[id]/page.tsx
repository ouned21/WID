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

  // Historique des completions
  const [completions, setCompletions] = useState<TaskCompletion[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Mode edition
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editFrequency, setEditFrequency] = useState<Frequency>('weekly');
  const [editScore, setEditScore] = useState(3);
  const [editAssignedTo, setEditAssignedTo] = useState('');

  // Charger l'historique
  useEffect(() => {
    if (id) {
      setLoadingHistory(true);
      fetchTaskDetail(id).then((data) => {
        setCompletions(data);
        setLoadingHistory(false);
      });
    }
  }, [id, fetchTaskDetail]);

  // Pre-remplir le formulaire d'edition
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
        <button onClick={() => router.back()} className="text-sm text-slate-500 hover:text-slate-700">
          ← Retour
        </button>
        <p className="text-sm text-slate-500">Tâche introuvable.</p>
      </div>
    );
  }

  const handleComplete = async () => {
    if (completing) return;
    await completeTask(task.id);
    // Recharger l'historique
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

  return (
    <div className="space-y-6">
      <button onClick={() => router.back()} className="text-sm text-slate-500 hover:text-slate-700">
        ← Retour aux tâches
      </button>

      {/* En-tete */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        {!editing ? (
          <>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block h-3 w-3 rounded-full"
                    style={{ backgroundColor: task.category?.color_hex ?? '#94a3b8' }}
                  />
                  <h2 className="text-xl font-bold text-slate-900">{task.name}</h2>
                </div>
                <p className="mt-1 text-sm text-slate-500">{task.category?.name}</p>
              </div>
              <span className={`text-2xl font-bold ${
                task.mental_load_score >= 7 ? 'text-red-600' :
                task.mental_load_score >= 4 ? 'text-amber-600' :
                'text-green-600'
              }`}>
                {task.mental_load_score}/10
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-slate-400">Fréquence</p>
                <p className="font-medium text-slate-900">{frequencyLabel(task.frequency)}</p>
              </div>
              <div>
                <p className="text-slate-400">Assignée à</p>
                <p className="font-medium text-slate-900">{task.assignee?.display_name ?? 'Non assigné'}</p>
              </div>
              {task.next_due_at && (
                <div>
                  <p className="text-slate-400">Prochaine échéance</p>
                  <p className="font-medium text-slate-900">
                    {new Date(task.next_due_at).toLocaleDateString('fr-FR', { dateStyle: 'medium' })}
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleComplete}
                disabled={completing}
                className="flex-1 rounded-lg bg-slate-900 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {completing ? 'En cours...' : 'Marquer comme fait'}
              </button>
              <button
                onClick={() => setEditing(true)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Modifier
              </button>
            </div>
          </>
        ) : (
          /* Formulaire d'edition */
          <div className="space-y-4">
            <h3 className="font-semibold text-slate-900">Modifier la tâche</h3>

            <div>
              <label className="block text-sm font-medium text-slate-700">Nom</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Fréquence</label>
              <select
                value={editFrequency}
                onChange={(e) => setEditFrequency(e.target.value as Frequency)}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                {FREQUENCY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Charge mentale : {editScore}/10
              </label>
              <input
                type="range"
                min={0}
                max={10}
                value={editScore}
                onChange={(e) => setEditScore(Number(e.target.value))}
                className="mt-1 w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Assigner a</label>
              <select
                value={editAssignedTo}
                onChange={(e) => setEditAssignedTo(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
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
                className="flex-1 rounded-lg bg-slate-900 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {updating ? 'Enregistrement...' : 'Enregistrer'}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600"
              >
                Annuler
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Historique des completions */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
          Historique
        </h3>
        {loadingHistory ? (
          <p className="text-sm text-slate-400">Chargement...</p>
        ) : completions.length === 0 ? (
          <p className="text-sm text-slate-400">Aucune complétion enregistrée.</p>
        ) : (
          <div className="space-y-2">
            {completions.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <span className="text-slate-700">
                  {new Date(c.completed_at).toLocaleDateString('fr-FR', { dateStyle: 'medium' })}
                </span>
                {c.duration_minutes != null && (
                  <span className="text-slate-400">{c.duration_minutes} min</span>
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
        className="w-full rounded-lg border border-red-200 bg-red-50 py-2.5 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
      >
        {archiving ? 'Archivage...' : 'Archiver cette tache'}
      </button>
    </div>
  );
}
