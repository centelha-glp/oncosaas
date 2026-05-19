/** Extrai `detail` de corpo JSON típico do FastAPI (mensagem segura ao cliente). */
export function parseAiServiceErrorDetail(raw: string): string | undefined {
  const t = raw.trim();
  if (!t) {
    return undefined;
  }
  try {
    const o = JSON.parse(t) as { detail?: unknown };
    const d = o.detail;
    if (typeof d === 'string' && d.trim()) {
      return d.trim();
    }
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
