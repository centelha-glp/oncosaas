const CONTINUOUS_DURATION = 'contínua';

export function isContinuousPrescriptionDuration(duration: string): boolean {
  return duration.trim().toLowerCase() === CONTINUOUS_DURATION;
}

export function getPrescriptionPosologyVerb(
  routeCode: string
): 'tomar' | 'inalar' | 'aplicar' {
  const code = routeCode.trim().toUpperCase();
  if (code === 'VO' || code === 'SL') return 'tomar';
  if (code === 'INH') return 'inalar';
  return 'aplicar';
}

export function buildPrescriptionPosology(args: {
  route: string;
  quantity: string;
  dosage: string;
  frequency: string;
  duration: string;
}): string {
  const verb = getPrescriptionPosologyVerb(args.route);
  const qty = args.quantity.trim();
  const dose = args.dosage.trim();
  const freq = args.frequency.trim();
  const core = `${verb} ${qty} ${dose} de ${freq}`.replace(/\s+/g, ' ').trim();

  if (isContinuousPrescriptionDuration(args.duration)) {
    return `${core}, uso contínuo`;
  }
  const dur = args.duration.trim();
  return `${core} por ${dur}`;
}

export { CONTINUOUS_DURATION };
