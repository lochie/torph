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
        // At rest there are no boxes: the value is one run of plain text.
        const plain = live.length
          ? null
          : element.querySelector("[torph-text]");
        const text = (
          plain
            ? [...plain.childNodes].map((node) =>
                node.nodeName === "BR"
                  ? "\n"
                  : node.nodeType === 3
                    ? node.data
                    : "",
              )
            : live.map((child) =>
                child.tagName === "BR" ? "\n" : child.textContent,
              )
        )
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
        // Every glyph on screen, boxed or plain, in document order — what a reader sees, however it's drawn.
        const glyphs = [];
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        const range = document.createRange();
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          if (node.parentElement.closest("[torph-sr]")) continue;
          let opacity = 1;
          for (
            let e = node.parentElement;
            e && e !== element;
            e = e.parentElement
          )
            opacity *= +getComputedStyle(e).opacity;
          const exiting = !!node.parentElement.closest("[torph-exiting]");
          for (let i = 0; i < node.length; i++) {
            const ch = node.data[i];
            if (/[\s\u00a0\u200b]/.test(ch)) continue;
            range.setStart(node, i);
            range.setEnd(node, i + 1);
            const rect = range.getBoundingClientRect();
            glyphs.push({
              id: ch,
              text: ch,
              exiting,
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height,
              opacity,
            });
          }
        }
        snapshots.push(glyphs);
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

/** How many of 20 instances survive collection once their elements are dropped without destroy(). */
async function survivors(code) {
  const page = await browser.newPage();
  try {
    await page.setContent(
      "<!doctype html><style>body{font:20px Arial}</style>",
    );
    await page.addScriptTag({ content: code });
    await page.evaluate(async () => {
      const settle = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      window.instances = [];
      // Held strongly until the drop, or one could be collected before the second update.
      let held = [];
      for (let i = 0; i < 20; i++) {
        const element = document.body.appendChild(
          document.createElement("span"),
        );
        const instance = new Torph.TextMorph({
          element,
          duration: 50,
          respectReducedMotion: false,
        });
        instance.update("AVATAR Typo");
        held.push(instance);
        window.instances.push(new WeakRef(instance));
      }
      await settle(200);
      for (const instance of held) instance.update("Typo AVATAR");
      await settle(200);
      held = [];
      document.body.replaceChildren();
    });
    // Collected from outside the page: a gc() made in page script keeps whatever its own stack might point to.
    const session = await page.context().newCDPSession(page);
    for (let i = 0; i < 3; i++) {
      await page.waitForTimeout(100);
      await session.send("HeapProfiler.collectGarbage");
    }
    return await page.evaluate(
      () => window.instances.filter((ref) => ref.deref()).length,
    );
  } finally {
    await page.close();
  }
}

try {
  const report = [];
  const failed = [];
  for (const fixture of cases) {
    const before = await replay(baseline, fixture);
    const after = await replay(optimized, fixture);
    let largestDelta = 0;
    // Every difference in the case, not just the first, so one diff can't hide the rest.
    const differences = [];
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
      if (newItems.size !== oldItems.size) {
        differences.push(
          `step ${i} item count: ${oldItems.size} -> ${newItems.size}`,
        );
      }
      for (const [id, old] of oldItems) {
        const next = newItems.get(id);
        if (!next) {
          differences.push(`step ${i} missing ${id}`);
          continue;
        }
        if (next.text !== old.text || next.exiting !== old.exiting) {
          differences.push(`step ${i} ${id} text or exiting state changed`);
        }
        for (const property of ["x", "y", "width", "height", "opacity"]) {
          const delta = Math.abs(next[property] - old[property]);
          largestDelta = Math.max(largestDelta, delta);
          if (delta >= 0.05) {
            differences.push(
              `step ${i} ${JSON.stringify(old.text)}${old.exiting ? " (exiting)" : ""} ${property}: ${old[property]} -> ${next[property]}`,
            );
          }
        }
      }
    }
    for (const side of ["width", "height"]) {
      if (Math.abs(before.final[side] - after.final[side]) >= 0.05) {
        differences.push(
          `final ${side}: ${before.final[side]} -> ${after.final[side]}`,
        );
      }
    }
    report.push({
      name: fixture.name,
      steps: fixture.values.length,
      largestDelta,
    });
    if (differences.length > 0) {
      failed.push(fixture.name);
      console.log(
        `FAIL ${fixture.name} (maximum geometry/opacity delta ${largestDelta.toFixed(5)})`,
      );
      for (const line of differences.slice(0, 5)) console.log(`  ${line}`);
      if (differences.length > 5) {
        console.log(`  …and ${differences.length - 5} more`);
      }
    } else {
      console.log(
        `PASS ${fixture.name} (maximum geometry/opacity delta ${largestDelta.toFixed(5)})`,
      );
    }
  }
  const leaked = await survivors(optimized);
  if (leaked > 0) {
    failed.push("undestroyed instances");
    console.log(`FAIL undestroyed instances: ${leaked} of 20 never collected`);
  } else {
    console.log("PASS undestroyed instances (all 20 collected)");
  }
  assert.equal(failed.length, 0, `Failed: ${failed.join(", ")}`);
  await writeFile(
    path.join(root, "benchmarks/browser-regressions.json"),
    JSON.stringify({ browser: browser.version(), cases: report }, null, 2) +
      "\n",
  );
} finally {
  await browser.close();
}
