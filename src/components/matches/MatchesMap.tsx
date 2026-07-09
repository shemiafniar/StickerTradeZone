"use client";

import { useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import Link from "next/link";
import { formatDistanceHebrew } from "@/lib/distance";
import { formatStickerCodesByTeam, serializeStickerCodes } from "@/lib/stickerCodes";
import type { MatchResult } from "@/lib/matching";

// Centered on Israel, zoomed to show the whole country by default.
const ISRAEL_CENTER: [number, number] = [31.4, 34.9];
const DEFAULT_ZOOM = 7;

// A single, reusable factory instead of new markup per marker - this is
// also the seam for adding marker clustering later (react-leaflet-cluster
// or leaflet.markercluster both just wrap <Marker> children like these in
// a cluster group component, no change needed here).
function createMarkerIcon(score: number) {
  return L.divIcon({
    className: "", // avoid Leaflet's default marker class fighting our styles
    html: `<div class="matches-map-marker">⚽<span class="matches-map-marker__badge">${score}</span></div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -20],
  });
}

export interface MapMatch extends MatchResult {
  approxLat: number;
  approxLng: number;
}

export function MatchesMap({ matches }: { matches: MapMatch[] }) {
  // Memoized so Leaflet's own internal state (pan/zoom) isn't rebuilt on
  // every unrelated re-render of the parent.
  const markers = useMemo(
    () =>
      matches.map((match) => ({
        match,
        icon: createMarkerIcon(match.score),
      })),
    [matches]
  );

  return (
    // Leaflet's own internal layout logic (panning, popup placement) assumes
    // LTR - isolate the map itself as LTR while the rest of the page (and
    // the popup card content, via its own dir handling) stays RTL.
    <div dir="ltr" className="h-full w-full">
      <MapContainer center={ISRAEL_CENTER} zoom={DEFAULT_ZOOM} className="matches-map" scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {markers.map(({ match, icon }) => (
          <Marker key={match.userId} position={[match.approxLat, match.approxLng]} icon={icon}>
            <Popup>
              <MatchPopupContent match={match} />
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

function MatchPopupContent({ match }: { match: MapMatch }) {
  const giveParam = encodeURIComponent(serializeStickerCodes(match.theyNeedThatIHave));
  const receiveParam = encodeURIComponent(serializeStickerCodes(match.theyHaveThatINeed));
  const topCodes = [...match.theyHaveThatINeed, ...match.theyNeedThatIHave].slice(0, 6);

  return (
    <div>
      <p className="font-extrabold">{match.fullName}</p>
      <p className="text-xs text-foreground/60">
        {match.city}
        {match.neighborhood ? ` · ${match.neighborhood}` : ""}
      </p>
      {match.distanceKm !== null && (
        <p className="mt-1 text-xs font-bold text-brand-dark">📍 {formatDistanceHebrew(match.distanceKm)}</p>
      )}

      <div className="mt-2 grid grid-cols-2 gap-2 text-center">
        <div className="rounded-lg bg-green-50 px-2 py-1.5">
          <p className="text-lg font-extrabold text-green-800">{match.theyHaveThatINeed.length}</p>
          <p className="text-[11px] font-bold text-green-700">יתן לי</p>
        </div>
        <div className="rounded-lg bg-blue-50 px-2 py-1.5">
          <p className="text-lg font-extrabold text-blue-800">{match.theyNeedThatIHave.length}</p>
          <p className="text-[11px] font-bold text-blue-700">אתן לו/ה</p>
        </div>
      </div>

      {topCodes.length > 0 && (
        <p className="mt-2 text-xs text-foreground/60" dir="ltr">
          {formatStickerCodesByTeam(topCodes)}
        </p>
      )}

      <Link
        href={`/dashboard/trades/new?to=${match.userId}&give=${giveParam}&receive=${receiveParam}`}
        className="mt-3 block w-full rounded-lg bg-brand py-2 text-center text-sm font-bold text-white transition hover:bg-brand-dark"
      >
        שלח בקשת טרייד
      </Link>
    </div>
  );
}
