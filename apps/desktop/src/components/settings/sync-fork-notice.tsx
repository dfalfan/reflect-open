import type { ReactElement } from 'react'
import type { DuplicateIdGroup } from '@reflect/core'

interface SyncForkNoticeProps {
  groups: DuplicateIdGroup[]
}

/**
 * The sync-fork review notice (Plan 17): two files claiming one frontmatter
 * `id` — the same note renamed differently on two devices, now existing as
 * separate files. Shown beside the marker-conflict count in the backup
 * section, in the same quiet amber as that notice (informational, not a
 * banner); repair is the user's call, never automatic. Renders nothing when
 * there are no forks.
 */
export function SyncForkNotice({ groups }: SyncForkNoticeProps): ReactElement | null {
  if (groups.length === 0) {
    return null
  }
  return (
    <div className="text-xs text-amber-700 dark:text-amber-300">
      <p>
        {groups.length === 1
          ? '1 nota se renombró de forma distinta en dos dispositivos y ahora existe como archivos separados'
          : `${groups.length} notas se renombraron de forma distinta en dos dispositivos y ahora existen como archivos separados`}{' '}
        — combínalas a mano, luego elimina la copia que no quieras:
      </p>
      <ul className="mt-1 list-disc pl-4">
        {groups.map((group) => (
          <li key={group.id}>{group.paths.join('  ·  ')}</li>
        ))}
      </ul>
    </div>
  )
}
