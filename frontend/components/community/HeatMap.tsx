"use client";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import { Analytics } from "@/lib/community-api";
export default function HeatMap({ points }: { points: Analytics["heatmap"] }) {
  return (
    <div className="h-80">
      <MapContainer
        center={
          points[0] ? [points[0].latitude, points[0].longitude] : [43.22, 76.85]
        }
        zoom={10}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {points.map((p, i) => (
          <CircleMarker
            key={i}
            center={[p.latitude, p.longitude]}
            radius={Math.min(45, 12 + p.count * 3)}
            pathOptions={{
              color: "#c2410c",
              fillOpacity: Math.min(0.8, 0.2 + p.count * 0.05),
            }}
          >
            <Popup>{p.count} активных заявок в ячейке</Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
