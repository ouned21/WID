'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import BackButton from '@/components/BackButton';
import { createClient } from '@/lib/supabase';

type CompletionEntry = {
  id: string;
  completed_at: string;
  duration_minutes: number | null;
  note: string | null;
  task: { id: string; name: string; category: { name: string; color_hex: string } | null } | null;
  completer: { display_name: string } | null;
};

export default function ArchivedTasksPage() {
  const { profile } = useAuthStore();
  const [completions, setCompletions] = useState<CompletionEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.household_id) return;
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from('task_completions')
        .select(`
          id, completed_at, duration_minutes, note,
          task:household_tasks(id, name, category:task_categories(name, color_hex)),
          completer:profiles(display_name)
        `)
        .eq('household_id', profile?.household_id ?? '')
        .order('completed_at', { ascending: false })
        .limit(100);

      setCompletions((data ?? []) as unknown as CompletionEntry[]);
      setLoading(false);
    }
    load();
  }, [profile?.household_id]);

  return (
    <div className="pt-4 space-y-4 pb-8">
      <div className="flex items-center justify-between px-4">
        <BackButton />
        <h2 className="text-[17px] font-semibold text-[#1c1c1e]">Historique</h2>
        <div className="w-16" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#e5e5ea] border-t-[#007aff]" />
        </div>
      ) : completions.length === 0 ? (
        <div className="mx-4 rounded-2xl bg-white p-10 text-center" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
          <p className="text-[40px] mb-2">📋</p>
          <p className="text-[17px] font-semibold text-[#1c1c1e]">Aucune tâche complétée</p>
          <p className="text-[15px] text-[#8e8e93] mt-1">Les tâches validées apparaîtront ici</p>
        </div>
      ) : (
        <div className="mx-4 rounded-xl bg-white overflow-hidden" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
          {completions.map((c, i) => {
            const catColor = c.task?.category?.color_hex ?? '#8e8e93';
            return (
              <div key={c.id}
                className="flex items-center gap-3 px-4 py-3"
                style={i < completions.length - 1 ? { borderBottom: '0.5px solid var(--ios-separator)' } : {}}>
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: catColor }} />
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-medium text-[#1c1c1e] truncate">{c.task?.name ?? '—'}</p>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <span className="text-[12px] text-[#8e8e93]">
                      {new Date(c.completed_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                    {c.completer && (
                      <>
                        <span className="text-[12px] text-[#c7c7cc]">·</span>
                        <span className="text-[12px] text-[#8e8e93]">{c.completer.display_name}</span>
                      </>
                    )}
                    {c.duration_minutes && (
                      <>
                        <span className="text-[12px] text-[#c7c7cc]">·</span>
                        <span className="text-[12px] text-[#8e8e93]">{c.duration_minutes} min</span>
                      </>
                    )}
                  </div>
                  {c.note && <p className="text-[12px] text-[#8e8e93] italic mt-0.5">{c.note}</p>}
                </div>
                <span className="text-[16px]" style={{ color: '#34c759' }}>✓</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
