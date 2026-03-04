import SpotifyWebApi from 'spotify-web-api-node';
import type { Song, SongSuggestion } from '../shared/types';

interface SpotifySearchQuery {
  query: string;
  yearMin?: number;
  yearMax?: number;
}

class SpotifyService {
  private spotifyApi: SpotifyWebApi;
  private tokenExpiresAt: number = 0;
  private readonly minDefaultPopularity = Number.parseInt(process.env.MIN_DEFAULT_POPULARITY || "35", 10);

  constructor() {
    this.spotifyApi = new SpotifyWebApi({
      clientId: process.env.SPOTIFY_CLIENT_ID,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    });
  }

  private async ensureAuthenticated(): Promise<void> {
    const now = Date.now();
    
    if (this.tokenExpiresAt > now) {
      return;
    }

    try {
      const data = await this.spotifyApi.clientCredentialsGrant();
      this.spotifyApi.setAccessToken(data.body.access_token);
      this.tokenExpiresAt = now + (data.body.expires_in - 60) * 1000;
      console.log('Spotify: Access token obtained');
    } catch (error) {
      console.error('Spotify authentication failed:', error);
      throw new Error('Failed to authenticate with Spotify');
    }
  }

  private isBlockedVersion(trackName: string): boolean {
    const name = trackName.toLowerCase();
    const blockedPatterns = [
      /\bremaster(ed)?\b/,
      /\bradio edit\b/,
      /\bedit\b/,
      /\bremix\b/,
      /\bmix\b/,
      /\blive\b/,
      /\bversion\b/,
      /\binstrumental\b/,
      /\bkaraoke\b/,
      /\bmono\b/,
      /\bstereo\b/,
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
      /\bspa music\b/,
      /\belevator music\b/,
      /\blounge music\b/,
      /\bfocus music\b/,
      /\bstudy music\b/,
      /\bacoustic version\b/,
      /\bsped up\b/,
      /\bslowed\b/,
      /\bnightcore\b/,
      /\b8d\b/,
      /\blofi\b/,
      /\baffirmations?\b/
    ];

    return blockedPatterns.some((pattern) => pattern.test(name));
  }

  private isCompilationAlbum(track: any): boolean {
    const albumType = (track?.album?.album_type || "").toLowerCase();
    const albumName = (track?.album?.name || "").toLowerCase();
    if (!["album", "single"].includes(albumType)) return true;

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
      /\bmeditation\b/,
      /\bsleep\b/,
      /\bambient\b/,
      /\bspa\b/,
      /\belevator\b/,
      /\blullaby\b/
    ];

