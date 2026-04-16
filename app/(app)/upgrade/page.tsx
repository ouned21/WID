'use client';

import { useRouter } from 'next/navigation';

type Feature = {
  id: string;
  emoji: string;
  title: string;
  description: string;
};

const FEATURES: Feature[] = [
  { id: 'journal', emoji: '📓', title: 'Journal Aura illimité', description: 'Envoie autant d\'entrées que tu veux chaque mois — sans limite de tokens IA' },
  { id: 'insights', emoji: '🧠', title: 'Insights IA hebdomadaires', description: 'Chaque dimanche, Aura analyse ta semaine et détecte les déséquilibres' },
  { id: 'ghost', emoji: '👻', title: 'Membres fantômes illimités', description: 'Suis les tâches de membres absents ou sans compte (gratuit limité à 1)' },
  { id: 'stats', emoji: '📊', title: 'Statistiques avancées', description: 'Évolution, répartition, tendances — données complètes sur 12 mois' },
  { id: 'repartition', emoji: '⚖️', title: 'Répartition du foyer', description: 'Vois qui fait quoi et dans quelle proportion, en temps réel' },
  { id: 'summary', emoji: '📝', title: 'Résumé hebdo IA', description: 'Un résumé personnalisé de ta semaine envoyé chaque dimanche' },
  { id: 'exchanges', emoji: '🔄', title: 'Échanges de tâches', description: 'Propose un rééquilibrage concret à ton conjoint en un tap' },
  { id: 'members', emoji: '👨‍👩‍👧‍👦', title: 'Membres illimités', description: 'Ajoute toute ta famille (gratuit limité à 2)' },
];

export default function UpgradePage() {
  const router = useRouter();

  return (
    <div className="pt-4 pb-16">
      {/* Header */}
      <div className="px-4 mb-4">
        <button
          onClick={() => router.back()}
          className="text-[15px] font-medium"
          style={{ color: '#007aff' }}
        >
          ← Retour
        </button>
      </div>

      {/* Hero gradient violet/bleu */}
      <div
        className="mx-4 rounded-3xl p-6 relative overflow-hidden mb-6"
        style={{
          background: 'linear-gradient(135deg, #1a0533 0%, #3a1c71 40%, #0a3d8f 100%)',
          boxShadow: '0 20px 60px rgba(58,28,113,0.45)',
        }}
      >
        {/* Étoiles décoratives */}
        <div
          className="absolute inset-0 opacity-25"
          style={{
            backgroundImage:
              'radial-gradient(1.5px 1.5px at 15% 25%, white, transparent),' +
              'radial-gradient(1px 1px at 75% 15%, white, transparent),' +
              'radial-gradient(1px 1px at 45% 65%, white, transparent),' +
              'radial-gradient(1.5px 1.5px at 85% 55%, white, transparent),' +
              'radial-gradient(1px 1px at 30% 80%, white, transparent),' +
              'radial-gradient(1px 1px at 60% 40%, white, transparent)',
          }}
        />
        {/* Halo lumineux */}
        <div
          className="absolute top-0 right-0 w-40 h-40 rounded-full opacity-20"
          style={{
            background: 'radial-gradient(circle, #a78bfa, transparent 70%)',
            transform: 'translate(30%, -30%)',
          }}
        />
        <div className="relative z-10">
          <p className="text-[12px] font-bold text-white/60 uppercase tracking-[0.25em] mb-3">
            Aura Premium
          </p>
          <h1
            className="text-[34px] font-black text-white leading-none mb-4"
            style={{ letterSpacing: '-0.02em' }}
          >
            Passe à Premium 🌟
          </h1>
          <p className="text-[15px] text-white/80 leading-relaxed">
            Débloque l&apos;IA sans limites, les statistiques avancées et bien plus
            pour un foyer vraiment équilibré.
          </p>
        </div>
      </div>

      {/* Prix + CTA */}
      <div
        className="mx-4 rounded-3xl bg-white p-6 mb-6"
        style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.07)' }}
      >
        <div className="flex items-baseline justify-center gap-1 mb-1">
          <span className="text-[52px] font-black text-[#1c1c1e]">4,99€</span>
          <span className="text-[18px] text-[#8e8e93]">/mois</span>
        </div>
        <p className="text-center text-[13px] text-[#8e8e93] mb-5">
          7 jours d&apos;essai gratuit · Sans engagement
        </p>

        {/* Bouton désactivé */}
        <button
          disabled
          className="w-full rounded-2xl py-4 text-[17px] font-bold text-white/70 cursor-not-allowed"
          style={{
            background: 'linear-gradient(135deg, #9b59b6, #3a7bd5)',
            opacity: 0.65,
            boxShadow: '0 6px 20px rgba(155,89,182,0.2)',
          }}
        >
          Essayer 7 jours gratuits
        </button>

        <p
          className="text-center text-[13px] font-semibold mt-3"
          style={{ color: '#8e8e93' }}
        >
          🔒 Bientôt disponible
        </p>

        <p className="text-center text-[11px] text-[#c7c7cc] mt-1">
          Le paiement sera activé lors du lancement officiel
        </p>
      </div>

      {/* Liste des avantages */}
      <div className="mx-4">
        <p className="text-[13px] font-bold text-[#8e8e93] uppercase tracking-[0.15em] mb-3 px-1">
          Ce que tu débloques
        </p>
        <div className="space-y-3">
          {FEATURES.map((f, index) => {
            const isHighlighted = index < 4; // Les 4 premiers sont mis en avant
            return (
              <div
                key={f.id}
                id={`feature-${f.id}`}
                className="rounded-2xl bg-white p-4 flex items-start gap-4"
                style={{
                  boxShadow: isHighlighted
                    ? '0 4px 16px rgba(118,75,162,0.12)'
                    : '0 1px 4px rgba(0,0,0,0.04)',
                  border: isHighlighted
                    ? '1.5px solid rgba(118,75,162,0.15)'
                    : '1.5px solid transparent',
                }}
              >
                <div
                  className="flex-shrink-0 h-12 w-12 rounded-2xl flex items-center justify-center text-[24px]"
                  style={{
                    background: isHighlighted
                      ? 'linear-gradient(135deg, rgba(58,28,113,0.1), rgba(10,61,143,0.1))'
                      : '#f0f2f8',
                  }}
                >
                  {f.emoji}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[15px] font-bold text-[#1c1c1e]">{f.title}</h3>
                    {isHighlighted && (
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{
                          background: 'linear-gradient(135deg, #3a1c71, #0a3d8f)',
                          color: 'white',
                        }}
                      >
                        Clé
                      </span>
                    )}
                  </div>
                  <p className="text-[13px] text-[#8e8e93] mt-0.5 leading-relaxed">
                    {f.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Second CTA bas de page */}
      <div className="mx-4 mt-8">
        <button
          disabled
          className="w-full rounded-2xl py-4 text-[17px] font-bold text-white/70 cursor-not-allowed"
          style={{
            background: 'linear-gradient(135deg, #9b59b6, #3a7bd5)',
            opacity: 0.65,
            boxShadow: '0 6px 20px rgba(155,89,182,0.2)',
          }}
        >
          Essayer 7 jours gratuits — 4,99€/mois
        </button>
        <p className="text-center text-[12px] text-[#8e8e93] mt-3">
          Des questions ?{' '}
          <a href="mailto:hello@aura.app" style={{ color: '#007aff' }}>
            hello@aura.app
          </a>
        </p>
      </div>
    </div>
  );
}
