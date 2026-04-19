'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useTaskStore } from '@/stores/taskStore';
import { useHouseholdStore } from '@/stores/householdStore';
import { createClient } from '@/lib/supabase';

type Assignment =
  | { userId: string; phantomId?: never }
  | { phantomId: string; userId?: never }
  | null;

export default function AssignTasksPage() {
  const router = useRouter();
  const { profile } = useAuthStore();
  const { tasks, fetchTasks } = useTaskStore();
  const { allMembers, fetchHousehold } = useHouseholdStore();

  // Assignments locaux (optimistic)
  const [assignments, setAssignments] = useState<Record<string, Assignment>>({});

  useEffect(() => {
    if (profile?.household_id) {
      fetchTasks(profile.household_id);
      fetchHousehold(profile.household_id);
    }
  }, [profile?.household_id, fetchTasks, fetchHousehold]);

  const unassigned = tasks.filter((t) => !t.assigned_to && !t.assigned_to_phantom_id);

  const assignTargets = [
    ...(profile?.id
      ? [{ id: profile.id, name: profile.display_name?.split(' ')[0] ?? 'Moi', isPhantom: false }]
      : []),
    ...allMembers
      .filter((m) => m.isPhantom)
      .map((m) => ({ id: m.id, name: m.display_name, isPhantom: true })),
  ];

  const assignTask = useCallback(async (taskId: string, assign: Assignment) => {
    setAssignments((prev) => ({ ...prev, [taskId]: assign }));
    const supabase = createClient();
    await supabase.from('household_tasks').update({
      assigned_to: assign && 'userId' in assign ? assign.userId : null,
      assigned_to_phantom_id: assign && 'phantomId' in assign ? assign.phantomId : null,
    }).eq('id', taskId);
    // Re-sync le store en arrière-plan
    if (profile?.household_id) fetchTasks(profile.household_id);
  }, [profile?.household_id, fetchTasks]);

  const assignedCount = Object.values(assignments).filter(Boolean).length;
  const total = unassigned.length;

  return (
    <div className="pt-4 pb-32">
      {/* En-tête */}
      <div className="px-4 mb-6">
        <button
          onClick={() => router.back()}
          className="text-[14px] font-semibold mb-4 block"
          style={{ color: '#007aff' }}
        >
          ← Retour
        </button>
        <h2 className="text-[26px] font-black text-[#1c1c1e] leading-tight">
          Assigner les tâches
        </h2>
        <p className="text-[14px] text-[#8e8e93] mt-1">
          {total === 0
            ? 'Toutes les tâches sont déjà assignées 🎉'
            : `${total} tâche${total > 1 ? 's' : ''} sans responsable`}
        </p>

        {/* Note reframing */}
        {total > 0 && assignTargets.length > 1 && (
          <div className="mt-3 rounded-xl px-3 py-2.5"
            style={{ background: '#f0f6ff', border: '1px solid #d0e4ff' }}>
            <p className="text-[12px] leading-relaxed" style={{ color: '#3a6fcc' }}>
              💡 <span className="font-semibold">Assigner ≠ faire seul·e.</span> Qui y penserait en premier si l&apos;autre n&apos;était pas là ?
            </p>
          </div>
        )}
      </div>

      {total === 0 ? (
        <div className="mx-4 rounded-3xl bg-white p-8 text-center"
          style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <p className="text-[48px] mb-3">✅</p>
          <p className="text-[17px] font-bold text-[#1c1c1e]">Tout est assigné !</p>
          <p className="text-[13px] text-[#8e8e93] mt-1">Le score de répartition est maintenant fiable.</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="mt-5 rounded-2xl px-6 py-3 text-[15px] font-bold text-white"
            style={{ background: '#007aff' }}
          >
            Voir le score →
          </button>
        </div>
      ) : (
        <div className="px-4">
          <div className="rounded-2xl bg-white overflow-hidden"
            style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            {unassigned.map((t, i) => {
              const current = assignments[t.id] ?? null;
              return (
                <div
                  key={t.id}
                  className="px-4 py-3"
                  style={i < unassigned.length - 1 ? { borderBottom: '0.5px solid #f0f2f8' } : {}}
                >
                  {/* Ligne 1 : nom + catégorie */}
                  <div className="flex items-center gap-3">
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: (t as { category?: { color_hex?: string } }).category?.color_hex ?? '#8e8e93' }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-medium text-[#1c1c1e] truncate">{t.name}</p>
                      {(t as { category?: { name?: string } }).category?.name && (
                        <p className="text-[11px] text-[#8e8e93] mt-0.5">
                          {(t as { category?: { name?: string } }).category?.name}
                        </p>
                      )}
                    </div>
                    {current && (
                      <span className="text-[11px] font-semibold flex-shrink-0" style={{ color: '#34c759' }}>
                        ✓
                      </span>
                    )}
                  </div>

                  {/* Ligne 2 : chips d'assignation */}
                  {assignTargets.length > 0 && (
                    <div className="flex items-center gap-1.5 mt-2 ml-5 flex-wrap">
                      {!current && (
                        <span className="text-[11px] font-semibold mr-0.5" style={{ color: '#c7c7cc' }}>
                          Assigner à →
                        </span>
                      )}

                      {assignTargets.map((target) => {
                        const isSelected = current
                          ? target.isPhantom
                            ? 'phantomId' in current && current.phantomId === target.id
                            : 'userId' in current && current.userId === target.id
                          : false;
                        const shortName = target.name.length > 9 ? target.name.slice(0, 8) + '…' : target.name;
                        return (
                          <button
                            key={target.id}
                            onClick={() =>
                              assignTask(t.id, isSelected ? null : target.isPhantom
                                ? { phantomId: target.id }
                                : { userId: target.id },
                              )
                            }
                            className="rounded-full px-3 py-1 text-[12px] font-bold transition-all active:scale-95"
                            style={isSelected ? {
                              background: '#007aff',
                              color: 'white',
                              boxShadow: '0 2px 8px rgba(0,122,255,0.3)',
                            } : {
                              background: 'white',
                              color: '#007aff',
                              border: '1.5px solid #007aff',
                            }}
                          >
                            {isSelected ? `✓ ${shortName}` : shortName}
                          </button>
                        );
                      })}

                      {current && (
                        <button
                          onClick={() => assignTask(t.id, null)}
                          className="rounded-full px-2 py-1 text-[11px] transition-all"
                          style={{ color: '#c7c7cc', border: '1px solid #e5e5ea', background: 'white' }}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Barre fixe en bas */}
      {total > 0 && (
        <div className="fixed bottom-0 left-0 right-0 px-4 pb-6 pt-3"
          style={{ background: 'linear-gradient(transparent, #f6f8ff 30%)' }}>
          {assignedCount > 0 && assignedCount < total && (
            <p className="text-center text-[12px] text-[#8e8e93] mb-2">
              {assignedCount} / {total} tâches assignées
            </p>
          )}
          {assignedCount === total && (
            <p className="text-center text-[12px] font-semibold mb-2" style={{ color: '#34c759' }}>
              ✅ Toutes les tâches sont assignées !
            </p>
          )}
          <button
            onClick={() => router.push('/dashboard')}
            className="w-full rounded-2xl py-[16px] text-[17px] font-bold text-white"
            style={{
              background: 'linear-gradient(135deg, #007aff, #5856d6)',
              boxShadow: '0 8px 24px rgba(0,122,255,0.3)',
            }}
          >
            {assignedCount === total ? 'Voir le score →' : `Continuer (${assignedCount}/${total}) →`}
          </button>
        </div>
      )}
    </div>
  );
}
