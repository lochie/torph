"use client";

import styles from "./styles.module.scss";

import { CSSProperties, Fragment, useEffect, useRef } from "react";

import { Footer } from "@/components/footer";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { ENTRIES, type Entry } from "./entries";
import { Header } from "@/components/header";

const XLogo = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

/**
 * Pinned to a locale and to UTC so the server and the client agree on the
 * string. Left to the reader's locale it renders one way in the HTML and
 * another after hydration, which React counts as a mismatch.
 */
const DATE = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const formatDate = (date: string) => DATE.format(new Date(`${date}T00:00:00Z`));

const ENTITY = /(https?:\/\/\S+|@\w{1,15})/g;

/** `example.com/a/b/c` — no scheme, no trailing slash, elided when it runs on. */
const displayUrl = (url: string) => {
  const bare = url
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/$/, "");

  return bare.length > 32 ? `${bare.slice(0, 32)}…` : bare;
};

/**
 * A post whose mentions and links have gone to plain text does not read as the
 * post it is quoting, so both are linked back up. Split out of the text itself
 * rather than carried as per-entry offsets: the text is stored verbatim, so
 * the entities are already recoverable from it.
 */
const renderText = (text: string) =>
  text.split(ENTITY).map((part, i) => {
    // Anchored, so a bare "@" in prose is left as the text it is rather than
    // being mistaken for the handle the split never captured.
    const isMention = /^@\w{1,15}$/.test(part);
    const isUrl = /^https?:\/\//.test(part);

    if (!isMention && !isUrl) return <Fragment key={i}>{part}</Fragment>;

    return (
      <a
        key={i}
        href={isMention ? `https://x.com/${part.slice(1)}` : part}
        target="_blank"
        rel="noopener noreferrer"
      >
        {isMention ? part : displayUrl(part)}
      </a>
    );
  });

/**
 * Every clip looping at once is five decoders running for the four cards
 * nobody is looking at, so each one runs only while it is on screen. A reader
 * who has asked for less motion opts out of the arrangement entirely and gets
 * the controls instead — the clips are the content here, so the answer is to
 * hand them over rather than to drop them.
 */
const useInViewPlayback = (paused: boolean) => {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;

    // Reached when the media query flips after the first paint, by which point
    // the observer below may already have started it.
    if (paused) {
      video.pause();
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        // play() rejects when the element is paused again before it resolves,
        // which is what scrolling straight past a card does.
        if (entry.isIntersecting) video.play().catch(() => {});
        else video.pause();
      },
      { threshold: 0.2 },
    );

    observer.observe(video);
    return () => observer.disconnect();
  }, [paused]);

  return ref;
};

const Card = ({ entry }: { entry: Entry }) => {
  const reducedMotion = usePrefersReducedMotion();
  const ref = useInViewPlayback(reducedMotion);

  return (
    <article className={styles.card}>
      <header className={styles.head}>
        <a
          className={styles.author}
          href={`https://x.com/${entry.handle}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <img
            src={`/showcase/${entry.slug}-avatar.jpg`}
            alt=""
            width={40}
            height={40}
          />
          <span className={styles.identity}>
            <span className={styles.name}>{entry.author}</span>
            <span className={styles.byline}>@{entry.handle}</span>
          </span>
        </a>

        <a
          className={styles.source}
          href={entry.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Read this post by ${entry.author} on X`}
        >
          <XLogo />
        </a>
      </header>

      <p className={styles.text}>{renderText(entry.text)}</p>

      <a
        className={styles.author}
        href={entry.url}
        target="_blank"
        rel="noopener noreferrer"
      >
        <div
          className={styles.frame}
          style={{ "--aspect": entry.aspect } as CSSProperties}
        >
          <video
            ref={ref}
            src={`/showcase/${entry.slug}.mp4`}
            poster={`/showcase/${entry.slug}.jpg`}
            // Muted and inline are the conditions under which a browser will
            // autoplay at all, on iOS especially.
            muted
            loop
            playsInline
            preload="metadata"
            controls={reducedMotion}
            aria-label={`Screen recording attached to ${entry.author}'s post`}
          />
        </div>
      </a>
    </article>
  );
};

export const Showcase = () => {
  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <Header />
      </div>

      <div className={styles.grid}>
        {ENTRIES.map((entry) => (
          <Card key={entry.slug} entry={entry} />
        ))}
      </div>

      <div className={styles.callout}>
        <p>
          Made something cool with Torph? Tag{" "}
          <a
            href="https://x.com/lochieaxon"
            target="_blank"
            rel="noopener noreferrer"
          >
            @lochieaxon
          </a>
          {" and it might make its way here."}
        </p>
      </div>

      <div className={styles.container}>
        <Footer />
      </div>
    </div>
  );
};
