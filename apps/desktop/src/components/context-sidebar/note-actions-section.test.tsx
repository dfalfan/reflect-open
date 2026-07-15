import { render, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PinnedNote } from '@reflect/core'
import { TooltipProvider } from '@/components/ui/tooltip'
import { pinnedNotesQueryKey } from '@/hooks/use-pinned-notes'
import { RouterProvider } from '@/routing/router'
import { NoteActionsSection } from './note-actions-section'

const getPinnedNotes = vi.hoisted(() => vi.fn())
const getNote = vi.hoisted(() => vi.fn())
const toggleNotePinned = vi.hoisted(() => vi.fn(async () => true))
const toggleNotePrivate = vi.hoisted(() => vi.fn(async () => true))
const deleteOpenNote = vi.hoisted(() => vi.fn(async () => {}))
const sectionPathForNote = vi.hoisted(() => vi.fn())
const moveNoteCarryingSession = vi.hoisted(() => vi.fn(async () => {}))
const operationFail = vi.hoisted(() => vi.fn())
const startOperation = vi.hoisted(() =>
  vi.fn(() => ({ progress: vi.fn(), done: vi.fn(), fail: operationFail })),
)
vi.mock('@reflect/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@reflect/core')>()),
  hasBridge: () => true,
  getPinnedNotes,
  getNote,
  sectionPathForNote,
}))
vi.mock('@/lib/note-pin', () => ({ toggleNotePinned }))
vi.mock('@/lib/note-private', () => ({ toggleNotePrivate }))
vi.mock('@/lib/note-delete', () => ({ deleteOpenNote }))
vi.mock('@/lib/operations', () => ({ startOperation }))
vi.mock('@/editor/move-note', () => ({ moveNoteCarryingSession }))
vi.mock('@/providers/graph-provider', () => ({
  useGraph: () => ({ graph: { root: '/g', name: 'g', generation: 7 } }),
}))

function renderSection(path: string, showTrash = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const view = render(
    <TooltipProvider>
      <QueryClientProvider client={client}>
        <RouterProvider initialRoute={{ kind: 'note', path }}>
          <NoteActionsSection path={path} showTrash={showTrash} />
        </RouterProvider>
      </QueryClientProvider>
    </TooltipProvider>,
  )
  return { ...view, client }
}

beforeEach(() => {
  window.sessionStorage.clear()
  getPinnedNotes.mockReset().mockResolvedValue([])
  getNote.mockReset().mockResolvedValue(undefined)
  toggleNotePinned.mockReset().mockResolvedValue(true)
  toggleNotePrivate.mockReset().mockResolvedValue(true)
  deleteOpenNote.mockReset().mockResolvedValue(undefined)
  sectionPathForNote.mockReset()
  moveNoteCarryingSession.mockReset().mockResolvedValue(undefined)
  startOperation.mockClear()
  operationFail.mockClear()
})

function noteRow(path: string, isPrivate: boolean, title = 'A') {
  return { path, title, dailyDate: null, isPrivate }
}

