// =============================================================================
// Sprint 15bis — Ouverture check-in contextualisée (pick source + build prompt)
// =============================================================================
// Logique pure (testable) pour choisir quel signal Yova utilise pour ouvrir le
// check-in du soir et formater le contexte injecté dans le prompt Sonnet.
//
// Priorité validée avec Jonathan (sprint 15bis) :
//   1. upcoming_event < 3j (anniv enfant imminent)
//   2. observation_alert (severity='alert', non acknowledged)
//   3. upcoming_event 3-7j
//   4. recent_mention < 48h (dernier user turn saillant)
//   5. narrative (portrait foyer général)
//   6. fallback neutre (aucun signal, mémoire vide → pas d'appel Sonnet)
//
// Règle de rotation (anti-harcèlement 2 soirs de suite) :
//   si le top pick a la même `source_detail` que le dernier opener loggé dans
//   les dernières 30h → on descend d'un cran. Yova ne ressasse pas.
// =============================================================================

export type OpenerSource =
  | 'upcoming_event_urgent'  // < 3j
  | 'observation_alert'
  | 'upcoming_event_near'    // 3-7j
  | 'recent_mention'
  | 'narrative'
  | 'fallback';

export type OpenerCandidate = {
  source: OpenerSource;
  source_detail: string | null;
  /** Directive humaine injectée dans le prompt Sonnet pour cadrer la question. */
  directive: string;
};

// ── Types d'entrée (sous-ensemble des données DB nécessaires) ─────────────────

export type MemberForOpener = {
  display_name: string;
  member_type?: string | null;
  birth_date?: string | null;
};

export type ObservationForOpener = {
  type: string;
  severity: 'info' | 'notice' | 'alert';
  payload?: Record<string, unknown> | null;
  detected_at: string;
};

export type FactForOpener = {
  content: string;
  fact_type?: string | null;
};

export type TurnForOpener = {
  speaker: 'user' | 'agent';
  content: string;
  created_at: string;
};

export type OpenerContext = {
  members: MemberForOpener[];
  observations: ObservationForOpener[];
  narrative: string | null;
  facts: FactForOpener[];
  recentTurns: TurnForOpener[]; // triés desc, ~10 derniers
  lastOpenerSourceDetail: string | null; // pour rotation
};

// ── Helpers date ─────────────────────────────────────────────────────────────

/**
 * Nb de jours avant le prochain anniversaire. Retourne null si birth_date manquant.
 * Ignore l'année (on veut le jour/mois prochain — un enfant de 7 ans a toujours
 * un anniv dans l'année courante ou l'année suivante).
 */
export function daysUntilNextBirthday(birthDate: string, now: Date): number | null {
  const b = new Date(birthDate);
  if (Number.isNaN(b.getTime())) return null;
  const month = b.getUTCMonth();
  const day = b.getUTCDate();
  const year = now.getUTCFullYear();
  let next = new Date(Date.UTC(year, month, day));
  if (next.getTime() < startOfDayUtc(now).getTime()) {
    next = new Date(Date.UTC(year + 1, month, day));
  }
  const diffMs = next.getTime() - startOfDayUtc(now).getTime();
  return Math.round(diffMs / 86400000);
}

function startOfDayUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function hoursSince(iso: string, now: Date): number {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return Infinity;
  return (now.getTime() - t) / 3_600_000;
}

// ── Picker principal ─────────────────────────────────────────────────────────

/**
 * Retourne la liste ordonnée des candidats (du plus prioritaire au fallback).
 * Le caller prend le premier compatible avec la rotation.
 */
