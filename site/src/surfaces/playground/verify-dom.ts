import type { Result } from "@torph/test-cases";

// Needs real geometry and the Web Animations API, so none of this can run in
// the node suite. Text-matching assertions live in `packages/test-cases`.

export type VerifyDomFn = (root: HTMLElement) => Result;

/** The plain text a root shows while nothing moves — null while it is drawn as boxes. */
export function restText(root: HTMLElement): HTMLElement | null {
  return root.querySelector("[torph-item]")
    ? null
    : root.querySelector<HTMLElement>("[torph-text]");
}

type Glyph = { ch: string; x: number; y: number };

export type JumpSnapshot = {
  items: Map<string, DOMRect>;
  /** Set when the morph starts from rest: every glyph of the plain text. */
  glyphs: Glyph[] | null;
  rootRect: DOMRect;
  rootWidth: number;
  align: string;
};

export type PerfResult = {
  pass: boolean;
  detail: string;
  totalFrames: number;
  droppedFrames: number;
  longestFrame: number;
  avgFrame: number;
  morphTime: number;
};

// ── DOM verification helpers ──

export function verifyItemsInBounds(root: HTMLElement): {
  pass: boolean;
  detail: string;
} {
  const rootRect = root.getBoundingClientRect();
  const text = restText(root);
  const items: { r: DOMRect; label: string }[] = text
    ? textRects(text).map((r, i) => ({ r, label: `line ${i + 1}` }))
    : Array.from(
        root.querySelectorAll<HTMLElement>(
          "[torph-item]:not([torph-exiting]):not(br)",
        ),
      ).map((item) => ({
        r: item.getBoundingClientRect(),
        label: item.textContent?.trim() || "?",
      }));
  const oob: string[] = [];
  items.forEach(({ r, label }) => {
    if (r.width === 0 && r.height === 0) return;
    const tolerance = 2;
    if (
      r.left < rootRect.left - tolerance ||
      r.right > rootRect.right + tolerance ||
      r.top < rootRect.top - tolerance ||
      r.bottom > rootRect.bottom + tolerance
    ) {
      oob.push(`"${label}" out of bounds`);
    }
  });
  if (oob.length > 0) return { pass: false, detail: oob.join(", ") };
  return { pass: true, detail: "all items within bounds" };
}

export function verifyNoOverflow(root: HTMLElement): {
  pass: boolean;
  detail: string;
} {
  const tolerance = 2;
  const overflowW = root.scrollWidth - root.offsetWidth > tolerance;
  const overflowH = root.scrollHeight - root.offsetHeight > tolerance;
  if (overflowW || overflowH) {
    return {
      pass: false,
      detail: `overflow: scroll=${root.scrollWidth}x${root.scrollHeight} offset=${root.offsetWidth}x${root.offsetHeight}`,
    };
  }
  return { pass: true, detail: "no overflow" };
}

export function verifyExitCleanup(root: HTMLElement): {
  pass: boolean;
  detail: string;
} {
  const exiting = root.querySelectorAll("[torph-exiting]");
  if (exiting.length > 0) {
    return { pass: false, detail: `${exiting.length} exiting elements remain` };
  }
  return { pass: true, detail: "no stale exits" };
}

export function verifyAlignment(
  root: HTMLElement,
  align: "left" | "center" | "right",
): { pass: boolean; detail: string } {
  const rootRect = root.getBoundingClientRect();
  const lines = getVisualLines(root);
  if (lines.length === 0) return { pass: true, detail: "no lines to check" };

  const tolerance = 4;
  const failures: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const lineLeft = Math.min(...line.map(({ rect }) => rect.left));
    const lineRight = Math.max(...line.map(({ rect }) => rect.right));
    const lineW = (lineRight - lineLeft).toFixed(1);
    const rootW = rootRect.width.toFixed(1);
    const texts = line
      .map(({ el }) => `"${el.textContent?.trim() || "?"}"`)
      .join(" ");

    if (align === "left") {
      if (Math.abs(lineLeft - rootRect.left) > tolerance) {
        failures.push(
          `line ${i + 1} not left-aligned (gap=${(lineLeft - rootRect.left).toFixed(1)}px lineW=${lineW} rootW=${rootW}) items: ${texts}`,
        );
      }
    } else if (align === "right") {
      if (Math.abs(lineRight - rootRect.right) > tolerance) {
        failures.push(
          `line ${i + 1} not right-aligned (gap=${(rootRect.right - lineRight).toFixed(1)}px lineW=${lineW} rootW=${rootW}) items: ${texts}`,
        );
      }
    } else if (align === "center") {
      const lineMid = (lineLeft + lineRight) / 2;
      const rootMid = (rootRect.left + rootRect.right) / 2;
      if (Math.abs(lineMid - rootMid) > tolerance) {
        failures.push(
          `line ${i + 1} not centered (off=${(lineMid - rootMid).toFixed(1)}px lineW=${lineW} rootW=${rootW}) items: ${texts}`,
        );
      }
    }
  }

  if (failures.length > 0) return { pass: false, detail: failures.join(", ") };
  return { pass: true, detail: `${align}-aligned ok (${lines.length} lines)` };
}

