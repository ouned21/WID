'use client';

import { taskLoad } from '@/utils/designSystem';

import { useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useTaskStore } from '@/stores/taskStore';
import { useHouseholdStore } from '@/stores/householdStore';
import { createClient } from '@/lib/supabase';

// Niveaux XP
const LEVELS = [
  { level: 1, name: 'Débutant', minXP: 0 },
  { level: 2, name: 'Initié', minXP: 50 },
  { level: 3, name: 'Régulier', minXP: 150 },
  { level: 4, name: 'Gestionnaire', minXP: 350 },
  { level: 5, name: 'Expert', minXP: 700 },
  { level: 6, name: 'Maître du foyer', minXP: 1200 },
  { level: 7, name: 'Légende', minXP: 2000 },
];

// Badges
const BADGES = [
  { id: 'first_task', name: 'Première tâche', icon: '⭐', desc: 'Compléter sa première tâche', check: (completions: number) => completions >= 1 },
  { id: 'ten_tasks', name: 'Décollage', icon: '🚀', desc: '10 tâches complétées', check: (completions: number) => completions >= 10 },
  { id: 'fifty_tasks', name: 'Machine', icon: '⚡', desc: '50 tâches complétées', check: (completions: number) => completions >= 50 },
  { id: 'hundred_tasks', name: 'Centurion', icon: '🏆', desc: '100 tâches complétées', check: (completions: number) => completions >= 100 },
  { id: 'week_streak', name: '7 jours', icon: '🔥', desc: 'Actif 7 jours de suite', check: (_: number, streak: number) => streak >= 7 },
  { id: 'month_streak', name: '30 jours', icon: '💎', desc: 'Actif 30 jours de suite', check: (_: number, streak: number) => streak >= 30 },
];

