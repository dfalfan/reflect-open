import { useEffect, type ReactElement } from 'react'
import { hasBridge, subscribeNoteMoved } from '@reflect/core'
import { App } from '@/app'
import { followHealedMove } from '@/editor/move-note'
import { OperationsStatus } from '@/components/operations-status'
import { UpdateToast } from '@/components/update-toast'
import { Toaster } from '@/components/ui/sonner'
import { WindowDragRegion } from '@/components/window-drag-region'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useMainWindowEffect } from '@/hooks/use-main-window-effect'
import { startDeepLinkListener } from '@/lib/deep-links/intake'
import { installAppContextMenu } from '@/lib/native-menu/app-context-menu'
import { trackSubscriptions } from '@/lib/subscriptions'
import { GraphProvider } from '@/providers/graph-provider'
import { SidebarWidthEffect } from '@/providers/sidebar-width'
import { UpdateProvider } from '@/providers/update-provider'

/**
 * The desktop surface tree (split out of `main.tsx` by the Plan 19 platform
 * gate): auto-update checks, the titlebar drag region, and the graph
 * chooser/workspace app — none of which exist on mobile.
 */
export function DesktopRoot(): ReactElement {
  // Deep-link intake starts with the surface, not the workspace: a
  // `reflect://` URL that launched the app (or arrived on the graph chooser)
  // buffers in `intake.ts` until a graph opens. Browser dev has no plugin.
  // Main window only: the plugin's event stream reaches every webview, and a
  // ⌘-clicked note window must not also navigate itself on OS-delivered URLs
  // (in-note `reflect://` clicks still work — `dispatchDeepLink` and the
  // handler are per-webview state).
  useMainWindowEffect(() => {
    if (!hasBridge()) {
      return
    }
    startDeepLinkListener().catch((cause: unknown) => {
      console.error('deep link listener failed to start:', cause)
    })
  }, [])

  // Renames commit in whichever window drove them (a title edit works in
  // note windows too) and broadcast on `note:moved` — EVERY window follows,
  // or its open sessions and router history keep the dead path. The origin
  // window also followed in-process; the echo is idempotent (the session no
  // longer matches `from`, and re-routing an absent entry is a no-op).
  useEffect(() => {
    if (!hasBridge()) {
      return
    }
    const subscriptions = trackSubscriptions()
    void subscriptions.add(subscribeNoteMoved(followHealedMove))
    return () => {
      subscriptions.disposeAll()
    }
  }, [])

  // The minimal app-wide right-click menu (Copiar/Pegar). Gated on the bridge
  // so plain-browser dev keeps the browser's own context menu — suppressing
  // it there would leave right-click doing nothing at all.
  useEffect(() => {
    if (!hasBridge()) {
      return
    }
    return installAppContextMenu()
  }, [])

  return (
    <UpdateProvider>
      <GraphProvider>
        <TooltipProvider>
          <SidebarWidthEffect />
          <WindowDragRegion />
          <App />
          <Toaster />
          <OperationsStatus />
          <UpdateToast />
        </TooltipProvider>
      </GraphProvider>
    </UpdateProvider>
  )
}
