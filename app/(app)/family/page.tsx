'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import {
  useFamilyStore,
  ageFromDate,
  type AddMemberPayload,
} from '@/stores/familyStore';
import { createClient } from '@/lib/supabase';
import type { PhantomMember, Observation } from '@/types/database';

// ── Icons ──────────────────────────────────────────────────────────────────

function IconBack() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function IconPlus() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function IconEdit() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" />
    </svg>
  );
}

// ── Types locaux ───────────────────────────────────────────────────────────

type MemberFormData = {
  display_name: string;
  member_type: 'adult' | 'child' | 'other';
  birth_date: string;
  school_class: string;
  allergies: string;
  activities: string;
  notes: string;
};

const EMPTY_FORM: MemberFormData = {
  display_name: '',
  member_type: 'child',
  birth_date: '',
  school_class: '',
  allergies: '',
  activities: '',
  notes: '',
};

const LIFE_EVENTS_OPTIONS = [
  'Déménagement',
  'Nouveau job',
  'Maladie',
  'Deuil',
  'Nouveau bébé',
  'Séparation / divorce',
  'Travaux à la maison',
  'Période d\'exams',
  'Vacances bientôt',
];

const ENERGY_LABELS: Record<string, string> = {
  low: '🔴 Très chargé',
  medium: '🟡 Ça tient',
  high: '🟢 En forme',
};

// ── Carte d'observation Yova ───────────────────────────────────────────────

const OBS_CONFIG: Record<string, { icon: string; label: string; bg: string; color: string }> = {
  cooking_drift:        { icon: '🍳', label: 'Repas',        bg: '#fff8ec', color: '#ff9500' },
  balance_drift:        { icon: '⚖️', label: 'Répartition',  bg: '#f0f7ff', color: '#007aff' },
  journal_silence:      { icon: '💬', label: 'Journal',      bg: '#f5f0ff', color: '#af52de' },
  task_overdue_cluster: { icon: '⏰', label: 'Retards',      bg: '#fff2f2', color: '#ff3b30' },
};

