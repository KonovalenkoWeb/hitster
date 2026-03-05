import type { Song } from "../shared/types";
import { db } from "./db";
import { songs as songsTable, themes as themesTable, songThemes as songThemesTable } from "@shared/schema";

export interface MusicFilters {
  mode: "filters";
  catalog?: string;
  genre: "mixed" | "rock" | "pop" | "hiphop" | "electronic" | "swedish" | "rnb" | "country" | "latin" | "metal" | "indie" | "disco";
  era: "all" | "70s" | "80s" | "90s" | "2000s" | "2010s" | "2020s" | "custom";
  knownHitsOnly: boolean;
  yearFrom?: number;
  yearTo?: number;
}

interface CatalogEntry extends Song {
  catalog?: string;
  tags: string[];
  language: "en" | "sv";
  energy: "chill" | "upbeat";
  popularity?: number;
  isKnownHit?: boolean;
}

const MIN_DEFAULT_POPULARITY = 0;
const SONG_COOLDOWN_ROUNDS = Number.parseInt(process.env.SONG_COOLDOWN_ROUNDS || "4", 10);

const CATALOG: CatalogEntry[] = [
  { id: "stub-001", title: "Bohemian Rhapsody", artist: "Queen", year: 1975, tags: ["rock"], language: "en", energy: "upbeat" },
  { id: "stub-002", title: "Dancing Queen", artist: "ABBA", year: 1976, tags: ["pop", "swedish"], language: "en", energy: "upbeat" },
  { id: "stub-003", title: "Hotel California", artist: "Eagles", year: 1976, tags: ["rock"], language: "en", energy: "chill" },
  { id: "stub-004", title: "Take on Me", artist: "a-ha", year: 1985, tags: ["pop"], language: "en", energy: "upbeat" },
  { id: "stub-005", title: "Billie Jean", artist: "Michael Jackson", year: 1982, tags: ["pop"], language: "en", energy: "upbeat" },
  { id: "stub-006", title: "Sweet Child O' Mine", artist: "Guns N' Roses", year: 1987, tags: ["rock"], language: "en", energy: "upbeat" },
  { id: "stub-007", title: "Africa", artist: "Toto", year: 1982, tags: ["pop", "rock"], language: "en", energy: "chill" },
  { id: "stub-008", title: "Like a Prayer", artist: "Madonna", year: 1989, tags: ["pop"], language: "en", energy: "upbeat" },
  { id: "stub-009", title: "Smells Like Teen Spirit", artist: "Nirvana", year: 1991, tags: ["rock"], language: "en", energy: "upbeat" },
  { id: "stub-010", title: "Wonderwall", artist: "Oasis", year: 1995, tags: ["rock"], language: "en", energy: "chill" },
  { id: "stub-011", title: "No Diggity", artist: "Blackstreet", year: 1996, tags: ["hiphop"], language: "en", energy: "chill" },
  { id: "stub-012", title: "Baby One More Time", artist: "Britney Spears", year: 1998, tags: ["pop"], language: "en", energy: "upbeat" },
  { id: "stub-013", title: "Oops!... I Did It Again", artist: "Britney Spears", year: 2000, tags: ["pop"], language: "en", energy: "upbeat" },
  { id: "stub-014", title: "In the End", artist: "Linkin Park", year: 2000, tags: ["rock"], language: "en", energy: "upbeat" },
  { id: "stub-015", title: "Hey Ya!", artist: "Outkast", year: 2003, tags: ["hiphop", "pop"], language: "en", energy: "upbeat" },
  { id: "stub-016", title: "Seven Nation Army", artist: "The White Stripes", year: 2003, tags: ["rock"], language: "en", energy: "upbeat" },
  { id: "stub-017", title: "Poker Face", artist: "Lady Gaga", year: 2008, tags: ["pop", "electronic"], language: "en", energy: "upbeat" },
  { id: "stub-018", title: "Viva la Vida", artist: "Coldplay", year: 2008, tags: ["rock", "pop"], language: "en", energy: "chill" },
  { id: "stub-019", title: "Levels", artist: "Avicii", year: 2011, tags: ["electronic", "swedish"], language: "en", energy: "upbeat" },
  { id: "stub-020", title: "Rolling in the Deep", artist: "Adele", year: 2010, tags: ["pop"], language: "en", energy: "chill" },
  { id: "stub-021", title: "Wake Me Up", artist: "Avicii", year: 2013, tags: ["electronic", "pop", "swedish"], language: "en", energy: "upbeat" },
  { id: "stub-022", title: "Blinding Lights", artist: "The Weeknd", year: 2019, tags: ["pop", "electronic"], language: "en", energy: "upbeat" },
  { id: "stub-023", title: "bad guy", artist: "Billie Eilish", year: 2019, tags: ["pop"], language: "en", energy: "chill" },
  { id: "stub-024", title: "Levitating", artist: "Dua Lipa", year: 2020, tags: ["pop", "electronic"], language: "en", energy: "upbeat" },
  { id: "stub-025", title: "As It Was", artist: "Harry Styles", year: 2022, tags: ["pop"], language: "en", energy: "chill" },
  { id: "stub-026", title: "Flowers", artist: "Miley Cyrus", year: 2023, tags: ["pop"], language: "en", energy: "chill" },
  { id: "stub-027", title: "Dynamite", artist: "BTS", year: 2020, tags: ["pop"], language: "en", energy: "upbeat" },
  { id: "stub-028", title: "HUMBLE.", artist: "Kendrick Lamar", year: 2017, tags: ["hiphop"], language: "en", energy: "upbeat" },
  { id: "stub-029", title: "Lose Yourself", artist: "Eminem", year: 2002, tags: ["hiphop"], language: "en", energy: "upbeat" },
  { id: "stub-030", title: "The Real Slim Shady", artist: "Eminem", year: 2000, tags: ["hiphop"], language: "en", energy: "upbeat" },
  { id: "stub-031", title: "Dansa Pausa", artist: "Panetoz", year: 2012, tags: ["pop", "swedish"], language: "sv", energy: "upbeat" },
  { id: "stub-032", title: "Guld och gröna skogar", artist: "Hasse Andersson", year: 2015, tags: ["swedish"], language: "sv", energy: "upbeat" },
  { id: "stub-033", title: "Jag kommer", artist: "Veronica Maggio", year: 2011, tags: ["pop", "swedish"], language: "sv", energy: "upbeat" },
  { id: "stub-034", title: "Din tid kommer", artist: "Håkan Hellström", year: 2016, tags: ["swedish", "rock"], language: "sv", energy: "chill" },
  { id: "stub-035", title: "Sommartider", artist: "Gyllene Tider", year: 1982, tags: ["pop", "swedish"], language: "sv", energy: "upbeat" },
  { id: "stub-036", title: "Främling", artist: "Carola", year: 1983, tags: ["pop", "swedish"], language: "sv", energy: "upbeat" },
  { id: "stub-037", title: "Mikrofonkåt", artist: "September", year: 2010, tags: ["electronic", "swedish"], language: "sv", energy: "upbeat" },
  { id: "stub-038", title: "Stad i ljus", artist: "Tommy Körberg", year: 1988, tags: ["swedish"], language: "sv", energy: "chill" },
  { id: "stub-039", title: "Take Me Out", artist: "Franz Ferdinand", year: 2004, tags: ["rock"], language: "en", energy: "upbeat" },
  { id: "stub-040", title: "Mr. Brightside", artist: "The Killers", year: 2003, tags: ["rock"], language: "en", energy: "upbeat" },
  { id: "stub-041", title: "Titanium", artist: "David Guetta ft. Sia", year: 2011, tags: ["electronic", "pop"], language: "en", energy: "upbeat" },
  { id: "stub-042", title: "One More Time", artist: "Daft Punk", year: 2000, tags: ["electronic"], language: "en", energy: "upbeat" },
  { id: "stub-043", title: "Sandstorm", artist: "Darude", year: 1999, tags: ["electronic"], language: "en", energy: "upbeat" },
  { id: "stub-044", title: "Somebody That I Used to Know", artist: "Gotye", year: 2011, tags: ["pop"], language: "en", energy: "chill" },
  { id: "stub-045", title: "Can’t Hold Us", artist: "Macklemore & Ryan Lewis", year: 2011, tags: ["hiphop", "pop"], language: "en", energy: "upbeat" },
  { id: "stub-046", title: "Stan", artist: "Eminem", year: 2000, tags: ["hiphop"], language: "en", energy: "chill" },
  { id: "stub-047", title: "Numb", artist: "Linkin Park", year: 2003, tags: ["rock"], language: "en", energy: "chill" },
  { id: "stub-048", title: "Shut Up and Dance", artist: "WALK THE MOON", year: 2014, tags: ["pop", "rock"], language: "en", energy: "upbeat" }
];