    return blockedAlbumPatterns.some((pattern) => pattern.test(albumName));
  }

  async searchSongs(query: string, limit: number = 15): Promise<Song[]> {
    await this.ensureAuthenticated();

    if (!query || query.trim().length === 0) {
      console.log('Empty search query provided');
      return [];
    }

    const cleanQuery = query.trim();
    console.log(`Spotify: Searching for "${cleanQuery}"`);

    try {
      const response = await this.spotifyApi.searchTracks(cleanQuery, { 
        limit: 50,
        market: 'SE'
      });
      const tracks = response.body.tracks?.items || [];
      console.log(`Spotify: Got ${tracks.length} raw tracks from API`);

      let filteredCount = 0;
      let noPreviewCount = 0;
      let invalidYearCount = 0;

      const songs: Song[] = tracks
        .filter((track: any) => {
          const releaseDate = track.album.release_date;
          const year = releaseDate ? parseInt(releaseDate.split('-')[0]) : null;
          const hasValidYear = year && year >= 1950 && year <= 2024;
          const isCleanVersion = !this.isBlockedVersion(track.name);
          const hasPreview = !!track.preview_url;
          const isCompilation = this.isCompilationAlbum(track);
          
          if (!hasValidYear) invalidYearCount++;
          if (!hasPreview) noPreviewCount++;
          
          if (hasValidYear && isCleanVersion && !isCompilation) filteredCount++;
          
          return hasValidYear && isCleanVersion && !isCompilation;
        })
        .slice(0, limit)
        .map((track: any) => {
          const releaseDate = track.album.release_date;
          const year = parseInt(releaseDate.split('-')[0]);

          return {
            id: track.id,
            title: track.name,
            artist: track.artists.map((a: any) => a.name).join(', '),
            year,
            albumCover: track.album.images[0]?.url || '',
            previewUrl: track.preview_url || undefined
          };
        });

      console.log(`Spotify: Filtered - ${filteredCount} valid, ${noPreviewCount} no preview, ${invalidYearCount} bad year`);
      console.log(`Spotify: Returning ${songs.length} songs for query "${cleanQuery}"`);
      return songs;
    } catch (error) {
      console.error('Spotify search failed:', error);
      throw new Error('Failed to search songs on Spotify');
    }
  }

  async searchSpecificSong(suggestion: SongSuggestion): Promise<Song | null> {
    await this.ensureAuthenticated();

    const simpleQuery = `${suggestion.title} ${suggestion.artist}`;
    console.log(`  Searching: "${simpleQuery}" (target year: ${suggestion.year})`);
    
    try {
      const response = await this.spotifyApi.searchTracks(simpleQuery, { 
        limit: 15,
        market: 'SE'
      });
      const tracks = response.body.tracks?.items || [];
      console.log(`  Got ${tracks.length} results`);

      const validTracks = tracks.filter((track: any) => {
        const releaseDate = track.album.release_date;
        const year = releaseDate ? parseInt(releaseDate.split('-')[0]) : null;
        return year && year >= 1950 && year <= 2024 && !this.isCompilationAlbum(track);
      });

      const cleanTracks = validTracks.filter((track: any) => !this.isBlockedVersion(track.name));
      const tracksToRank = cleanTracks.length > 0 ? cleanTracks : validTracks;

      const exactYearMatches = tracksToRank.filter((track: any) => {
        const year = parseInt(track.album.release_date.split('-')[0]);
        return Math.abs(year - suggestion.year) <= 2;
      });

      const tracksToConsider = exactYearMatches.length > 0 ? exactYearMatches : tracksToRank;
      const rankedTracks = [...tracksToConsider].sort((a: any, b: any) => {
        const yearA = parseInt(a.album.release_date.split('-')[0]);
        const yearB = parseInt(b.album.release_date.split('-')[0]);
        const diffA = Math.abs(yearA - suggestion.year);
        const diffB = Math.abs(yearB - suggestion.year);
        if (diffA !== diffB) return diffA - diffB;
        return (b.popularity || 0) - (a.popularity || 0);
      });
      const tracksWithPreview = rankedTracks.filter((t: any) => !!t.preview_url);
      
      console.log(`  ${exactYearMatches.length} tracks matching year ${suggestion.year} (±2 years)`);
      console.log(`  ${tracksWithPreview.length} with preview URLs`);

      if (rankedTracks.length === 0) {
        return null;
      }

      const bestMatch = tracksWithPreview.length > 0 ? tracksWithPreview[0] : rankedTracks[0];
      const releaseDate = bestMatch.album.release_date;
      const year = parseInt(releaseDate.split('-')[0]);

      // Skip tracks that are too far from the intended release year.
      if (Math.abs(year - suggestion.year) > 6) {
        return null;
      }
      if ((bestMatch.popularity || 0) < this.minDefaultPopularity) {
        return null;
      }

      return {
        id: bestMatch.id,
        title: bestMatch.name,
        artist: bestMatch.artists.map((a: any) => a.name).join(', '),
        year,
        albumCover: bestMatch.album.images[0]?.url || '',
        previewUrl: bestMatch.preview_url || undefined,
        movie: suggestion.movie,
        trivia: suggestion.trivia
      };
    } catch (error: any) {
      console.error(`  Error searching "${suggestion.title}" by ${suggestion.artist}:`, error.message);
      return null;
    }
  }

  async searchFromSuggestions(suggestions: SongSuggestion[], targetCount: number = 15): Promise<Song[]> {
    console.log(`Spotify: Searching for ${suggestions.length} AI-suggested songs`);
    
    const songs: Song[] = [];
    
    for (const suggestion of suggestions) {
      if (songs.length >= targetCount) break;
      
      const song = await this.searchSpecificSong(suggestion);
      if (song) {
        const movieInfo = song.movie ? ` från ${song.movie}` : '';
        console.log(`  ✓ Found: "${song.title}" by ${song.artist} (${song.year})${movieInfo}`);
        songs.push(song);
      } else {
        console.log(`  ✗ Not found: "${suggestion.title}" by ${suggestion.artist} (${suggestion.year})`);
      }
    }

    console.log(`Spotify: Successfully found ${songs.length}/${targetCount} songs`);
    return songs;
  }

  async getRecommendations(genre: string, limit: number = 15): Promise<Song[]> {
    await this.ensureAuthenticated();

    try {
      const seedGenres = [genre.toLowerCase().replace(/\s+/g, '-')];
      
      const response = await this.spotifyApi.getRecommendations({
        seed_genres: seedGenres,
        limit: 50,
        min_popularity: 30,
        market: 'SE'
      });

      const tracks = response.body.tracks || [];

      const songs: Song[] = tracks
        .filter((track: any) => {
          const releaseDate = track.album.release_date;
          const year = releaseDate ? parseInt(releaseDate.split('-')[0]) : null;
          return year && year >= 1950 && year <= 2024 && !this.isBlockedVersion(track.name) && !this.isCompilationAlbum(track);
        })
        .slice(0, limit)
        .map((track: any) => {
          const releaseDate = track.album.release_date;
          const year = parseInt(releaseDate.split('-')[0]);

          return {
            id: track.id,
            title: track.name,
            artist: track.artists.map((a: any) => a.name).join(', '),
            year,
            albumCover: track.album.images[0]?.url || '',
            previewUrl: track.preview_url || undefined
          };
        });

      console.log(`Spotify: Found ${songs.length} recommendations for genre "${genre}"`);
      return songs;
    } catch (error) {
      console.error('Spotify recommendations failed:', error);
      return this.searchSongs(genre, limit);
    }
  }

  async searchFromQueries(queries: SpotifySearchQuery[], targetCount: number = 20): Promise<Song[]> {
    await this.ensureAuthenticated();

    console.log(`Spotify: Searching with ${queries.length} queries, target: ${targetCount} songs`);

    const allSongs: Song[] = [];
    const seenTrackIds = new Set<string>();
    const seenSongKeys = new Set<string>(); // Track title+artist to catch same song on different albums
    const songsPerQuery = Math.ceil(targetCount / queries.length) + 2; // Get extra for filtering duplicates

    // Shuffle queries for variety
    const shuffledQueries = [...queries].sort(() => Math.random() - 0.5);

    for (const queryObj of shuffledQueries) {
      if (allSongs.length >= targetCount) break;

      try {
        console.log(`  Searching: "${queryObj.query}"`);

        const response = await this.spotifyApi.searchTracks(queryObj.query, {
          limit: 50,
          market: 'SE'
        });

        const tracks = response.body.tracks?.items || [];
        console.log(`    Got ${tracks.length} results`);

        // Shuffle tracks to avoid always getting the same top results
        const shuffledTracks = [...tracks].sort(() => Math.random() - 0.5);

        let addedFromQuery = 0;
        for (const track of shuffledTracks) {
          if (allSongs.length >= targetCount) break;
          if (addedFromQuery >= songsPerQuery) break;
          if (seenTrackIds.has(track.id)) continue;

          // Check for same song on different albums (normalize title + artist)
          const artistName = track.artists.map((a: any) => a.name).join(', ');
          const songKey = `${track.name.toLowerCase().trim()}|${artistName.toLowerCase().trim()}`;
          if (seenSongKeys.has(songKey)) continue;

          const releaseDate = track.album.release_date;
          const year = releaseDate ? parseInt(releaseDate.split('-')[0]) : null;

          // Check year validity
          if (!year || year < 1950 || year > 2024) continue;
          if (this.isBlockedVersion(track.name)) continue;
          if (this.isCompilationAlbum(track)) continue;

          // Check year range filter if specified
          if (queryObj.yearMin && year < queryObj.yearMin) continue;
          if (queryObj.yearMax && year > queryObj.yearMax) continue;

          seenTrackIds.add(track.id);
          seenSongKeys.add(songKey);
          addedFromQuery++;

          allSongs.push({
            id: track.id,
            title: track.name,
            artist: artistName,
            year,
            albumCover: track.album.images[0]?.url || '',
            previewUrl: track.preview_url || undefined
          });
        }

        console.log(`    Added ${addedFromQuery} songs (total: ${allSongs.length})`);

      } catch (error: any) {
        console.error(`  Error searching "${queryObj.query}":`, error.message);
      }
    }

    // Shuffle final results to mix songs from different queries
    const shuffledSongs = allSongs.sort(() => Math.random() - 0.5);

    // Ensure good year distribution - sort by year and spread them out
    const sortedByYear = [...shuffledSongs].sort((a, b) => a.year - b.year);
    const finalSongs: Song[] = [];
    const used = new Set<number>();

    // Interleave songs from different decades for variety
    while (finalSongs.length < targetCount && used.size < sortedByYear.length) {
      for (let i = 0; i < sortedByYear.length && finalSongs.length < targetCount; i++) {
        if (!used.has(i)) {
          // Skip every other song to spread decades
          if (finalSongs.length % 2 === 0 || used.size > sortedByYear.length - 5) {
            finalSongs.push(sortedByYear[i]);
            used.add(i);
          }
        }
      }
      // On second pass, add remaining
      for (let i = 0; i < sortedByYear.length && finalSongs.length < targetCount; i++) {
        if (!used.has(i)) {
          finalSongs.push(sortedByYear[i]);
          used.add(i);
        }
      }
    }

    // Final shuffle for game randomness
    const result = finalSongs.sort(() => Math.random() - 0.5).slice(0, targetCount);

    console.log(`Spotify: Returning ${result.length} diverse songs`);
    console.log(`  Year range: ${Math.min(...result.map(s => s.year))} - ${Math.max(...result.map(s => s.year))}`);

    return result;
  }
}

export const spotifyService = new SpotifyService();
