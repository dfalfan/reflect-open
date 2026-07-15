import type { ReactElement } from 'react'
import { CalendarDays } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSettings } from '@/providers/settings-provider'

/**
 * A discreet toggle under the calendar, bound to the same `dailyStreamTodayOnly`
 * setting as the Settings switch (both read and write the one flag, so they stay
 * in sync). Flips the daily view between the single opened day and the full
 * chronological stream without a trip to Settings — tinted accent when the
 * single-day view is on, muted otherwise, so it reads as an on/off filter.
 */
export function DailyViewToggle(): ReactElement {
  const { settings, updateSettings } = useSettings()
  const todayOnly = settings.dailyStreamTodayOnly

  return (
    <button
      type="button"
      onClick={() => updateSettings({ dailyStreamTodayOnly: !todayOnly })}
      aria-pressed={todayOnly}
      title={
        todayOnly
          ? 'Mostrando solo el día abierto. Haz clic para ver el flujo completo de días.'
          : 'Mostrando el flujo completo de días. Haz clic para ver solo el día abierto.'
      }
      className={cn(
        'group flex w-full items-center space-x-2 rounded-lg px-3 py-1.5 text-start transition-colors duration-100 hover:bg-surface-hover',
        todayOnly ? 'text-accent' : 'text-text-muted hover:text-text',
      )}
    >
      <span className="flex h-4 w-4 flex-none items-center justify-center">
        <CalendarDays size={14} aria-hidden />
      </span>
      <span className="min-w-0 flex-1 truncate text-xs font-medium">Solo un día</span>
    </button>
  )
}
