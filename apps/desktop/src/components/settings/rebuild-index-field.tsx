import { useState, type ReactElement } from 'react'
import { Button } from '@/components/ui/button'
import { rebuildIndexVisibly } from '@/lib/rebuild-index'
import { useGraph } from '@/providers/graph-provider'
import { SettingsField } from './field'

/**
 * The recovery lever for the local index: a one-click full rebuild from the
 * markdown files (the same action as the palette's "Rebuild search index").
 * Progress and failures surface through the operations status UI. The local
 * in-flight state only drives the label and disabled treatment —
 * rebuildIndexVisibly itself coalesces overlapping requests, including races
 * with the palette command.
 */
export function RebuildIndexField(): ReactElement {
  const { indexGeneration } = useGraph()
  const [rebuilding, setRebuilding] = useState(false)

  const rebuild = async (): Promise<void> => {
    if (indexGeneration === null || rebuilding) {
      return
    }
    setRebuilding(true)
    try {
      await rebuildIndexVisibly(indexGeneration)
    } finally {
      setRebuilding(false)
    }
  }

  return (
    <SettingsField
      legend="Reconstruir índice"
      description="Reflect mantiene un índice local de tus notas para impulsar la búsqueda y los enlaces. Si los resultados alguna vez se ven desactualizados o incompletos, reconstrúyelo — tus notas nunca se modifican."
    >
      <div className="mt-3 flex justify-start">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={indexGeneration === null || rebuilding}
          onClick={() => void rebuild()}
          className="text-text-secondary"
        >
          {rebuilding ? 'Reconstruyendo…' : 'Reconstruir índice'}
        </Button>
      </div>
    </SettingsField>
  )
}
