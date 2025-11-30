// src/services/Friends.js
import {
  getSolidDataset,
  createSolidDataset,
  getThing,
  setThing,
  createThing,
  buildThing,
  getUrlAll,
  saveSolidDatasetAt,
  getPodUrlAll,
  createContainerAt,
  getFile,
} from "@inrupt/solid-client";
import { RDF } from "@inrupt/vocab-common-rdf";
import { buildIndexUrl } from "./Activities";

const FOAF = "http://xmlns.com/foaf/0.1/";
const FRIENDS_PUBLIC_PATH = "/public/fitness/friends.ttl";

/** iGrant sometimes returns pod URLs ending in /public or /private. We always want root. */
function rootPodUrl(podUrl) {
  let b = (podUrl || "").trim().replace(/\/+$/, "");
  b = b.replace(/\/(public|private)(\/.*)?$/i, "");
  return b;
}

function friendsUrlFor(podUrl) {
  return `${rootPodUrl(podUrl)}${FRIENDS_PUBLIC_PATH}`;
}

function normalizeWebId(id) {
  return (id || "").trim().replace(/\/+$/, "");
}
function variants(id) {
  const n = normalizeWebId(id);
  const noFrag = n.split("#")[0];
  const withMe = noFrag + "#me";
  return [n, noFrag, withMe];
}

/** ensure /public/fitness/ exists */
async function ensurePublicFitnessContainer(podUrl, fetch) {
  const containerUrl = `${rootPodUrl(podUrl)}/public/fitness/`;
  try {
    await getSolidDataset(containerUrl, { fetch });
  } catch (e) {
    if (e.statusCode === 404) {
      await createContainerAt(containerUrl, { fetch });
      console.log("[Friends] Created container:", containerUrl);
    } else {
      throw e;
    }
  }
}

/** Load list of friend WebIDs from your friends.ttl */
export async function getFriends({ podUrl, fetch }) {
  const fUrl = friendsUrlFor(podUrl);

  try {
    const dataset = await getSolidDataset(fUrl, { fetch });
    const meThingUrl = `${fUrl}#me`;
    const meThing = getThing(dataset, meThingUrl);
    if (!meThing) return [];

    return getUrlAll(meThing, FOAF + "knows");
  } catch (e) {
    if (e.statusCode === 404) return [];
    console.error("[Friends] getFriends failed:", e);
    return [];
  }
}

/** Add friend to your friends.ttl */
export async function addFriend({ podUrl, friendWebId, fetch }) {
  const friendId = normalizeWebId(friendWebId);
  if (!friendId) throw new Error("Friend WebID is empty.");

  await ensurePublicFitnessContainer(podUrl, fetch);
  const fUrl = friendsUrlFor(podUrl);

  let dataset;
  try {
    dataset = await getSolidDataset(fUrl, { fetch });
  } catch {
    dataset = createSolidDataset();
  }

  const meThingUrl = `${fUrl}#me`;
  let meThing = getThing(dataset, meThingUrl);

  let builder = meThing
    ? buildThing(meThing)
    : buildThing(createThing({ url: meThingUrl }))
        .addUrl(RDF.type, FOAF + "Person");

  const existing = getUrlAll(meThing || builder.build(), FOAF + "knows")
    .map(normalizeWebId);

  if (!existing.includes(friendId)) {
    builder = builder.addUrl(FOAF + "knows", friendId);
  }

  dataset = setThing(dataset, builder.build());
  await saveSolidDatasetAt(fUrl, dataset, { fetch });

  return friendId;
}

/** Find the root Pod URL of a friend from their WebID */
export async function getFriendPodUrl({ friendWebId, fetch }) {
  const pods = await getPodUrlAll(friendWebId, { fetch });
  if (!pods[0]) return null;
  return rootPodUrl(pods[0]) + "/";
}

/** Mutual check: they have you in their friends.ttl too */
export async function isMutualFriend({ myWebId, friendWebId, fetch }) {
  const friendPodRoot = await getFriendPodUrl({ friendWebId, fetch });
  if (!friendPodRoot) return false;

  const theirFriends = (await getFriends({ podUrl: friendPodRoot, fetch }))
    .map(normalizeWebId);

  const theirSet = new Set(theirFriends.flatMap(variants));
  const myVars = variants(myWebId);

  return myVars.some(v => theirSet.has(normalizeWebId(v)));
}

/**
 * ✅ NEW
 * Check if:
 * 1) friendship is mutual
 * 2) you have read access to /private/fitness/index.ttl
 * Returns: { mutual, access, reason }
 */
export async function checkFriendActivitiesAccess({ myWebId, friendWebId, fetch }) {
  const friendPodRoot = await getFriendPodUrl({ friendWebId, fetch });
  if (!friendPodRoot) {
    return { mutual: false, access: false, reason: "friend pod not found" };
  }

  const mutual = await isMutualFriend({ myWebId, friendWebId, fetch });
  if (!mutual) {
    return { mutual: false, access: false, reason: "not mutual yet" };
  }

  const indexUrl = buildIndexUrl(friendPodRoot);

  try {
    await getFile(indexUrl, { fetch }); // just testing access
    return { mutual: true, access: true, reason: "ok" };
  } catch (e) {
    if (e.statusCode === 401 || e.statusCode === 403) {
      return { mutual: true, access: false, reason: "no permission to /private/fitness/" };
    }
    if (e.statusCode === 404) {
      return { mutual: true, access: false, reason: "friend has no index.ttl yet" };
    }
    return { mutual: true, access: false, reason: e.message || "unknown error" };
  }
}