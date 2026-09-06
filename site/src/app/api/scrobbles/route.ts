const USER = "lochieaxon";
const ENDPOINT = "https://ws.audioscrobbler.com/2.0/";

export type Scrobble = {
  id: string;
  title: string;
  artist: string;
  image: string;
};

type LastfmTrack = {
  name: string;
  url: string;
  mbid?: string;
  artist: { "#text": string };
  image: { size: string; "#text": string }[];
};

/**
 * Proxied rather than fetched from the page, so the key stays out of the bundle.
 * Set `LASTFM_API_KEY`; without it the demo falls back to its own list.
 */
export async function GET() {
  const key = process.env.LASTFM_API_KEY;
  if (!key) return Response.json({ tracks: [] });

  const url = `${ENDPOINT}?method=user.getrecenttracks&user=${USER}&api_key=${key}&limit=4&format=json`;

  try {
    const response = await fetch(url, { next: { revalidate: 60 } });
    if (!response.ok) return Response.json({ tracks: [] });

    const data = (await response.json()) as {
      recenttracks?: { track?: LastfmTrack[] };
    };

    const tracks: Scrobble[] = (data.recenttracks?.track ?? [])
      .map((track) => ({
        // The same song scrobbled twice would otherwise share a key.
        id: track.mbid || track.url,
        title: track.name,
        artist: track.artist["#text"],
        image:
          track.image.find((image) => image.size === "large")?.["#text"] ?? "",
      }))
      .filter((track) => track.title && track.artist);

    return Response.json({ tracks });
  } catch {
    return Response.json({ tracks: [] });
  }
}
