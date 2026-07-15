import {
  errorMessage,
  getNote,
  getPinnedNotes,
  hasBridge,
  randomNotePath,
  toggleDevtools,
  untitledNotePath,
} from '@reflect/core'
import { attachFilesToNote } from '@/lib/attach-files'
import { runCopyDeepLink } from '@/lib/note-deep-link'
import { runGistPublish } from '@/lib/note-gist'
import { toggleNotePinned } from '@/lib/note-pin'
import { toggleNotePrivate } from '@/lib/note-private'
import { startOperation } from '@/lib/operations'
import { rebuildIndexVisibly } from '@/lib/rebuild-index'
import { openRouteInNewWindow } from '@/lib/windows/open-in-new-window'
import { routeForPath, type Route } from '@/routing/route'
import { registerCommands } from './registry'
import type { AppCommand, CommandContext } from './types'

/**
 * The first-wave commands (Plan 08). Keybindings here replace the hardcoded
 * switch that used to live in `app-shortcuts.ts` — the binding and the
 * behavior are one definition now.
 */

/**
 * A fresh note route; the file itself is created lazily on the first keystroke
 * (the same contract as daily notes). Shared by ⌘N and the All Notes screen's
 * New note button so "what a new note is" stays one definition.
 */
export function newNoteRoute(): Route {
  return { kind: 'note', path: untitledNotePath() }
}

/**
 * ⌘N from the daily stream leaves its saved scroll offsets behind as stale
 * state: the fresh note is where attention moves, so a later return to the
 * stream — ⌘[ back or the Daily nav tab — should re-anchor to its target, not
 * restore the pre-note position. Other routes keep their offsets; only the
 * stream re-anchors around note creation.
 */
function openNewNote(context: CommandContext): void {
  const route = context.route()
  if (route.kind === 'today' || route.kind === 'daily') {
    context.clearScrollState()
  }
  context.navigate(newNoteRoute())
}

const GRAPH_SWITCH_COMMANDS: AppCommand[] = Array.from({ length: 9 }, (_, index) => {
  const position = index + 1
  return {
    id: `graph.switch${position}`,
    title: `Cambiar al grafo ${position}`,
    keywords: ['grafo', 'espacio de trabajo', 'cambiar', 'reciente', 'graph', 'workspace'],
    keybinding: `Meta-${position}`,
    run: (context) => context.switchGraph(index),
  }
})

