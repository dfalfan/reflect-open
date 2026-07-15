import type { ReactElement, ReactNode } from 'react'
import { NotePane } from '@/components/note-pane'
import { cn } from '@/lib/utils'
import { useSettings } from '@/providers/settings-provider'
import { ScrollRestored } from '@/routing/scroll-restore'

interface SingleNoteViewProps {
  /** Graph-relative path of the note filling this view. */
  path: string
  /**
   * The day this pane shows, when the note is a daily — forwarded to
   * {@link NotePane} so daily behavior (day-keyed handles) holds outside the
   * stream.
   */
  dailyDate?: string
  /**
   * Chrome rendered above the pane inside the scrolling column — the note
   * window's day label, standing in for the title a daily doesn't carry.
   */
  heading?: ReactNode
}

/**
 * One note filling the viewport: the note route's layout, shared with the
 * secondary note window (which renders dailies this way too). The note is a
 * sheet floating on the gutter, the same shape the daily stream gives every
 * day — there each day is a sheet, here there is only ever one.
 *
 * The gutter is the scroll container's padding, so the sheet's `min-h-full`
 * resolves against the already-padded box: sheet plus gutter is exactly one
 * viewport, nothing overflows, and the flex chain still stretches the editor
 * over any leftover space. With `paperSheets` off the padding moves back to the
 * inner column and the same arithmetic holds, minus the gutter. The reading
 * gutter is the editor's own padding, so clicking anywhere in the note body
 * focuses it.
 */
export function SingleNoteView({ path, dailyDate, heading }: SingleNoteViewProps): ReactElement {
  const { settings } = useSettings()
  const sheets = settings.paperSheets
  return (
    <ScrollRestored
      className={cn('h-full overflow-auto', sheets ? 'bg-surface-gutter px-4 py-6' : 'px-0')}
    >
      <div
        className={cn(
          'mx-auto flex min-h-full w-full max-w-full flex-col pt-24 pb-8',
          sheets && 'rounded-lg bg-surface shadow-md',
        )}
      >
        {heading}
        <NotePane
          path={path}
          {...(dailyDate !== undefined ? { dailyDate } : {})}
          lazy
          autoFocus
          className="flex grow flex-col"
          gutterClassName="reflect-content-gutter"
          editorClassName="grow"
        />
      </div>
    </ScrollRestored>
  )
}
