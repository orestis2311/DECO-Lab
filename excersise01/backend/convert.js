// fix this logic

// convert.js (module)

const xml2js = require("xml2js");
const $rdf = require("rdflib");

const RDF  = $rdf.Namespace("http://www.w3.org/1999/02/22-rdf-syntax-ns#");
const FIT  = $rdf.Namespace("http://example.org/fitness#");
const FOAF = $rdf.Namespace("http://xmlns.com/foaf/0.1/");
const XSD  = $rdf.Namespace("http://www.w3.org/2001/XMLSchema#");
const DC   = $rdf.Namespace("http://purl.org/dc/terms/");

const litInt     = (n) => $rdf.literal(String(n), undefined, XSD("integer"));

let acNo ;
let lapNo ;
let trackNo ;
let trackPointNo ;
let personNo ;
let sensorDataNo ;
let fileID ;
let deviceNo ;
let g;


function resetVariables(){

  acNo = 1;
  lapNo = 1;
  trackNo = 1;
  trackPointNo = 1;
  personNo = 1;
  sensorDataNo = 1;
  fileID = 1;
  deviceNo = 1;
  g = $rdf.graph();
  g.namespaces = {
    rdf:  "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
    fit:  "http://example.org/fitness#",
    foaf: "http://xmlns.com/foaf/0.1/",
    xsd:  "http://www.w3.org/2001/XMLSchema#",
    dc:   "http://purl.org/dc/terms/",
  };
}

//manually adds missing prefixes
function ensurePrefixes(ttlText) {
  const prefixes = {
    rdf:  "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
    fit:  "http://example.org/fitness#",
    foaf: "http://xmlns.com/foaf/0.1/",
    xsd:  "http://www.w3.org/2001/XMLSchema#",
    dc:   "http://purl.org/dc/terms/",
  };

  for (const [prefix, uri] of Object.entries(prefixes)) {
    const regex = new RegExp(`^@prefix\\s+${prefix}:`, "m");
    if (!regex.test(ttlText)) {
      ttlText = `@prefix ${prefix}: <${uri}> .\n` + ttlText;
    }
  }

  return ttlText.trim() + "\n";
}

//assumption is the activities is done by one person
async function convertTcxToTtl(tcxText) {
  console.log("before calling resetvariables");
  resetVariables();

  console.log("before parsing xml");
  const tcx = await parseXml(tcxText);
  const db  = tcx.TrainingCenterDatabase;
  const activities = db?.Activities?.[0].Activity;
  const person = FIT("athlete1");

  //assuming one device and person per device
  g.add(person, RDF("type"), FOAF("Person"));
  g.add(FIT("device1"), RDF("type"), FIT("Device"));
  for (const activity of activities){
      handleActivity(activity);
  }

  //method 1

  let ttlText = $rdf.serialize(
    undefined,  // base
    g,          // graph
    undefined,  // base URI
    "text/turtle"
  );

  /*

  //method 2
  // replace your serialize call with this:
  const serializer = new $rdf.Serializer(g);
  serializer.setBase(undefined);
  serializer.setNamespaces(g.namespaces);
  serializer.setFlags("useNativeTypes", false);   // <— critical: forces ^^xsd:*
  const ttlText = serializer.statementsToN3(g.statements);
  */

  //ading the data types manually
  ttlText = ttlText
  // integers
  .replace(/(fit:heartRate\s+)"(-?\d+)"/g,      `$1"$2"^^xsd:integer`)
  .replace(/(fit:maxHeartRate\s+)"(-?\d+)"/g,   `$1"$2"^^xsd:integer`)
  // decimals
  .replace(/(fit:latitude\s+)"(-?\d+(?:\.\d+)?)"/g,  `$1"$2"^^xsd:decimal`)
  .replace(/(fit:longitude\s+)"(-?\d+(?:\.\d+)?)"/g, `$1"$2"^^xsd:decimal`)
  .replace(/(fit:averageHeartRate\s+)"(-?\d+(?:\.\d+)?)"/g, `$1"$2"^^xsd:decimal`)
  // floats
  .replace(/(fit:powerOutput\s+)"(-?\d+(?:\.\d+)?)"/g, `$1"$2"^^xsd:float`)
  .replace(/(fit:totalDistance\s+)"(-?\d+(?:\.\d+)?)"/g, `$1"$2"^^xsd:float`)
  .replace(/(fit:totalPowerOutput\s+)"(-?\d+(?:\.\d+)?)"/g, `$1"$2"^^xsd:float`)
  // duration & dateTime
  .replace(/(fit:duration\s+)"([^"]+)"/g,  `$1"$2"^^xsd:duration`)
  .replace(/(fit:timestamp\s+)"([^"]+)"/g, `$1"$2"^^xsd:dateTime`);

  ttlText = ensurePrefixes(ttlText);

  return ttlText;

}


