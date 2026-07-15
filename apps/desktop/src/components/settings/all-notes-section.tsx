import { useState, type ReactElement } from 'react'
import { foldTag, isTagName } from '@reflect/core'
import { X } from 'lucide-react'
import { useSettings } from '@/providers/settings-provider'
import { SettingsField } from './field'
import { SettingsSection } from './section'

/**
 * Normalize a typed tag to its stored form: `#`-prefix stripped, trimmed,
 * folded (tag matching is case-insensitive everywhere, so storing the folded
 * form keeps the settings document canonical).
 */
function normalizeTagInput(value: string): string {
  return foldTag(value.trim().replace(/^#+/, '').trim())
}

/**
 * Which tags the All Notes screen pins as one-click filter tabs. Tags beyond
 * this list stay reachable through the screen's Custom menu, so removing one
 * here hides the tab, never the notes.
 */
export function AllNotesSection(): ReactElement {
  const { settings, updateSettings } = useSettings()
  const [draft, setDraft] = useState('')
  const [draftError, setDraftError] = useState<string | null>(null)
  const tags = settings.allNotesFilterTags

  const addTag = (): void => {
    const tag = normalizeTagInput(draft)
    if (tag === '') {
      return
    }
    // The indexer can never produce a name outside the `#tag` grammar, so a
    // pin that fails it would be a forever-empty filter — reject it here,
    // keeping the draft so the user can fix it.
    if (!isTagName(tag)) {
      setDraftError(
        `"${tag}" no puede ser una etiqueta: las etiquetas empiezan con una letra y usan letras, números, /, _ o -.`,
      )
      return
    }
    setDraft('')
    if (tags.some((existing) => foldTag(existing) === tag)) {
      return
    }
    updateSettings({ allNotesFilterTags: [...tags, tag] })
  }

  const removeTag = (tag: string): void => {
    updateSettings({ allNotesFilterTags: tags.filter((existing) => existing !== tag) })
  }

  return (
    <SettingsSection id="all-notes">
      <SettingsField
        legend="Etiquetas de filtro"
        description="Etiquetas fijadas como filtros de un clic en la parte superior de la pantalla Todas las notas."
      >
        <ul className="mt-3 flex flex-wrap items-center gap-1.5">
          {tags.map((tag) => (
            <li
              key={tag}
              className="flex items-center gap-1 rounded-full bg-surface-hover py-0.5 pl-2.5 pr-1 text-[13px] text-text-secondary"
            >
              #{tag}
              <button
                type="button"
                aria-label={`Quitar ${tag}`}
                onClick={() => removeTag(tag)}
                className="rounded-full p-0.5 text-text-muted transition-colors duration-100 hover:bg-border hover:text-text"
              >
                <X aria-hidden strokeWidth={2} className="size-3" />
              </button>
            </li>
          ))}
          {tags.length === 0 ? (
            <li className="text-[13px] text-text-muted">
              No hay etiquetas fijadas: la pantalla muestra solo la pestaña Todas y el menú Personalizado.
            </li>
          ) : null}
        </ul>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            addTag()
          }}
          className="mt-3 flex gap-2"
        >
          <input
            type="text"
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value)
              setDraftError(null)
            }}
            aria-label="Agregar etiqueta de filtro"
            aria-invalid={draftError !== null}
            placeholder="Agrega una etiqueta (ej. libro)"
            className="w-full max-w-60 rounded-[7px] border border-border-strong bg-input-bg px-2.5 py-1.5 text-sm text-text shadow-input placeholder:text-text-muted"
          />
          <button
            type="submit"
            className="rounded-[7px] border border-border-strong bg-surface px-3 py-1.5 text-sm font-medium text-text-secondary shadow-input transition-colors duration-100 hover:bg-surface-hover hover:text-text"
          >
            Agregar
          </button>
        </form>
        {draftError !== null ? (
          <p role="alert" className="mt-2 text-xs text-destructive">
            {draftError}
          </p>
        ) : null}
      </SettingsField>
    </SettingsSection>
  )
}
