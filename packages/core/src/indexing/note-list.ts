import { sql, type RawBuilder, type SqlBool } from 'kysely'
import { SECTION_SUBDIRS, sectionDir, type NoteSection } from '../graph/paths'
import { foldTag } from '../markdown'
import { db } from './db'
import { recallOrder } from './filtered-search'

/**
 * The notes list: every regular note, pinned first then newest, optionally
 * narrowed to one section and/or one tag. Daily notes are excluded by design —
 * the stream is their home — and templates are boilerplate, not graph content;
 * `kind = 'note'` expresses both (mirroring the original app's `isDaily = 0`).
 * Uncapped: the screen virtualizes, the row
 * snippet is the stored `preview` column (derived once at index time), and
 * neither query carries a per-row parameter, so list size has no SQL ceiling.
 */

/** One row of the notes list. */
export interface NoteListEntry {
  path: string
  title: string
  /** The indexed row preview (`buildIndexedNote`; may be empty). */
  snippet: string
  /** The note's body tags (first-seen casing), alphabetical. */
  tags: string[]
  /** File modification time (epoch ms) — the list's recency sort key. */
  mtime: number
  /** Pinned notes lead the list (V1 order) and show a pin marker. */
  isPinned: boolean
}

export interface NoteListOptions {
  /** Only notes carrying this tag (case-insensitive). `null` lists all. */
  tag?: string | null
  /** Only notes filed in this section. `null` spans all three. */
  section?: NoteSection | null
}

/**
 * The WHERE expression narrowing `notes` rows to one section by path prefix.
 * `kind = 'note'` already confines rows to `notes/`, so the inbox — the loose
 * root — is "not in any section subdirectory" rather than its own prefix; that
 * also sweeps hypothetical stray subfolders into the inbox, matching
 * `sectionOfPath`.
 */
function sectionWhere(section: NoteSection): RawBuilder<SqlBool> {
  if (section === 'inbox') {
    const conditions = SECTION_SUBDIRS.map(
      (subdir) => sql<SqlBool>`notes.path NOT LIKE ${`${sectionDir(subdir)}/%`}`,
    )
    return sql<SqlBool>`(${sql.join(conditions, sql` AND `)})`
  }
  return sql<SqlBool>`notes.path LIKE ${`${sectionDir(section)}/%`}`
}

/**
 * Non-daily notes for the All Notes screen: pinned first (explicit pin order,
 * then unordered pins), then most recently edited — V1's list order.
 */
export async function listNotes(options: NoteListOptions = {}): Promise<NoteListEntry[]> {
  const tag = options.tag ?? null
  const section = options.section ?? null

  let listQuery =
    tag === null
      ? db
          .selectFrom('notes')
          .where('notes.kind', '=', 'note')
          .select([
            'notes.path',
            'notes.title',
            'notes.mtime',
            'notes.preview',
            'notes.isPinned',
            'notes.pinnedOrder',
          ])
      : db
          .selectFrom('tags')
          .innerJoin('notes', 'notes.path', 'tags.notePath')
          .where('tags.tagKey', '=', foldTag(tag))
          .where('notes.kind', '=', 'note')
          .select([
            'notes.path',
            'notes.title',
            'notes.mtime',
            'notes.preview',
            'notes.isPinned',
            'notes.pinnedOrder',
          ])
          .distinct()
  if (section !== null) {
    listQuery = listQuery.where(sectionWhere(section))
  }
  for (const order of recallOrder(true)) {
    listQuery = listQuery.orderBy(order)
  }
  const rows = await listQuery.execute()

  if (rows.length === 0) {
    return []
  }

  // Tags for the same note set, via the same predicates — a join rather than a
  // `note_path IN (…)` list, which would put a per-row parameter between the
  // list and SQLite's bound-parameter ceiling.
  let tagQuery =
    tag === null
      ? db
          .selectFrom('tags')
          .innerJoin('notes', 'notes.path', 'tags.notePath')
          .where('notes.kind', '=', 'note')
          .select(['tags.notePath', 'tags.tag'])
      : db
          .selectFrom('tags')
          .innerJoin('notes', 'notes.path', 'tags.notePath')
          .innerJoin('tags as filterTags', 'filterTags.notePath', 'notes.path')
          .where('filterTags.tagKey', '=', foldTag(tag))
          .where('notes.kind', '=', 'note')
          .select(['tags.notePath', 'tags.tag'])
          .distinct()
  if (section !== null) {
    tagQuery = tagQuery.where(sectionWhere(section))
  }
  // Order on the folded key so a row's tags read in the same alphabetical
  // order as the facet list, regardless of display casing.
  const tagRows = await tagQuery.orderBy('tags.tagKey').execute()
  const tagsByPath = new Map<string, string[]>()
  for (const row of tagRows) {
    const tags = tagsByPath.get(row.notePath)
    if (tags === undefined) {
      tagsByPath.set(row.notePath, [row.tag])
    } else {
      tags.push(row.tag)
    }
  }

  return rows.map((row) => ({
    path: row.path,
    title: row.title,
    mtime: row.mtime,
    snippet: row.preview,
    tags: tagsByPath.get(row.path) ?? [],
    isPinned: row.isPinned !== 0,
  }))
}

