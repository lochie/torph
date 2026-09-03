export type Entry = {
  /** Doubles as the basename of every asset under `public/showcase`. */
  slug: string;
  author: string;
  handle: string;
  /** The post it was shared in, and the source for everything below. */
  url: string;
  /** Posted on, as `YYYY-MM-DD`. Formatted for display in the card. */
  date: string;
  /**
   * Width ÷ height of the capture. The frame is sized from this so the column
   * does not reflow when the video's own dimensions arrive.
   */
  aspect: number;
  /**
   * The post, verbatim — mentions, line breaks, typographic flourishes and all.
   * Quoting people rather than paraphrasing them is the point of the page, and
   * it keeps us from describing anyone as having built something they didn't.
   * Links are written out in full; the card shortens them the way X does.
   */
  text: string;
};

/**
 * Hand-ordered rather than sorted by date: the first screen should be the most
 * convincing thing anyone has built, not the most recent.
 */
export const ENTRIES: Entry[] = [
  {
    slug: "anaarsonist",
    author: "ana howard",
    handle: "AnaArsonist",
    url: "https://x.com/AnaArsonist/status/2077348234058481881",
    date: "2026-07-15",
    aspect: 808 / 720,
    text: "interactive ui mocks on https://aave.com/pro 🕹️✨",
  },
  {
    slug: "kianbazza",
    author: "kian bazza",
    handle: "kianbazza",
    url: "https://x.com/kianbazza/status/2023881894920937728",
    date: "2026-02-17",
    aspect: 1134 / 1080,
    text: "Morphing braille loader for async item creation\n\n⊙ Dynamic label preview in header\n⊙ Loader powered by 𝚖𝚘𝚝𝚒𝚘𝚗\n⊙ Smooth transition from loading → success state\n⊙ Exit animation via <𝙰𝚗𝚒𝚖𝚊𝚝𝚎𝙿𝚛𝚎𝚜𝚎𝚗𝚌𝚎 />\n⊙ Text morphing with 𝚝𝚘𝚛𝚙𝚑 by @lochieaxon",
  },
  {
    slug: "sharqiewicz",
    author: "Kacper Szarkiewicz",
    handle: "sharqiewicz",
    url: "https://x.com/sharqiewicz/status/2059295514445648367",
    date: "2026-05-26",
    aspect: 1280 / 720,
    text: "You can now use Numora (framework agnostic numeric input library) with Torph from @lochieaxon to achieve animated numeric input like this👀\n\nFor both OnChange and OnBlur modes 💪\n\nThe docs contain full integration guide: https://numeric-input.com/docs/numora-react/integrations/torph",
  },
  {
    slug: "kalembakonrad",
    author: "konrad",
    handle: "kalembakonrad",
    url: "https://x.com/kalembakonrad/status/2030696773845455188",
    date: "2026-03-08",
    aspect: 1466 / 682,
    text: 'added an "unsaved changes" indicator; text morphing animation made with @lochieaxon torph library 🙏\n\nps we just added google search console integration so you can now get daily reports about your search performance!',
  },
  {
    slug: "rxrz",
    author: "abdurrazaq usul",
    handle: "_rxrz",
    url: "https://x.com/_rxrz/status/2086605763401679067",
    date: "2026-08-10",
    aspect: 800 / 720,
    text: "playing with @lochieaxon's torph",
  },
];
