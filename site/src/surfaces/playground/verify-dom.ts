import type { Result } from "@torph/test-cases";

// Needs real geometry and the Web Animations API, so none of this can run in
// the node suite. Text-matching assertions live in `packages/test-cases`.

export type VerifyDomFn = (root: HTMLElement) => Result;

export type JumpSnapshot = {
  items: Map<string, DOMRect>;
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
  const items = root.querySelectorAll<HTMLElement>(
    "[torph-item]:not([torph-exiting])",
  );
  const oob: string[] = [];
  items.forEach((item) => {
    if (item.tagName === "BR") return;
    const r = item.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return;
    const tolerance = 2;
    if (
      r.left < rootRect.left - tolerance ||
      r.right > rootRect.right + tolerance ||
      r.top < rootRect.top - tolerance ||
      r.bottom > rootRect.bottom + tolerance
    ) {
      const text = item.textContent?.trim() || "?";
      oob.push(`"${text}" out of bounds`);
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
    const texts = line.map(({ el }) => `"${el.textContent?.trim() || "?"}"`).join(" ");

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

export function getVisualLines(root: HTMLElement): { rect: DOMRect; el: HTMLElement }[][] {
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
    if (item.style.width && item.style.width !== "auto") {
      issues.push(
        `"${item.textContent?.trim() || "?"}" has width:${item.style.width}`,
      );
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

export function verifyDomStandard(root: HTMLElement): {
  pass: boolean;
  detail: string;
} {
  const checks: [string, { pass: boolean; detail: string }][] = [
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
  if (lines.length > 1) {
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
  root.querySelectorAll<HTMLElement>("[torph-item]:not(br):not([torph-exiting])").forEach((item) => {
    const id = item.getAttribute("torph-id");
    if (id) items.set(id, item.getBoundingClientRect());
  });
  return {
    items,
    rootRect: root.getBoundingClientRect(),
    rootWidth: root.offsetWidth,
    align: getComputedStyle(root).textAlign,
  };
}

export function verifyNoJump(
  root: HTMLElement,
  before: JumpSnapshot,
  tolerance = 2,
): { pass: boolean; detail: string } {
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
    const animNames = anims.map((a) => (a as CSSAnimation).animationName ?? "?").join(",") || "none";

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
