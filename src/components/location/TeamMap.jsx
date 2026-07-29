import { MapContainer, TileLayer, Marker, Popup, Circle, CircleMarker } from "react-leaflet";
import "leaflet/dist/leaflet.css";

// Default map centre: New Delhi (adjust to your city if needed).
const DEFAULT_CENTER = [28.6139, 77.209];

function markerColor(row) {
  if (row.site_name === "GPS_OFF" || row.latitude == null) return "#dc2626"; // red
  return row.live ? "#16a34a" : "#8a7e72"; // green live / grey last-seen
}

export default function TeamMap({ people = [], geofences = [], height = 480 }) {
  const withCoords = people.filter((p) => p.latitude != null && p.longitude != null);
  const center = withCoords.length
    ? [withCoords[0].latitude, withCoords[0].longitude]
    : geofences.length
      ? [geofences[0].latitude, geofences[0].longitude]
      : DEFAULT_CENTER;

  return (
    <div style={{ height, borderRadius: 12, overflow: "hidden", border: "1px solid #e8e2d9" }}>
      <MapContainer center={center} zoom={12} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {geofences.map((g) => (
          <Circle
            key={g.id}
            center={[g.latitude, g.longitude]}
            radius={g.radius_meters}
            pathOptions={{ color: "#0a66c2", fillColor: "#0a66c2", fillOpacity: 0.08 }}
          >
            <Popup>{g.site_name} · {g.radius_meters} m</Popup>
          </Circle>
        ))}

        {withCoords.map((p) => (
          <CircleMarker
            key={p.employee_id}
            center={[p.latitude, p.longitude]}
            radius={9}
            pathOptions={{ color: "#fff", weight: 2, fillColor: markerColor(p), fillOpacity: 1 }}
          >
            <Popup>
              <strong>{p.employees?.full_name || "Employee"}</strong><br />
              {p.employees?.employee_code}{p.employees?.department ? ` · ${p.employees.department}` : ""}<br />
              {p.site_name || "Unknown"} · {p.live ? "live" : "last seen"}<br />
              {new Date(p.captured_at).toLocaleString("en-IN")}
              {p.accuracy != null && <> · ±{Math.round(p.accuracy)}m</>}
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
