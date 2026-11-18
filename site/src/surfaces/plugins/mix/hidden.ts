import type { TorphPlugin } from "torph";

type Plugin = TorphPlugin;
type Named = [name: string, plugin: Plugin];

const SIDES = ["enter", "exit"] as const;
const HOOKS = ["enter", "persist", "exit"] as const;
// Every plugin in the list adds to these, so one in front can't override them.
const SHARED = [
  "decorate",
  "letters",
  "linger",
  "maxShift",
  "affinity",
  "boxes",
] as const;

const words = (text: string) => text.split(/\s+/).filter(Boolean);
const LOCALE = { locale: "en" };
const claims = (plugin: Plugin, word: string) =>
  !!plugin.segment && !!plugin.claim?.(word, LOCALE);
const cuts = (plugin: Plugin, text: string) => {
  try {
    return !!plugin.whole?.(text, { ...LOCALE, previous: [], id: () => "" });
  } catch {
    return false;
  }
};

/** Each decision the engine hands to the first plugin that makes it, for this text. */
function decisions(plugin: Plugin, text: string): string[] {
  const out: string[] = [];
  if (plugin.fold) out.push("fold");
  if (plugin.tween) out.push("tween");
  if (plugin.ease) out.push("ease");
  if (plugin.whole) out.push("whole");
  for (const word of words(text))
    if (claims(plugin, word)) out.push(`word:${word}`);
  if (plugin.runs) for (const side of SIDES) out.push(`runs:${side}`);
  const splits = out.some((d) => d === "whole" || d.startsWith("word:"));
  // Its own kinds only exist where it splits the text, so they go with those decisions.
  for (const [kind, set] of Object.entries({
    ...plugin.animate,
    ...(splits ? {} : plugin.kinds),
  }))
    for (const hook of HOOKS) if (set[hook]) out.push(`${kind}:${hook}`);
  return out;
}

/** Whether `plugin`, in front, makes `decision` for this text. */
function makes(plugin: Plugin, decision: string, text: string) {
  const at = decision.indexOf(":");
  const what = at < 0 ? decision : decision.slice(0, at);
  const rest = at < 0 ? undefined : decision.slice(at + 1);
  // A whole value it cuts never reaches the word-by-word split.
  if ((what === "whole" || what === "word") && cuts(plugin, text)) return true;
  if (what === "word") return claims(plugin, rest!);
  if (what === "runs") return !!plugin.runs?.claim([], rest as "enter");
  if (what === "whole") return false;
  if (rest === undefined) return !!plugin[what as "fold" | "tween" | "ease"];
  const [kind, hook] = decision.split(":") as [string, "enter"];
  return !!(plugin.animate?.[kind]?.[hook] ?? plugin.kinds?.[kind]?.[hook]);
}

/** Each picked plugin that does nothing for this text, with the plugins in front that do its part. */
export function hidden(order: Named[], text: string) {
  const out = new Map<string, string[]>();
  order.forEach(([name, plugin], i) => {
    if (SHARED.some((field) => plugin[field] !== undefined)) return;
    const own = decisions(plugin, text);
    if (own.length === 0) return;
    const by = new Set<string>();
    for (const decision of own) {
      const front = order
        .slice(0, i)
        .find(([, other]) => makes(other, decision, text));
      if (!front) return;
      by.add(front[0]);
    }
    out.set(name, [...by]);
  });
  return out;
}
