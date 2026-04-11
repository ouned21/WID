'use client';

import { useEffect, useState } from 'react';
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
  const { tasks, completeTask, updateTask, archiveTask, deleteTask, fetchTaskDetail, completing, updating, archiving } = useTaskStore();
  const { members } = useHouseholdStore();
  const task = tasks.find((t) => t.id === id);

  const [completions, setCompletions] = useState<TaskCompletion[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Champs editables inline — null = pas en edition
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [editScore, setEditScore] = useState(0);

  // Completion
  const [showCompleteForm, setShowCompleteForm] = useState(false);
  const [completeDuration, setCompleteDuration] = useState<string>('');
  const [completeNote, setCompleteNote] = useState('');

  useEffect(() => {
    if (id) { setLoadingHistory(true); fetchTaskDetail(id).then((data) => { setCompletions(data); setLoadingHistory(false); }); }
  }, [id, fetchTaskDetail]);

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

  const [saving, setSaving] = useState(false);
  const handleSaveField = async (field: string, value: unknown) => {
    setSaving(true);
    await updateTask(task.id, { [field]: value });
    setSaving(false);
    setEditingField(null);
  };

  const handleArchive = async () => {
    if (!confirm('Archiver cette tâche ?')) return;
    await archiveTask(task.id);
    router.push('/tasks');
  };

  const catColor = task.category?.color_hex ?? '#8e8e93';
  const scoreColor = task.mental_load_score >= 4 ? '#ff3b30' : task.mental_load_score >= 3 ? '#ff9500' : '#34c759';

  const startEditName = () => { setEditingField('name'); setEditValue(task.name); };
  const startEditFrequency = () => { setEditingField('frequency'); setEditValue(task.frequency); };
  const startEditAssignee = () => { setEditingField('assigned_to'); setEditValue(task.assigned_to ?? ''); };
  const startEditScore = () => { setEditingField('mental_load_score'); setEditScore(task.mental_load_score); };

  return (
    <div className="pt-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between px-4">
        <button onClick={() => router.back()} className="text-[17px] font-medium" style={{ color: '#007aff' }}>← Retour</button>
      </div>

      {/* Fiche tâche — champs cliquables */}
      <div className="mx-4 rounded-2xl bg-white overflow-hidden" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>

        {/* Nom */}
        <div className="px-4 py-3" style={{ borderBottom: '0.5px solid var(--ios-separator)' }}>
          {editingField === 'name' ? (
            <div className="flex items-center gap-2">
              <input type="text" value={editValue} onChange={(e) => setEditValue(e.target.value)} autoFocus
                className="flex-1 text-[20px] font-bold text-[#1c1c1e] bg-transparent outline-none" />
              <button onClick={() => handleSaveField('name', editValue.trim())}
                className="text-[15px] font-semibold" style={{ color: '#007aff' }}>{saving ? '...' : 'OK'}</button>
              <button onClick={() => setEditingField(null)} className="text-[15px] text-[#8e8e93]">✕</button>
            </div>
          ) : (
            <button onClick={startEditName} className="w-full text-left flex items-center justify-between">
              <h2 className="text-[20px] font-bold text-[#1c1c1e]">{task.name}</h2>
              <svg width="16" height="16" fill="none" stroke="#c7c7cc" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
          )}
        </div>

        {/* Catégorie (lecture seule) + Score */}
        <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '0.5px solid var(--ios-separator)' }}>
          <span className="rounded-full px-2.5 py-0.5 text-[12px] font-semibold text-white" style={{ background: catColor }}>
            {task.category?.name}
          </span>
          {editingField === 'mental_load_score' ? (
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-bold" style={{ color: editScore >= 4 ? '#ff3b30' : editScore >= 3 ? '#ff9500' : '#34c759' }}>
                {editScore}/5
              </span>
              <input type="range" min={0} max={5} value={editScore} onChange={(e) => setEditScore(Number(e.target.value))}
                className="w-24" style={{ accentColor: editScore >= 4 ? '#ff3b30' : editScore >= 3 ? '#ff9500' : '#34c759' }} />
              <button onClick={() => handleSaveField('mental_load_score', editScore)}
                className="text-[13px] font-semibold" style={{ color: '#007aff' }}>{saving ? '...' : 'OK'}</button>
            </div>
          ) : (
            <button onClick={startEditScore} className="flex items-center gap-1.5">
              <span className="text-[11px] text-[#8e8e93]">Charge mentale</span>
              <span className="text-[20px] font-bold" style={{ color: scoreColor }}>{task.mental_load_score}</span>
              <span className="text-[11px] text-[#8e8e93]">/5</span>
            </button>
          )}
        </div>

        {/* Fréquence */}
        <div className="px-4 py-3" style={{ borderBottom: '0.5px solid var(--ios-separator)' }}>
          {editingField === 'frequency' ? (
            <div>
              <label className="text-[11px] text-[#8e8e93] uppercase">Fréquence</label>
              <div className="flex items-center gap-2 mt-1">
                <select value={editValue} onChange={(e) => setEditValue(e.target.value)}
                  className="flex-1 text-[17px] text-[#1c1c1e] bg-transparent outline-none">
                  {FREQUENCY_OPTIONS.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
                </select>
                <button onClick={() => handleSaveField('frequency', editValue)}
                  className="text-[15px] font-semibold" style={{ color: '#007aff' }}>{saving ? '...' : 'OK'}</button>
              </div>
            </div>
          ) : (
            <button onClick={startEditFrequency} className="w-full text-left flex items-center justify-between">
              <div>
                <p className="text-[11px] text-[#8e8e93] uppercase">Fréquence</p>
                <p className="text-[17px] font-medium text-[#1c1c1e]">{frequencyLabel(task.frequency)}</p>
              </div>
              <svg width="7" height="12" fill="none" stroke="#c7c7cc" strokeWidth="2" strokeLinecap="round" viewBox="0 0 7 12"><path d="M1 1l5 5-5 5" /></svg>
            </button>
          )}
        </div>

        {/* Assignée à */}
        <div className="px-4 py-3" style={{ borderBottom: '0.5px solid var(--ios-separator)' }}>
          {editingField === 'assigned_to' ? (
            <div>
              <label className="text-[11px] text-[#8e8e93] uppercase">Assignée à</label>
              <div className="flex items-center gap-2 mt-1">
                <select value={editValue} onChange={(e) => setEditValue(e.target.value)}
                  className="flex-1 text-[17px] text-[#1c1c1e] bg-transparent outline-none">
                  <option value="">Non assigné</option>
                  {members.map((m) => (<option key={m.id} value={m.id}>{m.display_name}</option>))}
                </select>
                <button onClick={() => handleSaveField('assigned_to', editValue || null)}
                  className="text-[15px] font-semibold" style={{ color: '#007aff' }}>{saving ? '...' : 'OK'}</button>
              </div>
            </div>
          ) : (
            <button onClick={startEditAssignee} className="w-full text-left flex items-center justify-between">
              <div>
                <p className="text-[11px] text-[#8e8e93] uppercase">Assignée à</p>
                <p className="text-[17px] font-medium text-[#1c1c1e]">{task.assignee?.display_name ?? 'Non assigné'}</p>
              </div>
              <svg width="7" height="12" fill="none" stroke="#c7c7cc" strokeWidth="2" strokeLinecap="round" viewBox="0 0 7 12"><path d="M1 1l5 5-5 5" /></svg>
            </button>
          )}
        </div>

        {/* Prochaine échéance — cliquable */}
        <div className="px-4 py-3">
          {editingField === 'next_due_at' ? (
            <div>
              <label className="text-[11px] text-[#8e8e93] uppercase">Prochaine échéance</label>
              <div className="flex items-center gap-2 mt-1">
                <input type="date" value={editValue.split('T')[0] || ''}
                  onChange={(e) => {
                    const time = editValue.split('T')[1] || '09:00';
                    setEditValue(`${e.target.value}T${time}`);
                  }}
                  className="flex-1 text-[17px] text-[#1c1c1e] bg-transparent outline-none" />
                <input type="time" value={editValue.split('T')[1]?.substring(0, 5) || '09:00'}
                  onChange={(e) => {
                    const date = editValue.split('T')[0] || new Date().toISOString().split('T')[0];
                    setEditValue(`${date}T${e.target.value}`);
                  }}
                  className="w-20 text-[17px] text-[#1c1c1e] bg-transparent outline-none" />
                <button onClick={() => {
                  const iso = new Date(`${editValue}:00`).toISOString();
                  handleSaveField('next_due_at', iso);
                }} className="text-[15px] font-semibold" style={{ color: '#007aff' }}>{saving ? '...' : 'OK'}</button>
              </div>
            </div>
          ) : (
            <button onClick={() => {
              if (task.next_due_at) {
                const d = new Date(task.next_due_at);
                const date = d.toISOString().split('T')[0];
                const time = d.toTimeString().substring(0, 5);
                setEditValue(`${date}T${time}`);
              } else {
                const now = new Date();
                const date = now.toISOString().split('T')[0];
                setEditValue(`${date}T09:00`);
              }
              setEditingField('next_due_at');
            }} className="w-full text-left flex items-center justify-between">
              <div>
                <p className="text-[11px] text-[#8e8e93] uppercase">Prochaine échéance</p>
                {task.next_due_at ? (
                  <p className="text-[17px] font-medium text-[#1c1c1e]">
                    {new Date(task.next_due_at).toLocaleDateString('fr-FR', { dateStyle: 'full' })}
                    {' · '}
                    {new Date(task.next_due_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                ) : (
                  <p className="text-[17px] text-[#c7c7cc]">Aucune — cliquez pour définir</p>
                )}
              </div>
              <svg width="7" height="12" fill="none" stroke="#c7c7cc" strokeWidth="2" strokeLinecap="round" viewBox="0 0 7 12"><path d="M1 1l5 5-5 5" /></svg>
            </button>
          )}
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
          <div className="rounded-xl p-4 space-y-3" style={{ background: '#f2f2f7' }}>
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
