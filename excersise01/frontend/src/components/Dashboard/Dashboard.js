//B-READ

// src/components/Dashboard/Dashboard.js
import React, { useEffect, useMemo, useState } from "react";
import "../Dashboard/Dashboard.css";
import { listActivitiesFromIndex } from "../../services/Activities";
import PrivacySettings from "../PrivacySettings/PrivacySettings";

export default function Dashboard({ podUrl, solidFetch, refreshKey }) {

  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  function countByType(list) {

        
    //manual code
    /*
    let acc = {}
    for (let i = 0; i<list.length; i++){

      let count = acc[list[i].type] || 0;
      acc[list[i].type] = count+1;



    }
    return acc;
    */
    

    return list.reduce((acc, a) => { acc[a.type] = (acc[a.type] || 0) + 1; return acc; }, {});


    
  }

  //This is where activities is fetched
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

    //if refresh key changes, data must be reloaded(for example when something new is uploaded)
    //podURL because if for example the user logs in to another account
    //solidFetch because if it changes the old fetch may no longer be authorised so dont show its data etc
  }, [podUrl, solidFetch, refreshKey]);

  //statistics calculation
  const stats = useMemo(() => {

    //if null or no activities then everything is 0
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

    //calculating values manually

    //let toalDistkm = 0
    let totalDur = 0
    let totalHeartbeats = 0
    for (let i = 0; i<activities.length; i++){
      //totalDistKm += activities[i].distanceMeters/1000.0;
      totalDur += (activities[i].durationSeconds||0)/60.0;
      totalHeartbeats += (activities[i].avgHeartRate||0) * (activities[i].durationSeconds || 0);  
    }
    const avgHeartRateOverallFixed = (totalHeartbeats/(totalDur*60)).toFixed(1);   
    const totalDistanceKm = activities.reduce((sum, a) => sum + (a.distanceMeters || 0) / 1000, 0).toFixed(2);
    const totalDurationMin = (activities.reduce((s, a) => s + (a.durationSeconds || 0), 0) / 60).toFixed(1);
    const avgHeartRateOverall = avgHeartRateOverallFixed;
    /*
    const avgHeartRateOverall = (
      activities.reduce((s, a) => s + (a.avgHeartRate || 0), 0) / Math.max(totalWorkouts, 1)
    ).toFixed(1);
    */

    const countsOverall = countByType(activities);

    return { totalWorkouts, totalDistanceKm, totalDurationMin, avgHeartRateOverall, countsOverall };
  }, [activities]);

  //html code for the
  return (
    <div className="dashboard-layout">
      <h2>Dashboard</h2>

      {/* Privacy Settings */}
      <PrivacySettings podUrl={podUrl} solidFetch={solidFetch} />

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