import { useEffect } from 'react'
import { useEditor } from '@meowdown/react'

/**
 * Re-anchor meowdown's virtual caret when layout shifts around the editor.
 *
 * meowdown re-measures its caret on `selectionchange`, editor updates, and a
 * ResizeObserver on the editor element itself. That leaves one gap: content
 * ABOVE the editor in the same flow changing height after the caret painted —
 * the suggested-contact card mounting a beat after a note opens, an image
 * loading in another day's pane, a conflict banner appearing. The text shifts,
 * the editor's own size doesn't, none of meowdown's triggers fire, and the
 * caret stays painted where the text used to be (the "giant caret at the top"
 * bug).
 *
 * This watch observes the editor's ancestors instead: any of them resizing
 * means the flow moved, so it dispatches a synthetic `selectionchange` — the
 * hook meowdown already listens to. The re-measure is cheap and equality-
 * gated inside meowdown, so redundant nudges repaint nothing.
 */

let nudging = false

/**
 * True while a synthetic re-measure `selectionchange` (ours) is dispatching.
 * Listeners that treat a user's selection move as intent (the selection
 * toolbar's Escape-dismiss reset) check this to ignore the nudge.
 */
export function isCaretMeasureNudge(): boolean {
  return nudging
}

/** Fire the re-measure hook meowdown listens to, marked as a nudge. */
export function dispatchCaretMeasureNudge(target: Document): void {
  nudging = true
  try {
    target.dispatchEvent(new Event('selectionchange'))
  } finally {
    nudging = false
  }
}

export function CaretPositionWatch(): null {
  const editor = useEditor()

  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') {
      return
    }
    let frame: number | null = null
    let observer: ResizeObserver | null = null

    // Same mount dance as FormattingToolbarBridge: ProseKit attaches the view
    // via ref before effects run, but the timing is ProseKit's.
    const attach = (): void => {
      if (!editor.mounted) {
        frame = requestAnimationFrame(attach)
        return
      }
      frame = null
      const dom = editor.view.dom
      const ownerDocument = dom.ownerDocument
      observer = new ResizeObserver(() => {
        dispatchCaretMeasureNudge(ownerDocument)
      })
      // The chain from the editor to the body covers every container whose
      // growth can move the editor's text: the pane (alerts and cards above
      // the editor), the note column, the scroll content (sibling panes in
      // the daily stream). Bounded depth — a handful of elements per pane.
      for (
        let element = dom.parentElement;
        element !== null && element !== ownerDocument.body;
        element = element.parentElement
      ) {
        observer.observe(element)
      }
    }
    attach()
    return () => {
      if (frame !== null) {
        cancelAnimationFrame(frame)
      }
      observer?.disconnect()
    }
  }, [editor])

  return null
}
