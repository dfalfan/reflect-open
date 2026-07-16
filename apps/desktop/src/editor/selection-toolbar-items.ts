import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  Italic,
  List,
  ListOrdered,
  ListTodo,
  SquareCode,
  Strikethrough,
  TextQuote,
  Type,
} from 'lucide-react'
import type { MarkName } from '@meowdown/core'

/**
 * The selection toolbar's item catalog and block-identity reader — the
 * editor-schema knowledge, kept apart from the toolbar's overlay mechanics.
 */

export type FormatCommand =
  | 'toggleStrong'
  | 'toggleEm'
  | 'toggleDel'
  | 'toggleCode'
  | 'toggleHighlight'

export interface FormatSpec {
  command: FormatCommand
  mark: MarkName
  label: string
  /** macOS-style hint; the app targets macOS/iOS only. */
  shortcut: string
  icon: typeof Bold
}

/** The toolbar's format row, in display order (meowdown's inline marks). */
export const FORMATS: readonly FormatSpec[] = [
  { command: 'toggleStrong', mark: 'mdStrong', label: 'Negrita', shortcut: '⌘B', icon: Bold },
  { command: 'toggleEm', mark: 'mdEm', label: 'Cursiva', shortcut: '⌘I', icon: Italic },
  { command: 'toggleDel', mark: 'mdDel', label: 'Tachado', shortcut: '⇧⌘X', icon: Strikethrough },
  { command: 'toggleCode', mark: 'mdCode', label: 'Código', shortcut: '⌘E', icon: Code },
  {
    command: 'toggleHighlight',
    mark: 'mdHighlight',
    label: 'Resaltado',
    shortcut: '⇧⌘H',
    icon: Highlighter,
  },
]

export type BlockId =
  | 'text'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'bullet'
  | 'ordered'
  | 'task'
  | 'quote'
  | 'code'

export interface BlockSpec {
  id: BlockId
  label: string
  icon: typeof Bold
}

/** The "Convertir en" menu, in display order (Notion's turn-into). */
export const BLOCKS: readonly BlockSpec[] = [
  { id: 'text', label: 'Texto', icon: Type },
  { id: 'h1', label: 'Encabezado 1', icon: Heading1 },
  { id: 'h2', label: 'Encabezado 2', icon: Heading2 },
  { id: 'h3', label: 'Encabezado 3', icon: Heading3 },
  { id: 'bullet', label: 'Lista con viñetas', icon: List },
  { id: 'ordered', label: 'Lista numerada', icon: ListOrdered },
  { id: 'task', label: 'Lista de tareas', icon: ListTodo },
  { id: 'quote', label: 'Cita', icon: TextQuote },
  { id: 'code', label: 'Bloque de código', icon: SquareCode },
]

export type ListKind = 'bullet' | 'ordered' | 'task' | 'toggle'

/** Structural view of the selection's ancestors, for detect + convert. */
export interface ActiveBlockInfo {
  /** The menu entry the selection reads as (innermost recognizable type). */
  block: BlockId
  /** The wrapping list's kind, when the selection sits inside one. */
  listKind: ListKind | null
  inBlockquote: boolean
  /** The textblock the caret is in, for the convert-to-text normalization. */
  textblock: 'paragraph' | 'heading' | 'codeBlock' | null
}

interface AncestorNode {
  type: { name: string }
  attrs: Record<string, unknown>
}

/** The structural slice of ProseMirror's ResolvedPos the reader walks. */
export interface ResolvedFrom {
  depth: number
  node: (depth: number) => AncestorNode
}

function asListKind(value: unknown): ListKind | null {
  return value === 'bullet' || value === 'ordered' || value === 'task' || value === 'toggle'
    ? value
    : null
}

/**
 * Read the selection's block identity from its ancestor chain, innermost
 * first — a heading inside a list reads as the heading, like Notion's
 * turn-into menu.
 */
export function readActiveBlock($from: ResolvedFrom): ActiveBlockInfo {
  let block: BlockId | null = null
  let listKind: ListKind | null = null
  let inBlockquote = false
  let textblock: ActiveBlockInfo['textblock'] = null
  for (let depth = $from.depth; depth >= 0; depth--) {
    const node = $from.node(depth)
    const name = node.type.name
    if (name === 'heading') {
      textblock ??= 'heading'
      if (block === null) {
        const level = node.attrs['level']
        if (level === 1) block = 'h1'
        else if (level === 2) block = 'h2'
        else if (level === 3) block = 'h3'
      }
    } else if (name === 'codeBlock') {
      textblock ??= 'codeBlock'
      block ??= 'code'
    } else if (name === 'paragraph') {
      textblock ??= 'paragraph'
    } else if (name === 'list') {
      const kind = asListKind(node.attrs['kind']) ?? 'bullet'
      listKind ??= kind
      if (block === null) {
        const taskMarker = node.attrs['taskMarker']
        const checkable = kind === 'task' || (typeof taskMarker === 'string' && taskMarker !== '')
        block = checkable ? 'task' : kind === 'ordered' ? 'ordered' : 'bullet'
      }
    } else if (name === 'blockquote') {
      inBlockquote = true
      block ??= 'quote'
    }
  }
  return { block: block ?? 'text', listKind, inBlockquote, textblock }
}
