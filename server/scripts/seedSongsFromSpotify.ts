import fs from "fs";
import path from "path";
import SpotifyWebApi from "spotify-web-api-node";

type SeedTheme =
  | "rock"
  | "pop"
  | "hiphop"
  | "electronic"
  | "swedish"
  | "rnb"
  | "country"
  | "latin"
  | "metal"
  | "indie"
  | "disco";
type SeedLanguage = "en" | "sv";
type SeedEnergy = "upbeat" | "chill";

interface SeedQuery {
  query: string;
  themes: SeedTheme[];
  language: SeedLanguage;
  energy: SeedEnergy;
}

const KNOWN_HIT_POPULARITY_THRESHOLD = Number.parseInt(process.env.KNOWN_HIT_POPULARITY || "70", 10);
const MIN_SEED_POPULARITY = Number.parseInt(process.env.MIN_SEED_POPULARITY || "0", 10);

function isBlockedTrackOrArtist(trackName: string, artistNames: string): boolean {
  const value = `${trackName} ${artistNames}`.toLowerCase();
  const blockedPatterns = [
    /\bkaraoke\b/,
    /\bremaster(ed)?\b/,
    /\bradio edit\b/,
    /\bedit\b/,
    /\bremix\b/,
    /\bmix\b/,
    /\blive\b/,
    /\binstrumental\b/,
    /\btribute\b/,
    /\bacoustic version\b/,
    /\bsped up\b/,
    /\bslowed\b/,
    /\bnightcore\b/,
    /\b8d\b/,
    /\blofi\b/,
    /\bgodnatt(saga|sagor)?\b/,
    /\bbedtime stories?\b/,
    /\bmeditation\b/,
    /\bmindfulness\b/,
    /\bsleep\b/,
    /\bdeep sleep\b/,
    /\bwhite noise\b/,
    /\bnature sounds?\b/,
    /\brain sounds?\b/,
    /\bambient\b/,
    /\belevator music\b/,
    /\blounge music\b/,
    /\bfocus music\b/,
    /\bstudy music\b/,
  ];
  return blockedPatterns.some((pattern) => pattern.test(value));
}

function isCompilationAlbum(track: any): boolean {
  const albumType = (track.album?.album_type || "").toLowerCase();
  const albumName = (track.album?.name || "").toLowerCase();

  if (!["album", "single"].includes(albumType)) return true;

  const blockedAlbumPatterns = [
    /\bbest of\b/,
    /\bgreatest hits\b/,
    /\bhits\b/,
    /\bhitlist\b/,
    /\btop hits\b/,
    /\bessentials\b/,
    /\bthe collection\b/,
    /\banthology\b/,
    /\bkaraoke\b/,
    /\btribute\b/,
    /\bnow that'?s what i call\b/,
    /\bultimate hits\b/,
    /\ball out\b/,
    /\bmega hits\b/,
    /\bdancefloor\b/,
    /\bparty\b/,
    /\bvolume\b/,
    /\bvol(\.|ume)?\b/,
    /\bsampler\b/,
    /\bministry of sound\b/,
    /\bremix\b/,
    /\bremastered\b/,
    /\bdeluxe\b/,
    /\banniversary\b/,
    /\bsoundtrack\b/,
    /\boriginal motion picture\b/,
    /\bmotion picture\b/,
    /\boriginal score\b/,
    /\bfilm score\b/,
    /\bost\b/,
    /\bsound effects?\b/,
    /\bsleep\b/,
    /\bmeditation\b/,
    /\bambient\b/,
    /\belevator\b/,
    /\blullaby\b/,
  ];

  return blockedAlbumPatterns.some((pattern) => pattern.test(albumName));
}

const TARGET_TOTAL = Number.parseInt(
  process.argv.find((arg) => arg.startsWith("--target="))?.split("=")[1] || "10000",
  10
);
const TARGET_CATALOG =
  process.env.SEED_CATALOG ||
  "main_catalog";

