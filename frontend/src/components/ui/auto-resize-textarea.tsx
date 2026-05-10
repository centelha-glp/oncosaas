'use client';

import * as React from 'react';
import { Textarea, type TextareaProps } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

// #region agent log helpers
function debugLog(
  location: string,
  message: string,
  data: Record<string, unknown>,
  hypothesisId: string,
  runId: string
) {
  const payload = {
    sessionId: '7c6484',
    location,
    message,
    data,
    hypothesisId,
    runId,
    timestamp: Date.now(),
  };

  // Tenta enviar direto (pode falhar em HTTPS por mixed content).
  fetch('http://127.0.0.1:7543/ingest/0e23547d-37f1-488d-8999-9cd629cca9d9', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Debug-Session-Id': '7c6484',
    },
    body: JSON.stringify(payload),
  }).catch(() => {
    // Fallback via mesma origem → server-side forward para o endpoint HTTP.
    fetch('/api/__debug_ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {});
  });
}
// #endregion

// #region agent log scroll parents
function isScrollable(el: HTMLElement): boolean {
  const s = getComputedStyle(el);
  const oy = s.overflowY;
  if (oy !== 'auto' && oy !== 'scroll' && oy !== 'overlay') return false;
  return el.scrollHeight > el.clientHeight;
}

function collectScrollParents(el: HTMLElement, limit = 3): HTMLElement[] {
  const out: HTMLElement[] = [];
  let cur: HTMLElement | null = el.parentElement;
  while (cur && out.length < limit) {
    if (isScrollable(cur)) out.push(cur);
    cur = cur.parentElement;
  }
  return out;
}
// #endregion

function mergeRefs<T>(
  ...refs: Array<React.Ref<T> | undefined | null>
): React.RefCallback<T> {
  return (node: T | null) => {
    for (const ref of refs) {
      if (ref == null) continue;
      if (typeof ref === 'function') ref(node);
      else (ref as React.MutableRefObject<T | null>).current = node;
    }
  };
}

export interface AutoResizeTextareaProps extends TextareaProps {
  /** Linhas mínimas visíveis antes de crescer com o conteúdo (aprox. line-height do tema). */
  minRows?: number;
}

export const AutoResizeTextarea = React.forwardRef<
  HTMLTextAreaElement,
  AutoResizeTextareaProps