export function getVisualLines(
  root: HTMLElement,
): { rect: DOMRect; el: HTMLElement }[][] {
  const text = restText(root);
  if (text) return textRects(text).map((rect) => [{ rect, el: text }]);
  const items = root.querySelectorAll<HTMLElement>(
    "[torph-item]:not([torph-exiting]):not(br)",
  );
  if (items.length === 0) return [];

  const lines: { rect: DOMRect; el: HTMLElement }[][] = [];
  let currentLine: { rect: DOMRect; el: HTMLElement }[] = [];
  let lastTop = -Infinity;

  items.forEach((item) => {
    const r = item.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return;
    if (currentLine.length > 0 && Math.abs(r.top - lastTop) > r.height * 0.5) {
      lines.push(currentLine);
      currentLine = [];
    }
    currentLine.push({ rect: r, el: item });
    lastTop = r.top;
  });
  if (currentLine.length > 0) lines.push(currentLine);
  return lines;
}

export function verifyMultiline(
  root: HTMLElement,
  expectedMinLines: number,
): { pass: boolean; detail: string } {
  const lines = getVisualLines(root);
  if (lines.length < expectedMinLines) {
    return {
      pass: false,
      detail: `expected ${expectedMinLines}+ lines, got ${lines.length}`,
    };
  }
  return {
    pass: true,
    detail: `${lines.length} lines (${lines.map((l, i) => `L${i + 1}:${l.length}items`).join(" ")})`,
  };
}

function isIdentityOrNone(transform: string): boolean {
  if (!transform || transform === "none") return true;
  const match = transform.match(/matrix\(([^)]+)\)/);
  if (!match) return false;
  const v = match[1]!.split(",").map((s) => parseFloat(s.trim()));
  return (
    Math.abs(v[0]! - 1) < 0.01 &&
    Math.abs(v[1]!) < 0.01 &&
    Math.abs(v[2]!) < 0.01 &&
    Math.abs(v[3]! - 1) < 0.01 &&
    Math.abs(v[4]!) < 1 &&
    Math.abs(v[5]!) < 1
  );
}

export function verifyNoTransformResidue(root: HTMLElement): {
  pass: boolean;
  detail: string;
} {
  const items = root.querySelectorAll<HTMLElement>(
    "[torph-item]:not([torph-exiting]):not(br)",
  );
  const stuck: string[] = [];
  items.forEach((item) => {
    const t = getComputedStyle(item).transform;
    if (!isIdentityOrNone(t)) {
      stuck.push(`"${item.textContent?.trim() || "?"}" transform=${t}`);
    }
  });
  if (stuck.length > 0) return { pass: false, detail: stuck.join(", ") };
  return { pass: true, detail: "no transform residue" };
}

export function verifyNoOpacityResidue(root: HTMLElement): {
  pass: boolean;
  detail: string;
} {
  const items = root.querySelectorAll<HTMLElement>(
    "[torph-item]:not([torph-exiting]):not(br)",
  );
  const stuck: string[] = [];
  items.forEach((item) => {
    const o = Number(getComputedStyle(item).opacity);
    if (o < 0.99) {
      stuck.push(
        `"${item.textContent?.trim() || "?"}" opacity=${o.toFixed(2)}`,
      );
    }
  });
  if (stuck.length > 0) return { pass: false, detail: stuck.join(", ") };
  return { pass: true, detail: "no opacity residue" };
}

