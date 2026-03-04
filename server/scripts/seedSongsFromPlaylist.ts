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
type YearConfidence = "high" | "medium" | "low";

const DEFAULT_PLAYLIST_URL = "https://open.spotify.com/playlist/1G8IpkZKobrIlXcVPoSIuf";
const KNOWN_HIT_POPULARITY_THRESHOLD = Number.parseInt(process.env.KNOWN_HIT_POPULARITY || "70", 10);
const MIN_SEED_POPULARITY = Number.parseInt(process.env.MIN_SEED_POPULARITY || "35", 10);
const TARGET_CATALOG =
  process.argv.find((arg) => arg.startsWith("--catalog="))?.split("=")[1] ||
  process.env.SEED_CATALOG ||
  "playlist_main";

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

function parsePlaylistId(input: string): string {
  if (!input) return "";
  if (/^[A-Za-z0-9]{22}$/.test(input)) return input;
  const m = input.match(/playlist\/([A-Za-z0-9]{22})/);
  if (m?.[1]) return m[1];
  return "";
}

function normalizeTitle(value: string): string {
  return value
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/\[[^\]]*\]/g, "")
    .replace(/[-–—]\s*(remaster|remix|radio edit|edit|live|version).*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizedArtistKey(value: string): string {
  return value
    .toLowerCase()
    .split(",")[0]
    .split(/ feat\.?| ft\.?| featuring | & | and /i)[0]
    .trim();
}

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

function isCompilationLikeAlbum(albumType: string, albumName: string): boolean {
  const type = (albumType || "").toLowerCase();
  const name = (albumName || "").toLowerCase();
  if (!["album", "single"].includes(type)) return true;

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
    /\bsound effects?\b/,
    /\bsleep\b/,
    /\bmeditation\b/,
    /\bambient\b/,
    /\belevator\b/,
    /\blullaby\b/,
  ];
  return blockedAlbumPatterns.some((pattern) => pattern.test(name));
}

function yearFromReleaseDate(releaseDate?: string): number | null {
  if (!releaseDate) return null;
  const year = Number.parseInt(releaseDate.split("-")[0], 10);
  if (!Number.isFinite(year) || year < 1950 || year > 2024) return null;
  return year;
}

function keyFor(title: string, artist: string, year: number): string {
  return `${title.toLowerCase().trim()}|${artist.toLowerCase().trim()}|${year}`;
}

function inferThemesFromGenres(genres: string[]): SeedTheme[] {
  const g = genres.join(" ").toLowerCase();
  const result = new Set<SeedTheme>();
  if (/\brock|grunge|punk|alt\b/.test(g)) result.add("rock");
  if (/\bpop|dance pop|synthpop\b/.test(g)) result.add("pop");
  if (/\bhip hop|rap|trap\b/.test(g)) result.add("hiphop");
  if (/\bedm|electro|house|techno|trance\b/.test(g)) result.add("electronic");
  if (/\bsweden|swedish|svensk\b/.test(g)) result.add("swedish");
  if (/\br&b|soul\b/.test(g)) result.add("rnb");
  if (/\bcountry\b/.test(g)) result.add("country");
  if (/\blatin|reggaeton\b/.test(g)) result.add("latin");
  if (/\bmetal\b/.test(g)) result.add("metal");
  if (/\bindie\b/.test(g)) result.add("indie");
  if (/\bdisco\b/.test(g)) result.add("disco");
  if (result.size === 0) result.add("pop");
  return Array.from(result);
}

loadEnvFile();

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || "";
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || "";

if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
  throw new Error("Missing SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET in .env");
}

const playlistArg =
  process.argv.find((arg) => arg.startsWith("--playlist="))?.split("=")[1] ||
  process.env.SEED_PLAYLIST_URL ||
  DEFAULT_PLAYLIST_URL;

const playlistId = parsePlaylistId(playlistArg);
if (!playlistId) {
  throw new Error(`Could not parse playlist id from: ${playlistArg}`);
}

const spotifyApi = new SpotifyWebApi({
  clientId: SPOTIFY_CLIENT_ID,
  clientSecret: SPOTIFY_CLIENT_SECRET,
});

type SpotifyTrack = {
  id: string;
  name: string;
  popularity: number;
  preview_url: string | null;
  external_ids?: { isrc?: string };
  artists: Array<{ id: string | null; name: string }>;
  album: {
    name: string;
    album_type: string;
    release_date: string;
    images?: Array<{ url: string }>;
  };
};

