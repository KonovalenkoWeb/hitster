import RevealScreen from '../RevealScreen'

export default function RevealScreenExample() {
  const mockSong = {
    id: '1',
    title: 'Sweet Child O\' Mine',
    artist: 'Guns N\' Roses',
    year: 1987,
    albumCover: 'https://picsum.photos/seed/gnr/400/400'
  };

  const mockResults = [
    { playerName: 'Anna', correct: true, placedAt: 2 },
    { playerName: 'Erik', correct: false, placedAt: 5 },
    { playerName: 'Sofia', correct: true, placedAt: 3 },
  ];

  return (
    <RevealScreen
      song={mockSong}
      results={mockResults}
      onContinue={() => console.log('Continue clicked')}
    />
  )
}