export function verifyStyleCleanup(root: HTMLElement): {
  pass: boolean;
  detail: string;
} {
  const items = root.querySelectorAll<HTMLElement>(
    "[torph-item]:not([torph-exiting]):not(br)",
  );
  const issues: string[] = [];
  items.forEach((item) => {
    if (item.style.position === "absolute") {
      issues.push(`"${item.textContent?.trim() || "?"}" has position:absolute`);
    }

    if (item.style.height && item.style.height !== "auto") {
      issues.push(
        `"${item.textContent?.trim() || "?"}" has height:${item.style.height}`,
      );
    }
  });
  if (issues.length > 0) return { pass: false, detail: issues.join(", ") };
  return { pass: true, detail: "no stale inline styles" };
}

export function verifyNoDuplicateIds(root: HTMLElement): {
  pass: boolean;
  detail: string;
} {
  const items = root.querySelectorAll<HTMLElement>(
    "[torph-item]:not([torph-exiting])",
  );
  const seen = new Map<string, number>();
  items.forEach((item) => {
    const id = item.getAttribute("torph-id");
    if (id) seen.set(id, (seen.get(id) || 0) + 1);
  });
  const dupes = [...seen.entries()].filter(([, count]) => count > 1);
  if (dupes.length > 0) {
    return {
      pass: false,
      detail: dupes.map(([id, n]) => `"${id}" ×${n}`).join(", "),
    };
  }
  return { pass: true, detail: "no duplicate IDs" };
}

export function verifyContainerSizeMatch(root: HTMLElement): {
  pass: boolean;
  detail: string;
} {
  const tolerance = 2;
  const hasStaleWidth =
    root.style.width &&
    root.style.width !== "auto" &&
    Math.abs(parseFloat(root.style.width) - root.scrollWidth) > tolerance;
  const hasStaleHeight =
    root.style.height &&
    root.style.height !== "auto" &&
    Math.abs(parseFloat(root.style.height) - root.scrollHeight) > tolerance;
  if (hasStaleWidth || hasStaleHeight) {
    return {
      pass: false,
      detail: `stale size: style=${root.style.width}×${root.style.height} actual=${root.scrollWidth}×${root.scrollHeight}`,
    };
  }
  return { pass: true, detail: "container size matches content" };
}

export function verifyBrMatchesContent(root: HTMLElement): {
  pass: boolean;
  detail: string;
} {
  const lines = getVisualLines(root);
  const brs = root.querySelectorAll("br[torph-item]");
  const minExpectedBrs = Math.max(0, lines.length - 1);
  if (lines.length <= 1 && brs.length === 0) {
    return { pass: true, detail: "single line, no <br> needed" };
  }
  if (brs.length < minExpectedBrs) {
    return {
      pass: false,
      detail: `${lines.length} visual lines but only ${brs.length} <br> (expected >=${minExpectedBrs})`,
    };
  }
  return { pass: true, detail: `${brs.length} <br> for ${lines.length} lines` };
}

/** Settled means one run of text, saying exactly what the screen reader copy says. */
export function verifyAtRest(root: HTMLElement): Result {
  const texts = root.querySelectorAll("[torph-text]");
  const boxes = root.querySelectorAll("[torph-item]");
  if (boxes.length > 0)
    return { pass: false, detail: `${boxes.length} boxes left after settling` };
  if (texts.length !== 1)
    return { pass: false, detail: `${texts.length} text runs, expected 1` };
  const drawn = Array.from(texts[0]!.childNodes)
    .map((node) =>
      node.nodeName === "BR"
        ? "\n"
        : node.nodeType === Node.TEXT_NODE
          ? node.textContent
          : "",
    )
    .join("")
    .replace(/\u200B/g, "");
  const value = root.querySelector("[torph-sr]")?.textContent ?? "";
  return drawn === value
    ? { pass: true, detail: "settled to one run of plain text" }
    : { pass: false, detail: `draws "${drawn}" but the value is "${value}"` };
}

