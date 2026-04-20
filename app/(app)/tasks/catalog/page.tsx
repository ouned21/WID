'use client';

/**
 * Page /tasks/catalog — Gérer son catalogue de tâches en continu.
 *
 * Liste les templates groupés par catégorie (repliables). Chaque ligne
 * indique si la tâche est déjà dans le foyer (bouton Retirer) ou non
 * (bouton Ajouter). Tap sur une tâche installée → fiche détail.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useTaskStore } from '@/stores/taskStore';
import BackButton from '@/components/BackButton';

// ---- Constantes ----------------------------------------------------------

const SCORING_CAT_DISPLAY: Record<string, { label: string; emoji: string }> = {
  meals:                { label: 'Cuisine',       emoji: '🍳' },
  cleaning:             { label: 'Ménage',         emoji: '🧹' },
  tidying:              { label: 'Rangement',      emoji: '🗂️' },
  shopping:             { label: 'Courses',        emoji: '🛒' },
  laundry:              { label: 'Linge',          emoji: '👕' },
  children:             { label: 'Enfants',        emoji: '🧒' },
  admin:                { label: 'Admin',          emoji: '📋' },
  outdoor:              { label: 'Extérieur',      emoji: '🌿' },
  hygiene:              { label: 'Hygiène',        emoji: '🚿' },
  pets:                 { label: 'Animaux',        emoji: '🐾' },
  vehicle:              { label: 'Voiture',        emoji: '🚗' },
  transport:            { label: 'Transport',      emoji: '🚌' },
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
  transport:            'dddddddd-dddd-dddd-dddd-dddddddddddd',
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

// ---- Types ---------------------------------------------------------------

type Template = {
  id: string;
  name: string;
  scoring_category: string;
  default_frequency: string;
  default_duration: string | null;
  default_physical: string | null;
  default_mental_load_score: number | null;
  description: string | null;
  sort_order: number | null;
};

type FilterMode = 'all' | 'missing' | 'installed';

// ---- Page ----------------------------------------------------------------

export default function CatalogPage() {
  const router = useRouter();
  const { profile } = useAuthStore();
  const { tasks, createTask, deleteTask, fetchTasks } = useTaskStore();

  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showDescId, setShowDescId] = useState<string | null>(null);

  // Charger les templates (lecture publique)
  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('task_templates')
        .select('id, name, scoring_category, default_frequency, default_duration, default_physical, default_mental_load_score, description, sort_order')
        .order('scoring_category')
        .order('sort_order', { ascending: true, nullsFirst: false });
      if (!error && data) setTemplates(data as Template[]);
      setLoading(false);
    })();
  }, []);

  // Index tâches installées : template_id + nom (fallback)
  const installed = useMemo(() => {
    const byTemplate = new Map<string, string>();
    const byName = new Map<string, string>();
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

  // Filtre recherche + mode
  const visibleTemplates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return templates.filter((t) => {
      if (q && !t.name.toLowerCase().includes(q) && !(t.description?.toLowerCase().includes(q) ?? false)) return false;
      if (filterMode === 'missing' && taskIdFor(t)) return false;
      if (filterMode === 'installed' && !taskIdFor(t)) return false;
      return true;
    });
  }, [templates, search, filterMode, taskIdFor]);

  // Groupage par catégorie + tri par pertinence (catégories utilisées en premier)
  const grouped = useMemo(() => {
    const map = new Map<string, Template[]>();
    for (const tpl of visibleTemplates) {
      const cat = tpl.scoring_category || 'misc';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(tpl);
    }
    const entries = [...map.entries()].map(([cat, items]) => {
      const installedCount = items.filter((t) => taskIdFor(t)).length;
      return { cat, templates: items, installedCount };
    });
    // Pertinence : catégories avec tâches installées d'abord (desc),
    // puis ordre canonique de SCORING_CAT_DISPLAY pour stabilité.
    const canonicalOrder = Object.keys(SCORING_CAT_DISPLAY);
    entries.sort((a, b) => {
      if (a.installedCount !== b.installedCount) return b.installedCount - a.installedCount;
      return canonicalOrder.indexOf(a.cat) - canonicalOrder.indexOf(b.cat);
    });
    return entries;
  }, [visibleTemplates, taskIdFor]);

  // Première catégorie expanded par défaut, ou toutes si recherche active
  useEffect(() => {
    if (search.trim() || filterMode !== 'all') {
      setExpanded(new Set(grouped.map((g) => g.cat)));
    } else if (grouped.length > 0 && expanded.size === 0) {
      setExpanded(new Set([grouped[0].cat]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, filterMode, grouped.length]);

  const toggleCat = (cat: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

  const totalInstalled = templates.reduce((n, t) => n + (taskIdFor(t) ? 1 : 0), 0);

  // ---- Actions -----------------------------------------------------------

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

  // ---- Rendu -------------------------------------------------------------

  return (
    <div className="pt-3 pb-32" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div className="px-4">
        <BackButton label="Retour au profil" />
      </div>

      {/* Header : titre + CTA */}
      <div className="px-4 pt-1 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-[28px] font-bold text-[#1c1c1e]">Catalogue de tâches</h1>
          <p className="text-[13px] text-[#8e8e93] mt-0.5">
            {loading
              ? 'Chargement…'
              : <>Tu as installé <strong className="text-[#1c1c1e]">{totalInstalled}</strong> des <strong className="text-[#1c1c1e]">{templates.length}</strong> tâches proposées.</>}
          </p>
        </div>
        <Link href="/tasks/new"
          className="flex items-center gap-1 rounded-full px-3 py-2 text-[13px] font-semibold text-white flex-shrink-0"
          style={{ background: '#007aff' }}>
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" viewBox="0 0 24 24">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Nouvelle
        </Link>
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

      {/* Filtre mode */}
      <div className="px-4 flex gap-1.5">
        {([
          { v: 'all', label: `Tout (${templates.length})` },
          { v: 'missing', label: `À ajouter (${templates.length - totalInstalled})` },
          { v: 'installed', label: `Installées (${totalInstalled})` },
        ] as const).map((opt) => {
          const active = filterMode === opt.v;
          return (
            <button
              key={opt.v}
              onClick={() => setFilterMode(opt.v)}
              className="rounded-full px-3.5 py-[7px] text-[13px] font-semibold transition-all"
              style={active
                ? { background: '#007aff', color: 'white' }
                : { background: 'white', color: '#3c3c43', boxShadow: '0 0.5px 2px rgba(0,0,0,0.08)' }
              }>
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* Liste */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#e5e5ea] border-t-[#007aff]" />
        </div>
      ) : grouped.length === 0 ? (
        <div className="mx-4 rounded-2xl bg-white p-10 text-center" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
          <p className="text-[40px] mb-3">🔍</p>
          <h3 className="text-[17px] font-bold text-[#1c1c1e]">Aucun résultat</h3>
          <p className="mt-2 text-[13px] text-[#8e8e93]">
            {search ? `Aucune tâche ne correspond à « ${search} ».` : 'Aucune tâche dans ce filtre.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {grouped.map(({ cat, templates: catTemplates, installedCount }) => {
            const meta = SCORING_CAT_DISPLAY[cat] ?? { label: cat, emoji: '📌' };
            const isOpen = expanded.has(cat);
            return (
              <section key={cat} className="mx-4 rounded-2xl bg-white overflow-hidden" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
                <button
                  onClick={() => toggleCat(cat)}
                  className="w-full flex items-center gap-2 px-4 py-3 text-left"
                  style={isOpen ? { borderBottom: '0.5px solid var(--ios-separator)' } : undefined}
                  aria-expanded={isOpen}>
                  <span className="text-[20px]">{meta.emoji}</span>
                  <h3 className="flex-1 text-[15px] font-semibold text-[#1c1c1e]">{meta.label}</h3>
                  <span className="text-[12px] text-[#8e8e93]">{installedCount}/{catTemplates.length}</span>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#8e8e93" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 0.15s' }}>
                    <path d="M4 2l4 4-4 4" />
                  </svg>
                </button>
                {isOpen && catTemplates.map((tpl, idx) => {
                  const existingTaskId = taskIdFor(tpl);
                  const isInstalled = !!existingTaskId;
                  const isPending = pendingId === tpl.id;
                  const descOpen = showDescId === tpl.id;
                  return (
                    <div
                      key={tpl.id}
                      style={idx < catTemplates.length - 1 ? { borderBottom: '0.5px solid var(--ios-separator)' } : undefined}>
                      <div className="flex items-center gap-3 px-4 py-3">
                        {/* Zone info : tap → si installée, fiche détail; sinon toggle description */}
                        <button
                          onClick={() => {
                            if (isInstalled && existingTaskId) {
                              router.push(`/tasks/${existingTaskId}`);
                            } else {
                              setShowDescId(descOpen ? null : tpl.id);
                            }
                          }}
                          className="flex-1 min-w-0 text-left"
                          aria-label={isInstalled ? 'Voir les détails de la tâche' : 'Voir la description'}>
                          <div className="flex items-center gap-1.5">
                            <p className="text-[15px] font-medium text-[#1c1c1e] truncate">{tpl.name}</p>
                            {tpl.description && !isInstalled && (
                              <span className="flex-shrink-0 text-[10px] text-[#8e8e93]" aria-hidden="true">ⓘ</span>
                            )}
                            {isInstalled && (
                              <span className="flex-shrink-0 text-[10px] text-[#c7c7cc]" aria-hidden="true">›</span>
                            )}
                          </div>
                          <p className="text-[11px] text-[#8e8e93] mt-0.5">
                            {FREQ_LABEL[tpl.default_frequency] ?? tpl.default_frequency}
                            {tpl.default_duration && ` · ${DURATION_LABEL[tpl.default_duration] ?? tpl.default_duration}`}
                          </p>
                        </button>
                        {isInstalled ? (
                          <button
                            onClick={() => handleRemove(tpl)}
                            disabled={isPending}
                            className="flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-semibold disabled:opacity-40 flex-shrink-0"
                            style={{ background: '#fff2f2', color: '#ff3b30', border: '1px solid #ffd5d3' }}
                            aria-label={`Retirer ${tpl.name} du foyer`}>
                            {isPending ? '…' : <><span>✓</span><span>Retirer</span></>}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleAdd(tpl)}
                            disabled={isPending}
                            className="flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-40 flex-shrink-0"
                            style={{ background: '#007aff' }}
                            aria-label={`Ajouter ${tpl.name} au foyer`}>
                            {isPending ? '…' : <><span>+</span><span>Ajouter</span></>}
                          </button>
                        )}
                      </div>
                      {/* Description repliée */}
                      {descOpen && tpl.description && (
                        <div className="px-4 pb-3 -mt-1">
                          <p className="text-[12px] text-[#3c3c43] leading-relaxed rounded-lg px-3 py-2"
                            style={{ background: '#f0f6ff' }}>
                            {tpl.description}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
