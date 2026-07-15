import type { ReactElement } from 'react'
import { isUntitledNotePath, type GraphInfo } from '@reflect/core'
import { ListChecks, MessageSquare } from 'lucide-react'
import { AudioMemoButton } from '@/components/audio-memo/audio-memo-button'
import { ListIcon } from '@/components/icons/list-icon'
import { PencilIcon } from '@/components/icons/pencil-icon'
import { usePinnedNotes } from '@/hooks/use-pinned-notes'
import { keybindingFor } from '@/lib/commands/app-commands'
import { runCommand } from '@/lib/commands/registry'
import { useToday } from '@/lib/use-today'
import type { CommandContext } from '@/lib/commands/types'
import { hasMacosTitleBarOverlay } from '@/lib/window-chrome'
import { cn } from '@/lib/utils'
import { notePathForRoute } from '@/routing/route'
import { useRouter } from '@/routing/router'
import { GraphFooter } from './graph-footer'
import { NavigateArrows } from './navigate-arrows'
import { SidebarItem } from './sidebar-item'
import { SidebarPinned } from './sidebar-pinned'
import { SidebarSearch } from './sidebar-search'

interface SidebarProps {
  graph: GraphInfo
  /** Commands run with this — the same context the palette/shortcuts use. */
  context: CommandContext
}

/**
 * The workspace sidebar, in the original app's shape: history arrows top
 * right, search, primary navigation with hover-revealed shortcut keycaps, the
 * Pinned shelf, and the graph switcher footer. Most nav rows run registered
 * commands so a binding and its behavior stay one definition; the Daily notes
 * row is a capture gesture like `Mod-D` — it asks the stream to focus today
 * with the caret at the end, ready to append. (Sidebar collapse stays on
 * `Mod-\` via the command registry.)
 */
export function Sidebar({ graph, context }: SidebarProps): ReactElement {
  const { route } = useRouter()
  const today = useToday()
  const pinned = usePinnedNotes()
  const currentNotePath = notePathForRoute(route, today)
  const hasActivePinnedNote =
    currentNotePath !== null && pinned.some((note) => note.path === currentNotePath)

  // Wrap the 16px Lucide glyphs in the custom icons' 24px box so nav rows
  // share one icon footprint.
  const lucideBox = 'flex size-6 shrink-0 items-center justify-center'

  return (
    <div
      className={cn(
        'flex h-full min-h-0 flex-col',
        // With the overlaid macOS title bar, the traffic lights and the
        // WindowDragRegion strip own the top 28px — start content below them.
        hasMacosTitleBarOverlay ? 'pt-2' : 'pt-2.5',
      )}
    >
      <div className="flex flex-none items-center justify-end px-2 pt-1">
        <NavigateArrows />
      </div>

      <div className="flex flex-none flex-col">
        <div className="mt-1 flex items-center gap-1.5 px-4">
          <div className="min-w-0 flex-1">
            <SidebarSearch onOpen={() => context.openPalette()} />
          </div>
          <AudioMemoButton />
        </div>

        {/* A query container so each row can drop its shortcut hint once the
            sidebar is dragged too narrow to hold label and hint at once. */}
        <nav aria-label="Principal" className="mt-6 space-y-1 px-4 @container">
          <SidebarItem
            icon={
              <span className={lucideBox}>
                <MessageSquare aria-hidden strokeWidth={1.75} className="size-4" />
              </span>
            }
            label="Chat"
            binding={keybindingFor('chat.open') ?? undefined}
            active={route.kind === 'chat'}
            onClick={() => void runCommand('chat.open', context)}
          />
          <SidebarItem
            icon={
              <span className={lucideBox}>
                <ListChecks aria-hidden strokeWidth={1.75} className="size-4" />
              </span>
            }
            label="Tareas"
            binding={keybindingFor('nav.tasks') ?? undefined}
            active={route.kind === 'tasks'}
            onClick={() => void runCommand('nav.tasks', context)}
          />
          <SidebarItem
            icon={<PencilIcon className="shrink-0" />}
            label="Notas diarias"
            binding={keybindingFor('nav.today') ?? undefined}
            active={(route.kind === 'today' || route.kind === 'daily') && !hasActivePinnedNote}
            onClick={() => void runCommand('nav.today', context)}
          />

          {/* The rows above are the day-to-day surfaces; the collection below is
              where you go looking. The rule carries the gap on padding, so the
              nav's `space-y-1` can't collapse it unevenly. */}
          <div className="py-2">
            <hr className="border-border" />
          </div>

          <SidebarItem
            icon={<ListIcon className="shrink-0" />}
            label="Todas las notas"
            binding={keybindingFor('nav.allNotes') ?? undefined}
            // A named note lives in the All Notes collection, so keep this row
            // lit while editing one. An untitled placeholder hasn't earned its
            // way in yet — nothing lights for it, the same as before this row
            // outlived the "New note" row that used to own that highlight.
            active={
              route.kind === 'allNotes' ||
              (route.kind === 'note' && !isUntitledNotePath(route.path) && !hasActivePinnedNote)
            }
            onClick={() => void runCommand('nav.allNotes', context)}
          />
        </nav>
      </div>

      <div className="mt-1 min-h-0 flex-1 overflow-y-auto pb-2">
        <SidebarPinned />
      </div>

      <GraphFooter graph={graph} context={context} />
    </div>
  )
}
