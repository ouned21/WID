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

  // Donnees du catalogue
  const [categories, setCatégories] = useState<TaskCategory[]>([]);
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);

  // Formulaire
  const [mode, setMode] = useState<'catalogue' | 'libre'>('catalogue');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [name, setName] = useState('');
  const [frequency, setFrequency] = useState<Frequency>('weekly');
  const [mentalLoadScore, setMentalLoadScore] = useState(3);
  const [assignedTo, setAssignedTo] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>('');
  const [dueTime, setDueTime] = useState<string>('09:00');
  const [error, setError] = useState<string | null>(null);

  // Charger le catalogue
  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [catRes, tplRes] = await Promise.all([
        supabase.from('task_categories').select('*').order('sort_order'),
        supabase.from('task_templates').select('*'),
      ]);
      if (catRes.data) setCatégories(catRes.data as TaskCategory[]);
      if (tplRes.data) setTemplates(tplRes.data as TaskTemplate[]);
    }
    load();
  }, []);

  // Templates filtrees par categorie selectionnee
  const filteredTemplates = useMemo(() => {
    if (!selectedCategoryId) return [];
    return templates.filter((t) => t.category_id === selectedCategoryId);
  }, [templates, selectedCategoryId]);

  // Quand on selectionne un template, pre-remplir le formulaire
  const handleSelectTemplate = (tpl: TaskTemplate) => {
    setSelectedTemplateId(tpl.id);
    setName(tpl.name);
    setFrequency(tpl.default_frequency);
    setMentalLoadScore(tpl.default_mental_load_score);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!profile?.household_id) return;
    if (!name.trim()) { setError('Le nom est obligatoire.'); return; }
    if (!selectedCategoryId && mode === 'catalogue') { setError('Choisissez une categorie.'); return; }

    const categoryId = selectedCategoryId || (categories[0]?.id ?? '');
    if (!categoryId) { setError('Aucune categorie disponible.'); return; }

    // Construire la date d'echeance si renseignee
    let nextDueAt: string | null = null;
    if (dueDate) {
      const dateTime = dueTime ? `${dueDate}T${dueTime}:00` : `${dueDate}T09:00:00`;
      nextDueAt = new Date(dateTime).toISOString();
    }

    const result = await createTask(profile.household_id, {
      name: name.trim(),
      category_id: categoryId,
      frequency,
      mental_load_score: mentalLoadScore,
      assigned_to: assignedTo || null,
      template_id: selectedTemplateId || null,
      next_due_at: nextDueAt,
    });

    if (result.ok) {
      router.push('/tasks');
    } else {
      setError(result.error ?? 'Erreur inconnue.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-900">Nouvelle tâche</h2>
        <button
          onClick={() => router.back()}
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          Annuler
        </button>
      </div>

      {/* Toggle catalogue / libre */}
      <div className="flex gap-2">
        <button
          onClick={() => setMode('catalogue')}
          className={`flex-1 rounded-lg py-2 text-sm font-medium ${
            mode === 'catalogue' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
          }`}
        >
          Depuis le catalogue
        </button>
        <button
          onClick={() => setMode('libre')}
          className={`flex-1 rounded-lg py-2 text-sm font-medium ${
            mode === 'libre' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
          }`}
        >
          Tache libre
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Selection categorie */}
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">Catégorie</label>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => { setSelectedCategoryId(cat.id); setSelectedTemplateId(''); }}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  selectedCategoryId === cat.id
                    ? 'text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
                style={selectedCategoryId === cat.id ? { backgroundColor: cat.color_hex } : {}}
              >
                {cat.icon} {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Catalogue de templates */}
        {mode === 'catalogue' && selectedCategoryId && filteredTemplates.length > 0 && (
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Choisir une tâche
            </label>
            <div className="grid grid-cols-2 gap-2">
              {filteredTemplates.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => handleSelectTemplate(tpl)}
                  className={`rounded-lg border p-3 text-left text-sm transition-colors ${
                    selectedTemplateId === tpl.id
                      ? 'border-slate-900 bg-slate-50 font-medium'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <p className="font-medium text-slate-900">{tpl.name}</p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    Charge : {tpl.default_mental_load_score}/10
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Nom de la tâche */}
        <div>
          <label htmlFor="taskName" className="block text-sm font-medium text-slate-700">
            Nom de la tâche
          </label>
          <input
            id="taskName"
            type="text"
            required
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            placeholder={mode === 'catalogue' ? 'Sélectionnez un modèle ci-dessus' : 'Ex: Nettoyer le frigo'}
          />
        </div>

        {/* Fréquence */}
        <div>
          <label htmlFor="frequency" className="block text-sm font-medium text-slate-700">
            Fréquence
          </label>
          <select
            id="frequency"
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as Frequency)}
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
          >
            {FREQUENCY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Charge mentale (0-10) */}
        <div>
          <label className="block text-sm font-medium text-slate-700">
            Charge mentale : {mentalLoadScore}/10
          </label>
          <input
            type="range"
            min={0}
            max={10}
            step={1}
            value={mentalLoadScore}
            onChange={(e) => setMentalLoadScore(Number(e.target.value))}
            className="mt-2 w-full"
          />
          <div className="flex justify-between text-xs text-slate-400">
            <span>0 — Négligeable</span>
            <span>10 — Très lourde</span>
          </div>
        </div>

        {/* Date et heure de planification */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="dueDate" className="block text-sm font-medium text-slate-700">
              Date prévue
            </label>
            <input
              id="dueDate"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            />
          </div>
          <div>
            <label htmlFor="dueTime" className="block text-sm font-medium text-slate-700">
              Heure
            </label>
            <input
              id="dueTime"
              type="time"
              value={dueTime}
              onChange={(e) => setDueTime(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            />
          </div>
        </div>

        {/* Assignation */}
        <div>
          <label htmlFor="assignedTo" className="block text-sm font-medium text-slate-700">
            Assigner a
          </label>
          <select
            id="assignedTo"
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
          >
            <option value="">Non assigné</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.display_name}</option>
            ))}
          </select>
        </div>

        {/* Bouton creer */}
        <button
          type="submit"
          disabled={creating}
          className="w-full rounded-lg bg-slate-900 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {creating ? 'Création...' : 'Créer la tâche'}
        </button>
      </form>
    </div>
  );
}