function ObservationCard({
  observation,
  onAcknowledge,
}: {
  observation: Observation;
  onAcknowledge: (id: string) => void;
}) {
  const cfg = OBS_CONFIG[observation.type] ?? { icon: '💡', label: 'Note', bg: '#f2f2f7', color: '#8e8e93' };
  const message = (observation.payload?.message as string) ?? '';

  return (
    <div
      className="flex items-start gap-3 px-4 py-3.5 rounded-2xl"
      style={{ background: cfg.bg, border: `1px solid ${cfg.color}22` }}
    >
      <span className="text-[22px] flex-shrink-0 mt-0.5">{cfg.icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold uppercase tracking-wide" style={{ color: cfg.color }}>{cfg.label}</p>
        <p className="text-[15px] text-[#1c1c1e] mt-0.5 leading-snug">{message}</p>
      </div>
      <button
        onClick={() => onAcknowledge(observation.id)}
        className="flex-shrink-0 text-[12px] font-semibold px-3 py-1.5 rounded-xl mt-0.5 transition-opacity active:opacity-60"
        style={{ background: cfg.color, color: 'white' }}
        aria-label="Marquer comme lu"
      >
        OK
      </button>
    </div>
  );
}

// ── Composant principal ────────────────────────────────────────────────────

export default function FamilyPage() {
  const router = useRouter();
  const { profile } = useAuthStore();
  const {
    householdProfile, members, loading, saving, error,
    fetchFamily, updateHouseholdProfile, toggleCrisisMode,
    addMember, updateMember, removeMember, clearError,
  } = useFamilyStore();

  // Formulaire membre
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [formData, setFormData] = useState<MemberFormData>(EMPTY_FORM);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Notes pour Yova — inline, auto-save au blur
  const [contextNotes, setContextNotes] = useState('');
  const [notesSaved, setNotesSaved] = useState(false);
  const [notesChanged, setNotesChanged] = useState(false);

  // Observations Yova
  const [observations, setObservations] = useState<Observation[]>([]);
  const [obsLoading, setObsLoading] = useState(false);

  // ── Observations : chargement + déclenchement détection ──
  const loadObservations = useCallback(async (householdId: string) => {
    setObsLoading(true);
    try {
      // 1. Lance la détection (idempotente — ne réinsère pas les doublons)
      await fetch('/api/agent/detect-observations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ household_id: householdId }),
      });
      // 2. Lit les observations non-acquittées
      const supabase = createClient();
      const { data } = await supabase
        .from('observations')
        .select('*')
        .eq('household_id', householdId)
        .is('user_acknowledged_at', null)
        .order('detected_at', { ascending: false });
      setObservations((data as Observation[]) ?? []);
    } finally {
      setObsLoading(false);
    }
  }, []);

  const handleAcknowledge = async (obsId: string) => {
    setObservations((prev) => prev.filter((o) => o.id !== obsId));
    const supabase = createClient();
    await supabase
      .from('observations')
      .update({ user_acknowledged_at: new Date().toISOString() })
      .eq('id', obsId);
  };

  // ── Init ──
  useEffect(() => {
    if (profile?.household_id) {
      fetchFamily(profile.household_id);
      loadObservations(profile.household_id);
    }
  }, [profile?.household_id, fetchFamily, loadObservations]);

  useEffect(() => {
    if (householdProfile?.notes) {
      setContextNotes(householdProfile.notes ?? '');
    }
  }, [householdProfile?.notes]);

  // ── Helpers formulaire ──
  const openAddForm = () => {
    setFormData(EMPTY_FORM);
    setEditingMemberId(null);
    setShowAddForm(true);
  };

  const openEditForm = (member: PhantomMember) => {
    setFormData({
      display_name: member.display_name,
      member_type: member.member_type,
      birth_date: member.birth_date ?? '',
      school_class: member.school_class ?? '',
      allergies: (member.specifics?.allergies ?? []).join(', '),
      activities: (member.specifics?.activities ?? []).map((a) => a.name + (a.day ? ` (${a.day})` : '')).join(', '),
      notes: member.specifics?.notes ?? '',
    });
    setEditingMemberId(member.id);
    setShowAddForm(true);
  };

  const closeForm = () => {
    setShowAddForm(false);
    setEditingMemberId(null);
    setFormData(EMPTY_FORM);
    clearError();
  };

  const buildPayloadFromForm = (): AddMemberPayload => ({
    display_name: formData.display_name.trim(),
    member_type: formData.member_type,
    birth_date: formData.birth_date || null,
    school_class: formData.school_class.trim() || null,
    specifics: {
      allergies: formData.allergies ? formData.allergies.split(',').map((s) => s.trim()).filter(Boolean) : [],
      activities: formData.activities
        ? formData.activities.split(',').map((s) => ({ name: s.trim() })).filter((a) => a.name)
        : [],
      notes: formData.notes.trim() || undefined,
    },
  });

  const handleSaveMember = async () => {
    if (!formData.display_name.trim()) return;
    const payload = buildPayloadFromForm();
    const result = editingMemberId
      ? await updateMember(editingMemberId, payload)
      : await addMember(payload);
    if (result.ok) closeForm();
  };

  const handleDeleteMember = async (id: string) => {
    const result = await removeMember(id);
    if (result.ok) setConfirmDeleteId(null);
  };

  const toggleLifeEvent = async (event: string) => {
    const current = householdProfile?.current_life_events ?? [];
    const next = current.includes(event)
      ? current.filter((e) => e !== event)
      : [...current, event];
    await updateHouseholdProfile({ current_life_events: next });
  };

  const handleSaveNotes = async () => {
    if (!notesChanged) return;
    await updateHouseholdProfile({ notes: contextNotes.trim() || null });
    setNotesChanged(false);
    setNotesSaved(true);
    setTimeout(() => setNotesSaved(false), 2000);
  };

  // ── Adults (profils réels) ──
  const { members: realMembers } = useAuthStore() as unknown as { members: undefined };
  void realMembers; // non utilisé directement ici

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-[15px] text-[#8e8e93]">Chargement du foyer…</div>
      </div>
    );
  }

  const childMembers = members.filter((m) => m.member_type === 'child');
  const adultMembers = members.filter((m) => m.member_type !== 'child');
  const isCrisis = householdProfile?.crisis_mode_active ?? false;

  return (
    <div className="px-4 pt-6 pb-32 max-w-2xl mx-auto space-y-6">

      {/* ── En-tête ── */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 text-[#007aff] text-[15px]"
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          <IconBack />
          Retour
        </button>
      </div>

      <h1 className="text-[28px] font-bold text-[#1c1c1e]">Notre famille</h1>

      {/* ── Mode crise ── */}
      <button
        onClick={() => toggleCrisisMode()}
        disabled={saving}
        className="w-full rounded-2xl px-4 py-4 text-left transition-all"
        style={{
          background: isCrisis ? '#fff2f0' : '#f2f2f7',
          border: isCrisis ? '1.5px solid #ff3b30' : '1.5px solid transparent',
        }}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[17px] font-semibold text-[#1c1c1e]">
              {isCrisis ? '🚨 Mode crise activé' : '🛡️ Mode crise'}
            </p>
            <p className="text-[13px] text-[#8e8e93] mt-0.5">
              {isCrisis
                ? 'L\'app affiche uniquement l\'essentiel. Toucher pour désactiver.'
                : 'Activer quand tout dérape — Yova passe en mode minimal vital.'}
            </p>
          </div>
          <div
            className="w-[51px] h-[31px] rounded-full flex-shrink-0 transition-colors"
            style={{ background: isCrisis ? '#ff3b30' : '#e5e5ea' }}
          >
            <div
              className="w-[27px] h-[27px] rounded-full bg-white mt-[2px] transition-transform shadow-sm"
              style={{ transform: isCrisis ? 'translateX(22px)' : 'translateX(2px)' }}
            />
          </div>
        </div>
      </button>

      {/* ── Niveau d'énergie ── */}
      <div className="rounded-2xl bg-white overflow-hidden" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.08)' }}>
        <div className="px-4 py-3 border-b border-[#f2f2f7]">
          <p className="text-[13px] font-semibold text-[#8e8e93] uppercase tracking-wide">Énergie du foyer</p>
        </div>
        <div className="flex divide-x divide-[#f2f2f7]">
          {(['low', 'medium', 'high'] as const).map((level) => (
            <button
              key={level}
              onClick={() => updateHouseholdProfile({ energy_level: level })}
              disabled={saving}
              className="flex-1 py-3 text-center text-[14px] font-medium transition-colors"
              style={{
                color: householdProfile?.energy_level === level ? '#007aff' : '#8e8e93',
                background: householdProfile?.energy_level === level ? '#f0f7ff' : 'white',
              }}
            >
              {ENERGY_LABELS[level]}
            </button>
          ))}
        </div>
      </div>

      {/* ── Événements de vie ── */}
      <div className="rounded-2xl bg-white overflow-hidden" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.08)' }}>
        <div className="px-4 py-3 border-b border-[#f2f2f7]">
          <p className="text-[13px] font-semibold text-[#8e8e93] uppercase tracking-wide">Ce qu&apos;on traverse</p>
          <p className="text-[12px] text-[#8e8e93] mt-0.5">Yova en tient compte pour adapter ses suggestions.</p>
        </div>
        <div className="px-4 py-3 flex flex-wrap gap-2">
          {LIFE_EVENTS_OPTIONS.map((event) => {
            const selected = householdProfile?.current_life_events?.includes(event) ?? false;
            return (
              <button
                key={event}
                onClick={() => toggleLifeEvent(event)}
                disabled={saving}
                className="px-3 py-1.5 rounded-full text-[13px] font-medium transition-colors"
                style={{
                  background: selected ? '#007aff' : '#f2f2f7',
                  color: selected ? 'white' : '#1c1c1e',
                }}
              >
                {event}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Enfants ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[22px] font-bold text-[#1c1c1e]">Enfants</h2>
          <button
            onClick={openAddForm}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full text-[14px] font-semibold text-white"
            style={{ background: '#007aff' }}
          >
            <IconPlus /> Ajouter
          </button>
        </div>

        {childMembers.length === 0 && (
          <div
            className="rounded-2xl px-4 py-5 text-center text-[14px] text-[#8e8e93]"
            style={{ background: '#f9f9f9', border: '1.5px dashed #d1d1d6' }}
          >
            Aucun enfant ajouté.{' '}
            <button className="text-[#007aff] font-medium" onClick={openAddForm}>
              Ajouter
            </button>
          </div>
        )}

        <div className="space-y-3">
          {childMembers.map((child) => (
            <MemberCard
              key={child.id}
              member={child}
              onEdit={() => openEditForm(child)}
              onDelete={() => setConfirmDeleteId(child.id)}
            />
          ))}
        </div>
      </section>

      {/* ── Adultes sans compte ── */}
      {adultMembers.length > 0 && (
        <section>
          <h2 className="text-[22px] font-bold text-[#1c1c1e] mb-3">Autres membres</h2>
          <div className="space-y-3">
            {adultMembers.map((adult) => (
              <MemberCard
                key={adult.id}
                member={adult}
                onEdit={() => openEditForm(adult)}
                onDelete={() => setConfirmDeleteId(adult.id)}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Notes pour Yova ── */}
      <div className="rounded-2xl bg-white overflow-hidden" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.08)' }}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#f2f2f7]">
          <div>
            <p className="text-[13px] font-semibold text-[#8e8e93] uppercase tracking-wide">Notes pour Yova</p>
            <p className="text-[12px] text-[#8e8e93] mt-0.5">Tout ce qui peut aider Yova à mieux vous connaître.</p>
          </div>
          {notesSaved && (
            <span className="text-[13px] text-[#34c759] font-medium">Enregistré ✓</span>
          )}
          {saving && (
            <span className="text-[13px] text-[#8e8e93]">…</span>
          )}
        </div>
        <div className="px-4 py-3">
          <textarea
            value={contextNotes}
            onChange={(e) => { setContextNotes(e.target.value); setNotesChanged(true); setNotesSaved(false); }}
            onBlur={handleSaveNotes}
            rows={4}
            placeholder="Ex: On prépare un déménagement en juillet, les filles ont des examens en juin, Barbara commence un nouveau job en mai…"
            className="w-full text-[15px] text-[#1c1c1e] bg-transparent outline-none resize-none placeholder:text-[#c7c7cc] leading-relaxed"
          />
        </div>
      </div>

      {/* ── Ce que Yova a remarqué ⭐ ── */}
      {(obsLoading || observations.length > 0) && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-[13px] font-bold text-white flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)' }}>Y</div>
            <h2 className="text-[17px] font-semibold text-[#1c1c1e]">Ce que Yova a remarqué</h2>
          </div>

          {obsLoading && observations.length === 0 ? (
            <div className="rounded-2xl bg-white px-4 py-4 flex items-center gap-3" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.08)' }}>
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#e5e5ea] border-t-[#007aff] flex-shrink-0" />
              <p className="text-[14px] text-[#8e8e93]">Yova analyse votre foyer…</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {observations.map((obs) => (
                <ObservationCard
                  key={obs.id}
                  observation={obs}
                  onAcknowledge={handleAcknowledge}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {error && (
        <div className="rounded-xl px-4 py-3 text-[14px]" style={{ background: '#fff2f2', color: '#ff3b30' }}>
          {error}
        </div>
      )}

      {/* ── Modale formulaire membre ── */}
      {showAddForm && (
        <MemberFormModal
          formData={formData}
          setFormData={setFormData}
          isEditing={editingMemberId !== null}
          saving={saving}
          error={error}
          onSave={handleSaveMember}
          onClose={closeForm}
        />
      )}

      {/* ── Confirm suppression ── */}
      {confirmDeleteId && (
        <div className="fixed inset-0 bg-black/40 flex items-end z-50" onClick={() => setConfirmDeleteId(null)}>
          <div
            className="w-full bg-white rounded-t-3xl px-4 pt-5 pb-10 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[17px] font-semibold text-[#1c1c1e] text-center">Supprimer ce membre ?</p>
            <p className="text-[14px] text-[#8e8e93] text-center">Ses tâches et complétions ne seront pas supprimées.</p>
            <button
              onClick={() => handleDeleteMember(confirmDeleteId)}
              disabled={saving}
              className="w-full py-3.5 rounded-xl text-[17px] font-semibold text-white"
              style={{ background: '#ff3b30' }}
            >
              Supprimer
            </button>
            <button
              onClick={() => setConfirmDeleteId(null)}
              className="w-full py-3.5 rounded-xl text-[17px] font-medium text-[#1c1c1e] bg-[#f2f2f7]"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Composant carte membre ─────────────────────────────────────────────────

function MemberCard({ member, onEdit, onDelete }: {
  member: PhantomMember;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const age = ageFromDate(member.birth_date);
  const allergies = member.specifics?.allergies ?? [];
  const activities = member.specifics?.activities ?? [];

  return (
    <div
      className="rounded-2xl bg-white px-4 py-4"
      style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.08)' }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[17px] font-semibold text-[#1c1c1e]">{member.display_name}</span>
            {member.member_type === 'child' && (
              <span
                className="px-2 py-0.5 rounded-full text-[12px] font-medium"
                style={{ background: '#f0f7ff', color: '#007aff' }}
              >
                Enfant
              </span>
            )}
            {age !== null && (
              <span className="text-[14px] text-[#8e8e93]">{age} ans</span>
            )}
          </div>

          <div className="mt-1.5 space-y-0.5 text-[13px] text-[#8e8e93]">
            {member.school_class && (
              <p>🏫 {member.school_class}</p>
            )}
            {allergies.length > 0 && (
              <p>⚠️ Allergies : {allergies.join(', ')}</p>
            )}
            {activities.length > 0 && (
              <p>🎯 {activities.map((a) => a.name + (a.day ? ` (${a.day})` : '')).join(' · ')}</p>
            )}
            {member.specifics?.notes && (
              <p className="text-[12px] italic">💬 {member.specifics.notes}</p>
            )}
          </div>
        </div>

        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={onEdit}
            className="p-2 rounded-full"
            style={{ background: '#f2f2f7', color: '#8e8e93' }}
          >
            <IconEdit />
          </button>
          <button
            onClick={onDelete}
            className="p-2 rounded-full"
            style={{ background: '#fff2f2', color: '#ff3b30' }}
          >
            <IconTrash />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Formulaire ajout / édition membre ─────────────────────────────────────

function MemberFormModal({ formData, setFormData, isEditing, saving, error, onSave, onClose }: {
  formData: MemberFormData;
  setFormData: (d: MemberFormData) => void;
  isEditing: boolean;
  saving: boolean;
  error: string | null;
  onSave: () => void;
  onClose: () => void;
}) {
  const update = (field: keyof MemberFormData, value: string) =>
    setFormData({ ...formData, [field]: value });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end z-50">
      <div className="w-full bg-white rounded-t-3xl max-h-[90vh] overflow-y-auto">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-[#d1d1d6]" />
        </div>

        <div className="px-4 pb-10 space-y-4">
          <h2 className="text-[20px] font-bold text-[#1c1c1e]">
            {isEditing ? 'Modifier le membre' : 'Ajouter un membre'}
          </h2>

          {error && (
            <div className="rounded-xl px-4 py-3 text-[14px]" style={{ background: '#fff2f2', color: '#ff3b30' }}>
              {error}
            </div>
          )}

          {/* Type */}
          <div>
            <label className="text-[13px] text-[#8e8e93] block mb-2">Type</label>
            <div className="flex gap-2">
              {(['child', 'adult', 'other'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => update('member_type', t)}
                  className="flex-1 py-2 rounded-xl text-[14px] font-medium transition-colors"
                  style={{
                    background: formData.member_type === t ? '#007aff' : '#f2f2f7',
                    color: formData.member_type === t ? 'white' : '#1c1c1e',
                  }}
                >
                  {t === 'child' ? '👧 Enfant' : t === 'adult' ? '👤 Adulte' : '🤝 Autre'}
                </button>
              ))}
            </div>
          </div>

          {/* Prénom */}
          <div className="rounded-xl bg-[#f9f9f9] px-4 py-3" style={{ border: '1px solid #e5e5ea' }}>
            <label className="text-[13px] text-[#8e8e93] block mb-1">Prénom *</label>
            <input
              type="text"
              value={formData.display_name}
              onChange={(e) => update('display_name', e.target.value)}
              placeholder={formData.member_type === 'child' ? 'Léa' : 'Barbara'}
              className="w-full text-[17px] text-[#1c1c1e] bg-transparent outline-none placeholder:text-[#c7c7cc]"
            />
          </div>

          {/* Date de naissance */}
          <div className="rounded-xl bg-[#f9f9f9] px-4 py-3" style={{ border: '1px solid #e5e5ea' }}>
            <label className="text-[13px] text-[#8e8e93] block mb-1">Date de naissance</label>
            <input
              type="date"
              value={formData.birth_date}
              onChange={(e) => update('birth_date', e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              className="w-full text-[17px] text-[#1c1c1e] bg-transparent outline-none"
            />
          </div>

          {/* Classe (enfants) */}
          {formData.member_type === 'child' && (
            <div className="rounded-xl bg-[#f9f9f9] px-4 py-3" style={{ border: '1px solid #e5e5ea' }}>
              <label className="text-[13px] text-[#8e8e93] block mb-1">Classe scolaire</label>
              <input
                type="text"
                value={formData.school_class}
                onChange={(e) => update('school_class', e.target.value)}
                placeholder="Ex: CP, CE2, 6ème, Terminale…"
                className="w-full text-[17px] text-[#1c1c1e] bg-transparent outline-none placeholder:text-[#c7c7cc]"
              />
            </div>
          )}

          {/* Allergies */}
          <div className="rounded-xl bg-[#f9f9f9] px-4 py-3" style={{ border: '1px solid #e5e5ea' }}>
            <label className="text-[13px] text-[#8e8e93] block mb-1">Allergies</label>
            <input
              type="text"
              value={formData.allergies}
              onChange={(e) => update('allergies', e.target.value)}
              placeholder="Ex: arachides, gluten, lactose (séparées par virgules)"
              className="w-full text-[17px] text-[#1c1c1e] bg-transparent outline-none placeholder:text-[#c7c7cc]"
            />
          </div>

          {/* Activités */}
          <div className="rounded-xl bg-[#f9f9f9] px-4 py-3" style={{ border: '1px solid #e5e5ea' }}>
            <label className="text-[13px] text-[#8e8e93] block mb-1">Activités</label>
            <input
              type="text"
              value={formData.activities}
              onChange={(e) => update('activities', e.target.value)}
              placeholder="Ex: danse le mercredi, foot le samedi"
              className="w-full text-[17px] text-[#1c1c1e] bg-transparent outline-none placeholder:text-[#c7c7cc]"
            />
          </div>

          {/* Notes */}
          <div className="rounded-xl bg-[#f9f9f9] px-4 py-3" style={{ border: '1px solid #e5e5ea' }}>
            <label className="text-[13px] text-[#8e8e93] block mb-1">Notes libres</label>
            <textarea
              value={formData.notes}
              onChange={(e) => update('notes', e.target.value)}
              rows={3}
              placeholder="Tout ce qui peut être utile pour Yova…"
              className="w-full text-[15px] text-[#1c1c1e] bg-transparent outline-none resize-none placeholder:text-[#c7c7cc]"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onSave}
              disabled={saving || !formData.display_name.trim()}
              className="flex-1 py-3.5 rounded-xl text-[17px] font-semibold text-white disabled:opacity-50"
              style={{ background: '#007aff' }}
            >
              {saving ? 'Enregistrement…' : isEditing ? 'Enregistrer' : 'Ajouter'}
            </button>
            <button
              onClick={onClose}
              className="px-5 py-3.5 rounded-xl text-[17px] font-medium text-[#1c1c1e] bg-[#f2f2f7]"
            >
              Annuler
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
