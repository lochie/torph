# AGENTS.md

torph is a dependency-free animated text component. pnpm workspace, published from `packages/torph`.

## Layout

| Path                                                 | What                                                                                  |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------- |
| [packages/torph/](packages/torph/)                   | The library. Core engine + React / Vue / Svelte wrappers. The only published package. |
| [packages/test-cases/](packages/test-cases/)         | Shared morph corpus. Consumed by vitest _and_ the site playground.                    |
| [site/](site/)                                       | Next.js docs site — torph.lochie.me.                                                  |
| [apps/](apps/)                                       | One integration example per framework. Not published, ignored by changesets.          |
| [scripts/bundle-sizes.mjs](scripts/bundle-sizes.mjs) | Measures dist gzip sizes into the playground. Runs in `site:build`.                   |

## Commands

Run from the repo root; every script is a `--filter` into a workspace.

```
pnpm dev          # library watch build + site dev server
pnpm build        # build torph
pnpm test         # vitest, torph only
pnpm typecheck    # tsc --noEmit, torph only
pnpm lint         # torph + site
pnpm site:dev
pnpm example:react   # also :vue :svelte :svelte-ssr :typescript
```

There is no CI. `pnpm typecheck && pnpm test && pnpm lint` before anything lands.

## Code standards

### Comments

Comment only what is complex or out of the ordinary, in one line at most.

Assume a reader who knows the platform — never explain a standard API, a language feature, or what a well-named function does. `measure()` needs no comment; anyone reading it knows what measuring is. Same for WAAPI calls, `Intl.Segmenter`, React hooks.

If it won't fit on one line, it doesn't go in the code.

What earns a comment is the thing someone would otherwise "fix" — a constant that looks arbitrary, an order that looks incidental, a workaround that looks like a mistake:

```ts
const SLIDE = 20; // `offsetHeight || 20` — happy-dom has no layout
```

The exception is a file-level block explaining a whole subsystem's contract, where one already exists.

### Style

Prettier + eslint flat config, both in `packages/torph/`. Formatting is prettier's job; `eslint-config-prettier` sits last and disables anything that would fight it. Double quotes, semicolons, 2 spaces.

`no-console` is a warning — the debug path is the `debug` option, not a stray log. Unused args need a `_` prefix.

## The library

One engine. `TextMorph` handles text and numbers both; numbers are a `kind` (`"digit" | "symbol"`) on `Segment`, on by default, opt out with the `numbers` prop.

**Segment IDs are the only identity** used for FLIP tracking and DOM reconciliation. A duplicate ID means visible text loss, because reconciliation hands one element to two segments. `createIdAllocator()` in [segment.ts](packages/torph/src/lib/text-morph/utils/segment.ts) is the single source of uniqueness; `unique-ids.test.ts` asserts the invariant. Don't mint IDs outside it.

**Adding a file under `src/lib/`** — `tsup.config.ts`'s `aliasCorePlugin` externalises only paths matching `../lib/text-morph`. Anything else imported from a framework wrapper gets inlined into that wrapper's bundle. This once cost the React entry 4.6 kB gzip.

New public API needs an export in [src/index.ts](packages/torph/src/index.ts) — that file is the package surface.

### Tests

vitest, no config file. Tests needing a DOM opt in per-file:

```ts
// @vitest-environment happy-dom
```

happy-dom has **no layout** — every rect is zero. Assert intent (a transform was applied, an animation was cancelled), never geometry.

### Test cases

[packages/test-cases/](packages/test-cases/) holds the morph corpus and its verifiers. The torph API is _injected_ rather than imported so one definition runs twice: vitest passes the source functions, the site playground passes the bundled ones. A case added to `cases.ts` / `number-cases.ts` shows up in both.

## Site

- `app/` — routes only. Thin; a page composes a surface.
- `surfaces/` — one folder per page, plus `surfaces/demos/` which every page draws from via its barrel. A demo lives in `demos/`, not in the page that happens to show it first.
- `components/` — reusable UI, `index.tsx` + `styles.module.scss` per folder.
- SCSS modules. The shared palette and fonts are CSS custom properties in [styles/modules/variables.scss](site/src/styles/modules/variables.scss) — use `var(--border)` etc. rather than re-picking a theme colour; one-off literals inline are fine.
- `@/` aliases `site/src/`.
- Demos animate on a timer, so they need `"use client"` and must respect `usePrefersReducedMotion()`.

The site consumes `torph` as a workspace dep — run `pnpm dev` (not just `site:dev`) so library edits rebuild.

## Commits and releases

Conventional commits — commitlint and lint-staged are configured but no git hooks are installed, so nothing runs them for you. `pnpm pre-commit` formats and lints `packages/torph/src` by hand.

Any change to `packages/torph` needs a changeset (`pnpm changeset`). `site` and the example apps are in the changeset ignore list and don't. Release is `pnpm release` from `main`.

Changesets are release notes, not a design document. One line on what changed,
then a short list of the specifics. Explain a decision only where the behaviour
would otherwise look like a bug — the reasoning belongs in code comments.