describe('NoteActionsSection pin toggle', () => {
  it('offers Pin this note with the platform-formatted hint and toggles on click', async () => {
    const view = renderSection('notes/a.md')
    const button = view.getByRole('button', { name: /Fijar esta nota/ })
    // jsdom reports a non-Apple platform, so Mod renders as Ctrl.
    expect(button.textContent).toContain('CtrlO')
    await userEvent.click(button)
    expect(toggleNotePinned).toHaveBeenCalledWith('notes/a.md', 7)
    view.unmount()
  })

  it('offers Un-pin this note when the index lists the note as pinned', async () => {
    getPinnedNotes.mockResolvedValue([{ path: 'daily/2026-06-10.md', title: 'June 10th, 2026', dailyDate: '2026-06-10' }])
    const view = renderSection('daily/2026-06-10.md')
    await view.findByText('Desfijar esta nota')
    await userEvent.click(view.getByRole('button', { name: /Desfijar esta nota/ }))
    expect(toggleNotePinned).toHaveBeenCalledWith('daily/2026-06-10.md', 7)
    view.unmount()
  })

  it('flips the label from the toggle result before the index catches up', async () => {
    const view = renderSection('notes/a.md')
    await userEvent.click(view.getByRole('button', { name: /Fijar esta nota/ }))
    // The index still reports unpinned; the toggle's resolved state bridges
    // the watcher round-trip so a second click can't invert the user's intent.
    expect(await view.findByText('Desfijar esta nota')).toBeDefined()
    toggleNotePinned.mockResolvedValueOnce(false)
    await userEvent.click(view.getByRole('button', { name: /Desfijar esta nota/ }))
    expect(await view.findByText('Fijar esta nota')).toBeDefined()
    expect(toggleNotePinned).toHaveBeenCalledTimes(2)
    view.unmount()
  })

  it('optimistically adds a newly pinned note after explicitly ordered pins', async () => {
    getPinnedNotes.mockResolvedValue([
      { path: 'notes/zeta.md', title: 'Zeta', dailyDate: null, pinnedOrder: 0 },
      { path: 'notes/alpha.md', title: 'Alpha', dailyDate: null, pinnedOrder: 1 },
    ])
    getNote.mockResolvedValue(noteRow('notes/mid.md', false, 'Mid'))
    const view = renderSection('notes/mid.md')
    const queryKey = pinnedNotesQueryKey('/g')
    await waitFor(() =>
      expect(view.client.getQueryData<PinnedNote[]>(queryKey)?.map((note) => note.title)).toEqual([
        'Zeta',
        'Alpha',
      ]),
    )

    await userEvent.click(view.getByRole('button', { name: /Fijar esta nota/ }))

    expect(view.client.getQueryData<PinnedNote[]>(queryKey)?.map((note) => note.title)).toEqual([
      'Zeta',
      'Alpha',
      'Mid',
    ])
    view.unmount()
  })

  it('invalidates pinned notes when an optimistic pin fails', async () => {
    let rejectToggle!: (cause: unknown) => void
    toggleNotePinned.mockImplementationOnce(
      () =>
        new Promise<boolean>((_resolve, reject) => {
          rejectToggle = reject
        }),
    )
    const view = renderSection('notes/a.md')
    await waitFor(() => expect(getPinnedNotes).toHaveBeenCalledTimes(1))

    await userEvent.click(view.getByRole('button', { name: /Fijar esta nota/ }))
    expect(view.getByText('Desfijar esta nota')).toBeDefined()
    rejectToggle({ kind: 'io', message: 'disk on fire' })

    await waitFor(() => expect(view.getByText('Fijar esta nota')).toBeDefined())
    await waitFor(() => expect(getPinnedNotes).toHaveBeenCalledTimes(2))
    expect(startOperation).toHaveBeenCalledWith('Actualizando fijado')
    expect(operationFail).toHaveBeenCalled()
    view.unmount()
  })

})

describe('NoteActionsSection private toggle', () => {
  it('offers Lock note and toggles on click', async () => {
    const view = renderSection('notes/a.md')
    await userEvent.click(view.getByRole('button', { name: /Bloquear nota/ }))
    expect(toggleNotePrivate).toHaveBeenCalledWith('notes/a.md', 7)
    view.unmount()
  })

  it('offers Unlock note when the index reports the note private', async () => {
    getNote.mockResolvedValue(noteRow('daily/2026-06-10.md', true))
    const view = renderSection('daily/2026-06-10.md')
    await view.findByText('Desbloquear nota')
    await userEvent.click(view.getByRole('button', { name: /Desbloquear nota/ }))
    expect(toggleNotePrivate).toHaveBeenCalledWith('daily/2026-06-10.md', 7)
    view.unmount()
  })

  it('flips the label from the toggle result before the index catches up', async () => {
    const view = renderSection('notes/a.md')
    await userEvent.click(view.getByRole('button', { name: /Bloquear nota/ }))
    expect(await view.findByText('Desbloquear nota')).toBeDefined()
    toggleNotePrivate.mockResolvedValueOnce(false)
    await userEvent.click(view.getByRole('button', { name: /Desbloquear nota/ }))
    expect(await view.findByText('Bloquear nota')).toBeDefined()
    expect(toggleNotePrivate).toHaveBeenCalledTimes(2)
    view.unmount()
  })

  it('restores the private label when a write fails', async () => {
    toggleNotePrivate.mockRejectedValueOnce({ kind: 'io', message: 'disk on fire' })
    const view = renderSection('notes/a.md')
    await userEvent.click(view.getByRole('button', { name: /Bloquear nota/ }))
    await waitFor(() => expect(view.getByText('Bloquear nota')).toBeDefined())
    expect(startOperation).toHaveBeenCalledWith('Actualizando privacidad')
    expect(operationFail).toHaveBeenCalled()
    view.unmount()
  })

})

