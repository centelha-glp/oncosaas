import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MEDICATION_CATALOG_ROUTES } from './medication-catalog.routes';
import {
  mapPresentationToEntry,
  type MedicationCatalogEntryDto,
} from './medication-catalog-entry.util';

import type { MedicationCatalogSeedDrug } from '../../prisma/medication-catalog-seed-data';
export type { MedicationCatalogSeedDrug };

@Injectable()
export class MedicationCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  listRoutes() {
    return { routes: MEDICATION_CATALOG_ROUTES };
  }

  async searchEntries(params: {
    q?: string;
    limit: number;
  }): Promise<{ items: MedicationCatalogEntryDto[] }> {
    const trimmed = params.q?.trim();
    const presentationWhere: Prisma.MedicationCatalogPresentationWhereInput = {};
    if (trimmed) {
      presentationWhere.OR = [
        { label: { contains: trimmed, mode: 'insensitive' } },
        { code: { contains: trimmed, mode: 'insensitive' } },
        { strength: { contains: trimmed, mode: 'insensitive' } },
        { form: { contains: trimmed, mode: 'insensitive' } },
        {
          drug: {
            displayName: { contains: trimmed, mode: 'insensitive' },
          },
        },
        {
          drug: {
            genericName: { contains: trimmed, mode: 'insensitive' },
          },
        },
        { drug: { code: { contains: trimmed, mode: 'insensitive' } } },
      ];
    }

    const presentations =
      await this.prisma.medicationCatalogPresentation.findMany({
        where: presentationWhere,
        take: params.limit,
        orderBy: [{ drug: { displayName: 'asc' } }, { label: 'asc' }],
        select: {
          code: true,
          label: true,
          strength: true,
          form: true,
          drug: {
            select: {
              code: true,
              displayName: true,
              allowedRoutes: true,
            },
          },
        },
      });

    const items = presentations.map((p) => mapPresentationToEntry(p));
    const drugCodesWithPresentation = new Set(items.map((i) => i.drugCode));

    if (items.length < params.limit) {
      const drugWhere: Prisma.MedicationCatalogDrugWhereInput = {};
      if (trimmed) {
        drugWhere.OR = [
          { displayName: { contains: trimmed, mode: 'insensitive' } },
          { genericName: { contains: trimmed, mode: 'insensitive' } },
          { code: { contains: trimmed, mode: 'insensitive' } },
        ];
      }
      if (drugCodesWithPresentation.size > 0) {
        drugWhere.code = { notIn: [...drugCodesWithPresentation] };
      }

      const drugsWithoutPresentation =
        await this.prisma.medicationCatalogDrug.findMany({
          where: drugWhere,
          take: params.limit - items.length,
          orderBy: [{ displayName: 'asc' }],
          select: {
            code: true,
            displayName: true,
            allowedRoutes: true,
            _count: { select: { presentations: true } },
          },
        });

      for (const drug of drugsWithoutPresentation) {
        if (drug._count.presentations > 0) continue;
        items.push({
          drugCode: drug.code,
          presentationCode: null,
          label: drug.displayName,
          displayName: drug.displayName,
          strength: null,
          allowedRoutes: drug.allowedRoutes,
        });
      }
    }

    return { items: items.slice(0, params.limit) };
  }

  async search(params: { q?: string; limit: number; offset: number }) {
    const { q, limit, offset } = params;
    const where: Prisma.MedicationCatalogDrugWhereInput = {};
    const trimmed = q?.trim();
    if (trimmed) {
      where.OR = [
        { displayName: { contains: trimmed, mode: 'insensitive' } },
        { genericName: { contains: trimmed, mode: 'insensitive' } },
        { code: { contains: trimmed, mode: 'insensitive' } },
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.medicationCatalogDrug.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: [{ displayName: 'asc' }],
        select: {
          code: true,
          genericName: true,
          displayName: true,
          category: true,
          allowedRoutes: true,
        },
      }),
      this.prisma.medicationCatalogDrug.count({ where }),
    ]);
    return { items, total, limit, offset };
  }

  async listPresentations(
    drugCode: string,
    params: { q?: string; limit: number }
  ) {
    const drug = await this.prisma.medicationCatalogDrug.findUnique({
      where: { code: drugCode },
      select: { code: true, displayName: true },
    });
    if (!drug) {
      throw new NotFoundException('Medicamento não encontrado no catálogo');
    }
    const where: Prisma.MedicationCatalogPresentationWhereInput = {
      drugCode,
    };
    const trimmed = params.q?.trim();
    if (trimmed) {
      where.OR = [
        { label: { contains: trimmed, mode: 'insensitive' } },
        { code: { contains: trimmed, mode: 'insensitive' } },
        { strength: { contains: trimmed, mode: 'insensitive' } },
      ];
    }
    const items = await this.prisma.medicationCatalogPresentation.findMany({
      where,
      take: params.limit,
      orderBy: [{ label: 'asc' }],
      select: {
        code: true,
        drugCode: true,
        label: true,
        strength: true,
        form: true,
      },
    });
    return { drug, items };
  }

  async findDrugByCode(code: string) {
    return this.prisma.medicationCatalogDrug.findUnique({
      where: { code },
      include: { presentations: true },
    });
  }

  async findPresentationByCode(code: string) {
    return this.prisma.medicationCatalogPresentation.findUnique({
      where: { code },
      include: { drug: true },
    });
  }

  async importSeed(drugs: MedicationCatalogSeedDrug[], sourceVersion?: string) {
    return this.prisma.$transaction(async (tx) => {
      let upsertedDrugs = 0;
      let upsertedPresentations = 0;
      for (const row of drugs) {
        await tx.medicationCatalogDrug.upsert({
          where: { code: row.code },
          create: {
            code: row.code,
            genericName: row.genericName,
            displayName: row.displayName,
            category: row.category as never,
            allowedRoutes: row.allowedRoutes,
            sourceVersion: sourceVersion ?? null,
          },
          update: {
            genericName: row.genericName,
            displayName: row.displayName,
            category: row.category as never,
            allowedRoutes: row.allowedRoutes,
            ...(sourceVersion !== undefined ? { sourceVersion } : {}),
          },
        });
        upsertedDrugs++;
        for (const pres of row.presentations) {
          await tx.medicationCatalogPresentation.upsert({
            where: { code: pres.code },
            create: {
              code: pres.code,
              drugCode: row.code,
              label: pres.label,
              strength: pres.strength ?? null,
              form: pres.form ?? null,
              sourceVersion: sourceVersion ?? null,
            },
            update: {
              drugCode: row.code,
              label: pres.label,
              strength: pres.strength ?? null,
              form: pres.form ?? null,
              ...(sourceVersion !== undefined ? { sourceVersion } : {}),
            },
          });
          upsertedPresentations++;
        }
      }
      return { upsertedDrugs, upsertedPresentations, sourceVersion: sourceVersion ?? null };
    });
  }
}