const APP_COMMANDS: AppCommand[] = [
  ...GRAPH_SWITCH_COMMANDS,
  {
    id: 'nav.today',
    title: 'Ir a hoy',
    keywords: ['diaria', 'hoy', 'ahora', 'daily'],
    keybinding: 'Mod-d',
    // ⌘D is a capture gesture, not just navigation: the arrival asks the
    // stream to focus today's editor with the caret at the end of its
    // content, ready to append — the same one-shot `focusEditor` intent as
    // the mobile Daily-tab double-tap. Ordinary daily links and history
    // moves stay on the calm default (focus at the note start, or none).
    run: (context) => context.navigate({ kind: 'today' }, { focusEditor: true }),
  },
  {
    id: 'nav.allNotes',
    title: 'Todas las notas',
    keywords: ['notas', 'lista', 'explorar', 'biblioteca', 'notes'],
    keybinding: 'Mod-Shift-a',
    run: (context) => context.navigate({ kind: 'allNotes', tag: null }),
  },
  {
    id: 'nav.tasks',
    title: 'Tareas',
    keywords: ['pendientes', 'tareas', 'lista', 'casilla', 'abrir', 'todo'],
    keybinding: 'Mod-t',
    run: (context) => context.navigate({ kind: 'tasks' }),
  },
  {
    id: 'note.new',
    title: 'Nota nueva',
    keywords: ['crear', 'nueva', 'create'],
    keybinding: 'Mod-n',
    run: openNewNote,
  },
  {
    id: 'note.openInNewWindow',
    title: 'Abrir nota en ventana nueva',
    keywords: ['ventana', 'duplicar', 'window'],
    keybinding: 'Mod-Shift-o',
    // `notePath` follows the focused day inside the daily stream. Converting
    // that path back to a route also canonicalizes Today to a dated daily
    // link, so every way of opening the day dedupes to the same window.
    run: async (context) => {
      const path = context.notePath()
      if (path === null) {
        return
      }
      await openRouteInNewWindow(routeForPath(path))
    },
  },
  {
    id: 'chat.open',
    title: 'Chat',
    keywords: ['ia', 'asistente', 'copilot', 'preguntar', 'ai'],
    keybinding: 'Mod-j',
    run: (context) => context.navigate({ kind: 'chat' }),
  },
  {
    id: 'chat.new',
    title: 'Chat nuevo',
    keywords: ['ia', 'asistente', 'copilot', 'conversación', 'ai'],
    keybinding: 'Mod-Shift-n',
    run: (context) => {
      if (context.route().kind !== 'chat') {
        return
      }
      context.newChat()
    },
  },
  {
    id: 'history.back',
    title: 'Atrás',
    keybinding: 'Mod-[',
    run: (context) => context.back(),
  },
  {
    id: 'history.forward',
    title: 'Adelante',
    keybinding: 'Mod-]',
    run: (context) => context.forward(),
  },
  {
    id: 'palette.open',
    title: 'Buscar…',
    keywords: ['buscar', 'encontrar', 'abrir', 'find'],
    keybinding: 'Mod-k',
    run: (context) => context.openPalette(),
  },
  {
    id: 'note.togglePin',
    title: 'Fijar o desfijar nota',
    keywords: ['fijada', 'favorito', 'marcador', 'barra lateral', 'pin'],
    // The original app's pin shortcut. Flips the `pinned` frontmatter flag of
    // the note the current route edits; on search/settings there is no such
    // note and the command is a no-op.
    keybinding: 'Mod-o',
    run: async (context) => {
      const generation = context.generation()
      const path = context.notePath()
      if (generation === null || path === null) {
        return
      }
      // Read the current state first so a failure is surfaced with the toggle's
      // actual direction — the sidebar's pin/unpin wording — not a fixed label.
      let wasPinned = false
      try {
        wasPinned = (await getPinnedNotes()).some((note) => note.path === path)
        await toggleNotePinned(path, generation)
      } catch (cause) {
        // runCommand has no error channel of its own — an unreported failure
        // here would be a silent ⌘O. Surface it like other background work.
        startOperation(wasPinned ? 'Desfijando nota' : 'Fijando nota').fail(errorMessage(cause))
      }
    },
  },
  {
    id: 'note.togglePrivate',
    title: 'Marcar o desmarcar nota como privada',
    keywords: ['privacidad', 'bloquear', 'secreto', 'ocultar', 'ia', 'private'],
    // Flips the `private` frontmatter flag — the hard block on sending the
    // note's content to AI or any other external service — of the note the
    // current route edits. No default keybinding: the palette keeps it
    // keyboard-reachable without spending a shortcut.
    run: async (context) => {
      const generation = context.generation()
      const path = context.notePath()
      if (generation === null || path === null) {
        return
      }
      // Read the current flag first so a failure is surfaced with the toggle's
      // actual direction — the sidebar's Lock/Unlock wording — instead of a
      // fixed "private" label that misreads when the user is unlocking.
      let wasPrivate = false
      try {
        wasPrivate = (await getNote(path))?.isPrivate ?? false
        await toggleNotePrivate(path, generation)
      } catch (cause) {
        startOperation(wasPrivate ? 'Desbloqueando nota' : 'Bloqueando nota').fail(errorMessage(cause))
      }
    },
  },
  {
    id: 'note.publishGist',
    title: 'Compartir con enlace privado',
    keywords: ['gist', 'github', 'compartir', 'publicar', 'enlace privado', 'exportar'],
    // Publishes the body of the note the current route edits to a secret
    // GitHub gist (republishing to the same gist thereafter) and copies the
    // link. No default keybinding: the palette keeps it keyboard-reachable
    // without spending a shortcut. `runGistPublish` owns all feedback — the
    // progress line, the failure surface, and the "link copied" confirmation.
    run: async (context) => {
      const generation = context.generation()
      const path = context.notePath()
      if (generation === null || path === null) {
        return
      }
      await runGistPublish(path, generation)
    },
  },
  {
    id: 'note.attachFile',
    title: 'Adjuntar archivo…',
    keywords: ['subir', 'adjunto', 'importar', 'pdf', 'documento', 'insertar'],
    // Native file picker → copies into the graph's `assets/` → a markdown
    // link per file at the caret (the keyboard-native twin of dropping a
    // file on the note). No default keybinding: the palette keeps it
    // keyboard-reachable without spending a shortcut.
    run: (context) => attachFilesToNote(context),
  },
  {
    id: 'note.copyDeepLink',
    title: 'Copiar enlace directo',
    keywords: ['url', 'compartir', 'portapapeles', 'reflect://', 'dirección'],
    // The original app's copy-link shortcut. Copies a `reflect://` address for
    // the note the current route edits — id-shaped so it survives renames,
    // minting the frontmatter id on first copy. `runCopyDeepLink` owns all
    // feedback (the "Deep link copied" status line and failure surfaces).
    keybinding: 'Alt-Mod-l',
    run: async (context) => {
      const generation = context.generation()
      const path = context.notePath()
      if (generation === null || path === null) {
        return
      }
      await runCopyDeepLink(path, generation)
    },
  },
  {
    id: 'note.random',
    title: 'Abrir nota al azar',
    keywords: ['azar', 'aleatorio', 'serendipia'],
    run: async (context) => {
      const path = await randomNotePath()
      if (path !== null) {
        context.navigate({ kind: 'note', path })
      }
    },
  },
  {
    id: 'template.insert',
    title: 'Insertar plantilla…',
    keywords: ['fragmento', 'plantilla', 'insertar'],
    // Inserts into the note the current route edits (the focused stream day on
    // daily views); on screens with no note there is nothing to insert into.
    // The picker itself carries the empty state — a "New template" row — so
    // the command stays discoverable before any template exists.
    run: (context) => {
      if (context.notePath() === null) {
        return
      }
      context.openTemplatePicker()
    },
  },
  {
    id: 'template.new',
    title: 'Plantilla nueva',
    keywords: ['plantilla', 'fragmento', 'crear', 'template'],
    run: (context) => context.openTemplateCreate(),
  },
  {
    id: 'audioMemo.toggle',
    title: 'Grabar memo de audio',
    keywords: ['voz', 'micrófono', 'dictar', 'transcribir', 'habla', 'capturar'],
    keybinding: 'Mod-Shift-r',
    run: (context) => context.toggleAudioMemo(),
  },
  {
    id: 'theme.toggle',
    title: 'Cambiar tema',
    keywords: ['oscuro', 'claro', 'apariencia', 'tema'],
    run: (context) => context.toggleTheme(),
  },
  {
    id: 'sidebar.toggle',
    title: 'Mostrar u ocultar barra lateral',
    keywords: ['colapsar', 'expandir', 'navegación', 'enfoque', 'barra lateral'],
    keybinding: 'Mod-\\',
    run: (context) => context.toggleSidebar(),
  },
  {
    id: 'settings.open',
    title: 'Abrir ajustes',
    keywords: ['preferencias', 'configuración', 'opciones', 'ajustes'],
    keybinding: 'Mod-,',
    run: (context) => context.navigate({ kind: 'settings' }),
  },
  {
    id: 'shortcuts.show',
    title: 'Atajos de teclado',
    keywords: ['atajos', 'teclas', 'ayuda', 'hotkeys'],
    keybinding: 'Mod-/',
    run: (context) => context.openShortcuts(),
  },
  {
    id: 'semantic.enable',
    title: 'Activar búsqueda semántica',
    keywords: ['embeddings', 'ia', 'similar', 'modelo', 'semántica'],
    // Downloads the local model (~90MB) — deliberately opt-in, never
    // automatic: the first network fetch is the user's call. Persisting the
    // setting is the entire command — EmbeddingsSync loads the model when the
    // flag flips on and backfills once it's `ready`; later launches load from
    // cache without asking again.
    run: (context) => context.enableSemanticSearch(),
  },
  {
    id: 'index.rebuild',
    title: 'Reconstruir índice de búsqueda',
    keywords: ['reindexar', 'actualizar', 'índice'],
    run: async (context) => {
      const generation = context.generation()
      if (generation === null) {
        return
      }
      await rebuildIndexVisibly(generation)
    },
  },
  {
    id: 'dev.toggleDevtools',
    title: 'Herramientas de desarrollo',
    keywords: ['devtools', 'inspector', 'depurar', 'consola', 'inspeccionar', 'web inspector'],
    // The web inspector ships in every build (see `src-tauri/src/devtools.rs`),
    // so users can always debug. Plain-browser dev has no native shell — and its
    // own DevTools — so this no-ops there rather than throwing through the
    // bridge. Errors are swallowed: a debug affordance never interrupts the user.
    keybinding: 'Mod-Shift-i',
    run: async () => {
      if (!hasBridge()) {
        return
      }
      try {
        await toggleDevtools()
      } catch {
        // Best effort — opening the inspector is never worth a surfaced failure.
      }
    },
  },
]

/**
 * The registered keybinding for `commandId`, or `null` when the command has
 * none (or the id is unknown). UI hints — sidebar keycaps, "go to today"
 * affordances — derive bindings through this so they can never drift from the
 * command definition, and disappear if the binding ever does.
 */
export function keybindingFor(commandId: string): string | null {
  return APP_COMMANDS.find((command) => command.id === commandId)?.keybinding ?? null
}

let registered = false

/**
 * Register the first-wave commands. Called explicitly from `main.tsx` (and by
 * tests) — registration as an import side effect couples behavior to module
 * graph order, which is exactly the kind of spooky action a registry invites.
 * Idempotent: hosts and tests can call it without coordinating.
 */
export function registerAppCommands(): void {
  if (registered) {
    return
  }
  registered = true
  registerCommands(APP_COMMANDS)
}

export { APP_COMMANDS }
