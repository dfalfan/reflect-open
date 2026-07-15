import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactElement } from 'react'

interface SummaryFixture {
  importedFiles: number
  skippedFiles: number
  downloadedAssets: number
  failedAssetDownloads: number
  renamedFiles: number
  mergedFiles: number
  changedPaths: string[]
}

interface ProgressFixture {
  stage: 'downloading' | 'writing'
  done: number
  total: number
}

const importReflectV1Zip = vi.hoisted(() => vi.fn<() => Promise<SummaryFixture>>())
const cancelReflectV1Import = vi.hoisted(() => vi.fn(async () => {}))
const markReflectV1ImportOwnWrites = vi.hoisted(() => vi.fn())
const progressHandlers = vi.hoisted(() => new Set<(progress: ProgressFixture) => void>())
const refreshIndex = vi.hoisted(() => vi.fn())

vi.mock('@reflect/core', () => ({
  importReflectV1Zip,
  cancelReflectV1Import,
  markReflectV1ImportOwnWrites,
  subscribeImportProgress: (handler: (progress: ProgressFixture) => void) => {
    progressHandlers.add(handler)
    return Promise.resolve(() => progressHandlers.delete(handler))
  },
  errorMessage: (error: unknown) => (error instanceof Error ? error.message : String(error)),
}))
vi.mock('@/providers/graph-provider', () => ({
  useGraph: () => ({ refreshIndex }),
}))

const { V1ImportProvider, useV1Import } = await import('./v1-import-provider')

function summary(overrides: Partial<SummaryFixture> = {}): SummaryFixture {
  return {
    importedFiles: 2,
    skippedFiles: 1,
    downloadedAssets: 0,
    failedAssetDownloads: 0,
    renamedFiles: 0,
    mergedFiles: 0,
    changedPaths: ['notes/a.md', 'daily/2026-07-04.md'],
    ...overrides,
  }
}

function emitProgress(progress: ProgressFixture): void {
  for (const handler of [...progressHandlers]) {
    handler(progress)
  }
}

function Probe(): ReactElement {
  const { state, startImport } = useV1Import()
  return (
    <button type="button" onClick={() => startImport('/tmp/reflect-v1.zip')}>
      start ({state.phase})
    </button>
  )
}

function renderProvider(graph = { root: '/graphs/notes', name: 'Notes', generation: 42 }) {
  return render(
    <V1ImportProvider graph={graph}>
      <Probe />
    </V1ImportProvider>,
  )
}

function startButton(): HTMLElement {
  return screen.getByRole('button', { name: /start/ })
}

beforeEach(() => {
  importReflectV1Zip.mockResolvedValue(summary())
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  progressHandlers.clear()
})