const ERA_RANGE: Record<MusicFilters["era"], { min: number; max: number }> = {
  all: { min: 1950, max: 2024 },
  "70s": { min: 1970, max: 1979 },
  "80s": { min: 1980, max: 1989 },
  "90s": { min: 1990, max: 1999 },
  "2000s": { min: 2000, max: 2009 },
  "2010s": { min: 2010, max: 2019 },
  "2020s": { min: 2020, max: 2024 },
  custom: { min: 1950, max: 2024 }
};

function shuffle<T>(input: T[]): T[] {
  return [...input].sort(() => Math.random() - 0.5);
}

function interleaveByDecade(input: CatalogEntry[], targetCount: number): CatalogEntry[] {
  if (input.length <= 1) return input;

  const buckets = new Map<number, CatalogEntry[]>();
  for (const song of input) {
    const decade = Math.floor(song.year / 10) * 10;
    const list = buckets.get(decade) || [];
    list.push(song);
    buckets.set(decade, list);
  }

  const decades = Array.from(buckets.keys()).sort((a, b) => a - b);
  for (const decade of decades) {
    buckets.set(decade, shuffle(buckets.get(decade) || []));
  }

  const result: CatalogEntry[] = [];
  while (result.length < targetCount) {
    let pickedAny = false;
    for (const decade of decades) {
      const list = buckets.get(decade) || [];
      if (list.length === 0) continue;
      result.push(list.shift()!);
      pickedAny = true;
      if (result.length >= targetCount) break;
    }
    if (!pickedAny) break;
  }

  return result;
}

