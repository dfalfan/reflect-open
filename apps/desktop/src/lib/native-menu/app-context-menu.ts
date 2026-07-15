import { openNativeContextMenu } from './context-menu'

/**
 * The app-wide right-click menu: a deliberate minimum — Copiar / Pegar —
 * replacing the WebView's default everywhere. Predefined items dispatch the
 * native selectors at the focused element, so both work in the editor and in
 * plain inputs without any per-surface code. It grows item by item as needs
 * appear; a surface that owns a richer menu (the pinned rows) calls
 * `preventDefault` first and is left alone.
 *
 * Known trade-off, accepted deliberately: replacing the WebView menu in the
 * editor loses macOS spelling suggestions on right-click. The spell checker
 * still underlines; corrections just aren't offered from this menu yet.
 */
export function installAppContextMenu(target: Document = document): () => void {
  const onContextMenu = (event: MouseEvent): void => {
    if (event.defaultPrevented) {
      return
    }
    event.preventDefault()
    void openNativeContextMenu({
      items: [
        { predefined: 'Copy', text: 'Copiar' },
        { predefined: 'Paste', text: 'Pegar' },
      ],
    })
  }
  target.addEventListener('contextmenu', onContextMenu)
  return () => target.removeEventListener('contextmenu', onContextMenu)
}
