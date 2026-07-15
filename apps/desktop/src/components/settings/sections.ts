/**
 * The canonical, ordered registry of settings page sections. The section
 * cards and the sticky navigator both render from this list, so the
 * navigator's labels and jump targets can never drift from the page itself.
 */
export const SETTINGS_SECTIONS = [
  { id: 'appearance', title: 'Apariencia' },
  { id: 'editor', title: 'Editor' },
  { id: 'date-time', title: 'Fecha y hora' },
  { id: 'templates', title: 'Plantillas de nota' },
  { id: 'all-notes', title: 'Todas las notas' },
  { id: 'search', title: 'Búsqueda' },
  { id: 'ai-providers', title: 'Proveedores de IA' },
  { id: 'ai-prompts', title: 'Prompts de IA' },
  // macOS only — installs files under ~/.agents for terminal coding agents.
  { id: 'agents', title: 'Agentes' },
  // Only shown where the OS frameworks exist — see use-visible-settings-sections.
  { id: 'integrations', title: 'Integraciones' },
  { id: 'sync', title: 'Sincronización' },
  { id: 'import', title: 'Importar' },
  { id: 'about', title: 'Acerca de' },
  { id: 'destructive', title: 'Zona de peligro' },
] as const

/** Identifier of one {@link SETTINGS_SECTIONS} entry. */
export type SettingsSectionId = (typeof SETTINGS_SECTIONS)[number]['id']

/** The heading a section renders — shared by its card and the navigator. */
export function settingsSectionTitle(id: SettingsSectionId): string {
  return SETTINGS_SECTIONS.find((section) => section.id === id)?.title ?? id
}

/** The DOM id a section card carries (prefixed to keep document ids unique). */
export function settingsSectionDomId(id: SettingsSectionId): string {
  return `settings-${id}`
}
