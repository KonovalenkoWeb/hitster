import { useState } from "react";
import { Menu, X, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface GameHamburgerMenuProps {
  spotifyConnected?: boolean;
  spotifyStatusLabel?: string;
  onConnectSpotify?: () => void;
  onInvitePlayers?: () => void;
  onExitGame?: () => void;
}

export default function GameHamburgerMenu({
  spotifyConnected,
  spotifyStatusLabel,
  onConnectSpotify,
  onInvitePlayers,
  onExitGame
}: GameHamburgerMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="fixed right-4 z-50"
      style={{ top: "calc(env(safe-area-inset-top, 0px) + 12px)" }}
    >
      <Button
        onClick={() => setOpen((prev) => !prev)}
        className="h-12 w-12 p-0 bg-black/85 hover:bg-black text-white border-2 border-white"
        aria-label="Öppna spelmeny"
      >
        {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </Button>

      {open && (
        <div className="absolute right-0 top-[56px] w-72 rounded-xl border-2 border-white bg-black/95 p-3 shadow-2xl">
          {typeof spotifyConnected === "boolean" && (
            <div className="mb-3 rounded-lg border border-white/30 bg-black/60 px-3 py-2 text-sm text-white">
              {spotifyConnected ? "Spotify anslutet" : "Spotify ej anslutet"}
              {spotifyStatusLabel ? <span className="block mt-1 text-white/70">{spotifyStatusLabel}</span> : null}
            </div>
          )}

          {!spotifyConnected && onConnectSpotify && (
            <Button
              className="mb-2 w-full bg-yellow-400 hover:bg-yellow-300 text-black border-2 border-white font-black"
              onClick={() => {
                setOpen(false);
                onConnectSpotify();
              }}
            >
              Connect Spotify
            </Button>
          )}

          {onInvitePlayers && (
            <Button
              className="mb-2 w-full bg-black hover:bg-black/90 text-white border-2 border-white"
              onClick={() => {
                setOpen(false);
                onInvitePlayers();
              }}
            >
              <Share2 className="w-4 h-4 mr-2" />
              Bjud in spelare
            </Button>
          )}

          {onExitGame && (
            <Button
              className="w-full bg-black hover:bg-black/90 text-white border-2 border-white"
              onClick={() => {
                setOpen(false);
                onExitGame();
              }}
            >
              Avsluta spelet
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
