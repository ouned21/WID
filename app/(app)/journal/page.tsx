'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import BackButton from '@/components/BackButton';
import { useAuthStore } from '@/stores/authStore';
import { useTaskStore } from '@/stores/taskStore';
import { useMemoryStore, FACT_TYPE_EMOJI, FACT_TYPE_LABEL } from '@/stores/memoryStore';
import { createClient } from '@/lib/supabase';

// ── Types ──────────────────────────────────────────────────────────────────────

type ParsedCompletion = {
  task_id: string;
  task_name: string;
  completed_by: string | null;
  duration_minutes: number | null;
  note: string | null;
  confidence: number;
};

type AutoCreatedTask = { name: string; task_id: string };

type ParseResponse = {
  journalId?: string;
  needs_clarification?: boolean;
  clarification_question?: string;
  completions: ParsedCompletion[];
  auto_created?: AutoCreatedTask[];
  unmatched: string[];
  ai_response: string;
  mood_tone: string | null;
  error?: string;
  code?: string;
  refused_scope?: boolean;
};

type HistoryMessage = { role: 'user' | 'assistant'; content: string };

type ChatMessage =
  | { id: string; type: 'user'; content: string }
  | { id: string; type: 'yova'; content: string; moodTone?: string | null; isQuestion?: boolean }
  | { id: string; type: 'result'; data: ParseResponse }
  | { id: string; type: 'typing' };

type PastJournal = {
  id: string;
  raw_text: string;
  ai_response: string | null;
  parsed_completions: ParsedCompletion[];
  mood_tone: string | null;
  created_at: string;
};

// ── Constantes ─────────────────────────────────────────────────────────────────

const MOOD_EMOJI: Record<string, string> = {
  happy: '😊', tired: '😴', overwhelmed: '😰',
  satisfied: '😌', frustrated: '😤', neutral: '😐',
};

let _msgCounter = 0;
function uid() { return `msg-${++_msgCounter}`; }

// ── Composants chat ────────────────────────────────────────────────────────────

function UserBubble({ content }: { content: string }) {
  return (
    <div className="flex justify-end mb-3">
      <div
        className="max-w-[78%] rounded-[20px] rounded-tr-[6px] px-4 py-3 text-[15px] text-white leading-relaxed"
        style={{ background: 'linear-gradient(135deg, #007aff, #5856d6)', boxShadow: '0 2px 8px rgba(0,122,255,0.2)' }}
      >
        {content}
      </div>
    </div>
  );
}

function YovaBubble({ content, moodTone, isQuestion }: { content: string; moodTone?: string | null; isQuestion?: boolean }) {
  const emoji = moodTone ? (MOOD_EMOJI[moodTone] ?? '🤖') : '🤖';
  return (
    <div className="flex items-end gap-2 mb-3">
      <div
        className="flex h-8 w-8 items-center justify-center rounded-full text-[16px] flex-shrink-0 mb-0.5"
        style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)' }}
      >
        {emoji}
      </div>
      <div
        className="max-w-[78%] rounded-[20px] rounded-tl-[6px] px-4 py-3 text-[15px] text-white leading-relaxed"
        style={{
          background: isQuestion
            ? 'linear-gradient(135deg, #5856d6, #764ba2)'
            : 'linear-gradient(135deg, #667eea, #764ba2)',
          boxShadow: '0 2px 8px rgba(118,75,162,0.2)',
        }}
      >
        {content}
        {isQuestion && (
          <span className="block mt-1 text-[12px] text-white/60">↩ Réponds ci-dessous</span>
        )}
      </div>
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="flex items-end gap-2 mb-3">
      <div
        className="flex h-8 w-8 items-center justify-center rounded-full text-[16px] flex-shrink-0"
        style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)' }}
      >
        🤖
      </div>
      <div
        className="rounded-[20px] rounded-tl-[6px] px-4 py-3"
        style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)' }}
      >
        <div className="flex gap-1 items-center h-5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-white/70 animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ResultCard({ data }: { data: ParseResponse }) {
  const allTasks = [
    ...(data.completions ?? []).map((c) => ({ name: c.task_name, isNew: false })),
    ...(data.auto_created ?? []).map((t) => ({ name: t.name, isNew: true })),
  ];
  if (allTasks.length === 0) return null;

  return (
    <div className="mb-3 ml-10">
      <div className="rounded-2xl bg-white overflow-hidden" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
        <div className="px-4 pt-3 pb-1.5">
          <p className="text-[11px] font-bold text-[#34c759] uppercase tracking-wide">✓ Fait aujourd&apos;hui</p>
        </div>
        {allTasks.map((t, i) => (
          <div
            key={i}
            className="px-4 py-2.5 flex items-center gap-2.5"
            style={{ borderTop: '0.5px solid #f2f2f7' }}
          >
            <span className="text-[14px]">{t.isNew ? '✨' : '✅'}</span>
            <span className="flex-1 text-[13px] text-[#1c1c1e] font-medium">{t.name}</span>
            {t.isNew && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                style={{ background: '#EEF4FF', color: '#007aff' }}>Nouveau</span>
            )}
          </div>
        ))}
        <div className="px-4 py-2" style={{ borderTop: '0.5px solid #f2f2f7' }}>
          <p className="text-[11px] text-[#8e8e93]">Compté dans ton score de la semaine.</p>
        </div>
      </div>
    </div>
  );
}

