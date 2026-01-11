// src/components/PrivacySettings/PrivacySettings.js
import React, { useEffect, useState } from "react";
import "./PrivacySettings.css";
import {
  makeFitnessDataPublic,
  makeFitnessDataPrivate,
  isFitnessDataPublic,
} from "../../services/Permissions";
import { getFriends } from "../../services/Friends";

export default function PrivacySettings({ podUrl, solidFetch }) {
  const [isPublic, setIsPublic] = useState(false);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState(null);
  const [friends, setFriends] = useState([]);

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

  // Toggle visibility handler (friend-based sharing)
  const handleToggle = async () => {
    try {
      setUpdating(true);
      setError(null);

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
