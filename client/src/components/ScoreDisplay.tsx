import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface ScoreDisplayProps {
  score: number;
  targetScore?: number;
  profileImage?: string;
  playerName?: string;
  avatarColor?: string;
}

export default function ScoreDisplay({ score, targetScore = 10, profileImage, playerName, avatarColor }: ScoreDisplayProps) {
  const progress = (score / targetScore) * 100;

  return (
    <Card className="p-6 bg-black border-4 border-white shadow-2xl">
      <div className="flex items-center gap-4 mb-6">
        {profileImage ? (
          <img
            src={profileImage}
            alt="Profile"
            className="w-20 h-20 rounded-full border-4 border-white object-cover"
          />
        ) : (
          <div
            className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center text-3xl font-black"
            style={{ backgroundColor: avatarColor || '#ef4444' }}
          >
            {playerName?.[0] || '?'}
          </div>
        )}
        <div className="flex-1">
          <h3 className="text-2xl font-black text-white" style={{ fontFamily: 'Impact, "Arial Black", sans-serif' }}>
            {playerName || ''}
          </h3>
        </div>
      </div>

      <div>
        <div className="flex items-baseline justify-center gap-2 mb-2">
          <span className="text-6xl font-mono font-black text-white" data-testid="text-score">{score}</span>
          <span className="text-3xl text-white/60 font-mono">/ {targetScore}</span>
        </div>
        <Progress value={progress} className="h-3 bg-white/20" />
      </div>
    </Card>
  );
}
