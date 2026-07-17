"use client";

import "leaflet/dist/leaflet.css";

import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";
import { useEffect } from "react";

function RouteBounds({ positions }) {
  const map = useMap();
  useEffect(() => {
    if (!positions.length) return;
    if (positions.length === 1) {
      map.setView(positions[0], 16);
      return;
    }
    map.fitBounds(positions, { padding: [24, 24] });
  }, [map, positions]);
  return null;
}

export default function TestDriveRouteMap({ points = [], className = "" }) {
  const positions = points
    .map((point) => [Number(point.lat), Number(point.lng)])
    .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
  if (!positions.length) {
    return (
      <div className={`grid min-h-40 place-items-center rounded-lg border border-dashed bg-slate-50 text-center text-xs font-semibold text-slate-500 ${className}`}>
        Sin ruta GPS registrada.
      </div>
    );
  }
  const start = positions[0];
  const end = positions[positions.length - 1];
  return (
    <div className={`overflow-hidden rounded-lg border bg-white ${className}`}>
      <MapContainer center={start} zoom={15} scrollWheelZoom={false} className="h-full min-h-56 w-full">
        <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Polyline positions={positions} pathOptions={{ color: "#7c3aed", weight: 5, opacity: 0.85 }} />
        <CircleMarker center={start} radius={7} pathOptions={{ color: "#059669", fillColor: "#10b981", fillOpacity: 1 }}>
          <Tooltip direction="top">Inicio</Tooltip>
        </CircleMarker>
        <CircleMarker center={end} radius={7} pathOptions={{ color: "#dc2626", fillColor: "#ef4444", fillOpacity: 1 }}>
          <Tooltip direction="top">Fin</Tooltip>
        </CircleMarker>
        <RouteBounds positions={positions} />
      </MapContainer>
    </div>
  );
}
