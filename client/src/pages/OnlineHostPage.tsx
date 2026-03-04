import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import AIChat from "@/components/AIChat";
import QRCodeDisplay from "@/components/QRCodeDisplay";
import ProfileSetup from "@/components/ProfileSetup";
import Timeline from "@/components/Timeline";
import ScoreDisplay from "@/components/ScoreDisplay";
import WinnerScreen from "@/components/WinnerScreen";
import GameHamburgerMenu from "@/components/GameHamburgerMenu";
import BottomBackButton from "@/components/BottomBackButton";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useSpotifyPlayer } from "@/hooks/useSpotifyPlayer";
import { useLobbyMusic } from "@/hooks/useLobbyMusic";
import { socketService } from "@/lib/socket";
import type { GameState, Player, RoundResult } from "@/types/game.types";

interface PlayerProfile {
  id: string;
  displayName: string;
  avatarColor: string;
  profileImage?: string;
}

export default function OnlineHostPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [gameCode, setGameCode] = useState("");
  const [myPlayer, setMyPlayer] = useState<Player | null>(null);
  const [hostJoinedAsPlayer, setHostJoinedAsPlayer] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<number | null>(null);
  const [confirmedPlacement, setConfirmedPlacement] = useState(false);
  const [latestRoundResult, setLatestRoundResult] = useState<RoundResult | null>(null);
  const spotify = useSpotifyPlayer();
  const lobbyMusic = useLobbyMusic();
  const hasSpotifyTrackId = !!gameState?.currentSong?.id && /^[A-Za-z0-9]{22}$/.test(gameState.currentSong.id);
  const isTryingToPlay = !!(gameState?.phase === "playing" && hasSpotifyTrackId && spotify.isConnected && spotify.isReady && !spotify.isPlaying);
  const lastPlayedTrackIdRef = useRef<string | null>(null);
  const scheduledPlaybackRef = useRef<number | null>(null);

  const spotifyStatus = (() => {
    if (!spotify.isConnected) {
      return { label: "Spotify ej ansluten", dot: "bg-gray-400", panel: "bg-black/70 border-white/40" };
    }
    if (spotify.playbackError) {
      return { label: `Ljudfel: ${spotify.playbackError}`, dot: "bg-red-500", panel: "bg-red-500/15 border-red-400/70" };
    }
    if (spotify.isPlaying) {
      return { label: "Musik spelar", dot: "bg-green-500", panel: "bg-green-500/15 border-green-400/70" };
    }
    if (isTryingToPlay) {
      return { label: "Försöker starta musik...", dot: "bg-yellow-400", panel: "bg-yellow-400/15 border-yellow-300/70" };
    }
    if (gameState?.phase === "playing" && !spotify.isReady) {
      return { label: "Spotify-spelaren är inte redo i denna mobil/webbläsare", dot: "bg-yellow-400", panel: "bg-yellow-400/15 border-yellow-300/70" };
    }
    return { label: "Väntar på nästa låt", dot: "bg-white/70", panel: "bg-black/60 border-white/30" };
  })();

  const joinUrl = useMemo(() => (
    gameCode ? `${window.location.origin}/join/${gameCode}` : ""
  ), [gameCode]);

  const updateMyPlayer = (state: GameState) => {
    const socketId = socketService.getSocket()?.id;
    const bySocket = socketId ? state.players.find((p) => p.id === socketId) : undefined;
    const byProfile = profile?.id ? state.players.find((p) => p.profileId === profile.id) : undefined;
    setMyPlayer(bySocket || byProfile || null);
  };

  useEffect(() => {
    if (!profile || !spotify.isConnected) return;

    const socket = socketService.connect();
    const onGameState = (state: GameState) => {
      setGameState(state);
      updateMyPlayer(state);
    };
    const onRoundStarted = (state: GameState) => {
      setGameState(state);
      updateMyPlayer(state);
      setSelectedPosition(null);
      setConfirmedPlacement(false);
      setLatestRoundResult(null);
    };
    const onResults = (data: { results: RoundResult[]; gameState: GameState }) => {
      setGameState(data.gameState);
      updateMyPlayer(data.gameState);
      const socketId = socketService.getSocket()?.id;
      const myResult = data.results.find((r) => r.playerId === socketId) || null;
      setLatestRoundResult(myResult);
    };

    socketService.onGameStateUpdate(onGameState);
    socketService.onGameStarted(onGameState);
    socketService.onRoundStarted(onRoundStarted);
    socketService.onResultsRevealed(onResults);
    socketService.onError((message) => {
      toast({
        title: "Error",
        description: message,
        variant: "destructive"
      });
    });

    socketService.createGame(({ gameId, gameState: createdState }) => {
      setGameCode(gameId);
      setGameState(createdState);
      socketService.joinGame(
        gameId,
        profile.displayName,
        profile.id,
        (data) => {
          setHostJoinedAsPlayer(true);
          setMyPlayer(data.player);
          setGameState(data.gameState);
        }
      );
    }, "online");

    return () => {
      socketService.disconnect();
    };
  }, [profile, spotify.isConnected, toast]);

  useEffect(() => {
    if (scheduledPlaybackRef.current !== null) {
      window.clearTimeout(scheduledPlaybackRef.current);
      scheduledPlaybackRef.current = null;
    }

    const shouldPauseSpotify =
      !gameState ||
      gameState.phase === "setup" ||
      gameState.phase === "lobby" ||
      gameState.phase === "finished";

    if (shouldPauseSpotify) {
      lastPlayedTrackIdRef.current = null;
      if (spotify.isPlaying) spotify.pausePlayback();
      return;
    }

    if (!gameState.currentSong || !hasSpotifyTrackId) {
      return;
    }

    if (!spotify.isConnected || !spotify.isReady) return;
    if (gameState.phase !== "playing") return;

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
    if (gameState?.phase !== "reveal") {
      setLatestRoundResult(null);
    }
  }, [gameState?.phase, gameState?.roundNumber]);

  useEffect(() => {
    const shouldPlayLobbyMusic = gameState?.phase === "setup" || gameState?.phase === "lobby";

    if (shouldPlayLobbyMusic) {
      if (!lobbyMusic.isPlaying) {
        lobbyMusic.play();
      }
      return;
    }

    lobbyMusic.stop();
  }, [gameState?.phase, lobbyMusic]);

  const handleProfileReady = (loadedProfile: PlayerProfile | null) => {
    if (!loadedProfile?.displayName) {
      toast({
        title: "Profil krävs",
        description: "Online-läge kräver namn och foto för värden.",
        variant: "destructive"
      });
      return;
    }
    setProfile(loadedProfile);
  };

  const handleConfirmPreferences = (preferences: string) => {
    socketService.confirmPreferences(preferences, ({ gameState: updatedState }) => {
      setGameState(updatedState);
      updateMyPlayer(updatedState);
    });
  };

  const handleStartGame = () => {
    if (!spotify.isConnected) {
      toast({
        title: "Spotify krävs",
        description: "Connect Spotify innan du startar en online-match.",
        variant: "destructive"
      });
      return;
    }
    socketService.startGame();
  };

  const handlePlaceCard = (position: number) => {
    if (confirmedPlacement) return;
    setSelectedPosition(position);
    socketService.placeCard(position);
    setConfirmedPlacement(true);
  };

  const handleInvitePlayers = async () => {
    if (!joinUrl) return;
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Join my BeatBrawl game",
          text: `Join with code ${gameCode}`,
          url: joinUrl
        });
      } else {
        await navigator.clipboard.writeText(joinUrl);
        toast({
          title: "Länk kopierad",
          description: "Dela länken med spelarna."
        });
      }
    } catch {
      // User-cancel from share sheet shouldn't crash or show errors.
    }
  };

  const handleNewGame = () => {
    lobbyMusic.stop();
    socketService.disconnect();
    setLocation("/");
  };

  const handleExitGame = () => {
    lobbyMusic.stop();
    spotify.pausePlayback();
    window.dispatchEvent(new Event('hitster-stop-music'));
    socketService.disconnect();
    setLocation("/");
  };

  if (!profile) {
    return <ProfileSetup onProfileReady={handleProfileReady} onBack={() => setLocation('/')} />;
  }

  if (!spotify.isConnected) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-4 sm:p-8 pt-20 sm:pt-8 pb-24 relative overflow-hidden bg-cover bg-center"
        style={{ backgroundImage: "url(/fltman_red_abackground_black_illustrated_speakers_low_angle_pe_3c6fccde-fd77-41bb-a28a-528037b87b37_0.png)" }}
      >
        <div className="absolute inset-0 bg-black/40 z-0"></div>
        <Card className="w-full max-w-md p-8 bg-black border-4 border-white shadow-2xl relative z-30 text-center">
          <h1 className="text-4xl font-black mb-3 text-white" style={{ fontFamily: 'Impact, "Arial Black", sans-serif' }}>
            CONNECT SPOTIFY
          </h1>
          <p className="text-white/70 text-lg mb-6">
            Du måste ansluta Spotify innan du kan starta en online-match.
          </p>
          <Button
            size="lg"
            className="w-full text-xl py-6 bg-yellow-400 hover:bg-yellow-300 text-black font-black border-4 border-white"
            onClick={() => {
              window.location.href = "/auth/spotify";
            }}
          >
            Connect Spotify först
          </Button>
        </Card>
        <BottomBackButton onBack={() => setLocation('/')} />
      </div>
    );
  }

  if (!gameState || !hostJoinedAsPlayer) {
    return (
      <div
        className="min-h-screen flex items-center justify-center pb-24 relative overflow-hidden bg-cover bg-center"
        style={{ backgroundImage: "url(/fltman_red_abackground_black_illustrated_speakers_low_angle_pe_3c6fccde-fd77-41bb-a28a-528037b87b37_0.png)" }}
      >
        <div className="absolute inset-0 bg-black/40 z-0"></div>
        <p className="text-3xl text-white font-black relative z-10">Creating online game...</p>
        <BottomBackButton onBack={handleExitGame} />
      </div>
    );
  }

  if (gameState.phase === "setup") {
    return <AIChat onPreferencesConfirmed={handleConfirmPreferences} onBack={handleExitGame} />;
  }

  if (gameState.phase === "lobby") {
    return (
      <div className="relative">
        <GameHamburgerMenu
          spotifyConnected={spotify.isConnected}
          spotifyStatusLabel={spotifyStatus.label}
          onConnectSpotify={() => {
            window.location.href = "/auth/spotify";
          }}
          onInvitePlayers={handleInvitePlayers}
          onExitGame={handleExitGame}
        />
        <QRCodeDisplay
          gameCode={gameState.id}
          playerCount={gameState.players.length}
          players={gameState.players}
          onStartGame={handleStartGame}
          onBack={handleExitGame}
        />
      </div>
    );
  }

  if (gameState.phase === "finished" && gameState.winner) {
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
      style={{ backgroundImage: "url(/fltman_red_abackground_black_illustrated_speakers_low_angle_pe_3c6fccde-fd77-41bb-a28a-528037b87b37_0.png)" }}
    >
      <div className="absolute inset-0 bg-black/40 z-0"></div>

      <GameHamburgerMenu
        spotifyConnected={spotify.isConnected}
        spotifyStatusLabel={spotifyStatus.label}
        onConnectSpotify={() => {
          window.location.href = "/auth/spotify";
        }}
        onInvitePlayers={handleInvitePlayers}
        onExitGame={handleExitGame}
      />

      <div className="pt-24 px-6 pb-6 relative z-10">
        <ScoreDisplay
          score={myPlayer?.score || 0}
          profileImage={myPlayer?.profileImage}
          playerName={myPlayer?.name || profile.displayName}
          avatarColor={myPlayer?.avatarColor}
        />
      </div>

      <div className="relative z-10">
        <Timeline
          timeline={myPlayer?.timeline || []}
          startYear={myPlayer?.startYear || 2000}
          highlightPosition={selectedPosition ?? undefined}
          confirmedPosition={confirmedPlacement ? selectedPosition ?? undefined : undefined}
          onPlaceCard={confirmedPlacement ? undefined : handlePlaceCard}
        />
      </div>

      {gameState.phase === "reveal" && gameState.currentSong && latestRoundResult && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-6">
          <Card
            className={`w-full max-w-lg p-6 border-4 shadow-2xl ${
              latestRoundResult.correct ? "border-green-500 bg-green-500/10" : "border-red-500 bg-red-500/10"
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
                  latestRoundResult.correct ? "bg-green-500 text-white" : "bg-red-500 text-white"
                }`}
              >
                {latestRoundResult.correct ? "RÄTT! +1 POÄNG" : "FEL"}
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
