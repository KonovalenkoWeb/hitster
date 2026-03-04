import { CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Song } from '@/types/game.types';

interface PlayerResult {
  playerName: string;
  correct: boolean;
  placedAt: number;
}

interface RevealScreenProps {
  song: Song;
  results: PlayerResult[];
  onContinue?: () => void;
}

export default function RevealScreen({ song, results, onContinue }: RevealScreenProps) {
  return (
    <div className="fixed inset-0 bg-background/98 backdrop-blur-sm z-50 flex items-center justify-center p-6">
      <div className="w-full max-w-3xl">
        <div className="text-center mb-8">
          <h2 className="text-4xl font-bold mb-4">Rundresultat</h2>
        </div>

        <Card className="p-8 mb-6">
          <div className="flex items-center gap-6 mb-6">
            {song.albumCover && (
              <img
                src={song.albumCover}
                alt={song.title}
                className="w-32 h-32 rounded-xl shadow-lg"
              />
            )}
            <div className="flex-1">
              <h3 className="text-3xl font-bold mb-2">{song.title}</h3>
              <p className="text-xl text-muted-foreground mb-3">{song.artist}</p>
              <Badge className="text-3xl font-mono font-black px-6 py-2">
                {song.year}
              </Badge>
            </div>
          </div>
        </Card>

        <Card className="p-6 mb-6">
          <h3 className="text-xl font-bold mb-4">Spelarresultat</h3>
          <div className="space-y-3">
            {results.map((result, idx) => (
              <div
                key={idx}
                className={`flex items-center justify-between p-4 rounded-xl ${
                  result.correct ? 'bg-green-500/10' : 'bg-destructive/10'
                }`}
                data-testid={`result-${idx}`}
              >
                <div className="flex items-center gap-3">
                  {result.correct ? (
                    <CheckCircle2 className="w-6 h-6 text-green-600" />
                  ) : (
                    <XCircle className="w-6 h-6 text-destructive" />
                  )}
                  <span className="font-semibold text-lg">{result.playerName}</span>
                </div>
                <Badge variant={result.correct ? 'default' : 'secondary'} className="text-sm">
                  {result.correct ? 'Correct!' : 'Wrong placement'}
                </Badge>
              </div>
            ))}
          </div>
        </Card>

        <Button
          size="lg"
          className="w-full text-xl"
          onClick={onContinue}
          data-testid="button-continue"
        >
          Fortsätt
        </Button>
      </div>
    </div>
  );
}
