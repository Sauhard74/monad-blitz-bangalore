import PhaserGame from '@/components/office/PhaserGame';
import { Hud } from '@/components/hud/Hud';

export default function Home() {
  return (
    <main className="relative h-dvh w-dvw overflow-hidden">
      <PhaserGame />
      <Hud />
    </main>
  );
}
