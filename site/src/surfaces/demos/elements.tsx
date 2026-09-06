import styles from "./elements.module.scss";

import React from "react";
import { TextMorph } from "torph/react";

import { useCycle } from "./use-cycle";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

// Three shapes of the same thing: an element child is a segment. It enters, exits
// and travels with the words, and its key is what decides which of those it does.

const PEOPLE = {
  ana: { name: "Ana", tint: "#e2703f" },
  bo: { name: "Bo", tint: "#3f7de2" },
  cy: { name: "Cy", tint: "#8a5fd6" },
} as const;

type Person = keyof typeof PEOPLE;

export const ROOM: Person[][] = [
  ["ana"],
  ["ana", "bo"],
  ["ana", "bo", "cy"],
  ["bo", "cy"],
];

export function listNames(people: Person[]): string {
  const names = people.map((id) => PEOPLE[id].name);
  if (names.length < 2) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** A key that outlives the value it sits in: whoever stays, stays put. */
export const Presence = () => {
  const index = useCycle(ROOM.length, 2000);
  const people = ROOM[index]!;

  return (
    <div className={styles.stage}>
      <TextMorph>
        {people.map((id) => (
          <span
            key={id}
            className={styles.avatar}
            style={{ background: PEOPLE[id].tint }}
            aria-hidden="true"
          >
            {PEOPLE[id].name[0]}
          </span>
        ))}
        {` ${listNames(people)} ${people.length > 1 ? "are" : "is"} editing`}
      </TextMorph>
    </div>
  );
};

export const SHORTCUTS = [
  { keys: ["cmd", "k"], tail: "to search" },
  { keys: ["cmd", "shift", "p"], tail: "for commands" },
  { keys: ["esc"], tail: "to close" },
];

const GLYPH: Record<string, string> = {
  cmd: "⌘",
  shift: "⇧",
  k: "K",
  p: "P",
  esc: "esc",
};

/** Not every element is a picture — these are boxes, and they read as their text. */
export const Shortcut = () => {
  const index = useCycle(SHORTCUTS.length, 2000);
  const { keys, tail } = SHORTCUTS[index]!;

  return (
    <div className={styles.stage}>
      <TextMorph>
        {"Press "}
        {keys.map((key) => (
          <kbd key={key} className={styles.key}>
            {GLYPH[key]}
          </kbd>
        ))}
        {` ${tail}`}
      </TextMorph>
    </div>
  );
};

export const SCORES = [4.8, 3.4, 4.2, 5];

const Star = ({ filled }: { filled: boolean }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
    <path
      d="M12 2.5l2.9 6.2 6.6.9-4.8 4.8 1.2 6.8L12 18l-5.9 3.2 1.2-6.8L2.5 9.6l6.6-.9L12 2.5z"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
      opacity={filled ? 1 : 0.35}
    />
  </svg>
);

/** Keyed on what it shows, so a star that changes swaps and the rest hold still. */
export const Rating = () => {
  const index = useCycle(SCORES.length, 2200);
  const score = SCORES[index]!;

  return (
    <div className={styles.stage}>
      <TextMorph>
        {[0, 1, 2, 3, 4].map((i) => {
          const filled = score >= i + 0.5;
          return (
            <span
              key={`${i}:${filled}`}
              className={styles.star}
              aria-hidden="true"
            >
              <Star filled={filled} />
            </span>
          );
        })}
        {` ${score.toFixed(1)} from 1,208 reviews`}
      </TextMorph>
    </div>
  );
};

export const STEPS = [
  "Install dependencies",
  "Run the test suite",
  "Publish to npm",
];

const Box = ({ done }: { done: boolean }) => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <rect
      x="1"
      y="1"
      width="14"
      height="14"
      rx="4"
      fill={done ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.5"
      opacity={done ? 1 : 0.4}
    />
    {done && (
      <path
        d="M4.6 8.2l2.2 2.2 4.6-4.7"
        stroke="var(--body-light)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    )}
  </svg>
);

/** Elements on every line of a multi-line value, each swapping where it stands. */
export const Checklist = () => {
  const done = useCycle(STEPS.length + 1, 1400);

  return (
    <div className={`${styles.stage} ${styles.block}`}>
      <TextMorph>
        {STEPS.flatMap((step, i) => [
          <span
            key={`${i}:${i < done}`}
            className={styles.box}
            aria-hidden="true"
          >
            <Box done={i < done} />
          </span>,
          ` ${step}${i < STEPS.length - 1 ? "\n" : ""}`,
        ])}
      </TextMorph>
    </div>
  );
};

const SWATCH = {
  a: "#e2703f",
  b: "#3f7de2",
  c: "#8a5fd6",
  d: "#3fb884",
  e: "#d64f7f",
} as const;

type Swatch = keyof typeof SWATCH;

export const DECKS: Swatch[][] = [
  ["a", "b", "c"],
  ["b", "c", "d"],
  ["d", "b", "e"],
  ["a", "b", "c", "d", "e"],
];

/** No text at all — a value can be nothing but elements, and still reorders. */
export const Deck = () => {
  const index = useCycle(DECKS.length, 1600);

  return (
    <div className={styles.stage}>
      <TextMorph>
        {DECKS[index]!.map((id) => (
          <span
            key={id}
            className={styles.swatch}
            style={{ background: SWATCH[id] }}
            aria-hidden="true"
          />
        ))}
      </TextMorph>
    </div>
  );
};

export const PATHS = [
  ["Design"],
  ["Design", "Brand"],
  ["Design", "Brand", "Logo.fig"],
  ["Design", "Logo.fig"],
];

const Glyph = ({ file }: { file: boolean }) => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
    <path
      d={file ? "M4 1.5h5l3 3v10H4v-13z" : "M1.5 3.5h4.5l1.5 2h7v8h-13v-10z"}
      fill="currentColor"
      opacity="0.75"
    />
  </svg>
);

/** One element at the head, one in the middle, one at the tail — all keyed alike. */
export const Breadcrumb = () => {
  const index = useCycle(PATHS.length, 1800);
  const path = PATHS[index]!;

  return (
    <div className={styles.stage}>
      <TextMorph>
        {path.flatMap((name, i) => [
          <span key={name} className={styles.crumb} aria-hidden="true">
            <Glyph file={name.includes(".")} />
          </span>,
          ` ${name}${i < path.length - 1 ? " / " : ""}`,
        ])}
      </TextMorph>
    </div>
  );
};

export const EMPHASIS = [
  { lead: "", bold: "Ana", tail: " replied to your comment" },
  { lead: "Ana replied to ", bold: "your comment", tail: "" },
  { lead: "Ana ", bold: "replied", tail: " to your comment" },
];

/** The words hold still and the weight moves between them. */
export const Emphasis = () => {
  const index = useCycle(EMPHASIS.length, 2000);
  const { lead, bold, tail } = EMPHASIS[index]!;

  return (
    <div className={styles.stage}>
      <TextMorph>
        {lead}
        <strong>{bold}</strong>
        {tail}
      </TextMorph>
    </div>
  );
};

type Scrobble = {
  id: string;
  title: string;
  artist: string;
  image: string;
  tint?: string;
};

/** Stands in until the scrobbles land, and if they never do. */
export const PLAYLIST: Scrobble[] = [
  {
    id: "monday",
    title: "Blue Monday",
    artist: "New Order",
    image: "",
    tint: "#2f4fd6",
  },
  {
    id: "riot",
    title: "Teen Age Riot",
    artist: "Sonic Youth",
    image: "",
    tint: "#d6a02f",
  },
  {
    id: "brown",
    title: "Golden Brown",
    artist: "Stranglers",
    image: "",
    tint: "#b8543f",
  },
];

/** Real album art, arriving after the first paint — the cover is a segment either way. */
export const NowPlaying = () => {
  const [tracks, setTracks] = React.useState(PLAYLIST);
  const index = useCycle(tracks.length, 2200);
  const track = tracks[index] ?? tracks[0]!;

  React.useEffect(() => {
    let live = true;

    const load = async () => {
      try {
        const response = await fetch("/api/scrobbles");
        const data = (await response.json()) as { tracks: Scrobble[] };
        if (live && data.tracks.length > 0) setTracks(data.tracks);
      } catch {
        // The fallback list is already on screen.
      }
    };

    load();
    const id = window.setInterval(load, 60_000);
    return () => {
      live = false;
      window.clearInterval(id);
    };
  }, []);

  return (
    <div className={styles.player}>
      {/* The art is a value of its own: one element, swapped when the track turns over. */}
      <TextMorph>
        {track.image ? (
          <img
            key={track.id}
            className={styles.cover}
            src={track.image}
            alt=""
            width={56}
            height={56}
          />
        ) : (
          <span
            key={track.id}
            className={styles.cover}
            style={{ background: track.tint }}
            aria-hidden="true"
          />
        )}
      </TextMorph>

      <TextMorph className={styles.meta}>
        <strong>{track.title}</strong>
        <br />
        <small className={styles.artist}>{track.artist}</small>
      </TextMorph>
    </div>
  );
};

export const UPLOADED = [2, 4, 5, 7, 9];

/** The ring spins on its own: a key that never changes is a node never disturbed. */
export const Uploading = () => {
  const index = useCycle(UPLOADED.length, 1100);

  return (
    <div className={styles.stage}>
      <TextMorph>
        <span key="ring" className={styles.ring} aria-hidden="true" />
        {` Uploading ${UPLOADED[index]!} of 9 files`}
      </TextMorph>
    </div>
  );
};

/** A persisting element whose insides change — React updates it, torph places it. */
export const Toggle = () => {
  const on = useCycle(2, 1600) === 1;

  return (
    <div className={styles.stage}>
      <TextMorph>
        {"Notifications "}
        <span
          key="switch"
          className={`${styles.switch} ${on ? styles.switchOn : ""}`}
          aria-hidden="true"
        >
          <span className={styles.knob} />
        </span>
        {on ? " on" : " off"}
      </TextMorph>
    </div>
  );
};

export const FILTERS_ALL = ["Design", "Urgent", "Q4", "Mobile"];

/**
 * Real buttons inside a morph: `data-torph-interactive` keeps an element in the
 * accessibility tree, so it is focusable *and* announced rather than one or the other.
 */
export const Chips = () => {
  const [kept, setKept] = React.useState(FILTERS_ALL);

  return (
    <div className={styles.chips}>
      <TextMorph>
        {kept.map((name) => (
          <button
            key={name}
            type="button"
            data-torph-interactive=""
            className={styles.chip}
            onClick={() => setKept((all) => all.filter((n) => n !== name))}
          >
            {name}
            <span aria-hidden="true">×</span>
          </button>
        ))}
        {kept.length === 0 ? "No filters" : ""}
      </TextMorph>

      {kept.length < FILTERS_ALL.length && (
        <button
          type="button"
          className={styles.reset}
          onClick={() => setKept(FILTERS_ALL)}
        >
          Reset
        </button>
      )}
    </div>
  );
};

export const PASSAGE =
  "Torph measures every segment, moves it to where it belongs, and lets the lines fall where the width puts them.";

const WORDS = PASSAGE.split(" ");

/** `wrap` lets the words rewrap as they arrive, instead of breaking where told to. */
export const Reflow = () => {
  const [count, setCount] = React.useState(6);
  const reducedMotion = usePrefersReducedMotion();

  React.useEffect(() => {
    if (reducedMotion) return;
    const done = count >= WORDS.length;
    const timer = window.setTimeout(
      () => setCount((n) => (done ? 6 : n + 1)),
      done ? 2400 : 260,
    );
    return () => window.clearTimeout(timer);
  }, [count, reducedMotion]);

  const shown = reducedMotion ? WORDS.length : count;

  return (
    <div className={styles.passage}>
      <TextMorph wrap className={styles.wrapped}>
        {WORDS.slice(0, shown).join(" ")}
      </TextMorph>
    </div>
  );
};
