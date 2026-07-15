import { useEffect, type ReactElement } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import type { AiPrompt, AiPromptMode } from '@reflect/core'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { AiPromptDraft } from '@/hooks/use-ai-prompts'

interface AiPromptDialogProps {
  /** The prompt being edited, or null when adding a new one. */
  prompt: AiPrompt | null
  /** Persists the draft (add or update). */
  onSave: (draft: AiPromptDraft) => void
  onClose: () => void
}

const FIELD_LABEL_CLASS = 'text-xs font-medium text-text-secondary'

/**
 * The add/edit dialog for a saved AI prompt: a label for the picker, the
 * prompt body (referencing the selection via `{{selectedText}}` — old
 * Reflect's syntax), and whether the accepted result replaces the selection
 * or is inserted below it.
 */
export function AiPromptDialog({ prompt, onSave, onClose }: AiPromptDialogProps): ReactElement {
  const { register, control, handleSubmit, setValue, formState } = useForm<AiPromptDraft>({
    defaultValues: {
      label: prompt?.label ?? '',
      body: prompt?.body ?? '',
      mode: prompt?.mode ?? 'replace',
    },
  })
  const mode = useWatch({ control, name: 'mode' })

  // The dialog is conditionally mounted by its parent, so Radix's close-focus
  // path is bypassed when Cancel or a successful submit calls onClose()
  // directly; restore the opener's focus ourselves.
  useEffect(() => {
    const opener = document.activeElement
    return () => {
      if (opener instanceof HTMLElement) {
        opener.focus()
      }
    }
  }, [])

  const submit = handleSubmit((values) => {
    onSave({ label: values.label.trim(), body: values.body.trim(), mode: values.mode })
    onClose()
  })

  return (
    <Dialog
      open
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose()
      }}
    >
      <DialogContent showCloseButton={false} className="max-w-md">
        <DialogHeader>
          <DialogTitle>{prompt === null ? 'Agregar prompt' : 'Editar prompt'}</DialogTitle>
          <DialogDescription>
            El prompt se ejecuta sobre el texto que selecciones en una nota. Usa{' '}
            <code className="font-mono text-xs">{'{{selectedText}}'}</code> donde debería aparecer
            la selección.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            void submit(event)
          }}
        >
          <label className="flex flex-col gap-1.5">
            <span className={FIELD_LABEL_CLASS}>Etiqueta</span>
            <Input
              {...register('label', { required: true })}
              aria-invalid={formState.errors.label !== undefined || undefined}
              placeholder="Traducir al francés"
              autoFocus
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={FIELD_LABEL_CLASS}>Prompt</span>
            <Textarea
              {...register('body', { required: true })}
              aria-invalid={formState.errors.body !== undefined || undefined}
              rows={5}
              placeholder={'Traduce el siguiente texto al francés.\n\n{{selectedText}}'}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={FIELD_LABEL_CLASS}>Resultado</span>
            <Select
              value={mode}
              onValueChange={(value) => setValue('mode', value as AiPromptMode)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="replace">Reemplaza la selección</SelectItem>
                <SelectItem value="append">Se inserta debajo de la selección</SelectItem>
              </SelectContent>
            </Select>
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit">{prompt === null ? 'Agregar prompt' : 'Guardar'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
