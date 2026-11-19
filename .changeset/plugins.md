---
"torph": minor
---

Plugins.

#### Breaking

- `numbers` and `scale` props are removed. Both are plugins in torph's default set now: pass that set without the one you don't want, `plugins={[groups(), fade(), scale()]}` for no numbers.
- `plugins` replaces torph's default set rather than adding to it. To add to it, put yours first: `plugins={[blur(), ...classic()]}`.

#### New

- `plugins` on `TextMorph` and the React, Vue and Svelte components, to change how text is cut up and how it moves.
- `classic()`, torph's own look as a set of plugins: `numbers()`, `groups()`, `fade()` and `scale()`, each usable alone. `plugins={[]}` is the engine on its own.
- `torph/plugins/blur`, `words`, `scramble`, `flap`, `typewriter`, `tokens`, `odometer`, `wave`, `caseless`, `stack`, `squash`, `redline`, `countup`, `rows`, `trend`, `reveal`, `slot`, `dissolve`, `ripple`, `smoke`, `glitch`, `neon`, `shatter`, `stamp`, `roll`, `lookalike`, `mask`, `fadeUp`, `cascade`, `ticker`, `fadeThrough` and `sharedAxis`.
- `torph/debug`, which warns when a plugin reads layout mid-morph.
