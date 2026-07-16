import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
} from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Sparkles, Type } from 'lucide-react'
import {
  getPendingReplacement,
  getVirtualElementFromRange,
  type EditorExtension,
} from '@meowdown/core'
import { useEditor } from '@meowdown/react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { isCaretMeasureNudge } from '@/editor/caret-position-watch'
import {
  BLOCKS,
  FORMATS,
  readActiveBlock,
  type BlockId,
  type FormatCommand,
} from '@/editor/selection-toolbar-items'
import { isTouchEditorSurface } from '@/lib/platform-surface'
import { cn } from '@/lib/utils'

interface FormatState {
  active: boolean
  enabled: boolean
}

interface ToolbarSnapshot {
  /** Viewport rect of the selection (meowdown's virtual element). */
  anchor: { left: number; top: number; bottom: number; width: number }
  /** Per-format flags, in {@link FORMATS} order. */
  formats: FormatState[]
  /** The selection's block identity (the convert trigger's icon + checkmark). */
  block: BlockId
  /** Per-entry enablement, in {@link BLOCKS} order. */
  blockEnabled: boolean[]
}

function snapshotsEqual(left: ToolbarSnapshot, right: ToolbarSnapshot): boolean {
  return (
    left.anchor.left === right.anchor.left &&
    left.anchor.top === right.anchor.top &&
    left.anchor.bottom === right.anchor.bottom &&
    left.anchor.width === right.anchor.width &&
    left.block === right.block &&
    left.formats.every(
      (format, index) =>
        format.active === right.formats[index]?.active &&
        format.enabled === right.formats[index]?.enabled,
    ) &&
    left.blockEnabled.every((enabled, index) => enabled === right.blockEnabled[index])
  )
}

/** Gap between the selection and the toolbar, and the viewport safety margin. */
const ANCHOR_GAP = 8
const VIEWPORT_MARGIN = 8

interface SelectionToolbarProps {
  /**
   * Open the selection AI menu (the second section's button). Omitted on
   * private notes, where the selection must have no AI entry point — the
   * section is not rendered at all.
   */
  onAiRequest?: () => void
}

/**
 * The floating format toolbar over a text selection (Notion-style): a
 * turn-into dropdown (headings, lists, quote, code block), the markdown
 * inline marks as a button row, and — when AI is available — a sparkle
 * section below that opens the existing selection AI menu. Replaces
 * meowdown's sparkle affordance on desktop (`NotePane` turns
 * `selectionMenuAffordance` off where it mounts this).
 *
 * Mounted inside the editor's ProseKit context like `FormattingToolbarBridge`,
 * and a no-op on the touch surface, where native selection handles own this
 * space. Same listener-driven shape as the bridge — `useEditor({ update })`
 * is incompatible with the React Compiler — recomputing on `selectionchange`,
 * focus changes, and scroll. Hidden while drag-selecting (it appears on
 * pointer-up, like Notion), while a pending AI replacement is staged, and
 * after Escape until the selection changes. While the turn-into menu holds
 * focus the toolbar stays put; closing it hands focus back to the editor.
 */