export function buildOpenerCandidates(ctx: OpenerContext, now: Date): OpenerCandidate[] {
  const out: OpenerCandidate[] = [];

  // 1. Événements imminents < 3j (anniv enfants/ados)
  // 2. (observation_alert — traité ensuite)
  // 3. Événements 3-7j
  const birthdayCandidates: Array<{ name: string; days: number }> = [];
  for (const m of ctx.members) {
    if (!m.birth_date) continue;
    const d = daysUntilNextBirthday(m.birth_date, now);
    if (d === null) continue;
    if (d >= 0 && d <= 7) birthdayCandidates.push({ name: m.display_name, days: d });
  }
  birthdayCandidates.sort((a, b) => a.days - b.days);

  // Bucket 1 : < 3j
  for (const bc of birthdayCandidates.filter((c) => c.days < 3)) {
    out.push({
      source: 'upcoming_event_urgent',
      source_detail: `birthday:${bc.name}:${bc.days}d`,
      directive: bc.days === 0
        ? `L'anniversaire de ${bc.name} est aujourd'hui. Ouvre avec une question sur ce jour spécial (préparatifs faits, ambiance, ce qu'il/elle a vécu).`
        : `L'anniversaire de ${bc.name} est dans ${bc.days} jour${bc.days > 1 ? 's' : ''}. Ouvre en demandant si les préparatifs avancent ou si elle/il a besoin d'aide.`,
    });
  }

  // Bucket 2 : observations alert non ack, les plus récentes d'abord
  const alerts = ctx.observations
    .filter((o) => o.severity === 'alert')
    .slice()
    .sort((a, b) => new Date(b.detected_at).getTime() - new Date(a.detected_at).getTime());
  for (const alert of alerts.slice(0, 3)) {
    out.push({
      source: 'observation_alert',
      source_detail: `obs:${alert.type}`,
      directive: directiveForObservation(alert),
    });
  }

  // Bucket 3 : événements 3-7j
  for (const bc of birthdayCandidates.filter((c) => c.days >= 3 && c.days <= 7)) {
    out.push({
      source: 'upcoming_event_near',
      source_detail: `birthday:${bc.name}:${bc.days}d`,
      directive: `L'anniversaire de ${bc.name} est dans ${bc.days} jours. Évoque-le doucement pour voir si elle/il a commencé à y penser.`,
    });
  }

  // Bucket 4 : recent_mention < 48h (dernier user turn non trivial)
  const recentUserTurn = ctx.recentTurns.find(
    (t) => t.speaker === 'user' && hoursSince(t.created_at, now) < 48 && t.content.trim().length > 15,
  );
  if (recentUserTurn) {
    const excerpt = recentUserTurn.content.slice(0, 200).replace(/\s+/g, ' ').trim();
    out.push({
      source: 'recent_mention',
      source_detail: `turn:${recentUserTurn.created_at}`,
      directive: `La dernière fois (il y a ${Math.round(hoursSince(recentUserTurn.created_at, now))}h), l'user a dit : « ${excerpt} ». Reprends un élément précis et demande simplement où ça en est — sans relancer le fil complet.`,
    });
  }

  // Bucket 5 : narrative générale
  if (ctx.narrative && ctx.narrative.trim().length > 20) {
    out.push({
      source: 'narrative',
      source_detail: 'narrative',
      directive: `Appuie-toi sur le portrait du foyer (ci-dessous) pour ouvrir avec une question chaleureuse et naturelle, pas générique.`,
    });
  }

  // Bucket 6 : fallback
  out.push({
    source: 'fallback',
    source_detail: null,
    directive: `Pas d'info saillante. Ouvre avec une question large et douce sur la journée.`,
  });

  return out;
}

/**
 * Applique la rotation anti-harcèlement : si le premier candidat a la même
 * source_detail que le dernier opener, on descend d'un cran. Jamais deux.
 */
export function pickOpenerWithRotation(
  candidates: OpenerCandidate[],
  lastOpenerSourceDetail: string | null,
): OpenerCandidate {
  if (candidates.length === 0) {
    return { source: 'fallback', source_detail: null, directive: '' };
  }
  if (!lastOpenerSourceDetail) return candidates[0];
  if (candidates[0].source_detail !== lastOpenerSourceDetail) return candidates[0];
  // Même signal que la veille → descendre. Retombe au fallback si rien d'autre.
  return candidates[1] ?? candidates[candidates.length - 1];
}

// ── Directives par type d'observation (ton confident, jamais coach) ──────────

