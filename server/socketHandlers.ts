import { Server as SocketIOServer, Socket } from 'socket.io';
import { gameManager } from './gameManager';
import { storage } from './storage';
import type { SocketEvents, Song } from '../shared/types';
import type { Game } from './game';

// Cache for pre-generated DJ commentary (generated when round starts)
const djCommentaryCache = new Map<string, Promise<Buffer | null>>();

// Pre-generate DJ commentary in background when round starts
async function preGenerateDJCommentary(gameId: string, song: Song, musicContext?: string): Promise<Buffer | null> {
  console.log(`Pre-generating DJ commentary for game ${gameId}: "${song.title}"`);
  try {
    const { elevenLabsService } = await import('./elevenlabs');
    const audioBuffer = await elevenLabsService.generateDJCommentary(
      song,
      false, // Not finished - we'll generate fresh if someone wins
      undefined,
      gameId,
      musicContext
    );
    console.log(`DJ commentary pre-generated for game ${gameId}`);
    return audioBuffer;
  } catch (error) {
    console.error(`Error pre-generating DJ commentary for game ${gameId}:`, error);
    return null;
  }
}

function startNextRoundAndBroadcast(io: SocketIOServer, game: Game) {
  const nextSong = game.nextRound();
  if (!nextSong) {
    io.to(game.getId()).emit('gameStateUpdate', game.getState());
    console.log(`Game ${game.getId()} finished - no more songs`);
    return;
  }

  io.to(game.getId()).emit('roundStarted', game.getState());
  console.log(`Auto next round started for game ${game.getId()}`);

  const currentSong = game.getState().currentSong;
  const musicContext = game.getState().musicPreferences;
  if (currentSong) {
    const commentaryPromise = preGenerateDJCommentary(game.getId(), currentSong, musicContext);
    djCommentaryCache.set(game.getId(), commentaryPromise);
  }
}

function scheduleAutoNextRoundFallback(io: SocketIOServer, game: Game, delayMs = 4000) {
  setTimeout(() => {
    const state = game.getState();
    if (state.phase === 'reveal') {
      startNextRoundAndBroadcast(io, game);
    }
  }, delayMs);
}

function scheduleWinnerUpdate(io: SocketIOServer, game: Game, delayMs = 4000) {
  setTimeout(() => {
    const state = game.getState();
    if (state.phase === 'finished') {
      io.to(game.getId()).emit('gameStateUpdate', state);
      console.log(`Winner state emitted for game ${game.getId()} after reveal delay`);
    }
  }, delayMs);
}

