import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import BottomBackButton from "@/components/BottomBackButton";

interface AIChatProps {
  onPreferencesConfirmed?: (preferences: string) => void;
  onBack?: () => void;
}

interface MusicFilters {
  mode: "filters";
  catalog: string;
  genre: "mixed" | "rock" | "pop" | "hiphop" | "electronic" | "swedish" | "rnb" | "country" | "latin" | "metal" | "indie" | "disco";
  era: "all" | "70s" | "80s" | "90s" | "2000s" | "2010s" | "2020s" | "custom";
  knownHitsOnly: boolean;
  yearFrom: number;
  yearTo: number;
}

const loadingMessages = [
  "Bygger spellista från katalogen...",
  "Filtrerar låtar efter era och genre...",
  "Väljer en bra mix för spelomgången..."
];

export default function AIChat({ onPreferencesConfirmed, onBack }: AIChatProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const [availability, setAvailability] = useState<{ eligibleCount: number; warning?: string } | null>(null);
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  const [catalogs, setCatalogs] = useState<Array<{ id: string; count: number; minYear: number | null; maxYear: number | null }>>([]);
  const availabilityRequestSeq = useRef(0);
  const [filters, setFilters] = useState<MusicFilters>({
    mode: "filters",
    catalog: "all",
    genre: "mixed",
    era: "all",
    knownHitsOnly: false,
    yearFrom: 1965,
    yearTo: 2003
  });

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await fetch("/api/catalogs");
        if (!response.ok) return;
        const data = await response.json();
        if (!active) return;
        const list = Array.isArray(data.catalogs) ? data.catalogs : [];
        setCatalogs(list);
      } catch {
        // Silent fallback.
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!isConfirming) return;
    const timer = setInterval(() => {
      setLoadingMessageIndex((prev) => (prev + 1) % loadingMessages.length);
    }, 1500);
    return () => clearInterval(timer);
  }, [isConfirming]);

  useEffect(() => {
    const requestId = ++availabilityRequestSeq.current;
    const timer = setTimeout(async () => {
      setIsCheckingAvailability(true);
      setAvailability(null);
      try {
        const response = await fetch("/api/catalog/availability", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(filters)
        });
        if (!response.ok) {
          if (requestId === availabilityRequestSeq.current) {
            setAvailability(null);
          }
          return;
        }
        const data = await response.json();
        if (requestId !== availabilityRequestSeq.current) return;
        setAvailability({
          eligibleCount: Number(data.eligibleCount || 0),
          warning: data.warning || undefined
        });
      } catch {
        if (requestId === availabilityRequestSeq.current) setAvailability(null);
      } finally {
        if (requestId === availabilityRequestSeq.current) setIsCheckingAvailability(false);
      }
    }, 220);

    return () => {
      clearTimeout(timer);
    };
  }, [filters]);

  if (isConfirming) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-8 relative overflow-hidden bg-cover bg-center"
        style={{ backgroundImage: "url(/fltman_red_abackground_black_illustrated_speakers_low_angle_pe_3c6fccde-fd77-41bb-a28a-528037b87b37_0.png)" }}
      >
        <div className="absolute inset-0 bg-black/40 z-0"></div>
        <div className="relative z-30 text-center">
          <div className="bg-yellow-400 border-4 border-white rounded-3xl p-12 shadow-2xl mb-8 max-w-2xl">
            <p className="text-4xl font-black text-black uppercase tracking-wider" style={{ fontFamily: 'Impact, "Arial Black", sans-serif' }}>
              {loadingMessages[loadingMessageIndex]}
            </p>
          </div>
          <Loader2 className="w-16 h-16 animate-spin text-yellow-400 mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-8 pb-24 relative overflow-hidden bg-cover bg-center"
      style={{ backgroundImage: "url(/fltman_red_abackground_black_illustrated_speakers_low_angle_pe_3c6fccde-fd77-41bb-a28a-528037b87b37_0.png)" }}
    >
      <div className="absolute inset-0 bg-black/40 z-0"></div>
      <div className="w-full max-w-3xl relative z-30 bg-black/90 border-4 border-white shadow-2xl p-8">
        <h1 className="text-4xl text-white font-black mb-2" style={{ fontFamily: 'Impact, "Arial Black", sans-serif' }}>
          Musikinställningar
        </h1>
        <p className="text-white/80 mb-8 text-lg">
          Välj filter för låtbiblioteket. Ingen AI används i detta flöde.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div>
            <label className="block text-white font-bold mb-2">Katalog</label>
            <select
              className="w-full h-12 px-3 bg-white text-black font-semibold border-2 border-white rounded-lg"
              value={filters.catalog}
              onChange={(e) => setFilters((prev) => ({ ...prev, catalog: e.target.value }))}
            >
              <option value="all">Alla kataloger</option>
              {catalogs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.id} ({c.count} låtar{c.minYear && c.maxYear ? `, ${c.minYear}-${c.maxYear}` : ""})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-white font-bold mb-2">Genre</label>
            <select
              className="w-full h-12 px-3 bg-white text-black font-semibold border-2 border-white rounded-lg"
              value={filters.genre}
              onChange={(e) => setFilters((prev) => ({ ...prev, genre: e.target.value as MusicFilters["genre"] }))}
            >
              <option value="mixed">Blandat</option>
              <option value="rock">Rock</option>
              <option value="pop">Pop</option>
              <option value="hiphop">Hip-hop</option>
              <option value="electronic">Electronic</option>
              <option value="swedish">Svenska favoriter</option>
              <option value="rnb">R&B</option>
              <option value="country">Country</option>
              <option value="latin">Latin</option>
              <option value="metal">Metal</option>
              <option value="indie">Indie</option>
              <option value="disco">Disco</option>
            </select>
          </div>

          <div>
            <label className="block text-white font-bold mb-2">Era</label>
            <select
              className="w-full h-12 px-3 bg-white text-black font-semibold border-2 border-white rounded-lg"
              value={filters.era}
              onChange={(e) => setFilters((prev) => ({ ...prev, era: e.target.value as MusicFilters["era"] }))}
            >
              <option value="all">Alla år</option>
              <option value="70s">70-tal</option>
              <option value="80s">80-tal</option>
              <option value="90s">90-tal</option>
              <option value="2000s">2000-tal</option>
              <option value="2010s">2010-tal</option>
              <option value="2020s">2020-tal</option>
              <option value="custom">Eget intervall</option>
            </select>
          </div>

        </div>

        {filters.era === "custom" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <div>
              <label className="block text-white font-bold mb-2">År från</label>
              <input
                type="number"
                min={1950}
                max={2024}
                value={filters.yearFrom}
                onChange={(e) => setFilters((prev) => ({ ...prev, yearFrom: Number(e.target.value) }))}
                className="w-full h-12 px-3 bg-white text-black font-semibold border-2 border-white rounded-lg"
              />
            </div>
            <div>
              <label className="block text-white font-bold mb-2">År till</label>
              <input
                type="number"
                min={1950}
                max={2024}
                value={filters.yearTo}
                onChange={(e) => setFilters((prev) => ({ ...prev, yearTo: Number(e.target.value) }))}
                className="w-full h-12 px-3 bg-white text-black font-semibold border-2 border-white rounded-lg"
              />
            </div>
          </div>
        )}

        <label className="flex items-center gap-3 text-white font-semibold mb-8">
          <input
            type="checkbox"
            checked={filters.knownHitsOnly}
            onChange={(e) => setFilters((prev) => ({ ...prev, knownHitsOnly: e.target.checked }))}
            className="w-5 h-5"
          />
          Endast välkända låtar
        </label>

        <div className="mb-6 rounded-lg border border-white/30 bg-black/40 px-4 py-3 text-white">
          <p className="text-sm font-semibold">
            {isCheckingAvailability
              ? "Kontrollerar tillgängliga låtar..."
              : `Tillgängliga låtar: ${availability?.eligibleCount ?? "-"}`
            }
          </p>
          {availability?.warning && (
            <p className="text-sm text-yellow-300 mt-1">{availability.warning}</p>
          )}
          {availability && availability.eligibleCount < 15 && (
            <p className="text-sm text-red-300 mt-1">
              Minst 15 låtar krävs för att starta.
            </p>
          )}
        </div>

        <Button
          size="lg"
          className="w-full text-2xl py-7 px-12 bg-yellow-400 text-black font-black shadow-2xl uppercase tracking-wider hover:bg-yellow-300"
          style={{ fontFamily: 'Impact, "Arial Black", sans-serif' }}
          data-testid="button-confirm-preferences"
          disabled={isCheckingAvailability || !!availability && availability.eligibleCount < 15}
          onClick={() => {
            setIsConfirming(true);
            onPreferencesConfirmed?.(JSON.stringify(filters));
          }}
        >
          Bekräfta & fortsätt
        </Button>
      </div>
      <BottomBackButton onBack={onBack} />
    </div>
  );
}