function directiveForObservation(obs: ObservationForOpener): string {
  const payload = obs.payload ?? {};
  switch (obs.type) {
    case 'cooking_drift': {
      const days = typeof payload.days_without === 'number' ? payload.days_without : null;
      return days
        ? `Ça fait ${days} jours que personne n'a cuisiné au foyer. Ouvre en demandant ce qui pèse le plus dans la cuisine en ce moment — sans juger, juste pour comprendre.`
        : `Cuisine en berne au foyer. Demande ce qui pèse dans les repas ces temps-ci.`;
    }
    case 'sleep_deficit': {
      const name = typeof payload.member_name === 'string' ? payload.member_name : null;
      return name
        ? `${name} dort mal depuis plusieurs nuits. Ouvre avec une question bienveillante sur comment elle/il tient — sans médicaliser.`
        : `Déficit de sommeil détecté. Ouvre sur comment le foyer tient.`;
    }
    case 'event_unprepared':
      return `Un événement approche sans préparatifs visibles. Ouvre en demandant doucement si l'user veut qu'on pose ensemble les premières étapes.`;
    case 'balance_drift':
      return `Déséquilibre de charge détecté entre adultes. Ouvre SANS nommer de coupable — juste "comment vous vous répartissez en ce moment ?".`;
    case 'journal_silence':
      return `L'user n'a pas parlé à Yova depuis un moment. Ouvre en disant simplement "ça fait un moment" sans reproche.`;
    case 'task_overdue_cluster':
      return `Plusieurs tâches en retard cumulées. Ouvre en demandant ce qui bloque — sans lister, une question large.`;
    default:
      return `Observation détectée (${obs.type}). Ouvre avec une question douce liée.`;
  }
}

// ── Détection "mémoire vide" (court-circuit Sonnet, validé Jonathan) ─────────

/**
 * True si aucune donnée personnalisable n'est dispo → on ne paie pas un appel
 * Sonnet pour un fallback générique. Le caller affiche un accueil statique
 * "on apprend à se connaître" dédié.
 */
export function isMemoryEmpty(ctx: OpenerContext): boolean {
  const hasMemberWithBirthday = ctx.members.some((m) => !!m.birth_date);
  const hasObs = ctx.observations.length > 0;
  const hasNarrative = !!ctx.narrative && ctx.narrative.trim().length > 20;
  const hasFacts = ctx.facts.length > 0;
  const hasTurns = ctx.recentTurns.length > 0;
  return !hasMemberWithBirthday && !hasObs && !hasNarrative && !hasFacts && !hasTurns;
}

// ── Construction du bloc contexte injecté dans le prompt Sonnet ──────────────

export function buildContextBlock(ctx: OpenerContext, now: Date): string {
  const lines: string[] = [];

  const membersWithAge = ctx.members
    .map((m) => {
      if (!m.birth_date) return `- ${m.display_name}`;
      const d = daysUntilNextBirthday(m.birth_date, now);
      const bdayInfo = d !== null && d <= 30 ? ` · anniv dans ${d}j` : '';
      return `- ${m.display_name}${bdayInfo}`;
    })
    .join('\n');
  if (membersWithAge) lines.push(`Membres :\n${membersWithAge}`);

  if (ctx.narrative && ctx.narrative.trim()) {
    lines.push(`Portrait foyer :\n${ctx.narrative.trim()}`);
  }

  const facts = ctx.facts.slice(0, 8);
  if (facts.length) {
    lines.push(`Faits récents :\n${facts.map((f) => `- ${f.content}`).join('\n')}`);
  }

  const alerts = ctx.observations.filter((o) => o.severity === 'alert').slice(0, 3);
  if (alerts.length) {
    lines.push(`Observations actives :\n${alerts.map((o) => `- ${o.type} (${o.severity})`).join('\n')}`);
  }

  const userTurns = ctx.recentTurns
    .filter((t) => t.speaker === 'user' && hoursSince(t.created_at, now) < 72)
    .slice(0, 3);
  if (userTurns.length) {
    lines.push(
      `Derniers échanges (user) :\n${userTurns
        .map((t) => `- il y a ${Math.round(hoursSince(t.created_at, now))}h : « ${t.content.slice(0, 200).replace(/\s+/g, ' ').trim()} »`)
        .join('\n')}`,
    );
  }

  return lines.join('\n\n') || '(mémoire limitée)';
}
