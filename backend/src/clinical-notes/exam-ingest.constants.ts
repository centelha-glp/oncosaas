/** TTL Redis para sessão de ingestão (QR / buffer efémero), em segundos. */
export const EXAM_INGEST_TTL_SEC = 900;

/** Tamanho máximo por ficheiro enviado (bytes). */
export const EXAM_INGEST_MAX_FILE_BYTES = 8 * 1024 * 1024;

/** Máximo de ficheiros por sessão (desktop + móvel combinados). */
export const EXAM_INGEST_MAX_FILES_PER_SESSION = 10;

/** MIME base (sem parâmetros) permitidos para ingestão / extração de exames. */
export const EXAM_INGEST_ALLOWED_MIME_BASES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'audio/webm',
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/m4a',
  'audio/x-m4a',
  'audio/wav',
  'audio/x-wav',
  'audio/flac',
  'audio/ogg',
  'audio/opus',
]);

export function normalizeExamIngestMime(mimetype: string): string {
  return mimetype.split(';')[0].trim().toLowerCase();
}

export function isExamIngestMimeAllowed(mimetype: string | undefined): boolean {
  if (!mimetype) {return false;}
  return EXAM_INGEST_ALLOWED_MIME_BASES.has(normalizeExamIngestMime(mimetype));
}
