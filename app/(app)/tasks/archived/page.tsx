'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { createClient } from '@/lib/supabase';
import { frequencyLabel } from '@/utils/frequency';
import type { HouseholdTask, TaskCategory } from '@/types/database';

type ArchivedTask = HouseholdTask & {
  category: TaskCategory | null;
};

export default function ArchivedTasksPage() {
  const router = useRouter();
  const { profile } = useAuthStore();
  const [tasks, setTasks] = useState<ArchivedTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.household_id) return;
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from('household_tasks')
        .select('*, category:task_categories(id, name, icon, color_hex, sort_order)')
        .eq('household_id', profile?.household_id ?? '')
        .eq('is_active', false)
        .order('created_at', { ascending: false });

      setTasks((data ?? []) as ArchivedTask[]);
      setLoading(false);
    }
    load();
  }, [profile?.household_id]);

  const [restoringId, setRestoringId] = useState<string | null>(null);
  const handleRestore = async (taskId: string) => {
    setRestoringId(taskId);
    const supabase = createClient();
    const { error } = await supabase.from('household_tasks').update({ is_active: true }).eq('id', taskId);
    if (!error) {
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    }
    setRestoringId(null);
  };

  return (
    <div className="pt-4 space-y-4">
      <div className="flex items-center justify-between px-4">
        <button onClick={() => router.back()} className="text-[17px] font-medium" style={{ color: '#007aff' }}>
          ← Retour
        </button>
        <h2 className="text-[17px] font-semibold text-[#1c1c1e]">Tâches archivées</h2>
        <div className="w-16" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#e5e5ea] border-t-[#007aff]" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="mx-4 rounded-2xl bg-white p-10 text-center" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
          <p className="text-[40px] mb-2">📁</p>
          <p className="text-[17px] font-semibold text-[#1c1c1e]">Aucune archive</p>
          <p className="text-[15px] text-[#8e8e93] mt-1">Les tâches archivées apparaîtront ici</p>
        </div>
      ) : (
        <div className="mx-4 rounded-xl bg-white overflow-hidden" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
          {tasks.map((task, i) => (
            <div key={task.id}
              className="flex items-center gap-3 px-4 py-3"
              style={i < tasks.length - 1 ? { borderBottom: '0.5px solid var(--ios-separator)' } : {}}>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-medium text-[#1c1c1e] truncate">{task.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {task.category && (
                    <span className="text-[12px] text-[#8e8e93]">{task.category.name}</span>
                  )}
                  <span className="text-[12px] text-[#c7c7cc]">·</span>
                  <span className="text-[12px] text-[#8e8e93]">{frequencyLabel(task.frequency)}</span>
                </div>
              </div>
              <button
                onClick={() => handleRestore(task.id)}
                disabled={restoringId === task.id}
                className="rounded-lg px-3 py-1.5 text-[13px] font-medium disabled:opacity-50"
                style={{ color: '#007aff', background: '#f2f2f7' }}>
                Restaurer
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
