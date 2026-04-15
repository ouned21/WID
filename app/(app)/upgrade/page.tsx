'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

type Feature = {
  id: string;
  emoji: string;
  title: string;
  description: string;
};

const FEATURES: Feature[] = [
  { id: 'score', emoji: '📊', title: 'Mon Score', description: 'Découvre le poids réel de tes tâches sur une échelle de 1 à 10' },
  { id: 'repartition', emoji: '⚖️', title: 'Répartition du foyer', description: 'Vois qui fait quoi et dans quelle proportion' },
  { id: 'dashboard', emoji: '📈', title: 'Dashboard analytique', description: 'Évolution, objectif, tendances — en un coup d\'œil' },
  { id: 'insights', emoji: '🧠', title: 'Insights IA', description: 'Aura détecte les déséquilibres et te propose des solutions' },
  { id: 'summary', emoji: '📝', title: 'Résumé hebdo IA', description: 'Un résumé personnalisé de ta semaine chaque dimanche' },
  { id: 'exchanges', emoji: '🔄', title: 'Échanges de tâches', description: 'Propose un rééquilibrage concret à ton conjoint' },
  { id: 'packs', emoji: '📦', title: 'Packs Projets', description: 'Déménagement, Mariage, Bébé — tout est prêt en 1 clic' },
  { id: 'members', emoji: '👨‍👩‍👧‍👦', title: 'Membres illimités', description: 'Ajoute toute ta famille (gratuit limité à 2)' },
  { id: 'voice', emoji: '🎙', title: 'Assistant vocal', description: '"Hey Aura, ajoute un rdv dentiste" — elle fait le reste' },
  { id: 'photo', emoji: '📸', title: 'Scan photo du foyer', description: 'Prends une photo, Aura identifie ce qu\'il y a à entretenir' },
  { id: 'calendar', emoji: '🗓', title: 'Synchro Google/Apple Calendar', description: 'Ton planning Aura dans ton calendrier préféré' },
  { id: 'vacation', emoji: '🏖', title: 'Mode vacances intelligent', description: 'Aura prépare ton départ et ton retour automatiquement' },
];

export default function UpgradePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const focusFeature = searchParams.get('feature'); // ex: ?feature=score
  const [submitting, setSubmitting] = useState(false);

  // Remonter en haut et focus sur la feature si spécifiée
  useEffect(() => {
    if (focusFeature) {
      const el = document.getElementById(`feature-${focusFeature}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [focusFeature]);

  const handleCheckout = async () => {
    // Placeholder — Stripe à brancher
    setSubmitting(true);
    alert('Le paiement sera activé bientôt. Pour l\'instant, contacte-nous pour un accès early adopter.');
    setSubmitting(false);
  };

  return (
    <div className="pt-4 pb-16">
      {/* Header */}
      <div className="px-4 mb-4">
        <button onClick={() => router.back()} className="text-[15px] font-medium mb-4" style={{ color: '#007aff' }}>
          ← Retour
        </button>
      </div>

      {/* Hero premium */}
      <div className="mx-4 rounded-3xl p-6 relative overflow-hidden mb-6" style={{
        background: 'linear-gradient(135deg, #0a1628 0%, #1e3a5f 50%, #3a1c71 100%)',
        boxShadow: '0 20px 60px rgba(10,22,40,0.4)',
      }}>
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: 'radial-gradient(1px 1px at 20% 30%, white, transparent), radial-gradient(1px 1px at 80% 10%, white, transparent), radial-gradient(1px 1px at 50% 70%, white, transparent), radial-gradient(1px 1px at 10% 80%, white, transparent)',
        }} />
        <div className="relative z-10">
          <p className="text-[12px] font-bold text-white/60 uppercase tracking-[0.25em] mb-3">Aura Premium</p>
          <h1 className="text-[32px] font-black text-white leading-none mb-3" style={{ letterSpacing: '-0.02em' }}>
            Débloque<br />tout le potentiel.
          </h1>
          <p className="text-[15px] text-white/80 leading-relaxed">
            Tu as déjà le meilleur de la planification automatique.
            <br />
            Premium débloque la <strong>mesure, la répartition et l&apos;analyse</strong> pour ton foyer.
          </p>
        </div>
      </div>

      {/* Prix */}
      <div className="mx-4 rounded-2xl bg-white p-6 mb-6" style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>
        <div className="flex items-baseline justify-center gap-2 mb-2">
          <span className="text-[56px] font-black text-[#1c1c1e]">29€</span>
          <span className="text-[18px] text-[#8e8e93]">/ an</span>
        </div>
        <p className="text-center text-[13px] text-[#8e8e93] mb-4">
          soit <strong className="text-[#1c1c1e]">2,40€/mois</strong> · Moins qu&apos;un café
        </p>

        <button
          onClick={handleCheckout}
          disabled={submitting}
          className="w-full rounded-2xl py-4 text-[17px] font-bold text-white transition-transform active:scale-[0.97] disabled:opacity-50"
          style={{
            background: 'linear-gradient(135deg, #007aff, #5856d6)',
            boxShadow: '0 8px 24px rgba(0,122,255,0.3)',
          }}
        >
          {submitting ? 'Chargement…' : 'Passer Premium'}
        </button>

        <p className="text-center text-[11px] text-[#c7c7cc] mt-3">
          Aucun engagement · Résiliable à tout moment
        </p>
      </div>

      {/* Liste des features */}
      <div className="mx-4">
        <p className="text-[13px] font-bold text-[#8e8e93] uppercase tracking-[0.15em] mb-3 px-1">
          Ce que tu débloques
        </p>
        <div className="space-y-3">
          {FEATURES.map((f) => {
            const isFocus = focusFeature === f.id;
            return (
              <div
                key={f.id}
                id={`feature-${f.id}`}
                className="rounded-2xl bg-white p-4 flex items-start gap-4"
                style={{
                  boxShadow: isFocus ? '0 4px 24px rgba(0,122,255,0.2)' : '0 1px 4px rgba(0,0,0,0.04)',
                  border: isFocus ? '2px solid #007aff' : '2px solid transparent',
                  transition: 'all 0.3s',
                }}
              >
                <div className="flex-shrink-0 h-12 w-12 rounded-2xl flex items-center justify-center text-[24px]" style={{
                  background: isFocus ? 'linear-gradient(135deg, #007aff, #5856d6)' : '#f0f2f8',
                }}>
                  <span style={{ filter: isFocus ? 'brightness(1.5) saturate(0)' : 'none', color: isFocus ? 'white' : undefined }}>
                    {f.emoji}
                  </span>
                </div>
                <div className="flex-1">
                  <h3 className="text-[15px] font-bold text-[#1c1c1e]">{f.title}</h3>
                  <p className="text-[13px] text-[#8e8e93] mt-0.5 leading-relaxed">{f.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Second CTA */}
      <div className="mx-4 mt-8">
        <button
          onClick={handleCheckout}
          disabled={submitting}
          className="w-full rounded-2xl py-4 text-[17px] font-bold text-white transition-transform active:scale-[0.97] disabled:opacity-50"
          style={{
            background: 'linear-gradient(135deg, #007aff, #5856d6)',
            boxShadow: '0 8px 24px rgba(0,122,255,0.3)',
          }}
        >
          Passer Premium — 29€/an
        </button>
        <p className="text-center text-[12px] text-[#8e8e93] mt-3">
          En cas de questions : <a href="mailto:hello@aura.app" style={{ color: '#007aff' }}>hello@aura.app</a>
        </p>
      </div>
    </div>
  );
}
