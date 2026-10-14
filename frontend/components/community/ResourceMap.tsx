"use client";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import { Resource } from "@/lib/community-api";
export default function ResourceMap({ resources }: { resources: Resource[] }) {
  return (
    <div className="h-80 overflow-hidden rounded border">
      <MapContainer
        key={resources[0]?.city || "all"}
        center={
          resources[0]
            ? [resources[0].latitude, resources[0].longitude]
            : [43.222, 76.8512]
        }
        zoom={10}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {resources.map((r) => (
          <CircleMarker
            key={r.id}
            center={[r.latitude, r.longitude]}
            radius={10}
            pathOptions={{
              color:
                r.availability === "available"
                  ? "#15803d"
                  : r.availability === "outdated"
                    ? "#a16207"
                    : "#64748b",
            }}
          >
            <Popup>
              <strong>{r.name}</strong>
              <p>{r.city}</p>
              <p>
                {r.availability === "available"
                  ? "Доступен"
                  : r.availability === "outdated"
                    ? "Информация устарела"
                    : "Недоступен"}
              </p>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
