import { useState, type ReactElement } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  errorMessage,
  getConflictedNotes,
  getDuplicateNoteIds,
  hasBridge,
  icloudAdoptGraph,
  icloudPendingCount,
  icloudStatus,
} from '@reflect/core'
import { ConflictedNoteLinks } from '@/components/settings/conflicted-note-links'
import { SettingsField } from '@/components/settings/field'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { isICloudRoot } from '@/lib/icloud-controller'
import { ICLOUD_STATUS_QUERY_KEY, INDEX_QUERY_SCOPE } from '@/lib/query-client'
import { isMacosDesktop } from '@/lib/platform'
import { useGraph } from '@/providers/graph-provider'
import { useSync } from '@/providers/sync-provider'

const ICLOUD_PENDING_NOTES_QUERY_KEY = 'icloud-pending-notes'
const PENDING_NOTES_REFETCH_MS = 5_000

function graphCountLine(count: number): string {
  if (count === 0) {
    return 'Aún no hay grafos en iCloud Drive.'
  }
  return count === 1 ? '1 grafo en iCloud Drive.' : `${count} grafos en iCloud Drive.`
}

function pendingNotesLine(count: number): string {
  if (count === 0) {
    return 'Todos los archivos de notas están descargados.'
  }
  return count === 1
    ? '1 nota todavía se está descargando de iCloud.'
    : `${count} notas todavía se están descargando de iCloud.`
}

function reviewLine(conflictCount: number, forkCount: number): string {
  if (conflictCount === 0 && forkCount === 0) {
    return 'Ninguna nota necesita revisión.'
  }
  const parts: string[] = []
  if (conflictCount > 0) {
    parts.push(conflictCount === 1 ? '1 nota necesita revisión' : `${conflictCount} notas necesitan revisión`)
  }
  if (forkCount > 0) {
    parts.push(forkCount === 1 ? '1 bifurcación de sincronización' : `${forkCount} bifurcaciones de sincronización`)
  }
  return parts.join(', ')
}

/**
 * Settings → Sync → iCloud Drive (Plan 21 Phase 1, the desktop leg): see
 * whether the graph syncs through iCloud Drive, and move a local graph into the
 * container. The move copies (count+byte verified), then disconnects the old
 * folder's Git backup remote before reopening the graph at its iCloud home.
 * Ordered copy-first so a failed copy leaves everything — including the backup
 * — exactly as it was; the original folder stays on disk untouched as the
 * recovery copy either way.
 *
 * macOS only — Windows/Linux have no iCloud Drive, and mobile chooses its
 * storage in onboarding.
 */
