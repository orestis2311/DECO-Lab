// src/components/PrivacySettings/PrivacySettings.js
import React, { useEffect, useState } from "react";
import "./PrivacySettings.css";
import {
  makeFitnessDataPublic,
  makeFitnessDataPrivate,
  isFitnessDataPublic,
} from "../../services/Permissions";
import { getFriends } from "../../services/Friends";
import {
  diagnoseAccessControl,
  testAnonymousAccess,
  makePublicUsingACP,
} from "../../services/PermissionsDiagnostics";

export default function PrivacySettings({ podUrl, solidFetch }) {
  const [isPublic, setIsPublic] = useState(false);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState(null);
  const [friends, setFriends] = useState([]);
  const [diagnostics, setDiagnostics] = useState(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [anonymousTest, setAnonymousTest] = useState(null);

  // Load friends list and check current visibility status
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!podUrl || !solidFetch) return;
        setLoading(true);

        // Load friends list
        const friendsList = await getFriends({ podUrl, fetch: solidFetch });
        if (alive) setFriends(friendsList);

        // Check if data is shared with friends
        const publicStatus = await isFitnessDataPublic({
          podUrl,
          friendsList,
          fetch: solidFetch,
        });
        if (alive) setIsPublic(publicStatus);
      } catch (e) {
        console.error("[PrivacySettings] Error checking visibility:", e);
        if (alive) setError("Failed to check current visibility status");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [podUrl, solidFetch]);

  // Run diagnostics
  const handleDiagnostics = async () => {
    try {
      setUpdating(true);
      setError(null);
      console.log("[PrivacySettings] Running diagnostics...");

      const results = await diagnoseAccessControl({ podUrl, fetch: solidFetch });
      setDiagnostics(results);
      setShowDiagnostics(true);

      console.log("[PrivacySettings] Diagnostics complete:", results);

      // Also test anonymous access to container
      const root = podUrl.trim().replace(/\/+$/, "").replace(/\/(public|private)(\/.*)?$/i, "");
      const containerUrl = `${root}/private/fitness/`;
      const anonTest = await testAnonymousAccess(containerUrl);
      setAnonymousTest(anonTest);

      console.log("[PrivacySettings] Anonymous access test:", anonTest);
    } catch (e) {
      console.error("[PrivacySettings] Diagnostics error:", e);
      setError("Failed to run diagnostics: " + e.message);
    } finally {
      setUpdating(false);
    }
  };

  // Toggle visibility handler (friend-based sharing)
  const handleToggle = async () => {
    try {
      setUpdating(true);
      setError(null);
      setAnonymousTest(null);

      if (friends.length === 0) {
        setError("You have no friends added yet. Add friends first to share your data.");
        setUpdating(false);
        return;
      }

      if (isPublic) {
        // Switch to private (revoke access from friends)
        const result = await makeFitnessDataPrivate({
          podUrl,
          friendsList: friends,
          fetch: solidFetch,
        });
        setIsPublic(false);
        console.log(`[PrivacySettings] Data is now private (revoked from ${result.revokedFrom} friends)`);
      } else {
        // Switch to public (grant access to friends)
        const result = await makeFitnessDataPublic({
          podUrl,
          friendsList: friends,
          fetch: solidFetch,
        });
        setIsPublic(true);
        console.log(`[PrivacySettings] Data is now public (shared with ${result.sharedWith} friends)`);
      }
    } catch (e) {
      console.error("[PrivacySettings] Error toggling visibility:", e);
      setError("Failed to update visibility settings. Please try again.");
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="privacy-settings">
        <h3>Privacy Settings</h3>
        <div className="privacy-loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="privacy-settings">
      <h3>Privacy Settings</h3>

      <div className="privacy-control">
        <div className="privacy-info">
          <div className="privacy-status">
            <span className={`status-indicator ${isPublic ? "public" : "private"}`}>
              {isPublic ? "👥 Shared with Friends" : "🔒 Private"}
            </span>
            <span className="friends-count">
              ({friends.length} friend{friends.length !== 1 ? "s" : ""})
            </span>
          </div>
          <p className="privacy-description">
            {isPublic
              ? `Your fitness data is shared with ${friends.length} friend${friends.length !== 1 ? "s" : ""}. They can view your activities.`
              : friends.length > 0
              ? `Your fitness data is private. Your ${friends.length} friend${friends.length !== 1 ? "s" : ""} cannot see your activities.`
              : "Your fitness data is private. Add friends to share your activities with them."}
          </p>
        </div>

        <button
          className={`toggle-button ${isPublic ? "public" : "private"}`}
          onClick={handleToggle}
          disabled={updating || friends.length === 0}
          title={friends.length === 0 ? "Add friends first to share your data" : ""}
        >
          {updating
            ? "Updating..."
            : isPublic
            ? "Stop Sharing with Friends"
            : "Share with Friends"}
        </button>
      </div>

      {error && (
        <div className="privacy-error">
          {error}
        </div>
      )}

      {anonymousTest && (
        <div className={`privacy-test ${anonymousTest.accessible ? "success" : "warning"}`}>
          <strong>Anonymous Access Test:</strong>
          {anonymousTest.accessible ? (
            <span> ✅ Data is publicly accessible (HTTP {anonymousTest.status})</span>
          ) : (
            <span> ❌ Data requires authentication (HTTP {anonymousTest.status || "error"})</span>
          )}
          {anonymousTest.requiresAuth && (
            <div className="test-explanation">
              Your pod provider requires authentication for all access. Even though permissions
              are set to "public", anonymous users cannot access the data.
            </div>
          )}
        </div>
      )}

      <div className="privacy-actions">
        <button
          className="diagnostics-button"
          onClick={handleDiagnostics}
          disabled={updating}
        >
          🔍 Run Diagnostics
        </button>
      </div>

      {showDiagnostics && diagnostics && (
        <div className="diagnostics-results">
          <h4>Diagnostics Results</h4>
          <div className="diag-item">
            <strong>Access Control Type:</strong> {diagnostics.accessControlType}
          </div>
          <div className="diag-item">
            <strong>Container URL:</strong>
            <code>{diagnostics.containerUrl}</code>
          </div>
          <div className="diag-item">
            <strong>Public Access Status:</strong>
            {diagnostics.publicAccess ? (
              <pre>{JSON.stringify(diagnostics.publicAccess, null, 2)}</pre>
            ) : (
              <span> Not set or unavailable</span>
            )}
          </div>
          {diagnostics.files.length > 0 && (
            <div className="diag-item">
              <strong>Files Found:</strong> {diagnostics.files.length}
            </div>
          )}
          {diagnostics.errors.length > 0 && (
            <div className="diag-item">
              <strong>Errors:</strong>
              <ul>
                {diagnostics.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}
          <button
            className="close-diagnostics"
            onClick={() => setShowDiagnostics(false)}
          >
            Close Diagnostics
          </button>
        </div>
      )}

      <div className="privacy-warning">
        <strong>How it works:</strong>
        <ul>
          <li><strong>Private:</strong> Only you can see your fitness data. Your friends cannot access it.</li>
          <li><strong>Shared with Friends:</strong> All your friends can see your fitness activities, including workout details, routes, and statistics.</li>
        </ul>
        <br />
        {friends.length === 0 && (
          <div className="no-friends-notice">
            ⚠️ You don't have any friends added yet. Go to the Friends panel to add friends before sharing your data.
          </div>
        )}
      </div>
    </div>
  );
}
