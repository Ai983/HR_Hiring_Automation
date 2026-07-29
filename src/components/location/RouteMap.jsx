import { MapContainer, TileLayer, Polyline, Circle, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const DEFAULT_CENTER = [28.6139, 77.209];

// Draws one employee's day as a polyline. Suspicious (teleport) pings are shown
// as red dots and are NOT connected into the trusted path.
export default function RouteMap({ pings = [], geofences = [], height = 460 }) {
  const good = pings.filter((p) => p.latitude != null && p.longitude != null && !p.suspicious);
  const bad  = pings.filter((p) => p.latitude != null && p.longitude != null && p.suspicious);
  const path = good.map((p) => [p.latitude, p.longitude]);

  const center = path.length
    ? path[Math.floor(path.length / 2)]
    : geofences.length
      ? [geofences[0].latitude, geofences[0].longitude]
      : DEFAULT_CENTER;

  const start = good[0];
  const end   = good[good.length - 1];

  return (
    <div style={{ height, borderRadius: 12, overflow: "hidden", border: "1px solid #e8e2d9" }}>
      <MapContainer center={center} zoom={14} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {geofences.map((g) => (
          <Circle key={g.id} center={[g.latitude, g.longitude]} radius={g.radius_meters}
            pathOptions={{ color: "#0a66c2", fillColor: "#0a66c2", fillOpacity: 0.08 }}>
            <Popup>{g.site_name}</Popup>
          </Circle>
        ))}

        {path.length > 1 && (
          <Polyline positions={path} pathOptions={{ color: "#dc2626", weight: 3, opacity: 0.75 }} />
        )}

        {start && (
          <CircleMarker center={[start.latitude, start.longitude]} radius={10}
            pathOptions={{ color: "#fff", weight: 2, fillColor: "#16a34a", fillOpacity: 1 }}>
            <Popup>Start · {new Date(start.captured_at).toLocaleTimeString("en-IN")}</Popup>
          </CircleMarker>
        )}
        {end && end !== start && (
          <CircleMarker center={[end.latitude, end.longitude]} radius={10}
            pathOptions={{ color: "#fff", weight: 2, fillColor: "#b45309", fillOpacity: 1 }}>
            <Popup>Latest · {new Date(end.captured_at).toLocaleTimeString("en-IN")}</Popup>
          </CircleMarker>
        )}

        {bad.map((p) => (
          <CircleMarker key={p.id} center={[p.latitude, p.longitude]} radius={7}
            pathOptions={{ color: "#fff", weight: 1.5, fillColor: "#dc2626", fillOpacity: 0.9 }}>
            <Popup>⚠️ Suspicious ping · {p.speed_kmh} km/h<br />{new Date(p.captured_at).toLocaleTimeString("en-IN")}</Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