export default function BoostPage() {
  const { profile } = useAuthStore();
  const { tasks } = useTaskStore();
  const { members } = useHouseholdStore();

  const [totalCompletions, setTotalCompletions] = useState(0);
  const [streak, setStreak] = useState(0);
  const [todayDone, setTodayDone] = useState(0);

  // Charger stats de progression
  useEffect(() => {
    if (!profile?.household_id || !profile?.id) return;
    async function load() {
      const supabase = createClient();

      // Total completions
      const { count } = await supabase.from('task_completions')
        .select('id', { count: 'exact', head: true })
        .eq('completed_by', profile!.id);
      setTotalCompletions(count ?? 0);

      // Streak : compter les jours consécutifs avec au moins 1 complétion
      const { data: recentCompletions } = await supabase.from('task_completions')
        .select('completed_at')
        .eq('completed_by', profile!.id)
        .order('completed_at', { ascending: false })
        .limit(200);

      if (recentCompletions) {
        const days = new Set(recentCompletions.map((c) => c.completed_at.split('T')[0]));
        let s = 0;
        const today = new Date();
        for (let i = 0; i < 365; i++) {
          const d = new Date(today);
          d.setDate(d.getDate() - i);
          const key = d.toISOString().split('T')[0];
          if (days.has(key)) s++;
          else if (i > 0) break; // Premier jour sans complétion = fin de la série
        }
        setStreak(s);

        // Aujourd'hui
        const todayKey = today.toISOString().split('T')[0];
        setTodayDone(recentCompletions.filter((c) => c.completed_at.startsWith(todayKey)).length);
      }
    }
    load();
  }, [profile?.household_id, profile?.id]);

  // XP = 10 pts par complétion
  const xp = totalCompletions * 10;
  const currentLevel = [...LEVELS].reverse().find((l) => xp >= l.minXP) ?? LEVELS[0];
  const nextLevel = LEVELS.find((l) => l.minXP > xp);
  const xpToNext = nextLevel ? nextLevel.minXP - xp : 0;
  const xpProgress = nextLevel ? ((xp - currentLevel.minXP) / (nextLevel.minXP - currentLevel.minXP)) * 100 : 100;

  // Badges gagnés
  const earnedBadges = BADGES.filter((b) => b.check(totalCompletions, streak));
  const lockedBadges = BADGES.filter((b) => !b.check(totalCompletions, streak));

  // Leaderboard
  const leaderboard = useMemo(() => {
    return members.map((m) => {
      const mTasks = tasks.filter((t) => t.assigned_to === m.id);
      const load = mTasks.reduce((s, t) => s + taskLoad(t), 0);
      return { id: m.id, name: m.display_name, load, isMe: m.id === profile?.id };
    }).sort((a, b) => b.load - a.load);
  }, [tasks, members, profile?.id]);

  // Challenge du jour
  const challenge = todayDone < 3
    ? { text: `Complète ${3 - todayDone} tâche${3 - todayDone > 1 ? 's' : ''} aujourd'hui`, reward: '+30 XP', done: false }
    : { text: 'Challenge du jour complété !', reward: '+30 XP', done: true };

  return (
    <div className="pt-4 pb-8" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="px-4">
        <h2 className="text-[28px] font-bold text-[#1c1c1e]">Progression</h2>
      </div>

      {/* Niveau + XP */}
      <div className="mx-4 rounded-3xl p-6 text-white relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #ff9500, #ff3b30)' }}>
        <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full" style={{ background: 'rgba(255,255,255,0.1)' }} />
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[11px] uppercase tracking-wider font-bold opacity-70">Niveau {currentLevel.level}</p>
            <p className="text-[24px] font-black">{currentLevel.name}</p>
          </div>
          <div className="text-right">
            <p className="text-[28px] font-black">{xp}</p>
            <p className="text-[11px] opacity-70">XP</p>
          </div>
        </div>
        {nextLevel && (
          <div>
            <div className="flex justify-between text-[10px] opacity-60 mb-1">
              <span>Niveau {currentLevel.level}</span>
              <span>{xpToNext} XP pour niveau {nextLevel.level}</span>
            </div>
            <div className="h-2 rounded-full bg-white/20">
              <div className="h-2 rounded-full bg-white transition-all duration-700" style={{ width: `${xpProgress}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* Streak + Aujourd'hui */}
      <div className="px-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white p-4 text-center" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
          <p className="text-[32px] font-black" style={{ color: streak >= 7 ? '#ff9500' : '#1c1c1e' }}>🔥 {streak}</p>
          <p className="text-[12px] text-[#8e8e93] font-medium">jours de suite</p>
        </div>
        <div className="rounded-2xl bg-white p-4 text-center" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
          <p className="text-[32px] font-black" style={{ color: '#34c759' }}>{todayDone}</p>
          <p className="text-[12px] text-[#8e8e93] font-medium">fait aujourd&apos;hui</p>
        </div>
      </div>

      {/* Challenge du jour */}
      <div className="mx-4 rounded-2xl p-4 flex items-center justify-between" style={{
        background: challenge.done ? '#f0fff4' : 'white',
        boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)',
        border: challenge.done ? '1px solid #34c759' : 'none',
      }}>
        <div>
          <p className="text-[11px] font-bold text-[#8e8e93] uppercase tracking-wider mb-1">Challenge du jour</p>
          <p className="text-[14px] font-semibold text-[#1c1c1e]">{challenge.text}</p>
        </div>
        <span className="text-[13px] font-bold" style={{ color: challenge.done ? '#34c759' : '#ff9500' }}>
          {challenge.done ? '✓' : challenge.reward}
        </span>
      </div>

      {/* Badges */}
      <div className="mx-4">
        <p className="text-[11px] font-bold text-[#8e8e93] uppercase tracking-wider mb-2 px-1">Badges</p>
        <div className="grid grid-cols-3 gap-2">
          {earnedBadges.map((b) => (
            <div key={b.id} className="rounded-2xl bg-white p-3 text-center" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
              <p className="text-[28px]">{b.icon}</p>
              <p className="text-[11px] font-bold text-[#1c1c1e] mt-1">{b.name}</p>
              <p className="text-[9px] text-[#8e8e93]">{b.desc}</p>
            </div>
          ))}
          {lockedBadges.map((b) => (
            <div key={b.id} className="rounded-2xl p-3 text-center opacity-40" style={{ background: '#f2f2f7' }}>
              <p className="text-[28px]">🔒</p>
              <p className="text-[11px] font-bold text-[#8e8e93] mt-1">{b.name}</p>
              <p className="text-[9px] text-[#c7c7cc]">{b.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Leaderboard */}
      {leaderboard.length > 1 && (
        <div className="mx-4">
          <p className="text-[11px] font-bold text-[#8e8e93] uppercase tracking-wider mb-2 px-1">Classement foyer</p>
          <div className="rounded-2xl bg-white overflow-hidden" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
            {leaderboard.map((m, i) => {
              const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`;
              return (
                <div key={m.id}
                  className="flex items-center gap-3 px-4 py-3"
                  style={i < leaderboard.length - 1 ? { borderBottom: '0.5px solid var(--ios-separator)' } : {}}>
                  <span className="text-[18px] w-8 text-center">{medal}</span>
                  <span className={`flex-1 text-[15px] font-semibold ${m.isMe ? 'text-[#007aff]' : 'text-[#1c1c1e]'}`}>
                    {m.name} {m.isMe && '(moi)'}
                  </span>
                  <span className="text-[15px] font-bold text-[#8e8e93]">{m.load}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="mx-4 rounded-2xl bg-white p-4" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
        <p className="text-[11px] font-bold text-[#8e8e93] uppercase tracking-wider mb-3">Mes stats</p>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-[22px] font-black text-[#1c1c1e]">{totalCompletions}</p>
            <p className="text-[10px] text-[#8e8e93]">total complétées</p>
          </div>
          <div>
            <p className="text-[22px] font-black text-[#1c1c1e]">{streak}</p>
            <p className="text-[10px] text-[#8e8e93]">jours de suite</p>
          </div>
          <div>
            <p className="text-[22px] font-black text-[#1c1c1e]">{earnedBadges.length}</p>
            <p className="text-[10px] text-[#8e8e93]">badges gagnés</p>
          </div>
        </div>
      </div>
    </div>
  );
}