export function verifyDomStandard(root: HTMLElement): {
  pass: boolean;
  detail: string;
} {
  const atRest = restText(root) !== null;
  // At rest there are no boxes to hold residue, only the text to be right.
  const checks: [string, { pass: boolean; detail: string }][] = atRest
    ? [
        ["rest", verifyAtRest(root)],
        ["bounds", verifyItemsInBounds(root)],
        ["overflow", verifyNoOverflow(root)],
        ["exits", verifyExitCleanup(root)],
        ["size", verifyContainerSizeMatch(root)],
      ]
    : [
        ["bounds", verifyItemsInBounds(root)],
        ["overflow", verifyNoOverflow(root)],
        ["exits", verifyExitCleanup(root)],
        ["transform", verifyNoTransformResidue(root)],
        ["opacity", verifyNoOpacityResidue(root)],
        ["styles", verifyStyleCleanup(root)],
        ["ids", verifyNoDuplicateIds(root)],
        ["size", verifyContainerSizeMatch(root)],
      ];

  const align = getComputedStyle(root).textAlign as
    | "left"
    | "center"
    | "right"
    | "start";
  const normalizedAlign = align === "start" ? "left" : align;
  if (
    normalizedAlign === "left" ||
    normalizedAlign === "center" ||
    normalizedAlign === "right"
  ) {
    checks.push(["align", verifyAlignment(root, normalizedAlign)]);
  }

  const lines = getVisualLines(root);
  if (lines.length > 1 && !atRest) {
    checks.push(["br", verifyBrMatchesContent(root)]);
  }

  const failures = checks.filter(([, r]) => !r.pass);
  if (failures.length > 0) {
    return {
      pass: false,
      detail: failures.map(([name, r]) => `${name}: ${r.detail}`).join("; "),
    };
  }
  return { pass: true, detail: `${checks.length} DOM checks passed` };
}

// ── Jump detection ──

export function takeJumpSnapshot(root: HTMLElement): JumpSnapshot {
  const items = new Map<string, DOMRect>();
  root
    .querySelectorAll<HTMLElement>("[torph-item]:not(br):not([torph-exiting])")
    .forEach((item) => {
      const id = item.getAttribute("torph-id");
      if (id) items.set(id, item.getBoundingClientRect());
    });
  const text = restText(root);
  return {
    items,
    glyphs: text ? glyphsIn(text, root) : null,
    rootRect: root.getBoundingClientRect(),
    rootWidth: root.offsetWidth,
    align: getComputedStyle(root).textAlign,
  };
}

/** Every visible glyph under `node`, measured from the root, in reading order. */
function glyphsIn(node: Node, root: HTMLElement): Glyph[] {
  const origin = root.getBoundingClientRect();
  const out: Glyph[] = [];
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (
    let n = walker.nextNode() as Text | null;
    n;
    n = walker.nextNode() as Text | null
  ) {
    for (let i = 0; i < n.length; i++) {
      const ch = n.data[i]!;
      if (/[\s\u00A0\u200B]/.test(ch)) continue;
      range.setStart(n, i);
      range.setEnd(n, i + 1);
      const r = range.getBoundingClientRect();
      out.push({ ch, x: r.left - origin.left, y: r.top - origin.top });
    }
  }
  // Lines first, then along them; a half-line of tolerance absorbs a slot's own box.
  return out.sort((a, b) => (Math.abs(a.y - b.y) > 4 ? a.y - b.y : a.x - b.x));
}

/** What the first frame of a morph shows: boxes still visible, exits included. */
function visibleGlyphs(root: HTMLElement): Glyph[] {
  const visible = (el: HTMLElement) => {
    let opacity = 1;
    for (let e: HTMLElement | null = el; e && e !== root; e = e.parentElement) {
      opacity *= parseFloat(getComputedStyle(e).opacity);
    }
    return opacity > 0.05;
  };
  const glyphs: Glyph[] = [];
  root.querySelectorAll<HTMLElement>("[torph-item]:not(br)").forEach((box) => {
    const mover = (box.firstElementChild as HTMLElement | null) ?? box;
    if (!visible(box) || !visible(mover)) return;
    glyphs.push(...glyphsIn(box, root));
  });
  return glyphs.sort((a, b) =>
    Math.abs(a.y - b.y) > 4 ? a.y - b.y : a.x - b.x,
  );
}

/** From rest, the first frame should redraw the old text exactly — every glyph where it was. */
function verifyNoJumpFromRest(
  root: HTMLElement,
  before: Glyph[],
  tolerance: number,
): Result {
  const after = visibleGlyphs(root);
  const was = before.map((g) => g.ch).join("");
  const now = after.map((g) => g.ch).join("");
  if (was !== now) {
    return {
      pass: false,
      detail: `the first frame shows "${now}" where the text read "${was}"`,
    };
  }
  let worst = 0;
  let at = "";
  before.forEach((g, i) => {
    const d = Math.max(
      Math.abs(after[i]!.x - g.x),
      Math.abs(after[i]!.y - g.y),
    );
    if (d > worst) {
      worst = d;
      at = g.ch;
    }
  });
  return {
    pass: worst <= tolerance,
    detail: `from plain text to boxes, the most any glyph moved on the first frame was ${worst.toFixed(2)}px${at ? ` ("${at}")` : ""}`,
  };
}

