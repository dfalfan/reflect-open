import type { ReactElement, ReactNode } from 'react'
import { ShortcutKeys } from '@/components/shortcut-keys'
import { cn } from '@/lib/utils'

interface SidebarItemProps {
  /** A 24px icon node — the V1 custom glyphs, or a Lucide icon in a 24px box. */
  icon: ReactNode
  label: string
  /** Keymap binding hinted on hover/focus (e.g. `Mod-d`). */
  binding?: string | undefined
  active?: boolean
  onClick: () => void
}

/**
 * One primary-navigation row, in the original sidebar's idiom: 24px icon +
 * medium label on a translucent hover wash; selected rows keep the wash in
 * light mode and tint the text brand-indigo in dark, with the keyboard
 * shortcut revealed on hover — chrome that teaches the fast path.
 *
 * The hint is `invisible` rather than unmounted, so revealing it on hover never
 * reflows the row — but that reserved width is only affordable while the
 * sidebar is wide enough for both. Below that the hint stops rendering
 * altogether and the label takes the room: at the 200px floor a truncated
 * "Todas las notas" costs more than a shortcut the row only ever whispers.
 * The query container is the `nav` in {@link Sidebar}.
 */
export function SidebarItem({
  icon,
  label,
  binding,
  active = false,
  onClick,
}: SidebarItemProps): ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        // The row's height floor is the 24px icon box, not the text: past this
        // padding, only shrinking the glyphs would tighten it further.
        'group flex w-full items-center space-x-3 rounded-md px-2.5 py-0.5 text-xs font-medium',
        'transition-colors duration-100',
        active
          ? 'bg-surface-hover text-text dark:bg-transparent dark:text-accent'
          : 'text-text hover:bg-surface-hover',
      )}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate text-left">{label}</span>
      {binding ? (
        <ShortcutKeys
          binding={binding}
          className="hidden invisible @min-[13rem]:block group-hover:visible group-focus-visible:visible"
        />
      ) : null}
    </button>
  )
}
