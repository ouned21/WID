/**
 * Verifie si une erreur Supabase est une violation d'unicite (code PostgreSQL 23505).
 */
export function isUniqueViolation(error: { code?: string } | null): boolean {
  return error?.code === '23505';
}

/**
 * Valide le format d'un code d'invitation (6 caracteres alphanumeriques majuscules).
 */
export function isValidInviteCode(code: string): boolean {
  return /^[A-Z2-9]{6}$/.test(code);
}
