import {
  reconcileAssetDescriptions,
  reindexNotesReferencing,
  type AiProvidersState,
  type ReconcileAssetDescriptionsOutcome,
} from '@reflect/core'
import { startOperation } from '@/lib/operations'
import { providerFetch } from '@/lib/provider-fetch'
import { invalidateIndexQueries } from '@/lib/query-client'

let inFlight: { generation: number; promise: Promise<ReconcileAssetDescriptionsOutcome> } | null = null

/**
 * Describe every existing eligible asset with user-visible status (Plan 20):
 * the explicit backfill behind the Settings button + cost warning. Unlike the
 * automatic path it enumerates all of `assets/`, but obeys the same privacy and
 * idempotency rules — already-described assets are skipped, and private or
 * unreferenced ones are never sent. Coalesces while a run is in flight (the
 * generation is the file-write generation, `GraphInfo.generation`).
 */
export function backfillAssetDescriptionsVisibly(
  generation: number,
  providers: AiProvidersState,
): Promise<ReconcileAssetDescriptionsOutcome> {
  if (inFlight !== null && inFlight.generation === generation) {
    return inFlight.promise
  }
  const promise = runBackfill(generation, providers).finally(() => {
    if (inFlight !== null && inFlight.promise === promise) {
      inFlight = null
    }
  })
  inFlight = { generation, promise }
  return promise
}

async function runBackfill(
  generation: number,
  providers: AiProvidersState,
): Promise<ReconcileAssetDescriptionsOutcome> {
  const operation = startOperation('Describiendo recursos')
  let outcome: ReconcileAssetDescriptionsOutcome
  try {
    outcome = await reconcileAssetDescriptions({
      providers,
      generation,
      mode: 'backfill',
      fetchFn: providerFetch,
      onProgress: (done, total) => operation.progress(done, total),
    })
  } catch (cause) {
    // reconcileAssetDescriptions is contracted not to throw, but finalize the
    // operation defensively so an unexpected failure never strands a "running"
    // entry in the operations UI.
    operation.fail('No se pudieron describir los recursos.')
    throw cause
  }
  // Make the new descriptions searchable: re-index the notes that reference the
  // assets we just described (Plan 20 search integration). A failure here must
  // not fail the backfill — the descriptions are written; search folds them on
  // the next re-index or a rebuild.
  if (outcome.describedAssetPaths.length > 0) {
    try {
      await reindexNotesReferencing(outcome.describedAssetPaths, generation)
    } catch (cause) {
      console.warn('asset-description re-index failed:', cause)
    }
    // The re-index wrote search rows directly (not via the watcher → onApplied
    // path), so the index-backed query caches (staleTime: Infinity) need a manual
    // refresh for ⌘K to reflect the new descriptions.
    invalidateIndexQueries()
  }
  if (outcome.stopped === null || outcome.stopped.reason === 'stale') {
    operation.done()
  } else if (outcome.stopped.reason === 'config') {
    operation.warn('Agrega un proveedor de IA en Ajustes para describir los recursos.')
  } else if (outcome.stopped.reason === 'network') {
    operation.warn('No se pudieron describir algunos recursos — revisa tu conexión e inténtalo de nuevo.')
  } else {
    operation.fail(outcome.stopped.message)
  }
  return outcome
}
