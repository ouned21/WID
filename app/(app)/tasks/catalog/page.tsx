'use client';

/**
 * Page /tasks/catalog — Gérer son catalogue de tâches en continu.
 *
 * Liste tous les templates du catalogue, groupés par catégorie.
 * Chaque ligne indique si la tâche est déjà dans le foyer (bouton Retirer)
 * ou non (bouton Ajouter). L'utilisateur peut ajouter/retirer en un tap.
 *
 * Remplace le raccourci "Revoir le tutoriel" du profil : /onboarding
 * reste un rite d'initiation, /tasks/catalog est la porte d'entrée
 * pour la gestion continue.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useTaskStore } from '@/stores/taskStore';
import BackButton from '@/components/BackButton';

// ---- Constantes partagées avec /onboarding --------------------------------

const SCORING_CAT_DISPLAY: Record<string, { label: string; emoji: string }> = {
  meals:                { label: 'Cuisine',       emoji: '🍳' },
  cleaning:             { label: 'Ménage',         emoji: '🧹' },
  tidying:              { label: 'Rangement',      emoji: '🗂' },
  shopping:             { label: 'Courses',        emoji: '🛒' },
  laundry:              { label: 'Linge',          emoji: '👕' },
  children:             { label: 'Enfants',        emoji: '🧒' },
  admin:                { label: 'Admin',          emoji: '📋' },
  outdoor:              { label: 'Extérieur',      emoji: '🌿' },
  hygiene:              { label: 'Hygiène',        emoji: '🚿' },
  pets:                 { label: 'Animaux',        emoji: '🐾' },
  vehicle:              { label: 'Voiture',        emoji: '🚗' },
  household_management: { label: 'Gestion foyer',  emoji: '🏠' },
};

const SCORING_TO_CAT_ID: Record<string, string> = {
  cleaning:             '11111111-1111-1111-1111-111111111111',
  tidying:              '22222222-2222-2222-2222-222222222222',
  shopping:             '33333333-3333-3333-3333-333333333333',
  laundry:              '44444444-4444-4444-4444-444444444444',
  children:             '55555555-5555-5555-5555-555555555555',
  meals:                '66666666-6666-6666-6666-666666666666',
  admin:                '77777777-7777-7777-7777-777777777777',
  outdoor:              '88888888-8888-8888-8888-888888888888',
  hygiene:              '99999999-9999-9999-9999-999999999999',
  pets:                 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  vehicle:              'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  household_management: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
};

const FREQ_LABEL: Record<string, string> = {
  daily: 'Chaque jour',
  weekly: '1 × semaine',
  biweekly: '1 × 2 sem.',
  monthly: '1 × mois',
  quarterly: '1 × trimestre',
  semiannual: '2 × an',
  yearly: '1 × an',
};
const FREQ_WINDOW: Record<string, number> = {
  daily: 1, weekly: 7, biweekly: 14, monthly: 30,
  quarterly: 90, semiannual: 180, yearly: 365,
};

const DURATION_LABEL: Record<string, string> = {
  very_short: '≤ 5 min',
  short: '≤ 15 min',
  medium: '≤ 30 min',
  long: '≤ 60 min',
  very_long: '> 1 h',
};

// ---- Types -----------------------------------------------------------------

type Template = {
  id: string;
  name: string;
  scoring_category: string;
  default_frequency: string;
  default_duration: string | null;
  default_physical: string | null;
  default_mental_load_score: number | null;
  sort_order: number | null;
};

// ---- Page ------------------------------------------------------------------

export default function CatalogPage() {
  const { profile } = useAuthStore();
  const { tasks, createTask, deleteTask, fetchTasks } = useTaskStore();

  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Charger le catalogue de templates (lecture publique, pas de RLS)
  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('task_templates')
        .select('id, name, scoring_category, default_frequency, default_duration, default_physical, default_mental_load_score, sort_order')
        .order('scoring_category')
        .order('sort_order', { ascending: true, nullsFirst: false });
      if (!error && data) setTemplates(data as Template[]);
      setLoading(false);
    })();
  }, []);

  // Index des tâches déjà dans le foyer : template_id + nom (fallback)
  const installed = useMemo(() => {
    const byTemplate = new Map<string, string>(); // template_id → task_id
    const byName = new Map<string, string>();     // name (lower) → task_id
    for (const t of tasks) {
      const tid = (t as unknown as { template_id?: string | null }).template_id;
      if (tid) byTemplate.set(tid, t.id);
      byName.set(t.name.toLowerCase(), t.id);
    }
    return { byTemplate, byName };
  }, [tasks]);

  const taskIdFor = useCallback((tpl: Template): string | null => {
    return installed.byTemplate.get(tpl.id) ?? installed.byName.get(tpl.name.toLowerCase()) ?? null;
  }, [installed]);

  // Filtre de recherche
  const visibleTemplates = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter((t) => t.name.toLowerCase().includes(q));
  }, [templates, search]);

  // Regroupement par catégorie (ordre : catégories présentes dans SCORING_CAT_DISPLAY)
  const grouped = useMemo(() => {
    const order = Object.keys(SCORING_CAT_DISPLAY);
    const map = new Map<string, Template[]>();
    for (const tpl of visibleTemplates) {
      const cat = tpl.scoring_category || 'misc';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(tpl);
    }
    return order
      .filter((cat) => map.has(cat))
      .map((cat) => ({ cat, templates: map.get(cat)! }))
      .concat(
        [...map.entries()]
          .filter(([cat]) => !order.includes(cat))
          .map(([cat, templates]) => ({ cat, templates })),
      );
  }, [visibleTemplates]);

  const totalInstalled = useMemo(
    () => templates.reduce((n, t) => n + (taskIdFor(t) ? 1 : 0), 0),
    [templates, taskIdFor],
  );

  // ---- Actions -------------------------------------------------------------

  const handleAdd = async (tpl: Template) => {
    if (!profile?.household_id) return;
    setPendingId(tpl.id);
    const catId = SCORING_TO_CAT_ID[tpl.scoring_category] ?? SCORING_TO_CAT_ID.cleaning;
    const freq = tpl.default_frequency || 'weekly';
    const dayOffset = freq === 'daily' ? 0 : Math.floor(Math.random() * (FREQ_WINDOW[freq] ?? 30));
    const nextDue = new Date(Date.now() + dayOffset * 86400000);
    nextDue.setHours(9, 0, 0, 0);
    await createTask(profile.household_id, {
      name: tpl.name,
      category_id: catId,
      frequency: freq as Parameters<typeof createTask>[1]['frequency'],
      mental_load_score: tpl.default_mental_load_score ?? 3,
      scoring_category: tpl.scoring_category,
      duration_estimate: tpl.default_duration ?? 'short',
      physical_effort: tpl.default_physical ?? 'medium',
      next_due_at: nextDue.toISOString(),
      template_id: tpl.id,
    });
    setPendingId(null);
  };

  const handleRemove = async (tpl: Template) => {
    const taskId = taskIdFor(tpl);
    if (!taskId) return;
    if (!confirm(`Retirer "${tpl.name}" de ton foyer ?\n\nLa tâche sera supprimée et n'apparaîtra plus dans ton planning. Son historique de complétions reste accessible depuis /tasks/archived.`)) return;
    setPendingId(tpl.id);
    await deleteTask(taskId);
    if (profile?.household_id) await fetchTasks(profile.household_id);
    setPendingId(null);
  };

  // ---- Rendu ---------------------------------------------------------------

  return (
    <div className="pt-3 pb-8" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div className="px-4">
        <BackButton label="Retour au profil" />
      </div>

      <div className="px-4 pt-1">
        <h1 className="text-[28px] font-bold text-[#1c1c1e]">Catalogue de tâches</h1>
        <p className="text-[13px] text-[#8e8e93] mt-0.5">
          {loading
            ? 'Chargement…'
            : `${totalInstalled}/${templates.length} tâches dans ton foyer · ajoute ou retire en un tap`}
        </p>
      </div>

      {/* Recherche */}
      <div className="px-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher une tâche…"
          className="w-full rounded-xl px-4 py-2.5 text-[15px] bg-white text-[#1c1c1e] outline-none placeholder:text-[#c7c7cc]"
          style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}
        />
      </div>

      {/* Info bar */}
      <div className="mx-4 rounded-xl px-3 py-2.5" style={{ background: '#f0f6ff', border: '1px solid #d0e4ff' }}>
        <p className="text-[12px] leading-relaxed" style={{ color: '#3a6fcc' }}>
          💡 Ajoute les tâches pertinentes pour ton foyer. Retire celles qui ne s&apos;appliquent pas.
          Tu peux aussi créer tes propres tâches depuis <Link href="/tasks/new" className="underline font-semibold">+ Nouvelle</Link>.
        </p>
      </div>

      {/* Liste groupée */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#e5e5ea] border-t-[#007aff]" />
        </div>
      ) : grouped.length === 0 ? (
        <div className="mx-4 rounded-2xl bg-white p-10 text-center" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
          <p className="text-[40px] mb-3">🔍</p>
          <h3 className="text-[17px] font-bold text-[#1c1c1e]">Aucun résultat</h3>
          <p className="mt-2 text-[13px] text-[#8e8e93]">Aucune tâche du catalogue ne correspond à « {search} ».</p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {grouped.map(({ cat, templates: catTemplates }) => {
            const meta = SCORING_CAT_DISPLAY[cat] ?? { label: cat, emoji: '📌' };
            const installedInCat = catTemplates.filter((t) => taskIdFor(t)).length;
            return (
              <section key={cat}>
                <div className="flex items-center gap-2 px-4 mb-2">
                  <span className="text-[18px]">{meta.emoji}</span>
                  <h3 className="text-[13px] font-semibold uppercase tracking-wide text-[#1c1c1e]">{meta.label}</h3>
                  <span className="text-[11px] text-[#8e8e93]">{installedInCat}/{catTemplates.length}</span>
                </div>
                <div className="mx-4 rounded-2xl bg-white overflow-hidden" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
                  {catTemplates.map((tpl, idx) => {
                    const isInstalled = !!taskIdFor(tpl);
                    const isPending = pendingId === tpl.id;
                    return (
                      <div
                        key={tpl.id}
                        className="flex items-center gap-3 px-4 py-3"
                        style={idx < catTemplates.length - 1 ? { borderBottom: '0.5px solid var(--ios-separator)' } : undefined}
                      >
                        <div className="flex-1 min-w-0">
                          <p className={`text-[15px] font-medium ${isInstalled ? 'text-[#1c1c1e]' : 'text-[#1c1c1e]'}`}>
                            {tpl.name}
                          </p>
                          <p className="text-[11px] text-[#8e8e93] mt-0.5">
                            {FREQ_LABEL[tpl.default_frequency] ?? tpl.default_frequency}
                            {tpl.default_duration && ` · ${DURATION_LABEL[tpl.default_duration] ?? tpl.default_duration}`}
                          </p>
                        </div>
                        {isInstalled ? (
                          <button
                            onClick={() => handleRemove(tpl)}
                            disabled={isPending}
                            className="flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-semibold disabled:opacity-40"
                            style={{ background: '#fff2f2', color: '#ff3b30' }}
                            aria-label={`Retirer ${tpl.name} du foyer`}
                          >
                            {isPending ? '…' : <><span>✓</span><span>Retirer</span></>}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleAdd(tpl)}
                            disabled={isPending}
                            className="flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-40"
                            style={{ background: '#007aff' }}
                            aria-label={`Ajouter ${tpl.name} au foyer`}
                          >
                            {isPending ? '…' : <><span>+</span><span>Ajouter</span></>}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
