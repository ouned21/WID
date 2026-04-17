'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import BackButton from '@/components/BackButton';
import { useAuthStore } from '@/stores/authStore';
import { useTaskStore } from '@/stores/taskStore';
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

  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<ParseResponse | null>(null);
  const [history, setHistory] = useState<PastJournal[]>([]);
  const [showHistory, setShowHistory] = useState(false);

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

  // Charger l'historique
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
    loadHistory();
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
      // Recharger les tâches car les complétions ont changé
      if (profile?.household_id) await fetchTasks(profile.household_id);
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

      {/* Bloc principal : saisie */}
      <div className="mx-4">
        <div className="rounded-3xl p-5 mb-4" style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          boxShadow: '0 8px 24px rgba(118, 75, 162, 0.2)',
        }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full text-[20px]" style={{ background: 'rgba(255,255,255,0.25)' }}>
              🤖
            </div>
            <div>
              <p className="text-[17px] font-bold text-white">Yova</p>
              <p className="text-[12px] text-white opacity-80">Raconte-moi ta journée</p>
            </div>
          </div>
          <p className="text-[14px] text-white opacity-90 leading-relaxed">
            Dis-moi simplement ce que tu as fait aujourd&apos;hui, en une phrase ou deux.
            Je note tout et je mets à jour ton foyer.
          </p>
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={2000}
          rows={5}
          disabled={sending}
          placeholder="Ce matin j'ai sorti le chien et fait les courses. Ce soir Barbara a préparé le dîner..."
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

      {/* Résultat du parsing */}
      {result && result.code !== 'AI_LIMIT_REACHED' && (
        <div className="mx-4 rounded-2xl bg-white overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          {/* Réponse Yova */}
          <div className="px-5 py-4" style={{ background: '#EEF4FF', borderBottom: '0.5px solid var(--ios-separator)' }}>
            <div className="flex items-start gap-3">
              <span className="text-[24px]">{result.mood_tone ? MOOD_EMOJI[result.mood_tone] ?? '🤖' : '🤖'}</span>
              <p className="text-[15px] text-[#1c1c1e] leading-relaxed flex-1">{result.ai_response}</p>
            </div>
          </div>

          {/* Complétions enregistrées */}
          {result.completions.length > 0 && (
            <div className="px-5 py-4" style={{ borderBottom: '0.5px solid var(--ios-separator)' }}>
              <p className="text-[11px] font-bold text-[#34c759] uppercase tracking-wide mb-3">
                ✓ {result.completions.length} tâche{result.completions.length > 1 ? 's' : ''} enregistrée{result.completions.length > 1 ? 's' : ''}
              </p>
              <div className="space-y-2">
                {result.completions.map((c, i) => (
                  <div key={i} className="flex items-center justify-between text-[14px]">
                    <span className="text-[#1c1c1e]">{c.task_name}</span>
                    <div className="flex items-center gap-2 text-[11px] text-[#8e8e93]">
                      {c.duration_minutes && <span>{c.duration_minutes}min</span>}
                      <span className={c.confidence >= 0.8 ? 'text-[#34c759]' : c.confidence >= 0.5 ? 'text-[#ff9500]' : 'text-[#ff3b30]'}>
                        {Math.round(c.confidence * 100)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tâches auto-créées */}
          {result.auto_created && result.auto_created.length > 0 && (
            <div className="px-5 py-4" style={result.unmatched.length > 0 ? { borderBottom: '0.5px solid var(--ios-separator)' } : {}}>
              <p className="text-[11px] font-bold text-[#007aff] uppercase tracking-wide mb-3">
                ✨ {result.auto_created.length} nouvelle{result.auto_created.length > 1 ? 's' : ''} tâche{result.auto_created.length > 1 ? 's' : ''} créée{result.auto_created.length > 1 ? 's' : ''} & enregistrée{result.auto_created.length > 1 ? 's' : ''}
              </p>
              <div className="space-y-2">
                {result.auto_created.map((t, i) => (
                  <div key={i} className="flex items-center gap-2 text-[14px]">
                    <span className="text-[16px]">✨</span>
                    <span className="text-[#1c1c1e]">{t.name}</span>
                    <span className="ml-auto text-[11px] text-[#007aff] font-semibold">Nouveau</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Items non matchés */}
          {result.unmatched.length > 0 && (
            <div className="px-5 py-4">
              <p className="text-[11px] font-bold text-[#ff9500] uppercase tracking-wide mb-2">
                ℹ︎ Pas une tâche
              </p>
              <div className="space-y-1">
                {result.unmatched.map((u, i) => (
                  <p key={i} className="text-[13px] text-[#8e8e93] italic">&laquo; {u} &raquo;</p>
                ))}
              </div>
            </div>
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