export function verifyNoJump(
  root: HTMLElement,
  before: JumpSnapshot,
  tolerance = 2,
): { pass: boolean; detail: string } {
  // From rest, nothing is in motion yet, so anything over half a pixel is a jump.
  if (before.glyphs)
    return verifyNoJumpFromRest(root, before.glyphs, Math.min(tolerance, 0.5));
  const after = takeJumpSnapshot(root);
  const jumps: string[] = [];
  const context: string[] = [];

  context.push(`align=${before.align}→${after.align}`);
  context.push(`rootW: ${before.rootWidth}→${after.rootWidth}`);
  context.push(`scrollW: ${root.scrollWidth}`);

  const rootDx = after.rootRect.left - before.rootRect.left;
  const rootDy = after.rootRect.top - before.rootRect.top;
  if (Math.abs(rootDx) > 0.5) {
    context.push(`rootX: ${rootDx > 0 ? "+" : ""}${rootDx.toFixed(1)}`);
  }
  if (Math.abs(rootDy) > 0.5) {
    context.push(`rootY: ${rootDy > 0 ? "+" : ""}${rootDy.toFixed(1)}`);
  }

  after.items.forEach((cur, id) => {
    const old = before.items.get(id);
    if (!old) return;
    // Subtract root movement so layout shifts from other cards
    // during morph-all don't count as item jumps
    const dx = cur.left - old.left - rootDx;
    const dy = cur.top - old.top - rootDy;
    const el = root.querySelector<HTMLElement>(`[torph-id="${id}"]`);
    if (!el) return;
    const text = el.textContent?.trim() || id;
    const isExiting = el.hasAttribute("torph-exiting");
    const cs = getComputedStyle(el);
    const transform = cs.transform;
    const opacity = parseFloat(cs.opacity);
    const anims = el.getAnimations();
    const animNames =
      anims.map((a) => (a as CSSAnimation).animationName ?? "?").join(",") ||
      "none";

    if (Math.abs(dx) > tolerance || Math.abs(dy) > tolerance) {
      jumps.push(
        `"${text}"${isExiting ? "(exit)" : ""} Δ${dx > 0 ? "+" : ""}${dx.toFixed(1)},${dy > 0 ? "+" : ""}${dy.toFixed(1)}` +
          ` opacity=${opacity.toFixed(2)} tf=${transform} anims=${anims.length}(${animNames})` +
          ` w=${cur.width.toFixed(1)} was=${old.width.toFixed(1)}`,
      );
    }
  });

  before.items.forEach((_, id) => {
    if (!after.items.has(id)) {
      context.push(`"${id}" vanished`);
    }
  });

  const header = `[${context.join(" | ")}]`;
  if (jumps.length > 0) {
    return { pass: false, detail: `${header} ${jumps.join("; ")}` };
  }
  return { pass: true, detail: `${header} no frame-0 jump` };
}

// ── Frame performance monitor ──

export class FrameMonitor {
  private frames: number[] = [];
  private rafId: number | null = null;
  private lastTime = 0;
  private running = false;
  private startTime = 0;
  private firstFrameTime = 0;

  start() {
    this.stop();
    this.frames = [];
    this.lastTime = 0;
    this.running = true;
    this.startTime = performance.now();
    this.firstFrameTime = 0;
    this.rafId = requestAnimationFrame(this.tick);
  }

