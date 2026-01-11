// src/components/PrivacySettings/PrivacySettings.js
import React, { useEffect, useState } from "react";
import "./PrivacySettings.css";
import {
  makeFitnessDataPublic,
  makeFitnessDataPrivate,
  isFitnessDataPublic,
} from "../../services/Permissions";

export default function PrivacySettings({ podUrl, solidFetch }) {
  const [isPublic, setIsPublic] = useState(false);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState(null);

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

  // Toggle visibility handler
  const handleToggle = async () => {
    try {
      setUpdating(true);
      setError(null);

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

      <div className="privacy-warning">
        <strong>Note:</strong> Making your data public will allow anyone to view
        your fitness activities, including workout details, routes, and statistics.
      </div>
    </div>
  );
}
