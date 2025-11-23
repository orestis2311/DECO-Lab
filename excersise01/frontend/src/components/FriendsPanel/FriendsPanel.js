import React, { useEffect, useState } from "react";
import "./FriendsPanel.css";
import {
  addFriend,
  getFriends,
  isMutualFriend,
  checkFriendActivitiesAccess,
} from "../../services/Friends";
import { grantFitnessReadToFriend } from "../../services/Permissions";


export default function FriendsPanel({ webId, podUrl, solidFetch }) {
  const [input, setInput] = useState("");
  const [friends, setFriends] = useState([]);
  const [mutualMap, setMutualMap] = useState({});
  const [accessMap, setAccessMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  async function refreshFriends() {
    if (!podUrl || !solidFetch) return;
    setLoading(true);
    setMsg("");
    try {
      const list = await getFriends({ podUrl, fetch: solidFetch });
      setFriends(list);

      // mutual checks in parallel
      const mutualEntries = await Promise.all(
        list.map(async (fid) => {
          const m = await isMutualFriend({
            myWebId: webId,
            friendWebId: fid,
            fetch: solidFetch,
          });
          return [fid, m];
        })
      );
      setMutualMap(Object.fromEntries(mutualEntries));
    } catch (e) {
      setMsg(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshFriends();
    // eslint-disable-next-line
  }, [podUrl, webId, solidFetch]);

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

      await grantFitnessReadToFriend({
        podUrl,
        friendWebId: addedId,
        fetch: solidFetch,
      });

      setInput("");
      await refreshFriends();
      setMsg("Friend added + access granted. Ask them to add you back.");
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

  return (
    <div className="friends-card">
      <div className="friends-header">
        <h2>Friends</h2>
        <button disabled={loading} onClick={refreshFriends}>
          Refresh
        </button>
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

      <ul className="friends-list">
        {friends.map((fid) => {
          const isMutual = mutualMap[fid];
          const access = accessMap[fid];

          return (
            <li key={fid} className="friend-row">
              <div className="friend-id">{fid}</div>

              <div className={`badge ${isMutual ? "ok" : "warn"}`}>
                {isMutual ? "Mutual ✅" : "Not mutual ⏳"}
              </div>

              <div className={`badge ${access?.access ? "ok" : "warn"}`}>
                {access
                  ? access.access
                    ? "Can access activities ✅"
                    : "No access ❌"
                  : "Access unknown"}
              </div>

              <button
                disabled={loading}
                className="small-btn"
                onClick={() => onCheckAccess(fid)}
              >
                Check access
              </button>

              {access?.reason && (
                <div className="friend-reason">{access.reason}</div>
              )}
            </li>
          );
        })}

        {friends.length === 0 && (
          <li className="friend-empty">No friends yet.</li>
        )}
      </ul>

      <div className="friends-hint">
        Flow:
        <ol>
          <li>You add a friend WebID here.</li>
          <li>Your friend adds you back.</li>
          <li>Both share <code>/private/fitness/</code> read access with each other.</li>
          <li>Then “Mutual” + “Can access activities” turn green.</li>
        </ol>
      </div>
    </div>
  );
}
