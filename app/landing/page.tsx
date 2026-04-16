import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Yova — L\'agent qui planifie ton foyer à ta place',
  description: 'Yova est l\'intelligence artificielle qui anticipe, rappelle et planifie toutes les tâches de ton foyer. Tu te concentres sur l\'essentiel, Yova s\'occupe du reste.',
};

export default function LandingPage() {
  return (
    <div style={{ background: '#f6f8ff' }}>
      {/* Hero */}
      <section className="min-h-screen flex flex-col items-center justify-center px-6 text-center relative overflow-hidden" style={{
        background: 'linear-gradient(135deg, #0a1628 0%, #162544 40%, #1e3a5f 100%)',
      }}>
        {/* Étoiles en fond */}
        <div className="absolute inset-0 opacity-40" style={{
          backgroundImage: 'radial-gradient(1px 1px at 20% 30%, white, transparent), radial-gradient(1px 1px at 80% 10%, white, transparent), radial-gradient(1px 1px at 50% 70%, white, transparent), radial-gradient(1px 1px at 10% 80%, white, transparent), radial-gradient(1px 1px at 90% 60%, white, transparent), radial-gradient(1.5px 1.5px at 35% 50%, white, transparent), radial-gradient(1px 1px at 70% 85%, white, transparent)',
        }} />

        <div className="max-w-xl relative z-10">
          <div className="inline-flex h-24 w-24 items-center justify-center rounded-[28px] text-[44px] font-black text-white mb-8" style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.2), rgba(255,255,255,0.05))',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.15)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
          }}>
            A
          </div>
          <h1 className="text-[56px] font-black text-white leading-none mb-4" style={{ letterSpacing: '-0.03em' }}>
            Yova
          </h1>
          <p className="text-[22px] text-white/90 font-semibold mb-3">
            Ne pense plus à tout ça.
          </p>
          <p className="text-[17px] text-white/60 mb-10 max-w-md mx-auto leading-relaxed">
            L&apos;agent intelligent qui anticipe, rappelle et planifie toutes les tâches de ton foyer. Tu te concentres sur l&apos;essentiel, Yova s&apos;occupe du reste.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/register"
              className="rounded-2xl px-8 py-4 text-[17px] font-bold transition-all"
              style={{
                background: 'white',
                color: '#0a1628',
                boxShadow: '0 10px 40px rgba(255,255,255,0.25)',
              }}>
              Commencer gratuitement →
            </Link>
            <a href="#comment"
              className="rounded-2xl px-8 py-4 text-[17px] font-semibold text-white"
              style={{
                background: 'rgba(255,255,255,0.1)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.2)',
              }}>
              Comment ça marche
            </a>
          </div>
          <p className="text-[12px] text-white/40 mt-6">Gratuit. Sans carte bancaire. Sans engagement.</p>
        </div>
      </section>

      {/* Le problème */}
      <section className="py-24 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-[13px] font-bold text-[#007aff] uppercase tracking-[0.2em] mb-4">Le constat</p>
          <h2 className="text-[32px] font-bold text-[#1c1c1e] mb-6 leading-tight">
            Ta tête n&apos;est pas un agenda.
          </h2>
          <p className="text-[17px] text-[#3c3c43] mb-10 leading-relaxed">
            Les rendez-vous médicaux. Les courses. Les papiers. Les anniversaires. Les devoirs. L&apos;entretien de la maison. Les impôts. Le contrôle technique. La rentrée scolaire.
            <br /><br />
            <strong className="text-[#1c1c1e]">Tu portes tout ça dans ta tête.</strong> Et tu n&apos;es pas payée pour ça.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-12">
            <div className="rounded-2xl bg-white p-6" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <p className="text-[40px] font-black" style={{ color: '#007aff' }}>71%</p>
              <p className="text-[13px] text-[#8e8e93] mt-2">de la charge mentale portée par les mères</p>
            </div>
            <div className="rounded-2xl bg-white p-6" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <p className="text-[40px] font-black" style={{ color: '#af52de' }}>2-3h</p>
              <p className="text-[13px] text-[#8e8e93] mt-2">par semaine juste à penser au foyer</p>
            </div>
            <div className="rounded-2xl bg-white p-6" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <p className="text-[40px] font-black" style={{ color: '#ff3b30' }}>63%</p>
              <p className="text-[13px] text-[#8e8e93] mt-2">des femmes se sentent seules à tout gérer</p>
            </div>
          </div>
        </div>
      </section>

      {/* La solution */}
      <section className="py-24 px-6 bg-white" id="comment">
        <div className="max-w-2xl mx-auto">
          <p className="text-[13px] font-bold text-[#007aff] uppercase tracking-[0.2em] mb-4 text-center">La solution</p>
          <h2 className="text-[32px] font-bold text-[#1c1c1e] mb-12 text-center leading-tight">
            Yova pense à tout. Toi, tu vis.
          </h2>

          <div className="space-y-10">
            <div className="flex gap-5">
              <div className="flex-shrink-0 h-12 w-12 rounded-2xl flex items-center justify-center text-[20px]" style={{ background: 'linear-gradient(135deg, #007aff, #5856d6)', boxShadow: '0 4px 16px rgba(0,122,255,0.3)' }}>
                <span>🏠</span>
              </div>
              <div>
                <h3 className="text-[19px] font-bold text-[#1c1c1e] mb-2">Scanne ton foyer en 2 minutes</h3>
                <p className="text-[15px] text-[#3c3c43] leading-relaxed">Sélectionne tes équipements, ta famille, tes animaux. C&apos;est tout. Yova découvre ton monde en quelques taps.</p>
              </div>
            </div>

            <div className="flex gap-5">
              <div className="flex-shrink-0 h-12 w-12 rounded-2xl flex items-center justify-center text-[20px]" style={{ background: 'linear-gradient(135deg, #5856d6, #af52de)', boxShadow: '0 4px 16px rgba(88,86,214,0.3)' }}>
                <span>✨</span>
              </div>
              <div>
                <h3 className="text-[19px] font-bold text-[#1c1c1e] mb-2">Yova génère 3 mois de planning</h3>
                <p className="text-[15px] text-[#3c3c43] leading-relaxed">Des dizaines de tâches, sous-tâches et rappels — même ceux auxquels tu n&apos;aurais jamais pensé. Contrôle technique, vaccins, préparation rentrée, saisonnalité.</p>
              </div>
            </div>

            <div className="flex gap-5">
              <div className="flex-shrink-0 h-12 w-12 rounded-2xl flex items-center justify-center text-[20px]" style={{ background: 'linear-gradient(135deg, #af52de, #ff2d55)', boxShadow: '0 4px 16px rgba(175,82,222,0.3)' }}>
                <span>📅</span>
              </div>
              <div>
                <h3 className="text-[19px] font-bold text-[#1c1c1e] mb-2">Tout apparaît dans ton calendrier</h3>
                <p className="text-[15px] text-[#3c3c43] leading-relaxed">Chaque tâche est positionnée à la bonne date. Tu swipes pour assigner : toi, ton conjoint, ou personne. Yova s&apos;adapte à ta vie.</p>
              </div>
            </div>

            <div className="flex gap-5">
              <div className="flex-shrink-0 h-12 w-12 rounded-2xl flex items-center justify-center text-[20px]" style={{ background: 'linear-gradient(135deg, #ff2d55, #ff9500)', boxShadow: '0 4px 16px rgba(255,45,85,0.3)' }}>
                <span>🌤</span>
              </div>
              <div>
                <h3 className="text-[19px] font-bold text-[#1c1c1e] mb-2">Et surtout : Yova te rappelle</h3>
                <p className="text-[15px] text-[#3c3c43] leading-relaxed">Les rappels proactifs, la météo qui décale tes tâches extérieures, les anniversaires, les échéances administratives. Tout ce que tu gérais dans ta tête, Yova le prend en charge.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Ce qui rend Yova unique */}
      <section className="py-24 px-6" style={{ background: '#f6f8ff' }}>
        <div className="max-w-2xl mx-auto">
          <p className="text-[13px] font-bold text-[#ff9500] uppercase tracking-[0.2em] mb-4 text-center">Unique</p>
          <h2 className="text-[32px] font-bold text-[#1c1c1e] mb-10 text-center">
            Ce que personne d&apos;autre ne fait
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-2xl bg-white p-6" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <p className="text-[28px] mb-3">🤖</p>
              <h3 className="text-[16px] font-bold text-[#1c1c1e]">Onboarding en 2 minutes</h3>
              <p className="text-[13px] text-[#8e8e93] mt-2 leading-relaxed">Aucune saisie manuelle. Juste des taps sur ton foyer et l&apos;IA fait le reste.</p>
            </div>
            <div className="rounded-2xl bg-white p-6" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <p className="text-[28px] mb-3">👻</p>
              <h3 className="text-[16px] font-bold text-[#1c1c1e]">Utilise Yova sans ton conjoint</h3>
              <p className="text-[13px] text-[#8e8e93] mt-2 leading-relaxed">Crée un membre fantôme avec juste un prénom. Yova s&apos;occupe du foyer même si l&apos;autre n&apos;est pas inscrit.</p>
            </div>
            <div className="rounded-2xl bg-white p-6" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <p className="text-[28px] mb-3">💡</p>
              <h3 className="text-[16px] font-bold text-[#1c1c1e]">Les tâches que tu oubliais</h3>
              <p className="text-[13px] text-[#8e8e93] mt-2 leading-relaxed">Contrôle technique voiture, vignette Crit&apos;Air, piles détecteurs fumée, rappel vaccin enfant. Yova y pense pour toi.</p>
            </div>
            <div className="rounded-2xl bg-white p-6" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <p className="text-[28px] mb-3">🌤</p>
              <h3 className="text-[16px] font-bold text-[#1c1c1e]">L&apos;IA adapte ton planning</h3>
              <p className="text-[13px] text-[#8e8e93] mt-2 leading-relaxed">Il pleut demain ? Yova décale ta tonte automatiquement. Vacances scolaires ? Elle adapte les tâches enfants.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="py-24 px-6 text-center" style={{
        background: 'linear-gradient(135deg, #0a1628, #1e3a5f)',
      }}>
        <div className="max-w-xl mx-auto">
          <h2 className="text-[36px] font-black text-white mb-5 leading-tight">
            Arrête de penser.<br />Commence à vivre.
          </h2>
          <p className="text-[17px] text-white/70 mb-10">
            Yova est gratuit. Aucune carte bancaire. Aucune limite dans le temps.
          </p>
          <Link href="/register"
            className="inline-block rounded-2xl px-10 py-5 text-[18px] font-bold transition-all"
            style={{
              background: 'white',
              color: '#0a1628',
              boxShadow: '0 20px 60px rgba(255,255,255,0.15)',
            }}>
            Décharger ma tête →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-6 text-center bg-white">
        <p className="text-[13px] text-[#8e8e93]">
          Yova © {new Date().getFullYear()} — Ne pense plus à tout ça.
        </p>
      </footer>
    </div>
  );
}
