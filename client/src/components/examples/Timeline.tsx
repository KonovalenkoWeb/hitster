import { useState } from 'react'
import Timeline from '../Timeline'

export default function TimelineExample() {
  const [highlightPosition, setHighlightPosition] = useState<number | undefined>(undefined);

  const mockTimeline = [
    { id: '1', title: 'Bohemian Rhapsody', artist: 'Queen', year: 1975, albumCover: 'https://picsum.photos/seed/song1/400/400' },
    { id: '2', title: 'Billie Jean', artist: 'Michael Jackson', year: 1983, albumCover: 'https://picsum.photos/seed/song2/400/400' },
    { id: '3', title: 'Smells Like Teen Spirit', artist: 'Nirvana', year: 1991, albumCover: 'https://picsum.photos/seed/song3/400/400' },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Timeline
        timeline={mockTimeline}
        startYear={1980}
        highlightPosition={highlightPosition}
        onPlaceCard={(pos) => {
          console.log('Place at position:', pos);
          setHighlightPosition(pos);
        }}
      />
    </div>
  )
}
