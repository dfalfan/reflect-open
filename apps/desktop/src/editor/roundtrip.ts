/**
 * Round-trip safety guard (Plan 05b). Markdown is the durable source of truth,
 * so before the save pipeline rewrites a note, the editor must be able to
 * reproduce it. meowdown owns the base classifier; this module wraps it with
 * one forgiveness it lacks (table delimiter rows compare canonically) and the
 * rest of the app keeps importing from this one place. A `lossy` result opens
 * the note protected (read-only) rather than letting a converter gap silently
 * rewrite the file.
 */
import { checkRoundTrip as editorCheckRoundTrip, docToMarkdown, markdownToDoc } from '@meowdown/core'
import type { RoundTripFidelity } from '@meowdown/core'

export type { RoundTripFidelity } from '@meowdown/core'

/**
 * A GFM table delimiter row (after whitespace collapse): pipe-separated cells
 * of dashes with optional alignment colons. Requires at least one pipe so a
 * thematic break (`---`) can never match.
 */
const DELIMITER_ROW_RE = /^\|?(?:\s*:?-+:?\s*\|)*\s*:?-+:?\s*\|?$/

function isDelimiterRow(collapsed: string): boolean {
  return collapsed.includes('|') && DELIMITER_ROW_RE.test(collapsed)
}

/**
 * The canonical form of a delimiter row: one dash per cell, alignment colons
 * kept — the only bytes in the row that carry meaning. `|-----|:----:|` and
 * `| --- | :-: |` both become `-|:-:`.
 */
function canonicalDelimiterRow(collapsed: string): string {
  const cells = collapsed.split('|').map((cell) => cell.trim())
  if (cells[0] === '') {
    cells.shift()
  }
  if (cells[cells.length - 1] === '') {
    cells.pop()
  }
  return cells
    .map((cell) => `${cell.startsWith(':') ? ':' : ''}-${cell.endsWith(':') ? ':' : ''}`)
    .join('|')
}

/**
 * Meowdown's comparable-line shape — non-blank lines, whitespace collapsed —
 * plus table delimiter rows reduced to their canonical form, since their dash
 * counts are pure syntax. Both sides of the comparison go through this, so a
 * delimiter-shaped line inside a code fence (which round-trips verbatim)
 * canonicalizes identically on both and can't be falsely forgiven.
 */
function comparableLines(text: string): string[] {
  return text
    .split('\n')
    .filter((line) => !/^[\s>]*$/u.test(line))
    .map((line) => {
      const collapsed = line.trim().replaceAll(/\s+/gu, ' ')
      return isDelimiterRow(collapsed) ? canonicalDelimiterRow(collapsed) : collapsed
    })
}

/**
 * Meowdown's fidelity check, with delimiter-row forgiveness. Obsidian pads
 * delimiter rows to column width (`|---------|`), meowdown serializes them
 * minimal (`| --- |`) — a byte difference with zero content in it, which the
 * upstream check misreads as lossy and Reflect then opens read-only.
 * Everything else keeps the upstream verdict: differing line counts or any
 * non-delimiter line change is still lossy, so a parse that actually drops
 * content is never blessed.
 */
export function checkRoundTrip(markdown: string): RoundTripFidelity {
  const verdict = editorCheckRoundTrip(markdown)
  if (verdict !== 'lossy') {
    return verdict
  }
  const serialized = docToMarkdown(markdownToDoc(markdown))
  const original = comparableLines(markdown)
  const roundTripped = comparableLines(serialized)
  if (original.length !== roundTripped.length) {
    return 'lossy'
  }
  return original.every((line, index) => line === roundTripped[index]) ? 'normalizing' : 'lossy'
}