//add all statements that have to do with the activity
function handleActivity(activity){

  const sport = activity.$?.Sport || "Activity";
  const activityNode = FIT("ac" + acNo);

  //add activity instance creation statement
  g.add(activityNode, RDF("type"), FIT(sport));
  //handle person
  g.add(activityNode, FIT("performedBy"), FOAF("athlete1"));

  // ---------- NEW: DC metadata ----------
  // In TCX, <Id> of the Activity is usually the start time
  const activityId = activity.Id?.[0]; // e.g. "2024-04-14T07:36:13.000Z"

  // Title like "Running activity on 2024-04-14"
  const title = activityId
    ? `${sport} activity on ${activityId.substring(0, 10)}`
    : `${sport} activity`;

  // dc:title as a simple string
  g.add(activityNode, DC("title"), $rdf.literal(title));

  // dc:created as xsd:dateTime (if we have a timestamp)
  if (activityId) {
    g.add(
      activityNode,
      DC("created"),
      $rdf.literal(activityId, undefined, XSD("dateTime"))
    );
  }
  // ---------- END DC metadata ----------

  console.log("Before average heart Rate");
  extractAverageHeartRate(activity);

  console.log("Before max heart Rate");
  extractMaxHeartRate(activity);

  console.log("Before duration");
  extractDuration(activity);

  console.log("Before total distance");
  extractTotalDistance(activity);

  console.log("Before power output");
  extractTotalPowerOutput(activity);

  console.log("Before all trackpoints");
  extractAllTrackPoints(activity);

  acNo++;
}


function extractAllTrackPoints(activity){
  console.log("Before get trackpoints");
  const trackpoints = getTrackpoints(activity);

  let i = 1;
  for (const tp of trackpoints){
    console.log("Before handleTrackpoint "+i);
    i++;
    handleTrackpoint(tp);
  }
}

function handleTrackpoint(trackpoint){
  g.add(FIT("tp" + trackPointNo), RDF("type"), FIT("Trackpoint"));
  g.add(FIT("ac" +acNo), FIT("hasTrackpoint"), FIT("tp" + trackPointNo));

  console.log("before sensordata");
  extractSensorData(trackpoint);

  console.log("before devicerecordedby");
  extractDeviceRecordedBy(trackpoint);

  extractTimestamp(trackpoint);

  trackPointNo++;
}

function extractTimestamp(trackpoint){

  let timestamp = trackpoint.Time[0];
  let object = $rdf.literal(String(timestamp),undefined,XSD("dateTime"));
  g.add(FIT("tp" + trackPointNo), FIT("timestamp"), object);


}

function extractDeviceRecordedBy(trackpoint){


  //assuming each activity has a creator
  g.add(FIT("tp" + trackPointNo), FIT("recordedBy"), FIT("device1"));

}

function extractSensorData(trackpoint){

  g.add(FIT("tp" + trackPointNo), FIT("hasSensorData"), FIT("sd" + sensorDataNo));
  //create sensorData
  g.add(FIT("sd" + sensorDataNo), RDF("type"), FIT("SensorData"));


  console.log("before latitude");
  //handle Latitude data
  const latitudeDegrees = Number(trackpoint.Position[0].LatitudeDegrees[0]);
  let object = $rdf.literal(String(latitudeDegrees),undefined,XSD("decimal"));
  g.add(FIT("sd" + sensorDataNo) , FIT("latitude"), object);

  console.log("before longitude");
  //handle longitude data
  const longitudeDegrees = Number(trackpoint.Position[0].LongitudeDegrees[0]);
  object = $rdf.literal(String(longitudeDegrees),undefined,XSD("decimal"));
  g.add(FIT("sd" + sensorDataNo) , FIT("longitude"), object);

  console.log("before heartrate");
  //handling heartRate data
  const heartRate = Number(trackpoint.HeartRateBpm[0].Value[0]);
  object = $rdf.literal(String(heartRate),undefined,XSD("integer"));
  g.add(FIT("sd" + sensorDataNo) , FIT("heartRate"), litInt(heartRate));

  console.log("before poweroutput");
  //handling PowerOutput
  const powerOutput = Number(trackpoint.Extensions[0]?.['ns3:TPX'][0]?.['ns3:Watts'][0]);
  object = $rdf.literal(String(powerOutput),undefined,XSD("float"));
  g.add(FIT("sd" + sensorDataNo) , FIT("powerOutput"), object);


  sensorDataNo++;
}



function extractMaxHeartRate(activity){
  const laps = activity?.Lap;
  let maxHeartRates = [];
  let max = -1;

  laps.forEach((lap) =>{
    maxHeartRates.push(Number(lap.MaximumHeartRateBpm[0].Value[0]));
  })

  for(let i = 0; i<maxHeartRates.length; i++){
    if (maxHeartRates[i] > max){
      max = maxHeartRates[i];
    }
  }

  const subject = FIT("ac" + acNo);
  const predicate = FIT("maxHeartRate");
  const object = $rdf.literal(String(max), undefined, XSD("integer"));

  g.add(subject,predicate,object);

}


