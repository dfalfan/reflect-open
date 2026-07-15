import { useCallback } from 'react'
import { useRouter } from '@/routing/router'

/**
 * Navigation for a clicked inline `#tag`: open the notes screen filtered by
 * that tag, across every section (`section: null`) — a tag is a query over the
 * whole graph, not a folder, so the click must find the tagged notes wherever
 * they're filed. The tag name arrives without its leading `#` (meowdown strips
 * it) and feeds the same route the section filter tabs and chat tag chips drive.
 *
 * @returns a stable click handler for the note editor's tag extension.
 */
export function useTagNavigation(): (tag: string) => void {
  const { navigate } = useRouter()

  return useCallback(
    (tag: string) => {
      navigate({ kind: 'allNotes', section: null, tag })
    },
    [navigate],
  )
}