function normalizedArtistKey(artist: string): string {
  return artist
    .toLowerCase()
    .split(",")[0]
    .split(/ feat\.?| ft\.?| featuring | & | and /i)[0]
    .trim();
}

export class MusicCatalogStubService {
  private recentSongKeys: string[] = [];

  private songKey(song: Pick<Song, "title" | "artist" | "year">): string {
    return `${song.title.toLowerCase().trim()}|${song.artist.toLowerCase().trim()}|${song.year}`;
  }

  private withCooldownPreference(candidates: Song[], targetCount: number): Song[] {
    if (candidates.length === 0) return [];
    const recent = new Set(this.recentSongKeys);
    const preferred = candidates.filter((song) => !recent.has(this.songKey(song)));
    const fallback = candidates.filter((song) => recent.has(this.songKey(song)));
    return [...preferred, ...fallback].slice(0, targetCount);
  }

  private rememberPlayedSongs(songs: Song[]) {
    if (SONG_COOLDOWN_ROUNDS <= 0) return;
    for (const song of songs) {
      this.recentSongKeys.push(this.songKey(song));
    }
    if (this.recentSongKeys.length > SONG_COOLDOWN_ROUNDS) {
      this.recentSongKeys = this.recentSongKeys.slice(this.recentSongKeys.length - SONG_COOLDOWN_ROUNDS);
    }
  }

  private shouldUseStubFallback(): boolean {
    return process.env.NODE_ENV !== "production";
  }

  private resolveCatalogOrFallback(dbCatalog: CatalogEntry[] | null): CatalogEntry[] {
    if (dbCatalog && dbCatalog.length > 0) return dbCatalog;
    if (this.shouldUseStubFallback()) return CATALOG;
    return [];
  }

