"use client";

import { useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents } from "react-leaflet";
import type { LatLngLiteral } from "leaflet";
import L from "leaflet";

const pickupIcon = L.divIcon({
  className: "",
  html: '<div class="ar-marker"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const dropIcon = L.divIcon({
  className: "",
  html: '<div class="ar-marker ar-marker-drop"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const driverIcon = L.divIcon({
  className: "",
  html: '<div class="ar-marker ar-marker-driver"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

type Props = {
  pickup: LatLngLiteral | null;
  drop: LatLngLiteral | null;
  onPick: (pos: LatLngLiteral) => void;
  onDrop: (pos: LatLngLiteral) => void;
  activeDrivers?: number;
  estimatedWaitMinutes?: number;
  driverPos?: LatLngLiteral | null;
  liveStatus?: string;
};

function ClickCapture({ pickup, drop, onPick, onDrop }: Props) {
  useMapEvents({
    click(e) {
      const pos = { lat: e.latlng.lat, lng: e.latlng.lng };
      if (!pickup) onPick(pos);
      else if (!drop) onDrop(pos);
      else onPick(pos);
    },
  });
  return null;
}

export default function MapHeroClient({
  pickup,
  drop,
  onPick,
  onDrop,
  activeDrivers,
  estimatedWaitMinutes,
  driverPos,
  liveStatus,
}: Props) {
  const center = useMemo<LatLngLiteral>(() => pickup ?? { lat: 12.9716, lng: 77.5946 }, [pickup]);
  const poly = pickup && drop ? ([pickup, drop] as LatLngLiteral[]) : null;
  const [ready, setReady] = useState(false);

  return (
    <div className="relative overflow-hidden rounded-[20px] ring-1 ring-white/12 shadow-[0_24px_90px_rgba(0,0,0,0.48)]">
      <div className="absolute inset-0 bg-linear-to-b from-black/0 via-black/0 to-black/35 pointer-events-none" />

      <div className="absolute left-4 top-4 z-600 flex items-center gap-2">
        <div className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold ring-1 ring-white/10 backdrop-blur">
          Tap map to set pickup → drop
        </div>
        {typeof activeDrivers === "number" && (
          <div className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-semibold text-emerald-100 ring-1 ring-emerald-300/20 backdrop-blur">
            {activeDrivers} drivers nearby
          </div>
        )}
        {typeof estimatedWaitMinutes === "number" && (
          <div className="rounded-full bg-cyan-400/15 px-3 py-1 text-xs font-semibold text-cyan-100 ring-1 ring-cyan-300/20 backdrop-blur">
            ETA {estimatedWaitMinutes} min
          </div>
        )}
        {liveStatus && (
          <div className="rounded-full bg-amber-400/15 px-3 py-1 text-xs font-semibold text-amber-100 ring-1 ring-amber-300/20 backdrop-blur">
            {liveStatus}
          </div>
        )}
      </div>

      <div className="h-[70vh] min-h-[520px] w-full">
        <MapContainer
          center={center}
          zoom={12}
          scrollWheelZoom
          className="h-full w-full"
          whenReady={() => setReady(true)}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          <ClickCapture pickup={pickup} drop={drop} onPick={onPick} onDrop={onDrop} />
          {pickup && <Marker position={pickup} icon={pickupIcon} />}
          {drop && <Marker position={drop} icon={dropIcon} />}
          {driverPos && <Marker position={driverPos} icon={driverIcon} />}
          {poly && <Polyline positions={poly} pathOptions={{ color: "#F4C95D", weight: 4, opacity: 0.9 }} />}
          {pickup && driverPos && (
            <Polyline positions={[driverPos, pickup]} pathOptions={{ color: "#22D3EE", weight: 3, opacity: 0.85, dashArray: "8 6" }} />
          )}
        </MapContainer>
      </div>

      <div
        className={
          "absolute right-4 top-4 z-650 rounded-full bg-black/30 px-3 py-1 text-xs font-semibold ring-1 ring-white/10 backdrop-blur transition " +
          (ready ? "opacity-100" : "opacity-0")
        }
      >
        Live map
      </div>
    </div>
  );
}

