'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useTaskStore } from '@/stores/taskStore';
import { useHouseholdStore } from '@/stores/householdStore';
import { FREQUENCY_OPTIONS } from '@/utils/frequency';
import type { Frequency, TaskCategory, TaskTemplate } from '@/types/database';
import { createClient } from '@/lib/supabase';

export default function NewTaskPage() {
  const router = useRouter();
  const { profile } = useAuthStore();
  const { createTask, creating } = useTaskStore();
  const { members } = useHouseholdStore();

  const [categories, setCategories] = useState<TaskCategory[]>([]);
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [mode, setMode] = useState<'catalogue' | 'libre'>('catalogue');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [name, setName] = useState('');
  const [frequency, setFrequency] = useState<Frequency>('weekly');
  const [mentalLoadScore, setMentalLoadScore] = useState(3);
  const [assignedTo, setAssignedTo] = useState<string>('');
  const [customIntervalDays, setCustomIntervalDays] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>('');
  const [dueTime, setDueTime] = useState<string>('09:00');
  const [startsAt, setStartsAt] = useState<string>('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [loadingCatalog, setLoadingCatalog] = useState(true);
  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [catRes, tplRes] = await Promise.all([
        supabase.from('task_categories').select('*').order('sort_order'),
        supabase.from('task_templates').select('*'),
      ]);
      if (catRes.error || tplRes.error) {
        setError('Impossible de charger le catalogue. Vérifiez votre connexion.');
      }
      if (catRes.data) setCategories(catRes.data as TaskCategory[]);
      if (tplRes.data) setTemplates(tplRes.data as TaskTemplate[]);
      setLoadingCatalog(false);
    }
    load();
  }, []);

  const filteredTemplates = useMemo(() => {
    if (!selectedCategoryId) return [];
    return templates.filter((t) => t.category_id === selectedCategoryId);
  }, [templates, selectedCategoryId]);

  const handleSelectTemplate = (tpl: TaskTemplate) => {
    setSelectedTemplateId(tpl.id);
    setName(tpl.name);
    setFrequency(tpl.default_frequency);
    setMentalLoadScore(tpl.default_mental_load_score);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null);
    if (!profile?.household_id) return;
    if (!name.trim()) { setError('Le nom est obligatoire.'); return; }
    const categoryId = selectedCategoryId || (categories[0]?.id ?? '');
    if (!categoryId) { setError('Choisissez une catégorie.'); return; }

    let nextDueAt: string | null = null;
    if (dueDate) {
      const dateTime = dueTime ? `${dueDate}T${dueTime}:00` : `${dueDate}T09:00:00`;
      nextDueAt = new Date(dateTime).toISOString();
    }

    const result = await createTask(profile.household_id, {
      name: name.trim(), category_id: categoryId, frequency,
      mental_load_score: mentalLoadScore, assigned_to: assignedTo || null,
      template_id: selectedTemplateId || null, next_due_at: nextDueAt,
      custom_interval_days: frequency === 'custom' && customIntervalDays ? parseInt(customIntervalDays, 10) : null,
      starts_at: startsAt ? new Date(`${startsAt}T00:00:00`).toISOString() : null,
    });
    if (result.ok) router.push('/tasks');
    else setError(result.error ?? 'Erreur inconnue.');
  };

  const scoreColor = mentalLoadScore >= 4 ? '#ff3b30' : mentalLoadScore >= 3 ? '#ff9500' : '#34c759';

  return (
    <div className="pt-4">
      {/* Header */}
      <div className="flex items-center justify-between px-4 mb-4">
        <button onClick={() => router.back()} className="text-[17px] font-medium" style={{ color: '#007aff' }}>
          ← Retour
        </button>
        <h2 className="text-[17px] font-semibold text-[#1c1c1e]">Nouvelle tâche</h2>
        <div className="w-16" />
      </div>

      {/* Toggle catalogue / libre */}
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
        {/* Catégories */}
        <div className="px-4">
          <p className="text-[13px] font-semibold text-[#8e8e93] uppercase tracking-wide mb-2">Catégorie</p>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button key={cat.id} type="button"
                onClick={() => { setSelectedCategoryId(cat.id); setSelectedTemplateId(''); }}
                className="rounded-full px-3.5 py-[6px] text-[13px] font-semibold transition-all"
                style={selectedCategoryId === cat.id
                  ? { background: cat.color_hex, color: 'white' }
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
                  <span className="text-[13px] text-[#8e8e93]">{tpl.default_mental_load_score}/5</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Formulaire iOS grouped */}
        <div className="mx-4 rounded-xl bg-white overflow-hidden" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
          <div className="px-4 py-3" style={{ borderBottom: '0.5px solid var(--ios-separator)' }}>
            <label className="text-[13px] text-[#8e8e93] block mb-1">Nom de la tâche</label>
            <input type="text" required maxLength={100} value={name} onChange={(e) => setName(e.target.value)}
              className="w-full text-[17px] text-[#1c1c1e] bg-transparent outline-none placeholder:text-[#c7c7cc]"
              placeholder={mode === 'catalogue' ? 'Sélectionnez ci-dessus' : 'Ex : Nettoyer le frigo'} />
          </div>

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
                placeholder="Ex : 10 (tous les 10 jours)" />
            </div>
          )}

          <div className="px-4 py-3" style={{ borderBottom: '0.5px solid var(--ios-separator)' }}>
            <label className="text-[13px] text-[#8e8e93] block mb-1">Assigner à</label>
            <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}
              className="w-full text-[17px] text-[#1c1c1e] bg-transparent outline-none">
              <option value="">Non assigné</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.display_name}</option>
              ))}
            </select>
          </div>

          <div className="px-4 py-3 flex gap-3" style={{ borderBottom: '0.5px solid var(--ios-separator)' }}>
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

          <div className="px-4 py-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-[13px] text-[#8e8e93]">Charge mentale <span className="text-[11px]">(effort cognitif et émotionnel)</span></label>
              <span className="text-[17px] font-bold" style={{ color: scoreColor }}>{mentalLoadScore}/5</span>
            </div>
            <input type="range" min={0} max={5} step={1} value={mentalLoadScore}
              onChange={(e) => setMentalLoadScore(Number(e.target.value))}
              className="w-full"
              style={{ accentColor: scoreColor }}
            />
            <div className="flex justify-between text-[11px] text-[#c7c7cc] mt-1">
              <span>Négligeable</span>
              <span>Très élevée</span>
            </div>
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
          <div className="mx-4 mt-2 rounded-xl bg-white overflow-hidden" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
            <div className="px-4 py-3" style={{ borderBottom: '0.5px solid var(--ios-separator)' }}>
              <label className="text-[13px] text-[#8e8e93] block mb-1">Date de début différée</label>
              <input type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)}
                className="w-full text-[15px] text-[#1c1c1e] bg-transparent outline-none" />
              <p className="text-[11px] text-[#c7c7cc] mt-1">La tâche n&apos;apparaîtra qu&apos;à partir de cette date</p>
            </div>
          </div>
        )}

        <div className="px-4 pt-4 pb-8">
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
