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
  const { members } = useHouseholdStore();
  const { exchanges, loading, fetchExchanges, proposeExchange, respondToExchange } = useExchangeStore();

  // Pré-remplir si on vient de la page détail d'une tâche (?offer=taskId)
  const prefilledOfferId = searchParams.get('offer');

  const [showForm, setShowForm] = useState(!!prefilledOfferId);
  const [toUserId, setToUserId] = useState('');
  const [offeredTaskId, setOfferedTaskId] = useState(prefilledOfferId ?? '');
  const [requestedTaskId, setRequestedTaskId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (profile?.household_id) fetchExchanges(profile.household_id);
  }, [profile?.household_id, fetchExchanges]);

  const otherMembers = members.filter((m) => m.id !== profile?.id);
  const myTasks = tasks.filter((t) => t.assigned_to === profile?.id);
  const otherTasks = tasks.filter((t) => t.assigned_to === toUserId);
  const prefilledTask = offeredTaskId ? tasks.find((t) => t.id === offeredTaskId) : null;

  const pendingForMe = exchanges.filter((e) => e.to_user_id === profile?.id);
  const pendingByMe = exchanges.filter((e) => e.from_user_id === profile?.id);

  const handlePropose = async () => {
    if (!profile?.household_id || !toUserId || !offeredTaskId || !requestedTaskId) {
      setError('Remplissez tous les champs.'); return;
    }
    setSubmitting(true); setError(null);
    const result = await proposeExchange(profile.household_id, {
      to_user_id: toUserId, offered_task_id: offeredTaskId, requested_task_id: requestedTaskId,
    });
    setSubmitting(false);
    if (result.ok) { setShowForm(false); setToUserId(''); setOfferedTaskId(''); setRequestedTaskId(''); }
    else setError(result.error ?? 'Erreur.');
  };

  const handleRespond = async (exchangeId: string, action: 'accepted' | 'rejected') => {
    await respondToExchange(exchangeId, action);
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
            <label className="text-[13px] text-[#8e8e93] block mb-1">Échanger avec</label>
            <select value={toUserId} onChange={(e) => { setToUserId(e.target.value); setRequestedTaskId(''); }}
              className="w-full rounded-lg bg-[#f2f2f7] px-3 py-2.5 text-[15px] text-[#1c1c1e] outline-none">
              <option value="">Choisir un membre</option>
              {otherMembers.map((m) => <option key={m.id} value={m.id}>{m.display_name}</option>)}
            </select>
          </div>

          <div>
            <label className="text-[13px] text-[#8e8e93] block mb-1">Je donne</label>
            {prefilledTask ? (
              <div className="flex items-center justify-between rounded-lg px-3 py-2.5" style={{ background: '#f0f4ff' }}>
                <span className="text-[15px] font-medium" style={{ color: '#007aff' }}>{prefilledTask.name}</span>
                <button onClick={() => setOfferedTaskId('')} className="text-[13px] text-[#8e8e93]">Changer</button>
              </div>
            ) : (
              <select value={offeredTaskId} onChange={(e) => setOfferedTaskId(e.target.value)}
                className="w-full rounded-lg bg-[#f2f2f7] px-3 py-2.5 text-[15px] text-[#1c1c1e] outline-none">
                <option value="">Choisir une de mes tâches</option>
                {myTasks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            )}
          </div>

          <div>
            <label className="text-[13px] text-[#8e8e93] block mb-1">Je veux</label>
            <select value={requestedTaskId} onChange={(e) => setRequestedTaskId(e.target.value)}
              className="w-full rounded-lg bg-[#f2f2f7] px-3 py-2.5 text-[15px] text-[#1c1c1e] outline-none"
              disabled={!toUserId}>
              <option value="">Choisir une tâche de l&apos;autre</option>
              {otherTasks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>

          <div className="flex gap-2">
            <button onClick={handlePropose} disabled={submitting}
              className="flex-1 rounded-xl py-[10px] text-[15px] font-semibold text-white disabled:opacity-50"
              style={{ background: '#007aff' }}>
              {submitting ? 'Envoi...' : 'Envoyer la proposition'}
            </button>
            <button onClick={() => setShowForm(false)}
              className="rounded-xl px-4 py-[10px] text-[15px] text-[#8e8e93] bg-[#f2f2f7]">
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
                  <strong>{ex.from_user?.display_name}</strong> vous propose d&apos;échanger
                </p>
                <div className="flex items-center gap-2 text-[14px]">
                  <span className="rounded-lg px-2 py-1 bg-[#fff2f2] text-[#ff3b30] font-medium">{ex.offered_task?.name}</span>
                  <span className="text-[#8e8e93]">↔</span>
                  <span className="rounded-lg px-2 py-1 bg-[#f0f4ff] text-[#007aff] font-medium">{ex.requested_task?.name}</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleRespond(ex.id, 'accepted')}
                    className="flex-1 rounded-lg py-[8px] text-[14px] font-semibold text-white" style={{ background: '#34c759' }}>
                    Accepter
                  </button>
                  <button onClick={() => handleRespond(ex.id, 'rejected')}
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
                  Proposition à <strong>{ex.to_user?.display_name}</strong>
                </p>
                <div className="flex items-center gap-2 mt-1 text-[14px]">
                  <span className="text-[#8e8e93]">{ex.offered_task?.name}</span>
                  <span className="text-[#c7c7cc]">↔</span>
                  <span className="text-[#8e8e93]">{ex.requested_task?.name}</span>
                </div>
                <span className="text-[12px] text-[#ff9500] font-medium">En attente</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* État vide */}
      {!loading && exchanges.length === 0 && !showForm && (
        <div className="mx-4 rounded-2xl bg-white p-10 text-center" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
          <p className="text-[40px] mb-2">🤝</p>
          <p className="text-[17px] font-semibold text-[#1c1c1e]">Aucun échange en cours</p>
          <p className="text-[15px] text-[#8e8e93] mt-1">Proposez un deal à un membre de votre foyer</p>
        </div>
      )}
    </div>
  );
}