>(({ className, onChange, minRows: minRowsProp = 3, style, ...props }, ref) => {
  const innerRef = React.useRef<HTMLTextAreaElement | null>(null);
  const mergedRef = React.useMemo(() => mergeRefs(innerRef, ref), [ref]);
  const scrollParentsRef = React.useRef<HTMLElement[]>([]);
  const isRestoringScrollRef = React.useRef(false);
  const lastManualScrollAtRef = React.useRef<number>(0);
  const lastScrollRef = React.useRef<{
    winY: number | null;
    docTop: number | null;
    parents: number[];
  }>({ winY: null, docTop: null, parents: [] });
  const lastScrollLogTsRef = React.useRef<number>(0);

  const SCROLL_COOLDOWN_MS = 700;
  const isInManualScrollCooldown = React.useCallback(() => {
    return Date.now() - lastManualScrollAtRef.current < SCROLL_COOLDOWN_MS;
  }, []);

  React.useEffect(() => {
    const el = innerRef.current;
    if (!el || typeof document === 'undefined') return;
    scrollParentsRef.current = collectScrollParents(el, 3);
    lastScrollRef.current.parents = scrollParentsRef.current.map((p) => p.scrollTop);
  }, []);

  React.useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    const onAnyScroll = () => {
      const el = innerRef.current;
      if (!el) return;
      if (document.activeElement !== el) return;

      const now = Date.now();
      if (now - lastScrollLogTsRef.current < 80) return; // throttle
      lastScrollLogTsRef.current = now;

      const scrollingEl = document.scrollingElement as HTMLElement | null;
      const winY = window.scrollY;
      const docTop = scrollingEl ? scrollingEl.scrollTop : null;
      const parents = scrollParentsRef.current;
      const parentTops = parents.map((p) => p.scrollTop);
      const prev = lastScrollRef.current;

      const changed =
        prev.winY !== winY ||
        prev.docTop !== docTop ||
        parentTops.some((t, i) => t !== prev.parents[i]);

      if (!changed) return;
      lastScrollRef.current = { winY, docTop, parents: parentTops };

      // Marca scroll manual (ou do browser) enquanto o campo está focado.
      // Evita "disputa" de scroll quando o usuário acabou de rolar e voltou a digitar.
      if (!isRestoringScrollRef.current) {
        lastManualScrollAtRef.current = now;
      }

      // #region agent log (H1)
      debugLog(
        'auto-resize-textarea.tsx:scrollEvent',
        'scroll-event-while-focused',
        {
          winY,
          docTop,
          parents: parents.map((p, i) => ({
            tag: p.tagName,
            id: p.id || null,
            className: p.className || null,
            scrollTop: parentTops[i],
          })),
        },
        'H1',
        'pre-fix'
      );
      // #endregion
    };

    window.addEventListener('scroll', onAnyScroll, { passive: true });
    const scrollingEl = document.scrollingElement as HTMLElement | null;
    scrollingEl?.addEventListener('scroll', onAnyScroll, { passive: true });
    for (const p of scrollParentsRef.current) {
      p.addEventListener('scroll', onAnyScroll, { passive: true });
    }

    return () => {
      window.removeEventListener('scroll', onAnyScroll);
      scrollingEl?.removeEventListener('scroll', onAnyScroll);
      for (const p of scrollParentsRef.current) {
        p.removeEventListener('scroll', onAnyScroll);
      }
    };
  }, []);

  const adjustHeight = React.useCallback(() => {
    const el = innerRef.current;
    if (!el) return;

    // #region agent log (H1/H4)
    const scrollingEl =
      typeof document !== 'undefined'
        ? (document.scrollingElement as HTMLElement | null)
        : null;
    const scrollParents =
      typeof document !== 'undefined'
        ? collectScrollParents(el)
        : [];
    const scrollYBefore =
      typeof window !== 'undefined' ? window.scrollY : null;
    const scrollTopBefore = scrollingEl ? scrollingEl.scrollTop : null;
    const before = {
      active: document.activeElement === el,
      valueLen: typeof props.value === 'string' ? props.value.length : null,
      styleHeight: el.style.height || null,
      offsetHeight: el.offsetHeight,
      scrollHeight: el.scrollHeight,
      winScrollY: scrollYBefore,
      scrollTopBefore,
      scrollParents: scrollParents.map((p) => ({
        tag: p.tagName,
        id: p.id || null,
        className: p.className || null,
        scrollTop: p.scrollTop,
        clientHeight: p.clientHeight,
        scrollHeight: p.scrollHeight,
      })),
    };
    // #endregion

    const currentPx = Number.parseInt(el.style.height || '0', 10) || 0;
    const measured = el.scrollHeight;

    // Se nada mudou, não tocar em `style.height`: mesmo “reaplicar” o mesmo valor pode causar
    // reposicionamento do scroll do documento em alguns navegadores.
    if (measured === currentPx) {
      // #region agent log (H1)
      debugLog(
        'auto-resize-textarea.tsx:adjustHeight',
        'adjustHeight-skip-same-height',
        { ...before, currentPx, measured },
        'H1',
        'pre-fix'
      );
      // #endregion
      return;
    }

    // Evita “encolhe→cresce” (pode causar tremor/scroll jump): ao CRESCER, aplicar direto.
    // Ao ENCOLHER, precisamos limpar para o scrollHeight refletir a nova altura.
    let next = measured;
    if (measured < currentPx) {
      el.style.height = '';
      next = el.scrollHeight;
    }
    el.style.height = `${next}px`;

    // #region agent log (H1)
    const scrollYAfter =
      typeof window !== 'undefined' ? window.scrollY : null;
    const scrollTopAfter = scrollingEl ? scrollingEl.scrollTop : null;
    debugLog(
      'auto-resize-textarea.tsx:adjustHeight',
      'scroll-delta-after-resize',
      {
        scrollYBefore,
        scrollYAfter,
        delta:
          typeof scrollYBefore === 'number' && typeof scrollYAfter === 'number'
            ? scrollYAfter - scrollYBefore
            : null,
        scrollTopBefore,
        scrollTopAfter,
        scrollTopDelta:
          typeof scrollTopBefore === 'number' && typeof scrollTopAfter === 'number'
            ? scrollTopAfter - scrollTopBefore
            : null,
        currentPx,
        measured,
        next,
      },
      'H1',
      'pre-fix'
    );
    // #endregion

    // Se o resize mexeu no scroll do documento, restaura. Isso impede o “pulo” ao inserir quebra de linha.
    if (document.activeElement === el && scrollingEl && scrollTopBefore !== null) {
      if (isInManualScrollCooldown()) {
        return;
      }
      if (scrollingEl.scrollTop !== scrollTopBefore) {
        isRestoringScrollRef.current = true;
        scrollingEl.scrollTop = scrollTopBefore;
        isRestoringScrollRef.current = false;
        // #region agent log (H1)
        debugLog(
          'auto-resize-textarea.tsx:adjustHeight',
          'restored-scrollTop',
          {
            restoredTo: scrollTopBefore,
            now: scrollingEl.scrollTop,
            next,
          },
          'H1',
          'pre-fix'
        );
        // #endregion
      }
    }

    // Se houver container scrollável acima (tabs, painel, etc.), também restaura para evitar “tremida”.
    if (document.activeElement === el) {
      if (isInManualScrollCooldown()) {
        return;
      }
      for (const parent of scrollParents) {
        const snap = (before as any).scrollParents?.find(
          (p: any) =>
            p.tag === parent.tagName &&
            p.id === (parent.id || null) &&
            p.className === (parent.className || null)
        );
        if (snap && typeof snap.scrollTop === 'number' && parent.scrollTop !== snap.scrollTop) {
          const beforeRestore = parent.scrollTop;
          isRestoringScrollRef.current = true;
          parent.scrollTop = snap.scrollTop;
          isRestoringScrollRef.current = false;
          // #region agent log (H1)
          debugLog(
            'auto-resize-textarea.tsx:adjustHeight',
            'restored-parent-scrollTop',
            {
              tag: parent.tagName,
              id: parent.id || null,
              className: parent.className || null,
              beforeRestore,
              restoredTo: snap.scrollTop,
              now: parent.scrollTop,
            },
            'H1',
            'pre-fix'
          );
          // #endregion
        }
      }
    }

    // Alguns navegadores ajustam o scroll *depois* do layout (na mesma frame).
    // Se houver “tremida” (scroll muda e volta), esse é o ponto de captura/correção.
    if (document.activeElement === el && !isInManualScrollCooldown()) {
      requestAnimationFrame(() => {
        const se =
          typeof document !== 'undefined'
            ? (document.scrollingElement as HTMLElement | null)
            : null;
        if (se && scrollTopBefore !== null && se.scrollTop !== scrollTopBefore) {
          const beforeRaf = se.scrollTop;
          isRestoringScrollRef.current = true;
          se.scrollTop = scrollTopBefore;
          isRestoringScrollRef.current = false;
          // #region agent log (H1)
          debugLog(
            'auto-resize-textarea.tsx:adjustHeight',
            'restored-scrollTop-in-raf',
            { beforeRaf, restoredTo: scrollTopBefore, now: se.scrollTop, next },
            'H1',
            'pre-fix'
          );
          // #endregion
        }
      });
    }

    // #region agent log (H1/H4)
    debugLog(
      'auto-resize-textarea.tsx:adjustHeight',
      'adjustHeight',
      {
        ...before,
        currentPx,
        measured,
        nextHeight: next,
        afterOffsetHeight: el.offsetHeight,
      },
      'H1',
      'pre-fix'
    );
    // #endregion
  }, []);

  React.useLayoutEffect(() => {
    // #region agent log (H3)
    debugLog(
      'auto-resize-textarea.tsx:useLayoutEffect',
      'layoutEffect-value-change',
      {
        valueType: typeof props.value,
        valueLen: typeof props.value === 'string' ? props.value.length : null,
      },
      'H3',
      'pre-fix'
    );
    // #endregion
    adjustHeight();
  }, [adjustHeight, props.value]);

  return (
    <Textarea
      ref={mergedRef}
      {...props}
      rows={1}
      onChange={(e) => {
        // #region agent log (H1/H3)
        debugLog(
          'auto-resize-textarea.tsx:onChange',
          'onChange',
          {
            hasFocus: document.activeElement === innerRef.current,
            inputType:
              (e.nativeEvent as InputEvent | undefined)?.inputType ?? null,
            valueLen: e.target.value.length,
            winScrollY: typeof window !== 'undefined' ? window.scrollY : null,
          },
          'H1',
          'pre-fix'
        );
        // #endregion
        onChange?.(e);
      }}
      style={{
        minHeight: `${minRowsProp * 1.5}rem`,
        ...style,
      }}
      className={cn(
        'resize-none overflow-hidden scroll-mb-24 md:scroll-mb-32',
        className
      )}
    />
  );
});
AutoResizeTextarea.displayName = 'AutoResizeTextarea';
