import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  GatewayTimeoutException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes, randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import {
  getAiServiceConfig,
  getAiServiceHeadersWithTenant,
} from '../common/utils/ai-service.util';
import {
  EXAM_INGEST_MAX_FILE_BYTES,
  EXAM_INGEST_MAX_FILES_PER_SESSION,
  EXAM_INGEST_TTL_SEC,
  isExamIngestMimeAllowed,
} from './exam-ingest.constants';
import { applyComplementaryExamsFromAiItems } from '../clinical-note-extraction/apply-complementary-exams';
import type { AiComplementaryExamItem } from '../clinical-note-extraction/clinical-note-extraction.types';
import type { ConfirmComplementaryExamsDto } from './dto/exam-ingest.dto';

/** Extrai `detail` de corpo JSON típico do FastAPI (mensagem segura ao cliente). */
function parseAiServiceErrorDetail(raw: string): string | undefined {
  const t = raw.trim();
  if (!t) {return undefined;}
  try {
    const o = JSON.parse(t) as { detail?: unknown };
    const d = o.detail;
    if (typeof d === 'string' && d.trim()) {return d.trim();}
    if (Array.isArray(d) && d.length > 0) {
      const first = d[0] as { msg?: string };
      if (first && typeof first.msg === 'string' && first.msg.trim()) {
        return first.msg.trim();
      }
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

function pickStr(
  o: Record<string, unknown>,
  snake: string,
  camel: string
): string | null | undefined {
  const v = o[snake] ?? o[camel];
  if (v === null || v === undefined) {return v as null | undefined;}
  return String(v);
}

function mapUpstreamComplementaryExams(raw: unknown): AiComplementaryExamItem[] {
  if (!Array.isArray(raw)) {return [];}
  const out: AiComplementaryExamItem[] = [];
  for (const el of raw) {
    if (!el || typeof el !== 'object' || Array.isArray(el)) {continue;}
    const o = el as Record<string, unknown>;
    const typ = o.type;
    const name = o.name;
    if (typeof typ !== 'string' || typeof name !== 'string') {continue;}
    const codeRaw = o.code;
    const loincRaw = o.loinc_code ?? o.loincCode;
    const resRaw = o.result;
    let result: AiComplementaryExamItem['result'] = undefined;
    if (resRaw && typeof resRaw === 'object' && !Array.isArray(resRaw)) {
      const r = resRaw as Record<string, unknown>;
      const vn = r.value_numeric ?? r.valueNumeric;
      let value_numeric: number | null | undefined;
      if (vn === null || vn === undefined || vn === '') {
        value_numeric = vn === null ? null : undefined;
      } else if (typeof vn === 'number' && Number.isFinite(vn)) {
        value_numeric = vn;
      } else {
        const num = Number(vn);
        value_numeric = Number.isFinite(num) ? num : null;
      }
      const ia = r.is_abnormal ?? r.isAbnormal;
      result = {
        performed_at:
          (pickStr(r, 'performed_at', 'performedAt') as string | null | undefined) ??
          undefined,
        value_numeric,
        value_text:
          (pickStr(r, 'value_text', 'valueText') as string | null | undefined) ??
          undefined,
        unit:
          (r.unit === null || r.unit === undefined
            ? r.unit
            : String(r.unit)) as string | null | undefined,
        reference_range:
          (pickStr(r, 'reference_range', 'referenceRange') as
            | string
            | null
            | undefined) ?? undefined,
        is_abnormal: typeof ia === 'boolean' ? ia : undefined,
        report:
          (r.report === null || r.report === undefined
            ? r.report
            : String(r.report)) as string | null | undefined,
        components: r.components ?? r.Components,
      };
    }
    out.push({
      type: typ.trim(),
      name: name.trim(),
      code:
        codeRaw === null || codeRaw === undefined
          ? null
          : String(codeRaw).trim() || null,
      loinc_code:
        loincRaw === null || loincRaw === undefined
          ? null
          : String(loincRaw).trim() || null,
      result: result ?? null,
    });
  }
  return out;
}

export type ExamIngestSessionMeta = {
  tenantId: string;
  userId: string;
  patientId: string;
  clinicalNoteId?: string;
  createdAt: string;
  uploadToken: string;
};

export type ExamIngestFileEntry = {
  mimeType: string;
  dataBase64: string;
};

@Injectable()
export class ExamIngestService {
  private readonly logger = new Logger(ExamIngestService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {}

  private tokenKey(token: string): string {
    return `ei:tok:${token}`;
  }

  private sessionMetaKey(sessionId: string): string {
    return `ei:sess:${sessionId}`;
  }

  private sessionFilesKey(sessionId: string): string {
    return `ei:files:${sessionId}`;
  }

  private async assertPatientTenant(
    patientId: string,
    tenantId: string
  ): Promise<void> {
    const p = await this.prisma.patient.findFirst({
      where: { id: patientId, tenantId },
      select: { id: true },
    });
    if (!p) {throw new NotFoundException('Paciente não encontrado');}
  }

  private async assertClinicalNoteOptional(
    clinicalNoteId: string | undefined,
    patientId: string,
    tenantId: string
  ): Promise<void> {
    if (!clinicalNoteId) {return;}
    const n = await this.prisma.clinicalNote.findFirst({
      where: { id: clinicalNoteId, patientId, tenantId },
      select: { id: true },
    });
    if (!n) {throw new NotFoundException('Evolução clínica não encontrada');}
  }

  async createSession(
    tenantId: string,
    userId: string,
    patientId: string,
    clinicalNoteId?: string
  ): Promise<{
    sessionId: string;
    uploadToken: string;
    expiresAt: string;
    mobileUrl: string;
  }> {
    await this.assertPatientTenant(patientId, tenantId);
    await this.assertClinicalNoteOptional(clinicalNoteId, patientId, tenantId);

    const sessionId = randomUUID();
    const uploadToken = randomBytes(32).toString('hex');
    const meta: ExamIngestSessionMeta = {
      tenantId,
      userId,
      patientId,
      clinicalNoteId,
      createdAt: new Date().toISOString(),
      uploadToken,
    };

    const ttl = EXAM_INGEST_TTL_SEC;
    await this.redis.set(this.tokenKey(uploadToken), sessionId, ttl);
    await this.redis.set(this.sessionMetaKey(sessionId), JSON.stringify(meta), ttl);

    const base =
      this.config.get<string>('FRONTEND_URL')?.replace(/\/$/, '') ||
      'http://localhost:3000';
    const mobileUrl = `${base}/m/exam-ingest/${uploadToken}`;
    const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();

    this.logger.log(
      `exam-ingest session created sessionId=${sessionId} tenant=${tenantId}`
    );

    return { sessionId, uploadToken, expiresAt, mobileUrl };
  }

  async getSessionStatus(
    sessionId: string,
    tenantId: string,
    patientId: string
  ): Promise<{
    sessionId: string;
    filesReady: boolean;
    fileCount: number;
    expiresInSec: number;
  }> {
    const raw = await this.redis.get(this.sessionMetaKey(sessionId));
    if (!raw) {throw new NotFoundException('Sessão expirada ou inválida');}
    const meta = JSON.parse(raw) as ExamIngestSessionMeta;
    if (meta.tenantId !== tenantId) {throw new ForbiddenException();}
    if (meta.patientId !== patientId) {throw new ForbiddenException();}
    const count = await this.redis.llen(this.sessionFilesKey(sessionId));
    const ttl = await this.redis.ttl(this.sessionMetaKey(sessionId));

    return {
      sessionId,
      filesReady: count > 0,
      fileCount: count,
      expiresInSec: ttl > 0 ? ttl : 0,
    };
  }

  async appendFileFromBuffer(params: {
    sessionId: string;
    tenantId: string;
    patientId: string;
    mimeType: string;
    buffer: Buffer;
  }): Promise<{ fileCount: number }> {
    const { sessionId, tenantId, patientId, mimeType, buffer } = params;
    if (!isExamIngestMimeAllowed(mimeType)) {
      throw new BadRequestException('Tipo de ficheiro não permitido');
    }
    if (buffer.length > EXAM_INGEST_MAX_FILE_BYTES) {
      throw new BadRequestException('Ficheiro demasiado grande');
    }

    const raw = await this.redis.get(this.sessionMetaKey(sessionId));
    if (!raw) {throw new NotFoundException('Sessão expirada ou inválida');}
    const meta = JSON.parse(raw) as ExamIngestSessionMeta;
    if (meta.tenantId !== tenantId) {throw new ForbiddenException();}
    if (meta.patientId !== patientId) {throw new ForbiddenException();}

    const current = await this.redis.llen(this.sessionFilesKey(sessionId));
    if (current >= EXAM_INGEST_MAX_FILES_PER_SESSION) {
      throw new BadRequestException('Limite de ficheiros por sessão atingido');
    }

    const entry: ExamIngestFileEntry = {
      mimeType,
      dataBase64: buffer.toString('base64'),
    };
    await this.redis.rpush(
      this.sessionFilesKey(sessionId),
      JSON.stringify(entry)
    );

    const n = await this.redis.llen(this.sessionFilesKey(sessionId));
    return { fileCount: n };
  }

  async appendFileByUploadToken(
    uploadToken: string,
    mimeType: string,
    buffer: Buffer
  ): Promise<{ ok: true; fileCount: number }> {
    const sessionId = await this.redis.get(this.tokenKey(uploadToken));
    if (!sessionId) {throw new NotFoundException('Token inválido ou expirado');}

    const raw = await this.redis.get(this.sessionMetaKey(sessionId));
    if (!raw) {throw new NotFoundException('Sessão expirada');}
    const meta = JSON.parse(raw) as ExamIngestSessionMeta;

    return {
      ok: true,
      ...(await this.appendFileFromBuffer({
        sessionId,
        tenantId: meta.tenantId,
        patientId: meta.patientId,
        mimeType,
        buffer,
      })),
    };
  }

  async extract(
    tenantId: string,
    userId: string,
    opts: {
      patientId: string;
      plainText?: string;
      sessionId?: string;
      uploadedFiles?: Array<{ mimeType: string; buffer: Buffer }>;
    }
  ): Promise<{
    markdownSummary: string;
    detectedCategories: string[];
    disclaimer: string;
    markdownFromStructuredParse: boolean;
    collectionId?: string;
    complementaryExamsSavedCount: number;
    complementaryExamResultSavedCount: number;
    complementaryExamIds: string[];
  }> {
    const { patientId, plainText, sessionId, uploadedFiles } = opts;
    await this.assertPatientTenant(patientId, tenantId);

    const files: ExamIngestFileEntry[] = [];
    let uploadTokenToInvalidate: string | null = null;

    if (sessionId) {
      const raw = await this.redis.get(this.sessionMetaKey(sessionId));
      if (!raw) {throw new NotFoundException('Sessão expirada ou inválida');}
      const meta = JSON.parse(raw) as ExamIngestSessionMeta;
      if (meta.tenantId !== tenantId || meta.userId !== userId) {
        throw new ForbiddenException();
      }
      if (meta.patientId !== patientId) {
        throw new BadRequestException('Sessão não corresponde a este paciente');
      }
      uploadTokenToInvalidate = meta.uploadToken;
      const blobs = await this.redis.lrange(this.sessionFilesKey(sessionId), 0, -1);
      for (const line of blobs) {
        try {
          files.push(JSON.parse(line) as ExamIngestFileEntry);
        } catch {
          /* skip */
        }
      }
    }

    for (const file of uploadedFiles ?? []) {
      if (!isExamIngestMimeAllowed(file.mimeType)) {
        throw new BadRequestException('Tipo de ficheiro não permitido');
      }
      if (file.buffer.length > EXAM_INGEST_MAX_FILE_BYTES) {
        throw new BadRequestException('Ficheiro demasiado grande');
      }
      files.push({
        mimeType: file.mimeType,
        dataBase64: file.buffer.toString('base64'),
      });
    }

    if (files.length > EXAM_INGEST_MAX_FILES_PER_SESSION) {
      throw new BadRequestException(
        `No máximo ${EXAM_INGEST_MAX_FILES_PER_SESSION} ficheiros por extração`
      );
    }

    const text = plainText?.trim();
    if (!text && files.length === 0) {
      throw new BadRequestException('Envie texto ou ficheiro, ou use uma sessão com uploads');
    }

    const { aiServiceUrl } = getAiServiceConfig(this.config);
    const headers = getAiServiceHeadersWithTenant(this.config, tenantId);
    const url = `${aiServiceUrl}/api/v1/exam-extract`;
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 120_000);

    try {
      const body = {
        plainText: text || null,
        files,
      };
      let res: Response;
      try {
        res = await fetch(url, {
          method: 'POST',
          headers: {
            ...headers,
            'X-Tenant-Id': tenantId,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
      } catch (err) {
        const name = err instanceof Error ? err.name : '';
        const msg = err instanceof Error ? err.message : String(err);
        if (name === 'AbortError') {
          this.logger.warn(`exam-extract fetch aborted (timeout) tenant=${tenantId}`);
          throw new GatewayTimeoutException(
            'O serviço de extração demorou demasiado a responder. Tente ficheiros mais pequenos ou mais tarde.'
          );
        }
        this.logger.error(`exam-extract fetch failed: ${msg}`);
        throw new BadGatewayException(
          'Não foi possível contactar o serviço de extração. Tente novamente mais tarde.'
        );
      }

      const rawBody = await res.text();
      const upstreamDetail = parseAiServiceErrorDetail(rawBody);

      if (!res.ok) {
        this.logger.warn(
          `exam-extract upstream status=${res.status} tenant=${tenantId}`
        );
        if (res.status === 503) {
          throw new ServiceUnavailableException(
            upstreamDetail ??
              'Transcrição ou extração indisponível momentaneamente. Configure a chave OpenAI no serviço de IA ou tente mais tarde.'
          );
        }
        if (res.status === 502 || res.status === 504) {
          throw new BadGatewayException(
            upstreamDetail ??
              'O serviço de extração respondeu com erro. Tente novamente mais tarde.'
          );
        }
        if (res.status >= 400 && res.status < 500) {
          throw new BadRequestException(
            upstreamDetail ?? 'Pedido de extração inválido.'
          );
        }
        throw new BadGatewayException(
          upstreamDetail ??
            'Falha ao processar extração no serviço de IA. Tente novamente mais tarde.'
        );
      }

      type ExtractJson = {
        markdownSummary: string;
        detectedCategories: string[];
        disclaimer: string;
        markdownFromStructuredParse?: boolean;
        complementaryExams?: unknown;
        complementary_exams?: unknown;
      };
      let json: ExtractJson;
      try {
        json = JSON.parse(rawBody) as ExtractJson;
      } catch {
        this.logger.error('exam-extract upstream returned non-JSON body');
        throw new BadGatewayException(
          'Resposta inválida do serviço de extração. Tente novamente.'
        );
      }
      if (
        typeof json.markdownSummary !== 'string' ||
        !Array.isArray(json.detectedCategories) ||
        typeof json.disclaimer !== 'string'
      ) {
        this.logger.error('exam-extract upstream JSON missing required fields');
        throw new BadGatewayException(
          'Resposta incompleta do serviço de extração. Tente novamente.'
        );
      }

      if (json.markdownFromStructuredParse !== true) {
        this.logger.error(
          'exam-extract upstream JSON without validated structured parse flag'
        );
        throw new BadGatewayException(
          'Extração indisponível: resposta do serviço de IA não validada. Tente novamente.'
        );
      }

      if (!json.markdownSummary.trim()) {
        this.logger.error('exam-extract upstream returned empty markdown after structured parse');
        throw new BadGatewayException(
          'Extração indisponível: sumário vazio. Tente novamente.'
        );
      }

      const upstreamExams =
        json.complementaryExams ?? json.complementary_exams;
      const mappedExams = mapUpstreamComplementaryExams(upstreamExams);
      const collectionId =
        mappedExams.length > 0 ? randomUUID() : undefined;

      if (sessionId) {
        if (uploadTokenToInvalidate) {
          await this.redis.del(this.tokenKey(uploadTokenToInvalidate));
        }
        await this.redis.del(this.sessionFilesKey(sessionId));
        await this.redis.del(this.sessionMetaKey(sessionId));
      }

      return {
        markdownSummary: json.markdownSummary,
        detectedCategories: json.detectedCategories,
        disclaimer: json.disclaimer,
        markdownFromStructuredParse: true,
        collectionId,
        complementaryExamsSavedCount: 0,
        complementaryExamResultSavedCount: 0,
        complementaryExamIds: [],
      };
    } finally {
      clearTimeout(t);
    }
  }

  async confirmComplementaryExams(
    tenantId: string,
    patientId: string,
    dto: ConfirmComplementaryExamsDto,
  ): Promise<{
    collectionId: string;
    complementaryExamsSavedCount: number;
    complementaryExamResultSavedCount: number;
    complementaryExamIds: string[];
  }> {
    await this.assertPatientTenant(patientId, tenantId);

    const items: AiComplementaryExamItem[] = dto.items.map((row) => ({
      type: row.type.trim(),
      name: row.name.trim(),
      code: row.code ?? null,
      loinc_code: null,
      result: (row.result as AiComplementaryExamItem['result']) ?? null,
    }));
    const collectionId = dto.collectionId ?? randomUUID();
    const rej: Array<{ domain: string; reason: string; field?: string | null }> =
      [];
    const applied = await this.prisma.$transaction(async (tx) => {
      return applyComplementaryExamsFromAiItems(
        tx,
        {
          tenantId,
          patientId,
          mergedRejections: rej,
          collectionId,
        },
        items,
      );
    });
    return {
      collectionId,
      complementaryExamsSavedCount: applied.complementaryExamIds.length,
      complementaryExamResultSavedCount: applied.complementaryExamResultIds.length,
      complementaryExamIds: applied.complementaryExamIds,
    };
  }
}
