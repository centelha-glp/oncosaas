import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@generated/prisma/client';
import {
  getAllergyCatalogEntry,
  isValidAllergySubstanceKey,
} from '../clinical-catalogs/allergy-substance.catalog';

export interface StoredAllergyEntry {
  substanceKey: string;
  /** Preenchido quando substanceKey === OTHER */
  customLabel?: string;
  reactionNotes?: string;
}

/**
 * Valida e normaliza allergyEntries para persistência (chaves do catálogo).
 */
export function normalizeAllergyEntriesForStorage(
  raw: unknown
): Prisma.InputJsonValue | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (!Array.isArray(raw)) {
    throw new BadRequestException('allergyEntries deve ser um array');
  }
  const out: StoredAllergyEntry[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
    const r = row as Record<string, unknown>;
    const key =
      typeof r.substanceKey === 'string' ? r.substanceKey.trim() : '';
    if (!key) {
      throw new BadRequestException(
        'Cada alergia deve ter substanceKey do catálogo.',
      );
    }
    if (!isValidAllergySubstanceKey(key)) {
      throw new BadRequestException(`Alergia: substanceKey inválida: ${key}`);
    }
    const customLabel =
      typeof r.customLabel === 'string' ? r.customLabel.trim() : '';
    if (key === 'OTHER' && !customLabel) {
      throw new BadRequestException(
        'Para alergia "Outra", preencha o nome em customLabel.',
      );
    }
    const reactionNotes =
      typeof r.reactionNotes === 'string' && r.reactionNotes.trim()
        ? r.reactionNotes.trim()
        : undefined;
    const entry: StoredAllergyEntry = {
      substanceKey: key,
      reactionNotes,
    };
    if (key === 'OTHER') {
      entry.customLabel = customLabel;
    }
    out.push(entry);
  }
  return out.length > 0 ? (out as unknown as Prisma.InputJsonValue) : undefined;
}

/** Texto para prontuário / exibição a partir de uma entrada armazenada. */
export function formatStoredAllergyLine(entry: StoredAllergyEntry): string {
  const cat = getAllergyCatalogEntry(entry.substanceKey);
  const base =
    entry.substanceKey === 'OTHER' && entry.customLabel
      ? entry.customLabel
      : cat?.label ?? entry.substanceKey;
  const catLabel = cat?.category
    ? ` [${categoryLabelPt(cat.category)}]`
    : '';
  const rx = entry.reactionNotes ? ` — ${entry.reactionNotes}` : '';
  return `${base}${catLabel}${rx}`;
}

function categoryLabelPt(c: string): string {
  const m: Record<string, string> = {
    MEDICATION: 'medicamento',
    CONTRAST: 'contraste',
    LATEX: 'látex',
    FOOD_OR_ENVIRONMENT: 'alimento/ambiente',
    OTHER: 'outro',
  };
  return m[c] ?? c;
}
