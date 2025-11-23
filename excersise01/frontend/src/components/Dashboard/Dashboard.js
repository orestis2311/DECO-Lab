// src/components/Dashboard/Dashboard.js
import React, { useEffect, useMemo, useState } from "react";
import "../Dashboard/Dashboard.css";
import { listActivitiesFromIndex } from "../../services/Activities";

export default function Dashboard({ podUrl, solidFetch, refreshKey }) {
  console.log("[Dashboard props]", { podUrl, hasFetch: !!solidFetch, refreshKey });

  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  // -------- helpers --------
  function sumMetrics(list) {
    const distance = list.reduce((s, a) => s + (a.distanceMeters || 0), 0);
    const duration = list.reduce((s, a) => s + (a.durationSeconds || 0), 0);
    return { distanceKm: (distance / 1000).toFixed(2), durationMin: (duration / 60).toFixed(1) };
  }

  function countByType(list) {
    return list.reduce((acc, a) => { acc[a.type] = (acc[a.type] || 0) + 1; return acc; }, {});
  }

  // -------- load data --------
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!podUrl || !solidFetch) return;
        setLoading(true);
        const list = await listActivitiesFromIndex({ fetch: solidFetch, podUrl });
        if (alive) setActivities(list);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [podUrl, solidFetch, refreshKey]);

  // -------- compute stats --------
  const stats = useMemo(() => {
    if (!activities.length) {
      return {
        totalWorkouts: 0,
        totalDistanceKm: "0.00",
        totalDurationMin: "0.0",
        avgHeartRateOverall: "0.0",
        countsOverall: {},
      };
    }

    const totalWorkouts = activities.length;
    const totalDistanceKm = activities.reduce((sum, a) => sum + (a.distanceMeters || 0) / 1000, 0).toFixed(2);
    const totalDurationMin = (activities.reduce((s, a) => s + (a.durationSeconds || 0), 0) / 60).toFixed(1);
    const avgHeartRateOverall = (
      activities.reduce((s, a) => s + (a.avgHeartRate || 0), 0) / Math.max(totalWorkouts, 1)
    ).toFixed(1);

    const countsOverall = countByType(activities);

    return { totalWorkouts, totalDistanceKm, totalDurationMin, avgHeartRateOverall, countsOverall };
  }, [activities]);

  // -------- render --------
  return (
    <div className="dashboard-layout">
      <h2>Dashboard</h2>

      {loading ? (
        <div className="stat-card">Loading…</div>
      ) : (
        <>
          <div className="cards-row">
            <div className="stat-card">
              <div className="stat-label">Total Workouts</div>
              <div className="stat-value">{stats.totalWorkouts}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Total Distance</div>
              <div className="stat-value">{stats.totalDistanceKm} km</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Total Time</div>
              <div className="stat-value">{stats.totalDurationMin} min</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Avg Heart Rate</div>
              <div className="stat-value">{stats.avgHeartRateOverall} bpm</div>
            </div>
          </div>

          <div className="types-section">
            <h3>Workouts by Type</h3>
            <ul className="type-list">
              {Object.entries(stats.countsOverall).map(([type, count]) => (
                <li key={type}><strong>{type}:</strong> {count}</li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}