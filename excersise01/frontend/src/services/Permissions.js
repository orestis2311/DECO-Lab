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
 * Make fitness data publicly accessible (anyone can read)
 */
export async function makeFitnessDataPublic({ podUrl, fetch }) {
  const root = rootPodUrl(podUrl);
  const containerUrl = `${root}/private/fitness/`;

  // 1) Set public access on the container itself
  await universalAccess.setPublicAccess(
    containerUrl,
    { read: true, write: false, append: false, control: false },
    { fetch }
  );

  console.log("[Permissions] Made container public:", containerUrl);

  // 2) Set public access on all files inside
  try {
    const containerDs = await getSolidDataset(containerUrl, { fetch });
    const contained = getContainedResourceUrlAll(containerDs);

    console.log("[Permissions] Making files public:", contained);

    for (const fileUrl of contained) {
      await universalAccess.setPublicAccess(
        fileUrl,
        { read: true, write: false, append: false, control: false },
        { fetch }
      );
    }

    console.log("[Permissions] All files are now public");
  } catch (e) {
    console.warn(
      "[Permissions] Could not set public access on files. Error:",
      e
    );
    throw e;
  }
}

/**
 * Make fitness data private (remove public access)
 */
export async function makeFitnessDataPrivate({ podUrl, fetch }) {
  const root = rootPodUrl(podUrl);
  const containerUrl = `${root}/private/fitness/`;

  // 1) Remove public access from the container
  await universalAccess.setPublicAccess(
    containerUrl,
    { read: false, write: false, append: false, control: false },
    { fetch }
  );

  console.log("[Permissions] Made container private:", containerUrl);

  // 2) Remove public access from all files inside
  try {
    const containerDs = await getSolidDataset(containerUrl, { fetch });
    const contained = getContainedResourceUrlAll(containerDs);

    console.log("[Permissions] Making files private:", contained);

    for (const fileUrl of contained) {
      await universalAccess.setPublicAccess(
        fileUrl,
        { read: false, write: false, append: false, control: false },
        { fetch }
      );
    }

    console.log("[Permissions] All files are now private");
  } catch (e) {
    console.warn(
      "[Permissions] Could not remove public access from files. Error:",
      e
    );
    throw e;
  }
}

/**
 * Check if fitness data is currently public
 */
export async function isFitnessDataPublic({ podUrl, fetch }) {
  const root = rootPodUrl(podUrl);
  const containerUrl = `${root}/private/fitness/`;

  try {
    const access = await universalAccess.getPublicAccess(containerUrl, { fetch });
    return access?.read === true;
  } catch (e) {
    console.warn("[Permissions] Could not check public access. Error:", e);
    return false;
  }
}

