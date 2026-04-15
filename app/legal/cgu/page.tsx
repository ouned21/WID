import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Conditions Générales d\'Utilisation — Aura',
};

export default function CguPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <Link href="/" className="text-[15px] font-medium mb-6 inline-block" style={{ color: '#007aff' }}>← Retour</Link>

      <h1 className="text-[32px] font-bold text-[#1c1c1e] mb-2">Conditions Générales d&apos;Utilisation</h1>
      <p className="text-[13px] text-[#8e8e93] mb-8">Dernière mise à jour : 15 avril 2026</p>

      <div className="space-y-6 text-[15px] text-[#3c3c43] leading-relaxed">
        <section>
          <h2 className="text-[20px] font-bold text-[#1c1c1e] mb-2">1. Objet</h2>
          <p>Les présentes CGU définissent les conditions d&apos;utilisation de l&apos;application Aura, un service de gestion intelligente du foyer assistée par IA.</p>
        </section>

        <section>
          <h2 className="text-[20px] font-bold text-[#1c1c1e] mb-2">2. Acceptation</h2>
          <p>En créant un compte, tu acceptes intégralement les présentes CGU et la politique de confidentialité. Si tu n&apos;acceptes pas ces conditions, tu ne peux pas utiliser Aura.</p>
        </section>

        <section>
          <h2 className="text-[20px] font-bold text-[#1c1c1e] mb-2">3. Accès au service</h2>
          <p>Aura propose une version gratuite et une version Premium payante (29€/an). La version gratuite est limitée à 2 membres par foyer et 5 appels IA par mois après l&apos;onboarding initial.</p>
        </section>

        <section>
          <h2 className="text-[20px] font-bold text-[#1c1c1e] mb-2">4. Responsabilité</h2>
          <p>Aura s&apos;efforce de fournir un service fiable mais ne peut garantir une disponibilité à 100%. Les suggestions générées par IA sont indicatives. Tu restes seul responsable des décisions prises concernant ton foyer.</p>
        </section>

        <section>
          <h2 className="text-[20px] font-bold text-[#1c1c1e] mb-2">5. Propriété intellectuelle</h2>
          <p>Tu conserves tous les droits sur les données que tu saisis dans Aura. Aura (code, design, marque) reste notre propriété.</p>
        </section>

        <section>
          <h2 className="text-[20px] font-bold text-[#1c1c1e] mb-2">6. Résiliation</h2>
          <p>Tu peux supprimer ton compte à tout moment depuis ton profil. Toutes tes données seront définitivement effacées sous 30 jours.</p>
        </section>

        <section>
          <h2 className="text-[20px] font-bold text-[#1c1c1e] mb-2">7. Abonnement Premium</h2>
          <p>L&apos;abonnement Premium est annuel (29€/an), sans engagement. Tu peux résilier à tout moment. Aucun remboursement pour la période en cours, mais pas de reconduction automatique après résiliation.</p>
        </section>

        <section>
          <h2 className="text-[20px] font-bold text-[#1c1c1e] mb-2">8. Modifications</h2>
          <p>Nous pouvons mettre à jour les CGU. Les modifications importantes te seront notifiées par email.</p>
        </section>

        <section>
          <h2 className="text-[20px] font-bold text-[#1c1c1e] mb-2">9. Droit applicable</h2>
          <p>Les présentes CGU sont soumises au droit français. En cas de litige, les tribunaux français seront compétents.</p>
        </section>

        <section>
          <h2 className="text-[20px] font-bold text-[#1c1c1e] mb-2">10. Contact</h2>
          <p><a href="mailto:hello@aura.app" style={{ color: '#007aff' }}>hello@aura.app</a></p>
        </section>
      </div>
    </div>
  );
}