  stop(): PerfResult {
    this.running = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    const frameTimes = this.frames;
    const morphTime =
      this.firstFrameTime > 0 ? this.firstFrameTime - this.startTime : 0;

    if (frameTimes.length === 0) {
      return {
        pass: true,
        detail: `no frames | morph=${morphTime.toFixed(1)}ms`,
        totalFrames: 0,
        droppedFrames: 0,
        longestFrame: 0,
        avgFrame: 0,
        morphTime,
      };
    }

    const longestFrame = Math.max(...frameTimes);
    const avgFrame = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
    const sorted = [...frameTimes].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)] || 16.67;
    const dropThreshold = Math.max(median * 2, 34);
    const droppedFrames = frameTimes.filter((t) => t > dropThreshold).length;
    const totalFrames = frameTimes.length;

    const issues: string[] = [];
    if (droppedFrames > 0) {
      issues.push(`${droppedFrames} dropped`);
    }
    if (longestFrame > 50) {
      issues.push(`worst: ${longestFrame.toFixed(1)}ms`);
    }
    if (morphTime > 16) {
      issues.push(`morph: ${morphTime.toFixed(1)}ms`);
    }

    const hz = Math.round(1000 / median);
    const pass = droppedFrames === 0 && longestFrame <= dropThreshold;
    const detail = pass
      ? `${totalFrames}f@${hz}Hz avg=${avgFrame.toFixed(1)}ms worst=${longestFrame.toFixed(1)}ms morph=${morphTime.toFixed(1)}ms`
      : `${totalFrames}f@${hz}Hz ${issues.join(" | ")} avg=${avgFrame.toFixed(1)}ms morph=${morphTime.toFixed(1)}ms`;

    return {
      pass,
      detail,
      totalFrames,
      droppedFrames,
      longestFrame,
      avgFrame,
      morphTime,
    };
  }

  private tick = () => {
    if (!this.running) return;
    const now = performance.now();
    if (this.lastTime > 0) {
      this.frames.push(now - this.lastTime);
    } else {
      this.firstFrameTime = now;
    }
    this.lastTime = now;
    this.rafId = requestAnimationFrame(this.tick);
  };
}

export function measurePerf(
  fn: () => { pass: boolean; detail: string },
  iterations = 100,
) {
  const start = performance.now();
  let result: { pass: boolean; detail: string } = { pass: true, detail: "" };
  for (let i = 0; i < iterations; i++) {
    result = fn();
  }
  const elapsed = performance.now() - start;
  return { ...result, timeMs: elapsed / iterations };
}

/**
 * Every rendered digit occupies the same advance width.
 *
 * The corpus asserts that no persisted character changes index; this asserts
 * the other half of the tabular promise, which only real layout can answer —
 * that the font actually delivers equal-width figures and that nothing in the
 * morph (a stray transform, a per-character style) has widened one of them.
 */
export function verifyTabularDigits(root: HTMLElement): {
  pass: boolean;
  detail: string;
} {
  const digits = Array.from(
    root.querySelectorAll<HTMLElement>("[torph-item]:not([torph-exiting])"),
  ).filter((item) => /^\d$/.test(item.textContent ?? ""));

  if (digits.length < 2) {
    return {
      pass: true,
      detail: `${digits.length} digits — nothing to compare`,
    };
  }

  const tolerance = 0.5;
  const widths = digits.map((d) => d.getBoundingClientRect().width);
  const min = Math.min(...widths);
  const max = Math.max(...widths);

  if (max - min > tolerance) {
    const widest = digits[widths.indexOf(max)]!.textContent;
    const narrowest = digits[widths.indexOf(min)]!.textContent;
    return {
      pass: false,
      detail: `digit widths vary by ${(max - min).toFixed(2)}px ("${widest}" ${max.toFixed(2)}px vs "${narrowest}" ${min.toFixed(2)}px) — not tabular`,
    };
  }

  return {
    pass: true,
    detail: `${digits.length} digits share a ${max.toFixed(2)}px column`,
  };
}

/** The morphed text spans the same width as the same string set as one run. */
export function verifyKerning(
  root: HTMLElement,
  reference: HTMLElement,
  tolerance = 0.5,
): Result & { off: number } {
  const items = Array.from(
    root.querySelectorAll<HTMLElement>(
      "[torph-item]:not([torph-exiting]):not(br)",
    ),
  );
  const text = root.querySelector<HTMLElement>("[torph-text]");
  if (items.length === 0 && !text)
    return { pass: true, detail: "nothing rendered", off: 0 };

  // At rest the value is plain text, so the run itself is what's measured.
  const rects = items.length
    ? items.map((item) => item.getBoundingClientRect())
    : textRects(text!);
  const left = Math.min(...rects.map((r) => r.left));
  const right = Math.max(...rects.map((r) => r.right));
  const morphed = right - left;
  const expected = reference.getBoundingClientRect().width;
  const naive = rects.reduce((sum, r) => sum + r.width, 0);
  const off = morphed - expected;
  const detail = `${morphed.toFixed(2)}px vs ${expected.toFixed(2)}px as one run (${off >= 0 ? "+" : ""}${off.toFixed(2)}px; ${items.length ? `unkerned boxes ${naive.toFixed(2)}px` : "at rest, drawn as plain text"})`;

  return { pass: Math.abs(off) <= tolerance, detail, off };
}

