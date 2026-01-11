import React, { useEffect, useState } from "react";
import "./NewFriendsPanel.css";
import {
  addFriend,
  getFriends,
  isMutualFriend,
  checkFriendActivitiesAccess,
} from "../../services/Friends";
import PodStorage from "../../services/PodStorage";
import { listActivitiesFromIndex } from "../../services/Activities";
import RecentActivities from "../RecentActivities/RecentActivities";
import FriendActivitiesDashboard from "../FriendActivitiesDashboard/FriendActivitiesDashboard";

export default function NewFriendsPanel({ webId, podUrl, solidFetch, refreshKey }) {
  const [input, setInput] = useState("");
  const [friends, setFriends] = useState([]);
  const [mutualMap, setMutualMap] = useState({});
  const [accessMap, setAccessMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  //for subrouting
  const [subView, setSubView] = useState("list"); // "list" or "activities"
  const [activeFriendId, setActiveFriendId] = useState(null);
  const [friendActivities, setFriendActivities] = useState([]);
  const [activeFriendURL,setActiveFriendURL] = useState("");

  async function refreshFriends() {
  if (!podUrl || !solidFetch) return;
  setLoading(true);
  setMsg("");

  try {
    // 1) Load list of friends
    const list = await getFriends({ podUrl, fetch: solidFetch });
    setFriends(list);

    // 2) For each friend, check mutual + access in parallel
    const accessEntries = await Promise.all(
      list.map(async (fid) => {
        try {
          const res = await checkFriendActivitiesAccess({
            myWebId: webId,
            friendWebId: fid,
            fetch: solidFetch,
          });
          // res is expected like: { mutual: boolean, access: boolean, reason?: string }
          return [fid, res];
        } catch (e) {
          // On error, mark as non-mutual / no access but store reason
          return [
            fid,
            { mutual: false, access: false, reason: e.message || "Failed to fetch" },
          ];
        }
      })
    );

    const accessMapObj = Object.fromEntries(accessEntries);
    const mutualMapObj = Object.fromEntries(
      accessEntries.map(([fid, res]) => [fid, !!res.mutual])
    );

    setAccessMap(accessMapObj);
    setMutualMap(mutualMapObj);
  } catch (e) {
    setMsg(e.message || "Failed to refresh friends");
  } finally {
    setLoading(false);
  }
}



  useEffect(() => {
    refreshFriends();



  }, [podUrl, webId, solidFetch]);

  useEffect(() => {
  async function handleHashChange() {
    const hash = window.location.hash || "";

    if (!hash.startsWith("#/friends")) {
      return;
    }

    // Split "#/newfriends?friend=..." into ["#/newfriends", "friend=..."]
    const [, queryString] = hash.split("?");
    if (!queryString) {
      // No friend selected then show list view
      setSubView("list");
      setActiveFriendId(null); //because nothing is selected
      setFriendActivities([]); //because no friend is selected
      setActiveFriendURL("");
      return;
    }

    //if ur here, then a friend is selected?
    const params = new URLSearchParams(queryString);
    const friend = params.get("friend");

    if (!friend) {
      // Again, no friend param => list view
      setSubView("list");
      setActiveFriendId(null);
      setFriendActivities([]);
      setActiveFriendURL("");
      return;
    }

    //change the weird uri to the actual fid
    const fid = decodeURIComponent(friend);

    // Switch view + remember which friend
    setSubView("activities");
    setActiveFriendId(fid);

    // Load their activities
    setLoading(true);
    setMsg("");
    try {
      // use the friend's WebID to get their Pod URL
      const friendPodUrl = await PodStorage.getPodUrl(fid, solidFetch);
      setActiveFriendURL(friendPodUrl);

      const activities = await listActivitiesFromIndex({
        fetch: solidFetch,
        podUrl: friendPodUrl,
      });

      setFriendActivities(activities || []);
    } catch (err) {
      console.error("Failed to load friend activities:", err);
      setMsg(err.message || "Failed to load friend activities");
      setFriendActivities([]);
    } finally {
      setLoading(false);
    }
  }

  handleHashChange();
  window.addEventListener("hashchange", handleHashChange);
  return () => window.removeEventListener("hashchange", handleHashChange);
}, [solidFetch]);


  async function onAddFriend() {
    if (!input.trim()) return;
    setLoading(true);
    setMsg("");
    try {
      const addedId = await addFriend({
        podUrl,
        friendWebId: input.trim(),
        fetch: solidFetch,
      });

      setInput("");
      await refreshFriends();
      setMsg("Friend added! Use Privacy Settings in Dashboard to control access. Ask them to add you back.");
    } catch (e) {
      setMsg(e.message);
    } finally {
      setLoading(false);
    }
  }


    async function onCheckAccess(fid) {
      setLoading(true);
      setMsg("");
      try {
        const res = await checkFriendActivitiesAccess({
          myWebId: webId,
          friendWebId: fid,
          fetch: solidFetch,
        });
        setMutualMap((m) => ({ ...m, [fid]: res.mutual }));
        setAccessMap((a) => ({ ...a, [fid]: res }));
      } catch (e) {
        setAccessMap((a) => ({
          ...a,
          [fid]: { mutual: mutualMap[fid], access: false, reason: e.message },
        }));
      } finally {
        setLoading(false);
      }
    }

    async function showFriendActivities(fid){
      try{
        const friendPodUrl = await PodStorage.getPodUrl({podUrl, fetch: solidFetch })
        const activities = await listActivitiesFromIndex({
          fetch: solidFetch,
          podUrl: friendPodUrl,
        });
        

      }catch(err){
        
      }

    }

return (
  <div className="container">
    {/* ---- LIST VIEW ---- */}
    {subView === "list" && (
      <>
        {/* ---------------- Add a Friend ---------------- */}
        <div className="friends-card">
          <div className="friends-header">
            <h2>Add a friend</h2>
            <button disabled={loading} onClick={refreshFriends}>
              Refresh
            </button>
          </div>

          <div className="friends-hint">
            Instructions to adding a new friend:
            <ol>
              <li>You add a friend WebID here.</li>
              <li>Your friend adds you back.</li>
              <li>
                Both share <code>/private/fitness/</code> read access with each
                other.
              </li>
              <li>Then “Mutual” + “Can access activities” turn green.</li>
            </ol>
          </div>

          <div className="friends-add">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Paste friend WebID..."
            />
            <button disabled={loading} onClick={onAddFriend}>
              Add Friend
            </button>
          </div>

          {msg && <div className="friends-msg">{msg}</div>}
        </div>

        {/* ---------------- Pending Requests ---------------- */}
        <div className="friends-card">
          <div className="friends-header">
            <h2>Pending requests</h2>

            {loading && (
              <div className="friends-loading">
                <div className="spinner"></div>
                <span>Checking friends…</span>
              </div>
            )}

            <button disabled={loading} onClick={refreshFriends}>
              Refresh
            </button>
          </div>

          <ul className="friends-list">
            {friends
              .filter((fid) => mutualMap[fid] === false)
              .map((fid) => {
                const access = accessMap[fid];

                return (
                  <li key={fid} className="friend-row">
                    <div className="friend-id">{fid}</div>

                    <div className="badge warn">Not mutual ⏳</div>

                    <div className={`badge ${access?.access ? "ok" : "warn"}`}>
                      {access
                        ? access.access
                          ? "Can access activities ✅"
                          : "No access ❌"
                        : "Access unknown"}
                    </div>

                    {access?.reason && (
                      <div className="friend-reason">{access.reason}</div>
                    )}
                  </li>
                );
              })}

            {friends.filter((fid) => mutualMap[fid] === false).length === 0 && (
              <li className="friend-empty">No pending requests.</li>
            )}
          </ul>
        </div>

        {/* ---------------- Confirmed Friends ---------------- */}
        <div className="friends-card">
          <div className="friends-header">
            <h2>Confirmed friends</h2>

            {loading && (
              <div className="friends-loading">
                <div className="spinner"></div>
                <span>Checking friends…</span>
              </div>
            )}

            <button disabled={loading} onClick={refreshFriends}>
              Refresh
            </button>
          </div>

          <ul className="friends-list">
            {friends
              .filter((fid) => mutualMap[fid] === true)
              .map((fid) => {
                const access = accessMap[fid];

                return (
                  <li key={fid} className="friend-row">
                    <div className="friend-id">{fid}</div>

                    <div className="badge ok">Mutual ✅</div>

                    <div className={`badge ${access?.access ? "ok" : "warn"}`}>
                      {access
                        ? access.access
                          ? "Can access activities ✅"
                          : "No access ❌"
                        : "Access unknown"}
                    </div>

                    <div className="badge">
                      <button
                        className="small-btn"
                        onClick={() => {
                          window.location.hash =
                            "#/friends?friend=" + encodeURIComponent(fid);
                        }}
                        disabled={!access?.access || loading}
                      >
                        See activities
                      </button>
                    </div>

                    {access?.reason && (
                      <div className="friend-reason">{access.reason}</div>
                    )}
                  </li>
                );
              })}

            {friends.filter((fid) => mutualMap[fid] === true).length === 0 && (
              <li className="friend-empty">No confirmed friends.</li>
            )}
          </ul>

        </div>

        <FriendActivitiesDashboard webId={webId} podUrl={podUrl} solidFetch={solidFetch}/>






      </>
    )}

    {/*activities view*/}
    {subView === "activities" && (
      <div>
        <div className="friends-header">
          <h2>Activities for:</h2>
          <span className="friend-id" style={{ flex: 1, marginLeft: 8 }}>
            {activeFriendId}
          </span>

          <button
            className="small-btn"
            onClick={() => {
              // Go back to list view via hash
              window.location.hash = "#/friends";
            }}
          >
            ← Back to friends
          </button>
        </div>

        {loading && (
          <div className="friends-loading">
            <div className="spinner"></div>
            <span>Loading activities…</span>
          </div>
        )}

        {!loading && friendActivities.length === 0 && (
          <div className="friend-empty">No activities found.</div>
        )}

        {!loading && friendActivities.length > 0 && (
          <RecentActivities
          refreshKey={refreshKey}
          podUrl ={activeFriendURL}
          solidFetch={solidFetch}

          
          
          />

        )}

        {msg && <div className="friends-msg">{msg}</div>}
      </div>
    )}
   
  </div>
);

}