describe('NoteActionsSection deep-link action', () => {
  it('does not offer Copy deep link in note actions', () => {
    const view = renderSection('notes/a.md')
    expect(view.queryByRole('button', { name: /Copiar enlace directo/ })).toBeNull()
    view.unmount()
  })
})

describe('NoteActionsSection trash action', () => {
  it('does not offer trash unless the note sidebar opts in', () => {
    const view = renderSection('notes/a.md')
    expect(view.queryByRole('button', { name: 'Enviar a la papelera' })).toBeNull()
    view.unmount()
  })

  it('trashes an ordinary note after confirmation', async () => {
    const view = renderSection('notes/a.md', true)
    await userEvent.click(view.getByRole('button', { name: 'Enviar a la papelera' }))
    const trashButtons = view.getAllByRole('button', { name: 'Enviar a la papelera' })
    const confirmButton = trashButtons.at(-1)
    if (confirmButton === undefined) {
      throw new Error('Expected the confirmation button to render')
    }
    await userEvent.click(confirmButton)
    await waitFor(() => expect(deleteOpenNote).toHaveBeenCalledWith('notes/a.md', 7))
    expect(startOperation).toHaveBeenCalledWith('Enviando la nota a la papelera')
    view.unmount()
  })

  it('does not offer trash for daily notes even if enabled', () => {
    const view = renderSection('daily/2026-06-10.md', true)
    expect(view.queryByRole('button', { name: 'Enviar a la papelera' })).toBeNull()
    view.unmount()
  })
})

describe('NoteActionsSection move to section', () => {
  it('offers the two sections the note is not in', () => {
    const view = renderSection('notes/a.md')
    expect(view.getByRole('button', { name: 'Mover a Personal' })).toBeTruthy()
    expect(view.getByRole('button', { name: 'Mover a Trabajo' })).toBeTruthy()
    expect(view.queryByRole('button', { name: 'Mover a Inbox' })).toBeNull()
    view.unmount()
  })

  it('offers Inbox and Trabajo for a note filed in Personal', () => {
    const view = renderSection('notes/personal/viaje.md')
    expect(view.getByRole('button', { name: 'Mover a Inbox' })).toBeTruthy()
    expect(view.getByRole('button', { name: 'Mover a Trabajo' })).toBeTruthy()
    expect(view.queryByRole('button', { name: 'Mover a Personal' })).toBeNull()
    view.unmount()
  })

  it('offers no move rows for a daily note — dailies are not fileable', () => {
    const view = renderSection('daily/2026-06-10.md')
    expect(view.queryByRole('button', { name: /Mover a/ })).toBeNull()
    view.unmount()
  })

  it('moves through the collision probe and the session-carrying move', async () => {
    sectionPathForNote.mockResolvedValue('notes/trabajo/a.md')
    const view = renderSection('notes/a.md')
    await userEvent.click(view.getByRole('button', { name: 'Mover a Trabajo' }))
    await waitFor(() => {
      expect(sectionPathForNote).toHaveBeenCalledWith('notes/a.md', 'trabajo')
      expect(moveNoteCarryingSession).toHaveBeenCalledWith('notes/a.md', 'notes/trabajo/a.md', 7)
    })
    view.unmount()
  })

  it('skips the move entirely when the probe reports a no-op', async () => {
    sectionPathForNote.mockResolvedValue('notes/a.md')
    const view = renderSection('notes/a.md')
    await userEvent.click(view.getByRole('button', { name: 'Mover a Personal' }))
    await waitFor(() => expect(sectionPathForNote).toHaveBeenCalled())
    expect(moveNoteCarryingSession).not.toHaveBeenCalled()
    view.unmount()
  })

  it('reports a refused move through the operation, not a crash', async () => {
    sectionPathForNote.mockResolvedValue('notes/personal/a.md')
    moveNoteCarryingSession.mockRejectedValueOnce(new Error('destination occupied'))
    const view = renderSection('notes/a.md')
    await userEvent.click(view.getByRole('button', { name: 'Mover a Personal' }))
    await waitFor(() => expect(operationFail).toHaveBeenCalledWith('destination occupied'))
    view.unmount()
  })
})
