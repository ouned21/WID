'use client';

/**
 * Onboarding conversationnel — Sprint 4
 *
 * Claude pilote la conversation via /api/onboarding/chat.
 * Le frontend envoie l'historique complet à chaque échange (stateless backend).
 * Quand Claude a assez d'infos, il retourne done:true + taskRows + children + householdMeta.
 * Le frontend appelle ensuite /api/onboarding/create-tasks pour persister.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useTaskStore } from '@/stores/taskStore';
import { useHouseholdStore } from '@/stores/householdStore';
import { createClient } from '@/lib/supabase';

// ── Types ──────────────────────────────────────────────────────────────────────
type ApiMessage     = { role: 'user' | 'assistant'; content: string };
type DisplayMessage = { role: 'yova' | 'user'; text: string };
type Step           = 'loading' | 'chat' | 'generating' | 'done';

type DonePayload = {
  taskRows:      Record<string, unknown>[];
  children:      { name: string; age: number; school_class: string | null }[];
  householdMeta: { energy_level: string; has_external_help: boolean; external_help_description: string | null } | null;
};

// ── Typing indicator ───────────────────────────────────────────────────────────
function TypingDots() {
  return (
    <div className="flex items-start gap-2">
      <div
        className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-white text-[12px] font-black"
        style={{ background: 'linear-gradient(135deg,#007aff,#5856d6)' }}
      >
        Y
      </div>
      <div
        className="rounded-2xl rounded-tl-sm px-4 py-3 flex gap-1 items-center"
        style={{ background: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
      >
        {[0, 1, 2].map(i => (
          <span
            key={i}
            className="w-2 h-2 rounded-full"
            style={{
              background: '#007aff',
              animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
              opacity: 0.6,
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function OnboardingPage() {
  const router = useRouter();
  const { profile, refreshProfile } = useAuthStore();
  const { fetchTasks }    = useTaskStore();
  const { fetchHousehold } = useHouseholdStore();

  const [step, setStep]           = useState<Step>('loading');
  const [apiMessages, setApiMessages] = useState<ApiMessage[]>([]);
  const [display, setDisplay]     = useState<DisplayMessage[]>([]);
  const [chips, setChips]         = useState<string[]>([]);
  const [textInput, setTextInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError]         = useState<string | null>(null);

  // Done state
  const [donePayload, setDonePayload] = useState<DonePayload | null>(null);
  const [taskCount, setTaskCount]     = useState(0);
  const [journalConsent, setJournalConsent] = useState(false);
  const [consentOpen, setConsentOpen]       = useState(false);
  const [finishing, setFinishing]           = useState(false);

  const chatRef  = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const userId      = profile?.id;
  const householdId = profile?.household_id;

  // ── Init ───────────────────────────────────────────────────────────────────
  // Auto-create household if missing
  useEffect(() => {
    if (!userId || householdId) return;
    fetch('/api/onboarding/create-household', { method: 'POST' })
      .then(r => r.json())
      .then(async (d) => { if (d.ok) await refreshProfile(); })
      .catch(console.error);
  }, [userId, householdId, refreshProfile]);

  // Auto-scroll
  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [display, isThinking]);

  // ── API call ───────────────────────────────────────────────────────────────
  const callApi = useCallback(async (msgs: ApiMessage[]) => {
    setIsThinking(true);
    setError(null);
    try {
      const res = await fetch('/api/onboarding/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: msgs }),
      });
      const data = await res.json() as {
        reply: string;
        done: boolean;
        chips?: string[];
        taskRows?: Record<string, unknown>[];
        children?: { name: string; age: number; school_class: string | null }[];
        householdMeta?: { energy_level: string; has_external_help: boolean; external_help_description: string | null };
        error?: string;
      };

      if (!res.ok || data.error) {
        setError(data.error ?? 'Erreur. Rechargez la page.');
        setStep('chat');
        return;
      }

      const yovaMsg: DisplayMessage = { role: 'yova', text: data.reply };
      const updatedApi: ApiMessage[] = [...msgs, { role: 'assistant', content: data.reply }];

      setDisplay(prev => [...prev, yovaMsg]);
      setApiMessages(updatedApi);

      if (data.done) {
        const payload: DonePayload = {
          taskRows:      data.taskRows      ?? [],
          children:      data.children      ?? [],
          householdMeta: data.householdMeta ?? null,
        };
        setDonePayload(payload);
        setChips([]);
        // Brief pause so user reads the conclusion before the loading screen
        setTimeout(() => {
          setStep('generating');
          void persistTasks(payload);
        }, 1000);
      } else {
        setChips(data.chips ?? []);
        setStep('chat');
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    } catch (err) {
      console.error('[onboarding] callApi error:', err);
      setError('Erreur réseau. Rechargez la page.');
      setStep('chat');
    } finally {
      setIsThinking(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initial call — triggers Claude's opening message
  useEffect(() => {
    const init: ApiMessage[] = [{ role: 'user', content: 'Commence' }];
    setApiMessages(init);
    void callApi(init);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Send message ───────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isThinking || step !== 'chat') return;

    setTextInput('');
    setChips([]);

    const userDisplay: DisplayMessage = { role: 'user', text: trimmed };
    setDisplay(prev => [...prev, userDisplay]);

    // Build updated api messages (include current apiMessages + new user msg)
    setApiMessages(prev => {
      const updated: ApiMessage[] = [...prev, { role: 'user', content: trimmed }];
      void callApi(updated);
      return updated;
    });
  }, [isThinking, step, callApi]);

  // ── Persist tasks ──────────────────────────────────────────────────────────
  const persistTasks = async (payload: DonePayload) => {
    try {
      let hid = useAuthStore.getState().profile?.household_id;
      if (!hid) {
        await refreshProfile();
        hid = useAuthStore.getState().profile?.household_id;
      }
      if (!hid) throw new Error('Foyer introuvable — rechargez la page.');

      const phantomMembers = payload.children.map(c => ({
        display_name: c.name,
        member_type:  'child',
        birth_date:   null,
        school_class: c.school_class ?? null,
        specifics:    {},
      }));

      const res = await fetch('/api/onboarding/create-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskRows:         payload.taskRows,
          phantomMembers,
          householdMeta:    payload.householdMeta,
          customSuggestions: [],
        }),
      });
      const data = await res.json() as { tasks?: { id: string }[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? `Erreur ${res.status}`);

      await fetchHousehold(hid);
      await fetchTasks(hid);

      setTaskCount(data.tasks?.length ?? payload.taskRows.length);
      setStep('done');
    } catch (err) {
      console.error('[onboarding] persistTasks error:', err);
      setError(err instanceof Error ? err.message : 'Erreur lors de la création. Rechargez la page.');
      setStep('chat'); // go back to chat so user sees the error
    }
  };

  // ── Finish ─────────────────────────────────────────────────────────────────
  const handleFinish = async () => {
    if (finishing) return;
    setFinishing(true);
    if (journalConsent && userId && !profile?.ai_journal_consent_at) {
      await createClient()
        .from('profiles')
        .update({ ai_journal_consent_at: new Date().toISOString() })
        .eq('id', userId);
      await refreshProfile();
    }
    router.push('/today');
  };

  // ── Loading screen ─────────────────────────────────────────────────────────
  if (step === 'loading') {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-4"
        style={{ background: 'linear-gradient(135deg,#007aff 0%,#5856d6 100%)' }}
      >
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)' }}
        >
          <div className="h-6 w-6 animate-spin rounded-full border-[3px] border-white/30 border-t-white" />
        </div>
        <p className="text-white/80 text-[15px] font-medium">Yova arrive…</p>
      </div>
    );
  }

  // ── Generating screen ──────────────────────────────────────────────────────
  if (step === 'generating') {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-6"
        style={{ background: 'linear-gradient(180deg,#0a1628 0%,#1a2f52 100%)' }}
      >
        <div
          className="h-16 w-16 rounded-full flex items-center justify-center mb-6"
          style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
        >
          <div className="h-6 w-6 animate-spin rounded-full border-[3px] border-white/20 border-t-white" />
        </div>
        <h2 className="text-[24px] font-black text-white text-center leading-tight mb-2">
          Yova prépare votre foyer…
        </h2>
        <p
          className="text-[14px] text-center max-w-[280px] leading-relaxed"
          style={{ color: 'rgba(255,255,255,0.6)' }}
        >
          Création de vos tâches personnalisées
        </p>
      </div>
    );
  }

  // ── Chat UI (chat + done) ──────────────────────────────────────────────────
  const hasConsent = !!profile?.ai_journal_consent_at || journalConsent;

  return (
    <>
      {/* Bounce animation */}
      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
        }
      `}</style>

      <div className="flex flex-col h-screen" style={{ background: '#f6f8ff' }}>

        {/* Header */}
        <div
          className="px-4 py-3 flex items-center gap-3 flex-shrink-0"
          style={{ background: 'linear-gradient(135deg,#007aff,#5856d6)' }}
        >
          <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
            <span className="text-white font-black text-[17px]">Y</span>
          </div>
          <div>
            <p className="text-white font-black text-[17px] leading-none">Yova</p>
            <p className="text-white/70 text-[11px] mt-0.5">
              {step === 'done' ? `${taskCount} tâche${taskCount > 1 ? 's' : ''} créée${taskCount > 1 ? 's' : ''} ✓` : 'Configuration du foyer'}
            </p>
          </div>
        </div>

        {/* Messages */}
        <div ref={chatRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-2">
          {display.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'items-start gap-2'}`}
            >
              {msg.role === 'yova' && (
                <div
                  className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-white text-[12px] font-black mt-0.5"
                  style={{ background: 'linear-gradient(135deg,#007aff,#5856d6)' }}
                >
                  Y
                </div>
              )}
              <div
                className={`rounded-2xl px-4 py-3 max-w-[82%] ${msg.role === 'user' ? 'rounded-tr-sm' : 'rounded-tl-sm'}`}
                style={{
                  background: msg.role === 'user'
                    ? 'linear-gradient(135deg,#007aff,#5856d6)'
                    : 'white',
                  color: msg.role === 'user' ? 'white' : '#1c1c1e',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                }}
              >
                <p className="text-[15px] leading-relaxed whitespace-pre-line">{msg.text}</p>
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {isThinking && <TypingDots />}

          {/* Error inline */}
          {error && (
            <div
              className="rounded-2xl px-4 py-3 text-[13px] text-center mx-2"
              style={{ background: '#fff0f0', border: '1px solid #ffcccc', color: '#cc0000' }}
            >
              {error}
            </div>
          )}
        </div>

        {/* Input area */}
        <div
          className="flex-shrink-0 px-4 pb-8 pt-2 space-y-2"
          style={{ background: 'linear-gradient(transparent, #f6f8ff 20%, #f6f8ff)' }}
        >
          {/* Done state */}
          {step === 'done' && (
            <div className="space-y-3">
              {!profile?.ai_journal_consent_at && (
                <div
                  className="rounded-2xl overflow-hidden bg-white"
                  style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}
                >
                  <button
                    onClick={() => setConsentOpen(v => !v)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left"
                  >
                    <span className="text-[18px]">🔒</span>
                    <div className="flex-1">
                      <p className="text-[13px] font-bold text-[#1c1c1e]">Consentement IA</p>
                      <p className="text-[11px] text-[#8e8e93]">
                        Yova utilise Claude (Anthropic, US). {consentOpen ? 'Réduire.' : 'Détails ↓'}
                      </p>
                    </div>
                  </button>
                  {consentOpen && (
                    <div
                      className="px-4 pb-3 text-[11px] leading-relaxed"
                      style={{ color: '#3a6fcc', background: '#f0f6ff' }}
                    >
                      📍 Envoyé : texte journal + liste tâches (sans noms réels)<br />
                      🔒 Conservé : résultat uniquement, serveurs Supabase (UE)<br />
                      🗑️ Suppression : avec votre compte (Profil → Mes données)
                    </div>
                  )}
                  <label
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                    style={{ borderTop: '0.5px solid #f0f2f8' }}
                  >
                    <input
                      type="checkbox"
                      checked={journalConsent}
                      onChange={e => setJournalConsent(e.target.checked)}
                      style={{ width: 20, height: 20, accentColor: '#007aff' }}
                    />
                    <span className="text-[12px] text-[#1c1c1e]">
                      J&apos;accepte le traitement par Yova via Claude.
                    </span>
                  </label>
                </div>
              )}
              {!hasConsent && (
                <p className="text-center text-[11px] text-[#8e8e93]">
                  Acceptez le consentement ci-dessus pour continuer
                </p>
              )}
              <button
                onClick={handleFinish}
                disabled={!hasConsent || finishing}
                className="w-full rounded-2xl py-4 text-[17px] font-bold text-white disabled:opacity-40 flex items-center justify-center gap-2"
                style={{
                  background: 'linear-gradient(135deg,#007aff,#5856d6)',
                  boxShadow: hasConsent ? '0 8px 24px rgba(0,122,255,0.3)' : 'none',
                }}
              >
                {finishing && (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                )}
                {finishing ? 'Lancement…' : 'Commencer avec Yova →'}
              </button>
            </div>
          )}

          {/* Chat input */}
          {step === 'chat' && (
            <>
              {/* Quick-reply chips */}
              {chips.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {chips.map((chip, i) => (
                    <button
                      key={i}
                      onClick={() => void sendMessage(chip)}
                      className="rounded-2xl px-4 py-2 text-[14px] font-semibold transition-all active:scale-[0.95]"
                      style={{
                        background: 'white',
                        color: '#007aff',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                        border: '1.5px solid rgba(0,122,255,0.3)',
                      }}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              )}

              {/* Text input */}
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={textInput}
                  onChange={e => setTextInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') void sendMessage(textInput); }}
                  placeholder={isThinking ? 'Yova réfléchit…' : 'Répondre…'}
                  disabled={isThinking}
                  className="flex-1 rounded-2xl px-4 py-3 text-[15px] outline-none disabled:opacity-50"
                  style={{
                    background: 'white',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                    color: '#1c1c1e',
                  }}
                />
                <button
                  onClick={() => void sendMessage(textInput)}
                  disabled={!textInput.trim() || isThinking}
                  className="rounded-2xl px-5 text-white text-[20px] font-bold disabled:opacity-40 flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg,#007aff,#5856d6)', minWidth: 52 }}
                >
                  {isThinking
                    ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    : '→'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
