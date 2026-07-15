### Purpose

This document helps AI agents work effectively in the Rizoma repo. It covers what
the project is, how it's built, how to run and test it, and the code conventions
to follow.

### What is Rizoma

Rizoma is Daniel's personal note-taking app: offline-first, markdown-backed,
daily-notes-first, with `[[wiki links]]` instead of folders. A React + TypeScript
frontend in a Tauri 2 native shell, targeting macOS and iOS.

It is a **personal tool, not a product**. There are no users to support, no
external contributors, no backwards-compatibility obligations. When something is
wrong, fix it properly rather than preserving it.

A rhizome is a root that grows sideways and connects any point to any other with
no trunk and no hierarchy — the opposite of the folder tree. That's the organizing
idea behind the app, and where the name comes from.

### Origin: a fork of Reflect

This repo began as a fork of [Reflect V2](https://github.com/reflect-app/reflect-open)
(MIT). That relationship is now **severed**:

- There is no upstream remote. `origin` is `dfalfan/reflect-open` — Daniel's fork.
  Nothing is pulled from the original project and nothing is contributed back.
- Diverge freely. Do not preserve upstream's shape, naming, or abstractions to
  keep some future merge clean; that merge is not coming. Optimize for what makes
  this app better for its one user.
- `LICENSE` (MIT, © Reflect App, LLC) covers the inherited code and stays as-is.

**The code still says "reflect" everywhere and that is expected.** Only the docs
carry the new name. The package scope (`@reflect/core`, `@reflect/desktop`), the
Rust crates (`reflect-open`, `reflect-cli`), the CLI binary (`reflect`), the
bundle identifiers (`app.reflect.ios`), and the graph directory (`.reflect/`) are
all unchanged. Do not rename them opportunistically — it's a large, risky change
that touches code signing and would be its own deliberate piece of work.

Docs under `docs/` (`reflect-v1-*.md`, `reflect-v2-*.md`, `docs/plans/`) are
inherited design context from the original project. They explain why the
architecture looks the way it does. Read them as history and rationale, not as
requirements Rizoma owes anything to.

### Product principles

These are Daniel's calls, not inherited dogma. They can change — if a principle
gets in the way, say so rather than working around it.

- **Daily notes first.** The app opens to today's note. Capture flows into the
  daily note by default.
- **Association over hierarchy.** `[[Wiki Links]]` replace folders. The note graph
  is the organizing model; there are no folders.
- **Markdown is the source of truth.** Notes are `.md` files (`daily/YYYY-MM-DD.md`,
  `notes/`). SQLite under `.reflect/` is a rebuildable projection of the notes.
- **Keyboard-native UX.** Every core workflow should be reachable from the keyboard.
- **Minimal UI.** Do less, and do it well. Don't add surfaces that compete with the
  editor.
- **Portable data.** Export (JSON, markdown, HTML) must keep working. The notes are
  plain files on disk; never trap them.

The next three are **mechanical, not philosophical** — the code implements them and
breaking one is a real bug, not a change of taste:

- **`private: true` is a hard block.** Notes with this frontmatter flag must never
  have their content sent to any external service — AI, transcription, or
  otherwise. Enforced at every call site.
- **No hosted backend.** LLM calls go directly to user-approved providers
  (OpenAI, Anthropic, …). Sync goes to GitHub/iCloud/Git. There is no server to
  proxy through — it does not exist. AI features use Daniel's own API keys.
- **Secrets live in the OS keychain.** API keys and credentials never go in
  markdown, Git, or `.reflect/`.

One durable exception to "markdown is the source of truth": the `chat_*` tables
hold AI chat history, which is not derivable from markdown. Index wipes and
rebuilds must leave them untouched.

### Agent workflow

- **Verify before answering.** When answering factual questions about what the code
  does, read the relevant source first and trace behavior to the final output. If
  you have not verified something, say so instead of guessing.
- **Plan proportionally.** For non-trivial, ambiguous, or high-risk changes, form a
  short plan and get sign-off first — especially for migrations, data-loss risk, or
  broad UX shifts. Simple localized fixes can proceed once you understand the
  context.
- **Check `git status` before editing and before staging.** Preserve unrelated
  changes; ask before committing if the worktree is dirty or the scope is
  ambiguous.
- **Prefer the clean design.** No compatibility shims, no dual paths, no legacy
  behavior. There is nothing to be compatible with.
- **Verify locally.** Run `pnpm check` and targeted tests for what you touched. If a
  check can't run, report why and the residual risk.
- **You cannot see the UI.** Never try to screenshot or drive the app with a
  headless browser. For visual feedback on UI work, ask Daniel for a screenshot.

### Development workflow

Work happens directly on `next`, the default and only branch. Commits go straight
to it — no PRs, no branch protection, no CI gate, no conventional-commit
requirement. Write commit messages as plain description; Spanish is fine.

1. Make your changes
2. `pnpm typecheck`
3. `pnpm lint` (`pnpm lint:fix` auto-fixes where possible)
4. `pnpm test --run path/to/test` for the code you touched

`pnpm check` runs typecheck + lint together. Run it before declaring work done.

**Inherited release machinery is dormant — ignore it.** `.github/workflows/`
(`ci.yml`, `pr-title.yml`, `release-please.yml`, `release.yml`, `testflight.yml`)
has never run on this fork: there are no Actions runs and no secrets configured.
The `0.6.1-beta` in `apps/desktop/package.json`, the changelogs, and the
`.github/release-please/` manifests are frozen artifacts from the original repo —
nothing maintains them now. Don't treat them as authoritative, don't try to keep
them consistent, and don't follow the old rule about never hand-editing them. They
are kept only because deleting them hasn't been worth the effort yet.

Nothing has been published from this fork. `pnpm release:macos` (local signing +
notarization) and the iOS/TestFlight helpers are inherited and untested here; see
[docs/macos-distribution.md](docs/macos-distribution.md) and
[docs/ios-testflight.md](docs/ios-testflight.md) if that ever becomes interesting.
Day-to-day, `pnpm tauri dev` is the whole story.

### Running tests

There are too many tests to run them all — run the ones specific to what you wrote.

```bash
pnpm test --run path/to/test        # vitest
cargo test -p reflect-cli           # Rust: the CLI crate
cargo test -p reflect-open          # Rust: the desktop shell crate
```

**Before any cargo build/check/test that compiles the desktop crate** (including
`--workspace` commands and clippy), stage the sidecars (the `reflect` CLI and the
`reflect-capture-host` native-messaging host) once per checkout:

```bash
pnpm --filter @reflect/desktop sidecar
```

Otherwise tauri-build fails with `resource path binaries/<name>-<triple> doesn't exist`
(`pnpm tauri dev`/`build` stage them automatically; details in [docs/cli.md](docs/cli.md)).

### Repo layout

A **Turborepo + pnpm monorepo** around a **Tauri 2** desktop/mobile app: a React +
TypeScript frontend bundled by Vite, embedded in a Rust native shell. The Rust
crates form a single **Cargo workspace** rooted at the repository root.

```
reflect-open/
├── apps/
│   ├── desktop/            # @reflect/desktop — the Tauri 2 app
│   │   ├── src/            # React frontend (main.tsx, app.tsx, components/, editor/,
│   │   │                   #   hooks/, providers/, routing/); calls Rust via @tauri-apps/api
│   │   ├── src-tauri/      # Tauri native shell (Rust crate `reflect-open`)
│   │   │   ├── src/        # lib.rs (#[tauri::command] handlers, plugins), db/, fs/,
│   │   │   │               #   watcher.rs, embed.rs, recents.rs, secrets.rs, settings.rs
│   │   │   ├── tauri.conf.json          # build hooks, windows, bundle targets (incl. iOS)
│   │   │   ├── tauri.<platform>.conf.json  # desktop overlays: bundle the reflect CLI sidecar
│   │   │   ├── capabilities/            # Tauri 2 permission grants (e.g. default.json)
│   │   │   ├── icons/                   # App icons for desktop/mobile bundles
│   │   │   ├── gen/                     # Generated schemas + platform projects (no hand-edits)
│   │   │   └── ios.project.yml          # iOS XcodeGen template
│   │   ├── scripts/        # build-sidecar.mjs (stages the reflect CLI for bundling)
│   │   ├── dist/           # Vite build output (frontendDist in tauri.conf.json)
│   │   └── public/         # Static assets served by Vite
│   ├── cli/                # `reflect` — self-contained Rust read/discovery CLI (see docs/cli.md)
│   ├── extension/          # @reflect/extension — Chrome MV3 capture extension (WXT; see its README)
│   └── native-host/        # `reflect-capture-host` — native-messaging spooler sidecar
├── packages/
│   ├── core/               # @reflect/core — ALL TS business logic (markdown/, indexing/,
│   │                       #   graph/, embeddings/, ai/, settings/, ipc/)
│   └── db/                 # @reflect/db — generated Kysely schema + the IPC dialect
├── crates/
│   └── index-schema/       # Shared SQLite migrations for <graph>/.reflect/index.sqlite
│                           #   (one schema for the desktop writer + CLI reader)
├── design-system/          # Design tokens, components, and UI guidelines (see design-system/readme.md)
├── docs/                   # Inherited design docs + docs/plans/
├── Cargo.toml              # Root Cargo workspace (reflect-open, reflect-cli, reflect-capture-host, reflect-index-schema)
└── turbo.json, pnpm-workspace.yaml
```

**Related repo — Meowdown:** the local checkout lives at `~/repos/meowdown`. It's
the hybrid/live-preview Markdown editor this app uses through `@meowdown/core` and
`@meowdown/react`. When investigating editor behavior, markdown round-tripping,
keybindings, slash menus, wiki links, task checkboxes, paste/drop handling, or
mobile editor quirks, check that repo too. Note that Meowdown is a third-party
upstream — if a root cause lives there, the options are a PR against Meowdown or a
local workaround here; decide with Daniel rather than assuming.

**Design system**

UI work should follow the design system in [`design-system/readme.md`](design-system/readme.md):

- `design-system/tokens/` — CSS custom properties for color, typography, spacing, and motion
- `design-system/components/` — reusable React primitives (Button, Input, Badge, etc.)
- `design-system/guidelines/` — color, type, spacing, and brand specimens
- `design-system/styles.css` — global entry point that imports all tokens

**Frontend ↔ Rust bridge**

- Define commands in `apps/desktop/src-tauri/src/` (registered in `lib.rs`'s `invoke_handler`) with `#[tauri::command]`.
- Call commands from the frontend with `invoke` from `@tauri-apps/api/core`.
- Add Tauri plugins in `apps/desktop/src-tauri/Cargo.toml` (Rust) and grant permissions in `apps/desktop/src-tauri/capabilities/`.

**Common commands** (run from the repo root)

```bash
pnpm dev              # turbo dev across packages (Vite on http://localhost:1420)
                      #   add ?platform=ios to the URL to preview the MOBILE tree in a
                      #   plain browser (dev-only in-memory bridge + seeded demo graph)
pnpm tauri dev        # Full Tauri app with hot reload (stages the CLI sidecar first)
pnpm tauri:dev        # `pnpm tauri dev` with the dev overlay → the "Reflect Dev" flavor
                      #   (green icon, own identifier; coexists with a released build)
pnpm build            # turbo build pipeline → apps/desktop/dist/
pnpm tauri build      # Native app bundle, incl. the reflect CLI sidecar
pnpm check            # typecheck + lint
```

**iOS simulator**

The mobile app is the Tauri iOS target of `apps/desktop`, not a separate package.
Use `pnpm tauri:ios:dev "iPhone 17 Pro"` from the repo root (or
`pnpm tauri:ios:dev --host` for a physical device); debug builds are the dev flavor
(`app.reflect.ios.dev`) and need that script's config overlay, so do not run plain
`tauri ios dev`. List simulator names with `xcrun simctl list devices available`.
The first run can be quiet while Xcode compiles Rust, Swift plugin code, and native
dependencies. See `docs/contributing/mobile-simulator.md` before committing changes
under `apps/desktop/src-tauri/gen/apple/`, because Tauri/Xcode may normalize
generated project and plist files.

# Code Conventions

Favor small, composable modules, explicit contracts, tests that document behavior,
and the existing local patterns over new abstractions. The bar is "the next person
to read this is you in six months, with no memory of today."

## Structured Code Style

- Keep files focused and single-responsibility. Split out helpers, hooks, and
  components when a module starts doing more than one thing.
- Use kebab-case for directories, TypeScript files, and React component files.
- Prefer `@/` imports where the project already uses them.
- Avoid comments unless they explain non-obvious decisions or complex logic.
  Do not add comments that merely restate the code.
- Document public APIs.
- Never use single-character variable names.
- Always run typecheck/lint before declaring implementation work done.

## TypeScript

- Prefer interfaces for object definitions.
- Use type aliases for unions, intersections, and mapped types.
- Never use `any` or `as any`.
- Avoid type assertions unless they are genuinely necessary.
- Use strict, idiomatic TypeScript with proper null handling.
- Use discriminated unions and type guards for variant data. Export helper
  predicates when they clarify a public contract.
- Use readonly fields for immutable data.
- Use generics for reusable type patterns.
- Keep shared types in `types.ts` files or close to their consumers when local.
- Use explicit return types for public functions.
- Prefer function declarations for named functions and arrow functions for
  callbacks.
- Prefer async/await over Promise chains.
- Prefer functional patterns over classes.

## Data Boundaries

- Use Zod for all incoming or untrusted data, including JSON, IPC payloads,
  external API responses, file-derived metadata, and worker payloads.
- Normalize casing once at the boundary; TypeScript types should be camelCase.
- Do not use type assertions to parse JSON.
- When pulling database types from Kysely, use the appropriate helper type such
  as `Selectable<T>`, `Insertable<T>`, or `Updateable<T>` instead of raw table
  types in public function parameters or returns.
- Handle Promise rejections properly, but do not add broad defensive error
  handling unless the call site needs it.

## React

- Favor named exports for components.
- Keep one React component per file unless a tiny private helper component is
  inseparable from its parent.
- Name React props interfaces with the component name plus `Props`, for example
  `ButtonProps`.
- Do not add `use client` or `use server` directives.
- Do not `import * as React from 'react'`; import the specific React APIs.
- Never call hooks conditionally.
- Keep logic as low as possible in the tree. Prefer providers and small hooks for
  shared state.
- Move large mutation handlers, parsing, persistence, and business logic into
  helpers or hooks instead of embedding them inside components.
- `zod` and `react-hook-form` are available; use them for validated forms.

## UI and Styling

- Use Tailwind CSS, React, shadcn/ui components, Radix, Tailwind Aria, and
  Lucide React icons.
- Generate responsive designs and provide default props for reusable React
  components.
- Always check `apps/desktop/src/components/ui/` before building custom UI.
- For popups, popovers, dropdowns, dialogs, tooltips, menus, comboboxes, and
  other overlays, use the existing shadcn component from
  `apps/desktop/src/components/ui/`. If the shadcn primitive is missing locally,
  install or generate it there and use it. Never hand-roll an overlay primitive
  when shadcn already covers it.
- The UI is in **Spanish**. New user-facing strings should be written in Spanish
  to match; code, identifiers, and comments stay in English.
