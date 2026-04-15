/**
 * Inférence de métadonnées de tâche à partir du nom (mots-clés français).
 *
 * Remplace les défauts bêtes (weekly / medium / light) par des valeurs
 * pertinentes basées sur le vocabulaire du quotidien. Pas d'appel IA,
 * 100% local et instantané.
 */

import type { Frequency } from '@/types/database';
import type {
  TaskCategory as ScoringCategory,
  DurationEstimate,
  PhysicalEffort,
} from '@/utils/taskScoring';

export type InferredMetadata = {
  category: ScoringCategory;
  frequency: Frequency;
  duration: DurationEstimate;
  physical: PhysicalEffort;
  confidence: 'high' | 'medium' | 'low'; // high = mot-clé fort, low = tous les défauts
};

// Règles de matching : chaque règle a des mots-clés et des valeurs par défaut
type InferenceRule = {
  keywords: string[];
  category?: ScoringCategory;
  frequency?: Frequency;
  duration?: DurationEstimate;
  physical?: PhysicalEffort;
};

const RULES: InferenceRule[] = [
  // ─── REPAS (quotidien par défaut) ──────────────────────────────────────────
  {
    keywords: ['manger', 'repas', 'dîner', 'diner', 'déjeuner', 'dejeuner', 'petit-dej', 'petit-déjeuner', 'petit dejeuner', 'cuisiner', 'préparer le', 'preparer le'],
    category: 'meals',
    frequency: 'daily',
    duration: 'medium',
    physical: 'light',
  },
  {
    keywords: ['débarrasser', 'debarrasser', 'vaisselle', 'rincer'],
    category: 'meals',
    frequency: 'daily',
    duration: 'short',
    physical: 'light',
  },
  {
    keywords: ['lunch box', 'gamelle', 'bento'],
    category: 'meals',
    frequency: 'daily',
    duration: 'short',
    physical: 'light',
  },
  {
    keywords: ['batch cook', 'cuisiner en batch', 'meal prep'],
    category: 'meals',
    frequency: 'weekly',
    duration: 'very_long',
    physical: 'medium',
  },

  // ─── ENFANTS ───────────────────────────────────────────────────────────────
  {
    keywords: ['école', 'ecole', 'crèche', 'creche', 'nounou', 'amener', 'récupérer les enfants', 'recuperer les enfants'],
    category: 'children',
    frequency: 'daily',
    duration: 'short',
    physical: 'light',
  },
  {
    keywords: ['bain', 'doucher les enfants', 'bébé', 'bebe'],
    category: 'children',
    frequency: 'daily',
    duration: 'short',
    physical: 'medium',
  },
  {
    keywords: ['devoirs', 'leçons', 'lecons'],
    category: 'children',
    frequency: 'daily',
    duration: 'medium',
    physical: 'none',
  },
  {
    keywords: ['cartable', 'goûter', 'gouter', 'coucher les enfants', 'histoire', 'habiller'],
    category: 'children',
    frequency: 'daily',
    duration: 'very_short',
    physical: 'none',
  },
  {
    keywords: ['pédiatre', 'pediatre', 'rdv pédiatre'],
    category: 'children',
    frequency: 'quarterly',
    duration: 'long',
    physical: 'none',
  },

  // ─── LINGE (hebdo typique) ─────────────────────────────────────────────────
  {
    keywords: ['linge', 'lessive', 'machine à laver', 'machine a laver', 'étendre', 'etendre', 'plier'],
    category: 'laundry',
    frequency: 'weekly',
    duration: 'medium',
    physical: 'light',
  },
  {
    keywords: ['repasser', 'repassage', 'fer à repasser'],
    category: 'laundry',
    frequency: 'weekly',
    duration: 'long',
    physical: 'medium',
  },

  // ─── MÉNAGE / NETTOYAGE ────────────────────────────────────────────────────
  {
    keywords: ['aspirateur', 'passer l\'aspi', 'passer laspi'],
    category: 'cleaning',
    frequency: 'weekly',
    duration: 'medium',
    physical: 'medium',
  },
  {
    keywords: ['serpillère', 'serpillere', 'laver les sols', 'laver le sol'],
    category: 'cleaning',
    frequency: 'weekly',
    duration: 'medium',
    physical: 'medium',
  },
  {
    keywords: ['nettoyer la salle de bain', 'salle de bain', 'douche', 'toilettes', 'wc', 'lavabo', 'miroir'],
    category: 'cleaning',
    frequency: 'weekly',
    duration: 'medium',
    physical: 'medium',
  },
  {
    keywords: ['nettoyer le frigo', 'décrasser le four', 'decrasser le four', 'four', 'hotte', 'plaques de cuisson'],
    category: 'cleaning',
    frequency: 'monthly',
    duration: 'long',
    physical: 'medium',
  },
  {
    keywords: ['grand ménage', 'grand menage', 'ménage complet', 'menage complet'],
    category: 'cleaning',
    frequency: 'monthly',
    duration: 'very_long',
    physical: 'high',
  },
  {
    keywords: ['dépoussiérer', 'depoussierer', 'poussière', 'poussiere'],
    category: 'cleaning',
    frequency: 'weekly',
    duration: 'short',
    physical: 'light',
  },
  {
    keywords: ['poubelles', 'sortir les poubelles', 'vider la poubelle'],
    category: 'cleaning',
    frequency: 'weekly',
    duration: 'very_short',
    physical: 'light',
  },

  // ─── RANGEMENT ─────────────────────────────────────────────────────────────
  {
    keywords: ['ranger', 'rangement', 'trier', 'organiser'],
    category: 'tidying',
    frequency: 'weekly',
    duration: 'medium',
    physical: 'light',
  },
  {
    keywords: ['faire le lit', 'faire les lits'],
    category: 'tidying',
    frequency: 'daily',
    duration: 'very_short',
    physical: 'light',
  },

  // ─── COURSES ───────────────────────────────────────────────────────────────
  {
    keywords: ['courses', 'supermarché', 'supermarche', 'carrefour', 'leclerc', 'intermarché', 'intermarche', 'faire les courses'],
    category: 'shopping',
    frequency: 'weekly',
    duration: 'long',
    physical: 'medium',
  },
  {
    keywords: ['drive', 'commander en ligne', 'amazon'],
    category: 'shopping',
    frequency: 'weekly',
    duration: 'short',
    physical: 'none',
  },
  {
    keywords: ['pharmacie', 'médicaments', 'medicaments'],
    category: 'shopping',
    frequency: 'monthly',
    duration: 'short',
    physical: 'light',
  },

  // ─── ADMIN ─────────────────────────────────────────────────────────────────
  {
    keywords: ['factures', 'facture', 'payer les factures', 'paiement'],
    category: 'admin',
    frequency: 'monthly',
    duration: 'short',
    physical: 'none',
  },
  {
    keywords: ['impôts', 'impots', 'déclaration', 'declaration'],
    category: 'admin',
    frequency: 'yearly',
    duration: 'very_long',
    physical: 'none',
  },
  {
    keywords: ['assurance', 'mutuelle'],
    category: 'admin',
    frequency: 'yearly',
    duration: 'medium',
    physical: 'none',
  },
  {
    keywords: ['rendez-vous', 'rdv', 'médecin', 'medecin', 'dentiste'],
    category: 'admin',
    frequency: 'quarterly',
    duration: 'short',
    physical: 'none',
  },
  {
    keywords: ['papiers', 'courrier', 'classer'],
    category: 'admin',
    frequency: 'weekly',
    duration: 'short',
    physical: 'none',
  },
  {
    keywords: ['budget', 'comptes', 'banque'],
    category: 'admin',
    frequency: 'monthly',
    duration: 'medium',
    physical: 'none',
  },

  // ─── ANIMAUX ───────────────────────────────────────────────────────────────
  {
    keywords: ['chien', 'promener', 'balade', 'promenade'],
    category: 'pets',
    frequency: 'daily',
    duration: 'short',
    physical: 'light',
  },
  {
    keywords: ['litière', 'litiere', 'chat'],
    category: 'pets',
    frequency: 'daily',
    duration: 'very_short',
    physical: 'light',
  },
  {
    keywords: ['nourrir', 'croquettes', 'gamelle'],
    category: 'pets',
    frequency: 'daily',
    duration: 'very_short',
    physical: 'none',
  },
  {
    keywords: ['vétérinaire', 'veterinaire', 'véto', 'veto'],
    category: 'pets',
    frequency: 'yearly',
    duration: 'long',
    physical: 'light',
  },

  // ─── EXTÉRIEUR / JARDIN ────────────────────────────────────────────────────
  {
    keywords: ['tondre', 'pelouse', 'tondeuse'],
    category: 'outdoor',
    frequency: 'biweekly',
    duration: 'long',
    physical: 'high',
  },
  {
    keywords: ['arroser', 'plantes', 'jardin'],
    category: 'outdoor',
    frequency: 'weekly',
    duration: 'short',
    physical: 'light',
  },
  {
    keywords: ['tailler', 'haie', 'haies'],
    category: 'outdoor',
    frequency: 'quarterly',
    duration: 'very_long',
    physical: 'high',
  },
  {
    keywords: ['terrasse', 'balcon'],
    category: 'outdoor',
    frequency: 'monthly',
    duration: 'medium',
    physical: 'medium',
  },

  // ─── VOITURE ───────────────────────────────────────────────────────────────
  {
    keywords: ['laver la voiture', 'voiture', 'plein', 'essence'],
    category: 'vehicle',
    frequency: 'monthly',
    duration: 'medium',
    physical: 'light',
  },
  {
    keywords: ['vidange', 'contrôle technique', 'controle technique'],
    category: 'vehicle',
    frequency: 'yearly',
    duration: 'very_long',
    physical: 'none',
  },
  {
    keywords: ['pneus', 'pression'],
    category: 'vehicle',
    frequency: 'quarterly',
    duration: 'short',
    physical: 'light',
  },

  // ─── HYGIÈNE ───────────────────────────────────────────────────────────────
  {
    keywords: ['coiffeur', 'barbier'],
    category: 'hygiene',
    frequency: 'monthly',
    duration: 'long',
    physical: 'none',
  },
];

