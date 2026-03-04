import { useState, useEffect } from "react";
import { Music, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface HomeProps {
  onSelectMasterLocal?: () => void;
  onSelectMasterOnline?: () => void;
  onSelectPlayer?: () => void;
}

export default function Home({ onSelectMasterLocal, onSelectMasterOnline, onSelectPlayer }: HomeProps) {
  const [spotifyConnected, setSpotifyConnected] = useState(false);
  const [isCheckingSpotify, setIsCheckingSpotify] = useState(true);
  const [isConnectingSpotify, setIsConnectingSpotify] = useState(false);
  const [isDisconnectingSpotify, setIsDisconnectingSpotify] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetch('/api/spotify/status')
      .then(res => res.json())
      .then(data => {
        setSpotifyConnected(data.connected);
        setIsCheckingSpotify(false);
      })
      .catch(() => {
        setIsCheckingSpotify(false);
      });
  }, []);

  const handleConnectSpotify = () => {
    setIsConnectingSpotify(true);
    window.location.href = '/auth/spotify';
  };

  const handleDisconnectSpotify = async () => {
    if (isDisconnectingSpotify) return;
    setIsDisconnectingSpotify(true);
    try {
      const res = await fetch('/api/spotify/disconnect', { method: 'POST' });
      if (!res.ok) {
        throw new Error('disconnect_failed');
      }
      setSpotifyConnected(false);
      toast({
        title: 'Spotify frånkopplat',
        description: 'Du har loggats ut från Spotify i appen.'
      });
    } catch {
      toast({
        title: 'Kunde inte logga ut',
        description: 'Försök igen.',
        variant: 'destructive'
      });
    } finally {
      setIsDisconnectingSpotify(false);
    }
  };

  const handleSelectMasterLocal = async () => {
    if (!spotifyConnected) return;
    if (onSelectMasterLocal) {
      // Request fullscreen mode for immersive experience
      try {
        await document.documentElement.requestFullscreen();
      } catch (err) {
        console.log('Fullscreen not supported or denied:', err);
      }
      onSelectMasterLocal();
    }
  };

  const handleSelectMasterOnline = async () => {
    if (!spotifyConnected) return;
    if (onSelectMasterOnline) {
      try {
        await document.documentElement.requestFullscreen();
      } catch (err) {
        console.log('Fullscreen not supported or denied:', err);
      }
      onSelectMasterOnline();
    }
  };

  return (
    <div
      className="min-h-screen flex items-start justify-start p-4 sm:p-8 relative overflow-hidden bg-cover bg-center"
      style={{ backgroundImage: 'url(/fltman_red_abackground_black_illustrated_speakers_low_angle_pe_3c6fccde-fd77-41bb-a28a-528037b87b37_0.png)' }}
    >
      <div className="absolute inset-0 bg-black/40"></div>

      {/* BeatBrawl Logo - Upper Left - Extra Large */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 sm:left-12 sm:translate-x-0 sm:top-12 z-20">
        <img
          src="/beatbrawl.png"
          alt="BeatBrawl Logo"
          className="h-32 sm:h-48 w-auto"
          data-testid="img-logo"
        />
      </div>

      {/* Spotify Button - Upper Right - Much Smaller */}
      <div className="absolute top-4 right-4 sm:top-8 sm:right-8 z-20">
        {!isCheckingSpotify && !spotifyConnected && (
          <Button
            onClick={handleConnectSpotify}
            disabled={isConnectingSpotify}
            className="gap-2 text-xs px-3 py-2 bg-black/80 hover:bg-black text-white font-medium shadow-lg border border-green-500 animate-pulse-glow"
            data-testid="button-connect-spotify-home"
          >
            {isConnectingSpotify ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Music className="w-3 h-3 text-green-500" />
            )}
            Connect Spotify
          </Button>
        )}

        {!isCheckingSpotify && spotifyConnected && (
          <div className="flex flex-col items-end gap-2">
            <Button
              onClick={handleDisconnectSpotify}
              disabled={isDisconnectingSpotify}
              className="text-xs px-3 py-2 bg-black/85 hover:bg-black text-white font-semibold border border-white"
            >
              {isDisconnectingSpotify ? 'Loggar ut...' : 'Logga ut'}
            </Button>
            <p className="max-w-[260px] text-right text-[11px] leading-tight text-white/80 bg-black/55 px-2 py-1 rounded border border-white/20">
              Varning: om flera enheter kör samma Spotify-konto kan uppspelning stoppa varandra i online-läge.
            </p>
          </div>
        )}
      </div>

      {/* Main buttons */}
      <div className="absolute left-6 right-6 sm:left-12 sm:right-auto top-[34%] sm:top-1/2 sm:-translate-y-1/2 z-10 flex flex-col gap-5 sm:gap-6">
        {/* START LOCAL Button */}
        <button
          className={`relative w-full sm:w-auto text-3xl sm:text-4xl py-8 sm:py-10 px-8 sm:px-16 font-black uppercase tracking-wider transition-all duration-200 ${
            spotifyConnected
              ? 'cursor-pointer hover:scale-105 hover:-translate-y-1'
              : 'opacity-40 cursor-not-allowed'
          }`}
          style={{
            fontFamily: 'Impact, "Arial Black", sans-serif',
            transform: 'skewX(-3deg)',
            background: '#8b2d2d',
            color: '#f5f5f5',
            border: '4px solid #1a1a1a',
            boxShadow: `
              inset 2px 2px 0 rgba(255,255,255,0.1),
              inset -2px -2px 0 rgba(0,0,0,0.3),
              6px 6px 0 #1a1a1a
            `,
          }}
          onClick={handleSelectMasterLocal}
          disabled={!spotifyConnected}
          data-testid="button-start-master-local"
        >
          {/* Corner scratches */}
          <span className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-black/40" style={{ transform: 'rotate(-5deg)' }}></span>
          <span className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-black/40" style={{ transform: 'rotate(5deg)' }}></span>
          <span className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-black/40" style={{ transform: 'rotate(5deg)' }}></span>
          <span className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-black/40" style={{ transform: 'rotate(-5deg)' }}></span>
          {/* Scratch lines */}
          <span className="absolute top-3 left-6 w-3 h-px bg-black/30" style={{ transform: 'rotate(-25deg)' }}></span>
          <span className="absolute top-4 right-6 w-3 h-px bg-black/30" style={{ transform: 'rotate(20deg)' }}></span>
          <span className="absolute bottom-4 left-8 w-2 h-px bg-black/30" style={{ transform: 'rotate(15deg)' }}></span>
          <span className="absolute bottom-3 right-8 w-2 h-px bg-black/30" style={{ transform: 'rotate(-20deg)' }}></span>
          <span style={{ transform: 'skewX(3deg)', display: 'block' }}>Start Local</span>
        </button>

        {/* START ONLINE Button */}
        <button
          className={`relative w-full sm:w-auto text-3xl sm:text-4xl py-8 sm:py-10 px-8 sm:px-16 font-black uppercase tracking-wider transition-all duration-200 ${
            spotifyConnected
              ? 'cursor-pointer hover:scale-105 hover:-translate-y-1'
              : 'opacity-40 cursor-not-allowed'
          }`}
          style={{
            fontFamily: 'Impact, "Arial Black", sans-serif',
            transform: 'skewX(-3deg)',
            background: '#14532d',
            color: '#f5f5f5',
            border: '4px solid #1a1a1a',
            boxShadow: `
              inset 2px 2px 0 rgba(255,255,255,0.1),
              inset -2px -2px 0 rgba(0,0,0,0.3),
              6px 6px 0 #1a1a1a
            `,
          }}
          onClick={handleSelectMasterOnline}
          disabled={!spotifyConnected}
          data-testid="button-start-master-online"
        >
          {/* Corner scratches */}
          <span className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-black/40" style={{ transform: 'rotate(-5deg)' }}></span>
          <span className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-black/40" style={{ transform: 'rotate(5deg)' }}></span>
          <span className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-black/40" style={{ transform: 'rotate(5deg)' }}></span>
          <span className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-black/40" style={{ transform: 'rotate(-5deg)' }}></span>
          {/* Scratch lines */}
          <span className="absolute top-3 left-6 w-3 h-px bg-black/30" style={{ transform: 'rotate(-25deg)' }}></span>
          <span className="absolute top-4 right-6 w-3 h-px bg-black/30" style={{ transform: 'rotate(20deg)' }}></span>
          <span className="absolute bottom-4 left-8 w-2 h-px bg-black/30" style={{ transform: 'rotate(15deg)' }}></span>
          <span className="absolute bottom-3 right-8 w-2 h-px bg-black/30" style={{ transform: 'rotate(-20deg)' }}></span>
          <span style={{ transform: 'skewX(3deg)', display: 'block' }}>Start Online</span>
        </button>

        {/* JOIN GAME Button - Orange with street aesthetic */}
        <button
          className="relative w-full sm:w-auto text-3xl sm:text-4xl py-8 sm:py-10 px-8 sm:px-16 font-black uppercase tracking-wider transition-all duration-200 cursor-pointer hover:scale-105 hover:-translate-y-1"
          style={{
            fontFamily: 'Impact, "Arial Black", sans-serif',
            transform: 'skewX(-3deg)',
            background: '#d97706',
            color: 'white',
            border: '4px solid #1a1a1a',
            boxShadow: `
              inset 2px 2px 0 rgba(255,255,255,0.15),
              inset -2px -2px 0 rgba(0,0,0,0.2),
              6px 6px 0 #1a1a1a
            `,
          }}
          onClick={onSelectPlayer}
          data-testid="button-join-player"
        >
          {/* Corner scratches */}
          <span className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-black/30" style={{ transform: 'rotate(-5deg)' }}></span>
          <span className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-black/30" style={{ transform: 'rotate(5deg)' }}></span>
          <span className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-black/30" style={{ transform: 'rotate(5deg)' }}></span>
          <span className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-black/30" style={{ transform: 'rotate(-5deg)' }}></span>
          {/* Scratch lines */}
          <span className="absolute top-3 left-6 w-3 h-px bg-black/25" style={{ transform: 'rotate(-25deg)' }}></span>
          <span className="absolute top-4 right-6 w-3 h-px bg-black/25" style={{ transform: 'rotate(20deg)' }}></span>
          <span className="absolute bottom-4 left-8 w-2 h-px bg-black/25" style={{ transform: 'rotate(15deg)' }}></span>
          <span className="absolute bottom-3 right-8 w-2 h-px bg-black/25" style={{ transform: 'rotate(-20deg)' }}></span>
          <span style={{ transform: 'skewX(3deg)', display: 'block' }}>Join Game</span>
        </button>
      </div>
    </div>
  );
}
