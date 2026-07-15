import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactElement,
} from 'react'
import { Virtualizer, type VirtualizerHandle } from 'virtua'
import { dailyPath } from '@reflect/core'
import { NotePane } from '@/components/note-pane'
import type { NoteEditorHandle } from '@/editor/note-editor'
import { formatDayLabel, todayIso } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { useSettings } from '@/providers/settings-provider'
import { useToday } from '@/lib/use-today'
import { createDayWindow, dateAtIndex, indexOfDate, neighborDate } from '@/lib/day-window'
import { useSetFocusedDailyDate } from '@/providers/focused-daily-provider'
import { useRouter } from '@/routing/router'

interface DailyStreamProps {
  /** The day to anchor/scroll to, or the live local day for the `today` route. */
  target: { kind: 'today' } | { kind: 'date'; date: string }
}

/**
 * The reading gutter (`.reflect-content-gutter` in styles/index.css): the old
 * scroll-container `px-6` and centered `max-w-2xl` column folded into one
 * `padding-inline` applied *inside* an element instead of around it. The element
 * spans the pane's full width with its content in a centered column, so the side
 * gutters belong to the element: clicking anywhere across a daily row focuses that
 * day's note. The normal-note editor reuses the same class (route-content.tsx) so a
 * click anywhere in the note body, even the blank margin, still hits the editor.
 *
 * An ordinary class, not a `px-*` utility: on the editor it must out-cascade the
 * un-layered `.reflect-editor` padding reset, which every `@layer utilities` rule
 * loses to regardless of order.
 */
const CONTENT_GUTTER = 'reflect-content-gutter'

/** The size guess virtua uses for a row it has not measured yet. */
export const ESTIMATED_DAY_HEIGHT = 220

/**
 * Renders `render()` — a render-prop seam. The single-day view's row reads the
 * `focusPending` ref, which the stream reads only inside the Virtualizer's child
 * callback (a deferred scope). Calling the same row builder directly in render
 * would read a ref during render; routing it through this opaque prop keeps the
 * read in a callback, matching the stream's shape.
 */
function DeferredRow({ render }: { render: () => ReactElement }): ReactElement {
  return render()
}

/**
 * The daily stream (Plan 06b): a virtualized chronological run of days — past
 * above, future below — where **every day is a virtual note**. Each visible row
 * mounts the Plan 05 editor lazily (`createIfMissing`), so a day only becomes a
 * real `daily/*.md` when edited. Offscreen rows unmount and flush through the
 * save pipeline's final-flush path. The window is a fixed ±range around today
 * (virtual rows are free), so there is no bidirectional infinite-scroll
 * bookkeeping; index↔date is pure offset math.
 */
