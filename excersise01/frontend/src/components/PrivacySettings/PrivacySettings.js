// src/components/PrivacySettings/PrivacySettings.js
import React, { useEffect, useState } from "react";
import "./PrivacySettings.css";
import {
  makeFitnessDataPublic,
  makeFitnessDataPrivate,
  isFitnessDataPublic,
} from "../../services/Permissions";
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
  const [diagnostics, setDiagnostics] = useState(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [anonymousTest, setAnonymousTest] = useState(null);

  // Check current visibility status on mount
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!podUrl || !solidFetch) return;
        setLoading(true);
        const publicStatus = await isFitnessDataPublic({
          podUrl,
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

  // Toggle visibility handler
  const handleToggle = async () => {
    try {
      setUpdating(true);
      setError(null);
      setAnonymousTest(null);

      if (isPublic) {
        // Switch to private
        await makeFitnessDataPrivate({ podUrl, fetch: solidFetch });
        setIsPublic(false);
        console.log("[PrivacySettings] Data is now private");
      } else {
        // Switch to public
        await makeFitnessDataPublic({ podUrl, fetch: solidFetch });
        setIsPublic(true);
        console.log("[PrivacySettings] Data is now public");

        // After setting public, test if it's actually accessible
        const root = podUrl.trim().replace(/\/+$/, "").replace(/\/(public|private)(\/.*)?$/i, "");
        const containerUrl = `${root}/private/fitness/`;
        const anonTest = await testAnonymousAccess(containerUrl);
        setAnonymousTest(anonTest);

        if (anonTest.requiresAuth) {
          setError("WARNING: Data marked as public but still requires authentication. Your pod provider (iGrant.io) may require login for all access.");
        }
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
              {isPublic ? "🌐 Public" : "🔒 Private"}
            </span>
          </div>
          <p className="privacy-description">
            {isPublic
              ? "Your fitness data is publicly accessible. Anyone with the link can view your activities."
              : "Your fitness data is private. Only you and friends you've shared with can see your activities."}
          </p>
        </div>

        <button
          className={`toggle-button ${isPublic ? "public" : "private"}`}
          onClick={handleToggle}
          disabled={updating}
        >
          {updating
            ? "Updating..."
            : isPublic
            ? "Make Private"
            : "Make Public"}
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
        <strong>Note:</strong> Making your data public will allow anyone to view
        your fitness activities, including workout details, routes, and statistics.
        <br /><br />
        <strong>iGrant.io users:</strong> Your pod provider may require authentication
        for all access, even when data is marked as "public". Use the diagnostics
        button above to test if anonymous access works.
      </div>
    </div>
  );
}
