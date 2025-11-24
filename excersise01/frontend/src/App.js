// App.js - Updated with Access Control Integration
import React, { useEffect, useState } from "react";
import "./App.css";
import FileUpload from "./components/fileUploadComponent/fileUpload";
import TtlSummary from "./components/TtlSummaryComponent/TtlSummary";
import TurtleDisplay from "./components/TurtleDisplay/TurtleDisplay";
import MapView from "./components/MapView/MapView";
import Login from "./components/loginComponent/login";
import PodStorage from "./services/PodStorage";
import RecentActivities from "./components/RecentActivities/RecentActivities";
import Dashboard from "./components/Dashboard/Dashboard";
import FriendsPanel from "./components/FriendsPanel/FriendsPanel";
import { logout } from "@inrupt/solid-client-authn-browser";
import { addFriend, getFriends } from "./services/Friends";
// ✅ NEW: Import public access configuration
import { 
  configureAllPublicData, 
  displayAccessSummary 
} from "./services/PublicAccessSetup";

import {
  handleIncomingRedirect,
  getDefaultSession,
} from "@inrupt/solid-client-authn-browser";

export default function App() {
  const [ttlText, setTtlText] = useState("");
  const [loading, setLoading] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState("");
  const [downloadName, setDownloadName] = useState("output.ttl");

  // map state
  const [points, setPoints] = useState([]);
  const [samples, setSamples] = useState([]);
  const [stats, setStats] = useState({});

  // login status (bit flags: isLoggedIn | triedLogginIn | failedToLogIn)
  const [logInStatus, setLogInStatus] = useState("000");

  // Solid Pod state
  const [podUrl, setPodUrl] = useState(null);
  const [webId, setWebId] = useState(null);
  const [solidFetch, setSolidFetch] = useState(null);

  // ✅ NEW: Track if public access has been configured
  const [publicAccessConfigured, setPublicAccessConfigured] = useState(false);

  // Refresh trigger for insights page
  const [insightsRefreshKey, setInsightsRefreshKey] = useState(0);

  // tiny hash router
  const [route, setRoute] = useState(() => window.location.hash || "#/upload");

  useEffect(() => {
    const onHash = () => setRoute(window.location.hash || "#/upload");
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // Handle incoming redirect after login
  useEffect(() => {
    async function handleRedirectAfterLogin() {
      console.log("Checking for incoming redirect...");
      console.log("Current URL:", window.location.href);

      const urlParams = new URLSearchParams(window.location.search);
      const hasAuthParams =
        urlParams.has("code") || urlParams.has("state") || urlParams.has("iss");

      console.log("Has auth params:", hasAuthParams);

      await handleIncomingRedirect();
      const session = getDefaultSession();

      console.log("Session info after handleIncomingRedirect:");
      console.log("  - isLoggedIn:", session.info.isLoggedIn);
      console.log("  - webId:", session.info.webId);

      if (session.info.isLoggedIn) {
        console.log("User is logged in with WebID:", session.info.webId);

        setWebId(session.info.webId);
        setSolidFetch(() => session.fetch);

        try {
          const url = await PodStorage.getPodUrl(session.info.webId, session.fetch);
          setPodUrl(url);
          console.log("Pod URL:", url);
        } catch (error) {
          console.error("Error getting Pod URL:", error);
        }

        setLogInStatus("110");
      } else if (hasAuthParams) {
        console.log("Login redirect failed");
        setLogInStatus("101");
      } else {
        console.log("No active session, no auth params - showing login screen");
      }
    }
    handleRedirectAfterLogin();
  }, []);

  // ✅ NEW: Configure public access after successful login
  useEffect(() => {
    async function setupPublicAccess() {
      // Only run if logged in, have pod URL, and haven't configured yet
      if (
        logInStatus === "110" && 
        podUrl && 
        webId && 
        solidFetch && 
        !publicAccessConfigured
      ) {
        console.log("\n🔓 Configuring public access for assignment...");

        try {
          // Configure all public data
          const results = await configureAllPublicData({
            podUrl,
            webId,
            fetch: solidFetch
          });

          // Display summary for verification
          await displayAccessSummary({
            podUrl,
            webId,
            fetch: solidFetch
          });

          setPublicAccessConfigured(true);
          console.log("✓ Public access configuration complete!");

          // Check if all succeeded
          const allSucceeded = results.every(r => r.success);
          if (!allSucceeded) {
            console.warn("⚠️ Some resources failed to be made public. Check logs above.");
          }
        } catch (error) {
          console.error("✗ Error configuring public access:", error);
        }
      }
    }

    setupPublicAccess();
  }, [logInStatus, podUrl, webId, solidFetch, publicAccessConfigured]);

  async function handleLogout() {
    try {
      console.log("Logging out from Solid...");
      await logout();
    } catch (error) {
      console.error("Logout error:", error);
    }

    // Clear Solid/OIDC leftovers
    const keysToRemove = Object.keys(localStorage).filter(
      (k) =>
        k.startsWith("oidc.") ||
        k.includes("solid") ||
        k.includes("inrupt") ||
        k.includes("session")
    );
    keysToRemove.forEach((k) => localStorage.removeItem(k));
    sessionStorage.clear();

    // Reset React state
    resetVariables();

    // Remove auth params + force clean reload
    window.history.replaceState({}, document.title, window.location.pathname);
    window.location.hash = "#/upload";
    window.location.reload();
  }

  function resetVariables() {
    setLogInStatus("000");
    setPodUrl(null);
    setWebId(null);
    setSolidFetch(null);
    setPublicAccessConfigured(false); // ✅ NEW: Reset public access flag
  }

  return (
    <div>
      {/* Not logged in - show login */}
      {logInStatus.charAt(1) === "0" && <Login />}

      {/* Login failed */}
      {logInStatus.charAt(1) !== "0" && logInStatus.charAt(2) === "1" && (
        <div className="failedLogin-container">
          <p className="failedLogin-Text">
            Login Failed. Press reset to be allowed to login again
          </p>
          <button className="failedLogin-btn" onClick={resetVariables}>
            Reset
          </button>
        </div>
      )}

      {/* Logged in successfully */}
      {logInStatus.charAt(1) !== "0" && logInStatus.charAt(0) === "1" && (
        <div>
          {/* ✅ NEW: Show public access status indicator */}
          {!publicAccessConfigured && (
            <div style={{
              position: 'fixed',
              top: 10,
              right: 10,
              background: '#ffa500',
              color: 'white',
              padding: '8px 12px',
              borderRadius: '4px',
              fontSize: '12px',
              zIndex: 9999
            }}>
              🔓 Configuring public access...
            </div>
          )}

          {/* Navigation */}
          <div className="top-mini-nav" style={{ display: "flex", gap: 8, margin: "8px 0" }}>
            <button
              onClick={() => (window.location.hash = "#/upload")}
              className={route === "#/upload" || route === "" ? "active" : ""}
            >
              Upload
            </button>
            <button
              onClick={() => (window.location.hash = "#/insights")}
              className={route === "#/insights" ? "active" : ""}
            >
              Insights
            </button>
            <button
              onClick={() => (window.location.hash = "#/friends")}
              className={route === "#/friends" ? "active" : ""}
            >
              Friends
            </button>
            {/* ✅ NEW: Debug button to show access summary */}
            <button
              onClick={async () => {
                if (podUrl && webId && solidFetch) {
                  await displayAccessSummary({
                    podUrl,
                    webId,
                    fetch: solidFetch
                  });
                }
              }}
              style={{ marginLeft: "8px" }}
              title="Show access permissions in console"
            >
              🔍 Debug Access
            </button>
            <button onClick={handleLogout} className="logout-btn" style={{ marginLeft: "auto" }}>
              Logout
            </button>
          </div>

          {/* UPLOAD PAGE */}
          <div style={{ display: route === "#/upload" || route === "" || !route.startsWith("#/") ? "block" : "none" }}>
            <div className="app-shell">
              <div className="top-grid">
                <div className="left">
                  <FileUpload
                    onConverted={(text) => setTtlText(text || "")}
                    onBusyChange={setLoading}
                    onTurtleReady={({ ttlBlobUrl, ttlName }) => {
                      setDownloadUrl(ttlBlobUrl || "");
                      if (ttlName) setDownloadName(ttlName);
                    }}
                    onMapData={({ gps = [], samples = [], stats = {} }) => {
                      setPoints(gps);
                      setSamples(samples);
                      setStats(stats);
                    }}
                    podUrl={podUrl}
                    webId={webId}
                    solidFetch={solidFetch}
                    onPodError={(error) => console.error("Pod upload error:", error)}
                    onPodSuccess={() => {
                      console.log("[App] File uploaded to Pod - triggering insights refresh");
                      setInsightsRefreshKey(prev => {
                        const newValue = prev + 1;
                        console.log("[App] insightsRefreshKey updated:", prev, "->", newValue);
                        return newValue;
                      });
                    }}
                  />
                </div>

                <div className="right">
                  <TtlSummary
                    ttlText={ttlText}
                    loading={loading}
                    downloadUrl={downloadUrl}
                    downloadName={downloadName}
                  />
                </div>
              </div>

              {points.length > 1 && (
                <div className="bottom-row">
                  <MapView points={points} samples={samples} stats={stats} />
                </div>
              )}

              <div className="bottom-row">
                <TurtleDisplay
                  ttlText={ttlText}
                  loading={loading}
                  downloadUrl={downloadUrl}
                  downloadName={downloadName}
                />
              </div>
            </div>
          </div>

          {/* INSIGHTS PAGE */}
          <div
            style={{
              display: route === "#/insights" ? "block" : "none",
              backgroundColor: "#000000",
              minHeight: "100vh",
              paddingBottom: "20px",
            }}
          >
            <div style={{ padding: "20px", maxWidth: "1600px", margin: "0 auto" }}>
              <Dashboard
                podUrl={podUrl}
                solidFetch={solidFetch}
                refreshKey={insightsRefreshKey}
              />
            </div>

            <div style={{ padding: "20px", maxWidth: "1600px", margin: "0 auto" }}>
              <RecentActivities
                podUrl={podUrl}
                solidFetch={solidFetch}
                refreshKey={insightsRefreshKey}
              />
            </div>
          </div>

          {/* FRIENDS PAGE */}
          <div style={{ display: route === "#/friends" ? "block" : "none" }}>
            <div style={{ padding: "20px", maxWidth: "1600px", margin: "0 auto" }}>
              <FriendsPanel
                webId={webId}
                podUrl={podUrl}
                solidFetch={solidFetch}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}