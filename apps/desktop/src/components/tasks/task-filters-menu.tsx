import type { ReactElement } from 'react'
import { ListFilter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { TaskFilters, TaskFiltersControl } from '@/lib/tasks/task-filters'

const BUCKET_FILTERS: ReadonlyArray<{ key: keyof TaskFilters; label: string }> = [
  { key: 'pinned', label: 'Tareas fijadas' },
  { key: 'current', label: 'Tareas actuales' },
  { key: 'overdue', label: 'Tareas vencidas' },
  { key: 'upcoming', label: 'Tareas próximas' },
  { key: 'other', label: 'Otras tareas' },
]

interface TaskFiltersMenuProps extends TaskFiltersControl {
  /** Controlled open state, so ⌘⇧E can toggle the menu (V1). */
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * The Tasks view's "Task filters" dropdown (V1): per-bucket toggles plus
 * "Show archived tasks". Toggling keeps the menu open (`preventDefault` on
 * select) so several filters can be flipped at once. Open state is controlled so
 * the ⌘⇧E shortcut can open and close it.
 */
export function TaskFiltersMenu({
  filters,
  toggle,
  open,
  onOpenChange,
}: TaskFiltersMenuProps): ReactElement {
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="window-drag-control text-xs font-normal text-text-muted">
          <ListFilter aria-hidden className="size-3.5" />
          Filtros de tareas
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Tareas</DropdownMenuLabel>
        {BUCKET_FILTERS.map(({ key, label }) => (
          <DropdownMenuCheckboxItem
            key={key}
            checked={filters[key]}
            onCheckedChange={() => toggle(key)}
            onSelect={(event) => event.preventDefault()}
          >
            {label}
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={filters.archived}
          onCheckedChange={() => toggle('archived')}
          onSelect={(event) => event.preventDefault()}
        >
          Mostrar tareas archivadas
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
