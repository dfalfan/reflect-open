import { useState, type ReactElement } from 'react'
import { Plus } from 'lucide-react'
import type { AiPrompt } from '@reflect/core'
import { Button } from '@/components/ui/button'
import { useAiPrompts, type AiPromptDraft } from '@/hooks/use-ai-prompts'
import { AiPromptDialog } from './ai-prompt-dialog'
import { AiPromptRow } from './ai-prompt-row'
import { SettingsSection } from './section'

/**
 * Settings → AI prompts: the user's saved selection prompts, shown in the
 * editor's AI menu after the built-in set (fix grammar, summarize, …). Saved
 * prompts live in the settings document, global across graphs.
 */
export function AiPromptsSection(): ReactElement {
  const { prompts, addPrompt, updatePrompt, removePrompt } = useAiPrompts()
  // null = closed; 'new' = adding; an AiPrompt = editing that prompt.
  const [editing, setEditing] = useState<AiPrompt | 'new' | null>(null)

  const save = (draft: AiPromptDraft): void => {
    if (editing === 'new') {
      addPrompt(draft)
    } else if (editing !== null) {
      updatePrompt(editing.id, draft)
    }
  }

  return (
    <SettingsSection id="ai-prompts">
      {prompts.length === 0 ? (
        <p className="px-4 py-3.5 text-xs text-text-muted">
          No hay prompts guardados. Selecciona texto en una nota y presiona ⌘⇧J para ejecutar los
          prompts integrados; los prompts que guardes aquí aparecen después de ellos.
        </p>
      ) : (
        prompts.map((prompt) => (
          <AiPromptRow key={prompt.id} prompt={prompt} onEdit={setEditing} onRemove={removePrompt} />
        ))
      )}
      <div className="px-4 py-2.5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setEditing('new')}
          className="text-accent hover:bg-surface-hover"
        >
          <Plus aria-hidden strokeWidth={1.75} />
          Agregar prompt
        </Button>
      </div>
      {editing !== null ? (
        <AiPromptDialog
          prompt={editing === 'new' ? null : editing}
          onSave={save}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </SettingsSection>
  )
}