describe('V1ImportProvider', () => {
  it('runs the import and reports the outcome in the dialog', async () => {
    let finish: (value: SummaryFixture) => void = () => {}
    importReflectV1Zip.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    renderProvider()

    fireEvent.click(startButton())

    expect(await screen.findByText('Importando desde Reflect V1')).toBeTruthy()
    expect(screen.getByText('Leyendo la exportación…')).toBeTruthy()
    expect(importReflectV1Zip).toHaveBeenCalledWith('/tmp/reflect-v1.zip', 42)

    emitProgress({ stage: 'downloading', done: 3, total: 8 })
    expect(await screen.findByText('Descargando adjuntos… 3 de 8')).toBeTruthy()

    emitProgress({ stage: 'writing', done: 10, total: 40 })
    expect(await screen.findByText('Agregando notas… 10 de 40')).toBeTruthy()

    finish(summary({ mergedFiles: 1, renamedFiles: 1 }))
    expect(await screen.findByText('Importación completa')).toBeTruthy()
    expect(
      screen.getByText(
        '2 archivos importados, 1 nota diaria combinada, 1 renombrados para evitar conflicto de nombres, 1 ya presentes.',
      ),
    ).toBeTruthy()
    expect(markReflectV1ImportOwnWrites).toHaveBeenCalledTimes(1)
    expect(refreshIndex).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Listo' }))
    await waitFor(() => expect(screen.queryByText('Importación completa')).toBeNull())
  })

  it('cannot be dismissed while the import runs', async () => {
    importReflectV1Zip.mockImplementationOnce(() => new Promise(() => {}))
    renderProvider()

    fireEvent.click(startButton())
    const dialog = await screen.findByRole('dialog')

    expect(screen.queryByRole('button', { name: 'Cerrar' })).toBeNull()
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(screen.getByText('Importando desde Reflect V1')).toBeTruthy()
  })

  it('cancels the running import and settles back to idle', async () => {
    let reject: (reason: Error) => void = () => {}
    importReflectV1Zip.mockImplementationOnce(
      () =>
        new Promise((_, rejectPromise) => {
          reject = rejectPromise
        }),
    )
    renderProvider()

    fireEvent.click(startButton())
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar' }))

    expect(cancelReflectV1Import).toHaveBeenCalledTimes(1)
    expect(await screen.findByRole('button', { name: 'Cancelando…' })).toBeTruthy()

    reject(new Error('import cancelled'))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.queryByText('Falló la importación')).toBeNull()
    expect(markReflectV1ImportOwnWrites).not.toHaveBeenCalled()
  })

  it('hides Cancel once writing starts (nothing can be aborted safely)', async () => {
    importReflectV1Zip.mockImplementationOnce(() => new Promise(() => {}))
    renderProvider()

    fireEvent.click(startButton())
    await screen.findByRole('button', { name: 'Cancelar' })

    emitProgress({ stage: 'writing', done: 1, total: 4 })
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Cancelar' })).toBeNull())
  })

  it('surfaces failures with the native message', async () => {
    importReflectV1Zip.mockRejectedValueOnce(new Error('could not read the zip'))
    renderProvider()

    fireEvent.click(startButton())

    expect(await screen.findByText('Falló la importación')).toBeTruthy()
    expect(screen.getByText('could not read the zip')).toBeTruthy()
    expect(refreshIndex).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('drops the result when the graph switched mid-import', async () => {
    let finish: (value: SummaryFixture) => void = () => {}
    importReflectV1Zip.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    const view = renderProvider()

    fireEvent.click(startButton())
    await screen.findByRole('dialog')

    view.rerender(
      <V1ImportProvider graph={{ root: '/graphs/other', name: 'Other', generation: 43 }}>
        <Probe />
      </V1ImportProvider>,
    )
    finish(summary())

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(markReflectV1ImportOwnWrites).not.toHaveBeenCalled()
    expect(refreshIndex).not.toHaveBeenCalled()
  })

  it('cancels and drops the result when the workspace unmounts mid-import', async () => {
    let finish: (value: SummaryFixture) => void = () => {}
    importReflectV1Zip.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    const view = renderProvider()

    fireEvent.click(startButton())
    await screen.findByRole('dialog')

    view.unmount()
    expect(cancelReflectV1Import).toHaveBeenCalledTimes(1)

    finish(summary())
    await waitFor(() => expect(importReflectV1Zip).toHaveBeenCalledTimes(1))
    expect(markReflectV1ImportOwnWrites).not.toHaveBeenCalled()
    expect(refreshIndex).not.toHaveBeenCalled()
  })

  it('summarizes failed attachment downloads', async () => {
    importReflectV1Zip.mockResolvedValueOnce(
      summary({
        importedFiles: 12,
        skippedFiles: 0,
        downloadedAssets: 140,
        failedAssetDownloads: 1,
        changedPaths: ['notes/a.md'],
      }),
    )
    renderProvider()

    fireEvent.click(startButton())

    expect(
      await screen.findByText(
        '12 archivos importados, 140 adjuntos descargados. 1 adjunto no se pudo descargar y todavía enlaza a Reflect V1.',
      ),
    ).toBeTruthy()
  })
})
