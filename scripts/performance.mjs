import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import os from "node:os";
import {
  output,
  cache,
  git,
  buildBundle,
  launchBrowser,
} from "./browser-tools.mjs";

await mkdir(cache, { recursive: true });
const captureIndex = process.argv.indexOf("--capture-baseline");
const baselineRef = process.argv[captureIndex + 1] ?? "HEAD";
const current = await buildBundle(captureIndex >= 0 ? baselineRef : undefined);
if (captureIndex >= 0) {
  await writeFile(path.join(cache, "baseline.js"), current);
  await writeFile(
    path.join(cache, "baseline.json"),
    JSON.stringify({
      commit: git("rev-parse", baselineRef).trim(),
    }),
  );
  console.log(
    "Captured baseline bundle. Run node scripts/performance.mjs to compare.",
  );
  process.exit(0);
}

const browser = await launchBrowser();
const baseline = await readFile(path.join(cache, "baseline.js"), "utf8");
const metadata = JSON.parse(
  await readFile(path.join(cache, "baseline.json"), "utf8"),
);
const samples = Number(process.env.BENCH_SAMPLES ?? 9);
assert(samples >= 3);
const scenarios = [
  "mount",
  "settled-update",
  "interrupted-update",
  "word-diff",
  "lcs",
];
const measurements = Object.fromEntries(
  scenarios.map((name) => [name, { baseline: [], optimized: [] }]),
);

async function workload({ scenario, instrument }) {
  const counts = { animations: 0, rectReads: 0, styleReads: 0, removals: 0 };
  if (instrument) {
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (...args) {
      counts.animations++;
      return animate.apply(this, args);
    };
    const rect = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function () {
      counts.rectReads++;
      return rect.call(this);
    };
    const computed = window.getComputedStyle;
    window.getComputedStyle = (...args) => {
      counts.styleReads++;
      return computed(...args);
    };
    const remove = Element.prototype.remove;
    Element.prototype.remove = function () {
      counts.removals++;
      return remove.call(this);
    };
  }
  const { TextMorph, segmentText, diffSegments, lcsIndices } = window.Torph;
  const instances = [];
  const elements = [];
  const frames = [];
  const frame = () => new Promise(requestAnimationFrame);
  const count = 60;
  function mount(value) {
    const row = document.createElement("div");
    const element = document.createElement("span");
    row.append(element);
    document.body.append(row);
    const morph = new TextMorph({
      element,
      locale: "en",
      duration: 180,
      respectReducedMotion: false,
    });
    morph.update(value);
    instances.push(morph);
    elements.push(element);
  }
  const label = (i, n) =>
    `Account ${i}: you have ${n} unread messages in your inbox`;
  if (scenario.includes("update")) {
    for (let i = 0; i < count; i++) mount(label(i, 10));
    await frame();
    await frame();
    Object.keys(counts).forEach((key) => (counts[key] = 0));
  }
  const started = performance.now();
  if (scenario === "mount") {
    for (let i = 0; i < count; i++) mount(label(i, 10));
    document.body.offsetWidth;
  } else if (scenario.includes("update")) {
    for (let step = 0; step < 8; step++) {
      const start = performance.now();
      instances.forEach((morph, i) => morph.update(label(i, 11 + step)));
      document.body.offsetWidth;
      frames.push(performance.now() - start);
      if (scenario === "settled-update") {
        document.getAnimations().forEach((animation) => animation.finish());
        await frame();
        await frame();
      } else {
        await frame();
      }
    }
    if (
      elements.some(
        (element, i) =>
          element.querySelector("[torph-sr]")?.textContent !== label(i, 18),
      )
    )
      throw new Error("Incorrect accessible text");
  } else if (scenario === "word-diff") {
    const words = Array.from(
      { length: 180 },
      (_, i) => `item${i.toString(36)}x`,
    );
    const old = segmentText(words.join(" "), "en", false);
    for (let i = 0; i < 30; i++) {
      const result = diffSegments(
        old,
        [...words.slice(90), ...words.slice(0, 90)].join(" "),
        "en",
        { numbers: false },
      );
      if (result.segments.length !== old.length)
        throw new Error("Incorrect diff");
    }
  } else {
    const a = Array.from({ length: 600 }, (_, i) => `token${i % 29}`);
    const b = [...a.slice(17), ...a.slice(0, 17)];
    for (let i = 0; i < 30; i++) {
      if (lcsIndices(a, b)[0].length !== 588) throw new Error("Incorrect LCS");
    }
  }
  const elapsed = frames.length
    ? frames.reduce((a, b) => a + b, 0) / frames.length
    : performance.now() - started;
  const metrics = { elapsed, counts: { ...counts } };
  instances.forEach((morph) => morph.destroy());
  document.getAnimations().forEach((animation) => animation.cancel());
  return metrics;
}

async function run(code, scenario, instrument = false) {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 960 },
    reducedMotion: "no-preference",
  });
  try {
    await page.setContent(
      "<!doctype html><style>body {font:16px/24px Arial; margin:16px} body > div {height:24px}</style>",
    );
    await page.addScriptTag({ content: code });
    return await page.evaluate(workload, { scenario, instrument });
  } finally {
    await page.close();
  }
}

try {
  for (const scenario of scenarios) {
    for (let i = -2; i < samples; i++) {
      const order =
        i % 2 === 0 ? ["baseline", "optimized"] : ["optimized", "baseline"];
      for (const variant of order) {
        const measurement = await run(
          variant === "baseline" ? baseline : current,
          scenario,
        );
        if (i >= 0) measurements[scenario][variant].push(measurement.elapsed);
      }
    }
    console.log(`Measured ${scenario}`);
  }
  const median = (values) =>
    [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
  const summary = [];
  for (const scenario of scenarios) {
    const before = median(measurements[scenario].baseline);
    const after = median(measurements[scenario].optimized);
    summary.push({
      scenario,
      baselineMs: +before.toFixed(3),
      optimizedMs: +after.toFixed(3),
      reductionPercent: +(100 * (1 - after / before)).toFixed(1),
    });
  }
  const operations = {};
  for (const scenario of scenarios.slice(0, 3)) {
    operations[scenario] = {};
    for (const [variant, code] of [
      ["baseline", baseline],
      ["optimized", current],
    ]) {
      operations[scenario][variant] = (await run(code, scenario, true)).counts;
    }
  }
  const report = {
    baseline: metadata,
    browser: browser.version(),
    samples,
    date: new Date().toISOString(),
    summary,
    operations,
    measurements,
    environment: {
      node: process.version,
      platform: os.platform(),
      cpu: os.cpus()[0]?.model,
    },
    bundles: {
      baselineSha256: createHash("sha256").update(baseline).digest("hex"),
      optimizedSha256: createHash("sha256").update(current).digest("hex"),
    },
  };
  await writeFile(
    path.join(output, "results.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.table(summary);
  console.log(JSON.stringify(operations, null, 2));
  if (process.argv.includes("--check")) {
    for (const scenario of scenarios.slice(0, 3)) {
      assert(
        summary.find((row) => row.scenario === scenario).reductionPercent >= 25,
        `${scenario}: expected at least 25% less processing time`,
      );
    }
  }
} finally {
  await browser.close();
}
