/** Vias de administração canónicas (código → rótulo PT). */
export const MEDICATION_CATALOG_ROUTES = [
  { code: 'VO', label: 'Via oral (VO)' },
  { code: 'SL', label: 'Sublingual (SL)' },
  { code: 'IV', label: 'Intravenosa (IV)' },
  { code: 'IM', label: 'Intramuscular (IM)' },
  { code: 'SC', label: 'Subcutânea (SC)' },
  { code: 'TD', label: 'Transdérmica (TD)' },
  { code: 'INH', label: 'Inalatória (INH)' },
  { code: 'TOP', label: 'Tópica (TOP)' },
  { code: 'RECT', label: 'Retal (RECT)' },
  { code: 'NASAL', label: 'Nasal' },
  { code: 'OFT', label: 'Oftálmica' },
] as const;

export type MedicationCatalogRouteCode =
  (typeof MEDICATION_CATALOG_ROUTES)[number]['code'];

export function isAllowedMedicationRoute(
  route: string,
  allowedRoutes: string[]
): boolean {
  const normalized = route.trim().toUpperCase();
  if (!normalized) {return true;}
  if (allowedRoutes.length === 0) {return true;}
  return allowedRoutes.some((r) => r.toUpperCase() === normalized);
}
