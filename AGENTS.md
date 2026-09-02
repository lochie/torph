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

A worked example that proves a rule belongs in [packages/test-cases/](packages/test-cases/) and not in prose — the corpus runs, a comment's copy of it rots quietly. A rule enforced in several places is stated once, as a trailing comment on the declaration they all import — not repeated at each site, and not as a list of the sites, which goes stale on the next one added.

The exception is a file-level block explaining a whole subsystem's contract, where one already exists.

### Style

Prettier + eslint flat config, both in `packages/torph/`. Formatting is prettier's job; `eslint-config-prettier` sits last and disables anything that would fight it. Double quotes, semicolons, 2 spaces.

`no-console` is a warning — the debug path is the `debug` option, not a stray log. Unused args need a `_` prefix.

**Reach for prettier by path** — `packages/torph/node_modules/.bin/prettier` — never `npx prettier` or `node_modules/.bin/prettier`. The root resolves 2.8.8, hoisted out of `@changesets/cli`, and its `trailingComma` default of `es5` strips a comma off every multi-line call in the repo. (`pnpm --filter=torph exec prettier` finds the right binary but runs in `packages/torph/`, so paths from the root miss.)

`.prettierrc.cjs` lives in `packages/torph/`, so `packages/test-cases/` and `site/` format on prettier 3 defaults instead. The two agree on everything the repo uses.

## The library

One engine. `TextMorph` handles text and numbers both; numbers are a `kind` (`"digit" | "symbol"`) on `Segment`, on by default, opt out with the `numbers` prop.

**Segment IDs are the only identity** used for FLIP tracking and DOM reconciliation. A duplicate ID means visible text loss, because reconciliation hands one element to two segments. `createIdAllocator()` in [segment.ts](packages/torph/src/lib/text-morph/utils/segment.ts) is the single source of uniqueness for text; `unique-ids.test.ts` asserts the invariant. Don't mint text IDs outside it.

Numbers are the one exception. `mintId()` in [number.ts](packages/torph/src/lib/text-morph/utils/number.ts) issues `\u0000n<counter>`: text IDs are derived from the text, so a NULL prefix cannot collide with one, and a counter that only climbs cannot collide with an ID a number is still carrying from an earlier morph. Any third ID source has to argue for its own disjointness the same way.

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
- `surfaces/` — one folder per page (`homepage/`, `playground/`). A demo lives in a subfolder of the surface that shows it — `homepage/examples/`, `playground/input-demo/`. There is no shared demo folder; the second page to want a demo is what earns one.
- `components/` — reusable UI, `index.tsx` + `styles.module.scss` per folder.
- SCSS modules. The shared palette and fonts are CSS custom properties in [styles/modules/variables.scss](site/src/styles/modules/variables.scss) — use `var(--border)` etc. rather than re-picking a theme colour; one-off literals inline are fine.
- `@/` aliases `site/src/`.
- `hooks/` — shared React hooks. One per file, named for the hook.
- `"use client"` goes on the surface root (`surfaces/homepage/index.tsx`), and the demos under it inherit the boundary. Don't repeat it per file.
- Reduced motion is the library's own affair — `TextMorph` reads the query live and swaps text without animating. The site adds no hook of its own.

The site consumes `torph` as a workspace dep — run `pnpm dev` (not just `site:dev`) so library edits rebuild.

## Commits and releases

Conventional commits — commitlint and lint-staged are configured but no git hooks are installed, so nothing runs them for you. `pnpm pre-commit` formats and lints by hand — but its lint-staged glob is `src/**/*.{ts,tsx}` inside `packages/torph` only, so nothing formats `packages/test-cases/` or `site/` for you.

No attribution trailers. Commits carry no `Co-Authored-By` for AI tooling, and pull request descriptions carry no generation footer — whatever a tool's own defaults say.

Any change to `packages/torph` needs a changeset (`pnpm changeset`). `site` and the example apps are in the changeset ignore list and don't. Release is `pnpm release` from `main`.

Bump with `pnpm run version`, not `pnpm version` — pnpm intercepts `version` as a built-in and the script never runs.

### Changesets

Changesets are release notes, not a design document — product notes, scanned rather than read. The model is: a one-line summary, then bullets grouped under `#### Breaking`, `#### New`, `#### Improved`, `#### Fixed`, in that order, dropping any group that is empty.

A bullet is one short line naming a feature, or an effect someone using the library would notice. Nothing about internals — no module names, no before-and-after mechanics, no account of the bug behind a fix.

`#### Breaking` is for API breaks only: a removed or renamed export, a changed signature, a prop that no longer means what it did. It is the one group whose bullets earn a second sentence, for the migration. A change in how something looks or moves is not breaking, however visible.

`#### New` names the feature and stops — `Multi-line text.`

Four bullets beat ten. A bug nobody could have hit, an improvement nobody would notice, a refactor, an internal rename, test-only work — none of it earns a bullet. No paragraphs, no prose sections, no code blocks. The reasoning belongs in code comments; a worked example belongs in [packages/test-cases/](packages/test-cases/).
