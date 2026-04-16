'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import { useTaskStore } from '@/stores/taskStore';
import { useHouseholdStore } from '@/stores/householdStore';
import { taskLoad } from '@/utils/designSystem';
import { createClient } from '@/lib/supabase';
import { useDashboardStyle, type DashboardStyle } from '@/app/(app)/dashboard/page';

function DashboardStyleButton({ value, label, desc, emoji }: { value: DashboardStyle; label: string; desc: string; emoji: string }) {
  const { style, setStyle } = useDashboardStyle();
  const active = style === value;
  return (
    <button onClick={() => setStyle(value)}
      className="rounded-xl p-3 text-left transition-all"
      style={{
        background: 'white',
        border: active ? '2px solid #007aff' : '2px solid transparent',
        boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)',
      }}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[18px]">{emoji}</span>
        <span className="text-[13px] font-bold" style={{ color: active ? '#007aff' : '#1c1c1e' }}>{label}</span>
      </div>
      <p className="text-[11px] text-[#8e8e93]">{desc}</p>
    </button>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const { profile, signOut, refreshProfile } = useAuthStore();
  const { household, members, phantomMembers, renameHousehold, addPhantomMember, removePhantomMember, linkPhantomToReal } = useHouseholdStore();
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [copied, setCopied] = useState(false);
  const [showAddPhantom, setShowAddPhantom] = useState(false);
  const [phantomName, setPhantomName] = useState('');
  const [linkingPhantom, setLinkingPhantom] = useState<string | null>(null); // phantomId en cours de rattachement
  const [linkTargetId, setLinkTargetId] = useState(''); // realProfileId sélectionné

  // Préférences explicites pour l'IA
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [hatedInput, setHatedInput] = useState('');
  const [lovedInput, setLovedInput] = useState('');
  const [hatedTasks, setHatedTasks] = useState<string[]>([]);
  const [lovedTasks, setLovedTasks] = useState<string[]>([]);
  const [preferredTimeSlot, setPreferredTimeSlot] = useState<'morning' | 'evening' | 'weekend' | 'flexible'>('flexible');
  const [unavailableDays, setUnavailableDays] = useState<number[]>([]);
  const [loadPreference, setLoadPreference] = useState<'light' | 'balanced' | 'heavy'>('balanced');
  const [freeformNote, setFreeformNote] = useState('');
  const [savingPrefs, setSavingPrefs] = useState(false);

  // Charger les préfs au montage
  useEffect(() => {
    async function loadPrefs() {
      if (!profile?.id) return;
      const supabase = createClient();
      const { data } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', profile.id)
        .maybeSingle();
      if (data) {
        setHatedTasks(data.hated_tasks ?? []);
        setLovedTasks(data.loved_tasks ?? []);
        setPreferredTimeSlot(data.preferred_time_slot ?? 'flexible');
        setUnavailableDays(data.unavailable_days ?? []);
        setLoadPreference(data.load_preference ?? 'balanced');
        setFreeformNote(data.freeform_note ?? '');
      }
      setPrefsLoaded(true);
    }
    loadPrefs();
  }, [profile?.id]);

  const savePrefs = async (overrides?: {
    hatedTasks?: string[];
    lovedTasks?: string[];
    preferredTimeSlot?: 'morning' | 'evening' | 'weekend' | 'flexible';
    unavailableDays?: number[];
    loadPreference?: 'light' | 'balanced' | 'heavy';
    freeformNote?: string;
  }) => {
    if (!profile?.id) return;
    setSavingPrefs(true);
    const supabase = createClient();
    const payload = {
      user_id: profile.id,
      hated_tasks: overrides?.hatedTasks ?? hatedTasks,
      loved_tasks: overrides?.lovedTasks ?? lovedTasks,
      preferred_time_slot: overrides?.preferredTimeSlot ?? preferredTimeSlot,
      unavailable_days: overrides?.unavailableDays ?? unavailableDays,
      load_preference: overrides?.loadPreference ?? loadPreference,
      freeform_note: overrides?.freeformNote ?? freeformNote ?? null,
    };
    await supabase.from('user_preferences').upsert(payload, { onConflict: 'user_id' });
    setSavingPrefs(false);
  };

  const addHated = () => {
    const v = hatedInput.trim();
    if (!v || hatedTasks.includes(v)) return;
    const next = [...hatedTasks, v];
    setHatedTasks(next);
    setHatedInput('');
    savePrefs({ hatedTasks: next });
  };
  const removeHated = (v: string) => {
    const next = hatedTasks.filter((x) => x !== v);
    setHatedTasks(next);
    savePrefs({ hatedTasks: next });
  };
  const addLoved = () => {
    const v = lovedInput.trim();
    if (!v || lovedTasks.includes(v)) return;
    const next = [...lovedTasks, v];
    setLovedTasks(next);
    setLovedInput('');
    savePrefs({ lovedTasks: next });
  };
  const removeLoved = (v: string) => {
    const next = lovedTasks.filter((x) => x !== v);
    setLovedTasks(next);
    savePrefs({ lovedTasks: next });
  };
  const toggleUnavailableDay = (d: number) => {
    const next = unavailableDays.includes(d) ? unavailableDays.filter((x) => x !== d) : [...unavailableDays, d];
    setUnavailableDays(next);
    savePrefs({ unavailableDays: next });
  };

  const handleSignOut = async () => {
    if (!confirm('Êtes-vous sûr de vouloir vous déconnecter ?')) return;
    await signOut();
    router.push('/login');
  };
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
    <div className="pt-4 pb-8" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <h2 className="text-[28px] font-bold text-[#1c1c1e] px-4">Profil</h2>

      {/* Carte utilisateur + stats */}
      {(() => {
        const { tasks } = useTaskStore.getState();
        const myTasks = tasks.filter((t) => t.assigned_to === profile?.id);
        const totalLoad = myTasks.reduce((s, t) => s + taskLoad(t), 0);
        const allLoad = tasks.reduce((s, t) => s + taskLoad(t), 0);
        const contribution = allLoad > 0 ? Math.round((totalLoad / allLoad) * 100) : 0;
        const memberSince = profile?.joined_at ? Math.floor((Date.now() - new Date(profile.joined_at).getTime()) / 86400000) : 0;

        return (
          <>
            <div className="mx-4 rounded-2xl bg-white p-5 flex items-center gap-4" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <div className="flex h-14 w-14 items-center justify-center rounded-full text-[22px] font-bold text-white" style={{ background: '#007aff' }}>
                {profile?.display_name?.charAt(0)?.toUpperCase() ?? '?'}
              </div>
              <div>
                <p className="text-[20px] font-bold text-[#1c1c1e]">{profile?.display_name}</p>
                <p className="text-[12px] text-[#8e8e93]">
                  {profile?.role === 'admin' ? 'Administrateur' : 'Membre'} · {memberSince > 0 ? `Depuis ${memberSince} jours` : 'Nouveau membre'}
                </p>
              </div>
            </div>

            <div className="mx-4 grid grid-cols-3 gap-2">
              <div className="rounded-2xl bg-white p-3 text-center" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <p className="text-[22px] font-black text-[#007aff]">{myTasks.length}</p>
                <p className="text-[10px] text-[#8e8e93]">tâches actives</p>
              </div>
              <div className="rounded-2xl bg-white p-3 text-center" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <p className="text-[22px] font-black text-[#af52de]">{contribution}%</p>
                <p className="text-[10px] text-[#8e8e93]">contribution</p>
              </div>
              <div className="rounded-2xl bg-white p-3 text-center" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <p className="text-[22px] font-black text-[#ff9500]">{totalLoad}</p>
                <p className="text-[10px] text-[#8e8e93]">load total</p>
              </div>
            </div>
          </>
        );
      })()}

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
              Membres ({members.length + phantomMembers.length})
            </p>
            <div className="rounded-xl bg-white overflow-hidden" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
              {/* Membres réels */}
              {members.map((member, i) => (
                <div key={member.id}
                  className="flex items-center gap-3 px-4 py-3"
                  style={{ borderBottom: '0.5px solid var(--ios-separator)' }}>
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

              {/* Membres fantômes */}
              {phantomMembers.map((phantom) => (
                <div key={phantom.id} style={{ borderBottom: '0.5px solid var(--ios-separator)' }}>
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full text-[14px]"
                      style={{ background: '#e5e5ea' }}>
                      👻
                    </div>
                    <span className="flex-1 text-[17px] text-[#1c1c1e]">{phantom.display_name}</span>
                    <div className="flex gap-2">
                      {/* Rattacher à un vrai membre */}
                      {members.length > 0 && (
                        <button
                          onClick={() => setLinkingPhantom(linkingPhantom === phantom.id ? null : phantom.id)}
                          className="text-[12px] font-medium px-2 py-1 rounded-lg"
                          style={{ color: '#007aff', background: linkingPhantom === phantom.id ? '#EEF4FF' : 'transparent' }}
                        >
                          Rattacher
                        </button>
                      )}
                      <button
                        onClick={() => {
                          if (confirm(`Retirer ${phantom.display_name} du foyer ?`)) {
                            removePhantomMember(phantom.id);
                          }
                        }}
                        className="text-[12px] font-medium px-2 py-1 rounded-lg"
                        style={{ color: '#ff3b30' }}
                      >
                        Retirer
                      </button>
                    </div>
                  </div>

                  {/* Panel de rattachement */}
                  {linkingPhantom === phantom.id && (
                    <div className="px-4 pb-3 pt-1">
                      <p className="text-[12px] text-[#8e8e93] mb-2">
                        Quel membre réel remplace {phantom.display_name} ?
                      </p>
                      <div className="flex gap-2">
                        <select
                          value={linkTargetId}
                          onChange={(e) => setLinkTargetId(e.target.value)}
                          className="flex-1 text-[14px] rounded-lg px-3 py-2 bg-[#f0f2f8] text-[#1c1c1e] outline-none"
                        >
                          <option value="">Choisir un membre...</option>
                          {members.filter((m) => m.id !== profile?.id || members.length === 1).map((m) => (
                            <option key={m.id} value={m.id}>{m.display_name}</option>
                          ))}
                        </select>
                        <button
                          onClick={async () => {
                            if (!linkTargetId) return;
                            const targetName = members.find((m) => m.id === linkTargetId)?.display_name;
                            if (!confirm(`Transférer tout l'historique de ${phantom.display_name} vers ${targetName} ? Cette action est irréversible.`)) return;
                            await linkPhantomToReal(phantom.id, linkTargetId);
                            setLinkingPhantom(null);
                            setLinkTargetId('');
                          }}
                          disabled={!linkTargetId}
                          className="text-[13px] font-semibold px-3 py-2 rounded-lg text-white disabled:opacity-40"
                          style={{ background: '#007aff' }}
                        >
                          Confirmer
                        </button>
                      </div>
                      <p className="text-[11px] text-[#c7c7cc] mt-1.5">
                        Toutes les tâches et complétions de {phantom.display_name} seront transférées.
                      </p>
                    </div>
                  )}
                </div>
              ))}

              {/* Ajouter un membre fantôme */}
              <div className="flex items-center gap-3 px-4 py-3">
                {showAddPhantom ? (
                  <>
                    <input
                      type="text"
                      value={phantomName}
                      onChange={(e) => setPhantomName(e.target.value)}
                      placeholder="Prénom"
                      autoFocus
                      className="flex-1 text-[17px] text-[#1c1c1e] bg-transparent outline-none placeholder:text-[#c7c7cc]"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && phantomName.trim()) {
                          addPhantomMember(phantomName.trim());
                          setPhantomName('');
                          setShowAddPhantom(false);
                        }
                      }}
                    />
                    <button
                      onClick={() => {
                        if (phantomName.trim()) {
                          addPhantomMember(phantomName.trim());
                          setPhantomName('');
                          setShowAddPhantom(false);
                        }
                      }}
                      className="text-[14px] font-semibold"
                      style={{ color: '#007aff' }}
                    >
                      Ajouter
                    </button>
                    <button
                      onClick={() => { setShowAddPhantom(false); setPhantomName(''); }}
                      className="text-[14px] text-[#8e8e93]"
                    >
                      ✕
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setShowAddPhantom(true)}
                    className="flex items-center gap-2 text-[15px] font-medium"
                    style={{ color: '#007aff' }}
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-full text-[18px]"
                      style={{ background: '#f0f2f8' }}>+</span>
                    Ajouter un membre
                  </button>
                )}
              </div>
            </div>
            <p className="text-[11px] text-[#8e8e93] mt-1.5 px-1">
              👻 Membre sans compte — vous loguez ses tâches à sa place
            </p>
          </div>
        </>
      )}

      {/* Préférences Aura — Personnalisation IA */}
      <div className="mx-4">
        <p className="text-[13px] font-semibold text-[#8e8e93] uppercase tracking-wide mb-2 px-1">
          🤖 Ce qu&apos;Aura sait de toi
        </p>
        <div className="rounded-xl bg-white overflow-hidden" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
          {/* Tâches détestées */}
          <div className="px-4 py-3" style={{ borderBottom: '0.5px solid var(--ios-separator)' }}>
            <p className="text-[13px] font-semibold text-[#1c1c1e] mb-1">Tâches que tu détestes</p>
            <p className="text-[11px] text-[#8e8e93] mb-2">Aura essaiera de ne pas te les assigner</p>
            {hatedTasks.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {hatedTasks.map((t) => (
                  <button key={t} onClick={() => removeHated(t)}
                    className="rounded-full px-2.5 py-1 text-[11px] font-medium flex items-center gap-1"
                    style={{ background: '#fff2f2', color: '#ff3b30' }}>
                    {t} ✕
                  </button>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input type="text" value={hatedInput} onChange={(e) => setHatedInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addHated()}
                placeholder="Ex : Repasser"
                className="flex-1 text-[14px] rounded-lg px-3 py-1.5 bg-[#f0f2f8] text-[#1c1c1e] outline-none placeholder:text-[#c7c7cc]" />
              <button onClick={addHated} className="text-[14px] font-semibold" style={{ color: '#007aff' }}>Ajouter</button>
            </div>
          </div>

          {/* Tâches préférées */}
          <div className="px-4 py-3" style={{ borderBottom: '0.5px solid var(--ios-separator)' }}>
            <p className="text-[13px] font-semibold text-[#1c1c1e] mb-1">Tâches que tu aimes bien</p>
            <p className="text-[11px] text-[#8e8e93] mb-2">Aura te les proposera en priorité</p>
            {lovedTasks.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {lovedTasks.map((t) => (
                  <button key={t} onClick={() => removeLoved(t)}
                    className="rounded-full px-2.5 py-1 text-[11px] font-medium flex items-center gap-1"
                    style={{ background: '#e8f5e9', color: '#34c759' }}>
                    {t} ✕
                  </button>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input type="text" value={lovedInput} onChange={(e) => setLovedInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addLoved()}
                placeholder="Ex : Cuisiner"
                className="flex-1 text-[14px] rounded-lg px-3 py-1.5 bg-[#f0f2f8] text-[#1c1c1e] outline-none placeholder:text-[#c7c7cc]" />
              <button onClick={addLoved} className="text-[14px] font-semibold" style={{ color: '#007aff' }}>Ajouter</button>
            </div>
          </div>

          {/* Moment préféré */}
          <div className="px-4 py-3" style={{ borderBottom: '0.5px solid var(--ios-separator)' }}>
            <p className="text-[13px] font-semibold text-[#1c1c1e] mb-2">Quand préfères-tu faire les tâches ?</p>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { v: 'morning', label: 'Matin', emoji: '☀️' },
                { v: 'evening', label: 'Soir', emoji: '🌙' },
                { v: 'weekend', label: 'Weekend', emoji: '🏖' },
                { v: 'flexible', label: 'Peu importe', emoji: '🤷' },
              ].map((opt) => (
                <button key={opt.v} onClick={() => { setPreferredTimeSlot(opt.v as 'morning' | 'evening' | 'weekend' | 'flexible'); savePrefs({ preferredTimeSlot: opt.v as 'morning' | 'evening' | 'weekend' | 'flexible' }); }}
                  className="rounded-lg py-2 text-[11px] font-medium flex flex-col items-center gap-0.5"
                  style={preferredTimeSlot === opt.v ? { background: '#007aff', color: 'white' } : { background: '#f0f2f8', color: '#3c3c43' }}>
                  <span className="text-[14px]">{opt.emoji}</span>
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Jours non dispo */}
          <div className="px-4 py-3" style={{ borderBottom: '0.5px solid var(--ios-separator)' }}>
            <p className="text-[13px] font-semibold text-[#1c1c1e] mb-2">Jours où tu n&apos;es pas dispo</p>
            <div className="flex gap-1">
              {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map((letter, i) => {
                const active = unavailableDays.includes(i);
                return (
                  <button key={i} onClick={() => toggleUnavailableDay(i)}
                    className="flex-1 rounded-lg py-2 text-[12px] font-semibold"
                    style={active ? { background: '#ff3b30', color: 'white' } : { background: '#f0f2f8', color: '#3c3c43' }}>
                    {letter}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Charge préférée */}
          <div className="px-4 py-3" style={{ borderBottom: '0.5px solid var(--ios-separator)' }}>
            <p className="text-[13px] font-semibold text-[#1c1c1e] mb-2">Ton niveau de charge souhaité</p>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { v: 'light', label: 'Léger', desc: 'Moins possible' },
                { v: 'balanced', label: 'Équilibré', desc: 'Ma juste part' },
                { v: 'heavy', label: 'Élevé', desc: "J'en prends plus" },
              ].map((opt) => (
                <button key={opt.v} onClick={() => { setLoadPreference(opt.v as 'light' | 'balanced' | 'heavy'); savePrefs({ loadPreference: opt.v as 'light' | 'balanced' | 'heavy' }); }}
                  className="rounded-lg py-2 px-2 text-left"
                  style={loadPreference === opt.v ? { background: '#007aff', color: 'white' } : { background: '#f0f2f8', color: '#3c3c43' }}>
                  <p className="text-[12px] font-bold">{opt.label}</p>
                  <p className="text-[10px] opacity-80">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Note libre à Aura */}
          <div className="px-4 py-3">
            <p className="text-[13px] font-semibold text-[#1c1c1e] mb-1">Message à Aura</p>
            <p className="text-[11px] text-[#8e8e93] mb-2">N&apos;importe quelle info pour mieux t&apos;aider</p>
            <textarea
              value={freeformNote}
              onChange={(e) => setFreeformNote(e.target.value)}
              onBlur={() => savePrefs()}
              maxLength={500}
              rows={3}
              placeholder="Ex : Je travaille tard le jeudi, j'ai le dos fragile..."
              className="w-full text-[14px] rounded-lg px-3 py-2 bg-[#f0f2f8] text-[#1c1c1e] outline-none placeholder:text-[#c7c7cc] resize-none"
            />
            {savingPrefs && <p className="text-[10px] text-[#8e8e93] mt-1">Enregistrement...</p>}
          </div>
        </div>
        {!prefsLoaded && (
          <p className="text-center text-[11px] text-[#c7c7cc] mt-2">Chargement des préférences...</p>
        )}
      </div>

      {/* Style du dashboard */}
      <div className="mx-4">
        <p className="text-[13px] font-semibold text-[#8e8e93] uppercase tracking-wide mb-2 px-1">Apparence</p>
        <div className="grid grid-cols-4 gap-1.5">
          <DashboardStyleButton value="command" label="Vivid" desc="Coloré" emoji="🚀" />
          <DashboardStyleButton value="premium" label="Dark" desc="Élégant" emoji="💎" />
          <DashboardStyleButton value="classic" label="Clean" desc="Épuré" emoji="⬜" />
          <DashboardStyleButton value="chatgpt" label="Galaxy" desc="Premium" emoji="✨" />
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
          <Link href="/packs" className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: '0.5px solid var(--ios-separator)' }}>
            <div className="flex items-center gap-3">
              <span className="text-[18px]">📦</span>
              <span className="text-[15px] text-[#1c1c1e]">Packs Projets</span>
            </div>
            <svg width="7" height="12" fill="none" stroke="#c7c7cc" strokeWidth="2" strokeLinecap="round" viewBox="0 0 7 12"><path d="M1 1l5 5-5 5" /></svg>
          </Link>
          <Link href="/tasks/archived" className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: '0.5px solid var(--ios-separator)' }}>
            <div className="flex items-center gap-3">
              <span className="text-[18px]">📁</span>
              <span className="text-[15px] text-[#1c1c1e]">Tâches archivées</span>
            </div>
            <svg width="7" height="12" fill="none" stroke="#c7c7cc" strokeWidth="2" strokeLinecap="round" viewBox="0 0 7 12"><path d="M1 1l5 5-5 5" /></svg>
          </Link>
          <Link href="/onboarding" className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="text-[18px]">🏠</span>
              <span className="text-[15px] text-[#1c1c1e]">Tutoriel / Onboarding</span>
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

      {/* Notifications */}
      <div className="mx-4">
        <p className="text-[13px] font-semibold text-[#8e8e93] uppercase tracking-wide mb-2 px-1">Notifications</p>
        <div className="rounded-xl bg-white overflow-hidden" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
          <div className="px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-[15px] text-[#1c1c1e]">🌙 Rappel journal du soir</p>
              <p className="text-[13px] text-[#8e8e93] mt-0.5">
                {typeof window !== 'undefined' && 'Notification' in window
                  ? Notification.permission === 'granted'
                    ? 'Activé — notification à 21h'
                    : Notification.permission === 'denied'
                    ? 'Bloqué dans les réglages du navigateur'
                    : 'Tap pour activer'
                  : 'Non supporté sur ce navigateur'}
              </p>
            </div>
            {typeof window !== 'undefined' && 'Notification' in window && Notification.permission !== 'denied' && (
              <button
                onClick={async () => {
                  const { requestNotificationPermission, scheduleEveningRecap } = await import('@/utils/pushNotifications');
                  const granted = await requestNotificationPermission();
                  if (granted) scheduleEveningRecap();
                }}
                className="rounded-full px-4 py-1.5 text-[13px] font-semibold text-white"
                style={{ background: Notification.permission === 'granted' ? '#34c759' : '#007aff' }}
              >
                {Notification.permission === 'granted' ? 'Activé ✓' : 'Activer'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Déconnexion */}
      <div className="mx-4">
        <button onClick={handleSignOut}
          className="w-full rounded-xl bg-white py-3 text-[17px] font-medium"
          style={{ color: '#ff3b30', boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
          Se déconnecter
        </button>
      </div>

      {/* Mes données (RGPD) */}
      <div className="mx-4">
        <p className="text-[13px] font-semibold text-[#8e8e93] uppercase tracking-wide mb-2 px-1">Mes données</p>
        <div className="rounded-xl bg-white overflow-hidden" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>

          {/* Export des données */}
          <button
            onClick={async () => {
              try {
                const res = await fetch('/api/user/export-data', { method: 'GET' });
                if (!res.ok) {
                  alert('Erreur lors de l\'export. Réessaie dans quelques instants.');
                  return;
                }
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                const today = new Date().toISOString().split('T')[0];
                a.href = url;
                a.download = `mes-donnees-aura-${today}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              } catch (err) {
                alert(`Erreur réseau : ${err instanceof Error ? err.message : 'inconnue'}`);
              }
            }}
            className="w-full flex items-center justify-between px-4 py-3"
            style={{ borderBottom: '0.5px solid var(--ios-separator)' }}
          >
            <div className="flex items-center gap-3">
              <span className="text-[18px]">📥</span>
              <div className="text-left">
                <p className="text-[15px] text-[#1c1c1e]">Télécharger mes données</p>
                <p className="text-[12px] text-[#8e8e93]">Export JSON — Art. 20 RGPD</p>
              </div>
            </div>
            <svg width="7" height="12" fill="none" stroke="#c7c7cc" strokeWidth="2" strokeLinecap="round" viewBox="0 0 7 12"><path d="M1 1l5 5-5 5" /></svg>
          </button>

          {/* Politique de confidentialité */}
          <a
            href="/legal/privacy"
            className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: '0.5px solid var(--ios-separator)' }}
          >
            <div className="flex items-center gap-3">
              <span className="text-[18px]">🔒</span>
              <div>
                <p className="text-[15px] text-[#1c1c1e]">Politique de confidentialité</p>
                <p className="text-[12px] text-[#8e8e93]">Comment nous protégeons vos données</p>
              </div>
            </div>
            <svg width="7" height="12" fill="none" stroke="#c7c7cc" strokeWidth="2" strokeLinecap="round" viewBox="0 0 7 12"><path d="M1 1l5 5-5 5" /></svg>
          </a>

          {/* Hébergement */}
          <div className="px-4 py-3" style={{ borderBottom: '0.5px solid var(--ios-separator)' }}>
            <p className="text-[12px] text-[#8e8e93]">
              Données hébergées par <strong>Supabase</strong> (EU — Frankfurt) · Traitées par <strong>Anthropic</strong> (US) pour l&apos;IA journal
            </p>
          </div>

          {/* Retrait du consentement journal IA */}
          <button
            onClick={async () => {
              if (!profile?.id) return;
              const confirmed = confirm(
                'Retirer ton consentement journal IA ?\n\nTu ne pourras plus utiliser le journal conversationnel tant que tu ne l\'auras pas réactivé. Tes données existantes ne sont pas supprimées.',
              );
              if (!confirmed) return;
              const supabase = createClient();
              await supabase
                .from('profiles')
                .update({ ai_journal_consent_at: null })
                .eq('id', profile.id);
              await refreshProfile();
              alert('Consentement retiré. Le journal IA est désactivé.');
            }}
            className="w-full px-4 py-3 text-left"
            style={{ borderBottom: '0.5px solid var(--ios-separator)', opacity: profile?.ai_journal_consent_at ? 1 : 0.4 }}
            disabled={!profile?.ai_journal_consent_at}
          >
            <div className="flex items-center gap-3">
              <span className="text-[18px]">🤖</span>
              <div>
                <p className="text-[15px] text-[#1c1c1e]">
                  {profile?.ai_journal_consent_at ? 'Retirer le consentement journal IA' : 'Consentement journal IA non donné'}
                </p>
                <p className="text-[12px] text-[#8e8e93]">
                  {profile?.ai_journal_consent_at
                    ? `Consenti le ${new Date(profile.ai_journal_consent_at).toLocaleDateString('fr-FR')} — Art. 7 RGPD`
                    : 'Accède au journal pour activer'}
                </p>
              </div>
            </div>
          </button>

          {/* Suppression du compte */}
          <button
            onClick={async () => {
              const confirmed = confirm(
                'Supprimer définitivement ton compte ?\n\nToutes tes données seront effacées immédiatement (tâches, historique, préférences, journaux). Cette action est irréversible.',
              );
              if (!confirmed) return;
              const sure = confirm('Dernière confirmation : es-tu vraiment sûr(e) ? Cette action ne peut pas être annulée.');
              if (!sure) return;

              try {
                const res = await fetch('/api/account/delete', { method: 'POST' });
                if (!res.ok) {
                  const data = await res.json().catch(() => ({}));
                  alert(`Erreur lors de la suppression : ${data.message ?? data.error ?? 'inconnue'}`);
                  return;
                }
                await signOut();
                router.push('/login');
              } catch (err) {
                alert(`Erreur réseau : ${err instanceof Error ? err.message : 'inconnue'}`);
              }
            }}
            className="w-full px-4 py-3 text-left"
          >
            <div className="flex items-center gap-3">
              <span className="text-[18px]">🗑️</span>
              <div>
                <p className="text-[15px]" style={{ color: '#ff3b30' }}>Supprimer mon compte et mes données</p>
                <p className="text-[12px] text-[#8e8e93]">Action irréversible — Art. 17 RGPD</p>
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Liens légaux */}
      <div className="mx-4 mt-6 pb-8 text-center">
        <div className="flex gap-4 justify-center text-[12px] text-[#8e8e93]">
          <a href="/legal/cgu">CGU</a>
          <span>·</span>
          <a href="/legal/privacy">Confidentialité</a>
          <span>·</span>
          <a href="mailto:privacy@fairshare.app">Contact RGPD</a>
        </div>
        <p className="text-[11px] text-[#c7c7cc] mt-2">Aura © {new Date().getFullYear()}</p>
      </div>
    </div>
  );
}
