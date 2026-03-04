import CardPlacement from '../CardPlacement'

export default function CardPlacementExample() {
  const mockSong = {
    id: '1',
    title: 'Purple Rain',
    artist: 'Prince',
    year: 1984,
  };

  return (
    <div className="min-h-screen bg-background relative">
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Spelarvy - ingen låtinformation visas</p>
      </div>
      <CardPlacement
        song={mockSong}
        selectedPosition={2}
        onConfirm={() => console.log('Confirmed placement')}
      />
    </div>
  )
}