/** One row of the recent-notes listing (the AI chat's recents tool). */
export interface RecentNoteRow {
  path: string
  title: string
  /** The indexed row preview (`buildIndexedNote`; may be empty). */
  preview: string
  /** File modification time (epoch ms). */
  mtime: number
  isPrivate: boolean
}

export interface RecentNotesOptions {
  /** Row cap — the most recently edited notes win. */
  limit: number
  /** Only notes carrying this tag (case-insensitive). `null` lists all. */
  tag?: string | null
}

/**
 * The most recently edited non-daily notes, newest first. Same population as
 * {@link listNotes} (dailies live in their own date-keyed listing) but capped,
 * without the per-note tag fetch, and with private notes excluded in SQL so
 * they don't consume cap slots — the AI privacy gate still re-checks every
 * row live before anything leaves the device.
 */
export async function listRecentNotes(options: RecentNotesOptions): Promise<RecentNoteRow[]> {
  const tag = options.tag ?? null

  const rows =
    tag === null
      ? await db
          .selectFrom('notes')
          .where('notes.kind', '=', 'note')
          .where('notes.isPrivate', '=', 0)
          .select(['notes.path', 'notes.title', 'notes.preview', 'notes.mtime', 'notes.isPrivate'])
          .orderBy('notes.mtime', 'desc')
          .orderBy('notes.path')
          .limit(options.limit)
          .execute()
      : await db
          .selectFrom('tags')
          .innerJoin('notes', 'notes.path', 'tags.notePath')
          .where('tags.tagKey', '=', foldTag(tag))
          .where('notes.kind', '=', 'note')
          .where('notes.isPrivate', '=', 0)
          .select(['notes.path', 'notes.title', 'notes.preview', 'notes.mtime', 'notes.isPrivate'])
          .distinct()
          .orderBy('notes.mtime', 'desc')
          .orderBy('notes.path')
          .limit(options.limit)
          .execute()
  return rows.map((row) => ({ ...row, isPrivate: row.isPrivate !== 0 }))
}

/** One tag facet over the note list: display casing + non-daily note count. */
export interface NoteTagFacet {
  tag: string
  count: number
}

export interface NoteTagsOptions {
  /** Only count notes filed in this section. `null` spans all three. */
  section?: NoteSection | null
}

/**
 * Every tag carried by at least one non-daily note, with how many such notes
 * carry it, alphabetical. Grouped on the stored `tag_key`, matching the tag
 * filter (and the `#tag` search token): `#Book` and `#book` are one facet,
 * displayed with one deterministic casing.
 */
export async function listNoteTags(options: NoteTagsOptions = {}): Promise<NoteTagFacet[]> {
  const section = options.section ?? null
  let query = db
    .selectFrom('tags')
    .innerJoin('notes', 'notes.path', 'tags.notePath')
    .where('notes.kind', '=', 'note')
    .select([sql<string>`min(tags.tag)`.as('tag'), sql<number>`count(*)`.as('count')])
  if (section !== null) {
    query = query.where(sectionWhere(section))
  }
  return query.groupBy('tags.tagKey').orderBy('tags.tagKey').execute()
}
