'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import { useHouseholdStore } from '@/stores/householdStore';
import { useThemeStore, THEMES, type ThemeSkin } from '@/stores/themeStore';
import { createClient } from '@/lib/supabase';

export default function ProfilePage() {
  const router = useRouter();
  const { profile, signOut } = useAuthStore();
  const { household, members, renameHousehold } = useHouseholdStore();
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [copied, setCopied] = useState(false);

  const handleSignOut = async () => { await signOut(); router.push('/login'); };
  const [togglingVacation, setTogglingVacation] = useState(false);
  const handleToggleVacation = async () => {
    if (!profile?.id || !profile?.household_id) return;
    const newMode = !profile.vacation_mode;
    if (newMode && !confirm('Activer le mode vacances ? Vos tâches seront masquées pour tous les membres.')) return;
    if (!newMode && !confirm('Désactiver le mode vacances ? Vos tâches seront recalculées à partir d\'aujourd\'hui.')) return;
    setTogglingVacation(true);
    const supabase = createClient();

    // Mettre à jour le profil
    await supabase.from('profiles').update({
      vacation_mode: newMode,
      vacation_started_at: newMode ? new Date().toISOString() : null,
    }).eq('id', profile.id);

    // À la désactivation : recalculer les next_due_at des tâches assignées
    if (!newMode) {
      const { data: myTasks } = await supabase
        .from('household_tasks')
        .select('id, frequency, custom_interval_days')
        .eq('household_id', profile.household_id)
        .eq('assigned_to', profile.id)
        .eq('is_active', true);

      if (myTasks) {
        const { computeNextDueAt } = await import('@/utils/taskDueDate');
        const now = new Date();
        for (const task of myTasks) {
          const nextDueAt = computeNextDueAt(task.frequency, now, task.custom_interval_days);
          await supabase
            .from('household_tasks')
            .update({ next_due_at: nextDueAt?.toISOString() ?? null })
            .eq('id', task.id);
        }
      }
    }

    await useAuthStore.getState().refreshProfile();
    setTogglingVacation(false);
  };
  const handleRename = async () => { if (!newName.trim()) return; await renameHousehold(newName.trim()); setEditingName(false); };

  const [targetLocal, setTargetLocal] = useState<number>(profile?.target_share_percent ?? 50);
  // Sync quand le profil change
  useEffect(() => {
    if (profile?.target_share_percent != null) setTargetLocal(profile.target_share_percent);
  }, [profile?.target_share_percent]);

  const handleTargetChange = async (value: number) => {
    setTargetLocal(value); // Mise à jour immédiate de l'UI
    if (!profile?.id) return;
    const supabase = createClient();
    await supabase.from('profiles').update({ target_share_percent: value }).eq('id', profile.id);
  };
  const handleCopyCode = () => {
    if (household?.invite_code) {
      navigator.clipboard.writeText(household.invite_code);
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="pt-4 space-y-6">
      <h2 className="text-[28px] font-bold text-[#1c1c1e] px-4">Profil</h2>

      {/* Carte utilisateur */}
      <div className="mx-4 rounded-2xl bg-white p-5 flex items-center gap-4" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
        <div className="flex h-14 w-14 items-center justify-center rounded-full text-[22px] font-bold text-white" style={{ background: '#007aff' }}>
          {profile?.display_name?.charAt(0)?.toUpperCase() ?? '?'}
        </div>
        <div>
          <p className="text-[20px] font-bold text-[#1c1c1e]">{profile?.display_name}</p>
          <p className="text-[14px] text-[#8e8e93]">
            {profile?.role === 'admin' ? 'Administrateur' : 'Membre'}
          </p>
        </div>
      </div>

      {/* Foyer */}
      {household && (
        <>
          {/* Nom du foyer */}
          <div className="mx-4">
            <p className="text-[13px] font-semibold text-[#8e8e93] uppercase tracking-wide mb-2 px-1">Foyer</p>
            <div className="rounded-xl bg-white overflow-hidden" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
              {editingName ? (
                <div className="px-4 py-3 flex gap-2">
                  <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)}
                    className="flex-1 text-[17px] text-[#1c1c1e] bg-transparent outline-none" autoFocus />
                  <button onClick={handleRename} className="text-[15px] font-semibold" style={{ color: '#007aff' }}>OK</button>
                  <button onClick={() => setEditingName(false)} className="text-[15px] text-[#8e8e93]">Annuler</button>
                </div>
              ) : (
                <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '0.5px solid var(--ios-separator)' }}>
                  <span className="text-[17px] text-[#1c1c1e] font-medium">{household.name}</span>
                  {profile?.role === 'admin' && (
                    <button onClick={() => { setEditingName(true); setNewName(household.name); }}
                      className="text-[15px] font-medium" style={{ color: '#007aff' }}>Modifier</button>
                  )}
                </div>
              )}

              {/* Code d'invitation */}
              <button onClick={handleCopyCode} className="w-full px-4 py-3 text-left">
                <p className="text-[13px] text-[#8e8e93] mb-1">
                  Code d&apos;invitation {copied && <span style={{ color: '#34c759' }}>— Copié !</span>}
                </p>
                <p className="text-[22px] font-mono font-bold tracking-[0.3em]" style={{ color: '#007aff' }}>
                  {household.invite_code}
                </p>
              </button>
            </div>
          </div>

          {/* Membres */}
          <div className="mx-4">
            <p className="text-[13px] font-semibold text-[#8e8e93] uppercase tracking-wide mb-2 px-1">
              Membres ({members.length})
            </p>
            <div className="rounded-xl bg-white overflow-hidden" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
              {members.map((member, i) => (
                <div key={member.id}
                  className="flex items-center gap-3 px-4 py-3"
                  style={i < members.length - 1 ? { borderBottom: '0.5px solid var(--ios-separator)' } : {}}>
                  <div className="flex h-9 w-9 items-center justify-center rounded-full text-[14px] font-semibold text-white"
                    style={{ background: member.role === 'admin' ? '#007aff' : '#34c759' }}>
                    {member.display_name?.charAt(0)?.toUpperCase() ?? '?'}
                  </div>
                  <span className="flex-1 text-[17px] text-[#1c1c1e]">{member.display_name}</span>
                  <span className="text-[13px] text-[#8e8e93]">
                    {member.role === 'admin' ? 'Admin' : 'Membre'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Apparence */}
      <div className="mx-4">
        <p className="text-[13px] font-semibold uppercase tracking-wide mb-2 px-1" style={{ color: 'var(--text-muted)' }}>Apparence</p>
        <div className="grid grid-cols-2 gap-2">
          {(Object.entries(THEMES) as [ThemeSkin, typeof THEMES.ios][]).map(([key, t]) => {
            const isActive = useThemeStore.getState().skin === key;
            return (
              <button key={key} onClick={() => useThemeStore.getState().setSkin(key)}
                className="rounded-xl p-3 text-left transition-all"
                style={{
                  background: isActive ? t.card : 'var(--card)',
                  border: isActive ? `2px solid ${t.accent}` : '2px solid transparent',
                  boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)',
                }}>
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-6 w-6 rounded-lg" style={{ background: t.accentGradient }} />
                  <span className="text-[13px] font-bold" style={{ color: isActive ? t.accent : 'var(--foreground)' }}>{t.name}</span>
                </div>
                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{t.description}</p>
                <div className="flex gap-1 mt-2">
                  <span className="h-3 w-3 rounded-full" style={{ background: t.bg, border: '1px solid rgba(128,128,128,0.2)' }} />
                  <span className="h-3 w-3 rounded-full" style={{ background: t.card, border: '1px solid rgba(128,128,128,0.2)' }} />
                  <span className="h-3 w-3 rounded-full" style={{ background: t.accent }} />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Liens rapides */}
      <div className="mx-4">
        <p className="text-[13px] font-semibold text-[#8e8e93] uppercase tracking-wide mb-2 px-1">Raccourcis</p>
        <div className="rounded-xl bg-white overflow-hidden" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
          <Link href="/exchanges" className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: '0.5px solid var(--ios-separator)' }}>
            <div className="flex items-center gap-3">
              <span className="text-[18px]">🤝</span>
              <span className="text-[15px] text-[#1c1c1e]">Échanges de tâches</span>
            </div>
            <svg width="7" height="12" fill="none" stroke="#c7c7cc" strokeWidth="2" strokeLinecap="round" viewBox="0 0 7 12"><path d="M1 1l5 5-5 5" /></svg>
          </Link>
          <Link href="/distribution" className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: '0.5px solid var(--ios-separator)' }}>
            <div className="flex items-center gap-3">
              <span className="text-[18px]">📊</span>
              <span className="text-[15px] text-[#1c1c1e]">Statistiques détaillées</span>
            </div>
            <svg width="7" height="12" fill="none" stroke="#c7c7cc" strokeWidth="2" strokeLinecap="round" viewBox="0 0 7 12"><path d="M1 1l5 5-5 5" /></svg>
          </Link>
          <Link href="/tasks/archived" className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="text-[18px]">📁</span>
              <span className="text-[15px] text-[#1c1c1e]">Tâches archivées</span>
            </div>
            <svg width="7" height="12" fill="none" stroke="#c7c7cc" strokeWidth="2" strokeLinecap="round" viewBox="0 0 7 12"><path d="M1 1l5 5-5 5" /></svg>
          </Link>
        </div>
      </div>

      {/* Objectif de répartition */}
      <div className="mx-4">
        <p className="text-[13px] font-semibold text-[#8e8e93] uppercase tracking-wide mb-2 px-1">Mon objectif</p>
        <div className="rounded-xl bg-white overflow-hidden" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
          <div className="px-4 py-3">
            <p className="text-[15px] text-[#1c1c1e] mb-2">
              Je vise <strong style={{ color: '#007aff' }}>{targetLocal}%</strong> des tâches du foyer
            </p>
            <input
              type="range"
              min={10}
              max={90}
              step={5}
              value={targetLocal}
              onChange={(e) => handleTargetChange(Number(e.target.value))}
              className="w-full"
              style={{ accentColor: '#007aff' }}
            />
            <div className="flex justify-between text-[11px] text-[#c7c7cc] mt-1">
              <span>10%</span>
              <span>50% (égalitaire)</span>
              <span>90%</span>
            </div>
            <p className="text-[12px] text-[#8e8e93] mt-2">
              L&apos;app comparera votre répartition réelle à cet objectif et suggérera des échanges pour s&apos;en rapprocher.
            </p>
          </div>
        </div>
      </div>

      {/* Mode vacances */}
      <div className="mx-4">
        <p className="text-[13px] font-semibold text-[#8e8e93] uppercase tracking-wide mb-2 px-1">Mode vacances</p>
        <div className="rounded-xl bg-white overflow-hidden" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
          <div className="px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-[15px] text-[#1c1c1e]">
                {profile?.vacation_mode ? '🏖️ En vacances' : 'Activer le mode vacances'}
              </p>
              <p className="text-[13px] text-[#8e8e93] mt-0.5">
                {profile?.vacation_mode
                  ? 'Vos tâches sont en pause'
                  : 'Met en pause toutes vos tâches assignées'}
              </p>
            </div>
            <button onClick={handleToggleVacation} disabled={togglingVacation}
              className="rounded-full px-4 py-1.5 text-[13px] font-semibold text-white disabled:opacity-50"
              style={{ background: profile?.vacation_mode ? '#ff9500' : '#34c759' }}>
              {togglingVacation ? '...' : profile?.vacation_mode ? 'Désactiver' : 'Activer'}
            </button>
          </div>
        </div>
      </div>

      {/* Déconnexion */}
      <div className="mx-4 pb-8">
        <button onClick={handleSignOut}
          className="w-full rounded-xl bg-white py-3 text-[17px] font-medium"
          style={{ color: '#ff3b30', boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
          Se déconnecter
        </button>
      </div>
    </div>
  );
}
