import { useState, type ReactElement } from 'react'
import type { AiProvidersState } from '@reflect/core'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { backfillAssetDescriptionsVisibly } from '@/lib/asset-backfill'
import { useGraph } from '@/providers/graph-provider'
import { useSettings } from '@/providers/settings-provider'
import { SettingsField } from './field'

/**
 * Settings → Search → OCR assets (Plan 20): a toggle for the automatic path
 * (read new images/PDFs as they're added) plus an explicit backfill, gated
 * behind a cost-warning confirmation because
 * an existing graph can hold many large or costly assets. Progress and final
 * state surface through the operations status UI.
 */
export function DescribeAssetsField(): ReactElement {
  const { settings, updateSettings } = useSettings()
  const { graph } = useGraph()
  const [confirming, setConfirming] = useState(false)
  const [running, setRunning] = useState(false)

  const hasProvider = settings.aiProviders.length > 0
  const generation = graph?.generation ?? null

  const runBackfill = async (): Promise<void> => {
    setConfirming(false)
    if (generation === null || running) {
      return
    }
    const providers: AiProvidersState = {
      providers: settings.aiProviders,
      defaultProviderId: settings.defaultAiProviderId,
    }
    setRunning(true)
    try {
      await backfillAssetDescriptionsVisibly(generation, providers)
    } finally {
      setRunning(false)
    }
  }

  return (
    <SettingsField
      legend="OCR de recursos"
      description="Haz que el texto de las imágenes y los PDF sea buscable. Las notas privadas se omiten."
    >
      <div className="mt-3 flex items-center gap-3">
        <Switch
          aria-label="OCR automático de recursos nuevos"
          checked={settings.describeAssets}
          onCheckedChange={(checked) => updateSettings({ describeAssets: checked })}
        />
        <span className="text-xs text-text-muted">OCR automático de recursos nuevos</span>
      </div>
      <div className="mt-3 flex flex-col items-start">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={generation === null || !hasProvider || running}
          onClick={() => setConfirming(true)}
          className="text-text-secondary"
        >
          {running ? 'Procesando…' : 'Procesar recursos existentes'}
        </Button>
        {!hasProvider ? (
          <p className="mt-2 text-xs text-text-muted">Agrega un proveedor de IA para activar esto.</p>
        ) : null}
      </div>
      {confirming ? (
        <Dialog open onOpenChange={(isOpen) => { if (!isOpen) setConfirming(false) }}>
          <DialogContent showCloseButton={false} className="max-w-sm">
            <DialogHeader>
              <DialogTitle>¿Procesar los recursos existentes?</DialogTitle>
              <DialogDescription>
                Las imágenes y los PDF de las notas no privadas se enviarán a tu proveedor de IA
                para que su texto pueda aparecer en la búsqueda. Los recursos que ya tienen OCR se
                omiten.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(false)}>
                Cancelar
              </Button>
              <Button type="button" size="sm" onClick={() => void runBackfill()}>
                Procesar recursos
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </SettingsField>
  )
}
