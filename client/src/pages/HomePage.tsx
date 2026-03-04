import Home from '@/components/Home';
import { useLocation } from 'wouter';

export default function HomePage() {
  const [, setLocation] = useLocation();

  return (
    <Home
      onSelectMasterLocal={() => setLocation('/master')}
      onSelectMasterOnline={() => setLocation('/master-online')}
      onSelectPlayer={() => setLocation('/player')}
    />
  );
}
