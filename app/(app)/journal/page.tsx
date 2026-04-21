'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import BackButton from '@/components/BackButton';
import { useAuthStore } from '@/stores/authStore';
import { useTaskStore } from '@/stores/taskStore';
import { useMemoryStore, FACT_TYPE_EMOJI, FACT_TYPE_LABEL } from '@/stores/memoryStore';
import { createClient } from '@/lib/supabase';

type ParsedCompletion = {
  task_id: string;
  task_name: string;
  completed_by: string | null;
  duration_minutes: number | null;
  note: string | null;
  confidence: number;
};

type AutoCreatedTask = {
  name: string;
  task_id: string;
};

type ParseResponse = {
  journalId?: string;
  completions: ParsedCompletion[];
  auto_created?: AutoCreatedTask[];
  unmatched: string[];
  ai_response: string;
  mood_tone: string | null;
  error?: string;
  code?: string;
};

type PastJournal = {
  id: string;
  raw_text: string;
  ai_response: string | null;
  parsed_completions: ParsedCompletion[];
  mood_tone: string | null;
  created_at: string;
};

const MOOD_EMOJI: Record<string, string> = {
  happy: '😊',
  tired: '😴',
  overwhelmed: '😰',
  satisfied: '😌',
  frustrated: '😤',
  neutral: '😐',
};

