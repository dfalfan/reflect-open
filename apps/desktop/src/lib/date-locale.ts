import { setDefaultOptions } from 'date-fns'
import { es } from 'date-fns/locale'

/**
 * App-wide Spanish locale for date-fns. With this default set once at startup,
 * every `format()` / `formatDistanceToNow()` call that doesn't pass its own
 * `locale` renders month names, weekdays, and relative times in Spanish — so
 * the calendar header ("julio 2026"), weekday columns ("lu ma mi…"), and
 * relative timestamps ("hace 2 horas") are localized without touching each
 * call site. Imported for its side effect from `main.tsx`, before first render.
 */
setDefaultOptions({ locale: es })