  private resolveCatalogOrFallbackWithDefault(dbCatalog: CatalogEntry[] | null): CatalogEntry[] {
    if (dbCatalog && dbCatalog.length > 0) return dbCatalog;
    if (this.shouldUseStubFallback()) return CATALOG.map((song) => ({ ...song, catalog: "default" }));
    return [];
  }

  private isBlockedAlbumMeta(albumName: string | null | undefined, albumType: string | null | undefined): boolean {
    const albumTypeValue = (albumType || "").toLowerCase();
    const albumNameValue = (albumName || "").toLowerCase();
    if (albumTypeValue && !["album", "single"].includes(albumTypeValue)) return true;

    const blockedAlbumPatterns = [
      /\bbest of\b/,
      /\bgreatest hits\b/,
      /\bhits\b/,
      /\btop hits\b/,
      /\bessentials\b/,
      /\bthe collection\b/,
      /\banthology\b/,
      /\bkaraoke\b/,
      /\btribute\b/,
      /\bnow that'?s what i call\b/,
      /\bultimate hits\b/,
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
      /\bmeditation\b/,
      /\bsleep\b/,
      /\bambient\b/,
      /\belevator\b/,
      /\blullaby\b/
    ];

    return blockedAlbumPatterns.some((pattern) => pattern.test(albumNameValue));
  }

  private isBlockedCatalogEntry(title: string, artist: string): boolean {
    const value = `${title} ${artist}`.toLowerCase();
    const blockedPatterns = [
      /\bkaraoke\b/,
      /\bremaster(ed)?\b/,
      /\bradio edit\b/,
      /\bedit\b/,
      /\bremix\b/,
      /\bmix\b/,
      /\blive\b/,
      /\btribute\b/,
      /\bbest of\b/,
      /\bgreatest hits\b/,
      /\bthe collection\b/,
      /\banthology\b/,
      /\bessentials\b/
      ,/\bgodnatt(saga|sagor)?\b/
      ,/\bbedtime stories?\b/
      ,/\bmeditation\b/
      ,/\bmeditations\b/
      ,/\bmindfulness\b/
      ,/\brelax(ation)?\b/
      ,/\bcalm\b/
      ,/\bsleep\b/
      ,/\bdeep sleep\b/
      ,/\bwhite noise\b/
      ,/\bnature sounds?\b/
      ,/\brain sounds?\b/
      ,/\bambient\b/
      ,/\bspa music\b/
      ,/\belevator music\b/
      ,/\blounge music\b/
      ,/\binstrumental piano\b/
      ,/\bfocus music\b/
      ,/\bstudy music\b/
      ,/\baffirmations?\b/
    ];
    return blockedPatterns.some((pattern) => pattern.test(value));
  }