/**
 * Infère les métadonnées d'une tâche à partir de son nom.
 * Retourne des valeurs par défaut raisonnables si aucun mot-clé ne matche.
 */
export function inferTaskMetadata(name: string): InferredMetadata {
  const lower = name.toLowerCase().trim();
  if (lower.length < 2) {
    return { category: 'misc', frequency: 'weekly', duration: 'medium', physical: 'light', confidence: 'low' };
  }

  // Cherche la règle avec le plus de mots-clés matchés (spécificité)
  let bestRule: InferenceRule | null = null;
  let bestMatches = 0;

  for (const rule of RULES) {
    let matches = 0;
    for (const kw of rule.keywords) {
      if (lower.includes(kw)) matches++;
    }
    if (matches > bestMatches) {
      bestMatches = matches;
      bestRule = rule;
    }
  }

  if (bestRule && bestMatches > 0) {
    return {
      category: bestRule.category ?? 'misc',
      frequency: bestRule.frequency ?? 'weekly',
      duration: bestRule.duration ?? 'medium',
      physical: bestRule.physical ?? 'light',
      confidence: bestMatches >= 2 ? 'high' : 'medium',
    };
  }

  // Aucun match : défauts raisonnables
  return {
    category: 'misc',
    frequency: 'weekly',
    duration: 'medium',
    physical: 'light',
    confidence: 'low',
  };
}
