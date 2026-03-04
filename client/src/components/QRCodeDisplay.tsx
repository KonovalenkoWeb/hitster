import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { User } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import type { Player } from '@shared/types';
import BottomBackButton from '@/components/BottomBackButton';

interface QRCodeDisplayProps {
  gameCode: string;
  playerCount: number;
  players: Player[];
  onStartGame?: () => void;
  onInvitePlayers?: () => void;
  onExitGame?: () => void;
  onBack?: () => void;
}

export default function QRCodeDisplay({ gameCode, playerCount, players, onStartGame, onInvitePlayers, onExitGame, onBack }: QRCodeDisplayProps) {
  const joinUrl = `${window.location.origin}/join/${gameCode}`;
  const [qrSize, setQrSize] = useState(320);
  const { toast } = useToast();

  useEffect(() => {
    const updateQrSize = () => {
      const width = window.innerWidth;
      if (width < 640) {
        setQrSize(Math.max(180, Math.min(260, width - 120)));
      } else {
        setQrSize(320);
      }
    };
    updateQrSize();
    window.addEventListener('resize', updateQrSize);
    return () => window.removeEventListener('resize', updateQrSize);
  }, []);

  const handleCopyJoinUrl = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      toast({
        title: 'Länk kopierad',
        description: 'Join-länken med spelkoden är kopierad.'
      });
    } catch {
      toast({
        title: 'Kunde inte kopiera länk',
        description: 'Markera och kopiera länken manuellt.',
        variant: 'destructive'
      });
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 sm:p-8 pt-20 sm:pt-8 relative overflow-hidden bg-cover bg-center"
      style={{ backgroundImage: 'url(/fltman_red_abackground_black_illustrated_speakers_low_angle_pe_3c6fccde-fd77-41bb-a28a-528037b87b37_0.png)' }}
    >
      <div className="absolute inset-0 bg-black/40"></div>

      {/* BeatBrawl Logo - Upper Left */}
      <div className="absolute top-4 left-4 sm:top-8 sm:left-8 z-20">
        <img
          src="/beatbrawl.png"
          alt="BeatBrawl Logo"
          className="h-16 sm:h-24 w-auto"
        />
      </div>

      <div className="w-full max-w-7xl relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8">

          {/* LEFT COLUMN: QR code and Start button */}
          <Card className="p-5 sm:p-10 text-center bg-black border-4 border-white shadow-2xl">
            <div className="inline-block p-4 sm:p-8 bg-white rounded-3xl shadow-2xl mb-6 sm:mb-8">
              <QRCodeSVG
                value={joinUrl}
                size={qrSize}
                level="H"
                includeMargin={true}
              />
            </div>

            <div className="space-y-4 sm:space-y-6">
              <div>
                <p className="text-lg sm:text-xl text-white/80 font-bold mb-3">Game Code</p>
                <Badge className="text-4xl sm:text-6xl font-mono font-black px-6 sm:px-12 py-3 sm:py-4 bg-yellow-400 text-black border-4 border-white shadow-2xl">
                  {gameCode}
                </Badge>
              </div>

              <div className="pt-2 sm:pt-4">
                <Button
                  size="lg"
                  className="w-full text-xl sm:text-2xl py-6 sm:py-8 bg-yellow-400 hover:bg-yellow-300 text-black font-black shadow-xl border-4 border-white"
                  onClick={onStartGame}
                  disabled={playerCount === 0}
                  data-testid="button-start-game"
                >
                  Start Game
                </Button>
              </div>

              {onInvitePlayers && (
                <div>
                  <Button
                    size="lg"
                    className="w-full text-lg sm:text-xl py-4 sm:py-5 bg-black hover:bg-black/90 text-white font-black shadow-xl border-4 border-white"
                    onClick={onInvitePlayers}
                  >
                    Bjud in spelare
                  </Button>
                </div>
              )}

              <div className="mt-4 space-y-2">
                <p className="text-sm sm:text-base text-white/70 font-medium break-all">
                  Join-länk: {joinUrl}
                </p>
                <Button
                  size="sm"
                  className="w-full bg-white/10 hover:bg-white/20 text-white border-2 border-white/40"
                  onClick={handleCopyJoinUrl}
                >
                  Kopiera join-länk
                </Button>
              </div>
            </div>
          </Card>

          {/* RIGHT COLUMN: Player list */}
          <Card className="p-5 sm:p-10 bg-black border-4 border-white shadow-2xl">
            <div className="space-y-3 sm:space-y-4 max-h-[320px] sm:max-h-[600px] overflow-y-auto pr-1 sm:pr-2">
              {players.length === 0 ? (
                <div className="text-center py-16">
                  <User className="w-20 h-20 text-white/30 mx-auto mb-4" />
                  <p className="text-2xl text-white/50 font-bold">
                    Waiting for players...
                  </p>
                  <p className="text-lg text-white/40 mt-2">
                    Scan the QR code to join
                  </p>
                </div>
              ) : (
                players.map((player, index) => (
                  <div
                    key={player.id}
                    className="flex items-center gap-4 p-4 bg-white/10 rounded-2xl border-2 border-white/20 hover:bg-white/20 transition-colors"
                  >
                    {/* Profilbild eller avatar */}
                    <div className="relative flex-shrink-0">
                      {player.profileImage ? (
                        <img
                          src={player.profileImage}
                          alt={player.name}
                          className="w-16 h-16 rounded-full border-4 border-white shadow-lg object-cover"
                        />
                      ) : (
                        <div
                          className="w-16 h-16 rounded-full border-4 border-white shadow-lg flex items-center justify-center text-2xl font-black text-white"
                          style={{ backgroundColor: player.avatarColor || '#FFC107' }}
                        >
                          {player.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      {!player.connected && (
                        <div className="absolute inset-0 bg-gray-500/70 rounded-full flex items-center justify-center">
                          <span className="text-xs font-bold text-white">!</span>
                        </div>
                      )}
                    </div>

                    {/* Player info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xl font-black text-white truncate">
                        {player.name}
                      </h3>
                      {player.artistName && (
                        <p className="text-sm text-white/70 font-medium truncate">
                          {player.artistName}
                        </p>
                      )}
                    </div>

                    {/* Position badge */}
                    <Badge className="text-lg font-mono font-black px-4 py-2 bg-yellow-400 text-black border-4 border-white flex-shrink-0">
                      #{index + 1}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        {onExitGame && (
          <div className="mt-4 sm:mt-6 pb-24">
            <Button
              size="lg"
              className="w-full text-lg sm:text-xl py-4 sm:py-5 bg-black hover:bg-black/90 text-white font-black border-4 border-white"
              onClick={onExitGame}
            >
              Avsluta spelet
            </Button>
          </div>
        )}
      </div>
      {onBack && <BottomBackButton onBack={onBack} />}
    </div>
  );
}
