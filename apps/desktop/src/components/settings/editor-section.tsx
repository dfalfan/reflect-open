import type { ReactElement } from 'react'
import type { EditorMarkdownSyntax, EditorTextSize } from '@reflect/core'
import { cn } from '@/lib/utils'
import { useSettings } from '@/providers/settings-provider'
import { SettingsField } from './field'
import { KeyboardShortcutsField } from './keyboard-shortcuts-field'
import { SettingsOptionCard } from './option-card'
import { SettingsSection } from './section'
import { SettingsSwitchField } from './switch-field'

interface MarkdownSyntaxOption {
  value: EditorMarkdownSyntax
  label: string
  description: string
}

const MARKDOWN_SYNTAX_OPTIONS: MarkdownSyntaxOption[] = [
  {
    value: 'hide',
    label: 'Ocultar',
    description: 'Siempre oculta',
  },
  {
    value: 'hybrid',
    label: 'Híbrido',
    description: 'Solo alrededor del cursor',
  },
  {
    value: 'show',
    label: 'Mostrar',
    description: 'Siempre visible',
  },
]

interface TextSizeOption {
  value: EditorTextSize
  label: string
  description: string
}

const TEXT_SIZE_OPTIONS: TextSizeOption[] = [
  {
    value: 'small',
    label: 'Pequeño',
    description: 'Compacto',
  },
  {
    value: 'medium',
    label: 'Mediano',
    description: 'Predeterminado',
  },
  {
    value: 'large',
    label: 'Grande',
    description: 'Cómodo',
  },
]

export function EditorSection(): ReactElement {
  const { settings, updateSettings } = useSettings()

  return (
    <SettingsSection id="editor">
      <SettingsField
        legend="Sintaxis Markdown"
        description="Cómo se muestran los caracteres literales de markdown (**, `, etc.) mientras editas."
      >
        <div className="mt-3 @container">
          <div className="grid grid-cols-1 gap-2 @xl:grid-cols-3">
            {MARKDOWN_SYNTAX_OPTIONS.map((option) => {
              const selected = settings.editorMarkdownSyntax === option.value
              return (
                <SettingsOptionCard
                  key={option.value}
                  selected={selected}
                  className="items-start justify-between gap-3 px-3 py-2.5"
                >
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        'block text-sm font-medium',
                        selected && 'text-accent-soft-text',
                      )}
                    >
                      {option.label}
                    </span>
                    <span className="mt-0.5 block text-xs text-text-muted">
                      {option.description}
                    </span>
                  </span>
                  <input
                    type="radio"
                    name="editor-markdown-syntax"
                    value={option.value}
                    checked={selected}
                    onChange={() => updateSettings({ editorMarkdownSyntax: option.value })}
                    className="mt-0.5 shrink-0 accent-accent"
                  />
                </SettingsOptionCard>
              )
            })}
          </div>
        </div>
      </SettingsField>

      <SettingsField
        legend="Tamaño del texto"
        description="El tamaño de lectura del editor de notas."
      >
        <div className="mt-3 @container">
          <div className="grid grid-cols-1 gap-2 @xl:grid-cols-3">
            {TEXT_SIZE_OPTIONS.map((option) => {
              const selected = settings.editorTextSize === option.value
              return (
                <SettingsOptionCard
                  key={option.value}
                  selected={selected}
                  className="items-start justify-between gap-3 px-3 py-2.5"
                >
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        'block text-sm font-medium',
                        selected && 'text-accent-soft-text',
                      )}
                    >
                      {option.label}
                    </span>
                    <span className="mt-0.5 block text-xs text-text-muted">
                      {option.description}
                    </span>
                  </span>
                  <input
                    type="radio"
                    name="editor-text-size"
                    value={option.value}
                    checked={selected}
                    onChange={() => updateSettings({ editorTextSize: option.value })}
                    className="mt-0.5 shrink-0 accent-accent"
                  />
                </SettingsOptionCard>
              )
            })}
          </div>
        </div>
      </SettingsField>

      <SettingsSwitchField
        legend="Notas a todo el ancho"
        description="Extiende el texto de la nota por toda la ventana con un pequeño margen en los bordes."
        checked={settings.editorFullWidth}
        onCheckedChange={(checked) => updateSettings({ editorFullWidth: checked })}
      />

      <SettingsSwitchField
        legend="Mostrar solo un día en las notas diarias"
        description="Colapsa la vista diaria al día que abres, ocultando el flujo de los demás días."
        checked={settings.dailyStreamTodayOnly}
        onCheckedChange={(checked) => updateSettings({ dailyStreamTodayOnly: checked })}
      />

      <SettingsSwitchField
        legend="Corrector ortográfico"
        description="Subraya las palabras mal escritas mientras escribes."
        checked={settings.editorSpellCheck}
        onCheckedChange={(checked) => updateSettings({ editorSpellCheck: checked })}
      />

      <SettingsSwitchField
        legend="Empezar con una viñeta"
        description="Las notas nuevas y vacías se abren con una sola viñeta, lista para escribir."
        checked={settings.editorDefaultBullet}
        onCheckedChange={(checked) => updateSettings({ editorDefaultBullet: checked })}
      />

      <SettingsSwitchField
        legend="Viñeta después de un encabezado"
        description="Al presionar Enter al final de un encabezado se inicia una nueva viñeta."
        checked={settings.editorBulletAfterHeading}
        onCheckedChange={(checked) => updateSettings({ editorBulletAfterHeading: checked })}
      />

      <KeyboardShortcutsField />
    </SettingsSection>
  )
}
