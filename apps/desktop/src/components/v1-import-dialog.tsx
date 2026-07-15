import type { ReactElement } from 'react'
import type { GraphImportProgress, GraphImportSummary } from '@reflect/core'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import type { V1ImportState } from '@/providers/v1-import-provider'

interface V1ImportDialogProps {
  state: V1ImportState
  onCancel: () => void
  onDismiss: () => void
}

function count(quantity: number, singular: string, plural: string): string {
  return `${quantity} ${quantity === 1 ? singular : plural}`
}

/** The one-line result the dialog shows once an import completes. */
export function summaryText(summary: GraphImportSummary): string {
  const parts = [`${count(summary.importedFiles, 'archivo importado', 'archivos importados')}`]
  if (summary.mergedFiles > 0) {
    parts.push(`${count(summary.mergedFiles, 'nota diaria combinada', 'notas diarias combinadas')}`)
  }
  if (summary.renamedFiles > 0) {
    parts.push(`${summary.renamedFiles} renombrados para evitar conflicto de nombres`)
  }
  if (summary.skippedFiles > 0) {
    parts.push(`${summary.skippedFiles} ya presentes`)
  }
  if (summary.downloadedAssets > 0) {
    parts.push(`${count(summary.downloadedAssets, 'adjunto descargado', 'adjuntos descargados')}`)
  }
  const text = `${parts.join(', ')}.`
  if (summary.failedAssetDownloads === 0) {
    return text
  }
  if (summary.failedAssetDownloads === 1) {
    return `${text} 1 adjunto no se pudo descargar y todavía enlaza a Reflect V1.`
  }
  return `${text} ${summary.failedAssetDownloads} adjuntos no se pudieron descargar y todavía enlazan a Reflect V1.`
}

function stageText(progress: GraphImportProgress | null): string {
  if (progress === null) {
    return 'Leyendo la exportación…'
  }
  if (progress.stage === 'downloading') {
    return `Descargando adjuntos… ${progress.done} de ${progress.total}`
  }
  return `Agregando notas… ${progress.done} de ${progress.total}`
}

function stagePercent(progress: GraphImportProgress | null): number | undefined {
  if (progress === null || progress.total === 0) {
    return undefined
  }
  return Math.round((progress.done / progress.total) * 100)
}

/**
 * The modal face of a running Reflect V1 import. While the import runs the
 * dialog cannot be dismissed (there is nothing else to do in the graph until
 * it settles) — but it can be cancelled up until writing starts, because
 * nothing lands in the graph before then. Once finished it reports the
 * outcome and closes on demand.
 */
export function V1ImportDialog({ state, onCancel, onDismiss }: V1ImportDialogProps): ReactElement {
  const running = state.phase === 'running'
  // Cancelling mid-write would leave a half-imported graph; the native side
  // only honours cancellation before writes start, so the button goes with it.
  const cancellable = running && (state.progress === null || state.progress.stage === 'downloading')

  return (
    <Dialog
      open={state.phase !== 'idle'}
      onOpenChange={(next) => {
        if (!next && !running) {
          onDismiss()
        }
      }}
    >
      <DialogContent
        showCloseButton={false}
        onInteractOutside={(event) => {
          event.preventDefault()
        }}
        onEscapeKeyDown={(event) => {
          if (running) {
            event.preventDefault()
          }
        }}
      >
        {state.phase === 'running' ? (
          <>
            <DialogTitle>Importando desde Reflect V1</DialogTitle>
            <DialogDescription role="status">{stageText(state.progress)}</DialogDescription>
            <Progress value={stagePercent(state.progress) ?? null} />
            {cancellable ? (
              <DialogFooter>
                <Button variant="ghost" disabled={state.cancelling} onClick={onCancel}>
                  {state.cancelling ? 'Cancelando…' : 'Cancelar'}
                </Button>
              </DialogFooter>
            ) : null}
          </>
        ) : null}
        {state.phase === 'done' ? (
          <>
            <DialogTitle>Importación completa</DialogTitle>
            <DialogDescription role="status">{summaryText(state.summary)}</DialogDescription>
            <DialogFooter>
              <Button onClick={onDismiss}>Listo</Button>
            </DialogFooter>
          </>
        ) : null}
        {state.phase === 'failed' ? (
          <>
            <DialogTitle>Falló la importación</DialogTitle>
            <DialogDescription role="alert">{state.message}</DialogDescription>
            <DialogFooter>
              <Button variant="ghost" onClick={onDismiss}>
                Cerrar
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
