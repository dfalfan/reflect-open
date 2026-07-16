import { act, cleanup, fireEvent, render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { setPlatformSurface } from '@/lib/platform-surface'
import { dispatchCaretMeasureNudge } from './caret-position-watch'
import { SelectionToolbar } from './selection-toolbar'

/**
 * The selection toolbar renders over a focused, non-empty text selection,
 * dispatches meowdown's mark commands, and converts blocks through its
 * turn-into menu. The ProseKit editor is faked (the bridge test's pattern):
 * selection/marks/ancestry are fixture knobs, command dispatch is observed
 * directly, and meowdown's virtual-element/pending-replacement helpers are
 * mocked at the module seam.
 */

interface FakeCommand {
  (...args: unknown[]): void
  canExec: ReturnType<typeof vi.fn>
}

function makeCommand(): FakeCommand {
  return Object.assign(vi.fn(), { canExec: vi.fn(() => true) })
}

interface FakeNode {
  type: { name: string }
  attrs: Record<string, unknown>
}

interface FakeSelection {
  empty: boolean
  from: number
  to: number
  $from: { depth: number; node: (depth: number) => FakeNode }
  node?: unknown
}

function makeFakeEditor() {
  const dom = document.createElement('div')
  document.body.appendChild(dom)
  const marks = {
    mdStrong: { name: 'mdStrong' },
    mdEm: { name: 'mdEm' },
    mdDel: { name: 'mdDel' },
    mdCode: { name: 'mdCode' },
    mdHighlight: { name: 'mdHighlight' },
  }
  // Ancestry fixture: doc > paragraph (a plain text block) by default.
  const ancestors: FakeNode[] = [
    { type: { name: 'doc' }, attrs: {} },
    { type: { name: 'paragraph' }, attrs: {} },
  ]
  const selection: FakeSelection = {
    empty: false,
    from: 1,
    to: 5,
    $from: {
      get depth() {
        return ancestors.length - 1
      },
      node: (depth: number) => ancestors[depth] ?? { type: { name: 'doc' }, attrs: {} },
    },
  }
  return {
    mounted: true,
    focused: false,
    focus: vi.fn(),
    view: {
      dom,
      state: {
        selection,
        schema: { marks },
        doc: {
          rangeHasMark: vi.fn<(from: number, to: number, type: { name?: string }) => boolean>(
            () => false,
          ),
        },
      },
    },
    commands: {
      toggleStrong: makeCommand(),
      toggleEm: makeCommand(),
      toggleDel: makeCommand(),
      toggleCode: makeCommand(),
      toggleHighlight: makeCommand(),
      setParagraph: makeCommand(),
      toggleHeading: makeCommand(),
      toggleList: makeCommand(),
      wrapInSquareTask: makeCommand(),
      toggleBlockquote: makeCommand(),
      toggleCodeBlock: makeCommand(),
    },
    marks,
    selection,
    ancestors,
  }
}

const fake = vi.hoisted(() => ({
  editor: null as unknown,
  pendingReplacement: null as unknown,
}))

vi.mock('@meowdown/react', () => ({
  useEditor: () => fake.editor,
}))
vi.mock('@meowdown/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@meowdown/core')>()),
  getPendingReplacement: () => fake.pendingReplacement,
  getVirtualElementFromRange: () => ({
    getBoundingClientRect: () => ({ left: 100, top: 200, bottom: 220, width: 80 }),
  }),
}))

let editor: ReturnType<typeof makeFakeEditor>

beforeEach(() => {
  setPlatformSurface({ touchEditor: false })
  editor = makeFakeEditor()
  fake.editor = editor
  fake.pendingReplacement = null
})

afterEach(() => {
  cleanup()
  editor.view.dom.remove()
  vi.clearAllMocks()
})

function renderToolbar(props: { onAiRequest?: () => void } = {}): ReturnType<typeof render> {
  return render(
    <TooltipProvider>
      <SelectionToolbar {...props} />
    </TooltipProvider>,
  )
}

function focusWithSelection(): void {
  act(() => {
    editor.focused = true
    editor.view.dom.dispatchEvent(new Event('focusin', { bubbles: true }))
  })
}

function toolbar(view: ReturnType<typeof render>): HTMLElement | null {
  return view.queryByRole('toolbar', { name: 'Formato de la selección' })
}

