import { describe, expect, it } from 'vitest'
import { checkRoundTrip } from './roundtrip'

/**
 * The wrapper's contract: meowdown's verdict survives untouched except for
 * one forgiveness — table delimiter rows compare canonically, so padding
 * their dashes (Obsidian's habit) no longer locks the note read-only.
 */
describe('checkRoundTrip', () => {
  it('passes exact content through untouched', () => {
    expect(checkRoundTrip('# Hola\n\nTexto normal.')).toBe('exact')
    expect(checkRoundTrip('| A | B |\n| --- | --- |\n| 1 | 2 |')).toBe('exact')
  })

  it('forgives an Obsidian-style padded delimiter row as normalizing', () => {
    const obsidian = '| Aspecto | Detalle |\n|---------|---------|\n| **Modelo** | GPT-4o |'
    expect(checkRoundTrip(obsidian)).toBe('normalizing')
  })

  it('keeps alignment colons meaningful while forgiving dash padding', () => {
    const aligned = '| A | B | C |\n|:-----|:----:|-----:|\n| 1 | 2 | 3 |'
    expect(checkRoundTrip(aligned)).toBe('normalizing')
  })

  it('still refuses a ragged table the serializer would repair', () => {
    // The serializer completes the short row with an empty cell — a content
    // row change, not delimiter syntax, so the note stays protected.
    const ragged = '| A | B |\n|---|---|\n| solo |'
    expect(checkRoundTrip(ragged)).toBe('lossy')
  })

  it('still refuses a borderless table the serializer would rewrite', () => {
    // Adding border pipes rewrites content rows; forgiving that would need
    // table-block awareness, so it stays conservative.
    const borderless = 'A | B\n--|--\n1 | 2'
    expect(checkRoundTrip(borderless)).toBe('lossy')
  })

  it('never mistakes a thematic break for a delimiter row', () => {
    expect(checkRoundTrip('arriba\n\n---\n\nabajo')).toBe('exact')
  })
})
