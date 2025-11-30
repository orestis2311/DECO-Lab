import React, { useRef, useState, useCallback } from "react";
import uploadIcon from "../../assets/uploadIcon.png";
import cloudUpload from "../../assets/cloudUpload.png";
import PodStorage from "../../services/PodStorage";
import "./fileUpload.css";

const FileUpload = ({ onConverted, onBusyChange, onTurtleReady, onMapData, onPodError,onPodSuccess, podUrl, webId, solidFetch }) => {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [fileUploaded, setFileUploaded] = useState(false);
  const [ttlURL, setTtlURL] = useState("");
  const [ttlName, setTtlName] = useState("");
  const [uploadingToPod, setUploadingToPod] = useState(false);
  const [podUploadStatus, setPodUploadStatus] = useState(null);
  const [hasUploadedToPod, setHasUploadedToPod] = useState(false);

  const API = (process.env.REACT_APP_API_URL || "http://localhost:3001").replace(/\/+$/, "");

  const numLiteral = `([-+]?[0-9]+(?:\\.[0-9]+)?)`;
  const optType = (xsdType) => `(?:\\^\\^xsd:${xsdType})?`;

  const extractGpsFromTTL = (ttlText) => {
    // Prefer SensorData nodes (ordered by sd index)
    const sensorDataPattern = new RegExp(
      String.raw`fit:sd(\d+)[^\.]*?fit:latitude\s+"${numLiteral}"${optType("decimal|float")}\s*[;,]\s*fit:longitude\s+"${numLiteral}"${optType("decimal|float")}`,
      "gis"
    );

    //convert iterator to array
    const matches = [...ttlText.matchAll(sensorDataPattern)];

    if (matches.length > 0) {
      const sensorData = matches
        .map((m) => ({
          idx: parseInt(m[1], 10),
          lat: parseFloat(m[2]),
          lon: parseFloat(m[3]),
        }))
        .filter(
          (sd) =>
            Number.isFinite(sd.lat) &&
            Number.isFinite(sd.lon) &&
            Math.abs(sd.lat) <= 90 &&
            Math.abs(sd.lon) <= 180
        )
        .sort((a, b) => a.idx - b.idx);

      return sensorData.map((sd) => [sd.lat, sd.lon]);
    }

    // Fallback: sequential lat/lon search (typed or untyped)
    const latRe = new RegExp(String.raw`fit:latitude\s+"${numLiteral}"${optType("decimal|float")}`, "gi");
    const lonRe = new RegExp(String.raw`fit:longitude\s+"${numLiteral}"${optType("decimal|float")}`, "gi");

    const latMatches = [...ttlText.matchAll(latRe)];
    const lonMatches = [...ttlText.matchAll(lonRe)];
    const points = [];
    const minLength = Math.min(latMatches.length, lonMatches.length);

    for (let i = 0; i < minLength; i++) {
      const lat = parseFloat(latMatches[i][1]);
      const lon = parseFloat(lonMatches[i][1]);
      if (
        Number.isFinite(lat) &&
        Number.isFinite(lon) &&
        Math.abs(lat) <= 90 &&
        Math.abs(lon) <= 180
      ) {
        points.push([lat, lon]);
      }
    }
    return points;
  };



  const extractStatsFromTTL = (ttlText) => {

    
    const durMatch = /fit:duration\s+"(PT[^"]+)"(?:\^\^xsd:duration)?/i.exec(ttlText);
    const avgHRMatch = new RegExp(
      String.raw`fit:averageHeartRate\s+"${numLiteral}"${optType("decimal|float|integer")}`,
      "i"
    ).exec(ttlText);
    const avgPowerMatch = new RegExp(
      String.raw`fit:totalPowerOutput\s+"${numLiteral}"${optType("decimal|float|integer")}`,
      "i"
    ).exec(ttlText);

    const fmtPT = (pt) => {
      if (!pt) return null;
      const h = +(/(\d+)H/i.exec(pt)?.[1] ?? 0);
      const m = +(/(\d+)M/i.exec(pt)?.[1] ?? 0);
      const s = +(/(\d+)S/i.exec(pt)?.[1] ?? 0);
      const pad = (x) => String(x).padStart(2, "0");
      return `${h}:${pad(m)}:${pad(s)}`;
    };

    return {
      duration: fmtPT(durMatch?.[1]),
      avgHR: avgHRMatch ? Math.round(Number(avgHRMatch[1])) : undefined,
      avgPower: avgPowerMatch ? Math.round(Number(avgPowerMatch[1])) : undefined,
    };
  };

  const extractActivityMetadata = (ttlText, filename) => {
    // Extract activity type (e.g., Running, Cycling)
    const typeMatch = /fit:ac\d+\s+a\s+fit:(\w+)/i.exec(ttlText);
    const activityType = typeMatch ? typeMatch[1] : 'Activity';

    // Extract duration (raw ISO 8601 format)
    const durMatch = /fit:duration\s+"(PT[^"]+)"(?:\^\^xsd:duration)?/i.exec(ttlText);
    const duration = durMatch ? durMatch[1] : null;

    // Extract average heart rate
    const avgHRMatch = new RegExp(
      String.raw`fit:averageHeartRate\s+"${numLiteral}"${optType("decimal|float|integer")}`,
      "i"
    ).exec(ttlText);
    const averageHeartRate = avgHRMatch ? parseFloat(avgHRMatch[1]) : null;

    // Extract max heart rate
    const maxHRMatch = new RegExp(
      String.raw`fit:maxHeartRate\s+"${numLiteral}"${optType("integer")}`,
      "i"
    ).exec(ttlText);
    const maxHeartRate = maxHRMatch ? parseInt(maxHRMatch[1]) : null;

    // Extract total distance
    const distMatch = new RegExp(
      String.raw`fit:totalDistance\s+"${numLiteral}"${optType("float|decimal")}`,
      "i"
    ).exec(ttlText);
    const totalDistance = distMatch ? parseFloat(distMatch[1]) : null;

    // Extract total power output
    const powerMatch = new RegExp(
      String.raw`fit:totalPowerOutput\s+"${numLiteral}"${optType("float|decimal")}`,
      "i"
    ).exec(ttlText);
    const totalPowerOutput = powerMatch ? parseFloat(powerMatch[1]) : null;

    // Extract timestamp (first trackpoint time or use current time)
    const timeMatch = /fit:timestamp\s+"([^"]+)"(?:\^\^xsd:dateTime)?/i.exec(ttlText);
    const timestamp = timeMatch ? timeMatch[1] : new Date().toISOString();

    // Generate a title
    const title = `${activityType} - ${new Date(timestamp).toLocaleDateString()}`;

    return {
      type: activityType,
      title,
      timestamp,
      duration,
      averageHeartRate,
      maxHeartRate,
      totalDistance,
      totalPowerOutput
    };
  };

  const uploadToPod = async (ttlText, filename) => {
    if (!podUrl || !webId || !solidFetch) {
      console.log('Pod authentication not available, skipping upload');
      return;
    }

    setUploadingToPod(true);
    setPodUploadStatus('Uploading to Pod...');

    try {
      const metadata = extractActivityMetadata(ttlText, filename);

      const result = await PodStorage.uploadActivity(
        podUrl,
        webId,
        ttlText,
        metadata,
        solidFetch
      );
      setHasUploadedToPod(true);
      setPodUploadStatus(`✓ Uploaded to Pod: ${result.filename}`);
      console.log('Successfully uploaded to Pod:', result);

      // notify parent that upload to Pod succeeded  ✅
    if (onPodSuccess) {
      onPodSuccess({ url: result.url, filename: result.filename, metadata });
    }

      // Notify parent to refresh activity list
      if (onTurtleReady) {
        onTurtleReady({
          ttlBlobUrl: ttlURL,
          ttlName: ttlName,
          podUploaded: true,
          podUrl: result.url
        });
      }
    } catch (error) {
      console.error('Error uploading to Pod:', error);
      const errorMessage = error.message || 'Unknown error';
      setPodUploadStatus(`✗ Pod upload failed: ${errorMessage}`);

      // Notify parent component of the error
      if (onPodError) {
        onPodError(errorMessage);
      }
    } finally {
      setUploadingToPod(false);
    }
  };

  // Build ~27 sample markers with optional metadata for popups
  const buildSamples = (points, ttlText) => {
    if (!points?.length) return [];

    const target = 27;
    const step = Math.max(1, Math.floor(points.length / target));

    const timeRe = /fit:timestamp\s+"([^"]+)"(?:\^\^xsd:dateTime)?/gi;
    const elevRe = new RegExp(String.raw`fit:altitude\s+"${numLiteral}"${optType("decimal|float")}`, "gi");
    const hrRe = new RegExp(String.raw`fit:heartRate\s+"${numLiteral}"${optType("integer|decimal|float")}`, "gi");
    const pwrRe = new RegExp(String.raw`fit:powerOutput\s+"${numLiteral}"${optType("integer|decimal|float")}`, "gi");

    const times = [...ttlText.matchAll(timeRe)].map((m) => m[1]);
    const elevs = [...ttlText.matchAll(elevRe)].map((m) => parseFloat(m[1]));
    const hrs = [...ttlText.matchAll(hrRe)].map((m) => parseFloat(m[1]));
    const powers = [...ttlText.matchAll(pwrRe)].map((m) => parseFloat(m[1]));

    const list = [];
    for (let idx = 0; idx < points.length; idx += step) {
      const [lat, lon] = points[idx];
      list.push({
        idx,
        lat,
        lon,
        time: times[idx],
        elev: elevs[idx],
        hr: Number.isFinite(hrs[idx]) ? Math.round(hrs[idx]) : undefined,
        power: Number.isFinite(powers[idx]) ? Math.round(powers[idx]) : undefined,
      });
    }
    return list;
  };

  // ---------- UI handlers ----------
  const resetAll = () => {
    setBusy(false);
    onBusyChange?.(false);
    setFile(null);
    setFileName("");
    setFileUploaded(false);
    setTtlURL("");
    setTtlName("");
    setUploadingToPod(false);
    setPodUploadStatus(null);
    onConverted?.("");
    onMapData?.({ gps: [], samples: [], stats: {} });
    setHasUploadedToPod(false);

  };

  const openPicker = useCallback(() => {
    if (!inputRef.current) return;
    inputRef.current.value = "";
    inputRef.current.click();
  }, []);

  const autoUpload = async (pickedFile) => {
    if (!pickedFile) return;
    const ok = /\.tcx$/i.test(pickedFile.name) || /\.fit$/i.test(pickedFile.name);
    if (!ok) {
      alert("Please choose a .tcx");
      return;
    }
    setHasUploadedToPod(false);
    setFile(pickedFile);
    setFileName(pickedFile.name);
    setBusy(true);
    onBusyChange?.(true);
    setFileUploaded(false);
    setTtlURL("");
    setTtlName("");
    onConverted?.("");
    onMapData?.({ gps: [], samples: [], stats: {} });

    try {
      const formData = new FormData();
      formData.append("file", pickedFile);

      const res = await fetch(`${API}/convert`, { method: "POST", body: formData });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `HTTP ${res.status}`);
      }

      const ttlText = await res.text();

      // TTL download link
      const blob = new Blob([ttlText], { type: "text/turtle;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const base = pickedFile.name.replace(/\.[^.]+$/, "");
      const name = `${base}.ttl`;
      setTtlURL(url);
      setTtlName(name);
      onConverted?.(ttlText);
      onTurtleReady?.({ ttlBlobUrl: url, ttlName: name });

      // Map data
      const gps = extractGpsFromTTL(ttlText);
      const samples = buildSamples(gps, ttlText);
      const stats = { ...extractStatsFromTTL(ttlText), count: gps.length };

      onMapData?.({ gps, samples, stats });
      setFileUploaded(true);

      // Auto-upload to Pod if authenticated
      if (podUrl && webId && solidFetch) {
        await uploadToPod(ttlText, name);
      }
    } catch (err) {
      console.error("Upload/convert failed:", err);
      alert(
        "Conversion failed.\n\n" +
          "Common causes:\n" +
          "• Backend not running or wrong port\n" +
          "• CORS not enabled on the backend\n\n" +
          `Tried: ${API}/convert\n\n` +
          `Error: ${err.message}`
      );
      setFile(null);
      setFileName("");
    } finally {
      setBusy(false);
      onBusyChange?.(false);
    }
  };

  const handleFileChange = (e) => {
    const f = e.target.files && e.target.files[0];
    autoUpload(f);
  };

  return (
    <section>
      <div className="upload-header">
        <img className="upload-icon" src={uploadIcon} alt="" />
        <h3 className="upload-title">Upload Fitness File</h3>
      </div>

      <div className="upload-card">
        <div
          className={`dropzone ${file ? "has-file" : ""}`}
          onClick={(e) => {
            if (!(e.target instanceof HTMLButtonElement)) openPicker();
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const f = e.dataTransfer.files && e.dataTransfer.files[0];
            autoUpload(f);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <img className="cloud" src={cloudUpload} alt="" />

          {!file && (
            <>
              <div className="upload-text">Drag & drop or click to browse</div>
              <button
                type="button"
                className="upload-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  openPicker();
                }}
              >
                Select file
              </button>
            </>
          )}

          {file && !fileUploaded && (
            <>
              <div className="file-name">
                {fileName} {busy && <span className="loading"><span className="spinner" /> Converting…</span>}
              </div>
              {!busy && (
                <button
                  type="button"
                  className="newFileSelection-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    resetAll();
                    openPicker();
                  }}
                >
                  Choose another file
                </button>
              )}
            </>
          )}

          {file && fileUploaded && (
            <button
              type="button"
              className="newFileSelection-btn"
              onClick={(e) => {
                e.stopPropagation();
                resetAll();
                openPicker();
              }}
            >
              Done
            </button>
          )}

          <input
            ref={inputRef}
            type="file"
            accept=".tcx"
            style={{ display: "none" }}
            onChange={handleFileChange}

          />
        </div>

        <div className="help-row">
          <div className="formats">
            Supported formats <strong>.TCX</strong>
          </div>
          {ttlURL && fileUploaded && (
            <a className="ttlDownload-a" href={ttlURL} download={ttlName}>
              Download Turtle file ({ttlName})
            </a>
          )}
        </div>

        {/* Pod Upload Status */}
        {(uploadingToPod || podUploadStatus) && (
          <div className={`pod-status ${uploadingToPod ? 'uploading' : ''}`}>
            {uploadingToPod && <span className="spinner small" />}
            <span className="status-text">{podUploadStatus || 'Uploading to Pod...'}</span>
          </div>
        )}
      </div>
    </section>
  );
};

export default FileUpload;