describe('SelectionToolbar', () => {
  it('stays hidden until the editor is focused, then shows the format buttons', () => {
    const view = renderToolbar()
    expect(toolbar(view)).toBeNull()

    focusWithSelection()

    expect(toolbar(view)).not.toBeNull()
    for (const label of ['Negrita', 'Cursiva', 'Tachado', 'Código', 'Resaltado']) {
      expect(view.getByRole('button', { name: label })).toBeDefined()
    }
    expect(view.getByRole('button', { name: 'Convertir en' })).toBeDefined()
  })

  it('stays hidden over an empty selection and over a node selection', () => {
    const view = renderToolbar()
    editor.selection.empty = true
    focusWithSelection()
    expect(toolbar(view)).toBeNull()

    editor.selection.empty = false
    editor.selection.node = {}
    act(() => document.dispatchEvent(new Event('selectionchange')))
    expect(toolbar(view)).toBeNull()
  })

  it('does nothing on the touch surface', () => {
    setPlatformSurface({ touchEditor: true })
    const view = renderToolbar()
    focusWithSelection()
    expect(toolbar(view)).toBeNull()
    setPlatformSurface({ touchEditor: false })
  })

  it('dispatches the mark command on click and marks active marks pressed', () => {
    editor.view.state.doc.rangeHasMark.mockImplementation(
      (_from: number, _to: number, type: { name?: string }) => type.name === 'mdStrong',
    )
    const view = renderToolbar()
    focusWithSelection()

    const bold = view.getByRole('button', { name: 'Negrita' })
    expect(bold.getAttribute('aria-pressed')).toBe('true')
    expect(view.getByRole('button', { name: 'Cursiva' }).getAttribute('aria-pressed')).toBe(
      'false',
    )

    fireEvent.click(view.getByRole('button', { name: 'Cursiva' }))
    expect(editor.commands.toggleEm).toHaveBeenCalled()
  })

  it('disables format commands the selection cannot take', () => {
    for (const command of [
      editor.commands.toggleStrong,
      editor.commands.toggleEm,
      editor.commands.toggleDel,
      editor.commands.toggleHighlight,
    ]) {
      command.canExec.mockReturnValue(false)
    }
    const view = renderToolbar()
    focusWithSelection()

    expect(view.getByRole('button', { name: 'Negrita' }).hasAttribute('disabled')).toBe(true)
    expect(view.getByRole('button', { name: 'Código' }).hasAttribute('disabled')).toBe(false)
  })

  it('converts the block from the turn-into menu and hands focus back', async () => {
    const user = userEvent.setup()
    const view = renderToolbar()
    focusWithSelection()

    await user.click(view.getByRole('button', { name: 'Convertir en' }))
    await user.click(await view.findByRole('menuitem', { name: 'Encabezado 1' }))

    expect(editor.commands.toggleHeading).toHaveBeenCalledWith({ level: 1 })
    expect(editor.focus).toHaveBeenCalled()
  })

  it('turn-into "Texto" unwraps the list wrapping the selection', async () => {
    editor.ancestors.splice(
      1,
      0,
      { type: { name: 'list' }, attrs: { kind: 'bullet' } },
    )
    const user = userEvent.setup()
    const view = renderToolbar()
    focusWithSelection()

    await user.click(view.getByRole('button', { name: 'Convertir en' }))
    await user.click(await view.findByRole('menuitem', { name: 'Texto' }))

    expect(editor.commands.toggleList).toHaveBeenCalledWith({ kind: 'bullet' })
    expect(editor.commands.setParagraph).not.toHaveBeenCalled()
  })

  it('keeps the toolbar up while the turn-into menu holds focus', async () => {
    const user = userEvent.setup()
    const view = renderToolbar()
    focusWithSelection()

    await user.click(view.getByRole('button', { name: 'Convertir en' }))
    expect(view.queryByRole('menu')).not.toBeNull()

    // Opening the menu blurs the editor; recomputes while it is open (focus
    // churn, selection churn) must hold the toolbar still instead of tearing
    // down — which would unmount the open menu with it. While the modal menu
    // is up, Radix aria-hides the rest of the page (the toolbar included), so
    // presence is asserted on the DOM, not the accessibility tree.
    act(() => {
      editor.focused = false
      document.dispatchEvent(new Event('selectionchange'))
    })
    expect(document.querySelector('[role="toolbar"]')).not.toBeNull()
    expect(view.queryByRole('menu')).not.toBeNull()
  })

  it('shows the AI section only when a handler is given, and hides after invoking it', () => {
    const withoutAi = renderToolbar()
    focusWithSelection()
    expect(withoutAi.queryByRole('button', { name: 'Editar con IA' })).toBeNull()
    withoutAi.unmount()

    const onAiRequest = vi.fn()
    const view = renderToolbar({ onAiRequest })
    focusWithSelection()

    fireEvent.click(view.getByRole('button', { name: 'Editar con IA' }))
    expect(onAiRequest).toHaveBeenCalled()
    expect(toolbar(view)).toBeNull()
  })

  it('hides while a pending AI replacement is staged', () => {
    fake.pendingReplacement = { from: 1, to: 5 }
    const view = renderToolbar()
    focusWithSelection()
    expect(toolbar(view)).toBeNull()
  })

  it('hides during a drag-select and reappears on pointer-up', () => {
    const view = renderToolbar()
    focusWithSelection()
    expect(toolbar(view)).not.toBeNull()

    act(() => {
      editor.view.dom.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    })
    expect(toolbar(view)).toBeNull()

    act(() => {
      window.dispatchEvent(new Event('pointerup'))
    })
    expect(toolbar(view)).not.toBeNull()
  })

  it('dismisses on Escape until the selection changes', () => {
    const view = renderToolbar()
    focusWithSelection()
    expect(toolbar(view)).not.toBeNull()

    act(() => {
      editor.view.dom.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      )
    })
    expect(toolbar(view)).toBeNull()

    // Focus churn alone must not resurrect it…
    act(() => {
      editor.view.dom.dispatchEvent(new Event('focusin', { bubbles: true }))
    })
    expect(toolbar(view)).toBeNull()

    // …a caret-measure nudge (a layout event, not user intent) must not
    // resurrect it either…
    act(() => dispatchCaretMeasureNudge(document))
    expect(toolbar(view)).toBeNull()

    // …but a new selection does.
    act(() => document.dispatchEvent(new Event('selectionchange')))
    expect(toolbar(view)).not.toBeNull()
  })

  it('hides on blur', () => {
    const view = renderToolbar()
    focusWithSelection()
    expect(toolbar(view)).not.toBeNull()

    act(() => {
      editor.focused = false
      editor.view.dom.dispatchEvent(new Event('focusout', { bubbles: true }))
    })
    expect(toolbar(view)).toBeNull()
  })
})