export function DailyStream({ target }: DailyStreamProps): ReactElement {
  const { arrivalSeq, arrivalFocusEditor, entryId, saveScrollState, savedScroll } = useRouter()
  const virtualizerRef = useRef<VirtualizerHandle>(null)
  // The window anchors at today-on-mount and stays stable for the view's life.
  // (`dayWindow`, not `window` — shadowing the DOM global here was a footgun.)
  const [dayWindow] = useState(() => createDayWindow(todayIso()))
  // Per-row data is unused (the date is derived from the index); a stable array
  // of the window's length just tells virtua how many rows exist.
  const data = useMemo(() => Array.from({ length: dayWindow.count }), [dayWindow.count])
  const today = useToday()
  const targetDate = target.kind === 'today' ? today : target.date
  const { settings } = useSettings()

  // targetDate is read at arrival time, not reacted to. On the `today` route
  // it follows this component's live clock — the same value that paints the
  // today highlight — but midnight drift alone is not a navigation. The next
  // real arrival (⌘D, a link) reads the fresh value and anchors to the new day.
  const targetDateRef = useRef(targetDate)
  useLayoutEffect(() => {
    targetDateRef.current = targetDate
  }, [targetDate])

  // Mirrored like targetDate: the focus request belongs to the arrival that
  // bumped `arrivalSeq`, so the anchor effect reads it through a ref instead
  // of depending on it — a later flag clear without an arrival (a no-op ⌘[
  // at the bottom of the stack) must not re-anchor a stream nobody navigated.
  const arrivalFocusEditorRef = useRef(arrivalFocusEditor)
  useLayoutEffect(() => {
    arrivalFocusEditorRef.current = arrivalFocusEditor
  }, [arrivalFocusEditor])

  // Only the day navigated to receives focus, once per navigation — a row that
  // scrolls offscreen and back must not steal focus from wherever the user is.
  // The entry also carries where the caret lands: capture arrivals (⌘D, the
  // sidebar's Daily notes row — the router's `arrivalFocusEditor`) append at
  // the end of the day's content, every other arrival keeps the note start.
  // The slot is consumed when the editor actually mounts and focuses (not at
  // render time), so a virtualizer re-render before the lazy load completes
  // can't drop the focus.
  const focusPending = useRef<{ date: string; selection: 'start' | 'end' } | null>(null)
  const consumeFocus = useCallback(() => {
    focusPending.current = null
  }, [])

  // Single-day mode has no virtualizer, so the anchor effect's `scrollToIndex`
  // (which, in stream mode, forces virtua to re-render the target row and pick
  // up the freshly-set `focusPending`) no-ops. This forces the one re-render
  // that lets the rendered day read `focusPending.current` after the effect.
  const [, bumpFocusRender] = useReducer((tick: number) => tick + 1, 0)

  // Report the day the user is editing to the context sidebar: the route stays
  // on the day navigated to, but focus moves freely between stream rows, and the
  // sidebar's note actions / published link must describe the focused day.
  const setFocusedDailyDate = useSetFocusedDailyDate()

  // Cross-note arrow navigation (ArrowUp at the top of a day -> end of the
  // previous day; ArrowDown at the bottom -> start of the next day). The stream
  // is virtualized, so the neighbor day's editor may not be mounted: we keep a
  // registry of mounted day handles plus a single pending-focus slot that
  // carries the target caret position, applied when the neighbor row mounts and
  // registers. This is independent of the `⌘D` autofocus path (`focusPending`).
  const dayHandlesRef = useRef(new Map<string, NoteEditorHandle>())
  const pendingFocusRef = useRef<{ date: string; position: 'start' | 'end' } | null>(null)

  const focusDay = useCallback((handle: NoteEditorHandle, position: 'start' | 'end') => {
    handle.focus()
    // meowdown's setSelection also scrolls the caret into view.
    handle.setSelection(position)
  }, [])

  const registerHandle = useCallback(
    (date: string, handle: NoteEditorHandle | null) => {
      if (handle === null) {
        dayHandlesRef.current.delete(date)
        return
      }
      dayHandlesRef.current.set(date, handle)
      const pending = pendingFocusRef.current
      if (pending?.date === date) {
        pendingFocusRef.current = null
        focusDay(handle, pending.position)
      }
    },
    [focusDay],
  )

  const handleExitBoundary = useCallback(
    (date: string, direction: 'up' | 'down'): boolean => {
      const target = neighborDate(dayWindow, date, direction === 'up' ? -1 : 1)
      if (target === null) {
        // Window edge: no neighbor — hand the key back so the editor no-ops.
        return false
      }
      const position: 'start' | 'end' = direction === 'up' ? 'end' : 'start'
      const mounted = dayHandlesRef.current.get(target)
      if (mounted) {
        focusDay(mounted, position)
        return true
      }
      // The neighbor is virtualized away: queue the focus, then scroll its row
      // into the rendered range so it mounts and `registerHandle` applies it.
      pendingFocusRef.current = { date: target, position }
      virtualizerRef.current?.scrollToIndex(indexOfDate(dayWindow, target), {
        align: direction === 'up' ? 'end' : 'start',
      })
      return true
    },
    [dayWindow, focusDay],
  )

  // Re-anchor on every explicit arrival (`arrivalSeq` bumps even when ⌘D is
  // pressed while already on today — the router clears the entry's saved
  // offset for that case; `entryId` covers back/forward between entries whose
  // routes resolve to the same day). A back/forward-restored entry carries its
  // offset; a fresh navigation anchors to the target day.
  //
  // A layout effect, not a passive one: virtua applies an imperative scroll in a
  // pre-paint microtask, so anchoring here pins the target day to the viewport
  // top before the first frame is shown, instead of painting the top of the
  // five-year window and then lurching down.
  useLayoutEffect(() => {
    const restored = savedScroll()
    if (restored !== null) {
      // A restored arrival also cancels any focus still pending from a prior
      // navigation the user backed out of before that day's editor mounted (both
      // the ⌘D autofocus and a queued cross-note boundary focus). The day would
      // otherwise steal focus when its row scrolls into view.
      focusPending.current = null
      pendingFocusRef.current = null
      virtualizerRef.current?.scrollTo(restored)
      return
    }
    const target = targetDateRef.current
    pendingFocusRef.current = null
    focusPending.current = {
      date: target,
      selection: arrivalFocusEditorRef.current ? 'end' : 'start',
    }
    virtualizerRef.current?.scrollToIndex(indexOfDate(dayWindow, target), { align: 'start' })
    // Single-day mode: no scroll to trigger virtua's re-render, so the just-set
    // focus needs a render of its own to take effect (a no-op extra render in
    // stream mode, where virtua already re-renders on the scroll above).
    bumpFocusRender()
  }, [arrivalSeq, entryId, dayWindow, savedScroll])

  // Turning `dailyStreamTodayOnly` off is not a router arrival, so the anchor
  // effect above doesn't fire — and React reuses the scroll container's DOM node
  // across the single-day↔stream swap, so the freshly-mounted virtualizer would
  // inherit the single-day scroll position (leaving today off-screen, future
  // days on top). Re-pin the target day (today, with past days above) whenever
  // the stream reappears from single-day mode. Not on the reverse transition:
  // the single-day view has no virtualizer, and `scrollToIndex` there no-ops.
  const wasTodayOnly = useRef(settings.dailyStreamTodayOnly)
  useLayoutEffect(() => {
    const leftSingleDay = wasTodayOnly.current && !settings.dailyStreamTodayOnly
    wasTodayOnly.current = settings.dailyStreamTodayOnly
    if (leftSingleDay) {
      virtualizerRef.current?.scrollToIndex(indexOfDate(dayWindow, targetDateRef.current), {
        align: 'start',
      })
    }
  }, [settings.dailyStreamTodayOnly, dayWindow])

  const sheets = settings.paperSheets

  // One daily row — the date subject plus its lazy editor. Shared by the
  // virtualized stream and the single-day view so both render an identical day;
  // `index` is virtua's measurement key (omitted in single-day mode, which has
  // no virtualizer). Cross-day arrow navigation still registers its handle, but
  // in single-day mode `handleExitBoundary` finds no mounted neighbor and the
  // key no-ops at the window edge — exactly the "no other days" intent.
  const renderDay = (date: string, index?: number): ReactElement => {
    const isToday = date === today
    // V1's daily-note sizing: past days hug their content (an empty day
    // collapses to a short row), while today and future days reserve most of a
    // viewport of writing room. ISO dates compare lexically.
    const isPast = date < today
    const pendingFocus = focusPending.current
    const focusSelection =
      pendingFocus !== null && pendingFocus.date === date ? pendingFocus.selection : null
    const autoFocus = focusSelection !== null
    return (
      // With sheets on, the row is the gutter around its sheet rather than the
      // sheet itself, and the void between days is what separates them. The gap
      // rides on padding, not a margin, so the virtualizer measures it as part
      // of the item; top-only, so the space above the first sheet and the space
      // between any two are the same 24px. With sheets off, the row is the day
      // itself again and a hairline rule does the separating.
      <section
        key={date}
        data-index={index}
        className={cn(sheets ? 'px-4 pt-6' : 'border-b border-border pt-24 pb-6')}
        // Focus entering this row (clicking its editor, tabbing in) makes it the
        // day the sidebar describes.
        onFocusCapture={() => setFocusedDailyDate(date)}
      >
        <div className={cn(sheets && 'rounded-lg bg-surface pt-24 pb-6 shadow-md')}>
          {/* V1 renders the date as the note's H1-sized subject, with today's
              tinted brand (its `highlightSubject`). */}
          <h2 className={cn('reflect-daily-subject mb-3', CONTENT_GUTTER, isToday && 'text-accent')}>
            {formatDayLabel(date, settings.dateFormat)}
          </h2>
          <NotePane
            path={dailyPath(date)}
            dailyDate={date}
            registerHandle={registerHandle}
            onExitBoundary={handleExitBoundary}
            lazy
            autoFocus={autoFocus}
            autoFocusSelection={focusSelection ?? 'start'}
            onAutoFocused={consumeFocus}
            gutterClassName={CONTENT_GUTTER}
            editorClassName={isPast ? 'min-h-[100px]' : 'min-h-[60vh]'}
          />
        </div>
      </section>
    )
  }

  // Single-day mode (settings.dailyStreamTodayOnly): show only the day the user
  // opened — no stream, no neighbor days, no virtualizer. `targetDate` is today
  // on the `today` route and follows a calendar/link navigation otherwise.
  if (settings.dailyStreamTodayOnly) {
    return (
      <div
        data-testid="daily-stream"
        className={cn('h-full overflow-auto', sheets && 'bg-surface-gutter')}
        onScroll={(event) => saveScrollState(event.currentTarget.scrollTop)}
        onPointerDownCapture={() => {
          focusPending.current = null
          pendingFocusRef.current = null
        }}
      >
        <DeferredRow render={() => renderDay(targetDate)} />
        {/* Trailing room so a short day isn't pinned to the viewport bottom */}
        <div aria-hidden className="h-60" />
      </div>
    )
  }

  return (
    <div
      data-testid="daily-stream"
      className={cn('h-full overflow-auto', sheets && 'bg-surface-gutter')}
      onScroll={(event) => saveScrollState(event.currentTarget.scrollTop)}
      // An explicit click/touch picks its own focus target — a focus still
      // pending for a day whose editor hasn't mounted yet must not steal the
      // caret later. Typing is deliberately not a cancel: ⌘D-then-type should
      // still land focus in today once its editor mounts.
      onPointerDownCapture={() => {
        focusPending.current = null
        pendingFocusRef.current = null
      }}
    >
      <Virtualizer
        ref={virtualizerRef}
        data={data}
        itemSize={ESTIMATED_DAY_HEIGHT}
        bufferSize={2 * ESTIMATED_DAY_HEIGHT}
        shift={true}
      >
        {(_, index) => renderDay(dateAtIndex(dayWindow, index), index)}
      </Virtualizer>
      {/* Trailing room so the last day isn't pinned to the viewport bottom */}
      <div aria-hidden className="h-60" />
    </div>
  )
}
