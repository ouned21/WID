import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'The Load — Mesurez, équilibrez, allégez la charge de votre foyer',
  description: 'Application de suivi et rééquilibrage des tâches domestiques. Mesurez la charge mentale, visualisez la répartition, proposez des échanges.',
};

export default function LandingPage() {
  return (
    <div style={{ background: '#f2f2f7' }}>
      {/* Hero */}
      <section className="min-h-screen flex flex-col items-center justify-center px-6 text-center" style={{ background: 'linear-gradient(135deg, #007aff 0%, #5856d6 50%, #af52de 100%)' }}>
        <div className="max-w-lg">
          <div className="inline-flex h-20 w-20 items-center justify-center rounded-[22px] text-[36px] font-black text-white mb-6" style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)' }}>
            TL
          </div>
          <h1 className="text-[40px] font-black text-white leading-tight mb-4">
            The Load
          </h1>
          <p className="text-[20px] text-white/90 font-medium mb-2">
            Mesurez. Équilibrez. Allégez.
          </p>
          <p className="text-[16px] text-white/70 mb-8 max-w-md mx-auto">
            La première app qui mesure vraiment la charge mentale de votre foyer — pas juste le temps passé.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/register"
              className="rounded-2xl bg-white px-8 py-4 text-[17px] font-bold text-[#007aff] shadow-lg hover:shadow-xl transition-all">
              Commencer gratuitement
            </Link>
            <a href="#features"
              className="rounded-2xl bg-white/10 backdrop-blur px-8 py-4 text-[17px] font-semibold text-white border border-white/20">
              En savoir plus
            </a>
          </div>
        </div>
      </section>

      {/* Le problème */}
      <section className="py-20 px-6" id="problem">
        <div className="max-w-lg mx-auto text-center">
          <p className="text-[14px] font-semibold text-[#007aff] uppercase tracking-wide mb-3">Le problème</p>
          <h2 className="text-[28px] font-bold text-[#1c1c1e] mb-6">
            91% des parents ressentent une charge mentale liée au quotidien
          </h2>
          <p className="text-[16px] text-[#8e8e93] mb-8">
            Mais aucun outil ne la mesure vraiment. Les to-do lists comptent les tâches, pas leur poids réel. Résultat : des discussions sans fin sur &quot;qui fait quoi&quot; sans données factuelles.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-2xl bg-white p-5" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <p className="text-[32px] mb-2">🧠</p>
              <p className="text-[15px] font-bold text-[#1c1c1e]">Charge invisible</p>
              <p className="text-[13px] text-[#8e8e93] mt-1">Anticiper, organiser, se souvenir — le travail que personne ne voit</p>
            </div>
            <div className="rounded-2xl bg-white p-5" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <p className="text-[32px] mb-2">⚖️</p>
              <p className="text-[15px] font-bold text-[#1c1c1e]">Déséquilibre</p>
              <p className="text-[13px] text-[#8e8e93] mt-1">Une personne porte souvent plus que l&apos;autre sans que ce soit visible</p>
            </div>
            <div className="rounded-2xl bg-white p-5" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <p className="text-[32px] mb-2">💬</p>
              <p className="text-[15px] font-bold text-[#1c1c1e]">Conflits</p>
              <p className="text-[13px] text-[#8e8e93] mt-1">Sans données, les discussions sur la répartition tournent en rond</p>
            </div>
          </div>
        </div>
      </section>

      {/* La solution */}
      <section className="py-20 px-6 bg-white" id="features">
        <div className="max-w-lg mx-auto">
          <p className="text-[14px] font-semibold text-[#af52de] uppercase tracking-wide mb-3 text-center">La solution</p>
          <h2 className="text-[28px] font-bold text-[#1c1c1e] mb-10 text-center">
            The Load mesure ce qui compte vraiment
          </h2>

          <div className="space-y-8">
            <div className="flex gap-4">
              <div className="flex-shrink-0 h-10 w-10 rounded-xl flex items-center justify-center text-white font-bold" style={{ background: '#007aff' }}>1</div>
              <div>
                <h3 className="text-[17px] font-bold text-[#1c1c1e]">Score automatique sur 4 axes</h3>
                <p className="text-[14px] text-[#8e8e93] mt-1">Durée, effort physique, charge mentale, impact sur le foyer. Calculé automatiquement, pas subjectivement.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 h-10 w-10 rounded-xl flex items-center justify-center text-white font-bold" style={{ background: '#af52de' }}>2</div>
              <div>
                <h3 className="text-[17px] font-bold text-[#1c1c1e]">Dashboard de répartition</h3>
                <p className="text-[14px] text-[#8e8e93] mt-1">Visualisez en un coup d&apos;œil qui fait quoi, la charge mentale cumulée, les tendances et les déséquilibres.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 h-10 w-10 rounded-xl flex items-center justify-center text-white font-bold" style={{ background: '#34c759' }}>3</div>
              <div>
                <h3 className="text-[17px] font-bold text-[#1c1c1e]">Suggestions de rééquilibrage</h3>
                <p className="text-[14px] text-[#8e8e93] mt-1">L&apos;app propose des échanges de tâches concrets pour atteindre l&apos;équilibre que vous visez — sans conflit.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 h-10 w-10 rounded-xl flex items-center justify-center text-white font-bold" style={{ background: '#ff9500' }}>4</div>
              <div>
                <h3 className="text-[17px] font-bold text-[#1c1c1e]">Chaque membre définit son objectif</h3>
                <p className="text-[14px] text-[#8e8e93] mt-1">Pas de 50/50 imposé. Chacun choisit sa cible et l&apos;app compare la réalité à l&apos;objectif.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Comment ça marche */}
      <section className="py-20 px-6" id="how">
        <div className="max-w-lg mx-auto text-center">
          <p className="text-[14px] font-semibold text-[#34c759] uppercase tracking-wide mb-3">Simple</p>
          <h2 className="text-[28px] font-bold text-[#1c1c1e] mb-10">
            3 étapes pour commencer
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div>
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl text-[24px] mb-3" style={{ background: '#f0f4ff' }}>📝</div>
              <h3 className="text-[15px] font-bold text-[#1c1c1e]">Décrivez vos tâches</h3>
              <p className="text-[13px] text-[#8e8e93] mt-1">Tapez le nom, l&apos;app détecte le type et calcule le score</p>
            </div>
            <div>
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl text-[24px] mb-3" style={{ background: '#f0fff4' }}>✓</div>
              <h3 className="text-[15px] font-bold text-[#1c1c1e]">Validez en 1 tap</h3>
              <p className="text-[13px] text-[#8e8e93] mt-1">Un bouton FAIT et c&apos;est enregistré. Quick Log pour les tâches spontanées</p>
            </div>
            <div>
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl text-[24px] mb-3" style={{ background: '#fff8f0' }}>📊</div>
              <h3 className="text-[15px] font-bold text-[#1c1c1e]">Comprenez et agissez</h3>
              <p className="text-[13px] text-[#8e8e93] mt-1">Dashboard, tendances, suggestions d&apos;échanges. Des faits, pas des impressions</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 text-center" style={{ background: 'linear-gradient(135deg, #007aff, #5856d6)' }}>
        <div className="max-w-lg mx-auto">
          <h2 className="text-[28px] font-bold text-white mb-4">
            Arrêtez de deviner. Commencez à mesurer.
          </h2>
          <p className="text-[16px] text-white/80 mb-8">
            Gratuit. Aucune carte bancaire requise.
          </p>
          <Link href="/register"
            className="inline-block rounded-2xl bg-white px-10 py-4 text-[17px] font-bold text-[#007aff] shadow-lg hover:shadow-xl transition-all">
            Créer mon compte
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 text-center">
        <p className="text-[13px] text-[#8e8e93]">
          The Load © {new Date().getFullYear()} — Mesurez, équilibrez, allégez
        </p>
      </footer>
    </div>
  );
}
