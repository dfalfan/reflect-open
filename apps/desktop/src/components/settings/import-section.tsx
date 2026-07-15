import type { ReactElement } from 'react'
import { open } from '@tauri-apps/plugin-dialog'
import { FileArchive } from 'lucide-react'
import { SettingsField } from '@/components/settings/field'
import { SettingsSection } from '@/components/settings/section'
import { Button } from '@/components/ui/button'
import { useV1Import } from '@/providers/v1-import-provider'

/**
 * Settings -> Import: pick a Reflect V1 export zip and hand it to the
 * workspace's {@link useV1Import} controller, which runs the import and shows
 * its progress in a modal dialog — the import outlives this section, so
 * navigating away from settings doesn't interrupt it.
 */
export function ImportSection(): ReactElement {
  const { state, startImport } = useV1Import()
  const running = state.phase === 'running'

  async function chooseAndImport(): Promise<void> {
    const result = await open({
      multiple: false,
      directory: false,
      title: 'Importar exportación de Reflect V1',
      filters: [{ name: 'Archivos Zip', extensions: ['zip'] }],
    })
    const path = typeof result === 'string' ? result : null
    if (path === null) {
      return
    }
    startImport(path)
  }

  return (
    <SettingsSection id="import">
      <SettingsField
        legend="Reflect V1"
        description="Elige la exportación .zip de Reflect V1. Sus notas y adjuntos se agregan a este grafo; no se reemplaza nada de lo que ya está aquí."
      >
        <div className="mt-2">
          <Button
            type="button"
            size="xs"
            variant="outline"
            disabled={running}
            onClick={() => void chooseAndImport()}
          >
            <FileArchive aria-hidden strokeWidth={1.75} />
            {running ? 'Importando...' : 'Importar zip...'}
          </Button>
        </div>
      </SettingsField>
    </SettingsSection>
  )
}
