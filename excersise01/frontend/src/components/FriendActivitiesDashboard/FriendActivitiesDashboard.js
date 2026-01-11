// src/components/FriendActivitiesDashboard/FriendActivitiesDashboard.js
import React, { useEffect, useState } from "react";
import "./FriendActivitiesDashboard.css";
import { getFriends, checkFriendActivitiesAccess } from "../../services/Friends";
import { listActivitiesFromIndex } from "../../services/Activities";
import PodStorage from "../../services/PodStorage";

export default function FriendActivitiesDashboard({ webId, podUrl, solidFetch }) {
  const [friendsActivities, setFriendsActivities] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedFriend, setExpandedFriend] = useState(null);

  useEffect(() => {
    if (podUrl && solidFetch && webId) {
      loadFriendsActivities();
    }
  }, [podUrl, solidFetch, webId]);

  const loadFriendsActivities = async () => {
    setLoading(true);
    setError(null);

    try {
      console.log("[FriendActivities] Loading friends activities...");

      // 1) Get list of friends
      const friends = await getFriends({ podUrl, fetch: solidFetch });
      console.log("[FriendActivities] Friends list:", friends);

      if (!friends || friends.length === 0) {
        setFriendsActivities({});
        setLoading(false);
        return;
      }

      // 2) Check mutual + access for each friend (same logic as NewFriendsPanel)
      const accessEntries = await Promise.all(
        friends.map(async (fid) => {
          try {
            const res = await checkFriendActivitiesAccess({
              myWebId: webId,
              friendWebId: fid,
              fetch: solidFetch,
            });
            // res: { mutual: boolean, access: boolean, reason?: string }
            return [fid, res];
          } catch (e) {
            console.error(
              `[FriendActivities] Error checking access for ${fid}:`,
              e
            );
            return [
              fid,
              {
                mutual: false,
                access: false,
                reason: e.message || "Failed to check access",
              },
            ];
          }
        })
      );

      // 3) Filter to only mutual + accessible friends
      const accessibleFriends = accessEntries
        .filter(([_, res]) => res.mutual && res.access)
        .map(([fid]) => fid);

      console.log(
        "[FriendActivities] Mutual + accessible friends:",
        accessibleFriends
      );

      if (accessibleFriends.length === 0) {
        setFriendsActivities({});
        setLoading(false);
        return;
      }

      // 4) Fetch activities only for mutual + accessible friends
      const activitiesMap = {};

      for (const friendWebId of accessibleFriends) {
        try {
          console.log(
            `[FriendActivities] Fetching activities for mutual+accessible friend: ${friendWebId}`
          );

          // get friend's Pod URL
          const friendPodUrl = await PodStorage.getPodUrl(
            friendWebId,
            solidFetch
          );
          console.log(`[FriendActivities] Friend Pod URL: ${friendPodUrl}`);

          // fetch activities from friend's Pod
          const activities = await listActivitiesFromIndex({
            fetch: solidFetch,
            podUrl: friendPodUrl,
          });

          console.log(
            `[FriendActivities] Found ${activities.length} activities for ${friendWebId}`
          );

          activitiesMap[friendWebId] = {
            activities: activities || [],
            podUrl: friendPodUrl,
            error: null,
          };
        } catch (err) {
          console.error(
            `[FriendActivities] Error fetching activities for ${friendWebId}:`,
            err
          );
          activitiesMap[friendWebId] = {
            activities: [],
            podUrl: null,
            error: err.message || "Failed to fetch activities",
          };
        }
      }

      setFriendsActivities(activitiesMap);
    } catch (err) {
      console.error("[FriendActivities] Error loading friends activities:", err);
      setError(err.message || "Failed to load friends activities");
      setFriendsActivities({});
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatDuration = (seconds) => {
    if (!seconds) return "N/A";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const formatDistance = (meters) => {
    if (!meters) return "N/A";
    return `${(meters / 1000).toFixed(2)} km`;
  };

  const getFriendName = (webId) => {
    // extract name from WebID
    try {
      const url = new URL(webId);
      const hostname = url.hostname;
      const hostParts = hostname.split(".");

      // subdomain-based Pod (bob.inrupt.net)
      if (hostParts.length > 2 && hostParts[0] !== "www") {
        return hostParts[0];
      }

      // path-based Pods (solidcommunity.net/users/bob/)
      const pathParts = url.pathname.split("/").filter((p) => p);
      for (let i = 0; i < pathParts.length; i++) {
        if (pathParts[i] === "profile") {
          if (i > 0) {
            return pathParts[i - 1];
          }
        }
      }

      return pathParts.length > 0 ? pathParts[0] : webId;
    } catch {
      return webId;
    }
  };

  const toggleFriend = (friendWebId) => {
    setExpandedFriend(expandedFriend === friendWebId ? null : friendWebId);
  };

  if (loading && Object.keys(friendsActivities).length === 0) {
    return (
      <div className="friend-activities-dashboard">
        <h2>Friends' Activities</h2>
        <div className="loading-container">
          <span className="spinner"></span>
          Loading friends' activities...
        </div>
      </div>
    );
  }

  const friendsList = Object.keys(friendsActivities);

  if (friendsList.length === 0 && !loading) {
    return (
      <div className="friend-activities-dashboard">
        <h2>Friends' Activities</h2>
        <div className="empty-state">
          <p>
            No mutual friends with shared fitness access yet, or they haven&apos;t
            granted access.
          </p>
          <p>Add mutual friends above to see their fitness activities!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="friend-activities-dashboard">
      <div className="dashboard-header">
        <h2>Recent Activities</h2>
        <button
          onClick={loadFriendsActivities}
          disabled={loading}
          className="refresh-btn-small"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error && <div className="error-box">{error}</div>}

      <div className="friends-activities-list">
        {friendsList.map((friendWebId) => {
          const data = friendsActivities[friendWebId];
          const isExpanded = expandedFriend === friendWebId;
          const friendName = getFriendName(friendWebId);

          return (
            <div key={friendWebId} className="friend-activities-card">
              <div
                className="friend-card-header"
                onClick={() => toggleFriend(friendWebId)}
              >
                <div className="friend-info-header">
                  <div className="friend-avatar-small">
                    {friendName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="friend-name-title">{friendName}</h3>
                    <p className="friend-webid-small">{friendWebId}</p>
                  </div>
                </div>

                <div className="friend-stats">
                  {data.error ? (
                    <span className="error-badge">❌ {data.error}</span>
                  ) : (
                    <>
                      <span className="stat-badge">
                        {data.activities.length} activities
                      </span>
                      {data.activities.length > 0 && (
                        <span className="expand-icon">
                          {isExpanded ? "▼" : "▶"}
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>

              {isExpanded && !data.error && data.activities.length > 0 && (
                <div className="activities-list-container">
                  {([...data.activities]
                    // sort by createdAt newest first
                    .sort(
                      (a, b) =>
                        new Date(b.createdAt) - new Date(a.createdAt)
                    )
                    // take only the first 2
                    .slice(0, 2)
                  ).map((activity) => (
                    <div
                      key={activity.id}
                      className="activity-item-card"
                    >
                      <div className="activity-type-badge-small">
                        {activity.type || "Activity"}
                      </div>
                      <div className="activity-details-small">
                        <h4>{activity.title || "Untitled Activity"}</h4>
                        <div className="activity-meta-row">
                          <span>
                            📅 {formatDate(activity.createdAt)}
                          </span>
                          <span>
                            ⏱️ {formatDuration(
                              activity.durationSeconds
                            )}
                          </span>
                          <span>
                            📍 {formatDistance(
                              activity.distanceMeters
                            )}
                          </span>
                          {activity.avgHeartRate && (
                            <span>🩷 {activity.avgHeartRate} bpm</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
