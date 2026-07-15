import type { ReactElement } from 'react'
import {
  dateFormatSchema,
  timeFormatSchema,
  weekStartDaySchema,
  type DateFormat,
  type TimeFormat,
  type WeekStartDay,
} from '@reflect/core'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatFullDate } from '@/lib/dates'
import { useSettings } from '@/providers/settings-provider'
import { SettingsField } from './field'
import { SettingsSection } from './section'

interface TimeFormatOption {
  value: TimeFormat
  label: string
}

interface WeekStartOption {
  value: WeekStartDay
  label: string
}

const TIME_FORMAT_OPTIONS: TimeFormatOption[] = [
  { value: '12h', label: '12 horas' },
  { value: '24h', label: '24 horas' },
]

const WEEK_START_OPTIONS: WeekStartOption[] = [
  { value: 'monday', label: 'Lunes' },
  { value: 'sunday', label: 'Domingo' },
]

// The options demonstrate themselves: each shows today's date in its format,
// so the day/month order is visible rather than described.
const DATE_FORMAT_VALUES: DateFormat[] = ['mdy', 'dmy', 'iso']

/**
 * Date & time display preferences. Both formats feed every date and time the
 * app renders (via `formatDayLabel`/`formatTimeOfDay`/`formatRecencyLabel` in
 * `lib/dates.ts`) — display-only, so switching them never touches stored
 * timestamps or daily-note keys.
 */
export function DateTimeSection(): ReactElement {
  const { settings, updateSettings } = useSettings()
  const today = new Date()

  return (
    <SettingsSection id="date-time">
      <SettingsField
        legend="Formato de fecha"
        description="El estilo de las fechas que se muestran en todo Reflect, incluidos los títulos de las notas diarias."
      >
        <div className="mt-3">
          <Select
            value={settings.dateFormat}
            onValueChange={(value) => updateSettings({ dateFormat: dateFormatSchema.parse(value) })}
          >
            <SelectTrigger aria-label="Formato de fecha" className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATE_FORMAT_VALUES.map((value) => (
                <SelectItem key={value} value={value}>
                  {formatFullDate(today, value)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </SettingsField>
      <SettingsField
        legend="Empezar la semana en"
        description="El primer día que se muestra en los calendarios."
      >
        <div className="mt-3">
          <Select
            value={settings.weekStartDay}
            onValueChange={(value) =>
              updateSettings({ weekStartDay: weekStartDaySchema.parse(value) })
            }
          >
            <SelectTrigger aria-label="Empezar la semana en" className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WEEK_START_OPTIONS.map(({ value, label }) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </SettingsField>
      <SettingsField
        legend="Formato de hora"
        description="Cómo se muestran las horas en todo Reflect: 8:22pm o 20:22."
      >
        <div className="mt-3">
          <Select
            value={settings.timeFormat}
            onValueChange={(value) => updateSettings({ timeFormat: timeFormatSchema.parse(value) })}
          >
            <SelectTrigger aria-label="Formato de hora" className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIME_FORMAT_OPTIONS.map(({ value, label }) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </SettingsField>
    </SettingsSection>
  )
}
