import { describe, it, expect } from "vitest";
import { segmentText } from "../segment";
import { diffSegments } from "../diff";
import type { Segment } from "../segment";

/**
 * Segment IDs are the identity used for FLIP tracking and DOM reconciliation.
 * Two segments sharing an ID means they fight over a single DOM element, and
 * the loser renders nothing — text visibly disappears from the morph.
 */
function duplicateIds(segments: Segment[]): string[] {
  const counts = new Map<string, number>();
  for (const seg of segments) {
    counts.set(seg.id, (counts.get(seg.id) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .filter(([, n]) => n > 1)
    .map(([id]) => id);
}

/** Segments hold spaces as non-breaking spaces; map them back to compare. */
function render(segments: Segment[]): string {
  return segments
    .map((s) => s.string)
    .join("")
    .replace(/\u00A0/g, " ");
}

const vanilla = `import { TextMorph } from 'torph'

const textmorph = new TextMorph({
  element: document.getElementById('morph'),
  // options
});

textmorph.update('Hello world');`;

const react = `import { TextMorph } from 'torph/react'

<TextMorph>Hello world</TextMorph>`;

const vue = `import { TextMorph } from 'torph/vue'

<template>
  <TextMorph :text="Hello world" />
</template>

<script setup>
  import { TextMorph } from "torph/vue";
</script>`;

const svelte = `import { TextMorph } from 'torph/svelte'

<TextMorph text="Hello world"/>`;

const examples = { vanilla, react, vue, svelte };

describe("segment ID uniqueness", () => {
  describe("segmentText", () => {
    it.each(Object.entries(examples))(
      "produces unique IDs across every line of %s",
      (_name, text) => {
        expect(duplicateIds(segmentText(text, "en"))).toEqual([]);
      },
    );

    it("does not reuse an ID for the same word on different lines", () => {
      const segments = segmentText("hello world\nhello world", "en");
      expect(duplicateIds(segments)).toEqual([]);
    });

    it("does not reuse an ID for whitespace at the same column", () => {
      const segments = segmentText("a b\nc d", "en");
      expect(duplicateIds(segments)).toEqual([]);
    });
  });

  describe("diffSegments", () => {
    it.each([
      ["vanilla", "vue"],
      ["vue", "vanilla"],
      ["react", "vue"],
      ["vue", "svelte"],
      ["svelte", "vanilla"],
      ["vanilla", "react"],
    ] as const)("produces unique IDs morphing %s -> %s", (from, to) => {
      const old = segmentText(examples[from], "en");
      const { segments } = diffSegments(old, examples[to], "en");

      expect(duplicateIds(segments)).toEqual([]);
      expect(render(segments)).toBe(examples[to]);
    });

    it("does not steal an ID that a later segment inherits from the old text", () => {
      // "import" appears once in the old text and twice in the new. Whichever
      // occurrence the LCS matches, the unmatched one must not be allocated the
      // bare "import" ID that the matched one already owns.
      const old = segmentText("import a\n\nb", "en");
      const { segments } = diffSegments(old, "import a\n\nimport b", "en");

      expect(duplicateIds(segments)).toEqual([]);
      expect(render(segments)).toBe("import a\n\nimport b");
    });

    it("stays unique when morphs are chained without settling", () => {
      // Rapidly switching examples chains diffs off the previous result rather
      // than off a fresh segmentation, so any ID collision compounds.
      const order = ["react", "vanilla", "vue", "svelte"] as const;
      let segments = segmentText(examples.react, "en");

      for (let cycle = 0; cycle < 3; cycle++) {
        for (const name of order) {
          segments = diffSegments(segments, examples[name], "en").segments;
          expect(duplicateIds(segments)).toEqual([]);
          expect(render(segments)).toBe(examples[name]);
        }
      }
    });
  });
});
