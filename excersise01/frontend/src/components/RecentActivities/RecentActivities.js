// src/components/RecentActivities/RecentActivities.js
import React, { useEffect, useMemo, useState } from "react";
import "../RecentActivities/RecentActivities.css";
import MapView from "../MapView/MapView";
import TurtleDisplay from "../TurtleDisplay/TurtleDisplay";
import { listActivitiesFromIndex, fetchActivityTtl } from "../../services/Activities";

// Simple parsers like in FileUpload to show map & stats if available
const numLiteral = `([-+]?[0-9]+(?:\\.[0-9]+)?)`;
const optType = (x) => `(?:\\^\\^xsd:${x})?`;

function extractGpsFromTTL(ttlText) {
  const sensorDataPattern = new RegExp(
    String.raw`fit:sd(\d+)[^\.]*?fit:latitude\s+"${numLiteral}"${optType("decimal|float")}\s*[;,]\s*fit:longitude\s+"${numLiteral}"${optType("decimal|float")}`,
    "gis"
  );
  const matches = [...ttlText.matchAll(sensorDataPattern)];
  if (matches.length > 0) {
    return matches
      .map((m) => ({ idx: parseInt(m[1], 10), lat: parseFloat(m[2]), lon: parseFloat(m[3]) }))
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon) && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180)
      .sort((a, b) => a.idx - b.idx)
      .map((p) => [p.lat, p.lon]);
  }
  const latRe = new RegExp(String.raw`fit:latitude\s+"${numLiteral}"${optType("decimal|float")}`, "gi");
  const lonRe = new RegExp(String.raw`fit:longitude\s+"${numLiteral}"${optType("decimal|float")}`, "gi");
  const latMatches = [...ttlText.matchAll(latRe)];
  const lonMatches = [...ttlText.matchAll(lonRe)];
  const pts = [];
  const n = Math.min(latMatches.length, lonMatches.length);
  for (let i = 0; i < n; i++) {
    const lat = parseFloat(latMatches[i][1]);
    const lon = parseFloat(lonMatches[i][1]);
    if (Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
      pts.push([lat, lon]);
    }
  }
  return pts;
}

function formatDuration(secondsTotal) {
  if (secondsTotal == null) return "-";
  const h = Math.floor(secondsTotal / 3600);
  const m = Math.floor((secondsTotal % 3600) / 60);
  const s = secondsTotal % 60;
  return h ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`;
}

function metersToKm(m) {
  if (m == null) return "-";
  return (m / 1000).toFixed(2) + " km";
}

export default function RecentActivities({ podUrl, solidFetch, refreshKey }) {
  console.log("[RecentActivities props]", { podUrl, hasFetch: !!solidFetch, refreshKey });

  const [activities, setActivities] = useState([]);
  const [selected, setSelected] = useState(null);
  const [ttlText, setTtlText] = useState("");
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Load list from index.ttl
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!podUrl || !solidFetch) return;
        setLoadingList(true);
        const list = await listActivitiesFromIndex({ fetch: solidFetch, podUrl });
        if (!alive) return;
        setActivities(list);
        // auto-select newest
        if (list.length) {
          setSelected(list[0]);
        } else {
          setSelected(null);
        }
      } finally {
        if (alive) setLoadingList(false);
      }
    })();
    return () => { alive = false; };
  }, [podUrl, solidFetch, refreshKey]);

  // When selection changes, fetch its TTL to show map + RDF
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!selected) {
        setTtlText("");
        return;
      }
      setLoadingDetail(true);
      try {
        const text = await fetchActivityTtl({ fetch: solidFetch, activityUrl: selected.url });
        if (!alive) return;
        setTtlText(text);
      } finally {
        if (alive) setLoadingDetail(false);
      }
    })();
    return () => { alive = false; };
  }, [selected, solidFetch]);

  const points = useMemo(() => (ttlText ? extractGpsFromTTL(ttlText) : []), [ttlText]);

  return (
    <div className="recent-activities-layout">
      {/* LEFT: list */}
      <div className="activities-list-card">
        <h2>Recent Activities</h2>
        <p className="hint">Loaded from <code>/private/fitness/index.ttl</code></p>

        {loadingList ? (
          <div className="placeholder-box"><p>Loading…</p></div>
        ) : activities.length === 0 ? (
          <div className="placeholder-box"><p>No activities yet. Upload one!</p></div>
        ) : (
          <table className="activities-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Title</th>
                <th>Type</th>
                <th>Distance</th>
                <th>Duration</th>
                <th>Avg HR</th>
              </tr>
            </thead>
            <tbody>
              {activities.map((act) => (
                <tr
                  key={act.id}
                  className={selected?.id === act.id ? "activity-row selected" : "activity-row"}
                  onClick={() => setSelected(act)}
                >
                  <td>{act.createdAt ? new Date(act.createdAt).toLocaleString() : "—"}</td>
                  <td>{act.title}</td>
                  <td>{act.type}</td>
                  <td>{metersToKm(act.distanceMeters)}</td>
                  <td>{formatDuration(act.durationSeconds)}</td>
                  <td>{act.avgHeartRate != null ? Math.round(act.avgHeartRate) + " bpm" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* RIGHT: details */}
      <div className="activity-detail-card">
        {!selected ? (
          <div className="placeholder-box"><p>Select an activity.</p></div>
        ) : (
          <>
            <h3>{selected.title}</h3>
            <p className="sub">
              {selected.type} • {selected.createdAt ? new Date(selected.createdAt).toLocaleString() : "—"}
            </p>

            <div className="mini-summary">
              <div><strong>Distance:</strong> {metersToKm(selected.distanceMeters)}</div>
              <div><strong>Duration:</strong> {formatDuration(selected.durationSeconds)}</div>
              <div><strong>Avg HR:</strong> {selected.avgHeartRate != null ? Math.round(selected.avgHeartRate) + " bpm" : "—"}</div>
            </div>

            <div className="map-wrapper">
              {loadingDetail ? (
                <div className="placeholder-box"><p>Loading map…</p></div>
              ) : points.length ? (
                <MapView points={points} />
              ) : (
                <div className="placeholder-box"><p>No GPS points detected in TTL.</p></div>
              )}
            </div>

            <div className="ttl-wrapper">
              <h4>RDF / Turtle</h4>
              {loadingDetail ? <div className="placeholder-box"><p>Loading TTL…</p></div>
                : <TurtleDisplay ttlText={ttlText || "# (no content)"} />}
            </div>
          </>
        )}
      </div>
    </div>
  );
}