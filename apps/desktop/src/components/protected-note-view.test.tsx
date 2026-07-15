import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ProtectedNoteView } from './protected-note-view'

const CONTENT = `---
title: Setext
---

Unsupported Setext Heading
==========================

body text
`

describe('ProtectedNoteView', () => {
  it('announces the read-only notice as an alert', () => {
    const view = render(<ProtectedNoteView content={CONTENT} />)
    const alert = view.getByRole('alert')
    expect(alert.textContent).toContain(
      'Esta nota tiene un formato que el editor aún no reproduce fielmente',
    )
    expect(alert.textContent).toContain('se muestra en solo lectura para no alterar el archivo')
    view.unmount()
  })

  it('shows the full file content verbatim, frontmatter included', () => {
    const view = render(<ProtectedNoteView content={CONTENT} />)
    const verbatim = view.container.querySelector('pre')
    expect(verbatim?.textContent).toBe(CONTENT)
    view.unmount()
  })
})
