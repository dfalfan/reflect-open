import type { ReactElement, ReactNode } from 'react'
import { InlineAlert } from '@/components/inline-alert'
import { Button } from '@/components/ui/button'
import type { ConnectGithubWizard } from '@/hooks/use-connect-github-wizard'

interface ConnectGithubFinishStepProps {
  wizard: ConnectGithubWizard
  /**
   * `row`: desktop dialog — small buttons side by side, escape hatches
   * leading. `stack`: mobile sheet — full-width buttons, primary action
   * first (the platform's bottom-sheet convention).
   */
  layout: 'row' | 'stack'
}

/**
 * The connect wizard's finish step, shared by the desktop dialog and the
 * mobile drawer so the view precedence and every user-facing string live
 * once. Renders whatever {@link ConnectGithubWizard.finishView} says —
 * the public-repo consent gate, the create/grant handoffs (whose polls the
 * hook owns), the in-flight state, or a failure's inline error with its
 * escape back to the repo step. Only button sizing/stacking varies by
 * `layout`.
 */
export function ConnectGithubFinishStep({
  wizard,
  layout,
}: ConnectGithubFinishStepProps): ReactElement {
  const view = wizard.finishView
  const buttonSize = layout === 'row' ? ('sm' as const) : undefined
  const groupClass = layout === 'row' ? 'flex gap-2' : 'flex flex-col gap-2'

  function changeRepository(label = 'Cambiar repositorio'): ReactNode {
    return (
      <Button variant="outline" size={buttonSize} onClick={wizard.backToRepo}>
        {label}
      </Button>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {wizard.user !== null ? (
        <p className="text-xs text-text-muted">
          Sesión iniciada como <strong className="text-text">{wizard.user.login}</strong>
        </p>
      ) : null}

      {view.kind === 'publicConfirm' ? (
        <>
          <InlineAlert tone="error">
            <strong>
              {view.repo.owner}/{view.repo.name} es público.
            </strong>{' '}
            Cualquier persona en internet puede leer todo lo que hay en este grafo, incluidas las
            notas marcadas como privadas.
          </InlineAlert>
          <div className={groupClass}>
            {layout === 'row' ? changeRepository('Elegir otro repo') : null}
            <Button
              variant="destructive"
              size={buttonSize}
              disabled={wizard.pending || wizard.user === null}
              onClick={wizard.confirmPublic}
            >
              Respaldar en un repo público
            </Button>
            {layout === 'stack' ? changeRepository('Elegir otro repo') : null}
          </div>
        </>
      ) : null}

      {view.kind === 'createGuide' ? (
        <>
          <p className="text-sm text-text">
            Crea{' '}
            <strong>
              {view.owner}/{view.name}
            </strong>{' '}
            en GitHub. Reflect lo conectará en cuanto exista.
          </p>
          <div className={groupClass}>
            <Button size={buttonSize} onClick={wizard.openCreatePage}>
              Crear en GitHub…
            </Button>
            {changeRepository()}
          </div>
          <p className="text-xs text-text-muted">Esperando el repositorio…</p>
          {wizard.authKind === 'app' ? (
            <p className="text-xs text-text-muted">
              Si no se conecta,{' '}
              <button type="button" className="underline" onClick={wizard.openInstallPage}>
                concede acceso a la app de Reflect
              </button>{' '}
              solo a este repositorio.
            </p>
          ) : (
            <p className="text-xs text-text-muted">
              Si no se conecta, agrégalo al acceso de repositorios de tu token.
            </p>
          )}
        </>
      ) : null}

      {view.kind === 'grantAccess' ? (
        <>
          <p className="text-sm text-text">
            Dale a Reflect acceso a{' '}
            <strong>
              {view.repo.owner}/{view.repo.name}
            </strong>{' '}
            para que pueda respaldar aquí.
          </p>
          <div className={groupClass}>
            <Button size={buttonSize} onClick={wizard.openInstallPage}>
              Conceder acceso en GitHub…
            </Button>
            {changeRepository()}
          </div>
          {/* Steer to per-repo selection: the backup needs exactly one repo,
              so "All repositories" is needless account-wide risk. */}
          <p className="text-xs text-text-muted">
            En GitHub, elige <strong>Only select repositories</strong>: Reflect solo necesita
            este.
          </p>
          <p className="text-xs text-text-muted">Esperando el acceso…</p>
        </>
      ) : null}

      {view.kind === 'connecting' ? <p className="text-sm text-text-muted">Conectando…</p> : null}

      {!wizard.pending && wizard.error !== null ? (
        <>
          <InlineAlert tone="error">{wizard.error}</InlineAlert>
          {view.kind === 'idle' ? (
            // A failed connect must never strand the user here — offer the
            // way back to a different repository. (The parked handoffs render
            // their own escapes.)
            changeRepository()
          ) : null}
        </>
      ) : null}
    </div>
  )
}
