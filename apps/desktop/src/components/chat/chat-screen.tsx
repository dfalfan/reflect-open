import type { ReactElement } from 'react'
import { MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { imageFilesFrom } from '@/lib/chat-attachments'
import { useChatSession } from '@/providers/chat-provider'
import { useRouter } from '@/routing/router'
import { ChatInput } from './chat-input'
import { ChatTurnList } from './chat-turn-list'

/**
 * The dedicated chat view (Plan 10, revised: a full route, not a side panel).
 * Read-only first wave: the assistant answers questions grounded in the
 * graph via search/read tools and cites notes as wiki links — it never
 * writes. With no AI provider configured the view is one call-to-action into
 * Settings; the conversation itself lives in {@link useChatSession}, so
 * navigating away and back keeps it.
 *
 * The whole view accepts dropped images — aiming for the composer exactly
 * shouldn't be required — and queues them as the next message's attachments.
 */
export function ChatScreen(): ReactElement {
  const { providers, attachImages } = useChatSession()
  const { navigate } = useRouter()

  if (providers.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-6">
        <div className="flex max-w-sm flex-col items-center text-center">
          <MessageSquare aria-hidden strokeWidth={1.5} className="size-8 text-text-muted" />
          <h2 className="mt-4 text-lg font-semibold text-text">Chatea con tus notas</h2>
          <p className="mt-2 text-sm text-text-muted">
            Agrega un proveedor de IA para empezar a chatear. Reflect llama al proveedor
            directamente con tu propia clave — se queda en el llavero del sistema, y las notas
            privadas nunca se envían.
          </p>
          <Button className="mt-5" onClick={() => navigate({ kind: 'settings' })}>
            Agregar un proveedor de IA
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="flex h-full min-h-0 flex-col"
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes('Files')) {
          event.preventDefault()
        }
      }}
      onDrop={(event) => {
        if (event.dataTransfer.files.length === 0) {
          return
        }
        // Claim every file drop, matching or not: the webview's default for
        // an unhandled file is to navigate to it, replacing the app.
        event.preventDefault()
        const files = imageFilesFrom(event.dataTransfer)
        if (files.length > 0) {
          void attachImages(files)
        }
      }}
    >
      <ChatTurnList />
      <ChatInput />
    </div>
  )
}