export function IcloudSettingsField(): ReactElement | null {
  const { graph, openRecent } = useGraph()
  const { backup, disconnectGraph } = useSync()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bridgeAvailable = hasBridge()
  const hosted = graph !== null && isICloudRoot(graph.root)
  const { data: status } = useQuery({
    queryKey: ICLOUD_STATUS_QUERY_KEY,
    queryFn: icloudStatus,
    enabled: bridgeAvailable && isMacosDesktop,
  })
  const pendingNotes = useQuery({
    queryKey: [ICLOUD_PENDING_NOTES_QUERY_KEY, graph?.root],
    queryFn: () => (graph === null ? Promise.resolve(0) : icloudPendingCount(graph.root, 'notes')),
    enabled: bridgeAvailable && isMacosDesktop && hosted,
    staleTime: PENDING_NOTES_REFETCH_MS,
    refetchInterval: (query) => {
      const count = query.state.data
      return typeof count === 'number' && count > 0 ? PENDING_NOTES_REFETCH_MS : false
    },
  })
  const conflicted = useQuery({
    queryKey: [INDEX_QUERY_SCOPE, 'conflicted-notes', graph?.root],
    queryFn: () => getConflictedNotes(),
    enabled: bridgeAvailable && hosted,
  })
  const duplicateIds = useQuery({
    queryKey: [INDEX_QUERY_SCOPE, 'duplicate-note-ids', graph?.root],
    queryFn: () => getDuplicateNoteIds(),
    enabled: bridgeAvailable && hosted,
  })

  // The navigator hides the entry off macOS through the same gate — the two
  // must agree (see use-visible-settings-sections).
  if (!isMacosDesktop || graph === null) {
    return null
  }
  const backupConnected = backup.phase === 'connected'
  const conflictCount = conflicted.data?.length
  const forkCount = duplicateIds.data?.length
  const hasReviewIssues =
    conflictCount !== undefined &&
    forkCount !== undefined &&
    (conflictCount > 0 || forkCount > 0)

  async function moveToICloud(): Promise<void> {
    if (graph === null) {
      return
    }
    setBusy(true)
    setError(null)
    try {
      // Copy first: if it fails, nothing changed — the backup is still
      // connected and the graph untouched.
      const newRoot = await icloudAdoptGraph(graph.generation)
      if (backupConnected) {
        try {
          await disconnectGraph()
        } catch (caught) {
          // The iCloud copy has no .git, so exclusivity holds for the new
          // graph regardless; the original folder keeping its backup is the
          // recovery copy working as intended. Tell the user, don't block.
          setError(
            `El grafo se movió a iCloud, pero no se pudo desconectar el respaldo de GitHub de la carpeta original: ${errorMessage(caught)}`,
          )
        }
      }
      setConfirmOpen(false)
      const opened = await openRecent(newRoot)
      if (!opened) {
        // Append rather than replace: a disconnect failure above must stay
        // visible alongside this one — both tell the user something distinct.
        setError((previous) =>
          [previous, 'La copia llegó a iCloud pero no se pudo abrir — ábrela desde Grafos guardados.']
            .filter(Boolean)
            .join(' '),
        )
      }
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <SettingsField
        legend="iCloud Drive"
        description={
          hosted
            ? 'Este grafo vive en iCloud Drive — los cambios se sincronizan con tus otros dispositivos y los conflictos se resuelven automáticamente cuando es posible.'
            : status?.available === true
              ? 'Copia este grafo a iCloud Drive para sincronizarlo con tus otros dispositivos.'
              : 'No se puede acceder a iCloud Drive desde esta app — inicia sesión en iCloud o usa una versión con iCloud habilitado.'
        }
      >
        {hosted ? (
          <div className="mt-3 flex flex-col gap-1 text-xs text-text-muted">
            {pendingNotes.isPending ? <p>Verificando las notas descargadas...</p> : null}
            {pendingNotes.data !== undefined ? <p>{pendingNotesLine(pendingNotes.data)}</p> : null}
            {conflictCount !== undefined && forkCount !== undefined ? (
              <div className={hasReviewIssues ? 'text-amber-700 dark:text-amber-300' : undefined}>
                <p>{reviewLine(conflictCount, forkCount)}</p>
                <ConflictedNoteLinks notes={conflicted.data ?? []} />
              </div>
            ) : null}
          </div>
        ) : status?.available === true ? (
          <p className="mt-3 text-xs text-text-muted">
            {graphCountLine(status.existingGraphRoots.length)}
          </p>
        ) : null}
        {hosted ? null : (
          <div className="mt-2">
            <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
              <DialogTrigger asChild>
                <Button size="xs" variant="outline" disabled={status?.available !== true}>
                  Mover grafo a iCloud…
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>¿Mover este grafo a iCloud Drive?</DialogTitle>
                  <DialogDescription>
                    Tus notas se copian a iCloud Drive y el grafo se vuelve a abrir allí. La
                    carpeta actual permanece en el disco, intacta, como copia de recuperación.
                    {backupConnected
                      ? ' El respaldo de GitHub se desconecta de la copia de recuperación; puedes reconectar el respaldo después de que se abra el grafo de iCloud.'
                      : ''}
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="ghost" disabled={busy}>
                      Cancelar
                    </Button>
                  </DialogClose>
                  <Button disabled={busy} onClick={() => void moveToICloud()}>
                    {busy ? 'Moviendo…' : 'Mover a iCloud'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}
        {error !== null ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
      </SettingsField>
    </>
  )
}