export function setupSocketHandlers(io: SocketIOServer) {
  io.on('connection', (socket: Socket) => {
    console.log(`Client connected: ${socket.id}`);

    socket.on('createGame', (data?: { mode?: 'local' | 'online' }) => {
      try {
        const mode = data?.mode === 'online' ? 'online' : 'local';
        const game = gameManager.createGame(socket.id, mode);
        socket.join(game.getId());
        
        socket.emit('gameCreated', {
          gameId: game.getId(),
          gameState: game.getState()
        });

        console.log(`Game created: ${game.getId()} by ${socket.id} (${mode})`);
      } catch (error) {
        console.error('Error creating game:', error);
        socket.emit('error', 'Failed to create game');
      }
    });

    socket.on('joinGame', async ({ gameCode, playerName, persistentId, profileId }: { gameCode: string; playerName: string; persistentId?: string; profileId?: string }) => {
      try {
        const game = gameManager.getGame(gameCode);
        if (!game) {
          socket.emit('error', 'Game not found');
          return;
        }

        // Allow joining during any phase except 'finished'
        if (game.getState().phase === 'finished') {
          socket.emit('error', 'Game is finished');
          return;
        }

        // Check if player already exists in the game
        const existingPlayers = game.getState().players;
        if (profileId) {
          const duplicateProfile = existingPlayers.find(p => p.profileId === profileId);
          if (duplicateProfile) {
            socket.emit('error', 'You are already in this game');
            return;
          }
        } else if (persistentId) {
          const duplicatePersistent = existingPlayers.find(p => p.persistentId === persistentId);
          if (duplicatePersistent) {
            socket.emit('error', 'You are already in this game');
            return;
          }
        }

        // Fetch profile data if profileId is provided
        let profileData: { artistName?: string; avatarColor?: string; profileImage?: string } | undefined;
        if (profileId) {
          try {
            const profile = await storage.getPlayerProfile(profileId);
            if (profile) {
              profileData = {
                artistName: profile.artistName || undefined,
                avatarColor: profile.avatarColor,
                profileImage: profile.profileImage || undefined
              };
            }
          } catch (error) {
            console.error(`Failed to fetch profile ${profileId}:`, error);
            // Continue without profile data
          }
        }

        const player = game.addPlayer(socket.id, playerName, persistentId, profileId, profileData);
        gameManager.addPlayerToGame(gameCode, socket.id);
        socket.join(gameCode);

        socket.emit('playerJoined', {
          player,
          gameState: game.getState()
        });

        io.to(gameCode).emit('gameStateUpdate', game.getState());

        console.log(`Player ${playerName} joined game ${gameCode} with persistentId ${player.persistentId} and profileId ${profileId}`);
      } catch (error) {
        console.error('Error joining game:', error);
        socket.emit('error', 'Could not join game');
      }
    });

    socket.on('reconnectPlayer', ({ gameCode, persistentId }: { gameCode: string; persistentId: string }) => {
      try {
        const game = gameManager.getGame(gameCode);
        if (!game) {
          socket.emit('error', 'Game not found');
          return;
        }

        const player = game.reconnectPlayer(persistentId, socket.id);
        if (!player) {
          socket.emit('error', 'Could not reconnect - player not found');
          return;
        }

        // Update game manager mapping
        gameManager.addPlayerToGame(gameCode, socket.id);
        socket.join(gameCode);

        socket.emit('playerReconnected', {
          player,
          gameState: game.getState()
        });

        io.to(gameCode).emit('gameStateUpdate', game.getState());

        console.log(`Player ${player.name} (${persistentId}) reconnected to game ${gameCode}`);
      } catch (error) {
        console.error('Error reconnecting player:', error);
        socket.emit('error', 'Could not reconnect to game');
      }
    });

    socket.on('confirmPreferences', async (preferences: string) => {
      try {
        const game = gameManager.getGameBySocket(socket.id);
        if (!game || game.getMasterSocketId() !== socket.id) {
          socket.emit('error', 'Not authorized');
          return;
        }

        const { musicCatalogStubService } = await import('./musicCatalogStub');
        const filters = musicCatalogStubService.parseFilters(preferences || "");
        const { songs: catalogSongs, startYearRange } = await musicCatalogStubService.getSongsForFilters(filters, 20);

        const yearWindow = filters.era === "custom"
          ? `${filters.yearFrom ?? 1950}-${filters.yearTo ?? 2024}`
          : filters.era;
        const userPreference = `catalog=${filters.catalog || "all"}, genre=${filters.genre}, era=${yearWindow}, knownHitsOnly=${filters.knownHitsOnly}`;
        const searchQuery = JSON.stringify(filters);
        game.setMusicPreferences(userPreference, searchQuery);

        // Always keep exact songs from the selected catalog.
        // This prevents search-based enrichment from swapping in nearby but incorrect tracks.
        const songs = catalogSongs;

        if (songs.length < 15) {
          socket.emit('error', `Only found ${songs.length} songs. Try broader filters.`);
          return;
        }

        game.setSongs(songs);
        game.setStartYearRange(startYearRange);
        game.setPhase('lobby');

        socket.emit('preferencesConfirmed', {
          songs,
          gameState: game.getState()
        });

        console.log(`Preferences confirmed for game ${game.getId()} with ${songs.length} songs`);
      } catch (error) {
        console.error('Error confirming preferences:', error);
        socket.emit('error', 'Failed to find songs. Please try again.');
      }
    });

    socket.on('startGame', () => {
      try {
        const game = gameManager.getGameBySocket(socket.id);
        if (!game || game.getMasterSocketId() !== socket.id) {
          socket.emit('error', 'Not authorized');
          return;
        }

        if (!game.startGame()) {
          socket.emit('error', 'Cannot start game - no players or songs');
          return;
        }

        io.to(game.getId()).emit('gameStarted', game.getState());
        console.log(`Game ${game.getId()} started`);

        // Pre-generate DJ commentary in background while players place cards
        const currentSong = game.getState().currentSong;
        const musicContext = game.getState().musicPreferences;
        if (currentSong) {
          const commentaryPromise = preGenerateDJCommentary(game.getId(), currentSong, musicContext);
          djCommentaryCache.set(game.getId(), commentaryPromise);
        }
      } catch (error) {
        console.error('Error starting game:', error);
        socket.emit('error', 'Failed to start game');
      }
    });

    socket.on('placeCard', async (position: number) => {
      try {
        const game = gameManager.getGameBySocket(socket.id);
        if (!game) {
          socket.emit('error', 'Game not found');
          return;
        }

        if (!game.placeSong(socket.id, position)) {
          socket.emit('error', 'Failed to place card');
          return;
        }

        io.to(game.getId()).emit('cardPlaced', {
          playerId: socket.id,
          position
        });

        io.to(game.getId()).emit('gameStateUpdate', game.getState());

        console.log(`Player ${socket.id} placed card at position ${position}`);

        if (game.allPlayersReady()) {
          console.log('All players ready, automatically revealing results...');

          const results = game.evaluateRound();
          if (results) {
            game.setPhase('reveal');

            io.to(game.getId()).emit('resultsRevealed', {
              results,
              gameState: game.getState()
            });

            // Check winner BEFORE getting DJ commentary
            const winner = game.checkWinner();
            const isGameFinished = !!winner;

            const currentSong = game.getState().currentSong;
            const musicContext = game.getState().musicPreferences;
            if (currentSong) {
              let audioBuffer: Buffer | null = null;

              if (isGameFinished && winner) {
                // Winner! Generate fresh commentary with winner announcement
                console.log(`Game finished - generating winner commentary for ${winner.name}`);
                const { elevenLabsService } = await import('./elevenlabs');
                audioBuffer = await elevenLabsService.generateDJCommentary(
                  currentSong,
                  true,
                  winner.name,
                  game.getId(),
                  musicContext
                );
              } else {
                // Use pre-generated commentary from cache
                const cachedPromise = djCommentaryCache.get(game.getId());
                if (cachedPromise) {
                  console.log(`Using pre-generated DJ commentary for game ${game.getId()}`);
                  audioBuffer = await cachedPromise;
                  djCommentaryCache.delete(game.getId());
                } else {
                  // Fallback: generate on the fly if cache miss
                  console.log(`Cache miss - generating DJ commentary on the fly`);
                  const { elevenLabsService } = await import('./elevenlabs');
                  audioBuffer = await elevenLabsService.generateDJCommentary(
                    currentSong,
                    false,
                    undefined,
                    game.getId(),
                    musicContext
                  );
                }
              }

              if (audioBuffer) {
                const base64Audio = audioBuffer.toString('base64');
                io.to(game.getId()).emit('djCommentary', base64Audio);
                console.log(`DJ commentary sent for game ${game.getId()}`);
              } else if (!winner) {
                // Fallback for AI-free / no-voice setups: continue automatically without commentary audio.
                scheduleAutoNextRoundFallback(io, game);
              }
            }

            if (winner) {
              scheduleWinnerUpdate(io, game, 4000);
              console.log(`Game ${game.getId()} finished - ${winner.name} won! (delayed winner screen)`);
            }

            console.log(`Results auto-revealed for game ${game.getId()}`);
          }
        }
      } catch (error) {
        console.error('Error placing card:', error);
        socket.emit('error', 'Failed to place card');
      }
    });

    socket.on('revealResults', async () => {
      try {
        const game = gameManager.getGameBySocket(socket.id);
        if (!game || game.getMasterSocketId() !== socket.id) {
          socket.emit('error', 'Not authorized');
          return;
        }

        if (game.getState().phase !== 'playing') {
          socket.emit('error', 'Cannot reveal results - not in playing phase');
          return;
        }

        const results = game.evaluateRound();
        if (!results) {
          socket.emit('error', 'Cannot evaluate round');
          return;
        }

        game.setPhase('reveal');

        io.to(game.getId()).emit('resultsRevealed', {
          results,
          gameState: game.getState()
        });

        // Check winner BEFORE getting DJ commentary
        const winner = game.checkWinner();
        const isGameFinished = !!winner;

        const currentSong = game.getState().currentSong;
        const musicContext = game.getState().musicPreferences;
        if (currentSong) {
          let audioBuffer: Buffer | null = null;

          if (isGameFinished && winner) {
            // Winner! Generate fresh commentary with winner announcement
            console.log(`Game finished - generating winner commentary for ${winner.name}`);
            const { elevenLabsService } = await import('./elevenlabs');
            audioBuffer = await elevenLabsService.generateDJCommentary(
              currentSong,
              true,
              winner.name,
              game.getId(),
              musicContext
            );
          } else {
            // Use pre-generated commentary from cache
            const cachedPromise = djCommentaryCache.get(game.getId());
            if (cachedPromise) {
              console.log(`Using pre-generated DJ commentary for game ${game.getId()}`);
              audioBuffer = await cachedPromise;
              djCommentaryCache.delete(game.getId());
            } else {
              // Fallback: generate on the fly if cache miss
              console.log(`Cache miss - generating DJ commentary on the fly`);
              const { elevenLabsService } = await import('./elevenlabs');
              audioBuffer = await elevenLabsService.generateDJCommentary(
                currentSong,
                false,
                undefined,
                game.getId(),
                musicContext
              );
            }
          }

          if (audioBuffer) {
            const base64Audio = audioBuffer.toString('base64');
            io.to(game.getId()).emit('djCommentary', base64Audio);
            console.log(`DJ commentary sent for game ${game.getId()}`);
          } else if (!winner) {
            // Fallback for AI-free / no-voice setups: continue automatically without commentary audio.
            scheduleAutoNextRoundFallback(io, game);
          }
        }

        if (winner) {
          scheduleWinnerUpdate(io, game, 4000);
          console.log(`Game ${game.getId()} finished - ${winner.name} won! (delayed winner screen)`);
        }

        console.log(`Results revealed for game ${game.getId()}`);
      } catch (error) {
        console.error('Error revealing results:', error);
        socket.emit('error', 'Failed to reveal results');
      }
    });

    socket.on('nextRound', () => {
      try {
        const game = gameManager.getGameBySocket(socket.id);
        if (!game || game.getMasterSocketId() !== socket.id) {
          socket.emit('error', 'Not authorized');
          return;
        }

        const currentPhase = game.getState().phase;
        if (currentPhase === 'finished') {
          console.log(`Game ${game.getId()} is finished - not starting next round`);
          return;
        }

        if (currentPhase !== 'reveal') {
          socket.emit('error', 'Cannot start next round - not in reveal phase');
          return;
        }

        const nextSong = game.nextRound();

        if (!nextSong) {
          io.to(game.getId()).emit('gameStateUpdate', game.getState());
          console.log(`Game ${game.getId()} finished - no more songs`);
          return;
        }

        io.to(game.getId()).emit('roundStarted', game.getState());
        console.log(`Next round started for game ${game.getId()}`);

        // Pre-generate DJ commentary in background while players place cards
        const currentSong = game.getState().currentSong;
        const musicContext = game.getState().musicPreferences;
        if (currentSong) {
          const commentaryPromise = preGenerateDJCommentary(game.getId(), currentSong, musicContext);
          djCommentaryCache.set(game.getId(), commentaryPromise);
        }
      } catch (error) {
        console.error('Error starting next round:', error);
        socket.emit('error', 'Failed to start next round');
      }
    });

    socket.on('disconnect', () => {
      try {
        const game = gameManager.getGameBySocket(socket.id);
        if (game) {
          const player = game.markPlayerDisconnected(socket.id);

          if (player) {
            // Player disconnected - notify others but keep player in game
            io.to(game.getId()).emit('playerDisconnected', {
              playerId: socket.id,
              playerName: player.name
            });
            io.to(game.getId()).emit('gameStateUpdate', game.getState());
            console.log(`Player ${player.name} disconnected from game ${game.getId()}, can reconnect`);
          } else if (game.getMasterSocketId() === socket.id) {
            // Master disconnected - end game
            io.to(game.getId()).emit('error', 'Game master has disconnected');
            gameManager.removePlayer(socket.id);
            console.log(`Game master ${socket.id} disconnected, game ${game.getId()} ended`);
          }
        }
      } catch (error) {
        console.error('Error handling disconnect:', error);
      }

      console.log(`Client disconnected: ${socket.id}`);
    });
  });
}
