import { useState, useEffect, useRef } from 'react';
import { useParams, useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import Timeline from '@/components/Timeline';
import ScoreDisplay from '@/components/ScoreDisplay';
import WinnerScreen from '@/components/WinnerScreen';
import ProfileSetup from '@/components/ProfileSetup';
import GameHamburgerMenu from '@/components/GameHamburgerMenu';
import BottomBackButton from '@/components/BottomBackButton';
import { useSpotifyPlayer } from '@/hooks/useSpotifyPlayer';
import { useLobbyMusic } from '@/hooks/useLobbyMusic';
import { socketService } from '@/lib/socket';
import type { GameState, Player, RoundResult } from '@/types/game.types';

interface PlayerProfile {
  id: string;
  displayName: string;
  avatarColor: string;
  artistName?: string;
  musicStyle?: string;
  profileImage?: string;
  originalPhoto?: string;
  createdAt: string;
  lastUsedAt: string;
}

export default function PlayerPage() {
  const params = useParams<{ gameCode?: string }>();
  const [, setLocation] = useLocation();
  const [phase, setPhase] = useState<'profile' | 'join' | 'reconnect' | 'lobby' | 'playing'>('profile');
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [playerName, setPlayerName] = useState('');
  const [gameCode, setGameCode] = useState(params.gameCode || '');
  const [selectedPosition, setSelectedPosition] = useState<number | null>(null);
  const [confirmedPlacement, setConfirmedPlacement] = useState(false);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [myPlayer, setMyPlayer] = useState<Player | null>(null);
  const [latestRoundResult, setLatestRoundResult] = useState<RoundResult | null>(null);
  const [savedSession, setSavedSession] = useState<{ gameCode: string; playerName: string; persistentId: string; profileId?: string } | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const spotify = useSpotifyPlayer();
  const lobbyMusic = useLobbyMusic();
  const hasSpotifyTrackId = !!gameState?.currentSong?.id && /^[A-Za-z0-9]{22}$/.test(gameState.currentSong.id);
  const { toast } = useToast();
  const isTryingToPlay = !!(gameState?.phase === 'playing' && hasSpotifyTrackId && spotify.isConnected && spotify.isReady && !spotify.isPlaying);
  const [detectedGameMode, setDetectedGameMode] = useState<'local' | 'online' | null>(null);
  const lastPlayedTrackIdRef = useRef<string | null>(null);
  const scheduledPlaybackRef = useRef<number | null>(null);

  const spotifyStatus = (() => {
    if (!spotify.isConnected) {
      return { label: 'Spotify ej ansluten', dot: 'bg-gray-400', panel: 'bg-black/70 border-white/40' };
    }
    if (spotify.playbackError) {
      return { label: `Ljudfel: ${spotify.playbackError}`, dot: 'bg-red-500', panel: 'bg-red-500/15 border-red-400/70' };
    }
    if (spotify.isPlaying) {
      return { label: 'Musik spelar', dot: 'bg-green-500', panel: 'bg-green-500/15 border-green-400/70' };
    }
    if (isTryingToPlay) {
      return { label: 'Försöker starta musik...', dot: 'bg-yellow-400', panel: 'bg-yellow-400/15 border-yellow-300/70' };
    }
    if (gameState?.phase === 'playing' && !spotify.isReady) {
      return { label: 'Spotify-spelaren är inte redo i denna mobil/webbläsare', dot: 'bg-yellow-400', panel: 'bg-yellow-400/15 border-yellow-300/70' };
    }
    return { label: 'Väntar på nästa låt', dot: 'bg-white/70', panel: 'bg-black/60 border-white/30' };
  })();

  const handleNewGame = () => {
    lobbyMusic.stop();
    socketService.disconnect();
    socketService.clearPlayerSession();
    // Reset all game state to go back to join view
    setGameState(null);
    setMyPlayer(null);
    setGameCode('');
    setSelectedPosition(null);
    setConfirmedPlacement(false);
    setSavedSession(null);
    setIsJoining(false);
    setPhase('join');
  };

  const fetchGameMode = async (code: string): Promise<'local' | 'online' | null> => {
    try {
      const res = await fetch(`/api/games/${code}/meta`);
      if (!res.ok) return null;
      const data = await res.json();
      return data.mode === 'online' ? 'online' : 'local';
    } catch {
      return null;
    }
  };

  const handleProfileReady = async (loadedProfile: PlayerProfile | null) => {
    if (loadedProfile) {
      setProfile(loadedProfile);
      setPlayerName(loadedProfile.displayName);
    }
    // If no profile (guest mode), playerName will be entered manually

    // Check for existing session after profile is loaded
    const session = socketService.getPlayerSession();
    if (session && (!params.gameCode || params.gameCode.toUpperCase() === session.gameCode)) {
      setSavedSession(session);
      setGameCode(session.gameCode);
      setPhase('reconnect');
      return;
    }

    // If QR code was scanned (gameCode in URL) and we have a profile with name, join directly
    const scannedCode = params.gameCode?.toUpperCase();
    if (scannedCode) {
      const mode = await fetchGameMode(scannedCode);
      if (mode) {
        setDetectedGameMode(mode);
      }
    }

    if (scannedCode && loadedProfile?.displayName) {
      const mode = await fetchGameMode(scannedCode);
      setDetectedGameMode(mode);

      if (mode === 'online' && !spotify.isConnected) {
        toast({
          title: 'Spotify krävs',
          description: 'Det här är en online-match. Connect Spotify innan du går med.',
          variant: 'destructive'
        });
        setGameCode(scannedCode);
        setPhase('join');
        return;
      }

      const socket = socketService.connect();
      setupSocketListeners(socket);

      setGameCode(scannedCode);
      socketService.joinGame(
        scannedCode,
        loadedProfile.displayName,
        loadedProfile.id,
        (data) => {
          setMyPlayer(data.player);
          setGameState(data.gameState);
          setPhase('lobby');
        }
      );
    } else if (scannedCode) {
      const mode = await fetchGameMode(scannedCode);
      setDetectedGameMode(mode);
      if (mode === 'online' && !spotify.isConnected) {
        toast({
          title: 'Spotify krävs',
          description: 'Det här är en online-match. Connect Spotify innan du går med.',
          variant: 'destructive'
        });
      }
      setGameCode(scannedCode);
      setPhase('join');
    } else {
      setPhase('join');
    }
  };

  useEffect(() => {
    return () => {
      socketService.disconnect();
    };
  }, []);

  useEffect(() => {
    if (scheduledPlaybackRef.current !== null) {
      window.clearTimeout(scheduledPlaybackRef.current);
      scheduledPlaybackRef.current = null;
    }

    const shouldPauseSpotify =
      !gameState ||
      gameState.phase === 'setup' ||
      gameState.phase === 'lobby' ||
      gameState.phase === 'finished';

    if (shouldPauseSpotify) {
      lastPlayedTrackIdRef.current = null;
      if (spotify.isPlaying) spotify.pausePlayback();
      return;
    }

    if (!gameState.currentSong || !hasSpotifyTrackId) {
      return;
    }

    if (!spotify.isConnected || !spotify.isReady) return;
    if (gameState.phase !== 'playing') return;

    const currentTrackId = gameState.currentSong.id;
    if (lastPlayedTrackIdRef.current === currentTrackId && spotify.isPlaying) return;
    const startAtMs = gameState.playbackStartAtMs ?? Date.now();
    const playDelayMs = Math.max(0, startAtMs - Date.now());

    if (spotify.isPlaying && lastPlayedTrackIdRef.current && lastPlayedTrackIdRef.current !== currentTrackId) {
      spotify.pausePlayback();
    }

    const playCurrentTrack = () => {
      lastPlayedTrackIdRef.current = currentTrackId;
      spotify.playTrack(`spotify:track:${currentTrackId}`);
    };

    if (playDelayMs > 80) {
      scheduledPlaybackRef.current = window.setTimeout(playCurrentTrack, playDelayMs);
    } else {
      playCurrentTrack();
    }
  }, [
    gameState?.phase,
    gameState?.currentSong?.id,
    gameState?.playbackStartAtMs,
    hasSpotifyTrackId,
    spotify.isConnected,
    spotify.isReady,
    spotify.isPlaying
  ]);

  useEffect(() => {
    return () => {
      if (scheduledPlaybackRef.current !== null) {
        window.clearTimeout(scheduledPlaybackRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (gameState?.phase !== 'reveal') {
      setLatestRoundResult(null);
    }
  }, [gameState?.phase, gameState?.roundNumber]);

  useEffect(() => {
    if (phase !== 'join') return;
    const normalizedCode = gameCode.trim().toUpperCase();
    if (normalizedCode.length < 4) {
      setDetectedGameMode(null);
      return;
    }

    let active = true;
    const timer = setTimeout(async () => {
      const mode = await fetchGameMode(normalizedCode);
      if (active) setDetectedGameMode(mode);
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [phase, gameCode]);

  useEffect(() => {
    const isPreGame = phase === 'join' || phase === 'reconnect' || phase === 'lobby';
    const shouldPlayLobbyMusic = isPreGame;

    if (shouldPlayLobbyMusic) {
      if (!lobbyMusic.isPlaying) {
        lobbyMusic.play();
      }
      return;
    }

    lobbyMusic.stop();
  }, [phase, gameState?.phase, lobbyMusic]);

  const setupSocketListeners = (socket: any) => {
    socketService.onGameStateUpdate((newState) => {
      setGameState(newState);
      const player = newState.players.find(p => p.id === socket?.id);
      if (player) {
        setMyPlayer(player);
      }

      if (newState.phase === 'playing' && phase !== 'playing') {
        setPhase('playing');
      }
    });

    socketService.onGameStarted((newState) => {
      setGameState(newState);
      setPhase('playing');
    });

    socketService.onRoundStarted((newState) => {
      setGameState(newState);
      const player = newState.players.find(p => p.id === socket?.id);
      if (player) {
        setMyPlayer(player);
      }
      setSelectedPosition(null);
      setConfirmedPlacement(false);
      setLatestRoundResult(null);
    });

    socketService.onResultsRevealed((data) => {
      setGameState(data.gameState);
      const player = data.gameState.players.find(p => p.id === socket?.id);
      if (player) {
        setMyPlayer(player);
      }
      const myResult = data.results.find(r => r.playerId === socket?.id) || null;
      setLatestRoundResult(myResult);
    });

    socketService.onPlayerDisconnected((data) => {
      toast({
        title: 'Player Disconnected',
        description: `${data.playerName} lost connection`,
        duration: 3000
      });
    });

    socketService.onError((message) => {
      setIsJoining(false); // Reset joining state on error
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive'
      });
    });
  };

  const handleReconnect = async () => {
    if (!savedSession) return;
    const mode = await fetchGameMode(savedSession.gameCode);
    setDetectedGameMode(mode);
    if (mode === 'online' && !spotify.isConnected) {
      toast({
        title: 'Spotify krävs',
        description: 'Det här är en online-match. Connect Spotify innan du går med.',
        variant: 'destructive'
      });
      return;
    }

    const socket = socketService.connect();
    setupSocketListeners(socket);

    socketService.reconnectPlayer(
      savedSession.gameCode,
      savedSession.persistentId,
      savedSession.profileId,
      (data) => {
        setMyPlayer(data.player);
        setGameState(data.gameState);

        if (data.gameState.phase === 'lobby') {
          setPhase('lobby');
        } else if (data.gameState.phase === 'playing') {
          setPhase('playing');
        }

        toast({
          title: 'Reconnected! ✓',
          description: 'You are back in the game',
          duration: 3000
        });
      }
    );
  };

  const handleStartNew = () => {
    lobbyMusic.stop();
    socketService.clearPlayerSession();
    setSavedSession(null);
    setPhase('join');
    // Keep name but clear game code so user can enter new one
    setGameCode('');
  };

  const handleJoin = async () => {
    if (!playerName || !gameCode) return;
    if (isJoining) return; // Prevent double-click
    setIsJoining(true);

    const mode = await fetchGameMode(gameCode.toUpperCase());
    setDetectedGameMode(mode);
    if (mode === 'online' && !spotify.isConnected) {
      setIsJoining(false);
      toast({
        title: 'Spotify krävs',
        description: 'Det här är en online-match. Connect Spotify innan du går med.',
        variant: 'destructive'
      });
      return;
    }

    // If user manually enters different game code, clear old session
    const session = socketService.getPlayerSession();
    if (session && gameCode.toUpperCase() !== session.gameCode) {
      socketService.clearPlayerSession();
    }

    const socket = socketService.connect();
    setupSocketListeners(socket);

    socketService.joinGame(
      gameCode.toUpperCase(),
      playerName,
      profile?.id,
      (data) => {
        setIsJoining(false);
        setMyPlayer(data.player);
        setGameState(data.gameState);
        setPhase('lobby');
      }
    );
  };

  const handlePlaceCard = (position: number) => {
    if (confirmedPlacement) return;
    setSelectedPosition(position);
    socketService.placeCard(position);
    setConfirmedPlacement(true);
  };

  const handleExitGame = () => {
    lobbyMusic.stop();
    spotify.pausePlayback();
    window.dispatchEvent(new Event('hitster-stop-music'));
    socketService.disconnect();
    socketService.clearPlayerSession();
    setLocation('/');
  };

  if (phase === 'profile') {
    return <ProfileSetup onProfileReady={handleProfileReady} onBack={() => setLocation('/')} />;
  }

  if (phase === 'reconnect') {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-4 sm:p-8 pt-20 sm:pt-8 pb-24 relative overflow-hidden bg-cover bg-center"
        style={{ backgroundImage: 'url(/fltman_red_abackground_black_illustrated_speakers_low_angle_pe_3c6fccde-fd77-41bb-a28a-528037b87b37_0.png)' }}
      >
        <div className="absolute inset-0 bg-black/40 z-0"></div>

        <Card className="w-full max-w-md p-10 bg-black border-4 border-white shadow-2xl relative z-30">
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">🔄</div>
            <h1 className="text-4xl font-black mb-3 text-white" style={{ fontFamily: 'Impact, "Arial Black", sans-serif' }}>
              WELCOME BACK!
            </h1>
            <p className="text-white/70 text-lg">We found your last game</p>
          </div>
          <div className="space-y-4">
            <div className="bg-white/10 rounded-2xl p-6 border-2 border-white/20">
              <p className="text-sm text-white/60 mb-1 font-bold">Player</p>
              <p className="text-xl font-bold text-white mb-3">{savedSession?.playerName}</p>
              <p className="text-sm text-white/60 mb-1 font-bold">Game Code</p>
              <p className="text-2xl font-mono font-black text-white">{savedSession?.gameCode}</p>
            </div>
            <Button
              size="lg"
              className="w-full text-xl py-6 bg-red-500 hover:bg-red-600 text-white font-black border-4 border-white"
              onClick={handleReconnect}
              data-testid="button-reconnect"
            >
              Reconnect to Game
            </Button>
            {!spotify.isConnected && (
              <Button
                size="lg"
                className="w-full text-sm sm:text-lg py-4 bg-yellow-400 hover:bg-yellow-300 text-black font-black border-2 border-white whitespace-normal leading-tight"
                onClick={() => {
                  window.location.href = '/auth/spotify';
                }}
              >
                Connect Spotify
              </Button>
            )}
            <Button
              size="lg"
              className="w-full text-lg py-4 bg-white/20 hover:bg-white/30 text-white font-bold border-2 border-white"
              onClick={handleStartNew}
              data-testid="button-start-new"
            >
              Start New Game
            </Button>
          </div>
        </Card>
        <BottomBackButton onBack={handleStartNew} />
      </div>
    );
  }

  if (phase === 'join') {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-8 pb-24 relative overflow-hidden bg-cover bg-center"
        style={{ backgroundImage: 'url(/fltman_red_abackground_black_illustrated_speakers_low_angle_pe_3c6fccde-fd77-41bb-a28a-528037b87b37_0.png)' }}
      >
        <div className="absolute inset-0 bg-black/40 z-0"></div>

        <Card className="w-full max-w-md p-10 bg-black border-4 border-white shadow-2xl relative z-30">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-black mb-3 text-white" style={{ fontFamily: 'Impact, "Arial Black", sans-serif' }}>
              JOIN GAME
            </h1>
            {!profile && (
              <p className="text-white/70 text-lg">Guest Mode</p>
            )}
          </div>
          <div className="space-y-6">
            <div>
              <label className="text-lg mb-2 block text-white font-bold">Your Name</label>
              <Input
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Enter your name"
                className="text-lg bg-white text-black border-2 border-white h-12"
                data-testid="input-player-name"
                disabled={!!profile}
              />
              {profile && (
                <p className="text-sm text-white/60 mt-1">
                  From your saved profile
                </p>
              )}
            </div>
            <div>
              <label className="text-lg mb-2 block text-white font-bold">Game Code</label>
              <Input
                value={gameCode}
                onChange={(e) => setGameCode(e.target.value.toUpperCase())}
                placeholder="Enter game code"
                className="text-lg font-mono bg-white text-black border-2 border-white h-12"
                data-testid="input-game-code"
              />
            </div>
            <Button
              size="lg"
              className="w-full text-xl py-6 bg-red-500 hover:bg-red-600 text-white font-black border-4 border-white"
              onClick={handleJoin}
              disabled={!playerName || !gameCode || isJoining}
              data-testid="button-join"
            >
              {isJoining ? 'Joining...' : 'Join'}
            </Button>
            {!spotify.isConnected && (
              <Button
                size="lg"
                className="w-full text-sm sm:text-lg py-4 bg-yellow-400 hover:bg-yellow-300 text-black font-black border-2 border-white whitespace-normal leading-tight"
                onClick={() => {
                  window.location.href = '/auth/spotify';
                }}
              >
                Connect Spotify
              </Button>
            )}
            {detectedGameMode === 'online' && (
              <p className="text-sm text-yellow-300 font-semibold">
                Denna kod är en online-match och kräver Spotify för att joina.
              </p>
            )}
            {detectedGameMode === 'local' && (
              <p className="text-sm text-white/70 font-semibold">
                Denna kod är en local-match. Spotify krävs inte för att joina.
              </p>
            )}
          </div>
        </Card>
        <BottomBackButton onBack={() => setLocation('/')} />
      </div>
    );
  }

  if (phase === 'lobby' || !myPlayer) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-8 pb-24 relative overflow-hidden bg-cover bg-center"
        style={{ backgroundImage: 'url(/fltman_red_abackground_black_illustrated_speakers_low_angle_pe_3c6fccde-fd77-41bb-a28a-528037b87b37_0.png)' }}
      >
        <div className="absolute inset-0 bg-black/40 z-0"></div>
        <GameHamburgerMenu
          spotifyConnected={spotify.isConnected}
          spotifyStatusLabel={spotifyStatus.label}
          onConnectSpotify={() => {
            window.location.href = '/auth/spotify';
          }}
          onExitGame={handleExitGame}
        />

        <Card className="w-full max-w-md p-6 sm:p-10 bg-black border-4 border-white shadow-2xl relative z-30 text-center">
          <div className="mb-6">
            {profile?.profileImage ? (
              <img
                src={profile.profileImage}
                alt={playerName}
                className="w-24 h-24 sm:w-28 sm:h-28 rounded-full object-cover border-4 border-white mx-auto mb-4"
              />
            ) : (
              <div
                className="w-24 h-24 sm:w-28 sm:h-28 rounded-full border-4 border-white mx-auto mb-4 flex items-center justify-center text-5xl font-black"
                style={{ backgroundColor: profile?.avatarColor || '#8B5CF6' }}
              >
                {playerName?.[0]?.toUpperCase() || '?'}
              </div>
            )}
            <h1 className="text-4xl font-black mb-4 text-white" style={{ fontFamily: 'Impact, "Arial Black", sans-serif' }}>
              WELCOME, {playerName.toUpperCase()}!
            </h1>
            <p className="text-xl text-white/70">Waiting for game to start...</p>
          </div>
        </Card>
        <BottomBackButton onBack={handleExitGame} />
      </div>
    );
  }

  if (gameState?.phase === 'finished' && gameState.winner) {
    return (
      <WinnerScreen
        winner={gameState.winner}
        allPlayers={gameState.players}
        onNewGame={handleNewGame}
      />
    );
  }

  return (
    <div
      className="min-h-screen pb-80 relative overflow-hidden bg-cover bg-center"
      style={{ backgroundImage: 'url(/fltman_red_abackground_black_illustrated_speakers_low_angle_pe_3c6fccde-fd77-41bb-a28a-528037b87b37_0.png)' }}
    >
      <div className="absolute inset-0 bg-black/40 z-0"></div>

      <GameHamburgerMenu
        spotifyConnected={spotify.isConnected}
        spotifyStatusLabel={spotifyStatus.label}
        onConnectSpotify={() => {
          window.location.href = '/auth/spotify';
        }}
        onExitGame={handleExitGame}
      />

      <div className="pt-24 px-6 pb-6 relative z-10">
        <ScoreDisplay
          score={myPlayer.score}
          profileImage={myPlayer.profileImage}
          playerName={myPlayer.name}
          avatarColor={myPlayer.avatarColor}
        />
      </div>

      <div className="relative z-10">
        <Timeline
          timeline={myPlayer.timeline}
          startYear={myPlayer.startYear}
          highlightPosition={selectedPosition ?? undefined}
          confirmedPosition={confirmedPlacement ? selectedPosition ?? undefined : undefined}
          onPlaceCard={confirmedPlacement ? undefined : handlePlaceCard}
        />
      </div>

      {gameState?.phase === 'reveal' && gameState.currentSong && latestRoundResult && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-6">
          <Card
            className={`w-full max-w-lg p-6 border-4 shadow-2xl ${
              latestRoundResult.correct ? 'border-green-500 bg-green-500/10' : 'border-red-500 bg-red-500/10'
            }`}
          >
            {gameState.currentSong.albumCover && (
              <div className="w-full max-w-md mx-auto aspect-square mb-4">
                <img
                  src={gameState.currentSong.albumCover}
                  alt={gameState.currentSong.title}
                  className="w-full h-full object-cover rounded-2xl border-4 border-white"
                />
              </div>
            )}
            <div className="mb-3">
              <span
                className={`inline-block text-xl font-black px-4 py-2 rounded-lg border-2 border-white ${
                  latestRoundResult.correct ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                }`}
              >
                {latestRoundResult.correct ? 'RÄTT! +1 POÄNG' : 'FEL'}
              </span>
            </div>
            <p className="text-5xl font-mono font-black text-white mb-2">{gameState.currentSong.year}</p>
            <h3 className="text-4xl font-black text-white leading-tight mb-1">{gameState.currentSong.title}</h3>
            <p className="text-2xl text-white/80">{gameState.currentSong.artist}</p>
          </Card>
        </div>
      )}
    </div>
  );
}
