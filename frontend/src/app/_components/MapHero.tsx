import dynamic from "next/dynamic";
import type { LatLngLiteral } from "leaflet";

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

const MapHeroClient = dynamic(() => import("./MapHero.client"), {
  ssr: false,
});

export function MapHero(props: Props) {
  return <MapHeroClient {...props} />;
}