function loadEnvFile() {
  const envPath = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;
  const file = fs.readFileSync(envPath, "utf-8");
  for (const rawLine of file.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    if (!key || process.env[key] !== undefined) continue;
    let value = line.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadEnvFile();

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || "";
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || "";

if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
  throw new Error("Missing SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET in .env");
}

const spotifyApi = new SpotifyWebApi({
  clientId: SPOTIFY_CLIENT_ID,
  clientSecret: SPOTIFY_CLIENT_SECRET,
});

const QUERIES: SeedQuery[] = [
  { query: "70s rock hits", themes: ["rock"], language: "en", energy: "upbeat" },
  { query: "80s rock classics", themes: ["rock"], language: "en", energy: "upbeat" },
  { query: "90s alt rock", themes: ["rock"], language: "en", energy: "upbeat" },
  { query: "2000s rock anthems", themes: ["rock"], language: "en", energy: "upbeat" },
  { query: "2010s indie rock", themes: ["rock"], language: "en", energy: "chill" },
  { query: "classic rock ballads", themes: ["rock"], language: "en", energy: "chill" },
  { query: "70s pop hits", themes: ["pop"], language: "en", energy: "upbeat" },
  { query: "80s pop dance", themes: ["pop"], language: "en", energy: "upbeat" },
  { query: "90s pop hits", themes: ["pop"], language: "en", energy: "upbeat" },
  { query: "2000s pop hits", themes: ["pop"], language: "en", energy: "upbeat" },
  { query: "2010s pop hits", themes: ["pop"], language: "en", energy: "upbeat" },
  { query: "2020s pop hits", themes: ["pop"], language: "en", energy: "upbeat" },
  { query: "pop chill", themes: ["pop"], language: "en", energy: "chill" },
  { query: "hip hop classics 90s", themes: ["hiphop"], language: "en", energy: "upbeat" },
  { query: "2000s hip hop", themes: ["hiphop"], language: "en", energy: "upbeat" },
  { query: "2010s hip hop", themes: ["hiphop"], language: "en", energy: "upbeat" },
  { query: "hip hop chill", themes: ["hiphop"], language: "en", energy: "chill" },
  { query: "electronic dance classics", themes: ["electronic"], language: "en", energy: "upbeat" },
  { query: "edm 2010s hits", themes: ["electronic"], language: "en", energy: "upbeat" },
  { query: "electronic chill", themes: ["electronic"], language: "en", energy: "chill" },
  { query: "svensk pop hits", themes: ["swedish", "pop"], language: "sv", energy: "upbeat" },
  { query: "svensk rock klassiker", themes: ["swedish", "rock"], language: "sv", energy: "upbeat" },
  { query: "svensk musik 90-tal", themes: ["swedish"], language: "sv", energy: "upbeat" },
  { query: "svensk musik 2000-tal", themes: ["swedish"], language: "sv", energy: "upbeat" },
  { query: "svenska lugna låtar", themes: ["swedish"], language: "sv", energy: "chill" },
  { query: "best rnb hits", themes: ["rnb", "pop"], language: "en", energy: "chill" },
  { query: "90s rnb classics", themes: ["rnb"], language: "en", energy: "chill" },
  { query: "country hits", themes: ["country"], language: "en", energy: "upbeat" },
  { query: "classic country songs", themes: ["country"], language: "en", energy: "chill" },
  { query: "latin pop hits", themes: ["latin", "pop"], language: "en", energy: "upbeat" },
  { query: "reggaeton hits", themes: ["latin"], language: "en", energy: "upbeat" },
  { query: "metal classics", themes: ["metal", "rock"], language: "en", energy: "upbeat" },
  { query: "heavy metal hits", themes: ["metal", "rock"], language: "en", energy: "upbeat" },
  { query: "indie hits", themes: ["indie", "rock"], language: "en", energy: "chill" },
  { query: "indie pop 2010s", themes: ["indie", "pop"], language: "en", energy: "chill" },
  { query: "disco classics", themes: ["disco", "pop"], language: "en", energy: "upbeat" },
  { query: "70s disco hits", themes: ["disco", "pop"], language: "en", energy: "upbeat" },
];

function keyFor(title: string, artist: string, year: number) {
  return `${title.toLowerCase().trim()}|${artist.toLowerCase().trim()}|${year}`;
}

async function ensureThemes() {
  const { db } = await import("../db");
  const { themes } = await import("@shared/schema");
  const names: SeedTheme[] = ["rock", "pop", "hiphop", "electronic", "swedish", "rnb", "country", "latin", "metal", "indie", "disco"];
  for (const name of names) {
    await db.insert(themes).values({ name, description: `${name} seeded theme` }).onConflictDoNothing();
  }
  const rows = await db.select().from(themes);
  return new Map(rows.map((t) => [t.name, t.id]));
}

async function seed() {
  const { db } = await import("../db");
  const { songs, songThemes } = await import("@shared/schema");

  const token = await spotifyApi.clientCredentialsGrant();
  spotifyApi.setAccessToken(token.body.access_token);

  const themeMap = await ensureThemes();

  const existing = await db.select({
    id: songs.id,
    catalog: songs.catalog,
    title: songs.title,
    artist: songs.artist,
    year: songs.year,
  }).from(songs);
  const existingKeys = new Set(
    existing
      .filter((r) => r.catalog === TARGET_CATALOG)
      .map((r) => keyFor(r.title, r.artist, r.year))
  );

  let insertedSongs = 0;
  let linkedThemes = 0;

  const getCurrentTotal = async () => {
    const rows = await db.select({
      id: songs.id,
      title: songs.title,
      artist: songs.artist,
      year: songs.year,
    }).from(songs);
    return rows.length;
  };

  let currentTotal = await getCurrentTotal();
  console.log(`Current songs in DB before seed: ${currentTotal}`);
  console.log(`Target songs in DB: ${TARGET_TOTAL}`);

  const ingestQuery = async (q: SeedQuery, offsets: number[], markets: string[]) => {
    console.log(`Seeding query: ${q.query}`);
    for (const market of markets) {
      if (currentTotal >= TARGET_TOTAL) break;
      for (const offset of offsets) {
        if (currentTotal >= TARGET_TOTAL) break;

        const result = await spotifyApi.searchTracks(q.query, {
          limit: 50,
          offset,
          market,
        });

        const tracks = result.body.tracks?.items || [];
        if (tracks.length === 0) break;

        for (const track of tracks) {
          if (currentTotal >= TARGET_TOTAL) break;
          if (isCompilationAlbum(track)) continue;

          const releaseDate = track.album.release_date;
          const year = releaseDate ? parseInt(releaseDate.split("-")[0], 10) : NaN;
          if (!Number.isFinite(year) || year < 1950 || year > 2024) continue;

          const artist = track.artists.map((a) => a.name).join(", ");
          const popularity = Number.isFinite(track.popularity) ? track.popularity : 0;
          if (popularity < MIN_SEED_POPULARITY) continue;
          if (isBlockedTrackOrArtist(track.name, artist)) continue;
          const key = keyFor(track.name, artist, year);
          if (existingKeys.has(key)) continue;

          const inserted = await db.insert(songs).values({
            catalog: TARGET_CATALOG,
            externalId: track.id,
            title: track.name,
            artist,
            year,
            albumName: track.album?.name || null,
            albumType: track.album?.album_type || null,
            albumCover: track.album.images?.[0]?.url || null,
            previewUrl: track.preview_url || null,
            popularity,
            isKnownHit: popularity >= KNOWN_HIT_POPULARITY_THRESHOLD,
            language: q.language,
            energy: q.energy,
            isPlayable: true,
          }).returning({ id: songs.id });

          const songId = inserted[0]?.id;
          if (!songId) continue;

          insertedSongs++;
          currentTotal++;
          existingKeys.add(key);

          for (const themeName of q.themes) {
            const themeId = themeMap.get(themeName);
            if (!themeId) continue;
            await db.insert(songThemes).values({ songId, themeId }).onConflictDoNothing();
            linkedThemes++;
          }
        }
      }
    }
  };

  for (const q of QUERIES) {
    if (currentTotal >= TARGET_TOTAL) break;
    await ingestQuery(q, [0, 50, 100, 150, 200, 250, 300, 350], ["SE"]);
  }

  if (currentTotal < TARGET_TOTAL) {
    const fillerTerms = [
      "1970 rock originals", "1980 pop originals", "1990 hip hop originals", "2000 indie originals",
      "2010 electronic originals", "2020 pop originals", "summer pop songs", "party dance songs",
      "female vocal pop songs", "male vocal pop songs", "soft rock songs", "classic soul songs",
      "funk songs", "alt pop songs", "indie songs", "dance pop songs",
      "electro pop songs", "swedish pop songs", "eurodance songs", "latin dance songs"
    ];
    for (const term of fillerTerms) {
      if (currentTotal >= TARGET_TOTAL) break;
      await ingestQuery(
        { query: term, themes: ["pop"], language: "en", energy: "upbeat" },
        [0, 50, 100, 150],
        ["SE", "US", "GB"]
      );
    }
  }

  const total = await db.select().from(songs);
  console.log(`Inserted songs: ${insertedSongs}`);
  console.log(`Theme links added: ${linkedThemes}`);
  console.log(`Catalog: ${TARGET_CATALOG}`);
  console.log(`Total songs in DB: ${total.length}`);
  if (total.length < TARGET_TOTAL) {
    console.log(`Did not reach target ${TARGET_TOTAL}. Consider adding more queries or rerunning seed.`);
  }
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
