import type { TorphPlugin } from "../../lib/text-morph/plugin";

// camelCase humps, acronyms, digit runs, and every separator on its own.
const TOKEN = /[A-Z]+(?![a-z])|[A-Z]?[a-z]+|\d+|[^A-Za-z\d]/g;
// Only words with an identifier's or a path's joins; a plain word with a comma stays text.
const JOINED = /[a-z\d][A-Z]|[_/]|\w[.:-]\w/;

const split = (word: string) => word.match(TOKEN) ?? [word];

/** In order, the old token that each new one keeps, by index into `old`. */
function kept(old: string[], next: string[]) {
  let from = 0;
  return next.map((token) => {
    const at = old.indexOf(token, from);
    if (at >= 0) from = at + 1;
    return at;
  });
}

/** Identifiers and paths change at their joins: getUserName → getUserEmail keeps getUser. */
export function tokens(): TorphPlugin {
  return {
    name: "tokens",
    claim: (word) => JOINED.test(word),
    segment: (word, { previous = [], id }) => {
      const next = split(word);
      return kept(
        previous.map((s) => s.string),
        next,
      ).map((at, i) =>
        at >= 0
          ? { id: previous[at]!.id, string: next[i]! }
          : { id: id(next[i]), string: next[i]! },
      );
    },
    // Long identifiers share too few letters for the default, but plenty of tokens.
    affinity: (a, b) => {
      if (!JOINED.test(a) || !JOINED.test(b)) return null;
      const [x, y] = [split(a), split(b)];
      return (
        kept(x, y).filter((at) => at >= 0).length / Math.max(x.length, y.length)
      );
    },
  };
}
