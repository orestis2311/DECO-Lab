// src/services/Permissions.js
import {
  universalAccess,
  getSolidDataset,
  getContainedResourceUrlAll,
} from "@inrupt/solid-client";

function rootPodUrl(podUrl) {
  let b = (podUrl || "").trim().replace(/\/+$/, "");
  b = b.replace(/\/(public|private)(\/.*)?$/i, "");
  return b;
}

// if someone types without #me, also grant to #me variant (and vice versa)
function agentVariants(webId) {
  const n = (webId || "").trim().replace(/\/+$/, "");
  if (!n) return [];
  if (n.includes("#")) {
    const noFrag = n.split("#")[0];
    return [n, noFrag];
  }
  return [n, n + "#me"];
}

export async function grantFitnessReadToFriend({ podUrl, friendWebId, fetch }) {
  const root = rootPodUrl(podUrl);
  const containerUrl = `${root}/private/fitness/`;

  const agents = agentVariants(friendWebId);

  // 1) Share the container itself
  for (const agent of agents) {
    await universalAccess.setAgentAccess(
      containerUrl,
      agent,
      { read: true, write: false, append: false, control: false },
      { fetch }
    );
  }

  console.log("[Permissions] Shared container", containerUrl, "with", agents);

  // 2) ALSO share all existing files inside (index.ttl + activities)
  try {
    const containerDs = await getSolidDataset(containerUrl, { fetch });
    const contained = getContainedResourceUrlAll(containerDs);

    console.log("[Permissions] Found files to share:", contained);

    for (const fileUrl of contained) {
      for (const agent of agents) {
        await universalAccess.setAgentAccess(
          fileUrl,
          agent,
          { read: true, write: false, append: false, control: false },
          { fetch }
        );
      }
    }

    console.log("[Permissions] Shared existing files with", agents);
  } catch (e) {
    console.warn(
      "[Permissions] Could not list/share contained files. " +
      "At least container is shared. Error:",
      e
    );
  }
}

/**
 * Grant fitness data access to ALL friends
 * "Public" in this context means "visible to friends"
 */
export async function makeFitnessDataPublic({ podUrl, friendsList, fetch }) {
  const root = rootPodUrl(podUrl);
  const containerUrl = `${root}/private/fitness/`;

  if (!friendsList || friendsList.length === 0) {
    console.log("[Permissions] No friends to share with");
    return { success: true, sharedWith: 0 };
  }

  console.log(`[Permissions] Sharing with ${friendsList.length} friends`);
  let successCount = 0;

  // Grant access to each friend
  for (const friendWebId of friendsList) {
    try {
      const agents = agentVariants(friendWebId);

      // Share the container
      for (const agent of agents) {
        await universalAccess.setAgentAccess(
          containerUrl,
          agent,
          { read: true, write: false, append: false, control: false },
          { fetch }
        );
      }

      // Share all files inside
      try {
        const containerDs = await getSolidDataset(containerUrl, { fetch });
        const contained = getContainedResourceUrlAll(containerDs);

        for (const fileUrl of contained) {
          for (const agent of agents) {
            await universalAccess.setAgentAccess(
              fileUrl,
              agent,
              { read: true, write: false, append: false, control: false },
              { fetch }
            );
          }
        }
      } catch (e) {
        console.warn(`[Permissions] Could not share files with ${friendWebId}:`, e);
      }

      successCount++;
      console.log(`[Permissions] Shared with friend: ${friendWebId}`);
    } catch (e) {
      console.error(`[Permissions] Failed to share with ${friendWebId}:`, e);
    }
  }

  console.log(`[Permissions] Data is now public (shared with ${successCount}/${friendsList.length} friends)`);
  return { success: true, sharedWith: successCount };
}

/**
 * Revoke fitness data access from ALL friends
 * "Private" means friends cannot see your data
 */
export async function makeFitnessDataPrivate({ podUrl, friendsList, fetch }) {
  const root = rootPodUrl(podUrl);
  const containerUrl = `${root}/private/fitness/`;

  if (!friendsList || friendsList.length === 0) {
    console.log("[Permissions] No friends to revoke from");
    return { success: true, revokedFrom: 0 };
  }

  console.log(`[Permissions] Revoking access from ${friendsList.length} friends`);
  let successCount = 0;

  // Revoke access from each friend
  for (const friendWebId of friendsList) {
    try {
      const agents = agentVariants(friendWebId);

      // Revoke container access
      for (const agent of agents) {
        await universalAccess.setAgentAccess(
          containerUrl,
          agent,
          { read: false, write: false, append: false, control: false },
          { fetch }
        );
      }

      // Revoke access from all files
      try {
        const containerDs = await getSolidDataset(containerUrl, { fetch });
        const contained = getContainedResourceUrlAll(containerDs);

        for (const fileUrl of contained) {
          for (const agent of agents) {
            await universalAccess.setAgentAccess(
              fileUrl,
              agent,
              { read: false, write: false, append: false, control: false },
              { fetch }
            );
          }
        }
      } catch (e) {
        console.warn(`[Permissions] Could not revoke file access from ${friendWebId}:`, e);
      }

      successCount++;
      console.log(`[Permissions] Revoked access from friend: ${friendWebId}`);
    } catch (e) {
      console.error(`[Permissions] Failed to revoke from ${friendWebId}:`, e);
    }
  }

  console.log(`[Permissions] Data is now private (revoked from ${successCount}/${friendsList.length} friends)`);
  return { success: true, revokedFrom: successCount };
}

/**
 * Check if fitness data is shared with friends
 * Checks if at least one friend has read access
 */
export async function isFitnessDataPublic({ podUrl, friendsList, fetch }) {
  const root = rootPodUrl(podUrl);
  const containerUrl = `${root}/private/fitness/`;

  if (!friendsList || friendsList.length === 0) {
    return false; // No friends, so not public
  }

  try {
    // Check if first friend has access
    const firstFriend = friendsList[0];
    const agents = agentVariants(firstFriend);

    for (const agent of agents) {
      try {
        const access = await universalAccess.getAgentAccess(containerUrl, agent, { fetch });
        if (access?.read === true) {
          return true; // At least one friend has access
        }
      } catch (e) {
        // Continue checking
      }
    }

    return false;
  } catch (e) {
    console.warn("[Permissions] Could not check friend access. Error:", e);
    return false;
  }
}

