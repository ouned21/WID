'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import { useHouseholdStore } from '@/stores/householdStore';
import { useMemoryStore, FACT_TYPE_EMOJI, FACT_TYPE_LABEL } from '@/stores/memoryStore';
import { createClient } from '@/lib/supabase';

export default function ProfilePage() {
  const router = useRouter();
  const { profile, user, signOut, refreshProfile } = useAuthStore();
  const { household, members, phantomMembers, renameHousehold, rotateInviteCode, addPhantomMember, removePhantomMember, linkPhantomToReal } = useHouseholdStore();
  const { facts, fetchMemory, invalidateFact } = useMemoryStore();
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [copied, setCopied] = useState(false);
  const [showAddPhantom, setShowAddPhantom] = useState(false);
  const [phantomName, setPhantomName] = useState('');
  const [confirmRenewCode, setConfirmRenewCode] = useState(false);
  const [renewingCode, setRenewingCode] = useState(false);
  const [linkingPhantom, setLinkingPhantom] = useState<string | null>(null); // phantomId en cours de rattachement
  const [linkTargetId, setLinkTargetId] = useState(''); // realProfileId sélectionné
  const [dataOpen, setDataOpen] = useState(false);

  // Préférences explicites pour l'IA
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [hatedInput, setHatedInput] = useState('');
  const [lovedInput, setLovedInput] = useState('');
  const [hatedTasks, setHatedTasks] = useState<string[]>([]);
  const [lovedTasks, setLovedTasks] = useState<string[]>([]);
  const [preferredTimeSlots, setPreferredTimeSlots] = useState<Set<string>>(new Set(['flexible']));
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
        const raw = data.preferred_time_slot ?? 'flexible';
        setPreferredTimeSlots(new Set(raw.split(',').filter(Boolean)));
        setUnavailableDays(data.unavailable_days ?? []);
        setLoadPreference(data.load_preference ?? 'balanced');
        setFreeformNote(data.freeform_note ?? '');
      }
      setPrefsLoaded(true);
    }
    loadPrefs();
  }, [profile?.id]);

  // Charger la mémoire Yova
  useEffect(() => {
    if (profile?.household_id) fetchMemory(profile.household_id);
  }, [profile?.household_id, fetchMemory]);

  const savePrefs = async (overrides?: {
    hatedTasks?: string[];
    lovedTasks?: string[];
    preferredTimeSlots?: Set<string>;
    unavailableDays?: number[];
    loadPreference?: 'light' | 'balanced' | 'heavy';
    freeformNote?: string;
  }) => {
    if (!profile?.id) return;
    setSavingPrefs(true);
    const supabase = createClient();
    const slots = overrides?.preferredTimeSlots ?? preferredTimeSlots;
    const payload = {
      user_id: profile.id,
      hated_tasks: overrides?.hatedTasks ?? hatedTasks,
      loved_tasks: overrides?.lovedTasks ?? lovedTasks,
      preferred_time_slot: [...slots].join(',') || 'flexible',
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
        .select('id, frequency')
        .eq('household_id', profile.household_id)
        .eq('assigned_to', profile.id)
        .eq('is_active', true);

      if (myTasks) {
        const { computeNextDueAt } = await import('@/utils/taskDueDate');
        const now = new Date();
        for (const task of myTasks) {
          const nextDueAt = computeNextDueAt(task.frequency, now);
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

      {/* Carte utilisateur */}
      {(() => {
        const memberSince = profile?.joined_at ? Math.floor((Date.now() - new Date(profile.joined_at).getTime()) / 86400000) : 0;
        return (
          <div className="mx-4 rounded-2xl bg-white p-5 flex items-center gap-4" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <div className="flex h-14 w-14 items-center justify-center rounded-full text-[22px] font-bold text-white flex-shrink-0" style={{ background: '#007aff' }}>
              {profile?.display_name?.charAt(0)?.toUpperCase() ?? '?'}
            </div>
            <div>
              <p className="text-[20px] font-bold text-[#1c1c1e]">{profile?.display_name}</p>
              <p className="text-[12px] text-[#8e8e93]">
                {profile?.role === 'admin' ? 'Administrateur' : 'Membre'}
                {' · '}
                {memberSince > 0
                  ? `Depuis ${memberSince} jour${memberSince > 1 ? 's' : ''}`
                  : profile?.role === 'admin' ? 'Fondateur du foyer' : 'Arrivé·e aujourd\'hui'}
              </p>
            </div>
          </div>
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
              <div className="px-4 py-3">
                <p className="text-[13px] text-[#8e8e93] mb-1 flex items-center gap-1.5">
                  <span>Code d&apos;invitation</span>
                  {copied && <span style={{ color: '#34c759' }}>— Copié !</span>}
                </p>
                <div className="flex items-center justify-between gap-3">
                  <button onClick={handleCopyCode} className="flex-1 text-left">
                    <p className="text-[22px] font-mono font-bold tracking-[0.3em]" style={{ color: '#007aff' }}>
                      {household.invite_code}
                    </p>
                    <p className="text-[10px] text-[#c7c7cc] mt-0.5">tap pour copier 📋</p>
                  </button>
                  {profile?.role === 'admin' && (
                    <button
                      onClick={() => setConfirmRenewCode(true)}
                      disabled={renewingCode}
                      className="flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-semibold disabled:opacity-50"
                      style={{ background: '#f0f2f8', color: '#007aff' }}
                      aria-label="Renouveler le code d'invitation"
                    >
                      {renewingCode ? (
                        <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3"/>
                          <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                        </svg>
                      ) : (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 4v6h6M23 20v-6h-6"/>
                          <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
                        </svg>
                      )}
                      {renewingCode ? '…' : 'Renouveler'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Accès rapides */}
          <div className="mx-4 space-y-2">
            {/* Famille */}
            <a
              href="/family"
              className="flex items-center justify-between px-4 py-3.5 rounded-xl bg-white"
              style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}
            >
              <div className="flex items-center gap-3">
                <span className="text-[22px]">👨‍👩‍👧</span>
                <div>
                  <p className="text-[15px] font-semibold text-[#1c1c1e]">Notre famille</p>
                  <p className="text-[12px] text-[#8e8e93]">Membres, contraintes, énergie du foyer</p>
                </div>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c7c7cc" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </a>
            {/* Score / répartition — archivé spec V1, accessible via lien discret */}
            {/* Voir SPEC_V1_YOVA.md : "Score 4 axes (plus visible par défaut)" */}
          </div>

          {/* Ce que Yova sait — mémoire longue */}
          {facts.length > 0 && (
            <div className="mx-4">
              <p className="text-[13px] font-semibold text-[#8e8e93] uppercase tracking-wide mb-2 px-1">
                Ce que Yova sait ({facts.length})
              </p>
              <div className="rounded-xl bg-white overflow-hidden" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
                {facts.map((fact, i) => (
                  <div
                    key={fact.id}
                    className="flex items-start gap-3 px-4 py-3"
                    style={i < facts.length - 1 ? { borderBottom: '0.5px solid #f2f2f7' } : {}}
                  >
                    <span className="text-[16px] flex-shrink-0 mt-0.5">{FACT_TYPE_EMOJI[fact.fact_type]}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-[#1c1c1e] leading-snug">{fact.content}</p>
                      <p className="text-[11px] text-[#c7c7cc] mt-0.5">{FACT_TYPE_LABEL[fact.fact_type]}</p>
                    </div>
                    <button
                      onClick={() => invalidateFact(fact.id)}
                      className="flex-shrink-0 text-[#c7c7cc] p-1 rounded-full hover:text-[#ff3b30] transition-colors"
                      aria-label="Supprimer ce souvenir"
                    >
                      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-[#c7c7cc] mt-2 px-1">
                Ces informations aident Yova à personnaliser ses réponses. Tu peux en supprimer à tout moment.
              </p>
            </div>
          )}

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
                  <span className="flex-1 text-[17px] text-[#1c1c1e]">{member.display_name || '(Anonyme)'}</span>
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
                    <span className="flex-1 text-[17px] text-[#1c1c1e]">{phantom.display_name || '(Anonyme)'}</span>
                    <div className="flex gap-2">
                      {/* Rattacher à un vrai membre */}
                      {members.length > 0 && (
                        <button
                          onClick={() => setLinkingPhantom(linkingPhantom === phantom.id ? null : phantom.id)}
                          className="text-[12px] font-medium px-2 py-1 rounded-lg"
                          style={{ color: '#007aff', background: linkingPhantom === phantom.id ? '#EEF4FF' : 'transparent' }}
                          title="Associer ce fantôme à un membre ayant rejoint le foyer"
                        >
                          Associer
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

      {/* Préférences Yova — Personnalisation IA */}
      <div className="mx-4">
        <p className="text-[13px] font-semibold text-[#8e8e93] uppercase tracking-wide mb-2 px-1">
          🤖 Ce qu&apos;Yova sait de toi
        </p>
        <div className="rounded-xl bg-white overflow-hidden" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
          {/* Tâches détestées */}
          <div className="px-4 py-3" style={{ borderBottom: '0.5px solid var(--ios-separator)' }}>
            <p className="text-[13px] font-semibold text-[#1c1c1e] mb-1">Tâches que tu détestes</p>
            <p className="text-[11px] text-[#8e8e93] mb-2">Yova essaiera de ne pas te les assigner</p>
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
            <p className="text-[11px] text-[#8e8e93] mb-2">Yova te les proposera en priorité</p>
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
              ].map((opt) => {
                const isSelected = opt.v === 'flexible'
                  ? preferredTimeSlots.has('flexible')
                  : preferredTimeSlots.has(opt.v);
                return (
                  <button key={opt.v} onClick={() => {
                    const next = new Set(preferredTimeSlots);
                    if (opt.v === 'flexible') {
                      next.clear();
                      next.add('flexible');
                    } else {
                      next.delete('flexible');
                      if (next.has(opt.v)) next.delete(opt.v);
                      else next.add(opt.v);
                      if (next.size === 0) next.add('flexible');
                    }
                    setPreferredTimeSlots(next);
                    savePrefs({ preferredTimeSlots: next });
                  }}
                    className="rounded-lg py-2 text-[11px] font-medium flex flex-col items-center gap-0.5"
                    style={isSelected ? { background: '#007aff', color: 'white' } : { background: '#f0f2f8', color: '#3c3c43' }}>
                    <span className="text-[14px]">{opt.emoji}</span>
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Jours non dispo */}
          <div className="px-4 py-3" style={{ borderBottom: '0.5px solid var(--ios-separator)' }}>
            <p className="text-[13px] font-semibold text-[#1c1c1e] mb-2">Jours où tu n&apos;es pas dispo</p>
            <div className="flex gap-1">
              {['Di', 'Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa'].map((letter, i) => {
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

          {/* Note libre à Yova */}
          <div className="px-4 py-3">
            <p className="text-[13px] font-semibold text-[#1c1c1e] mb-1">Message à Yova</p>
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


      {/* Liens rapides */}
      <div className="mx-4">
        <p className="text-[13px] font-semibold text-[#8e8e93] uppercase tracking-wide mb-2 px-1">Raccourcis</p>
        <div className="rounded-xl bg-white overflow-hidden" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
          {/* Statistiques détaillées archivées — spec V1 */}
          <Link href="/tasks/archived" className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: '0.5px solid var(--ios-separator)' }}>
            <div className="flex items-center gap-3">
              <span className="text-[18px]">📁</span>
              <span className="text-[15px] text-[#1c1c1e]">Tâches archivées</span>
            </div>
            <svg width="7" height="12" fill="none" stroke="#c7c7cc" strokeWidth="2" strokeLinecap="round" viewBox="0 0 7 12"><path d="M1 1l5 5-5 5" /></svg>
          </Link>
          <Link href="/tasks/catalog" className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="text-[18px]">🗂</span>
              <div>
                <p className="text-[15px] text-[#1c1c1e]">Catalogue de tâches</p>
                <p className="text-[11px] text-[#8e8e93]">Ajouter ou retirer des tâches suggérées</p>
              </div>
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
            {(() => {
              const totalMembers = Math.max(1, members.length + phantomMembers.length);
              const fairShare = Math.round(100 / totalMembers);
              return (
                <div className="flex justify-between text-[11px] text-[#c7c7cc] mt-1">
                  <span>10%</span>
                  <span>{fairShare}% (part égale{totalMembers > 1 ? `, foyer à ${totalMembers}` : ''})</span>
                  <span>90%</span>
                </div>
              );
            })()}
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
              <p className="text-[15px] text-[#1c1c1e]">🔔 Rappels Yova</p>
              <p className="text-[13px] text-[#8e8e93] mt-0.5">
                {typeof window !== 'undefined' && 'Notification' in window
                  ? Notification.permission === 'granted'
                    ? 'Activé — journal 21h · bilan dimanche 9h'
                    : Notification.permission === 'denied'
                    ? 'Bloqué dans les réglages du navigateur'
                    : 'Tap pour activer'
                  : 'Non supporté sur ce navigateur'}
              </p>
            </div>
            {typeof window !== 'undefined' && 'Notification' in window && Notification.permission !== 'denied' && (
              <button
                onClick={async () => {
                  const { requestNotificationPermission, scheduleEveningRecap, scheduleWeeklyRecap } = await import('@/utils/pushNotifications');
                  const granted = await requestNotificationPermission();
                  if (granted) { scheduleEveningRecap(); scheduleWeeklyRecap(); }
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

      {/* Mes données (RGPD) — accordéon pour économiser l'espace.
          Toutes les actions restent accessibles (Art. 7/15/17/20 RGPD). */}
      <div className="mx-4">
        <div className="rounded-xl bg-white overflow-hidden" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
          <button
            onClick={() => setDataOpen(!dataOpen)}
            className="w-full flex items-center gap-3 px-4 py-3 text-left"
            style={dataOpen ? { borderBottom: '0.5px solid var(--ios-separator)' } : undefined}
            aria-expanded={dataOpen}>
            <span className="text-[18px]">🔒</span>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] text-[#1c1c1e]">Mes données & vie privée</p>
              <p className="text-[11px] text-[#8e8e93]">Export · consentement · suppression · RGPD</p>
            </div>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#8e8e93" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ transform: dataOpen ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 0.15s' }}>
              <path d="M4 2l4 4-4 4" />
            </svg>
          </button>

          {dataOpen && (
            <>
              {/* Export des données (Art. 20) */}
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
                    a.download = `mes-donnees-yova-${today}.json`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  } catch (err) {
                    alert(`Erreur réseau : ${err instanceof Error ? err.message : 'inconnue'}`);
                  }
                }}
                className="w-full flex items-center justify-between px-4 py-2.5"
                style={{ borderBottom: '0.5px solid var(--ios-separator)' }}>
                <div className="flex items-center gap-3">
                  <span className="text-[15px]">📥</span>
                  <div className="text-left">
                    <p className="text-[14px] text-[#1c1c1e]">Télécharger mes données</p>
                    <p className="text-[11px] text-[#8e8e93]">Export JSON · Art. 20</p>
                  </div>
                </div>
                <svg width="7" height="12" fill="none" stroke="#c7c7cc" strokeWidth="2" strokeLinecap="round" viewBox="0 0 7 12"><path d="M1 1l5 5-5 5" /></svg>
              </button>

              {/* Politique de confidentialité */}
              <a href="/legal/privacy"
                className="flex items-center justify-between px-4 py-2.5"
                style={{ borderBottom: '0.5px solid var(--ios-separator)' }}>
                <div className="flex items-center gap-3">
                  <span className="text-[15px]">📄</span>
                  <p className="text-[14px] text-[#1c1c1e]">Politique de confidentialité</p>
                </div>
                <svg width="7" height="12" fill="none" stroke="#c7c7cc" strokeWidth="2" strokeLinecap="round" viewBox="0 0 7 12"><path d="M1 1l5 5-5 5" /></svg>
              </a>

              {/* Retrait du consentement IA (Art. 7) */}
              <button
                onClick={async () => {
                  if (!profile?.id) return;
                  const confirmed = confirm(
                    'Retirer ton consentement journal IA ?\n\nTu ne pourras plus utiliser le journal conversationnel tant que tu ne l\'auras pas réactivé. Tes données existantes ne sont pas supprimées.',
                  );
                  if (!confirmed) return;
                  const supabase = createClient();
                  await supabase.from('profiles').update({ ai_journal_consent_at: null }).eq('id', profile.id);
                  await refreshProfile();
                  alert('Consentement retiré. Le journal IA est désactivé.');
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left"
                style={{ borderBottom: '0.5px solid var(--ios-separator)', opacity: profile?.ai_journal_consent_at ? 1 : 0.4 }}
                disabled={!profile?.ai_journal_consent_at}>
                <span className="text-[15px]">🤖</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] text-[#1c1c1e]">
                    {profile?.ai_journal_consent_at ? 'Retirer le consentement IA' : 'Consentement IA non donné'}
                  </p>
                  <p className="text-[11px] text-[#8e8e93]">
                    {profile?.ai_journal_consent_at
                      ? `Consenti le ${new Date(profile.ai_journal_consent_at).toLocaleDateString('fr-FR')} · Art. 7`
                      : 'Active-le depuis le journal'}
                  </p>
                </div>
              </button>

              {/* Suppression compte (Art. 17) */}
              <button
                onClick={async () => {
                  if (!confirm('Supprimer définitivement ton compte et toutes tes données ? Cette action est irréversible.')) return;
                  if (!confirm('Dernière confirmation — toutes tes tâches, complétions et données seront effacées.')) return;
                  try {
                    const res = await fetch('/api/account/delete', { method: 'POST' });
                    if (!res.ok) {
                      const data = await res.json().catch(() => ({}));
                      alert(`Erreur : ${data.message ?? data.error ?? 'inconnue'}`);
                      return;
                    }
                    window.location.href = '/login';
                  } catch (err) {
                    alert(`Erreur réseau : ${err instanceof Error ? err.message : 'inconnue'}`);
                  }
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left"
                style={{ borderBottom: '0.5px solid var(--ios-separator)' }}>
                <span className="text-[15px]">🗑️</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px]" style={{ color: '#ff3b30' }}>Supprimer mon compte</p>
                  <p className="text-[11px] text-[#8e8e93]">Irréversible · Art. 17</p>
                </div>
              </button>

              {/* Hébergement — mentions légales */}
              <div className="px-4 py-2.5">
                <p className="text-[11px] text-[#8e8e93] leading-relaxed">
                  Hébergé par <strong>Supabase</strong> (EU · Frankfurt) · IA journal traitée par <strong>Anthropic</strong> (US)
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Admin catalogue — fondateur uniquement */}
      {profile?.role === 'admin' && (
        <div className="mx-4 mb-4 rounded-2xl bg-white overflow-hidden" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
          <button
            onClick={() => router.push('/admin/catalog')}
            className="w-full px-4 py-3 flex items-center gap-3 text-left">
            <span className="text-[18px]">🔧</span>
            <div>
              <p className="text-[14px] text-[#8e8e93] font-medium">Admin · Catalogue</p>
              <p className="text-[11px] text-[#c7c7cc]">Promotions auto · suggestions · enrichissement IA</p>
            </div>
            <span className="ml-auto text-[#c7c7cc] text-[17px]">›</span>
          </button>
        </div>
      )}

      {/* Liens légaux */}
      <div className="mx-4 mt-6 pb-8 text-center">
        <div className="flex gap-4 justify-center text-[12px] text-[#8e8e93]">
          <a href="/legal/cgu">CGU</a>
          <span>·</span>
          <a href="/legal/privacy">Confidentialité</a>
          <span>·</span>
          <a href="mailto:privacy@yova.app">Contact RGPD</a>
        </div>
        <p className="text-[11px] text-[#c7c7cc] mt-2">Yova © {new Date().getFullYear()} · v{process.env.NEXT_PUBLIC_APP_VERSION ?? 'dev'}</p>
      </div>

      {/* ── Modale confirmation renouvellement code ── */}
      {confirmRenewCode && (
        <div className="fixed inset-0 bg-black/40 flex items-end z-50" onClick={() => setConfirmRenewCode(false)}>
          <div className="w-full bg-white rounded-t-3xl p-6 pb-10 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 bg-[#e5e5ea] rounded-full mx-auto mb-2" />
            <p className="text-[18px] font-bold text-[#1c1c1e]">Renouveler le code ?</p>
            <p className="text-[15px] text-[#8e8e93] leading-relaxed">
              L&apos;ancien code ne fonctionnera plus. Les membres déjà dans le foyer ne sont pas affectés — il faudra partager le nouveau code aux prochaines personnes à inviter.
            </p>
            <button
              onClick={async () => {
                setRenewingCode(true);
                setConfirmRenewCode(false);
                const res = await rotateInviteCode();
                setRenewingCode(false);
                if (!res.ok) {
                  // Affichage d'erreur inline — pas d'alert()
                  console.error('[profile] rotateInviteCode:', res.error);
                }
              }}
              className="w-full py-4 rounded-2xl text-[17px] font-bold text-white"
              style={{ background: '#007aff' }}
            >
              Renouveler
            </button>
            <button
              onClick={() => setConfirmRenewCode(false)}
              className="w-full py-4 rounded-2xl text-[17px] font-medium text-[#1c1c1e] bg-[#f2f2f7]"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
