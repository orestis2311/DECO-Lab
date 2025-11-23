import { getFile, overwriteFile } from "@inrupt/solid-client";
import { Parser, Writer, DataFactory } from "n3";

const { namedNode, literal } = DataFactory;

const DCTERMS = "http://purl.org/dc/terms/";
const LDP = "http://www.w3.org/ns/ldp#";
const FIT = "http://example.org/fitness#";
const RDF = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
const XSD = "http://www.w3.org/2001/XMLSchema#";

function secondsToDurationLiteral(seconds) {
  if (!seconds || seconds <= 0) return null;
  const s = Math.floor(seconds % 60);
  const m = Math.floor((seconds / 60) % 60);
  const h = Math.floor(seconds / 3600);
  let str = "PT";
  if (h > 0) str += `${h}H`;
  if (m > 0) str += `${m}M`;
  if (s > 0 || (h === 0 && m === 0)) str += `${s}S`;
  return literal(str, namedNode(`${XSD}duration`));
}

function createEmptyIndexWriter(webId) {
  const writer = new Writer({
    prefixes: { dcterms: DCTERMS, ldp: LDP, fit: FIT, xsd: XSD },
  });
  const container = namedNode("#");
  writer.addQuad(container, namedNode(`${RDF}type`), namedNode(`${LDP}BasicContainer`));
  writer.addQuad(container, namedNode(`${DCTERMS}title`), literal("Fitness Activity Data"));
  if (webId) writer.addQuad(container, namedNode(`${DCTERMS}creator`), namedNode(webId));
  writer.addQuad(
    container,
    namedNode(`${DCTERMS}created`),
    literal(new Date().toISOString(), namedNode(`${XSD}dateTime`))
  );
  return writer;
}

/**
 * Append to /private/fitness/index.ttl (create if missing)
 * @param {Object} opts
 * @param {*} opts.fetch            session.fetch from a logged-in Solid session
 * @param {string} opts.podUrl      e.g. "https://<user>.pod.inrupt.com"
 * @param {string} opts.activityFileUrl
 * @param {Object} opts.meta { activityType, title, creator, created, modified, totalDistance, durationSeconds, avgHeartRate }
 */
export async function updateIndexWithActivity({ fetch, podUrl, activityFileUrl, meta }) {
  if (!fetch) throw new Error("updateIndexWithActivity: fetch is required.");
  if (!podUrl) throw new Error("updateIndexWithActivity: podUrl is required.");
  if (!activityFileUrl) throw new Error("updateIndexWithActivity: activityFileUrl is required.");

  const indexUrl = `${podUrl.replace(/\/+$/, "")}/private/fitness/index.ttl`;

  let existingTtl = null;
  try {
    const file = await getFile(indexUrl, { fetch });
    existingTtl = await file.text();
  } catch (e) {
    existingTtl = null; // create new
  }

  const container = namedNode("#");
  const activityNode = namedNode(activityFileUrl);

  let writer;
  if (existingTtl) {
    const parser = new Parser();
    const quads = parser.parse(existingTtl);
    writer = new Writer({ prefixes: { dcterms: DCTERMS, ldp: LDP, fit: FIT, xsd: XSD } });
    quads.forEach((q) => writer.addQuad(q));
  } else {
    writer = createEmptyIndexWriter(meta?.creator || null);
  }

  writer.addQuad(container, namedNode(`${LDP}contains`), activityNode);

  if (meta?.activityType) {
    writer.addQuad(activityNode, namedNode(`${RDF}type`), namedNode(`${FIT}${meta.activityType}`));
  }
  if (meta?.title) {
    writer.addQuad(activityNode, namedNode(`${DCTERMS}title`), literal(meta.title));
  }
  if (meta?.creator) {
    writer.addQuad(activityNode, namedNode(`${DCTERMS}creator`), namedNode(meta.creator));
  }
  if (meta?.created) {
    writer.addQuad(
      activityNode,
      namedNode(`${DCTERMS}created`),
      literal(meta.created, namedNode(`${XSD}dateTime`))
    );
  }
  if (meta?.modified) {
    writer.addQuad(
      activityNode,
      namedNode(`${DCTERMS}modified`),
      literal(meta.modified, namedNode(`${XSD}dateTime`))
    );
  }
  if (meta?.totalDistance != null) {
    writer.addQuad(activityNode, namedNode(`${FIT}totalDistance`), literal(String(meta.totalDistance)));
  }
  const durationLit = secondsToDurationLiteral(meta?.durationSeconds);
  if (durationLit) writer.addQuad(activityNode, namedNode(`${FIT}duration`), durationLit);
  if (meta?.avgHeartRate != null) {
    writer.addQuad(activityNode, namedNode(`${FIT}averageHeartRate`), literal(String(meta.avgHeartRate)));
  }

  const newTtl = await new Promise((resolve, reject) => {
    writer.end((err, result) => (err ? reject(err) : resolve(result)));
  });

  const blob = new Blob([newTtl], { type: "text/turtle" });
  await overwriteFile(indexUrl, blob, { contentType: "text/turtle", fetch });
}
