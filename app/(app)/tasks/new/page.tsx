'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useTaskStore } from '@/stores/taskStore';
import { useHouseholdStore } from '@/stores/householdStore';
import { FREQUENCY_OPTIONS } from '@/utils/frequency';
import {
  computeTaskScore,
  DURATION_OPTIONS,
  PHYSICAL_OPTIONS,
  SCORING_CATEGORY_OPTIONS,
  timeLabel,
  physicalLabel,
  mentalLabel,
  impactLabel,
  dominantEmoji,
  type DurationEstimate,
  type PhysicalEffort,
  type TaskCategory as ScoringCategory,
  type ScoreBreakdown,
} from '@/utils/taskScoring';
import type { Frequency, TaskCategory, TaskTemplate } from '@/types/database';
import { createClient } from '@/lib/supabase';

export default function NewTaskPage() {
  const router = useRouter();
  const { profile } = useAuthStore();
  const { createTask, creating } = useTaskStore();
  const { members } = useHouseholdStore();

  // Catalogue
  const [dbCategories, setDbCategories] = useState<TaskCategory[]>([]);
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);

  // Mode
  const [mode, setMode] = useState<'catalogue' | 'libre'>('catalogue');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');

  // Inputs scoring (5 champs)
  const [name, setName] = useState('');
  const [scoringCategory, setScoringCategory] = useState<ScoringCategory>('misc');
  const [duration, setDuration] = useState<DurationEstimate>('medium');
  const [physical, setPhysical] = useState<PhysicalEffort>('light');
  const [frequency, setFrequency] = useState<Frequency>('weekly');

  // Extras
  const [assignedTo, setAssignedTo] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('09:00');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [startsAt, setStartsAt] = useState('');
  const [customIntervalDays, setCustomIntervalDays] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Charger le catalogue
  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [catRes, tplRes] = await Promise.all([
        supabase.from('task_categories').select('*').order('sort_order'),
        supabase.from('task_templates').select('*'),
      ]);
      if (catRes.error || tplRes.error) setError('Impossible de charger le catalogue.');
      if (catRes.data) setDbCategories(catRes.data as TaskCategory[]);
      if (tplRes.data) setTemplates(tplRes.data as TaskTemplate[]);
      setLoadingCatalog(false);
    }
    load();
  }, []);

  const filteredTemplates = useMemo(() => {
    if (!selectedCategoryId) return [];
    return templates.filter((t) => t.category_id === selectedCategoryId);
  }, [templates, selectedCategoryId]);

  // Score calculé en temps réel
  const score: ScoreBreakdown = useMemo(() => {
    return computeTaskScore({ title: name, category: scoringCategory, duration, physical, frequency });
  }, [name, scoringCategory, duration, physical, frequency]);

  const handleSelectTemplate = (tpl: TaskTemplate) => {
    setSelectedTemplateId(tpl.id);
    setName(tpl.name);
    setFrequency(tpl.default_frequency);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!profile?.household_id) return;
    if (!name.trim()) { setError('Le nom est obligatoire.'); return; }
    const categoryId = selectedCategoryId || (dbCategories[0]?.id ?? '');
    if (!categoryId) { setError('Choisissez une catégorie.'); return; }

    let nextDueAt: string | null = null;
    if (dueDate) {
      nextDueAt = new Date(`${dueDate}T${dueTime || '09:00'}:00`).toISOString();
    }

    const result = await createTask(profile.household_id, {
      name: name.trim(),
      category_id: categoryId,
      frequency,
      mental_load_score: Math.round(score.global_score / 7), // Compat 0-5 pour l'ancien champ
      assigned_to: assignedTo || null,
      template_id: selectedTemplateId || null,
      next_due_at: nextDueAt,
      custom_interval_days: frequency === 'custom' && customIntervalDays ? parseInt(customIntervalDays, 10) : null,
      starts_at: startsAt ? new Date(`${startsAt}T00:00:00`).toISOString() : null,
    });
    if (result.ok) router.push('/tasks');
    else setError(result.error ?? 'Erreur inconnue.');
  };

  const globalColor =
    score.global_score <= 8 ? '#34c759' :
    score.global_score <= 16 ? '#007aff' :
    score.global_score <= 24 ? '#ff9500' :
    '#ff3b30';

  return (
    <div className="pt-4">
      <div className="flex items-center justify-between px-4 mb-4">
        <button onClick={() => router.back()} className="text-[17px] font-medium" style={{ color: '#007aff' }}>← Retour</button>
        <h2 className="text-[17px] font-semibold text-[#1c1c1e]">Nouvelle tâche</h2>
        <div className="w-16" />
      </div>

      {/* Toggle */}
      <div className="mx-4 mb-4 rounded-lg p-0.5 flex" style={{ background: '#e5e5ea' }}>
        <button onClick={() => setMode('catalogue')}
          className={`flex-1 rounded-md py-[6px] text-[13px] font-semibold transition-all ${mode === 'catalogue' ? 'bg-white text-[#1c1c1e] shadow-sm' : 'text-[#8e8e93]'}`}>
          Catalogue
        </button>
        <button onClick={() => setMode('libre')}
          className={`flex-1 rounded-md py-[6px] text-[13px] font-semibold transition-all ${mode === 'libre' ? 'bg-white text-[#1c1c1e] shadow-sm' : 'text-[#8e8e93]'}`}>
          Tâche libre
        </button>
      </div>

      {error && (
        <div className="mx-4 mb-4 rounded-xl px-4 py-3 text-[14px]" style={{ background: '#fff2f2', color: '#ff3b30' }}>{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Catégorie DB (pour le lien avec Supabase) */}
        <div className="px-4">
          <p className="text-[13px] font-semibold text-[#8e8e93] uppercase tracking-wide mb-2">Catégorie</p>
          <div className="flex flex-wrap gap-2">
            {dbCategories.map((cat) => (
              <button key={cat.id} type="button"
                onClick={() => { setSelectedCategoryId(cat.id); setSelectedTemplateId(''); }}
                className="rounded-full px-3.5 py-[6px] text-[13px] font-semibold transition-all"
                style={selectedCategoryId === cat.id
                  ? { background: cat.color_hex, color: (() => { const hex = cat.color_hex.replace('#',''); const r = parseInt(hex.substring(0,2),16); const g = parseInt(hex.substring(2,4),16); const b = parseInt(hex.substring(4,6),16); return (0.299*r+0.587*g+0.114*b)/255 > 0.6 ? '#1c1c1e' : '#fff'; })() }
                  : { background: 'white', color: '#3c3c43', boxShadow: '0 0.5px 2px rgba(0,0,0,0.08)' }
                }>
                {/\p{Emoji}/u.test(cat.icon) ? `${cat.icon} ` : ''}{cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Templates */}
        {mode === 'catalogue' && selectedCategoryId && filteredTemplates.length > 0 && (
          <div className="px-4">
            <p className="text-[13px] font-semibold text-[#8e8e93] uppercase tracking-wide mb-2">Choisir une tâche</p>
            <div className="rounded-xl bg-white overflow-hidden" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
              {filteredTemplates.map((tpl, i) => (
                <button key={tpl.id} type="button" onClick={() => handleSelectTemplate(tpl)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left transition-all"
                  style={{
                    ...(i < filteredTemplates.length - 1 ? { borderBottom: '0.5px solid var(--ios-separator)' } : {}),
                    ...(selectedTemplateId === tpl.id ? { background: '#f0f4ff' } : {}),
                  }}>
                  <div className="flex items-center gap-3">
                    {selectedTemplateId === tpl.id && (
                      <svg width="18" height="18" fill="#007aff" viewBox="0 0 24 24"><path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>
                    )}
                    <p className={`text-[15px] ${selectedTemplateId === tpl.id ? 'font-semibold text-[#007aff]' : 'text-[#1c1c1e]'}`}>{tpl.name}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Formulaire principal */}
        <div className="mx-4 rounded-xl bg-white overflow-hidden" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
          {/* Nom */}
          <div className="px-4 py-3" style={{ borderBottom: '0.5px solid var(--ios-separator)' }}>
            <label className="text-[13px] text-[#8e8e93] block mb-1">Nom de la tâche</label>
            <input type="text" required maxLength={100} value={name} onChange={(e) => setName(e.target.value)}
              className="w-full text-[17px] text-[#1c1c1e] bg-transparent outline-none placeholder:text-[#c7c7cc]"
              placeholder="Ex : Préparer le dîner" />
          </div>

          {/* Type de tâche (scoring) */}
          <div className="px-4 py-3" style={{ borderBottom: '0.5px solid var(--ios-separator)' }}>
            <label className="text-[13px] text-[#8e8e93] block mb-2">Type de tâche</label>
            <div className="flex flex-wrap gap-1.5">
              {SCORING_CATEGORY_OPTIONS.map((opt) => (
                <button key={opt.value} type="button" onClick={() => setScoringCategory(opt.value)}
                  className="rounded-full px-2.5 py-1 text-[12px] font-medium transition-all"
                  style={scoringCategory === opt.value
                    ? { background: '#007aff', color: 'white' }
                    : { background: '#f2f2f7', color: '#3c3c43' }
                  }>
                  {opt.emoji} {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Durée */}
          <div className="px-4 py-3" style={{ borderBottom: '0.5px solid var(--ios-separator)' }}>
            <label className="text-[13px] text-[#8e8e93] block mb-2">Durée estimée</label>
            <div className="flex gap-1.5">
              {DURATION_OPTIONS.map((opt) => (
                <button key={opt.value} type="button" onClick={() => setDuration(opt.value)}
                  className="flex-1 rounded-lg py-2 text-[12px] font-medium text-center transition-all"
                  style={duration === opt.value
                    ? { background: '#007aff', color: 'white' }
                    : { background: '#f2f2f7', color: '#3c3c43' }
                  }>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Effort physique */}
          <div className="px-4 py-3" style={{ borderBottom: '0.5px solid var(--ios-separator)' }}>
            <label className="text-[13px] text-[#8e8e93] block mb-2">Effort physique</label>
            <div className="flex gap-1.5">
              {PHYSICAL_OPTIONS.map((opt) => (
                <button key={opt.value} type="button" onClick={() => setPhysical(opt.value)}
                  className="flex-1 rounded-lg py-2 text-[12px] font-medium text-center transition-all"
                  style={physical === opt.value
                    ? { background: '#007aff', color: 'white' }
                    : { background: '#f2f2f7', color: '#3c3c43' }
                  }>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Fréquence */}
          <div className="px-4 py-3" style={{ borderBottom: '0.5px solid var(--ios-separator)' }}>
            <label className="text-[13px] text-[#8e8e93] block mb-1">Fréquence</label>
            <select value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)}
              className="w-full text-[17px] text-[#1c1c1e] bg-transparent outline-none">
              {FREQUENCY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {frequency === 'custom' && (
            <div className="px-4 py-3" style={{ borderBottom: '0.5px solid var(--ios-separator)' }}>
              <label className="text-[13px] text-[#8e8e93] block mb-1">Intervalle en jours</label>
              <input type="number" min={1} max={365} value={customIntervalDays}
                onChange={(e) => setCustomIntervalDays(e.target.value)}
                className="w-full text-[17px] text-[#1c1c1e] bg-transparent outline-none placeholder:text-[#c7c7cc]"
                placeholder="Ex : 10" />
            </div>
          )}

          {/* Assignation */}
          <div className="px-4 py-3" style={{ borderBottom: '0.5px solid var(--ios-separator)' }}>
            <label className="text-[13px] text-[#8e8e93] block mb-1">Assigner à</label>
            <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}
              className="w-full text-[17px] text-[#1c1c1e] bg-transparent outline-none">
              <option value="">Non assigné</option>
              {members.map((m) => (<option key={m.id} value={m.id}>{m.display_name}</option>))}
            </select>
          </div>

          {/* Date / Heure */}
          <div className="px-4 py-3 flex gap-3">
            <div className="flex-1">
              <label className="text-[13px] text-[#8e8e93] block mb-1">Date prévue</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
                className="w-full text-[15px] text-[#1c1c1e] bg-transparent outline-none" />
            </div>
            <div className="w-24">
              <label className="text-[13px] text-[#8e8e93] block mb-1">Heure</label>
              <input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)}
                className="w-full text-[15px] text-[#1c1c1e] bg-transparent outline-none" />
            </div>
          </div>
        </div>

        {/* Score en temps réel */}
        <div className="mx-4 rounded-2xl p-4" style={{ background: 'white', boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[13px] font-semibold text-[#8e8e93] uppercase tracking-wide">Score estimé</p>
            <div className="flex items-center gap-2">
              <span className="text-[11px]">{dominantEmoji(score.dominant)}</span>
              <span className="text-[22px] font-bold" style={{ color: globalColor }}>{score.global_score}</span>
              <span className="text-[13px] text-[#8e8e93]">/ 36</span>
            </div>
          </div>
          <p className="text-[14px] font-semibold mb-3" style={{ color: globalColor }}>{score.global_label}</p>

          {/* 4 jauges */}
          <div className="space-y-2">
            <ScoreBar label="⏱ Temps" value={score.time_score} max={8} sublabel={timeLabel(score.time_score)} />
            <ScoreBar label="💪 Physique" value={score.physical_score} max={5} sublabel={physicalLabel(score.physical_score)} />
            <ScoreBar label="🧠 Mental" value={score.mental_load_score} max={18} sublabel={mentalLabel(score.mental_load_score)} />
            <ScoreBar label="👨‍👩‍👧 Impact" value={score.household_impact_score} max={4} sublabel={impactLabel(score.household_impact_score)} />
          </div>
        </div>

        {/* Options avancées */}
        <div className="px-4">
          <button type="button" onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-[14px] font-medium" style={{ color: '#007aff' }}>
            {showAdvanced ? '▾ Masquer les options avancées' : '▸ Options avancées'}
          </button>
        </div>

        {showAdvanced && (
          <div className="mx-4 rounded-xl bg-white overflow-hidden" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
            <div className="px-4 py-3">
              <label className="text-[13px] text-[#8e8e93] block mb-1">Date de début différée</label>
              <input type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)}
                className="w-full text-[15px] text-[#1c1c1e] bg-transparent outline-none" />
              <p className="text-[11px] text-[#c7c7cc] mt-1">La tâche n&apos;apparaîtra qu&apos;à partir de cette date</p>
            </div>
          </div>
        )}

        {/* Créer */}
        <div className="px-4 pt-2 pb-8">
          <button type="submit" disabled={creating}
            className="w-full rounded-xl py-[14px] text-[17px] font-semibold text-white disabled:opacity-50"
            style={{ background: '#007aff' }}>
            {creating ? 'Création...' : 'Créer la tâche'}
          </button>
        </div>
      </form>
    </div>
  );
}

// -- Composant jauge -----------------------------------------------------------

function ScoreBar({ label, value, max, sublabel }: { label: string; value: number; max: number; sublabel: string }) {
  const pct = Math.min(100, (value / max) * 100);
  const color =
    pct <= 33 ? '#34c759' :
    pct <= 66 ? '#ff9500' :
    '#ff3b30';

  return (
    <div className="flex items-center gap-3">
      <span className="text-[12px] w-20 flex-shrink-0">{label}</span>
      <div className="flex-1 h-2 rounded-full" style={{ background: '#f2f2f7' }}>
        <div className="h-2 rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-[11px] text-[#8e8e93] w-16 text-right flex-shrink-0">{sublabel}</span>
    </div>
  );
}
