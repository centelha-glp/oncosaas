'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

type ClinicalNoteMarkdownBodyProps = {
  markdown: string;
  className?: string;
};

/**
 * Renderização segura de Markdown (react-markdown não usa dangerouslySetInnerHTML para texto).
 */
export function ClinicalNoteMarkdownBody({
  markdown,
  className,
}: ClinicalNoteMarkdownBodyProps): React.ReactElement {
  return (
    <div
      className={cn(
        'clinical-note-md text-sm leading-relaxed text-foreground',
        '[&_h1]:text-lg [&_h1]:font-semibold [&_h1]:mt-4 [&_h1]:mb-2',
        '[&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-4 [&_h2]:mb-2',
        '[&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1',
        '[&_p]:mb-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5',
        '[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5',
        '[&_li]:mb-1 [&_hr]:my-4 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1',
        '[&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:text-xs',
        '[&_blockquote]:border-l-4 [&_blockquote]:border-muted-foreground/40 [&_blockquote]:pl-3 [&_blockquote]:italic',
        '[&_a]:text-primary [&_a]:underline',
        className
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown || ''}</ReactMarkdown>
    </div>
  );
}
