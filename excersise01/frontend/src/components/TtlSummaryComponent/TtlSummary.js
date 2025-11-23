import React, { useEffect, useMemo, useState } from "react";
import { Parser } from "n3";
import "./TtlSummary.css";

export default function TtlSummary({ ttlText, loading }) {
  const [summary, setSummary] = useState(null);
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);

  useEffect(() => {
    if (!ttlText || loading) return;

    try {
      const { summaryData, trackpointRows } = parseAndJoin(ttlText);
      trackpointRows.sort((a, b) => (a.timestampMs ?? 0) - (b.timestampMs ?? 0));
      setSummary(summaryData);
      setRows(trackpointRows);
      setPage(0);
    } catch (e) {
      console.error("TTL parse error:", e);
      setSummary(null);
      setRows([]);
    }
  }, [ttlText, loading]);

  // Pagination setup
  const perPage = 5;
  const pageCount = Math.max(1, Math.ceil(rows.length / perPage));
  const paged = useMemo(
    () => rows.slice(page * perPage, page * perPage + perPage),
    [rows, page]
  );

  // KPI boxes
  const kpis = useMemo(() => {
    let duration = summary?.DurationPretty;
    if (!duration && rows.length > 1) {
      const first = rows.find((r) => r.timestampMs != null)?.timestampMs;
      const last = [...rows].reverse().find((r) => r.timestampMs != null)?.timestampMs;
      if (first && last && last > first) duration = toHMS(Math.round((last - first) / 1000));
    }

    let avgHr = summary?.AvgHeartRatePretty;
    if (!avgHr) {
      const hrs = rows.map((r) => r.heartRate).filter(Number.isFinite);
      if (hrs.length) avgHr = `${Math.round(mean(hrs))} bpm`;
    }

    let avgPow = summary?.AvgPowerPretty;
    {
      const pows = rows.map((r) => r.power).filter(Number.isFinite);
      if (pows.length) avgPow = `${Math.round(mean(pows))} W`;
    }

    let activityType = summary?.ActivityType || "Unknown";

    return {
      duration: duration ?? "—",
      avgHr: avgHr ?? "—",
      avgPow: avgPow ?? "—",
      activityType,
    };
  }, [summary, rows]);

  if (loading)
    return (
      <div className="summary-box">
        <p className="loading">Extracting data...</p>
      </div>
    );

  if (!ttlText)
    return (
      <div className="summary-box empty">
        <p>No data yet — upload a TCX file.</p>
      </div>
    );

  return (
    <div className="summary-box">
      <div className="summary-header">
        <h3 className="summary-title">Extracted Data</h3>
      </div>

      {/* KPI cards */}
      <div className="kpi-row">
        <div className="kpi kpi-green">
          <div className="kpi-label">Activity</div>
          <div className="kpi-value">{kpis.activityType}</div>
        </div>
        <div className="kpi kpi-blue">
          <div className="kpi-label">Duration</div>
          <div className="kpi-value">{kpis.duration}</div>
        </div>
        <div className="kpi kpi-red">
          <div className="kpi-label">Avg Heart Rate</div>
          <div className="kpi-value">{kpis.avgHr}</div>
        </div>
        <div className="kpi kpi-yellow">
          <div className="kpi-label">Avg Power</div>
          <div className="kpi-value">{kpis.avgPow}</div>
        </div>
      </div>

      {/* Trackpoints table */}
      <div className="table-section">
        <h4 className="table-title">Trackpoints</h4>
        <table className="summary-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Heart Rate</th>
              <th>Power</th>
              <th>Latitude</th>
              <th>Longitude</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((r, i) => (
              <tr key={`${r.id || "row"}-${i}`}>
                <td>{r.timestampText ?? "—"}</td>
                <td>{Number.isFinite(r.heartRate) ? `${r.heartRate} bpm` : "—"}</td>
                <td>{Number.isFinite(r.power) ? `${r.power} W` : "—"}</td>
                <td>{Number.isFinite(r.lat) ? r.lat.toFixed(5) : "—"}</td>
                <td>{Number.isFinite(r.lon) ? r.lon.toFixed(5) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="pagination">
          <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
            ← Previous
          </button>
          <span>
            Page {page + 1} of {pageCount}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            disabled={page + 1 >= pageCount}
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}

/* =================== parsing & helpers =================== */

function parseAndJoin(ttl) {
  const parser = new Parser();
  const quads = parser.parse(ttl);

  const tpMap = {};
  const sdMap = {};
  const tpToSd = new Map();

  let durationIso = null;
  let avgHrLiteral = null;
  let avgPowLiteral = null;
  let activityType = null;

  for (const q of quads) {
    const s = q.subject.value;
    const p = q.predicate.value;
    const o = String(q.object.value);
    const pred = p.toLowerCase();

    // Activity-level data
    if (pred.endsWith("#duration")) durationIso = stripLiteral(o);
    if (pred.endsWith("#averageheartrate")) avgHrLiteral = stripLiteral(o);
    if (pred.endsWith("#averagepower")) avgPowLiteral = stripLiteral(o);

    // Detect activity type (like a fit:Running)
// Detect the activity type (e.g. a fit:Running)
if (pred.endsWith("rdf-syntax-ns#type")) {
  const clean = stripLiteral(o);
  const match = clean.split(/[#/]/).pop();

  // Collect potential activity types (ignore Trackpoint, SensorData, Device)
  if (
    match &&
    !/trackpoint/i.test(match) &&
    !/sensordata/i.test(match) &&
    !/device/i.test(match) &&
    !/person/i.test(match)
  ) {
    // Always prefer Running/Cycling/Swimming if found
    if (!activityType || /running|cycling|swimming/i.test(match)) {
      activityType = match;
    }
  }
}



    // Trackpoint timestamps
    if (pred.endsWith("#timestamp")) {
      if (!tpMap[s]) tpMap[s] = { id: s };
      const { text, ms } = normalizeTimestamp(o);
      tpMap[s].timestampText = text;
      tpMap[s].timestampMs = ms;
    }

    // Relationship Trackpoint → SensorData
    if (pred.endsWith("#hassensordata")) {
      const sdId = stripLiteral(o);
      if (!tpToSd.has(s)) tpToSd.set(s, new Set());
      tpToSd.get(s).add(sdId);
    }

    // SensorData values
    if (
      pred.endsWith("#heartrate") ||
      pred.endsWith("#poweroutput") ||
      pred.endsWith("#latitude") ||
      pred.endsWith("#longitude")
    ) {
      if (!sdMap[s]) sdMap[s] = { id: s };
      if (pred.endsWith("#heartrate")) sdMap[s].heartRate = toNum(o);
      if (pred.endsWith("#poweroutput")) sdMap[s].power = toNum(o);
      if (pred.endsWith("#latitude")) sdMap[s].lat = toNum(o);
      if (pred.endsWith("#longitude")) sdMap[s].lon = toNum(o);
    }
  }

  // Combine Trackpoint + SensorData
  const rows = [];
  for (const [tpId, tp] of Object.entries(tpMap)) {
    const row = { id: tpId, timestampText: tp.timestampText, timestampMs: tp.timestampMs };

    const sdIds = Array.from(tpToSd.get(tpId) || []);
    if (sdIds.length) {
      const vals = { hr: [], pow: [], lat: [], lon: [] };
      for (const sdId of sdIds) {
        const sd = sdMap[sdId];
        if (!sd) continue;
        if (Number.isFinite(sd.heartRate)) vals.hr.push(sd.heartRate);
        if (Number.isFinite(sd.power)) vals.pow.push(sd.power);
        if (Number.isFinite(sd.lat)) vals.lat.push(sd.lat);
        if (Number.isFinite(sd.lon)) vals.lon.push(sd.lon);
      }
      if (vals.hr.length) row.heartRate = Math.round(mean(vals.hr));
      if (vals.pow.length) row.power = Math.round(mean(vals.pow));
      if (vals.lat.length) row.lat = mean(vals.lat);
      if (vals.lon.length) row.lon = mean(vals.lon);
    }

    rows.push(row);
  }

  // Build summary data
  const summary = {};
  if (durationIso) {
    const sec = isoDurToSeconds(durationIso);
    summary.DurationPretty = sec != null ? toHMS(sec) : durationIso;
  }
  if (avgHrLiteral) summary.AvgHeartRatePretty = `${Math.round(toNum(avgHrLiteral))} bpm`;
  if (avgPowLiteral) summary.AvgPowerPretty = `${Math.round(toNum(avgPowLiteral))} W`;
  if (activityType) summary.ActivityType = activityType;

  return { summaryData: summary, trackpointRows: rows };
}

/* =============== utility helpers =============== */
function stripLiteral(val) {
  return String(val).replace(/^"|"$|(\^\^.*)$/g, "");
}
function toNum(x) {
  const n = parseFloat(String(x).replace(/[^\d.\-]/g, ""));
  return Number.isFinite(n) ? n : NaN;
}
function normalizeTimestamp(raw) {
  const clean = stripLiteral(raw);
  const d = new Date(clean);
  const ms = isNaN(d.getTime()) ? null : d.getTime();
  const text = clean.includes("T") ? clean.replace("Z", "").replace("T", " ") : clean;
  return { text, ms };
}
function isoDurToSeconds(iso) {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i.exec(iso.replace(/"/g, ""));
  if (!m) return null;
  const d = +(m[1] || 0),
    h = +(m[2] || 0),
    min = +(m[3] || 0),
    s = +(m[4] || 0);
  return d * 86400 + h * 3600 + min * 60 + s;
}
function toHMS(totalSec) {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
}
function mean(a) {
  return a.reduce((x, y) => x + y, 0) / a.length;
}