export default function JournalPage() {
  const router = useRouter();
  const { profile, refreshProfile } = useAuthStore();
  const { fetchTasks } = useTaskStore();
  const { facts, fetchMemory, invalidateFact } = useMemoryStore();

  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<ParseResponse | null>(null);
  const [history, setHistory] = useState<PastJournal[]>([]);
  const [showHistory, setShowHistory] = useState(true);

  type WeeklyRecap = {
    memberScores: Array<{ name: string; pct: number; completions: number }>;
    totalCompletions: number;
    message: string;
  };
  const [weeklyRecap, setWeeklyRecap] = useState<WeeklyRecap | null>(null);

  // ── Récap dimanche ────────────────────────────────────────────────────────────
  useEffect(() => {
    const today = new Date();
    if (today.getDay() !== 0) return; // Dimanche seulement
    if (!profile?.household_id) return;

    // Clé unique par semaine (lundi de la semaine courante)
    const mon = new Date(today);
    mon.setDate(today.getDate() - 6);
    const weekKey = `yova_weekly_recap_${mon.toISOString().split('T')[0]}`;
    if (localStorage.getItem(weekKey)) return;

    (async () => {
      const supabase = createClient();
      const from = new Date(today); from.setDate(from.getDate() - 7);

      const [{ data: completions }, { data: taskData }, { data: members }] = await Promise.all([
        supabase.from('task_completions').select('completed_by, household_task_id').gte('completed_at', from.toISOString()),
        supabase.from('household_tasks').select('id, mental_load_score').eq('household_id', profile.household_id),
        supabase.from('profiles').select('id, display_name').eq('household_id', profile.household_id),
      ]);

      if (!completions || !members) return;

      const loadMap: Record<string, number> = {};
      for (const t of taskData ?? []) loadMap[t.id] = t.mental_load_score ?? 2;

      const totalLoad = completions.reduce((s, c) => s + (loadMap[c.household_task_id] ?? 2), 0);
      const memberScores = (members ?? []).map(m => {
        const mc = completions.filter(c => c.completed_by === m.id);
        const ml = mc.reduce((s, c) => s + (loadMap[c.household_task_id] ?? 2), 0);
        return { name: m.display_name ?? '?', pct: totalLoad > 0 ? Math.round((ml / totalLoad) * 100) : 0, completions: mc.length };
      }).sort((a, b) => b.pct - a.pct);

      const total = completions.length;
      let message = '';
      if (total === 0) {
        message = 'Semaine calme — aucune tâche enregistrée. Raconte ce que tu as géré !';
      } else if (memberScores.length >= 2) {
        const [a, b] = memberScores;
        const gap = a.pct - b.pct;
        message = gap > 20
          ? `${a.name} a porté la semaine à ${a.pct}% — l'écart avec ${b.name} (${b.pct}%) mérite attention.`
          : `Belle semaine — ${total} tâche${total > 1 ? 's' : ''} accomplies. ${a.name} ${a.pct}%, ${b.name} ${b.pct}%. Répartition correcte.`;
      } else {
        const m = memberScores[0];
        message = `${m?.name ?? 'Tu'} a géré ${total} tâche${total > 1 ? 's' : ''} cette semaine. Continue !`;
      }

      setWeeklyRecap({ memberScores, totalCompletions: total, message });
      localStorage.setItem(weekKey, '1');
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.household_id]);

  // ── Consentement RGPD ──
  // null = pas encore chargé, false = refusé/pas de consentement, true = consentement donné
  const [consentGiven, setConsentGiven] = useState<boolean | null>(null);
  const [consentLoading, setConsentLoading] = useState(false);

  // Dériver l'état de consentement depuis le profil
  useEffect(() => {
    if (profile === null) return; // profil pas encore chargé
    setConsentGiven(!!profile.ai_journal_consent_at);
  }, [profile?.ai_journal_consent_at]);

  const handleAcceptConsent = async () => {
    if (!profile?.id) return;
    setConsentLoading(true);
    const supabase = createClient();
    await supabase
      .from('profiles')
      .update({ ai_journal_consent_at: new Date().toISOString() })
      .eq('id', profile.id);
    await refreshProfile();
    setConsentGiven(true);
    setConsentLoading(false);
  };

  const handleRefuseConsent = () => {
    router.back();
  };

  // Charger la mémoire Yova
  useEffect(() => {
    if (profile?.household_id) fetchMemory(profile.household_id);
  }, [profile?.household_id, fetchMemory]);

  // Charger l'historique — délai après un résultat pour laisser la DB commiter
  useEffect(() => {
    async function loadHistory() {
      if (!profile?.id) return;
      const supabase = createClient();
      const { data } = await supabase
        .from('user_journals')
        .select('id, raw_text, ai_response, parsed_completions, mood_tone, created_at')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(20);
      setHistory((data ?? []) as PastJournal[]);
    }
    if (result) {
      // Attendre que la DB commite avant de recharger l'historique
      const t = setTimeout(loadHistory, 1200);
      return () => clearTimeout(t);
    } else {
      loadHistory();
    }
  }, [profile?.id, result]);

  const send = async () => {
    if (!text.trim() || text.trim().length < 3) return;
    setSending(true);
    setResult(null);
    try {
      const res = await fetch('/api/ai/parse-journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim(), inputMethod: 'text' }),
      });
      const data: ParseResponse = await res.json();
      if (!res.ok) {
        setResult({ completions: [], unmatched: [], ai_response: data.error ?? 'Erreur inconnue', mood_tone: null, error: data.error, code: data.code });
        setSending(false);
        return;
      }
      setResult(data);
      setText('');
      // Recharger les tâches + extraire les faits mémoire (silencieux)
      if (profile?.household_id) {
        await fetchTasks(profile.household_id);
        // Extraction mémoire en arrière-plan — ne bloque pas l'UX
        const capturedText = text.trim();
        const capturedHouseholdId = profile.household_id;
        fetch('/api/ai/extract-memory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            journalId: data.journalId,
            text: capturedText,
            householdId: capturedHouseholdId,
          }),
        })
          .then((r) => r.json())
          .then((memRes) => {
            // Recharger la mémoire après un délai pour laisser la DB commiter
            if (memRes?.ok) {
              setTimeout(() => fetchMemory(capturedHouseholdId), 800);
            }
          })
          .catch(() => {});
      }
    } catch (err) {
      setResult({ completions: [], unmatched: [], ai_response: 'Erreur réseau. Réessaye.', mood_tone: null, error: String(err) });
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      send();
    }
  };

  // ── Consentement modal (bloque le rendu principal) ──
  if (consentGiven === null) {
    // Profil pas encore chargé → squelette neutre
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 rounded-full border-2 border-[#007aff] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (consentGiven === false) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12" style={{ background: '#f2f2f7' }}>
        <div className="w-full max-w-sm rounded-3xl overflow-hidden" style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
          {/* En-tête coloré */}
          <div
            className="px-6 pt-8 pb-6 text-center"
            style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
          >
            <div
              className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full text-[32px]"
              style={{ background: 'rgba(255,255,255,0.2)' }}
            >
              🤖
            </div>
            <h1 className="text-[22px] font-bold text-white mb-1">Yova — Journal IA</h1>
            <p className="text-[13px] text-white/80">Consentement requis avant utilisation</p>
          </div>

          {/* Corps */}
          <div className="bg-white px-6 py-6">
            <p className="text-[15px] text-[#1c1c1e] font-semibold mb-3">
              Comment ça fonctionne&nbsp;?
            </p>
            <p className="text-[14px] text-[#3c3c43] leading-relaxed mb-4">
              Quand tu décris ta journée, ton texte est envoyé à l&apos;IA <strong>Anthropic Claude</strong>
              {' '}(hébergée aux États-Unis) pour identifier les tâches effectuées.
              Aucun de ces textes n&apos;est utilisé pour entraîner des modèles d&apos;IA.
            </p>

            <div className="rounded-2xl p-4 mb-5" style={{ background: '#f2f2f7' }}>
              <p className="text-[13px] text-[#3c3c43] leading-relaxed">
                📍 <strong>Données envoyées :</strong> ton texte libre + la liste de tes tâches (sans noms réels des membres)<br />
                🔒 <strong>Données conservées :</strong> résultat uniquement, sur serveurs Supabase (UE)<br />
                🗑️ <strong>Suppression :</strong> avec ton compte, depuis Profil → Mes données
              </p>
            </div>

            <p className="text-[12px] text-[#8e8e93] mb-5 text-center">
              Conformément au RGPD Art. 7, tu peux retirer ce consentement à tout moment depuis ton profil.
            </p>

            <button
              onClick={handleAcceptConsent}
              disabled={consentLoading}
              className="w-full rounded-2xl py-[14px] text-[16px] font-bold text-white mb-3 disabled:opacity-50"
              style={{
                background: 'linear-gradient(135deg, #667eea, #764ba2)',
                boxShadow: '0 4px 16px rgba(118,75,162,0.25)',
              }}
            >
              {consentLoading ? 'Enregistrement...' : "J'accepte et je continue"}
            </button>

            <button
              onClick={handleRefuseConsent}
              className="w-full rounded-2xl py-[14px] text-[15px] font-medium text-[#8e8e93]"
              style={{ background: '#f2f2f7' }}
            >
              Refuser — revenir en arrière
            </button>
          </div>
        </div>

        <p className="mt-6 text-[12px] text-[#8e8e93] text-center max-w-xs">
          Ce consentement est enregistré une seule fois et ne te sera plus demandé.{' '}
          <a href="/legal/privacy" className="underline" style={{ color: '#007aff' }}>
            Politique de confidentialité
          </a>
        </p>
      </div>
    );
  }

  return (
    <div className="pt-4 pb-8" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header */}
      <div className="px-4 flex items-center justify-between">
        <BackButton />
        <h2 className="text-[17px] font-semibold text-[#1c1c1e]">Journal</h2>
        <button onClick={() => setShowHistory(!showHistory)} className="text-[13px] font-medium" style={{ color: '#007aff' }}>
          {showHistory ? 'Masquer' : 'Historique'}
        </button>
      </div>

      {/* ── Récap dimanche ── */}
      {weeklyRecap && (
        <div className="mx-4 rounded-3xl p-5"
          style={{ background: 'linear-gradient(148deg,#16163a 0%,#2b1e72 55%,#163260 100%)', boxShadow: '0 8px 24px rgba(28,28,62,0.3)' }}>
          <div className="flex items-start gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full text-[20px] flex-shrink-0"
              style={{ background: 'rgba(255,255,255,0.15)' }}>📊</div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] font-bold mb-1" style={{ color: 'rgba(255,255,255,0.45)' }}>
                Bilan de la semaine
              </p>
              <p className="text-[14px] text-white leading-snug">{weeklyRecap.message}</p>
            </div>
          </div>
          {weeklyRecap.memberScores.map((ms, i) => (
            <div key={i} className="flex items-center gap-3 mb-2">
              <span className="text-[12px] font-semibold w-20 flex-shrink-0 truncate" style={{ color: 'rgba(255,255,255,0.7)' }}>{ms.name}</span>
              <div className="flex-1 h-[5px] rounded-full" style={{ background: 'rgba(255,255,255,0.1)' }}>
                <div className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${ms.pct}%`, background: i === 0 ? 'linear-gradient(90deg,#ff6b6b,#ff3030)' : 'linear-gradient(90deg,#4ecdc4,#26b5ab)' }} />
              </div>
              <span className="text-[12px] font-black text-white w-9 text-right flex-shrink-0">{ms.pct}%</span>
            </div>
          ))}
          <p className="text-[11px] mt-3" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {weeklyRecap.totalCompletions} tâche{weeklyRecap.totalCompletions > 1 ? 's' : ''} complétée{weeklyRecap.totalCompletions > 1 ? 's' : ''} cette semaine
          </p>
        </div>
      )}

      {/* Bloc principal : saisie */}
      <div className="mx-4">
        {/* Bulle Yova */}
        <div className="rounded-3xl p-5 mb-4" style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          boxShadow: '0 8px 24px rgba(118, 75, 162, 0.2)',
        }}>
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full text-[20px] flex-shrink-0 mt-0.5" style={{ background: 'rgba(255,255,255,0.25)' }}>
              🤖
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.15em] font-bold text-white/60 mb-1">Yova</p>
              <p className="text-[17px] font-bold text-white leading-snug">
                Qu&apos;est-ce que t&apos;as géré aujourd&apos;hui que personne n&apos;a vu ?
              </p>
              <p className="text-[13px] text-white/70 mt-1.5 leading-relaxed">
                Réponds en une phrase. Je classe, je note, ça compte dans ton score.
              </p>
            </div>
          </div>
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={2000}
          rows={4}
          disabled={sending}
          placeholder="J'ai appelé l'assurance, pris rdv chez le dentiste et commandé les fournitures scolaires…"
          className="w-full text-[16px] rounded-2xl px-4 py-3 bg-white text-[#1c1c1e] outline-none placeholder:text-[#c7c7cc] resize-none disabled:opacity-50"
          style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
          autoFocus
        />

        <div className="flex items-center justify-between mt-2 px-1">
          <span className="text-[11px] text-[#c7c7cc]">🏠 Tâches du foyer uniquement · Cmd+Entrée pour envoyer</span>
          <span className="text-[11px] text-[#c7c7cc]">{text.length}/2000</span>
        </div>

        <button
          onClick={send}
          disabled={sending || text.trim().length < 3}
          className="w-full mt-3 rounded-2xl py-[14px] text-[16px] font-bold text-white disabled:opacity-50"
          style={{
            background: 'linear-gradient(135deg, #007aff, #5856d6)',
            boxShadow: '0 4px 16px rgba(0,122,255,0.2)',
          }}
        >
          {sending ? 'Yova analyse...' : 'Envoyer à Yova'}
        </button>
      </div>

      {/* Bloc rate-limit premium */}
      {result?.code === 'AI_LIMIT_REACHED' && (
        <div
          className="mx-4 rounded-3xl p-6 relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #1a0533 0%, #3a1c71 40%, #0a3d8f 100%)',
            boxShadow: '0 16px 48px rgba(58,28,113,0.4)',
          }}
        >
          <div
            className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-20"
            style={{
              background: 'radial-gradient(circle, #a78bfa, transparent 70%)',
              transform: 'translate(30%, -30%)',
            }}
          />
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-[32px]">🔒</span>
              <p className="text-[18px] font-black text-white leading-tight">
                Tu as atteint ta limite mensuelle IA
              </p>
            </div>
            <p className="text-[14px] text-white/75 leading-relaxed mb-5">
              Le journal conversationnel est limité en version gratuite.
              Passe à Premium pour un accès illimité chaque mois.
            </p>
            <button
              onClick={() => router.push('/upgrade')}
              className="w-full rounded-2xl py-4 text-[16px] font-bold text-white"
              style={{
                background: 'rgba(255,255,255,0.2)',
                border: '1.5px solid rgba(255,255,255,0.35)',
                backdropFilter: 'blur(8px)',
              }}
            >
              Passer à Premium →
            </button>
          </div>
        </div>
      )}

      {/* Résultat du parsing — style chat */}
      {result && result.code !== 'AI_LIMIT_REACHED' && (
        <div className="mx-4 space-y-3">

          {/* Bulle réponse Yova */}
          <div className="rounded-3xl p-5" style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            boxShadow: '0 4px 16px rgba(118,75,162,0.2)',
          }}>
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full text-[18px] flex-shrink-0 mt-0.5"
                style={{ background: 'rgba(255,255,255,0.25)' }}>
                {result.mood_tone ? MOOD_EMOJI[result.mood_tone] ?? '🤖' : '🤖'}
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.12em] font-bold text-white/60 mb-1">Yova</p>
                <p className="text-[15px] text-white leading-relaxed">{result.ai_response}</p>
              </div>
            </div>
          </div>

          {/* Récap tâches enregistrées */}
          {(result.completions.length > 0 || (result.auto_created && result.auto_created.length > 0)) && (
            <div className="rounded-2xl bg-white overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div className="px-5 pt-4 pb-2">
                <p className="text-[11px] font-bold text-[#34c759] uppercase tracking-wide">
                  ✓ Fait aujourd&apos;hui
                </p>
              </div>

              {result.completions.map((c, i) => (
                <div
                  key={i}
                  className="px-5 py-3 flex items-center gap-3"
                  style={{ borderTop: '0.5px solid var(--ios-separator)' }}
                >
                  <span className="text-[16px]">✅</span>
                  <span className="flex-1 text-[14px] text-[#1c1c1e] font-medium">{c.task_name}</span>
                  {c.duration_minutes && (
                    <span className="text-[12px] text-[#8e8e93]">{c.duration_minutes} min</span>
                  )}
                </div>
              ))}

              {result.auto_created?.map((t, i) => (
                <div
                  key={`ac-${i}`}
                  className="px-5 py-3 flex items-center gap-3"
                  style={{ borderTop: '0.5px solid var(--ios-separator)' }}
                >
                  <span className="text-[16px]">✨</span>
                  <span className="flex-1 text-[14px] text-[#1c1c1e] font-medium">{t.name}</span>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: '#EEF4FF', color: '#007aff' }}>Nouveau</span>
                </div>
              ))}

              <div className="px-5 py-3" style={{ borderTop: '0.5px solid var(--ios-separator)' }}>
                <p className="text-[12px] text-[#8e8e93]">
                  Ça compte dans ton score de la semaine.
                </p>
              </div>
            </div>
          )}

          {/* Items non-tâches — silencieux, capturés par extract-memory */}
        </div>
      )}

      {/* ── Ce que Yova sait (mémoire longue) ── */}
      {facts.length > 0 && (
        <div className="mx-4">
          <p className="text-[13px] font-semibold text-[#8e8e93] uppercase tracking-wide mb-2 px-1">
            Ce que Yova sait
          </p>
          <div className="rounded-2xl bg-white overflow-hidden" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
            {facts.slice(0, 10).map((fact, i) => (
              <div
                key={fact.id}
                className="flex items-start gap-3 px-4 py-3"
                style={i < Math.min(facts.length, 10) - 1 ? { borderBottom: '0.5px solid #f2f2f7' } : {}}
              >
                <span className="text-[16px] flex-shrink-0 mt-0.5">
                  {FACT_TYPE_EMOJI[fact.fact_type]}
                </span>
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
          {facts.length > 10 && (
            <p className="text-center text-[12px] text-[#c7c7cc] mt-2">
              +{facts.length - 10} souvenir{facts.length - 10 > 1 ? 's' : ''} de plus
            </p>
          )}
        </div>
      )}

      {/* Historique */}
      {showHistory && (
        <div className="mx-4">
          <p className="text-[13px] font-semibold text-[#8e8e93] uppercase tracking-wide mb-2 px-1">
            Derniers journaux
          </p>
          {history.length === 0 ? (
            <p className="text-center text-[13px] text-[#c7c7cc] py-6">Aucun journal pour l&apos;instant.</p>
          ) : (
            <div className="rounded-2xl bg-white overflow-hidden" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
              {history.map((h, i) => (
                <div key={h.id} className="px-4 py-3"
                  style={i < history.length - 1 ? { borderBottom: '0.5px solid var(--ios-separator)' } : {}}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-[#8e8e93]">
                      {new Date(h.created_at).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })} · {new Date(h.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {h.mood_tone && <span className="text-[14px]">{MOOD_EMOJI[h.mood_tone] ?? ''}</span>}
                  </div>
                  <p className="text-[13px] text-[#1c1c1e] mb-1">{h.raw_text}</p>
                  {h.ai_response && (
                    <p className="text-[12px] text-[#8e8e93] italic">→ {h.ai_response}</p>
                  )}
                  {h.parsed_completions.length > 0 && (
                    <p className="text-[11px] text-[#34c759] mt-1">
                      ✓ {h.parsed_completions.length} tâche{h.parsed_completions.length > 1 ? 's' : ''} enregistrée{h.parsed_completions.length > 1 ? 's' : ''}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
