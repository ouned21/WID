import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Politique de confidentialité — Yova',
  description: 'Comment Yova collecte, utilise et protège vos données personnelles.',
};

export default function PrivacyPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <Link href="/" className="text-[15px] font-medium mb-6 inline-block" style={{ color: '#007aff' }}>
        ← Retour
      </Link>

      <h1 className="text-[32px] font-bold text-[#1c1c1e] mb-2">Politique de confidentialité</h1>
      <p className="text-[13px] text-[#8e8e93] mb-8">Dernière mise à jour : 16 avril 2026</p>

      <div className="space-y-8 text-[15px] text-[#3c3c43] leading-relaxed">

        {/* 1. Responsable de traitement */}
        <section>
          <h2 className="text-[20px] font-bold text-[#1c1c1e] mb-3">1. Responsable du traitement</h2>
          <div className="rounded-xl p-4" style={{ background: '#f2f2f7' }}>
            <p><strong>Jonathan (fondateur d&apos;Yova)</strong></p>
            <p className="mt-1">Application : Yova (anciennement Yova / WID)</p>
            <p className="mt-1">Contact RGPD : <a href="mailto:privacy@yova.app" style={{ color: '#007aff' }}>privacy@yova.app</a></p>
          </div>
          <p className="mt-3 text-[13px] text-[#8e8e93]">
            Yova est une application de suivi et d&apos;équilibrage des tâches ménagères pour couples et familles,
            opérée à titre personnel par son fondateur. Aucune société n&apos;est constituée à ce jour.
          </p>
        </section>

        {/* 2. Données collectées */}
        <section>
          <h2 className="text-[20px] font-bold text-[#1c1c1e] mb-3">2. Données collectées</h2>
          <p className="mb-3">Voici l&apos;ensemble des données que nous traitons :</p>

          <div className="space-y-3">
            <div className="rounded-xl p-4" style={{ background: '#f2f2f7' }}>
              <p className="font-semibold text-[#1c1c1e] mb-1">Données d&apos;identification et de compte</p>
              <p className="text-[13px] text-[#8e8e93]">Adresse email, mot de passe (chiffré bcrypt, jamais lisible), identifiant unique (UUID), date d&apos;inscription, statut premium.</p>
            </div>

            <div className="rounded-xl p-4" style={{ background: '#f2f2f7' }}>
              <p className="font-semibold text-[#1c1c1e] mb-1">Données du profil et du foyer</p>
              <p className="text-[13px] text-[#8e8e93]">Prénom d&apos;affichage, nom du foyer, composition du foyer (prénoms des membres et membres fantômes), objectif de répartition des tâches, mode vacances.</p>
            </div>

            <div className="rounded-xl p-4" style={{ background: '#f2f2f7' }}>
              <p className="font-semibold text-[#1c1c1e] mb-1">Données de tâches et d&apos;activité</p>
              <p className="text-[13px] text-[#8e8e93]">Tâches ménagères créées (nom, catégorie, fréquence, durée estimée, effort physique, score mental), assignation des tâches, complétions (qui, quand, durée réelle, note), historique d&apos;activité.</p>
            </div>

            <div className="rounded-xl p-4" style={{ background: '#fff3cd' }}>
              <p className="font-semibold text-[#1c1c1e] mb-1">Journaux conversationnels (traitement IA)</p>
              <p className="text-[13px]" style={{ color: '#856404' }}>Texte libre décrivant votre journée (ex : &quot;j&apos;ai fait la vaisselle ce soir&quot;), tonalité émotionnelle détectée (humeur : satisfait, fatigué, etc.), résultat du parsing IA. <strong>Ces données sont envoyées à Anthropic (API Claude) pour traitement.</strong> Voir section 5.</p>
            </div>

            <div className="rounded-xl p-4" style={{ background: '#f2f2f7' }}>
              <p className="font-semibold text-[#1c1c1e] mb-1">Préférences personnelles</p>
              <p className="text-[13px] text-[#8e8e93]">Tâches aimées ou détestées, créneaux horaires préférés, jours d&apos;indisponibilité, niveau de charge souhaité, message libre adressé à l&apos;IA.</p>
            </div>

            <div className="rounded-xl p-4" style={{ background: '#f2f2f7' }}>
              <p className="font-semibold text-[#1c1c1e] mb-1">Patterns comportementaux (inférés)</p>
              <p className="text-[13px] text-[#8e8e93]">Heure préférée de complétion, cadence moyenne de tâches, affinités par catégorie, mémoire résumée de vos habitudes (texte généré par IA, stocké côté serveur).</p>
            </div>

            <div className="rounded-xl p-4" style={{ background: '#f2f2f7' }}>
              <p className="font-semibold text-[#1c1c1e] mb-1">Logs techniques et d&apos;usage</p>
              <p className="text-[13px] text-[#8e8e93]">Logs d&apos;appels à l&apos;IA (nombre de tokens, coût, modèle utilisé, endpoint, statut), événements d&apos;utilisation des fonctionnalités (pour améliorer l&apos;app).</p>
            </div>
          </div>

          <p className="mt-4 text-[13px]">
            Nous ne collectons <strong>ni votre géolocalisation</strong>, <strong>ni vos contacts</strong>,
            <strong>ni vos photos</strong>, ni aucune donnée de santé.
          </p>
        </section>

        {/* 3. Base légale */}
        <section>
          <h2 className="text-[20px] font-bold text-[#1c1c1e] mb-3">3. Base légale des traitements</h2>
          <div className="space-y-2 text-[14px]">
            <div className="flex gap-3">
              <span className="shrink-0 font-semibold" style={{ color: '#007aff' }}>Contrat</span>
              <span>Compte, profil, foyer, tâches, complétions — nécessaires au fonctionnement du service (Art. 6.1.b RGPD)</span>
            </div>
            <div className="flex gap-3">
              <span className="shrink-0 font-semibold" style={{ color: '#ff9500' }}>Consentement</span>
              <span>Journaux conversationnels (IA), préférences personnelles transmises à l&apos;IA — vous pouvez ne pas utiliser ces fonctionnalités (Art. 6.1.a RGPD)</span>
            </div>
            <div className="flex gap-3">
              <span className="shrink-0 font-semibold" style={{ color: '#34c759' }}>Int. légitime</span>
              <span>Logs IA (sécurité, facturation, lutte contre les abus), patterns comportementaux (amélioration des suggestions), événements d&apos;usage (amélioration du produit) (Art. 6.1.f RGPD)</span>
            </div>
          </div>
        </section>

        {/* 4. Durées de conservation */}
        <section>
          <h2 className="text-[20px] font-bold text-[#1c1c1e] mb-3">4. Durées de conservation</h2>
          <div className="rounded-xl overflow-hidden" style={{ border: '0.5px solid #e5e5ea' }}>
            <table className="w-full text-[13px]">
              <thead>
                <tr style={{ background: '#f2f2f7' }}>
                  <th className="text-left px-4 py-2 font-semibold text-[#1c1c1e]">Données</th>
                  <th className="text-left px-4 py-2 font-semibold text-[#1c1c1e]">Durée</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Compte et profil', 'Durée de vie du compte, puis suppression immédiate sur demande'],
                  ['Tâches et complétions', "3 ans glissants après la dernière activité, ou à la fermeture du compte"],
                  ['Journaux conversationnels', '2 ans glissants (suppression automatique)'],
                  ['Préférences personnelles', 'Durée de vie du compte'],
                  ['Patterns comportementaux', '2 ans glissants'],
                  ['Logs IA (tokens/coût)', '1 an glissant (suppression automatique)'],
                  ["Événements d'usage", '1 an glissant (suppression automatique)'],
                  ['Échanges de tâches', '1 an glissant'],
                ].map(([label, duration], i) => (
                  <tr key={i} style={{ borderTop: '0.5px solid #e5e5ea' }}>
                    <td className="px-4 py-2 font-medium text-[#1c1c1e]">{label}</td>
                    <td className="px-4 py-2 text-[#8e8e93]">{duration}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[13px] text-[#8e8e93]">
            Des fonctions de suppression automatique sont programmées dans notre base de données (Supabase/PostgreSQL).
          </p>
        </section>

        {/* 5. Traitement IA — Anthropic */}
        <section>
          <h2 className="text-[20px] font-bold text-[#1c1c1e] mb-3">5. Traitement par intelligence artificielle</h2>
          <div className="rounded-xl p-4 mb-3" style={{ background: '#fff3cd' }}>
            <p className="font-semibold text-[#1c1c1e] mb-1">Ce que nous envoyons à Anthropic (Claude API)</p>
            <ul className="list-disc pl-5 space-y-1 text-[13px]" style={{ color: '#856404' }}>
              <li>Le contenu de votre journal (texte libre que vous avez saisi)</li>
              <li>La liste de vos tâches ménagères (noms, catégories)</li>
              <li>Les prénoms des membres de votre foyer (pour identifier qui a fait quoi)</li>
              <li>Vos préférences déclarées (tâches aimées/détestées, créneaux)</li>
            </ul>
          </div>
          <p className="mb-3">
            <strong>Anthropic</strong> est un sous-traitant américain. Les données sont transférées aux États-Unis
            dans le cadre de la politique &quot;zero data retention API&quot; d&apos;Anthropic : vos données ne sont
            <strong> pas utilisées pour entraîner les modèles d&apos;IA</strong> et ne sont pas conservées
            au-delà du temps de traitement de la requête.
          </p>
          <p className="text-[13px] text-[#8e8e93]">
            Ce transfert est encadré par les Clauses Contractuelles Types (CCT) de la Commission Européenne
            intégrées dans les conditions d&apos;utilisation d&apos;Anthropic (Art. 46 RGPD).
          </p>
          <p className="mt-2 text-[13px]">
            <strong>Vous pouvez ne pas utiliser la fonctionnalité journal</strong> — l&apos;application reste
            pleinement fonctionnelle sans elle.
          </p>
        </section>

        {/* 6. Sous-traitants */}
        <section>
          <h2 className="text-[20px] font-bold text-[#1c1c1e] mb-3">6. Sous-traitants</h2>
          <div className="space-y-3">
            <div className="rounded-xl p-4" style={{ background: '#f2f2f7' }}>
              <div className="flex items-center justify-between mb-1">
                <p className="font-semibold text-[#1c1c1e]">Supabase Inc.</p>
                <span className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ background: '#d4edda', color: '#155724' }}>Hébergement UE</span>
              </div>
              <p className="text-[13px] text-[#8e8e93]">Base de données et authentification. Hébergée sur AWS Frankfurt (Allemagne). Traite toutes vos données.</p>
            </div>
            <div className="rounded-xl p-4" style={{ background: '#f2f2f7' }}>
              <div className="flex items-center justify-between mb-1">
                <p className="font-semibold text-[#1c1c1e]">Anthropic PBC</p>
                <span className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ background: '#fff3cd', color: '#856404' }}>Transfert US (CCT)</span>
              </div>
              <p className="text-[13px] text-[#8e8e93]">Modèle d&apos;IA (Claude Haiku). Traite les journaux et préférences uniquement lors des appels IA. Zéro rétention des données.</p>
            </div>
            <div className="rounded-xl p-4" style={{ background: '#f2f2f7' }}>
              <div className="flex items-center justify-between mb-1">
                <p className="font-semibold text-[#1c1c1e]">Vercel Inc.</p>
                <span className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ background: '#fff3cd', color: '#856404' }}>Transfert US (CCT)</span>
              </div>
              <p className="text-[13px] text-[#8e8e93]">Hébergement de l&apos;application web (CDN mondial). Traite les logs applicatifs et les requêtes HTTP. DPA Vercel applicable.</p>
            </div>
          </div>
        </section>

        {/* 7. Vos droits */}
        <section>
          <h2 className="text-[20px] font-bold text-[#1c1c1e] mb-3">7. Vos droits</h2>
          <p className="mb-3">Conformément au RGPD (Articles 15 à 22), vous disposez des droits suivants :</p>
          <div className="space-y-2">
            {[
              { right: 'Droit d\'accès (Art. 15)', desc: 'Obtenir une copie de toutes vos données', how: 'Profil → "Télécharger mes données"' },
              { right: 'Droit de rectification (Art. 16)', desc: 'Modifier vos informations personnelles', how: 'Directement dans l\'application (profil, préférences)' },
              { right: 'Droit à l\'effacement (Art. 17)', desc: 'Supprimer votre compte et toutes vos données', how: 'Profil → "Supprimer mon compte et mes données"' },
              { right: 'Droit à la portabilité (Art. 20)', desc: 'Recevoir vos données dans un format structuré (JSON)', how: 'Profil → "Télécharger mes données"' },
              { right: 'Droit d\'opposition (Art. 21)', desc: 'Vous opposer aux traitements fondés sur l\'intérêt légitime', how: 'Par email à privacy@yova.app' },
              { right: 'Droit à la limitation (Art. 18)', desc: 'Limiter temporairement le traitement de vos données', how: 'Par email à privacy@yova.app' },
            ].map((item, i) => (
              <div key={i} className="rounded-xl p-4" style={{ background: '#f2f2f7' }}>
                <p className="font-semibold text-[#1c1c1e] text-[14px]">{item.right}</p>
                <p className="text-[13px] text-[#3c3c43] mt-0.5">{item.desc}</p>
                <p className="text-[12px] mt-1" style={{ color: '#007aff' }}>Comment : {item.how}</p>
              </div>
            ))}
          </div>
          <div className="rounded-xl p-4 mt-3" style={{ background: '#e8f5e9' }}>
            <p className="text-[13px]" style={{ color: '#1b5e20' }}>
              <strong>Délai de réponse :</strong> nous nous engageons à répondre à toute demande d&apos;exercice
              de droits dans un délai d&apos;un mois (Art. 12.3 RGPD), prorogeable à 3 mois pour les demandes
              complexes.
            </p>
          </div>
          <p className="mt-3 text-[13px]">
            Pour exercer vos droits par email : <a href="mailto:privacy@yova.app" style={{ color: '#007aff' }}>privacy@yova.app</a>
          </p>
          <p className="mt-2 text-[13px] text-[#8e8e93]">
            Vous avez également le droit d&apos;introduire une réclamation auprès de la{' '}
            <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer" style={{ color: '#007aff' }}>
              CNIL (Commission Nationale de l&apos;Informatique et des Libertés)
            </a>{' '}
            si vous estimez que vos droits ne sont pas respectés.
          </p>
        </section>

        {/* 8. Sécurité */}
        <section>
          <h2 className="text-[20px] font-bold text-[#1c1c1e] mb-3">8. Sécurité des données</h2>
          <ul className="list-disc pl-5 space-y-2 text-[14px]">
            <li>Mots de passe chiffrés avec <strong>bcrypt</strong> (jamais stockés en clair)</li>
            <li>Connexions sécurisées en <strong>HTTPS/TLS 1.3</strong></li>
            <li>Accès aux données contrôlé par des politiques de sécurité au niveau de la base de données (Row Level Security Supabase)</li>
            <li>Clés API serveur jamais exposées côté client</li>
            <li>Tokens de session avec durée de vie limitée</li>
          </ul>
          <p className="mt-3 text-[13px] text-[#8e8e93]">
            En cas de violation de données susceptible d&apos;engendrer un risque pour vos droits et libertés,
            nous nous engageons à notifier la CNIL dans les 72 heures (Art. 33 RGPD) et à vous en informer
            sans délai si le risque est élevé (Art. 34 RGPD).
          </p>
        </section>

        {/* 9. Cookies */}
        <section>
          <h2 className="text-[20px] font-bold text-[#1c1c1e] mb-3">9. Cookies et traceurs</h2>
          <div className="rounded-xl p-4" style={{ background: '#e8f5e9' }}>
            <p className="font-semibold" style={{ color: '#1b5e20' }}>Aucun cookie publicitaire ni cookie de tracking</p>
          </div>
          <p className="mt-3">
            Nous utilisons uniquement des <strong>cookies techniques strictement nécessaires</strong> au
            fonctionnement de l&apos;application :
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1 text-[14px]">
            <li><code className="text-[13px] px-1 rounded" style={{ background: '#f2f2f7' }}>sb-*</code> — cookies de session Supabase (authentification)</li>
          </ul>
          <p className="mt-2 text-[13px] text-[#8e8e93]">
            Ces cookies ne nécessitent pas votre consentement (Art. 82 de la loi Informatique et Libertés,
            directive ePrivacy). Pas de Google Analytics, pas de Mixpanel, pas de pixel publicitaire.
          </p>
        </section>

        {/* 10. Enfants */}
        <section>
          <h2 className="text-[20px] font-bold text-[#1c1c1e] mb-3">10. Protection des enfants</h2>
          <p>
            Yova est destiné aux adultes (18 ans et plus). Les informations concernant les enfants
            (prénom, présence dans le foyer) saisies par les parents adultes sont traitées sous
            leur responsabilité parentale. Nous ne collectons aucune donnée directement auprès des enfants.
          </p>
        </section>

        {/* 11. Modifications */}
        <section>
          <h2 className="text-[20px] font-bold text-[#1c1c1e] mb-3">11. Modifications de la politique</h2>
          <p>
            En cas de modification substantielle de cette politique, vous serez informé par email
            (si fourni) et/ou par une notification dans l&apos;application. La version en vigueur est
            toujours disponible sur cette page avec sa date de mise à jour.
          </p>
        </section>

        {/* 12. Contact */}
        <section>
          <h2 className="text-[20px] font-bold text-[#1c1c1e] mb-3">12. Contact</h2>
          <div className="rounded-xl p-4" style={{ background: '#f2f2f7' }}>
            <p className="font-semibold text-[#1c1c1e] mb-1">Responsable de traitement</p>
            <p className="text-[14px]">Jonathan — Yova</p>
            <p className="text-[14px] mt-1">
              Email RGPD : <a href="mailto:privacy@yova.app" style={{ color: '#007aff' }}>privacy@yova.app</a>
            </p>
          </div>
          <p className="mt-3 text-[13px] text-[#8e8e93]">
            Autorité de contrôle compétente :{' '}
            <a href="https://www.cnil.fr/fr/vous-souhaitez-contacter-la-cnil" target="_blank" rel="noopener noreferrer" style={{ color: '#007aff' }}>
              CNIL — Commission Nationale de l&apos;Informatique et des Libertés
            </a>
            {' '}(3 Place de Fontenoy, 75007 Paris)
          </p>
        </section>

      </div>

      {/* Footer */}
      <div className="mt-12 pt-6" style={{ borderTop: '0.5px solid #e5e5ea' }}>
        <div className="flex gap-4 justify-center text-[12px] text-[#8e8e93]">
          <Link href="/legal/cgu">CGU</Link>
          <span>·</span>
          <span style={{ color: '#1c1c1e', fontWeight: 600 }}>Confidentialité</span>
          <span>·</span>
          <a href="mailto:privacy@yova.app">Contact</a>
        </div>
        <p className="text-[11px] text-[#c7c7cc] text-center mt-2">Yova © {new Date().getFullYear()}</p>
      </div>
    </div>
  );
}
