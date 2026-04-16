/**
 * Générateur de codes d'invitation pour les foyers.
 * Alphabet sans caractères ambigus (pas de 0/O, 1/I/l).
 *
 * Sécurité : utilise crypto.getRandomValues() (CSPRNG) au lieu de
 * Math.random() (PRNG non cryptographique, prédictible).
 * ALPHABET.length = 32 = 2^5 → pas de modulo bias.
 */

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 32 chars
const CODE_LENGTH = 6;

export function generateInviteCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}
