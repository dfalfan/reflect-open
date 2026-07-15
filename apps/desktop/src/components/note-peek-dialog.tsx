import { useState, type ReactElement } from 'react'
import { Maximize2 } from 'lucide-react'
import { NotePane } from '@/components/note-pane'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'

interface NotePeekDialogProps {
  /** Graph-relative path of the peeked note; `null` renders the dialog closed. */
  path: string | null
  /** The dialog asked to close (Esc, the backdrop, or the × button). */
  onClose: () => void
  /** The expand button: leave the peek and open the note as a full view. */
  onExpand: (path: string) => void
}

/**
 * A Notion-style peek: the full editable note — the same {@link NotePane} the
 * note route mounts — floating in a centered dialog over the surface that
 * opened it, so a note can be read or edited without leaving the list. The
 * expand button hands the note to its real route; closing lands back on the
 * list untouched.
 *
 * The pane mounts without `autoFocus`: Radix moves focus into the dialog on
 * open, and letting the editor grab it too would measure the caret against
 * the still-zooming layout.
 */
export function NotePeekDialog({ path, onClose, onExpand }: NotePeekDialogProps): ReactElement {
  // The last real path, kept through the exit animation so the note doesn't
  // blank out during the dialog's closing fade (`path` goes null before Radix
  // unmounts the content).
  const [shownPath, setShownPath] = useState(path)
  if (path !== null && path !== shownPath) {
    setShownPath(path)
  }

  return (
    <Dialog
      open={path !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
    >
      <DialogContent
        aria-describedby={undefined}
        className="flex h-[85vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl"
      >
        {shownPath !== null ? (
          <>
            <DialogTitle className="sr-only">Vista previa de la nota</DialogTitle>
            <header className="flex flex-none items-center px-2.5 pt-2.5">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Abrir en la vista completa"
                onClick={() => onExpand(shownPath)}
              >
                <Maximize2 aria-hidden />
              </Button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="flex min-h-full flex-col pt-4 pb-10">
                <NotePane
                  key={shownPath}
                  path={shownPath}
                  className="flex grow flex-col"
                  gutterClassName="reflect-content-gutter"
                  editorClassName="grow"
                />
              </div>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