/** The rects of a `[torph-text]` span's lines — its text nodes, not the probe beside them. */
export function textRects(text: HTMLElement): DOMRect[] {
  return Array.from(text.childNodes)
    .filter((node) => node.nodeType === Node.TEXT_NODE && node.textContent)
    .map((node) => {
      const range = document.createRange();
      range.selectNodeContents(node);
      return range.getBoundingClientRect();
    });
}

// ── Join (boxes back into text) ──

export type BoxGlyph = { text: string; x: number; y: number };

const translateOf = (element: Element) => {
  const { transform } = getComputedStyle(element);
  if (!transform || transform === "none") return { x: 0, y: 0 };
  const matrix = new DOMMatrixReadOnly(transform);
  return { x: matrix.e, y: matrix.f };
};

/** The rect of a node's first character, measured from the root. */
function firstGlyph(node: Text, offset: number, root: DOMRect) {
  const range = document.createRange();
  range.setStart(node, offset);
  range.setEnd(node, Math.min(offset + 1, node.length));
  const rect = range.getBoundingClientRect();
  return { x: rect.left - root.left, y: rect.top - root.top };
}

/** Where each box's first glyph sits once every transform has played out. */
export function boxGlyphs(root: HTMLElement): BoxGlyph[] | null {
  const boxes = Array.from(
    root.querySelectorAll<HTMLElement>("[torph-item]:not([torph-exiting])"),
  );
  if (boxes.length === 0) return null;
  const origin = root.getBoundingClientRect();
  return boxes.map((box) => {
    if (box.tagName === "BR") return { text: "\n", x: 0, y: 0 };
    const node = document
      .createTreeWalker(box, NodeFilter.SHOW_TEXT)
      .nextNode() as Text | null;
    if (!node) return { text: "", x: 0, y: 0 };
    const at = firstGlyph(node, 0, origin);
    // A slot's glyph sits in a span that slides on its own.
    let x = at.x;
    let y = at.y;
    for (
      let el: Element | null = node.parentElement;
      el && el !== root;
      el = el.parentElement
    ) {
      const t = translateOf(el);
      x -= t.x;
      y -= t.y;
    }
    return { text: box.textContent ?? "", x, y };
  });
}

/** How far each box's first glyph moves when the boxes give way to the text. */
export function snapAtJoin(
  root: HTMLElement,
  glyphs: BoxGlyph[],
  tolerance = 0.5,
): Result | null {
  const text = root.querySelector("[torph-text]");
  if (!text) return null;
  const lines = Array.from(text.childNodes).filter(
    (node): node is Text => node.nodeType === Node.TEXT_NODE,
  );
  const origin = root.getBoundingClientRect();
  let line = 0;
  let offset = 0;
  let dx = 0;
  let dy = 0;
  for (const glyph of glyphs) {
    if (glyph.text === "\n") {
      line++;
      offset = 0;
      continue;
    }
    const node = lines[line];
    if (!node || offset >= node.length) return null;
    const at = firstGlyph(node, offset, origin);
    dx = Math.max(dx, Math.abs(at.x - glyph.x));
    dy = Math.max(dy, Math.abs(at.y - glyph.y));
    offset += glyph.text.length;
  }
  return {
    pass: dx <= tolerance && dy <= tolerance,
    detail: `boxes joined back into text; glyphs moved ${dx.toFixed(2)}px across, ${dy.toFixed(2)}px down at most`,
  };
}

/**
 * Follows a morph's boxes from near its end until they join back into text; the
 * returned call reports the join. Reading only near the end keeps every earlier
 * frame free of the reads, so a frame-timing check alongside it stays honest.
 */
export function trackJoin(root: HTMLElement, startAfter: number) {
  let last: BoxGlyph[] | null = null;
  let frame = 0;
  const tick = () => {
    const glyphs = boxGlyphs(root);
    if (glyphs) last = glyphs;
    frame = requestAnimationFrame(tick);
  };
  const timer = setTimeout(
    () => {
      frame = requestAnimationFrame(tick);
    },
    Math.max(0, startAfter),
  );
  return (): Result | null => {
    clearTimeout(timer);
    cancelAnimationFrame(frame);
    return last ? snapAtJoin(root, last) : null;
  };
}
