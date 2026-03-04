import { Song, Player, GameState, RoundResult } from '../shared/types';

export class Game {
  private state: GameState;
  private roundStartedAtMs: number = Date.now();
  private readonly playbackLeadMs = 1800;

  constructor(masterSocketId: string, mode: 'local' | 'online' = 'local') {
    this.state = {
      id: this.generateGameId(),
      mode,
      masterSocketId,
      players: [],
      currentSong: null,
      songs: [],
      phase: 'setup',
      musicPreferences: '',
      searchQuery: '',
      roundNumber: 0,
      playbackStartAtMs: null,
      winner: null,
      startYearRange: { min: 1950, max: 2020 }
    };
  }

  private generateGameId(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  getState(): GameState {
    return { ...this.state };
  }

  getId(): string {
    return this.state.id;
  }

  getMasterSocketId(): string {
    return this.state.masterSocketId;
  }

  getMode(): 'local' | 'online' {
    return this.state.mode;
  }

  addPlayer(
    socketId: string,
    name: string,
    persistentId?: string,
    profileId?: string,
    profileData?: { artistName?: string; avatarColor?: string; profileImage?: string }
  ): Player {
    const range = this.state.startYearRange || { min: 1950, max: 2020 };
    const startYear = Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;

    // If joining during 'playing' phase, mark as ready so they don't block the round
    const isReady = this.state.phase === 'playing';

    const player: Player = {
      id: socketId,
      name,
      timeline: [],
      startYear,
      score: 0,
      isReady,
      connected: true,
      persistentId: persistentId || this.generatePersistentId(),
      profileId,
      artistName: profileData?.artistName,
      avatarColor: profileData?.avatarColor,
      profileImage: profileData?.profileImage,
      correctAnswers: 0,
      totalCorrectResponseMs: 0,
      averageCorrectResponseMs: null
    };
    this.state.players.push(player);
    return player;
  }

  private generatePersistentId(): string {
    return Math.random().toString(36).substring(2, 15) +
           Math.random().toString(36).substring(2, 15);
  }

  removePlayer(socketId: string): void {
    this.state.players = this.state.players.filter(p => p.id !== socketId);
  }

  getPlayer(socketId: string): Player | undefined {
    return this.state.players.find(p => p.id === socketId);
  }

  getPlayerByPersistentId(persistentId: string): Player | undefined {
    return this.state.players.find(p => p.persistentId === persistentId);
  }

  markPlayerDisconnected(socketId: string): Player | undefined {
    const player = this.state.players.find(p => p.id === socketId);
    if (player) {
      player.connected = false;
    }
    return player;
  }

  reconnectPlayer(persistentId: string, newSocketId: string): Player | null {
    const player = this.state.players.find(p => p.persistentId === persistentId);
    if (!player) {
      return null;
    }

    player.id = newSocketId;
    player.connected = true;

    return player;
  }

  setMusicPreferences(preferences: string, searchQuery: string): void {
    this.state.musicPreferences = preferences;
    this.state.searchQuery = searchQuery;
  }

  setSongs(songs: Song[]): void {
    const unique = new Map<string, Song>();
    const artistSeen = new Set<string>();

    const normalizedArtistKey = (artist: string): string =>
      artist
        .toLowerCase()
        .split(",")[0]
        .split(/ feat\.?| ft\.?| featuring | & | and /i)[0]
        .trim();

    for (const song of songs) {
      const artistKey = normalizedArtistKey(song.artist);
      if (artistKey && artistSeen.has(artistKey)) {
        continue;
      }
      const key = song.id
        ? `id:${song.id}`
        : `meta:${song.title.toLowerCase().trim()}|${song.artist.toLowerCase().trim()}|${song.year}`;
      if (!unique.has(key)) {
        unique.set(key, song);
        if (artistKey) {
          artistSeen.add(artistKey);
        }
      }
    }
    this.state.songs = Array.from(unique.values()).sort(() => Math.random() - 0.5);
  }

  setStartYearRange(range: { min: number; max: number }): void {
    this.state.startYearRange = range;
  }

  setPhase(phase: GameState['phase']): void {
    this.state.phase = phase;
    if (phase !== 'playing') {
      this.state.playbackStartAtMs = null;
    }
  }

  startGame(): boolean {
    if (this.state.players.length === 0 || this.state.songs.length === 0) {
      return false;
    }
    this.state.phase = 'playing';
    this.nextRound();
    return true;
  }

  private getPlayerAverageMs(player: Player): number {
    if (!player.correctAnswers || player.correctAnswers <= 0) return Number.POSITIVE_INFINITY;
    return (player.totalCorrectResponseMs || 0) / player.correctAnswers;
  }

  private comparePlayers(a: Player, b: Player): number {
    if (b.score !== a.score) return b.score - a.score;
    const avgDiff = this.getPlayerAverageMs(a) - this.getPlayerAverageMs(b);
    if (avgDiff !== 0) return avgDiff;
    return a.name.localeCompare(b.name);
  }

  nextRound(): Song | null {
    const winner = [...this.state.players]
      .filter(p => p.score >= 10)
      .sort((a, b) => this.comparePlayers(a, b))[0];
    if (winner) {
      this.state.phase = 'finished';
      this.state.winner = winner;
      this.state.currentSong = null;
      this.state.playbackStartAtMs = null;
      return null;
    }

    if (this.state.roundNumber >= this.state.songs.length) {
      // Out of songs - find winner by highest score
      const sortedPlayers = this.getRankedPlayers();
      if (sortedPlayers.length > 0) {
        this.state.winner = sortedPlayers[0];
      }
      this.state.phase = 'finished';
      this.state.currentSong = null;
      this.state.playbackStartAtMs = null;
      return null;
    }

    this.state.currentSong = this.state.songs[this.state.roundNumber];
    this.state.roundNumber++;
    this.state.phase = 'playing';
    this.state.playbackStartAtMs = Date.now() + this.playbackLeadMs;
    this.roundStartedAtMs = this.state.playbackStartAtMs;

    this.state.players.forEach(player => {
      player.isReady = false;
      player.currentPlacement = undefined;
    });

    return this.state.currentSong;
  }

  placeSong(playerId: string, position: number): boolean {
    if (this.state.phase !== 'playing') return false;

    const player = this.state.players.find(p => p.id === playerId);
    if (!player || !this.state.currentSong || player.isReady) return false;

    player.currentPlacement = {
      song: this.state.currentSong,
      position,
      placedAtMs: Date.now()
    };
    player.isReady = true;
    return true;
  }

  allPlayersReady(): boolean {
    const connectedPlayers = this.state.players.filter(p => p.connected);
    return connectedPlayers.length > 0 &&
           connectedPlayers.every(p => p.isReady);
  }

  evaluateRound(): RoundResult[] | null {
    if (this.state.phase !== 'playing') {
      return null;
    }

    const results: RoundResult[] = [];

    this.state.players.forEach(player => {
      if (!player.currentPlacement || !this.state.currentSong) return;

      const { song, position } = player.currentPlacement;
      const timeline = player.timeline;
      const responseMs = Math.max(0, (player.currentPlacement.placedAtMs || Date.now()) - this.roundStartedAtMs);

      let correct = false;

      if (timeline.length === 0) {
        // First card: position 0 = before startYear, position 1 = after startYear
        if (position === 0) {
          correct = song.year <= player.startYear;
        } else if (position === 1) {
          correct = song.year >= player.startYear;
        }
      } else if (position === 0) {
        correct = song.year <= timeline[0].year;
      } else if (position === timeline.length) {
        correct = song.year >= timeline[timeline.length - 1].year;
      } else {
        const before = timeline[position - 1];
        const after = timeline[position];
        correct = song.year >= before.year && song.year <= after.year;
      }

      if (correct) {
        player.timeline.splice(position, 0, song);
        player.score++;
        player.correctAnswers = (player.correctAnswers || 0) + 1;
        player.totalCorrectResponseMs = (player.totalCorrectResponseMs || 0) + responseMs;
        player.averageCorrectResponseMs = Math.round((player.totalCorrectResponseMs / player.correctAnswers));
      }

      results.push({
        playerId: player.id,
        playerName: player.name,
        correct,
        placedAt: position,
        correctYear: song.year,
        responseMs
      });

      player.currentPlacement = undefined;
    });

    return results;
  }

  checkWinner(): Player | null {
    const winner = [...this.state.players]
      .filter(p => p.score >= 10)
      .sort((a, b) => this.comparePlayers(a, b))[0];
    
    if (winner) {
      this.state.winner = winner;
      this.state.phase = 'finished';
    }

    return winner || null;
  }

  getRankedPlayers(): Player[] {
    return [...this.state.players].sort((a, b) => this.comparePlayers(a, b));
  }

  getPlayers(): Player[] {
    return [...this.state.players];
  }
}
