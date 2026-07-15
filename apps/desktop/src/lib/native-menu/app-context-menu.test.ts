import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const openNativeContextMenu = vi.hoisted(() => vi.fn(async () => {}))
vi.mock('./context-menu', () => ({ openNativeContextMenu }))

const { installAppContextMenu } = await import('./app-context-menu')

let uninstall: (() => void) | null = null

beforeEach(() => {
  openNativeContextMenu.mockClear()
})

afterEach(() => {
  uninstall?.()
  uninstall = null
})

function rightClick(init?: MouseEventInit): MouseEvent {
  const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, ...init })
  document.body.dispatchEvent(event)
  return event
}

describe('installAppContextMenu', () => {
  it('replaces the WebView menu with Copiar/Pegar', () => {
    uninstall = installAppContextMenu()
    const event = rightClick()
    expect(event.defaultPrevented).toBe(true)
    expect(openNativeContextMenu).toHaveBeenCalledWith({
      items: [
        { predefined: 'Copy', text: 'Copiar' },
        { predefined: 'Paste', text: 'Pegar' },
      ],
    })
  })

  it('leaves a surface that already owns its menu alone', () => {
    uninstall = installAppContextMenu()
    // A richer per-surface menu (the pinned rows) preventDefaults first.
    const owned = document.createElement('button')
    document.body.appendChild(owned)
    owned.addEventListener('contextmenu', (event) => event.preventDefault())
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
    owned.dispatchEvent(event)
    owned.remove()
    expect(openNativeContextMenu).not.toHaveBeenCalled()
  })

  it('uninstalls cleanly', () => {
    uninstall = installAppContextMenu()
    uninstall()
    uninstall = null
    const event = rightClick()
    expect(event.defaultPrevented).toBe(false)
    expect(openNativeContextMenu).not.toHaveBeenCalled()
  })
})
