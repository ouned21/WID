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
type Step           = 'consent' | 'loading' | 'chat' | 'generating' | 'done';
type EquipmentItem  = { id: string; name: string; icon: string; category: string; is_default: boolean };

const EQUIP_CAT_LABELS: Record<string, string> = {
  cuisine:      '🍳 Cuisine',
  salle_de_bain:'🚿 Salle de bain',
  linge:        '👕 Linge',
  sols:         '🧹 Sols & Ménage',
  exterieur:    '🌿 Extérieur',
  vehicule:     '🚗 Véhicule',
  animaux:      '🐾 Animaux',
};

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

  const [step, setStep]           = useState<Step>('consent');
  const [apiMessages, setApiMessages] = useState<ApiMessage[]>([]);
  const [display, setDisplay]     = useState<DisplayMessage[]>([]);
  const [chips, setChips]         = useState<string[]>([]);
  const [textInput, setTextInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError]         = useState<string | null>(null);

  // Done state
  // Equipment picker
  const [equipmentList, setEquipmentList]       = useState<EquipmentItem[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<Set<string>>(new Set());
  const [showEquipment, setShowEquipment]       = useState(false);

  const [donePayload, setDonePayload] = useState<DonePayload | null>(null);
  const [taskCount, setTaskCount]     = useState(0);
  const [finishing, setFinishing]     = useState(false);

  const chatRef  = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const userId      = profile?.id;
  const householdId = profile?.household_id;

  // ── Init ───────────────────────────────────────────────────────────────────
  // Load equipment from DB
  useEffect(() => {
    createClient()
      .from('onboarding_equipment')
      .select('*')
      .order('sort_order')
      .then(({ data }) => {
        if (!data) return;
        setEquipmentList(data as EquipmentItem[]);
        setSelectedEquipment(new Set(
          (data as EquipmentItem[]).filter(e => e.is_default).map(e => e.id)
        ));
      });
  }, []);

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
        showEquipment?: boolean;
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

      if (data.showEquipment) {
        setShowEquipment(true);
        setChips([]);
        setStep('chat');
        return;
      }

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

  // Si déjà consenti → passe directement au chat
  useEffect(() => {
    if (profile?.ai_journal_consent_at) startConversation();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.ai_journal_consent_at]);

  const startConversation = useCallback(() => {
    setStep('loading');
    const init: ApiMessage[] = [{ role: 'user', content: 'Commence' }];
    setApiMessages(init);
    void callApi(init);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callApi]);

  // ── Confirm equipment selection ────────────────────────────────────────────
  const confirmEquipment = useCallback(() => {
    const names = equipmentList
      .filter(e => selectedEquipment.has(e.id))
      .map(e => e.name);
    const msg = names.length > 0
      ? `J'ai : ${names.join(', ')}`
      : 'Pas d\'équipements particuliers';
    setShowEquipment(false);
    void sendMessage(msg);
  }, [equipmentList, selectedEquipment, sendMessage]);

  // ── Voice input ────────────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    if (isRecording || isThinking) return;
    const SpeechRecognition =
      (window as unknown as { SpeechRecognition?: typeof window.SpeechRecognition; webkitSpeechRecognition?: typeof window.SpeechRecognition })
        .SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: typeof window.SpeechRecognition })
        .webkitSpeechRecognition;
    if (!SpeechRecognition) return; // navigateur non supporté

    try {
      // Fix PC : demander la permission micro explicitement d'abord
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      return; // permission refusée
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'fr-FR';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart  = () => setIsRecording(true);
    recognition.onend    = () => setIsRecording(false);
    recognition.onerror  = () => setIsRecording(false);

    recognition.onresult = (e: SpeechRecognitionEvent) => {
      const transcript = e.results[0]?.[0]?.transcript ?? '';
      if (transcript.trim()) {
        // Met dans le textarea pour que l'utilisateur puisse vérifier avant d'envoyer
        setTextInput(transcript.trim());
        setTimeout(() => inputRef.current?.focus(), 50);
      }
      setIsRecording(false);
    };

    recognition.start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRecording, isThinking]);

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

  // ── Accept consent → start conversation ───────────────────────────────────
  const acceptConsent = async () => {
    if (userId && !profile?.ai_journal_consent_at) {
      await createClient()
        .from('profiles')
        .update({ ai_journal_consent_at: new Date().toISOString() })
        .eq('id', userId);
      await refreshProfile();
    }
    startConversation();
  };

  // ── Finish ─────────────────────────────────────────────────────────────────
  const handleFinish = async () => {
    if (finishing) return;
    setFinishing(true);
    router.push('/today');
  };

  // ── Consent screen ─────────────────────────────────────────────────────────
  if (step === 'consent') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 py-10"
        style={{ background: 'linear-gradient(135deg,#007aff 0%,#5856d6 100%)' }}>
        <div className="w-full max-w-sm">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center mb-3">
              <span className="text-white font-black text-[28px]">Y</span>
            </div>
            <h1 className="text-white font-black text-[26px]">Bienvenue sur Yova</h1>
            <p className="text-white/70 text-[14px] mt-1 text-center">
              Avant de commencer, une info rapide
            </p>
          </div>

          {/* Card consentement */}
          <div className="rounded-3xl bg-white p-6 space-y-4" style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}>
            <div className="flex items-start gap-3">
              <span className="text-[22px]">🤖</span>
              <div>
                <p className="font-bold text-[15px] text-[#1c1c1e]">Yova utilise l'IA Claude</p>
                <p className="text-[13px] text-[#8e8e93] mt-0.5 leading-relaxed">
                  Nos conversations passent par Claude (Anthropic, USA) pour personnaliser ton expérience.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-[22px]">📤</span>
              <div>
                <p className="font-bold text-[15px] text-[#1c1c1e]">Ce qui est envoyé</p>
                <p className="text-[13px] text-[#8e8e93] mt-0.5 leading-relaxed">
                  Tes réponses durant cette configuration (taille du foyer, enfants, équipements…). Pas de données sensibles.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-[22px]">🔒</span>
              <div>
                <p className="font-bold text-[15px] text-[#1c1c1e]">Tes droits</p>
                <p className="text-[13px] text-[#8e8e93] mt-0.5 leading-relaxed">
                  Suppression à tout moment via Profil → Mes données. Anthropic ne conserve pas tes données au-delà du traitement.
                </p>
              </div>
            </div>

            <button
              onClick={() => void acceptConsent()}
              className="w-full rounded-2xl py-4 text-[17px] font-bold text-white mt-2"
              style={{ background: 'linear-gradient(135deg,#007aff,#5856d6)', boxShadow: '0 4px 16px rgba(0,122,255,0.4)' }}
            >
              J'accepte et je commence →
            </button>
            <p className="text-center text-[11px] text-[#8e8e93]">
              En continuant, tu acceptes nos{' '}
              <a href="/privacy" className="underline">conditions d'utilisation</a>.
            </p>
          </div>
        </div>
      </div>
    );
  }

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

          {/* Quick-reply chips — juste sous le dernier message Yova */}
          {step === 'chat' && !showEquipment && chips.length > 0 && !isThinking && (
            <div className="flex flex-wrap gap-2 pl-9">
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
              <button
                onClick={handleFinish}
                disabled={finishing}
                className="w-full rounded-2xl py-4 text-[17px] font-bold text-white disabled:opacity-40 flex items-center justify-center gap-2"
                style={{
                  background: 'linear-gradient(135deg,#007aff,#5856d6)',
                  boxShadow: '0 8px 24px rgba(0,122,255,0.3)',
                }}
              >
                {finishing && (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                )}
                {finishing ? 'Lancement…' : 'Commencer avec Yova →'}
              </button>
            </div>
          )}

          {/* Equipment picker */}
          {step === 'chat' && showEquipment && (() => {
            const grouped: Record<string, EquipmentItem[]> = {};
            for (const e of equipmentList) {
              if (!grouped[e.category]) grouped[e.category] = [];
              grouped[e.category].push(e);
            }
            return (
              <div className="rounded-2xl bg-white overflow-hidden"
                style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.08)', maxHeight: '55vh', overflowY: 'auto' }}>
                <div className="px-4 pt-3 pb-1">
                  <p className="text-[12px] font-bold text-[#8e8e93] uppercase tracking-wide">
                    Tapez sur ce que vous avez
                  </p>
                </div>
                {Object.entries(grouped).map(([cat, items]) => (
                  <div key={cat} className="px-4 pb-3">
                    <p className="text-[11px] font-semibold text-[#8e8e93] mb-1.5">
                      {EQUIP_CAT_LABELS[cat] ?? cat}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {items.map(eq => {
                        const sel = selectedEquipment.has(eq.id);
                        return (
                          <button key={eq.id}
                            onClick={() => setSelectedEquipment(prev => {
                              const n = new Set(prev);
                              sel ? n.delete(eq.id) : n.add(eq.id);
                              return n;
                            })}
                            className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[13px] font-semibold transition-all active:scale-[0.95]"
                            style={{
                              background: sel ? 'linear-gradient(135deg,#007aff,#5856d6)' : '#f0f4ff',
                              color: sel ? 'white' : '#1c1c1e',
                            }}>
                            <span className="text-[15px]">{eq.icon}</span>
                            <span>{eq.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
                <div className="px-4 pb-4 pt-1">
                  <button onClick={confirmEquipment}
                    className="w-full rounded-2xl py-3 text-[16px] font-bold text-white"
                    style={{ background: 'linear-gradient(135deg,#007aff,#5856d6)', boxShadow: '0 4px 16px rgba(0,122,255,0.3)' }}>
                    Confirmer ({selectedEquipment.size}) →
                  </button>
                </div>
              </div>
            );
          })()}

          {/* Chat input */}
          {step === 'chat' && !showEquipment && (
            <>
              {/* Text input — Entrée = envoyer, Shift+Entrée = nouvelle ligne */}
              <div className="flex gap-2 items-end" style={{ position: 'relative' }}>
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={textInput}
                  onChange={e => {
                    setTextInput(e.target.value);
                    // Auto-resize
                    e.target.style.height = 'auto';
                    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void sendMessage(textInput);
                      // Reset height
                      if (inputRef.current) inputRef.current.style.height = 'auto';
                    }
                  }}
                  placeholder={isThinking ? 'Yova réfléchit…' : 'Répondre… (Shift+↵ pour aller à la ligne)'}
                  disabled={isThinking}
                  className="flex-1 rounded-2xl px-4 py-3 text-[15px] outline-none disabled:opacity-50 resize-none"
                  style={{
                    background: 'white',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                    color: '#1c1c1e',
                    lineHeight: '1.4',
                    overflow: 'hidden',
                  }}
                />
                {/* Bouton micro */}
                <button
                  onClick={() => void startRecording()}
                  disabled={isThinking || !!textInput.trim()}
                  className="rounded-2xl flex items-center justify-center flex-shrink-0 transition-all active:scale-90 disabled:opacity-30"
                  style={{
                    width: 48, height: 48,
                    background: isRecording
                      ? 'linear-gradient(135deg,#ff3b30,#ff6b6b)'
                      : 'white',
                    boxShadow: isRecording
                      ? '0 0 0 4px rgba(255,59,48,0.2)'
                      : '0 1px 4px rgba(0,0,0,0.08)',
                  }}
                  aria-label="Dicter ma réponse"
                >
                  {isRecording ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="#ff3b30">
                      <rect x="6" y="6" width="12" height="12" rx="2"/>
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#007aff" strokeWidth="2" strokeLinecap="round">
                      <rect x="9" y="2" width="6" height="12" rx="3"/>
                      <path d="M5 10a7 7 0 0 0 14 0"/>
                      <line x1="12" y1="19" x2="12" y2="22"/>
                      <line x1="9" y1="22" x2="15" y2="22"/>
                    </svg>
                  )}
                </button>

                {/* Bouton envoyer */}
                <button
                  onClick={() => void sendMessage(textInput)}
                  disabled={!textInput.trim() || isThinking}
                  className="rounded-2xl px-4 text-white text-[20px] font-bold disabled:opacity-40 flex items-center justify-center flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg,#007aff,#5856d6)', width: 48, height: 48 }}
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
