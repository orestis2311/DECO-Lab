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

