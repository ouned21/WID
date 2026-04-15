import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Politique de confidentialité — Aura',
};

export default function PrivacyPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <Link href="/" className="text-[15px] font-medium mb-6 inline-block" style={{ color: '#007aff' }}>← Retour</Link>

      <h1 className="text-[32px] font-bold text-[#1c1c1e] mb-2">Politique de confidentialité</h1>
      <p className="text-[13px] text-[#8e8e93] mb-8">Dernière mise à jour : 15 avril 2026</p>

      <div className="space-y-6 text-[15px] text-[#3c3c43] leading-relaxed">
        <section>
          <h2 className="text-[20px] font-bold text-[#1c1c1e] mb-2">1. Qui sommes-nous</h2>
          <p>Aura est une application web de gestion intelligente du foyer. Nous respectons ta vie privée et sommes engagés à protéger tes données personnelles conformément au RGPD (Règlement Général sur la Protection des Données).</p>
        </section>

        <section>
          <h2 className="text-[20px] font-bold text-[#1c1c1e] mb-2">2. Quelles données collectons-nous</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Données d&apos;identification</strong> : email, prénom, mot de passe (chiffré)</li>
            <li><strong>Données du foyer</strong> : nom du foyer, équipements sélectionnés, composition familiale (prénoms, âges, animaux)</li>
            <li><strong>Données d&apos;usage</strong> : tâches créées, complétions, historique d&apos;utilisation</li>
            <li><strong>Données techniques</strong> : cookies de session (pour te garder connecté)</li>
          </ul>
          <p className="mt-3">Nous ne collectons <strong>ni ta géolocalisation</strong>, <strong>ni tes contacts</strong>, <strong>ni tes photos</strong> sans ton consentement explicite.</p>
        </section>

        <section>
          <h2 className="text-[20px] font-bold text-[#1c1c1e] mb-2">3. Traitement par IA</h2>
          <p>Aura utilise l&apos;intelligence artificielle (Claude API d&apos;Anthropic) pour générer tes tâches et t&apos;aider à gérer ton foyer. Les données envoyées à Claude API sont :</p>
          <ul className="list-disc pl-6 space-y-2 mt-2">
            <li>Le nom et type de tes tâches (ex : « Préparer le dîner »)</li>
            <li>Les équipements de ton foyer (ex : « four, lave-vaisselle »)</li>
            <li>L&apos;âge de tes enfants (pas leur prénom)</li>
          </ul>
          <p className="mt-3">Anthropic ne stocke <strong>pas</strong> tes données pour entraîner ses modèles (politique zéro-rétention API).</p>
        </section>

        <section>
          <h2 className="text-[20px] font-bold text-[#1c1c1e] mb-2">4. Tes droits</h2>
          <p>Conformément au RGPD, tu as le droit de :</p>
          <ul className="list-disc pl-6 space-y-2 mt-2">
            <li><strong>Accéder</strong> à toutes tes données (via ton profil)</li>
            <li><strong>Rectifier</strong> tes informations à tout moment</li>
            <li><strong>Supprimer</strong> ton compte et toutes tes données (bouton dans le profil)</li>
            <li><strong>Exporter</strong> tes données sur demande</li>
            <li><strong>T&apos;opposer</strong> à certains traitements</li>
          </ul>
          <p className="mt-3">Pour toute demande : <a href="mailto:privacy@aura.app" style={{ color: '#007aff' }}>privacy@aura.app</a></p>
        </section>

        <section>
          <h2 className="text-[20px] font-bold text-[#1c1c1e] mb-2">5. Stockage et sécurité</h2>
          <p>Tes données sont stockées sur Supabase (infrastructure AWS Europe — Francfort, Allemagne). Les mots de passe sont chiffrés avec bcrypt. Les connexions sont sécurisées en HTTPS.</p>
        </section>

        <section>
          <h2 className="text-[20px] font-bold text-[#1c1c1e] mb-2">6. Cookies</h2>
          <p>Nous utilisons uniquement des cookies techniques nécessaires au fonctionnement de l&apos;application (session utilisateur). Pas de cookies publicitaires, pas de tracking tiers.</p>
        </section>

        <section>
          <h2 className="text-[20px] font-bold text-[#1c1c1e] mb-2">7. Enfants</h2>
          <p>Aura n&apos;est pas destiné aux enfants de moins de 15 ans. Les informations concernant les enfants (âge, prénom) saisies par les parents sont traitées sous leur responsabilité. Aucune donnée sensible d&apos;enfant n&apos;est partagée avec des tiers.</p>
        </section>

        <section>
          <h2 className="text-[20px] font-bold text-[#1c1c1e] mb-2">8. Modifications</h2>
          <p>Nous te notifierons par email en cas de modification substantielle de cette politique. La version en vigueur est toujours accessible sur cette page.</p>
        </section>

        <section>
          <h2 className="text-[20px] font-bold text-[#1c1c1e] mb-2">9. Contact</h2>
          <p>Pour toute question : <a href="mailto:privacy@aura.app" style={{ color: '#007aff' }}>privacy@aura.app</a></p>
        </section>
      </div>
    </div>
  );
}
