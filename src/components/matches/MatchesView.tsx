"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { MatchCard } from "@/components/matches/MatchCard";
import { cn } from "@/lib/cn";
import type { MatchResult } from "@/lib/matching";
import type { MapMatch } from "@/components/matches/MatchesMap";

// Leaflet touches `window`/`document` on import, so the map must only ever
// load on the client - ssr: false is what actually prevents the SSR error,
// the "use client" directive alone isn't enough since Next still
// server-renders client components on first load.
const MatchesMap = dynamic(() => import("@/components/matches/MatchesMap").then((mod) => mod.MatchesMap), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-foreground/50">טוען מפה...</div>
  ),
});

type ViewMode = "map" | "list";

export function MatchesView({ matches, locationEnabled }: { matches: MatchResult[]; locationEnabled: boolean }) {
  const [view, setView] = useState<ViewMode>(locationEnabled ? "map" : "list");

  const mapMatches: MapMatch[] = matches.filter(
    (m): m is MapMatch => m.approxLat !== null && m.approxLng !== null
  );

  return (
    <div>
      <div className="mb-4 flex gap-2 rounded-xl bg-black/5 p-1">
        <ViewTab active={view === "map"} onClick={() => setView("map")}>
          🗺️ מפה
        </ViewTab>
        <ViewTab active={view === "list"} onClick={() => setView("list")}>
          📋 רשימה
        </ViewTab>
      </div>

      {view === "map" ? (
        <MapSection locationEnabled={locationEnabled} mapMatches={mapMatches} />
      ) : (
        <ListSection matches={matches} />
      )}
    </div>
  );
}

function MapSection({ locationEnabled, mapMatches }: { locationEnabled: boolean; mapMatches: MapMatch[] }) {
  if (!locationEnabled) {
    return (
      <Card className="border-brand/20 bg-brand/5 text-center">
        <p className="text-sm font-bold text-brand-dark">📍 כדי לראות התאמות על המפה, הפעל מיקום בפרופיל.</p>
        <Link
          href="/dashboard/profile"
          className="mt-3 inline-block rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-dark"
        >
          מעבר לפרופיל
        </Link>
      </Card>
    );
  }

  if (mapMatches.length === 0) {
    return (
      <Card className="text-center">
        <p className="text-sm text-foreground/60">
          אין כרגע אספנים עם מיקום מופעל בקרבתך שיש להם התאמה. עברו לתצוגת &quot;רשימה&quot; לראות את כל
          ההתאמות שלכם.
        </p>
      </Card>
    );
  }

  return (
    <div className="h-[420px] overflow-hidden rounded-2xl border border-black/10 sm:h-[520px]">
      <MatchesMap matches={mapMatches} />
    </div>
  );
}

function ListSection({ matches }: { matches: MatchResult[] }) {
  if (matches.length === 0) {
    return (
      <Card>
        <p className="text-sm text-foreground/60">אין כרגע התאמות להצגה ברשימה.</p>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {matches.map((match) => (
        <MatchCard key={match.userId} match={match} />
      ))}
    </div>
  );
}

function ViewTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 rounded-lg px-3 py-2.5 text-center text-sm font-bold transition",
        active ? "bg-white text-brand-dark shadow-sm" : "text-foreground/60 hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}
