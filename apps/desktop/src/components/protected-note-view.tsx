import type { ReactElement } from 'react'
import { InlineAlert } from '@/components/inline-alert'

interface ProtectedNoteViewProps {
  /** The full file content (frontmatter included — honest display). */
  content: string
}

/**
 * The read-only fallback for a note the editor can't faithfully round-trip
 * (a converter gap, e.g. task lists): the file is shown verbatim and never
 * auto-rewritten, so no content can be silently lost (Plan 05's data-loss
 * gate).
 */
export function ProtectedNoteView({ content }: ProtectedNoteViewProps): ReactElement {
  return (
    <div>
      <InlineAlert className="mb-4">
        Esta nota tiene un formato que el editor aún no reproduce fielmente, así que se
        muestra en solo lectura para no alterar el archivo.
      </InlineAlert>
      <pre className="reflect-protected-note whitespace-pre-wrap text-sm leading-relaxed">
        {content}
      </pre>
    </div>
  )
}
