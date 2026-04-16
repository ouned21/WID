'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useTaskStore } from '@/stores/taskStore';
import { useHouseholdStore } from '@/stores/householdStore';
import { useExchangeStore } from '@/stores/exchangeStore';

export default function ExchangesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profile } = useAuthStore();
  const { tasks } = useTaskStore();
  const { allMembers } = useHouseholdStore();
  const { exchanges, loading, fetchExchanges, proposeExchange, respondToExchange } = useExchangeStore();

  // Pré-remplir depuis les paramètres URL
  const prefilledTaskId = searchParams.get('task');
  const prefilledToId = searchParams.get('to');

  const [showForm, setShowForm] = useState(!!prefilledTaskId);
  const [toUserId, setToUserId] = useState(prefilledToId ?? '');
  const [taskId, setTaskId] = useState(prefilledTaskId ?? '');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (profile?.household_id) fetchExchanges(profile.household_id);
  }, [profile?.household_id, fetchExchanges]);

  // Exclure les fantômes des échanges (ils ne peuvent pas répondre)
  const otherMembers = allMembers.filter((m) => m.id !== profile?.id && !m.isPhantom);
  // Seules les tâches variables (non fixées) sont échangeables
  const myTasks = tasks.filter((t) => t.assigned_to === profile?.id && !t.is_fixed_assignment);

  const pendingForMe = exchanges.filter((e) => e.proposed_to === profile?.id);
  const pendingByMe = exchanges.filter((e) => e.proposed_by === profile?.id);

  const handlePropose = async () => {
    if (!profile?.household_id || !toUserId || !taskId) {
      setError('Remplissez tous les champs.'); return;
    }
    setSubmitting(true); setError(null);
    const result = await proposeExchange(profile.household_id, {
      proposed_to: toUserId,
      task_id: taskId,
      message: message.trim() || undefined,
    });
    setSubmitting(false);
    if (result.ok) {
      setShowForm(false);
      setToUserId('');
      setTaskId('');
      setMessage('');
    } else {
      setError(result.error ?? 'Erreur.');
    }
  };

  const handleRespond = async (exchangeId: string, action: 'accepted' | 'refused') => {
    const result = await respondToExchange(exchangeId, action);
    if (!result.ok) setError(result.error ?? 'Erreur lors de la réponse.');
  };

  return (
    <div className="pt-4 space-y-5">
      <div className="flex items-center justify-between px-4">
        <h2 className="text-[28px] font-bold text-[#1c1c1e]">Échanges</h2>
        <button onClick={() => setShowForm(!showForm)}
          className="rounded-full px-4 py-2 text-[15px] font-semibold text-white"
          style={{ background: '#007aff' }}>
          + Proposer
        </button>
      </div>

      {/* Formulaire de proposition */}
      {showForm && (
        <div className="mx-4 rounded-xl bg-white p-4 space-y-3" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
          <p className="text-[15px] font-semibold text-[#1c1c1e]">Proposer un échange</p>

          {error && <p className="text-[14px]" style={{ color: '#ff3b30' }}>{error}</p>}

          <div>
            <label className="text-[13px] text-[#8e8e93] block mb-1">Proposer à</label>
            <select value={toUserId} onChange={(e) => setToUserId(e.target.value)}
              className="w-full rounded-lg bg-[#f0f2f8] px-3 py-2.5 text-[15px] text-[#1c1c1e] outline-none">
              <option value="">Choisir un membre</option>
              {otherMembers.map((m) => <option key={m.id} value={m.id}>{m.display_name}</option>)}
            </select>
          </div>

          <div>
            <label className="text-[13px] text-[#8e8e93] block mb-1">Tâche à céder</label>
            <select value={taskId} onChange={(e) => setTaskId(e.target.value)}
              className="w-full rounded-lg bg-[#f0f2f8] px-3 py-2.5 text-[15px] text-[#1c1c1e] outline-none">
              <option value="">Choisir une de mes tâches</option>
              {myTasks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>

          <div>
            <label className="text-[13px] text-[#8e8e93] block mb-1">Message (optionnel)</label>
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Ex : Je suis débordé cette semaine..."
              className="w-full rounded-lg bg-[#f0f2f8] px-3 py-2.5 text-[15px] text-[#1c1c1e] outline-none placeholder:text-[#c7c7cc]"
            />
          </div>

          <div className="flex gap-2">
            <button onClick={handlePropose} disabled={submitting}
              className="flex-1 rounded-xl py-[10px] text-[15px] font-semibold text-white disabled:opacity-50"
              style={{ background: '#007aff' }}>
              {submitting ? 'Envoi...' : 'Envoyer la proposition'}
            </button>
            <button onClick={() => setShowForm(false)}
              className="rounded-xl px-4 py-[10px] text-[15px] text-[#8e8e93] bg-[#f0f2f8]">
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Propositions reçues */}
      {pendingForMe.length > 0 && (
        <div className="mx-4">
          <p className="text-[13px] font-semibold text-[#8e8e93] uppercase tracking-wide mb-2 px-1">Propositions reçues</p>
          <div className="rounded-xl bg-white overflow-hidden" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
            {pendingForMe.map((ex, i) => (
              <div key={ex.id} className="px-4 py-3 space-y-2"
                style={i < pendingForMe.length - 1 ? { borderBottom: '0.5px solid var(--ios-separator)' } : {}}>
                <p className="text-[15px] text-[#1c1c1e]">
                  <strong>{ex.proposer?.display_name}</strong> vous propose de prendre sa tâche
                </p>
                {ex.task && (
                  <div className="flex items-center gap-2 text-[14px]">
                    <span className="rounded-lg px-2 py-1 bg-[#f0f4ff] text-[#007aff] font-medium">{ex.task.name}</span>
                  </div>
                )}
                {ex.message && (
                  <p className="text-[13px] text-[#8e8e93] italic">&laquo; {ex.message} &raquo;</p>
                )}
                <div className="flex gap-2">
                  <button onClick={() => handleRespond(ex.id, 'accepted')}
                    className="flex-1 rounded-lg py-[8px] text-[14px] font-semibold text-white" style={{ background: '#34c759' }}>
                    Accepter
                  </button>
                  <button onClick={() => handleRespond(ex.id, 'refused')}
                    className="flex-1 rounded-lg py-[8px] text-[14px] font-semibold" style={{ color: '#ff3b30', background: '#fff2f2' }}>
                    Refuser
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Propositions envoyées */}
      {pendingByMe.length > 0 && (
        <div className="mx-4">
          <p className="text-[13px] font-semibold text-[#8e8e93] uppercase tracking-wide mb-2 px-1">Mes propositions en attente</p>
          <div className="rounded-xl bg-white overflow-hidden" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
            {pendingByMe.map((ex, i) => (
              <div key={ex.id} className="px-4 py-3"
                style={i < pendingByMe.length - 1 ? { borderBottom: '0.5px solid var(--ios-separator)' } : {}}>
                <p className="text-[15px] text-[#1c1c1e]">
                  Proposition à <strong>{ex.recipient?.display_name}</strong>
                </p>
                {ex.task && (
                  <p className="text-[14px] text-[#8e8e93] mt-1">{ex.task.name}</p>
                )}
                <span className="text-[12px] text-[#ff9500] font-medium">En attente</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chargement */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#e5e5ea] border-t-[#007aff]" />
        </div>
      )}

      {/* État vide */}
      {!loading && exchanges.length === 0 && !showForm && (
        <div className="mx-4 rounded-2xl bg-white p-10 text-center" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
          <p className="text-[40px] mb-2">🤝</p>
          <p className="text-[17px] font-semibold text-[#1c1c1e]">Aucun échange en cours</p>
          <p className="text-[15px] text-[#8e8e93] mt-1">Proposez de céder une tâche à un membre de votre foyer</p>
        </div>
      )}
    </div>
  );
}
