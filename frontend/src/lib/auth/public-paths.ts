/** Rotas acessíveis sem sessão (alinhado ao middleware). */
export const PUBLIC_PATHNAMES = new Set([
  '/login',
  '/register',
  '/invite',
  '/',
  '/termos',
  '/privacidade',
  '/forgot-password',
]);

export function isResetPasswordPathname(pathname: string): boolean {
  return /^\/reset-password\/[^/]+$/.test(pathname);
}

/** Página pública de upload móvel por token (sem JWT). */
export function isExamIngestMobilePathname(pathname: string): boolean {
  return /^\/m\/exam-ingest\/[^/]+$/.test(pathname);
}

/** True para login, registo, landing, termos, recuperação de senha, etc. */
export function isPublicPathname(pathname: string | null): boolean {
  if (!pathname) return true;
  if (PUBLIC_PATHNAMES.has(pathname)) return true;
  if (isResetPasswordPathname(pathname)) return true;
  if (isExamIngestMobilePathname(pathname)) return true;
  return false;
}
