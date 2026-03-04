import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { useLobbyMusic } from '@/hooks/useLobbyMusic';
import AIChat from '@/components/AIChat';
import QRCodeDisplay from '@/components/QRCodeDisplay';
import GameControl from '@/components/GameControl';
import WinnerScreen from '@/components/WinnerScreen';
import BottomBackButton from '@/components/BottomBackButton';
import { socketService } from '@/lib/socket';
import type { GameState, RoundResult } from '@/types/game.types';

export default function MasterPage() {
  const [, setLocation] = useLocation();
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [results, setResults] = useState<RoundResult[]>([]);
  const [preferences, setPreferences] = useState('');
  const [spotifyConnected, setSpotifyConnected] = useState(false);
  const [isDJPlaying, setIsDJPlaying] = useState(false);
  const { toast } = useToast();
  const gameStateRef = useRef<GameState | null>(null);
  const lobbyMusic = useLobbyMusic();

  const handleNewGame = () => {
    window.dispatchEvent(new Event('hitster-stop-music'));
    lobbyMusic.stop();
    // Disconnect current socket and navigate without reload to keep fullscreen
    socketService.disconnect();
    setLocation('/');
  };

  const handleExitGame = () => {
    window.dispatchEvent(new Event('hitster-stop-music'));
    lobbyMusic.stop();
    socketService.disconnect();
    setLocation('/');
  };

  // Keep ref in sync with state
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Manage lobby music - start when in setup/lobby, stop when game starts
  useEffect(() => {
    if (gameState?.phase === 'setup' || gameState?.phase === 'lobby') {
      if (!lobbyMusic.isPlaying) {
        lobbyMusic.play();
      }
    } else if (gameState?.phase === 'playing') {
      lobbyMusic.stop();
    }
  }, [gameState?.phase]);

  useEffect(() => {
    fetch('/api/spotify/status')
      .then(res => res.json())
      .then(data => setSpotifyConnected(data.connected))
      .catch(console.error);

    const socket = socketService.connect();

    socketService.createGame((data) => {
      setGameState(data.gameState);
    }, 'local');

    socketService.onGameStateUpdate((newState) => {
      setGameState(newState);
    });

    socketService.onGameStarted((newState) => {
      setGameState(newState);
    });

    socketService.onResultsRevealed((data) => {
      setResults(data.results);
      setGameState(data.gameState);
    });

    socketService.onPlayerDisconnected((data) => {
      toast({
        title: 'Player Disconnected',
        description: `${data.playerName} lost connection and can reconnect`,
        duration: 5000
      });
    });

    socketService.onDJCommentary((base64Audio) => {
      console.log('DJ commentary received, playing...');
      setIsDJPlaying(true);
      
      const audioBlob = new Blob(
        [Uint8Array.from(atob(base64Audio), c => c.charCodeAt(0))],
        { type: 'audio/mpeg' }
      );
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      
      audio.onended = () => {
        console.log('DJ commentary finished, checking if we should continue...');
        setIsDJPlaying(false);
        URL.revokeObjectURL(audioUrl);
        
        // Vänta lite och kolla om spelet är finished innan vi går vidare
        setTimeout(() => {
          const currentState = gameStateRef.current;
          if (currentState && currentState.phase !== 'finished') {
            console.log('Auto-starting next round...');
            socketService.nextRound();
          } else {
            console.log('Game finished - not starting next round');
          }
        }, 4000);
      };
      
      audio.onerror = (e) => {
        console.error('DJ audio error:', e);
        setIsDJPlaying(false);
        URL.revokeObjectURL(audioUrl);
      };
      
      audio.play().catch(err => {
        console.error('Failed to play DJ audio:', err);
        setIsDJPlaying(false);
        URL.revokeObjectURL(audioUrl);
      });
    });

    socketService.onRoundStarted((newState) => {
      setGameState(newState);
      setResults([]);
    });

    socketService.onError((message) => {
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive'
      });
    });

    return () => {
      socketService.disconnect();
    };
  }, [toast]);

  const handleAIChatConfirm = (pref: string) => {
    const payload = pref && pref.trim().length > 0
      ? pref
      : JSON.stringify({
          mode: 'filters',
          catalog: 'all',
          genre: 'mixed',
          era: 'all',
          knownHitsOnly: false,
          yearFrom: 1950,
          yearTo: 2024
        });

    setPreferences(payload);

    socketService.confirmPreferences(payload, (data) => {
      setGameState(data.gameState);
    });
  };

  const handleStartGame = () => {
    socketService.startGame();
  };

  const handleConnectSpotify = () => {
    window.location.href = '/auth/spotify';
  };

  const handleRevealResults = () => {
    socketService.revealResults();
  };

  const handleNextRound = () => {
    if (gameState?.phase === 'playing') {
      handleRevealResults();
    } else if (gameState?.phase === 'reveal') {
      socketService.nextRound();
    }
  };

  if (!gameState) {
    return (
      <div
        className="min-h-screen flex items-center justify-center relative overflow-hidden bg-cover bg-center"
        style={{ backgroundImage: 'url(/fltman_red_abackground_black_illustrated_speakers_low_angle_pe_3c6fccde-fd77-41bb-a28a-528037b87b37_0.png)' }}
      >
        <div className="absolute inset-0 bg-black/40"></div>
        <div className="absolute top-12 left-12 z-20">
        </div>
        <p className="text-3xl text-white font-black relative z-10">Creating game...</p>
      </div>
    );
  }

  if (gameState.phase === 'setup') {
    if (!spotifyConnected) {
      return (
        <div
          className="min-h-screen flex items-center justify-center p-8 pb-24 relative overflow-hidden bg-cover bg-center"
          style={{ backgroundImage: 'url(/fltman_red_abackground_black_illustrated_speakers_low_angle_pe_3c6fccde-fd77-41bb-a28a-528037b87b37_0.png)' }}
        >
          <div className="absolute inset-0 bg-black/50 z-0"></div>
          <div className="relative z-30 bg-black border-4 border-white shadow-2xl p-10 max-w-xl w-full text-center">
            <h2 className="text-4xl font-black text-white mb-4" style={{ fontFamily: 'Impact, \"Arial Black\", sans-serif' }}>
              Connect Spotify First
            </h2>
            <p className="text-white/80 text-lg mb-8">
              Du måste koppla Spotify innan du kan starta en ny match.
            </p>
            <button
              onClick={handleConnectSpotify}
              className="w-full text-2xl py-6 bg-yellow-400 hover:bg-yellow-300 text-black font-black border-4 border-white shadow-xl"
            >
              Connect Spotify
            </button>
          </div>
          <BottomBackButton onBack={handleExitGame} />
        </div>
      );
    }
    return (
      <div className="relative">
        <AIChat onPreferencesConfirmed={handleAIChatConfirm} onBack={handleExitGame} />
        <button
          onClick={handleExitGame}
          className="fixed top-8 right-8 z-50 px-5 py-3 bg-black/80 hover:bg-black text-white border-2 border-white font-bold"
        >
          Avsluta spelet
        </button>
      </div>
    );
  }

  if (gameState.phase === 'lobby') {
    return (
      <div className="relative">
        <QRCodeDisplay
          gameCode={gameState.id}
          playerCount={gameState.players.length}
          players={gameState.players}
          onStartGame={handleStartGame}
          onBack={handleExitGame}
        />
        <button
          onClick={handleExitGame}
          className="fixed top-8 right-8 z-50 px-5 py-3 bg-black/80 hover:bg-black text-white border-2 border-white font-bold"
        >
          Avsluta spelet
        </button>
      </div>
    );
  }

  if (gameState.phase === 'finished' && gameState.winner) {
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
      className="min-h-screen p-8 relative overflow-hidden bg-cover bg-center"
      style={{ backgroundImage: 'url(/fltman_red_abackground_black_illustrated_speakers_low_angle_pe_3c6fccde-fd77-41bb-a28a-528037b87b37_0.png)' }}
    >
      <div className="absolute inset-0 bg-black/40 z-0"></div>

      <div className="absolute top-8 right-8 z-50">
        <button
          onClick={handleExitGame}
          className="px-5 py-3 bg-black/80 hover:bg-black text-white border-2 border-white font-bold"
        >
          Avsluta spelet
        </button>
      </div>

      <div className="max-w-7xl mx-auto relative z-30">
        <div className="mb-6 text-center">
          <p className="text-white text-xl">
            Game Code: <span className="font-mono font-black text-2xl">{gameState.id}</span>
          </p>
        </div>

        <GameControl
          currentSong={gameState.currentSong}
          playbackStartAtMs={gameState.playbackStartAtMs}
          roundNumber={gameState.roundNumber}
          players={gameState.players}
          phase={gameState.phase}
          onNextRound={handleNextRound}
          spotifyConnected={spotifyConnected}
          isDJPlaying={isDJPlaying}
          results={results}
        />

      </div>
    </div>
  );
}
