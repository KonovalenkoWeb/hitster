export interface Song {
  id: string;
  title: string;
  artist: string;
  year: number;
  spotifyUri?: string;
  previewUrl?: string;
  albumCover?: string;
  movie?: string;
  trivia?: string;
}

export interface SongSuggestion {
  title: string;
  artist: string;
  year: number;
  movie?: string;
  trivia?: string;
}

export interface Player {
  id: string;
  name: string;
  timeline: Song[];
  startYear: number;
  score: number;
  isReady: boolean;
  connected: boolean;
  persistentId?: string;
  profileId?: string;
  artistName?: string;
  avatarColor?: string;
  profileImage?: string;
  correctAnswers?: number;
  totalCorrectResponseMs?: number;
  averageCorrectResponseMs?: number | null;
  currentPlacement?: { song: Song; position: number; placedAtMs?: number };
}

export interface GameState {
  id: string;
  mode: 'local' | 'online';
  masterSocketId: string;
  players: Player[];
  currentSong: Song | null;
  songs: Song[];
  phase: 'setup' | 'lobby' | 'playing' | 'reveal' | 'finished';
  musicPreferences: string;
  searchQuery: string;
  roundNumber: number;
  playbackStartAtMs?: number | null;
  winner: Player | null;
  startYearRange?: { min: number; max: number };
}

export interface RoundResult {
  playerId: string;
  playerName: string;
  correct: boolean;
  placedAt: number;
  correctYear: number;
  responseMs?: number;
}

export interface SocketEvents {
  createGame: (data?: { mode?: 'local' | 'online' }) => void;
  gameCreated: (data: { gameId: string; gameState: GameState }) => void;

  joinGame: (data: { gameCode: string; playerName: string; persistentId?: string }) => void;
  playerJoined: (data: { player: Player; gameState: GameState }) => void;

  reconnectPlayer: (data: { gameCode: string; persistentId: string }) => void;
  playerReconnected: (data: { player: Player; gameState: GameState }) => void;

  playerDisconnected: (data: { playerId: string; playerName: string }) => void;

  confirmPreferences: (preferences: string) => void;
  preferencesConfirmed: (data: { songs: Song[]; gameState: GameState }) => void;

  startGame: () => void;
  gameStarted: (gameState: GameState) => void;

  placeCard: (position: number) => void;
  cardPlaced: (data: { playerId: string; position: number }) => void;

  revealResults: () => void;
  resultsRevealed: (data: { results: RoundResult[]; gameState: GameState }) => void;

  djCommentary: (audioData: string) => void;

  nextRound: () => void;
  roundStarted: (gameState: GameState) => void;

  gameStateUpdate: (gameState: GameState) => void;
  error: (message: string) => void;
}
