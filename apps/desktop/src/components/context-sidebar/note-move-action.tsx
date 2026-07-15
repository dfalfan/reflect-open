import { useState, type ReactElement } from 'react'
import {
  errorMessage,
  NOTE_SECTIONS,
  sectionOfPath,
  sectionPathForNote,
  type NoteSection,
} from '@reflect/core'
import { Briefcase, Inbox, User, type LucideIcon } from 'lucide-react'
import { moveNoteCarryingSession } from '@/editor/move-note'
import { startOperation } from '@/lib/operations'
import { invalidateIndexQueries } from '@/lib/query-client'
import { useGraph } from '@/providers/graph-provider'

interface NoteMoveActionProps {
  /** Graph-relative path of the note to file into another section. */
  path: string
}

const SECTION_LABELS: Record<NoteSection, string> = {
  inbox: 'Inbox',
  personal: 'Personal',
  trabajo: 'Trabajo',
}
const SECTION_ICONS: Record<NoteSection, LucideIcon> = {
  inbox: Inbox,
  personal: User,
  trabajo: Briefcase,
}

/**
 * "Mover a <sección>" — one row per section the note is NOT in. Filing is a
 * file move under the hood (`moveNoteCarryingSession`), so a live editor
 * session, the route, and back/forward history all follow the note; the
 * collision suffix comes from the same probe the rename pipeline uses.
 * Renders nothing for paths without a section (dailies, templates) — those
 * are not fileable.
 */
export function NoteMoveAction({ path }: NoteMoveActionProps): ReactElement | null {
  const { graph } = useGraph()
  const [moving, setMoving] = useState(false)
  const currentSection = sectionOfPath(path)

  if (currentSection === null) {
    return null
  }

  const moveTo = async (section: NoteSection): Promise<void> => {
    const generation = graph?.generation
    if (generation === undefined || moving) {
      return
    }
    const operation = startOperation(`Moviendo a ${SECTION_LABELS[section]}`)
    setMoving(true)
    try {
      const target = await sectionPathForNote(path, section)
      if (target !== path) {
        await moveNoteCarryingSession(path, target, generation)
        // The watcher echo reconciles eventually; invalidating now makes the
        // section lists and the sidebar highlight follow the move instantly.
        invalidateIndexQueries()
      }
      operation.done()
    } catch (cause) {
      operation.fail(errorMessage(cause))
    } finally {
      setMoving(false)
    }
  }

  return (
    <>
      {NOTE_SECTIONS.filter((section) => section !== currentSection).map((section) => {
        const SectionIcon = SECTION_ICONS[section]
        return (
          <button
            key={section}
            type="button"
            disabled={moving}
            onClick={() => void moveTo(section)}
            className="group relative flex w-full items-center space-x-2 rounded-lg px-3 py-2 text-start transition-colors duration-100 hover:bg-surface-hover disabled:pointer-events-none disabled:opacity-50"
          >
            <span className="flex h-5 w-5 flex-none items-center justify-center text-text-muted">
              <SectionIcon size={14} aria-hidden />
            </span>
            <span className="min-w-0 flex-1 truncate text-xs font-medium">
              Mover a {SECTION_LABELS[section]}
            </span>
          </button>
        )
      })}
    </>
  )
}
