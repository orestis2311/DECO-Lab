// src/services/Activities.js
import { getFile } from "@inrupt/solid-client";
//import { Parser, DataFactory } from "n3";
import { Parser } from "n3";
//const { namedNode, literal } = DataFactory;

const DCT = "http://purl.org/dc/terms/";
const LDP = "http://www.w3.org/ns/ldp#";
const FIT = "http://example.org/fitness#";
const RDF = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
const XSD = "http://www.w3.org/2001/XMLSchema#";

export function buildIndexUrl(podUrl) {
  return `${podUrl.replace(/\/+$/, "")}/private/fitness/index.ttl`;
}

/**
 * Read /private/fitness/index.ttl and return a list of activity summaries.
 * Each item: { id, url, type, title, createdAt, totalDistance, durationSeconds, avgHeartRate }
 */
export async function listActivitiesFromIndex({ fetch, podUrl }) {

  console.log("[DEBUG] listActivitiesFromIndex podUrl:", podUrl);

  const indexUrl = buildIndexUrl(podUrl);
  console.log("[DEBUG] listActivitiesFromIndex indexUrl:", indexUrl);

  let ttl = "";
  try {
    const file = await getFile(indexUrl, { fetch });
    ttl = await file.text();
    console.log("[Activities] Fetched index.ttl, length:", ttl.length);

  } catch (e) {
    console.error("[Activities] Failed to fetch index:", e);
    return [];
  }

  const parser = new Parser({ baseIRI: indexUrl });
  const quads = parser.parse(ttl);
  console.log("[Activities] Parsed quads:", quads.length);

  // First pass: collect all activity URLs from ldp:contains
  const activityUrls = new Set();
  for (const q of quads) {
    if (q.predicate.value === `${LDP}contains`) {
      activityUrls.add(q.object.value);
      console.log("[Activities] Found activity URL:", q.object.value);
    }
  }

  console.log("[DEBUG] total contains URLs found:", activityUrls.size);
  console.log("[DEBUG] contains URLs array:", Array.from(activityUrls));

  // Second pass: collect properties for those activities
  const bySubject = new Map();
  for (const url of activityUrls) {
    bySubject.set(url, { url });
  }

  for (const q of quads) {
    const s = q.subject.value;
    const p = q.predicate.value;
    const o = q.object;

    const entry = bySubject.get(s);
    if (!entry) continue;

    switch (p) {
      case `${RDF}type`:
        if (o.termType === "NamedNode" && o.value.startsWith(FIT)) {
          entry.type = o.value.slice(FIT.length);
        }
        break;

      case `${DCT}title`:
        if (o.termType === "Literal") entry.title = o.value;
        break;

      case `${DCT}created`:
        if (o.termType === "Literal") entry.createdAt = o.value;
        break;

      case `${FIT}totalDistance`:
        if (o.termType === "Literal") entry.totalDistance = Number(o.value);
        break;

      case `${FIT}duration`:
        entry.durationSeconds = durationLiteralToSeconds(o);
        break;

      case `${FIT}averageHeartRate`:
        if (o.termType === "Literal") entry.avgHeartRate = Number(o.value);
        break;

      default:
        break;
    }
  }

  console.log("[Activities] Parsed entries:", [...bySubject.values()]);

  // normalize + id
  const list = [...bySubject.values()].map((a) => ({
    id: toFileName(a.url),
    url: a.url,
    type: a.type || "Activity",
    title: a.title || toFileName(a.url),
    createdAt: a.createdAt || null,
    distanceMeters: a.totalDistance ?? null,
    durationSeconds: a.durationSeconds ?? null,
    avgHeartRate: a.avgHeartRate ?? null,
  }));

  // sort by created desc if present
  list.sort((a, b) => {
    const ta = a.createdAt ? Date.parse(a.createdAt) : 0;
    const tb = b.createdAt ? Date.parse(b.createdAt) : 0;
    return tb - ta;
  });

  console.log("[Activities] Final list:", list);
  return list;
}


function durationLiteralToSeconds(obj) {
  // obj is a literal like "PT25M"^^xsd:duration or just "PT25M"
  const v = obj.termType === "Literal" ? obj.value : null;
  if (!v) return null;
  const h = +(/(\d+)H/.exec(v)?.[1] ?? 0);
  const m = +(/(\d+)M/.exec(v)?.[1] ?? 0);
  const s = +(/(\d+)S/.exec(v)?.[1] ?? 0);
  return h * 3600 + m * 60 + s;
}

function toFileName(url) {
  try {
    const u = new URL(url);
    return u.pathname.split("/").pop() || url;
  } catch {
    return url;
  }
}

/** Fetch the raw TTL of a specific activity URL (for the right panel/map). */
export async function fetchActivityTtl({ fetch, activityUrl }) {
  try {
    const file = await getFile(activityUrl, { fetch });
    return await file.text();
  } catch (e) {
    console.error("[Activities] Failed to fetch activity TTL:", e);
    throw new Error(`Failed to fetch activity: ${e.message}`);
  }
}