  parseFilters(raw: string): MusicFilters {
    const fallback: MusicFilters = {
      mode: "filters",
      catalog: "all",
      genre: "mixed",
      era: "all",
      knownHitsOnly: false,
      yearFrom: 1950,
      yearTo: 2024
    };

    try {
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.mode !== "filters") {
        return fallback;
      }
      return {
        mode: "filters",
        catalog: typeof parsed.catalog === "string" && parsed.catalog.trim().length > 0 ? parsed.catalog.trim() : "all",
        genre: parsed.genre ?? "mixed",
        era: parsed.era ?? "all",
        knownHitsOnly: parsed.knownHitsOnly === true,
        yearFrom: Number.isFinite(parsed.yearFrom) ? parsed.yearFrom : 1950,
        yearTo: Number.isFinite(parsed.yearTo) ? parsed.yearTo : 2024
      };
    } catch {
      return fallback;
    }
  }

  private async loadCatalogFromDb(): Promise<CatalogEntry[] | null> {
    try {
      const [songRows, themeRows, songThemeRows] = await Promise.all([
        db.select().from(songsTable),
        db.select().from(themesTable),
        db.select().from(songThemesTable),
      ]);

      if (songRows.length === 0) {
        return null;
      }

      const themeById = new Map(themeRows.map((t) => [t.id, t.name.toLowerCase()]));
      const tagsBySongId = new Map<string, string[]>();

      for (const link of songThemeRows) {
        const tag = themeById.get(link.themeId);
        if (!tag) continue;
        const tags = tagsBySongId.get(link.songId) || [];
        tags.push(tag);
        tagsBySongId.set(link.songId, tags);
      }

      return songRows
        .filter((row) => !this.isBlockedCatalogEntry(row.title, row.artist))
        .filter((row) => !this.isBlockedAlbumMeta(row.albumName, row.albumType))
        .map((row) => ({
        id: row.externalId || row.id,
        catalog: row.catalog || "default",
        title: row.title,
        artist: row.artist,
        year: row.year,
        albumCover: row.albumCover || undefined,
        previewUrl: row.previewUrl || undefined,
        language: row.language === "sv" ? "sv" : "en",
        energy: row.energy === "chill" ? "chill" : "upbeat",
        popularity: Number.isFinite(row.popularity) ? row.popularity : 0,
        isKnownHit: row.isKnownHit === true,
        tags: tagsBySongId.get(row.id) || [],
      }));
    } catch (error) {
      console.warn("Music catalog DB lookup failed:", error);
      return null;
    }
  }

  async getSongsForFilters(filters: MusicFilters, targetCount = 20): Promise<{ songs: Song[]; startYearRange: { min: number; max: number } }> {
    const presetRange = ERA_RANGE[filters.era] ?? ERA_RANGE.all;
    const customFrom = Math.max(1950, Math.min(2024, Math.floor(filters.yearFrom ?? 1950)));
    const customTo = Math.max(1950, Math.min(2024, Math.floor(filters.yearTo ?? 2024)));
    const range = filters.era === "custom"
      ? { min: Math.min(customFrom, customTo), max: Math.max(customFrom, customTo) }
      : presetRange;
    const dbCatalog = await this.loadCatalogFromDb();
    const catalog = this.resolveCatalogOrFallback(dbCatalog);
    const selectedCatalog = filters.catalog && filters.catalog !== "all" ? filters.catalog : null;
    const catalogScoped = selectedCatalog
      ? catalog.filter((song) => (song.catalog || "default") === selectedCatalog)
      : catalog;
    const knownCatalog = catalogScoped.filter((song) => song.isKnownHit === true);

    const basePool = catalogScoped.filter((song) => {
      if (song.year < range.min || song.year > range.max) return false;
      if ((song.popularity ?? 100) < MIN_DEFAULT_POPULARITY) return false;
      return true;
    });

    const knownBasePool = knownCatalog.filter((song) => {
      if (song.year < range.min || song.year > range.max) return false;
      if ((song.popularity ?? 0) < MIN_DEFAULT_POPULARITY) return false;
      return song.isKnownHit === true;
    });

    const byGenre =
      filters.genre === "mixed"
        ? basePool
        : basePool.filter((song) => song.tags.includes(filters.genre));

    const knownByGenre =
      filters.genre === "mixed"
        ? knownBasePool
        : knownBasePool.filter((song) => song.tags.includes(filters.genre));

    const shouldForceYearMix = filters.era === "all";
    const byGenreOrdered = shouldForceYearMix ? interleaveByDecade(byGenre, targetCount * 3) : shuffle(byGenre);
    const basePoolOrdered = shouldForceYearMix ? interleaveByDecade(basePool, targetCount * 3) : shuffle(basePool);
    const knownByGenreOrdered = shouldForceYearMix ? interleaveByDecade(knownByGenre, targetCount * 3) : shuffle(knownByGenre);
    const knownBasePoolOrdered = shouldForceYearMix ? interleaveByDecade(knownBasePool, targetCount * 3) : shuffle(knownBasePool);

    const picked = new Map<string, Song>();
    const pickedArtists = new Set<string>();

    const selectionOrder = filters.knownHitsOnly
      ? [knownByGenreOrdered, knownBasePoolOrdered]
      : [byGenreOrdered, basePoolOrdered];

    for (const group of selectionOrder) {
      for (const song of group) {
        if (picked.size >= targetCount) break;
        const artistKey = normalizedArtistKey(song.artist);
        if (artistKey && pickedArtists.has(artistKey)) continue;
        const key = `${song.title.toLowerCase()}|${song.artist.toLowerCase()}`;
        if (!picked.has(key)) {
          picked.set(key, song);
          if (artistKey) pickedArtists.add(artistKey);
        }
      }
      if (picked.size >= targetCount) break;
    }

    const shuffled = shuffle(Array.from(picked.values()));
    const cooled = this.withCooldownPreference(shuffled, targetCount);
    this.rememberPlayedSongs(cooled);

    return {
      songs: cooled,
      startYearRange: range
    };
  }

  async getAvailabilityForFilters(filters: MusicFilters): Promise<{
    eligibleCount: number;
    startYearRange: { min: number; max: number };
    warning?: string;
  }> {
    const presetRange = ERA_RANGE[filters.era] ?? ERA_RANGE.all;
    const customFrom = Math.max(1950, Math.min(2024, Math.floor(filters.yearFrom ?? 1950)));
    const customTo = Math.max(1950, Math.min(2024, Math.floor(filters.yearTo ?? 2024)));
    const range = filters.era === "custom"
      ? { min: Math.min(customFrom, customTo), max: Math.max(customFrom, customTo) }
      : presetRange;

    const dbCatalog = await this.loadCatalogFromDb();
    const catalog = this.resolveCatalogOrFallback(dbCatalog);
    const selectedCatalog = filters.catalog && filters.catalog !== "all" ? filters.catalog : null;
    const catalogScoped = selectedCatalog
      ? catalog.filter((song) => (song.catalog || "default") === selectedCatalog)
      : catalog;

    const basePool = catalogScoped.filter((song) => {
      if (song.year < range.min || song.year > range.max) return false;
      if ((song.popularity ?? 100) < MIN_DEFAULT_POPULARITY) return false;
      return true;
    });

    const byGenre = filters.genre === "mixed"
      ? basePool
      : basePool.filter((song) => song.tags.includes(filters.genre));

    const knownOnly = byGenre.filter((song) => song.isKnownHit === true);
    const rawPool = filters.knownHitsOnly ? knownOnly : byGenre;

    const unique = new Map<string, Song>();
    for (const song of rawPool) {
      const key = `${song.title.toLowerCase().trim()}|${song.artist.toLowerCase().trim()}|${song.year}`;
      if (!unique.has(key)) {
        unique.set(key, song);
      }
    }
    const eligibleCount = unique.size;

    let warning: string | undefined;
    if (catalog.length === 0) {
      warning = "Katalogen är tillfälligt otillgänglig. Prova igen om några sekunder.";
    } else if (filters.knownHitsOnly && filters.era === "2020s" && eligibleCount === 0) {
      warning = "Inga välkända låtar hittades för 2020-talet med nuvarande regler.";
    } else if (eligibleCount < 15) {
      warning = "För få låtar för en stabil match. Välj bredare filter.";
    }

    return {
      eligibleCount,
      startYearRange: range,
      warning
    };
  }

  async getCatalogOptions(): Promise<Array<{ id: string; count: number; minYear: number | null; maxYear: number | null }>> {
    const dbCatalog = await this.loadCatalogFromDb();
    const catalog = this.resolveCatalogOrFallbackWithDefault(dbCatalog);
    const grouped = new Map<string, { count: number; minYear: number | null; maxYear: number | null }>();

    for (const song of catalog) {
      const key = song.catalog || "default";
      const row = grouped.get(key) || { count: 0, minYear: null, maxYear: null };
      row.count += 1;
      row.minYear = row.minYear === null ? song.year : Math.min(row.minYear, song.year);
      row.maxYear = row.maxYear === null ? song.year : Math.max(row.maxYear, song.year);
      grouped.set(key, row);
    }

    return Array.from(grouped.entries())
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));
  }
}

export const musicCatalogStubService = new MusicCatalogStubService();
