import React, { useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  CircleMarker,
  Popup,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "./MapView.css";

export default function MapView({ points = [], samples = [], stats = {} }) {
  console.log('MapView received - points:', points.length, 'samples:', samples.length, 'stats:', stats);
  
  const route = useMemo(() => {
    if (!Array.isArray(points)) return [];
    
    console.log('First 5 points:', points.slice(0, 5)); // Debug
    
    const allPoints = points
      .map((p) => {
        // Handle both [lat, lon] arrays and {lat, lon} objects
        if (Array.isArray(p)) {
          return [Number(p[0]), Number(p[1])];
        } else if (p && typeof p === 'object') {
          return [Number(p.lat), Number(p.lon)];
        }
        return null;
      })
      .filter(
        (p) =>
          p &&
          Number.isFinite(p[0]) &&
          Number.isFinite(p[1]) &&
          Math.abs(p[0]) <= 90 &&
          Math.abs(p[1]) <= 180
      );
    
    console.log('Processed points:', allPoints.length); // Debug
    
    // If we have too many points, sample them for the polyline to keep it thin
    if (allPoints.length > 1000) {
      const step = Math.floor(allPoints.length / 500);
      const sampled = allPoints.filter((_, i) => i % step === 0);
      console.log('Sampled to:', sampled.length); // Debug
      return sampled;
    }
    
    return allPoints;
  }, [points]);

  const hasData = route.length > 1;

  const center = useMemo(() => {
    if (hasData) return route[Math.floor(route.length / 2)];
    return [50.7753, 6.0839];
  }, [hasData, route]);

  const totalCount = stats.count ?? route.length;

  // Calculate sampling based on total trackpoints (adjusted for more markers)
  const sampledMarkers = useMemo(() => {
    if (!samples.length) return [];
    const total = samples.length;
    let sample = 1;
    
    // Adjusted sampling logic to show more markers
    if (total > 100) sample = 3;  // Show ~9 markers for 27 samples
    else if (total > 50) sample = 2;  // Show ~13 markers
    else sample = 1;  // Show all if <= 50
    
    const result = [];
    for (let i = sample; i < samples.length - 1; i += sample) {
      result.push(samples[i]);
    }
    return result;
  }, [samples]);

  const markerCount = 2 + sampledMarkers.length; // start + end + sampled points

  if (!hasData) return null;

  return (
    <section className="map-section">
      

      {/* Map */}
      <MapContainer center={center} zoom={13} scrollWheelZoom className="map-box">
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />

        {/* Route polyline - matching original style */}
        <Polyline
          positions={route}
          pathOptions={{ 
            color: "#2563eb", 
            weight: 3, 
            opacity: 0.7,
            smoothFactor: 1.0
          }}
        />

        {/* Start marker - green circle */}
        {samples.length > 0 && (
          <CircleMarker
            center={[samples[0].lat, samples[0].lon]}
            radius={10}
            pathOptions={{ 
              fillColor: "#16a34a",
              color: "#fff",
              weight: 3,
              fillOpacity: 1
            }}
          >
            <Popup>
              <div style={{ minWidth: '180px' }}>
                <strong>🟢 Start #{1}</strong><br/>
                {samples[0].time && (
                  <>⏰ {samples[0].time}<br/></>
                )}
                📍 {samples[0].lat.toFixed(6)}, {samples[0].lon.toFixed(6)}<br/>
                {samples[0].elev != null && <>⛰️ {samples[0].elev} m<br/></>}
                {samples[0].hr != null ? <>❤️ {samples[0].hr} bpm<br/></> : <>❤️ —<br/></>}
                {samples[0].power != null ? <>⚡ {samples[0].power} W</> : <>⚡ —</>}
              </div>
            </Popup>
          </CircleMarker>
        )}

        {/* End marker - red circle */}
        {samples.length > 1 && (
          <CircleMarker
            center={[samples[samples.length - 1].lat, samples[samples.length - 1].lon]}
            radius={10}
            pathOptions={{ 
              fillColor: "#dc2626",
              color: "#fff",
              weight: 3,
              fillOpacity: 1
            }}
          >
            <Popup>
              <div style={{ minWidth: '180px' }}>
                <strong>🔴 End #{samples.length}</strong><br/>
                {samples[samples.length - 1].time && (
                  <>⏰ {samples[samples.length - 1].time}<br/></>
                )}
                📍 {samples[samples.length - 1].lat.toFixed(6)}, {samples[samples.length - 1].lon.toFixed(6)}<br/>
                {samples[samples.length - 1].elev != null && <>⛰️ {samples[samples.length - 1].elev} m<br/></>}
                {samples[samples.length - 1].hr != null ? <>❤️ {samples[samples.length - 1].hr} bpm<br/></> : <>❤️ —<br/></>}
                {samples[samples.length - 1].power != null ? <>⚡ {samples[samples.length - 1].power} W</> : <>⚡ —</>}
              </div>
            </Popup>
          </CircleMarker>
        )}

        {/* Sampled intermediate markers - blue circles */}
        {sampledMarkers.map((p, i) => (
          <CircleMarker
            key={i}
            center={[p.lat, p.lon]}
            radius={5}
            pathOptions={{ 
              fillColor: "#3b82f6",
              color: "#fff",
              weight: 2,
              opacity: 0.9,
              fillOpacity: 0.8
            }}
          >
            <Popup>
              <div style={{ minWidth: '180px' }}>
                <strong>📍 Trackpoint #{p.idx + 1}</strong><br/>
                {p.time && (
                  <>⏰ {p.time}<br/></>
                )}
                📍 {p.lat.toFixed(6)}, {p.lon.toFixed(6)}<br/>
                {p.elev != null && <>⛰️ {p.elev} m<br/></>}
                {p.hr != null ? <>❤️ {p.hr} bpm<br/></> : <>❤️ —<br/></>}
                {p.power != null ? <>⚡ {p.power} W</> : <>⚡ —</>}
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>

      <div className="footer-note">
        {totalCount} GPS trackpoints recorded — Showing {markerCount} interactive markers (click for details)
      </div>
    </section>
  );
}