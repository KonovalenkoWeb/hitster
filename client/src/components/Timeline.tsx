import { Plus, Lock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Song } from '@/types/game.types';

interface TimelineProps {
  timeline: Song[];
  startYear: number;
  onPlaceCard?: (position: number) => void;
  highlightPosition?: number;
  confirmedPosition?: number;
}

export default function Timeline({ timeline, startYear, onPlaceCard, highlightPosition, confirmedPosition }: TimelineProps) {
  const slotCardClasses = "w-[36vw] min-w-[170px] max-w-[230px] min-h-[300px] sm:w-[230px] sm:min-w-[230px] sm:max-w-[230px] sm:min-h-[320px] h-auto shrink-0";
  const songCardClasses = "w-[36vw] min-w-[170px] max-w-[230px] min-h-[300px] sm:w-[230px] sm:min-w-[230px] sm:max-w-[230px] sm:min-h-[320px] h-auto shrink-0 p-3 sm:p-4 flex flex-col bg-black border-4 border-white shadow-xl";

  return (
    <div className="px-0 sm:p-6">

      <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory px-2 sm:px-0">
        {timeline.length === 0 ? (
          <div className="min-w-[116vw] -mx-[8vw] sm:min-w-full sm:mx-0 flex items-center justify-center gap-4">
            <Card
              className={`${slotCardClasses} flex flex-col items-center justify-center snap-start bg-black border-4 border-white shadow-xl ${
                confirmedPosition === 0 ? 'border-green-500' : highlightPosition === 0 ? 'ring-4 ring-red-500 cursor-pointer' : 'cursor-pointer'
              }`}
              onClick={() => confirmedPosition === undefined && onPlaceCard?.(0)}
              data-testid="slot-before-start"
            >
              {confirmedPosition === 0 ? (
                <>
                  <Lock className="w-12 h-12 text-green-500 mb-2" />
                  <p className="text-sm text-white font-bold">Before {startYear}</p>
                  <p className="text-xs text-white/60 mt-2">Locked</p>
                </>
              ) : (
                <>
                  <Plus className="w-12 h-12 text-white mb-2" />
                  <p className="text-sm text-white/70 font-bold">Before {startYear}</p>
                </>
              )}
            </Card>

            <Card className={`${slotCardClasses} flex flex-col items-center justify-center bg-red-500/20 border-4 border-white border-dashed shadow-xl`} data-testid="card-start-year">
              <Badge className="text-2xl font-mono font-black px-6 py-3 bg-red-500 text-white border-2 border-white">
                {startYear}
              </Badge>
              <p className="text-sm text-white font-bold mt-3">Start Year</p>
            </Card>

            <Card
              className={`${slotCardClasses} flex flex-col items-center justify-center snap-start bg-black border-4 border-white shadow-xl ${
                confirmedPosition === 1 ? 'border-green-500' : highlightPosition === 1 ? 'ring-4 ring-red-500 cursor-pointer' : 'cursor-pointer'
              }`}
              onClick={() => confirmedPosition === undefined && onPlaceCard?.(1)}
              data-testid="slot-after-start"
            >
              {confirmedPosition === 1 ? (
                <>
                  <Lock className="w-12 h-12 text-green-500 mb-2" />
                  <p className="text-sm text-white font-bold">After {startYear}</p>
                  <p className="text-xs text-white/60 mt-2">Locked</p>
                </>
              ) : (
                <>
                  <Plus className="w-12 h-12 text-white mb-2" />
                  <p className="text-sm text-white/70 font-bold">After {startYear}</p>
                </>
              )}
            </Card>
          </div>
        ) : (
          <>
            <Card
              className={`${slotCardClasses} flex flex-col items-center justify-center snap-start bg-black border-4 border-white shadow-xl ${
                confirmedPosition === 0 ? 'border-green-500' : highlightPosition === 0 ? 'ring-4 ring-red-500 cursor-pointer' : 'cursor-pointer'
              }`}
              onClick={() => confirmedPosition === undefined && onPlaceCard?.(0)}
              data-testid="slot-0"
            >
              {confirmedPosition === 0 ? (
                <>
                  <Lock className="w-10 h-10 text-green-500 mb-2" />
                  <p className="text-xs text-white font-bold">Before {timeline[0].year}</p>
                  <p className="text-xs text-white/60 mt-1">Locked</p>
                </>
              ) : (
                <>
                  <Plus className="w-10 h-10 text-white mb-2" />
                  <p className="text-xs text-white/70 font-bold">Before {timeline[0].year}</p>
                </>
              )}
            </Card>

            {timeline.map((song, idx) => {
              const nextSong = timeline[idx + 1];
              const showPlaceholder = !nextSong || song.year !== nextSong.year;

              return (
                <div key={song.id} className="flex gap-4 snap-start">
                  <Card className={songCardClasses}>
                    <div className="w-full aspect-square max-w-[190px] mx-auto mb-4 shrink-0">
                      {song.albumCover ? (
                        <img
                          src={song.albumCover}
                          alt={song.title}
                          className="w-full h-full object-cover rounded-xl border-2 border-white"
                        />
                      ) : (
                        <div className="w-full h-full rounded-xl border-2 border-white bg-white/5" />
                      )}
                    </div>
                    <Badge className="text-base sm:text-lg font-mono font-black mb-3 self-start bg-red-500 text-white border-2 border-white shrink-0">
                      {song.year}
                    </Badge>
                    <div className="min-h-0">
                      <h4 className="font-bold text-sm sm:text-base leading-tight line-clamp-2 text-white">{song.title}</h4>
                      <p className="text-xs sm:text-sm text-white/70 line-clamp-2">{song.artist}</p>
                    </div>
                  </Card>

                  {showPlaceholder && (
                    <Card
                      className={`${slotCardClasses} flex flex-col items-center justify-center bg-black border-4 border-white shadow-xl ${
                        confirmedPosition === idx + 1 ? 'border-green-500' : highlightPosition === idx + 1 ? 'ring-4 ring-red-500 cursor-pointer' : 'cursor-pointer'
                      }`}
                      onClick={() => confirmedPosition === undefined && onPlaceCard?.(idx + 1)}
                      data-testid={`slot-${idx + 1}`}
                    >
                      {confirmedPosition === idx + 1 ? (
                        <>
                          <Lock className="w-10 h-10 text-green-500 mb-2" />
                          <p className="text-xs text-white font-bold text-center px-2">
                            {nextSong ? `Between ${song.year} and ${nextSong.year}` : `After ${song.year}`}
                          </p>
                          <p className="text-xs text-white/60 mt-1">Locked</p>
                        </>
                      ) : (
                        <>
                          <Plus className="w-10 h-10 text-white mb-2" />
                          <p className="text-xs text-white/70 font-bold text-center px-2">
                            {nextSong ? `Between ${song.year} and ${nextSong.year}` : `After ${song.year}`}
                          </p>
                        </>
                      )}
                    </Card>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
