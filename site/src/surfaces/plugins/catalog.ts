// No "use client": the route reads each plugin's source by these names on the server.
export const GROUPS = [
  {
    id: "everyday",
    title: "Everyday",
    summary: "Quiet transitions for headings, labels and buttons.",
    plugins: [
      { name: "mask", summary: "New text rises into place behind a mask." },
      { name: "fadeUp", summary: "New text fades up into place." },
      { name: "cascade", summary: "Text arrives a line at a time." },
      { name: "ticker", summary: "New text pushes the old out." },
      { name: "fadeThrough", summary: "Fades out, then fades in growing." },
      {
        name: "sharedAxis",
        summary: "Old leaves one way, new arrives the other.",
      },
      { name: "blur", summary: "Letters rise into focus and blur away." },
      { name: "words", summary: "A changed word swaps whole." },
    ],
  },
  {
    id: "numbers",
    title: "Numbers",
    summary: "Counters, prices and readouts.",
    plugins: [
      { name: "odometer", summary: "Each wheel turns the way the value went." },
      { name: "countup", summary: "Counts through the values between." },
      { name: "trend", summary: "Flashes green up, red down." },
      { name: "roll", summary: "The value rolls round like a barrel." },
      { name: "slot", summary: "Changes roll through a window." },
      {
        name: "reveal",
        summary: "Each place turns over to its new character.",
      },
      { name: "flap", summary: "Letters flip like a departure board." },
    ],
  },
  {
    id: "editing",
    title: "Editing and structure",
    summary: "Text that is being written, reordered or reviewed.",
    plugins: [
      {
        name: "redline",
        summary: "Track changes: struck out, then underlined.",
      },
      { name: "rows", summary: "Reordered lines slide to their place." },
      { name: "tokens", summary: "Identifiers change at their joins." },
      { name: "caseless", summary: "A change of case pops in place." },
      { name: "typewriter", summary: "Backspaces, then types the new text." },
    ],
  },
  {
    id: "playful",
    title: "Playful",
    summary: "Character for a moment that wants it.",
    plugins: [
      { name: "squash", summary: "Stretch, squash and splat." },
      { name: "wave", summary: "Letters drop in with a bounce." },
      { name: "stamp", summary: "New text slams down like a stamp." },
      { name: "stack", summary: "The whole value slides like a card." },
      { name: "scramble", summary: "Letters scramble in and out." },
      { name: "lookalike", summary: "Letters step through lookalike glyphs." },
      { name: "smoke", summary: "Old text wisps away like smoke." },
      { name: "glitch", summary: "Changes come through a glitch." },
      { name: "neon", summary: "Flickers on like a neon tube." },
      { name: "shatter", summary: "Old text cracks into falling shards." },
      { name: "dissolve", summary: "Letters break into dots and gather." },
      { name: "ripple", summary: "New letters ripple out from the change." },
    ],
  },
] as const;

export type PluginName = (typeof GROUPS)[number]["plugins"][number]["name"];

export const NAMES: PluginName[] = GROUPS.flatMap((group) =>
  group.plugins.map((plugin) => plugin.name),
);