// ── Page principale ────────────────────────────────────────────────────────────

export default function JournalPage() {
  const router = useRouter();
  const { profile, refreshProfile } = useAuthStore();
  const { fetchTasks } = useTaskStore();
  const { facts, fetchMemory, invalidateFact } = useMemoryStore();

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [convHistory, setConvHistory] = useState<HistoryMessage[]>([]);
  const [isDone, setIsDone] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Historique journaux
  const [history, setHistory] = useState<PastJournal[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  // Récap dimanche
  type WeeklyRecap = {
    memberScores: Array<{ name: string; pct: number; completions: number }>;
    totalCompletions: number;
    message: string;
  };
  const [weeklyRecap, setWeeklyRecap] = useState<WeeklyRecap | null>(null);

  // Consentement RGPD
  const [consentGiven, setConsentGiven] = useState<boolean | null>(null);
  const [consentLoading, setConsentLoading] = useState(false);

  // ── Scroll auto vers le bas quand nouveaux messages ──
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Consentement depuis profil ──
  useEffect(() => {
    if (profile === null) return;
    setConsentGiven(!!profile.ai_journal_consent_at);
  }, [profile?.ai_journal_consent_at]);

  // ── Mémoire Yova ──
  useEffect(() => {
    if (profile?.household_id) fetchMemory(profile.household_id);
  }, [profile?.household_id, fetchMemory]);

  // ── Historique journaux ──
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
      setHistoryLoaded(true);
    }
    if (isDone) {
      const t = setTimeout(loadHistory, 1200);
      return () => clearTimeout(t);
    } else {
      loadHistory();
    }
  }, [profile?.id, isDone]);

  // ── Récap dimanche ──
  useEffect(() => {
    const today = new Date();
    if (today.getDay() !== 0 || !profile?.household_id) return;
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

  // ── Handlers consentement ──
  const handleAcceptConsent = async () => {
    if (!profile?.id) return;
    setConsentLoading(true);
    const supabase = createClient();
    await supabase.from('profiles').update({ ai_journal_consent_at: new Date().toISOString() }).eq('id', profile.id);
    await refreshProfile();
    setConsentGiven(true);
    setConsentLoading(false);
  };

  // ── Envoi d'un message ──
  const send = async () => {
    const trimmed = text.trim();
    if (!trimmed || trimmed.length < 3 || sending || isDone) return;
    setSending(true);
    setText('');

    // Ajouter le message utilisateur + indicateur typing
    const userMsgId = uid();
    const typingId = uid();
    setMessages((prev) => [
      ...prev,
      { id: userMsgId, type: 'user', content: trimmed },
      { id: typingId, type: 'typing' },
    ]);

    try {
      const res = await fetch('/api/ai/parse-journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: trimmed,
          inputMethod: 'text',
          conversation_history: convHistory.length > 0 ? convHistory : undefined,
        }),
      });

      const data: ParseResponse = await res.json();

      // Retirer l'indicateur typing
      setMessages((prev) => prev.filter((m) => m.id !== typingId));

      // ── Rate limit ──
      if (data.code === 'AI_LIMIT_REACHED') {
        setMessages((prev) => [
          ...prev,
          { id: uid(), type: 'yova', content: data.error ?? 'Limite mensuelle atteinte.', moodTone: null },
        ]);
        setSending(false);
        return;
      }

      // ── Clarification : Yova pose une question ──
      if (data.needs_clarification) {
        const question = data.clarification_question ?? data.ai_response;
        setMessages((prev) => [
          ...prev,
          { id: uid(), type: 'yova', content: question, isQuestion: true, moodTone: null },
        ]);
        setConvHistory((prev) => [
          ...prev,
          { role: 'user', content: trimmed },
          { role: 'assistant', content: question },
        ]);
        setSending(false);
        return;
      }

      // ── Réponse finale ──
      setMessages((prev) => [
        ...prev,
        { id: uid(), type: 'yova', content: data.ai_response, moodTone: data.mood_tone },
        ...(((data.completions?.length ?? 0) > 0 || (data.auto_created?.length ?? 0) > 0)
          ? [{ id: uid(), type: 'result' as const, data }]
          : []),
      ]);
      setIsDone(true);
      setConvHistory([]);

      // Recharger tâches + extraire mémoire (silencieux)
      if (profile?.household_id) {
        await fetchTasks(profile.household_id);
        const capturedHouseholdId = profile.household_id;
        fetch('/api/ai/extract-memory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            journalId: data.journalId,
            text: trimmed,
            householdId: capturedHouseholdId,
          }),
        })
          .then((r) => r.json())
          .then((memRes) => {
            if (memRes?.ok) setTimeout(() => fetchMemory(capturedHouseholdId), 800);
          })
          .catch(() => {});
      }

    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== typingId));
      setMessages((prev) => [
        ...prev,
        { id: uid(), type: 'yova', content: 'Erreur réseau. Réessaye.', moodTone: null },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send();
  };

  const handleNewConversation = () => {
    setMessages([]);
    setConvHistory([]);
    setIsDone(false);
    setText('');
  };

  // ── Consentement non chargé ──
  if (consentGiven === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 rounded-full border-2 border-[#007aff] border-t-transparent animate-spin" />
      </div>
    );
  }

  // ── Consentement refusé ──
  if (consentGiven === false) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12" style={{ background: '#f2f2f7' }}>
        <div className="w-full max-w-sm rounded-3xl overflow-hidden" style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
          <div className="px-6 pt-8 pb-6 text-center"
            style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full text-[32px]"
              style={{ background: 'rgba(255,255,255,0.2)' }}>🤖</div>
            <h1 className="text-[22px] font-bold text-white mb-1">Yova — Journal IA</h1>
            <p className="text-[13px] text-white/80">Consentement requis avant utilisation</p>
          </div>
          <div className="bg-white px-6 py-6">
            <p className="text-[15px] text-[#1c1c1e] font-semibold mb-3">Comment ça fonctionne&nbsp;?</p>
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
            <button onClick={handleAcceptConsent} disabled={consentLoading}
              className="w-full rounded-2xl py-[14px] text-[16px] font-bold text-white mb-3 disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)', boxShadow: '0 4px 16px rgba(118,75,162,0.25)' }}>
              {consentLoading ? 'Enregistrement...' : "J'accepte et je continue"}
            </button>
            <button onClick={() => router.back()}
              className="w-full rounded-2xl py-[14px] text-[15px] font-medium text-[#8e8e93]"
              style={{ background: '#f2f2f7' }}>
              Refuser — revenir en arrière
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Interface principale ──
  return (
    <div className="pt-4 pb-8 flex flex-col gap-4">

      {/* Header */}
      <div className="px-4 flex items-center justify-between">
        <BackButton />
        <h2 className="text-[17px] font-semibold text-[#1c1c1e]">Parler à Yova</h2>
        {isDone ? (
          <button onClick={handleNewConversation}
            className="text-[13px] font-semibold px-3 py-1.5 rounded-full"
            style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)', color: 'white' }}>
            Nouveau
          </button>
        ) : (
          <div className="w-16" />
        )}
      </div>

      {/* Récap dimanche */}
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
        </div>
      )}

      {/* ── Zone de chat ── */}
      <div className="mx-4">

        {/* Message d'accueil Yova si conversation vide */}
        {messages.length === 0 && (
          <div className="mb-4">
            <YovaBubble
              content="Qu'est-ce que t'as géré aujourd'hui que personne n'a vu ? Dis-moi tout — je classe et ça compte dans ton score."
              moodTone={null}
            />
          </div>
        )}

        {/* Thread de messages */}
        {messages.map((msg) => {
          if (msg.type === 'user') return <UserBubble key={msg.id} content={msg.content} />;
          if (msg.type === 'yova') return <YovaBubble key={msg.id} content={msg.content} moodTone={msg.moodTone} isQuestion={msg.isQuestion} />;
          if (msg.type === 'typing') return <TypingBubble key={msg.id} />;
          if (msg.type === 'result') return <ResultCard key={msg.id} data={msg.data} />;
          return null;
        })}

        <div ref={messagesEndRef} />

        {/* Input */}
        {!isDone && (
          <div className="mt-2">
            <div className="flex gap-2 items-end">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                maxLength={2000}
                rows={2}
                disabled={sending}
                placeholder={
                  convHistory.length > 0
                    ? 'Ta réponse…'
                    : 'J\'ai fait la vaisselle, préparé le dîner…'
                }
                className="flex-1 text-[15px] rounded-2xl px-4 py-3 bg-white text-[#1c1c1e] outline-none placeholder:text-[#c7c7cc] resize-none disabled:opacity-50"
                style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
                autoFocus
              />
              <button
                onClick={send}
                disabled={sending || text.trim().length < 3}
                className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-white disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #007aff, #5856d6)', boxShadow: '0 2px 8px rgba(0,122,255,0.25)' }}
                aria-label="Envoyer"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>
            <div className="flex justify-between mt-1.5 px-1">
              <span className="text-[11px] text-[#c7c7cc]">🏠 Foyer uniquement · ⌘+Entrée pour envoyer</span>
              <span className="text-[11px] text-[#c7c7cc]">{text.length}/2000</span>
            </div>
          </div>
        )}

        {/* Bouton "Nouvelle conversation" après résultat final */}
        {isDone && (
          <div className="mt-4 text-center">
            <button
              onClick={handleNewConversation}
              className="rounded-2xl px-6 py-3 text-[15px] font-semibold text-white"
              style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)', boxShadow: '0 4px 12px rgba(118,75,162,0.25)' }}
            >
              + Nouvelle conversation
            </button>
          </div>
        )}
      </div>

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
          {facts.length > 10 && (
            <p className="text-center text-[12px] text-[#c7c7cc] mt-2">
              +{facts.length - 10} souvenir{facts.length - 10 > 1 ? 's' : ''} de plus
            </p>
          )}
        </div>
      )}

      {/* ── Historique journaux (masqué par défaut) ── */}
      <div className="mx-4">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="flex items-center gap-2 text-[13px] font-semibold text-[#8e8e93] uppercase tracking-wide mb-2 px-1"
        >
          <span>Derniers journaux</span>
          <svg
            width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2"
            className="transition-transform"
            style={{ transform: showHistory ? 'rotate(180deg)' : 'rotate(0deg)' }}
          >
            <polyline points="2,4 6,8 10,4" />
          </svg>
        </button>

        {showHistory && (
          <>
            {!historyLoaded ? (
              <div className="text-center py-4">
                <div className="w-5 h-5 rounded-full border-2 border-[#007aff] border-t-transparent animate-spin mx-auto" />
              </div>
            ) : history.length === 0 ? (
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
          </>
        )}
      </div>

    </div>
  );
}