function parseXml(text) {
  return new Promise((resolve, reject) =>
    xml2js.parseString(text, { explicitArray: true }, (err, obj) =>
      err ? reject(err) : resolve(obj)
    )
  );
}

function extractAverageHeartRate(activity){

  const laps = activity?.Lap;
  let avgHeartRates = [];
  let times = [];

  laps.forEach((lap) =>{

    avgHeartRates.push(Number(lap.AverageHeartRateBpm[0].Value[0]));
    times.push(Number(lap.TotalTimeSeconds[0]));

  })


  console.log("before avgheartrates forloop");
  let totalBeats = 0
  let totalTime = 0;
  for(let i = 0; i<avgHeartRates.length; i++){
    totalBeats += times[i]*avgHeartRates[i];
    totalTime += times[i];
  }

  const avgHeartRate = totalBeats/totalTime;

  const subject = FIT("ac" + acNo);
  const predicate = FIT("averageHeartRate");
  const object = $rdf.literal(String(avgHeartRate), undefined, XSD("decimal"));

  g.add(subject,predicate,object);
}

function extractDuration(activity){

  const laps = activity?.Lap;

  let duration = 0;
  laps.forEach((lap) =>{

    duration += Number(lap.TotalTimeSeconds[0]);

  })

  const subject = FIT("ac" + acNo);
  const predicate = FIT("duration");
  const object = $rdf.literal(String(toXsdDuration(duration)), undefined, XSD("duration"));

  g.add(subject,predicate,object);

}

function toXsdDuration(seconds) {
  seconds = Math.max(0, Math.round(Number(seconds) || 0));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `PT${h ? h + "H" : ""}${m ? m + "M" : ""}${s ? s + "S" : ""}`;
}

function extractTotalDistance(activity){

  const laps = activity?.Lap;

  let totalDistance = 0;
  for(let i = 0; i<laps.length; i++){
    totalDistance += Number(laps[i].DistanceMeters[0]);
  }

  const subject = FIT("ac" + acNo);
  const predicate = FIT("totalDistance");
  const object = $rdf.literal(String(totalDistance), undefined, XSD("float"));

  g.add(subject,predicate,object);

}

function extractTotalPowerOutput(activity) {
  const trackpoints = getTrackpoints(activity);

  //extract tiumes using map
  const times = trackpoints
    .map(tp => tp?.Time?.[0]?.trim())

  //mapp all trackpoints to its watt value
  const powerOutputs = trackpoints.map(tp => wattsFromTp(tp));

  const n = Math.min(times.length, powerOutputs.length);
  if (n < 2) {
    return;
  }

  let totalPowerOutput = 0; // sum(power[i] * deltaT_i)
  let prevT = times[0];

  // Start at i=1 to compute delta against previous
  for (let i = 1; i < n; i++) {
    const p  = powerOutputs[i];
    totalPowerOutput +=p;

    /*
    const curT = times[i];

    const t1 = Date.parse(prevT);
    const t2 = Date.parse(curT);

    //Skip invalid values
    if (!Number.isFinite(t1) || !Number.isFinite(t2) || !Number.isFinite(p)) {
      prevT = curT;
      continue;
    }

    //milliseconds -> seconds(thats why we do /1000)
    const deltaT = Math.max(0, (t2 - t1) / 1000); // seconds
    totalEnergy += p * deltaT;

    prevT = curT;
    */
  }

  totalPowerOutput = totalPowerOutput/n;

  const subject = FIT("ac" + acNo);
  const predicate = FIT("totalPowerOutput");
  const object    = $rdf.literal(String(totalPowerOutput), undefined, XSD("float"));
  g.add(subject, predicate, object);
}

function getTrackpoints(activity) {
  const laps = activity?.Lap || [];
  const tps = [];
  for (const lap of laps) {
    const tracks = lap?.Track || [];
    for (const tr of tracks) {
      const pts = tr?.Trackpoint || [];
      for (const tp of pts) tps.push(tp);
    }
  }
  return tps;
}

function wattsFromTp(tp) {
  const ext = tp?.Extensions?.[0];
  //different possibilities
    const tpx =
    ext?.TPX?.[0] ||
    ext?.['ns3:TPX']?.[0] ||
    ext?.['ns2:TPX']?.[0] ||
    ext?.['ns:TPX']?.[0];

  const wattsVal =
    tpx.Watts?.[0] ||
    tpx['ns3:Watts']?.[0] ||
    tpx['ns2:Watts']?.[0] ||
    tpx['ns:Watts']?.[0];

  const watts = Number(wattsVal);

  return watts;
}

module.exports = { convertTcxToTtl };