export function SelectionToolbar({ onAiRequest }: SelectionToolbarProps): ReactElement | null {
  const editor = useEditor<EditorExtension>()
  const [snapshot, setSnapshot] = useState<ToolbarSnapshot | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const draggingRef = useRef(false)
  const suppressedRef = useRef(false)
  const menuOpenRef = useRef(false)
  const refreshRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (isTouchEditorSurface()) {
      return
    }
    let frame: number | null = null
    let teardown: (() => void) | null = null

    // Same mount dance as FormattingToolbarBridge: ProseKit attaches the view
    // via ref before effects run, but the timing is ProseKit's.
    const attach = (): void => {
      if (!editor.mounted) {
        frame = requestAnimationFrame(attach)
        return
      }
      frame = null
      const dom = editor.view.dom

      function compute(): void {
        // The turn-into menu owns focus while open; hold the toolbar still
        // instead of reacting to the editor's transient blur.
        if (menuOpenRef.current) {
          return
        }
        if (!editor.mounted || !editor.focused || draggingRef.current || suppressedRef.current) {
          setSnapshot(null)
          return
        }
        const view = editor.view
        const state = view.state
        const selection = state.selection
        // Node selections (an image, an embed) get meowdown's own chrome; the
        // format marks are for text. A staged AI replacement owns the range.
        if (selection.empty || 'node' in selection || getPendingReplacement(state) !== null) {
          setSnapshot(null)
          return
        }
        const rect = getVirtualElementFromRange(view, {
          from: selection.from,
          to: selection.to,
        }).getBoundingClientRect()
        const formats = FORMATS.map((format) => {
          const type = state.schema.marks[format.mark]
          return {
            active:
              type !== undefined && state.doc.rangeHasMark(selection.from, selection.to, type),
            enabled: editor.commands[format.command].canExec(),
          }
        })
        const blockEnabled = BLOCKS.map((spec) => {
          switch (spec.id) {
            case 'text':
              return true
            case 'h1':
              return editor.commands.toggleHeading.canExec({ level: 1 })
            case 'h2':
              return editor.commands.toggleHeading.canExec({ level: 2 })
            case 'h3':
              return editor.commands.toggleHeading.canExec({ level: 3 })
            case 'bullet':
              return editor.commands.toggleList.canExec({ kind: 'bullet' })
            case 'ordered':
              return editor.commands.toggleList.canExec({ kind: 'ordered' })
            case 'task':
              return editor.commands.wrapInSquareTask.canExec()
            case 'quote':
              return editor.commands.toggleBlockquote.canExec()
            case 'code':
              return editor.commands.toggleCodeBlock.canExec()
          }
        })
        const next: ToolbarSnapshot = {
          anchor: { left: rect.left, top: rect.top, bottom: rect.bottom, width: rect.width },
          formats,
          block: readActiveBlock(selection.$from).block,
          blockEnabled,
        }
        setSnapshot((previous) =>
          previous !== null && snapshotsEqual(previous, next) ? previous : next,
        )
      }
      refreshRef.current = compute

      function handleSelectionChange(): void {
        // A caret-measure nudge is a layout event, not the user moving the
        // selection — it must not undo an Escape dismissal.
        if (!isCaretMeasureNudge()) {
          suppressedRef.current = false
        }
        compute()
      }
      function handlePointerDown(): void {
        draggingRef.current = true
        compute()
      }
      function handlePointerUp(): void {
        if (!draggingRef.current) {
          return
        }
        draggingRef.current = false
        compute()
      }
      function handleKeyDown(event: KeyboardEvent): void {
        if (event.key === 'Escape' && !suppressedRef.current) {
          suppressedRef.current = true
          compute()
        }
      }

      dom.addEventListener('focusin', compute)
      dom.addEventListener('focusout', compute)
      dom.addEventListener('pointerdown', handlePointerDown)
      dom.addEventListener('keydown', handleKeyDown)
      // The pointer can be released outside the editor mid-drag.
      window.addEventListener('pointerup', handlePointerUp)
      document.addEventListener('selectionchange', handleSelectionChange)
      // Any scroll container between the editor and the window (the note
      // pane, the daily stream, the peek dialog) moves the anchor.
      window.addEventListener('scroll', compute, true)
      window.addEventListener('resize', compute)
      compute()

      teardown = () => {
        refreshRef.current = null
        dom.removeEventListener('focusin', compute)
        dom.removeEventListener('focusout', compute)
        dom.removeEventListener('pointerdown', handlePointerDown)
        dom.removeEventListener('keydown', handleKeyDown)
        window.removeEventListener('pointerup', handlePointerUp)
        document.removeEventListener('selectionchange', handleSelectionChange)
        window.removeEventListener('scroll', compute, true)
        window.removeEventListener('resize', compute)
        setSnapshot(null)
      }
    }
    attach()
    return () => {
      if (frame !== null) {
        cancelAnimationFrame(frame)
      }
      teardown?.()
    }
  }, [editor])

  // Place the toolbar above the selection, centered, clamped to the viewport;
  // flipped below when there is no room above. Imperative (measure-then-place
  // before paint) because the toolbar's size is only known once rendered.
  useLayoutEffect(() => {
    const element = rootRef.current
    if (element === null || snapshot === null) {
      return
    }
    const half = element.offsetWidth / 2
    const center = snapshot.anchor.left + snapshot.anchor.width / 2
    const left = Math.min(
      Math.max(center, VIEWPORT_MARGIN + half),
      window.innerWidth - VIEWPORT_MARGIN - half,
    )
    const above = snapshot.anchor.top - ANCHOR_GAP - element.offsetHeight
    const top = above >= VIEWPORT_MARGIN ? above : snapshot.anchor.bottom + ANCHOR_GAP
    element.style.left = `${left - half}px`
    element.style.top = `${top}px`
    // Mounted hidden (the JSX inline style); revealed only once positioned,
    // so no frame can ever paint at the pre-layout origin.
    element.style.visibility = 'visible'
  }, [snapshot])

  const runFormat = useCallback(
    (command: FormatCommand) => {
      editor.commands[command]()
      // A mark toggle doesn't necessarily move the DOM selection, so the
      // active states must republish here (the bridge's same rule).
      refreshRef.current?.()
    },
    [editor],
  )

  const convertBlock = useCallback(
    (target: BlockId) => {
      const commands = editor.commands
      switch (target) {
        case 'text': {
          // "Texto" means undo whatever the block is: unwrap its wrappers,
          // then normalize the textblock itself.
          const info = readActiveBlock(editor.view.state.selection.$from)
          if (info.listKind !== null) {
            commands.toggleList({ kind: info.listKind })
          }
          if (info.inBlockquote) {
            commands.toggleBlockquote()
          }
          if (info.textblock === 'heading' || info.textblock === 'codeBlock') {
            commands.setParagraph()
          }
          break
        }
        case 'h1':
          commands.toggleHeading({ level: 1 })
          break
        case 'h2':
          commands.toggleHeading({ level: 2 })
          break
        case 'h3':
          commands.toggleHeading({ level: 3 })
          break
        case 'bullet':
          commands.toggleList({ kind: 'bullet' })
          break
        case 'ordered':
          commands.toggleList({ kind: 'ordered' })
          break
        case 'task':
          commands.wrapInSquareTask()
          break
        case 'quote':
          commands.toggleBlockquote()
          break
        case 'code':
          commands.toggleCodeBlock()
          break
      }
      refreshRef.current?.()
    },
    [editor],
  )

  const handleMenuOpenChange = useCallback((open: boolean) => {
    menuOpenRef.current = open
    if (!open) {
      refreshRef.current?.()
    }
  }, [])

  const handleMenuCloseAutoFocus = useCallback(
    (event: Event) => {
      // Radix would hand focus back to the trigger; the editor is where the
      // user goes on from a conversion (and a blurred editor drops the bar).
      event.preventDefault()
      editor.focus()
    },
    [editor],
  )

  const handleAiClick = useCallback(() => {
    // The AI menu takes the selection over; keep the toolbar down until the
    // user moves the selection again.
    suppressedRef.current = true
    setSnapshot(null)
    onAiRequest?.()
  }, [onAiRequest])

  if (snapshot === null) {
    return null
  }
  const activeBlock = BLOCKS.find((spec) => spec.id === snapshot.block) ?? BLOCKS[0]
  const ActiveBlockIcon = activeBlock?.icon ?? Type

  return createPortal(
    <div
      ref={rootRef}
      role="toolbar"
      aria-label="Formato de la selección"
      // Buttons must not steal the editor's focus: a blurred editor drops
      // both the selection highlight and this toolbar.
      onMouseDown={(event) => event.preventDefault()}
      style={{ visibility: 'hidden' }}
      className="reflect-selection-toolbar fixed left-0 top-0 z-50 overflow-hidden rounded-xl bg-popover text-popover-foreground shadow-lg ring-1 ring-foreground/10"
    >
      <div className="flex items-center gap-0.5 p-1">
        <DropdownMenu onOpenChange={handleMenuOpenChange}>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Convertir en"
                  className="flex h-7 items-center gap-0.5 rounded-lg px-1.5 text-text-secondary transition-colors hover:bg-surface-hover hover:text-text data-open:bg-surface-hover data-open:text-text"
                >
                  <ActiveBlockIcon aria-hidden className="size-4" />
                  <ChevronDown aria-hidden className="size-3 opacity-70" />
                </button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="top">Convertir en</TooltipContent>
          </Tooltip>
          <DropdownMenuContent
            align="start"
            sideOffset={6}
            onCloseAutoFocus={handleMenuCloseAutoFocus}
          >
            {BLOCKS.map((spec, index) => {
              const Icon = spec.icon
              return (
                <DropdownMenuItem
                  key={spec.id}
                  disabled={snapshot.blockEnabled[index] !== true}
                  onSelect={() => convertBlock(spec.id)}
                >
                  <Icon aria-hidden className="size-4 text-text-secondary" />
                  <span>{spec.label}</span>
                  {snapshot.block === spec.id ? (
                    <Check aria-hidden className="ml-auto size-3.5" />
                  ) : null}
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
        <div aria-hidden className="mx-0.5 h-4 w-px bg-border" />
        {FORMATS.map((format, index) => {
          const state = snapshot.formats[index]
          const Icon = format.icon
          return (
            <Tooltip key={format.command}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  disabled={state?.enabled !== true}
                  aria-label={format.label}
                  aria-pressed={state?.active === true}
                  onClick={() => runFormat(format.command)}
                  className={cn(
                    'flex size-7 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-surface-hover hover:text-text disabled:pointer-events-none disabled:opacity-35',
                    state?.active === true && 'bg-accent-soft text-accent',
                  )}
                >
                  <Icon aria-hidden className="size-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">
                {format.label}
                <kbd className="text-[11px] text-text-muted">{format.shortcut}</kbd>
              </TooltipContent>
            </Tooltip>
          )
        })}
      </div>
      {onAiRequest !== undefined ? (
        <>
          <div aria-hidden className="h-px bg-border" />
          <div className="p-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label="Editar con IA"
                  onClick={handleAiClick}
                  className="flex w-full items-center justify-center rounded-lg py-1.5 transition-colors hover:bg-accent-soft"
                >
                  <Sparkles aria-hidden className="size-4 text-accent" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Editar con IA</TooltipContent>
            </Tooltip>
          </div>
        </>
      ) : null}
    </div>,
    document.body,
  )
}
