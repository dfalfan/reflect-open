import { isTauri } from '@tauri-apps/api/core'
import { Menu, type MenuItemOptions, type PredefinedMenuItemOptions } from '@tauri-apps/api/menu'

export type NativeContextMenuItem =
  | {
      /** Visible native menu item label. */
      text: string
      /** Invoked when the native menu item is selected. */
      action: () => void
    }
  | {
      /**
       * A native-role item (Copy, Paste, Separator, …): macOS dispatches the
       * standard selector at the focused element, so Copy/Paste work in the
       * editor and in plain inputs alike — the same items the window's Edit
       * menu uses.
       */
      predefined: PredefinedMenuItemOptions['item']
      /** Label override (the native default is English). */
      text?: string
    }

export interface NativeContextMenuOptions {
  /** Menu items to render in order. */
  items: readonly NativeContextMenuItem[]
}

function itemOptions(item: NativeContextMenuItem): MenuItemOptions | PredefinedMenuItemOptions {
  return 'predefined' in item
    ? { item: item.predefined, ...(item.text !== undefined ? { text: item.text } : {}) }
    : { text: item.text, action: item.action }
}

/**
 * Open a Tauri native context menu. Outside Tauri, this is a no-op so browser
 * and test shells can call the same path without platform guards.
 */
export async function openNativeContextMenu(options: NativeContextMenuOptions): Promise<void> {
  if (!isTauri()) {
    return
  }

  const menu = await Menu.new({ items: options.items.map(itemOptions) })
  await menu.popup()
}
