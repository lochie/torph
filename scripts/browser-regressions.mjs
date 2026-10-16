import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { root, cache, buildBundle, launchBrowser } from "./browser-tools.mjs";

const baseline = await readFile(path.join(cache, "baseline.js"), "utf8");
const optimized = await buildBundle();
const browser = await launchBrowser();

const cases = [
  { name: "tag replacement", values: ["newline-1", "a\nb", "newline-1"] },
  {
    name: "labels",
    values: [
      "You have 10 unread messages",
      "You have 11 unread messages",
      "You have 20 unread messages",
    ],
  },
  {
    name: "split words",
    values: ["hello world", "hello worlds", "hello there", "world hello"],
  },
  {
    name: "group replacement",
    values: ["abcdefghijklmnop", "abcmnopqrstuvwx", "xyz"],
  },
  {
    name: "multiline",
    values: ["$1,234", "Total\n$5,678", "a\n$9,876\nb", "$42"],
  },
  { name: "empty", values: ["hello world", "", "hi", "", "99%"] },
  { name: "caret", values: ["$1234", "$1934", "$19345"], caret: true },
  {
    name: "center aligned",
    values: ["one two three", "one five", "six two three"],
    align: "center",
  },
  {
    name: "right aligned",
    values: ["$1,234 items", "$5,678 items", "Total\n$42"],
    align: "right",
  },
  {
    name: "transformed ancestor",
    values: ["Total $10", "Total $1234", "$99"],
    transform: "scale(1.2) rotate(3deg)",
  },
  {
    name: "CSS width",
    values: ["hello world", "hello there", "hello\nthere"],
    width: "100%",
  },
];

async function replay(code, fixture) {
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  try {
    await page.setContent(
      '<!doctype html><style>body{font:20px/28px Arial} #parent{width:420px;margin:40px} #root{min-height:28px}</style><div id="parent"><span id="root">server placeholder</span></div>',
    );
    await page.addScriptTag({ content: code });
    return await page.evaluate(async (fixture) => {
      const element = document.querySelector("#root");
      const parent = document.querySelector("#parent");
      parent.style.textAlign = fixture.align ?? "left";
      parent.style.transform = fixture.transform ?? "none";
      if (fixture.width) element.style.width = fixture.width;
      let clock = 0;
      performance.now = () => clock;
      const instance = new Torph.TextMorph({
        element,
        duration: 240,
        ease: "linear",
        respectReducedMotion: false,
      });
      const snapshots = [];
      for (const value of fixture.values) {
        instance.update(value, fixture.caret ? 2 : undefined);
        const live = [...element.children].filter(
          (child) =>
            child.hasAttribute("torph-id") &&
            !child.hasAttribute("torph-exiting"),
        );
        const text = live
          .map((child) => (child.tagName === "BR" ? "\n" : child.textContent))
          .join("")
          .replaceAll("\u00a0", " ")
          .replaceAll("\u200b", "");
        if (text !== value) throw new Error(`Wrong text: ${text} != ${value}`);
        if (
          new Set(live.map((child) => child.getAttribute("torph-id"))).size !==
          live.length
        )
          throw new Error("Duplicate IDs");
        if (element.querySelector("[torph-sr]")?.textContent !== value)
          throw new Error("Wrong accessible text");
        for (const animation of document.getAnimations()) {
          animation.pause();
          animation.currentTime = 90;
        }
        clock += 90;
        snapshots.push(
          [...element.querySelectorAll("[torph-id]")].map((child) => {
            const rect = child.getBoundingClientRect();
            const style = getComputedStyle(child);
            return {
              id: child.getAttribute("torph-id"),
              text: child.textContent,
              exiting: child.hasAttribute("torph-exiting"),
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height,
              opacity: +style.opacity,
            };
          }),
        );
      }
      for (const animation of document.getAnimations()) animation.finish();
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);
      if (element.querySelector("[torph-exiting]"))
        throw new Error("Exits were not cleaned up");
      const rect = element.getBoundingClientRect();
      instance.destroy();
      if (
        document.querySelector("style[data-torph]") ||
        element.querySelector("[torph-sr]")
      )
        throw new Error("Teardown leak");
      return { snapshots, final: { width: rect.width, height: rect.height } };
    }, fixture);
  } finally {
    await page.close();
  }
}

try {
  const report = [];
  for (const fixture of cases) {
    const before = await replay(baseline, fixture);
    const after = await replay(optimized, fixture);
    let largestDelta = 0;
    for (let i = 0; i < before.snapshots.length; i++) {
      const keyed = (items) => {
        const seen = new Map();
        return new Map(
          items.map((item) => {
            const key = JSON.stringify([item.id, item.text, item.exiting]);
            const occurrence = seen.get(key) ?? 0;
            seen.set(key, occurrence + 1);
            return [`${key}:${occurrence}`, item];
          }),
        );
      };
      const oldItems = keyed(before.snapshots[i]);
      const newItems = keyed(after.snapshots[i]);
      assert.equal(
        newItems.size,
        oldItems.size,
        `${fixture.name} item count at step ${i}`,
      );
      for (const [id, old] of oldItems) {
        const next = newItems.get(id);
        assert(next, `${fixture.name} missing ${id}`);
        assert.equal(next.text, old.text);
        assert.equal(next.exiting, old.exiting);
        for (const property of ["x", "y", "width", "height", "opacity"]) {
          const delta = Math.abs(next[property] - old[property]);
          largestDelta = Math.max(largestDelta, delta);
          assert(
            delta < 0.05,
            `${fixture.name} step ${i} ${JSON.stringify(old.text)} ${property}: ${old[property]} -> ${next[property]}`,
          );
        }
      }
    }
    assert(
      Math.abs(before.final.width - after.final.width) < 0.05,
      `${fixture.name} final width`,
    );
    assert(
      Math.abs(before.final.height - after.final.height) < 0.05,
      `${fixture.name} final height`,
    );
    report.push({
      name: fixture.name,
      steps: fixture.values.length,
      largestDelta,
    });
    console.log(
      `PASS ${fixture.name} (maximum geometry/opacity delta ${largestDelta.toFixed(5)})`,
    );
  }
  await writeFile(
    path.join(root, "benchmarks/browser-regressions.json"),
    JSON.stringify({ browser: browser.version(), cases: report }, null, 2) +
      "\n",
  );
} finally {
  await browser.close();
}
