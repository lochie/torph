// The 404's whole trick: a Levenshtein alignment, replayed a few edits at a time,
// so the path someone mistyped visibly repairs itself into the one that exists.

type Op = { from: string; to: string }; // "" on a side is an insert or a delete

const keeps = (text: string): Op[] =>
  [...text].map((char) => ({ from: char, to: char }));

const align = (from: string, to: string): Op[] => {
  // Trimming the shared ends leaves the distance alone and pins the leading "/",
  // which a free-running backtrace will otherwise delete on its way to a later one.
  let head = 0;
  while (head < from.length && head < to.length && from[head] === to[head]) {
    head += 1;
  }

  let tail = 0;
  while (
    tail < from.length - head &&
    tail < to.length - head &&
    from[from.length - 1 - tail] === to[to.length - 1 - tail]
  ) {
    tail += 1;
  }

  const a = from.slice(head, from.length - tail);
  const b = to.slice(head, to.length - tail);

  const cols = b.length + 1;
  const dist = new Uint16Array((a.length + 1) * cols);

  for (let i = 0; i <= a.length; i += 1) dist[i * cols] = i;
  for (let j = 0; j <= b.length; j += 1) dist[j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const swap = a[i - 1] === b[j - 1] ? 0 : 1;
      dist[i * cols + j] = Math.min(
        dist[(i - 1) * cols + j]! + 1,
        dist[i * cols + j - 1]! + 1,
        dist[(i - 1) * cols + j - 1]! + swap,
      );
    }
  }

  const middle: Op[] = [];
  let i = a.length;
  let j = b.length;

  while (i > 0 || j > 0) {
    const here = dist[i * cols + j]!;
    const swap = i > 0 && j > 0 && a[i - 1] !== b[j - 1] ? 1 : 0;

    // Diagonal first: a substitution in place reads better than a delete then an insert.
    if (i > 0 && j > 0 && here === dist[(i - 1) * cols + j - 1]! + swap) {
      middle.push({ from: a[i - 1]!, to: b[j - 1]! });
      i -= 1;
      j -= 1;
    } else if (i > 0 && here === dist[(i - 1) * cols + j]! + 1) {
      middle.push({ from: a[i - 1]!, to: "" });
      i -= 1;
    } else {
      middle.push({ from: "", to: b[j - 1]! });
      j -= 1;
    }
  }

  return [
    ...keeps(from.slice(0, head)),
    ...middle.reverse(),
    ...keeps(from.slice(from.length - tail)),
  ];
};

const editCount = (from: string, to: string) =>
  align(from, to).filter((op) => op.from !== op.to).length;

const applied = (ops: Op[], count: number) => {
  let done = 0;
  let text = "";

  for (const op of ops) {
    if (op.from === op.to) text += op.from;
    else text += done++ < count ? op.to : op.from;
  }

  return text;
};

const MAX_STEPS = 7; // A junk path erodes in bites rather than a letter at a time

/** `left` is the edits still outstanding — the countdown the page reads out. */
export type Step = { text: string; left: number };

export const repairSteps = (from: string, to: string): Step[] => {
  const ops = align(from, to);
  const edits = ops.filter((op) => op.from !== op.to).length;
  const bite = Math.ceil(edits / MAX_STEPS) || 1;

  const steps: Step[] = [];
  for (let done = 0; done < edits; done += bite) {
    steps.push({ text: applied(ops, done), left: edits - done });
  }
  steps.push({ text: to, left: 0 });

  return steps;
};

const LIMIT = 28; // A bot's URL would otherwise buy itself a minute of edits

export const tidyPath = (path: string) => {
  let tidy = path;
  try {
    tidy = decodeURIComponent(path);
  } catch {
    // A malformed escape is the address as typed; leave it be.
  }

  tidy = tidy.toLowerCase().replace(/\/+$/, "") || "/";
  return tidy.length > LIMIT ? `${tidy.slice(0, LIMIT - 1)}…` : tidy;
};

export type Match = { route: string; distance: number; close: boolean };

export const nearest = (path: string, routes: string[]): Match => {
  let best = routes[0]!;
  let distance = Infinity;

  for (const route of routes) {
    const d = editCount(path, route);
    if (d < distance) {
      distance = d;
      best = route;
    }
  }

  // Past this it is not a typo, it is a different word — and the fix is home.
  const tolerance = Math.max(
    1,
    Math.floor(Math.max(path.length, best.length) * 0.4),
  );

  if (distance <= tolerance) return { route: best, distance, close: true };
  return { route: "/", distance: editCount(path, "/"), close: false };
};
