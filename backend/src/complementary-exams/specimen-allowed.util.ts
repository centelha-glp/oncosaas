import { ComplementaryExamType } from '@generated/prisma/client';

/** Alinhado ao frontend `SPECIMEN_OPTIONS` — validação server-side de espécime por tipo. */
const BY_TYPE: Record<ComplementaryExamType, readonly string[]> = {
  LABORATORY: [
    'Sangue venoso',
    'Sangue arterial',
    'Urina simples',
    'Urina de 24 horas',
    'Líquor (LCR)',
    'Líquido pleural',
    'Líquido ascítico',
    'Escarro',
    'Swab nasofaríngeo',
    'Fezes',
    'Medula óssea',
  ],
  ANATOMOPATHOLOGICAL: [
    'Tecido (biópsia)',
    'Peça cirúrgica',
    'Agulha fina (PAAF)',
    'Líquido pleural',
    'Líquido ascítico',
    'Medula óssea',
    'Escarro',
  ],
  IMMUNOHISTOCHEMICAL: [
    'Tecido (biópsia)',
    'Peça cirúrgica',
    'Bloco de parafina',
    'Células (citologia)',
  ],
  IMAGING: [],
};

export function isSpecimenAllowedForType(
  type: ComplementaryExamType,
  specimen: string | undefined | null,
): boolean {
  if (specimen == null || specimen.trim() === '') {
    return true;
  }
  const allowed = BY_TYPE[type];
  if (!allowed.length) {
    return specimen.trim() === '';
  }
  return allowed.includes(specimen.trim());
}
