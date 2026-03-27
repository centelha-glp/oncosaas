/**
 * Returns a safe in-app redirect destination.
 * Falls back to dashboard for missing or unsafe values.
 */
export function getSafeRedirectTarget(redirectParam: string | null): string {
  if (!redirectParam) {
    return '/dashboard';
  }

  // Allow only in-app absolute paths and block protocol-relative/open redirects.
  if (!redirectParam.startsWith('/') || redirectParam.startsWith('//')) {
    return '/dashboard';
  }

  return redirectParam;
}