interface ResolvedTrackInfo {
  track: SpotifyTrack;
  year: number;
  yearConfidence: YearConfidence;
  yearSource: string;
  isrc: string | null;
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

async function resolveOriginalTrackYear(track: SpotifyTrack): Promise<ResolvedTrackInfo | null> {
  const baseYear = yearFromReleaseDate(track.album?.release_date || "");
  const primaryArtist = track.artists?.[0]?.name || "";
  const artistNames = track.artists.map((a) => a.name).join(", ");
  const rawIsrc = track.external_ids?.isrc?.trim() || null;

  if (
    baseYear &&
    !isCompilationLikeAlbum(track.album?.album_type || "", track.album?.name || "") &&
    !isBlockedTrackOrArtist(track.name, artistNames)
  ) {
    return {
      track,
      year: baseYear,
      yearConfidence: "high",
      yearSource: "album_release_date",
      isrc: rawIsrc
    };
  }

  if (rawIsrc) {
    try {
      const isrcRes = await spotifyApi.searchTracks(`isrc:${rawIsrc}`, { limit: 50, market: "US" });
      const isrcCandidates = (isrcRes.body.tracks?.items || []) as SpotifyTrack[];
      const clean = isrcCandidates
        .map((candidate) => {
          const cArtists = candidate.artists.map((a) => a.name).join(", ");
          const cYear = yearFromReleaseDate(candidate.album?.release_date || "");
          if (!cYear) return null;
          if (isCompilationLikeAlbum(candidate.album?.album_type || "", candidate.album?.name || "")) return null;
          if (isBlockedTrackOrArtist(candidate.name, cArtists)) return null;
          return { candidate, cYear };
        })
        .filter((v): v is { candidate: SpotifyTrack; cYear: number } => !!v)
        .sort((a, b) => {
          if (a.cYear !== b.cYear) return a.cYear - b.cYear;
          return (b.candidate.popularity || 0) - (a.candidate.popularity || 0);
        });

      if (clean.length > 0) {
        return {
          track: clean[0].candidate,
          year: clean[0].cYear,
          yearConfidence: "high",
          yearSource: "isrc_earliest_clean",
          isrc: rawIsrc
        };
      }
    } catch {
      // Continue with fallback below.
    }
  }

  if (!primaryArtist) return null;

  try {
    const searchQuery = `track:${track.name} artist:${primaryArtist}`;
    const res = await spotifyApi.searchTracks(searchQuery, { limit: 50, market: "US" });
    const candidates = (res.body.tracks?.items || []) as SpotifyTrack[];
    const targetTitle = normalizeTitle(track.name);

    const good = candidates
      .map((candidate) => {
        const cArtists = candidate.artists.map((a) => a.name).join(", ");
        const cYear = yearFromReleaseDate(candidate.album?.release_date || "");
        if (!cYear) return null;
        if (isCompilationLikeAlbum(candidate.album?.album_type || "", candidate.album?.name || "")) return null;
        if (isBlockedTrackOrArtist(candidate.name, cArtists)) return null;
        const normalizedTitle = normalizeTitle(candidate.name);
        const primaryArtistMatch = candidate.artists.some((a) => a.name.toLowerCase() === primaryArtist.toLowerCase());
        return { candidate, cYear, normalizedTitle, primaryArtistMatch };
      })
      .filter((v): v is { candidate: SpotifyTrack; cYear: number; normalizedTitle: string; primaryArtistMatch: boolean } => !!v)
      .sort((a, b) => {
        const aExact = a.normalizedTitle === targetTitle ? 1 : 0;
        const bExact = b.normalizedTitle === targetTitle ? 1 : 0;
        if (aExact !== bExact) return bExact - aExact;
        if (a.primaryArtistMatch !== b.primaryArtistMatch) return a.primaryArtistMatch ? -1 : 1;
        if (a.cYear !== b.cYear) return a.cYear - b.cYear;
        return (b.candidate.popularity || 0) - (a.candidate.popularity || 0);
      });

    if (good.length === 0) return null;
    const best = good[0];
    const confidence: YearConfidence =
      best.normalizedTitle === targetTitle && best.primaryArtistMatch ? "medium" : "low";
    return {
      track: best.candidate,
      year: best.cYear,
      yearConfidence: confidence,
      yearSource: "title_artist_search",
      isrc: rawIsrc || best.candidate.external_ids?.isrc?.trim() || null
    };
  } catch {
    return null;
  }
}

async function seedFromPlaylist() {
  const { db } = await import("../db");
  const { songs, songThemes } = await import("@shared/schema");

  const token = await spotifyApi.clientCredentialsGrant();
  spotifyApi.setAccessToken(token.body.access_token);

  const themeMap = await ensureThemes();

  const existing = await db.select({
    catalog: songs.catalog,
    isrc: songs.isrc,
    title: songs.title,
    artist: songs.artist,
    year: songs.year,
  }).from(songs);
  const existingIsrc = new Set(
    existing
      .filter((r) => r.catalog === TARGET_CATALOG && !!r.isrc)
      .map((r) => String(r.isrc).toUpperCase())
  );
  const existingKeys = new Set(
    existing
      .filter((r) => r.catalog === TARGET_CATALOG)
      .map((r) => keyFor(r.title, r.artist, r.year))
  );
  const existingTitleArtist = new Set(
    existing
      .filter((r) => r.catalog === TARGET_CATALOG)
      .map((r) => `${normalizeTitle(r.title)}|${normalizedArtistKey(r.artist)}`)
  );

  const playlistTracks: SpotifyTrack[] = [];
  let offset = 0;

  while (true) {
    const page = await spotifyApi.getPlaylistTracks(playlistId, {
      offset,
      limit: 100,
      market: "US",
      fields: "items(track(id,name,popularity,preview_url,external_ids(isrc),artists(id,name),album(name,album_type,release_date,images))),next,total"
    });
    const items = page.body.items || [];
    for (const item of items) {
      const t = item.track as SpotifyTrack | null;
      if (!t?.id) continue;
      playlistTracks.push(t);
    }
    if (!page.body.next) break;
    offset += items.length;
  }

  console.log(`Playlist tracks fetched: ${playlistTracks.length}`);

  const uniqueArtistIds = Array.from(
    new Set(
      playlistTracks
        .map((t) => t.artists?.[0]?.id)
        .filter((id): id is string => !!id)
    )
  );

  const artistThemeMap = new Map<string, SeedTheme[]>();
  for (let i = 0; i < uniqueArtistIds.length; i += 50) {
    const batch = uniqueArtistIds.slice(i, i + 50);
    const res = await spotifyApi.getArtists(batch);
    for (const artist of res.body.artists) {
      artistThemeMap.set(artist.id, inferThemesFromGenres(artist.genres || []));
    }
  }

  let insertedSongs = 0;
  let linkedThemes = 0;
  let skipped = 0;

  for (const rawTrack of playlistTracks) {
    const resolved = await resolveOriginalTrackYear(rawTrack);
    if (!resolved) {
      skipped++;
      continue;
    }
    const { track, year, yearConfidence, yearSource, isrc } = resolved;
    const artist = track.artists.map((a) => a.name).join(", ");
    const popularity = Number.isFinite(track.popularity) ? track.popularity : 0;

    if (popularity < MIN_SEED_POPULARITY) {
      skipped++;
      continue;
    }
    if (isBlockedTrackOrArtist(track.name, artist)) {
      skipped++;
      continue;
    }
    if (isCompilationLikeAlbum(track.album?.album_type || "", track.album?.name || "")) {
      skipped++;
      continue;
    }
    if (isrc && existingIsrc.has(isrc.toUpperCase())) continue;

    const songKey = keyFor(track.name, artist, year);
    if (existingKeys.has(songKey)) continue;
    const titleArtistKey = `${normalizeTitle(track.name)}|${normalizedArtistKey(artist)}`;
    if (existingTitleArtist.has(titleArtistKey)) continue;

    const inserted = await db.insert(songs).values({
      catalog: TARGET_CATALOG,
      externalId: track.id,
      isrc,
      title: track.name,
      artist,
      year,
      yearConfidence,
      yearSource,
      albumName: track.album?.name || null,
      albumType: track.album?.album_type || null,
      albumCover: track.album?.images?.[0]?.url || null,
      previewUrl: track.preview_url || null,
      popularity,
      isKnownHit: popularity >= KNOWN_HIT_POPULARITY_THRESHOLD,
      language: "en",
      energy: "upbeat",
      isPlayable: true,
    }).returning({ id: songs.id });

    const songId = inserted[0]?.id;
    if (!songId) continue;

    insertedSongs++;
    if (isrc) existingIsrc.add(isrc.toUpperCase());
    existingKeys.add(songKey);
    existingTitleArtist.add(titleArtistKey);

    const firstArtistId = track.artists?.[0]?.id || "";
    const themes = artistThemeMap.get(firstArtistId) || ["pop"];
    for (const themeName of themes) {
      const themeId = themeMap.get(themeName);
      if (!themeId) continue;
      await db.insert(songThemes).values({ songId, themeId }).onConflictDoNothing();
      linkedThemes++;
    }
  }

  const total = await db.select({ id: songs.id }).from(songs);
  console.log(`Inserted from playlist: ${insertedSongs}`);
  console.log(`Theme links added: ${linkedThemes}`);
  console.log(`Skipped tracks (filtered/invalid): ${skipped}`);
  console.log(`Catalog: ${TARGET_CATALOG}`);
  console.log(`Total songs in DB: ${total.length}`);
}

seedFromPlaylist()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Playlist seed failed:", err);
    process.exit(1);
  });
