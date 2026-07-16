import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CaretPositionWatch,
  dispatchCaretMeasureNudge,
  isCaretMeasureNudge,
} from './caret-position-watch'

/**
 * The watch observes the editor's ancestors and, when any of them resizes,
 * dispatches meowdown's re-measure hook (a synthetic `selectionchange`)
 * marked as a nudge. The ProseKit editor and ResizeObserver are faked; the
 * dispatch is observed on the document.
 */

class FakeResizeObserver {
  static instances: FakeResizeObserver[] = []
  readonly observed: Element[] = []
  disconnected = false
  constructor(private readonly callback: () => void) {
    FakeResizeObserver.instances.push(this)
  }
  observe(element: Element): void {
    this.observed.push(element)
  }
  disconnect(): void {
    this.disconnected = true
  }
  trigger(): void {
    this.callback()
  }
}

function makeFakeEditor() {
  // body > column > pane > editor — the ancestors the watch must observe.
  const column = document.createElement('div')
  const pane = document.createElement('div')
  const dom = document.createElement('div')
  pane.appendChild(dom)
  column.appendChild(pane)
  document.body.appendChild(column)
  return { mounted: true, view: { dom }, column, pane }
}

const fake = vi.hoisted(() => ({ editor: null as unknown }))

vi.mock('@meowdown/react', () => ({
  useEditor: () => fake.editor,
}))

let editor: ReturnType<typeof makeFakeEditor>

beforeEach(() => {
  FakeResizeObserver.instances = []
  vi.stubGlobal('ResizeObserver', FakeResizeObserver)
  editor = makeFakeEditor()
  fake.editor = editor
})

afterEach(() => {
  cleanup()
  editor.column.remove()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('CaretPositionWatch', () => {
  it('observes every ancestor between the editor and the body', () => {
    render(<CaretPositionWatch />)

    const observer = FakeResizeObserver.instances[0]
    expect(observer).toBeDefined()
    expect(observer?.observed).toEqual([editor.pane, editor.column])
  })

  it('dispatches a marked selectionchange when an ancestor resizes', () => {
    render(<CaretPositionWatch />)
    let fired = 0
    let markedDuringDispatch = false
    const listener = (): void => {
      fired += 1
      markedDuringDispatch = isCaretMeasureNudge()
    }
    document.addEventListener('selectionchange', listener)

    act(() => FakeResizeObserver.instances[0]?.trigger())

    document.removeEventListener('selectionchange', listener)
    expect(fired).toBe(1)
    expect(markedDuringDispatch).toBe(true)
    // The marker is dispatch-scoped: outside the event it must read false,
    // so real user selection changes are never mistaken for nudges.
    expect(isCaretMeasureNudge()).toBe(false)
  })

  it('disconnects its observer on unmount', () => {
    const view = render(<CaretPositionWatch />)
    view.unmount()
    expect(FakeResizeObserver.instances[0]?.disconnected).toBe(true)
  })

  it('exposes the nudge dispatcher with the same marking', () => {
    let markedDuringDispatch = false
    const listener = (): void => {
      markedDuringDispatch = isCaretMeasureNudge()
    }
    document.addEventListener('selectionchange', listener)
    dispatchCaretMeasureNudge(document)
    document.removeEventListener('selectionchange', listener)
    expect(markedDuringDispatch).toBe(true)
    expect(isCaretMeasureNudge()).toBe(false)
  })
})
