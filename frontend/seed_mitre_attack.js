#!/usr/bin/env node

const baseUrl = process.env.API_BASE_URL || "http://127.0.0.1:3000";
const count = Number(process.argv[2] || process.env.SEED_COUNT || 200);
const exportOnly = process.argv.includes("--export-only");
const urls = { incidents: `${baseUrl}/api/incidents`, assets: `${baseUrl}/api/assets`, iocs: `${baseUrl}/api/iocs`, analysts: `${baseUrl}/api/analysts` };

const mitre = [
  ["Initial Access", "Phishing", "High"], ["Execution", "Command and Scripting Interpreter", "High"], ["Persistence", "Valid Accounts", "Medium"],
  ["Privilege Escalation", "Exploitation for Privilege Escalation", "Critical"], ["Defense Evasion", "Obfuscated Files or Information", "Medium"],
  ["Credential Access", "Brute Force", "High"], ["Discovery", "Network Service Scanning", "Low"], ["Lateral Movement", "Remote Services", "High"],
  ["Collection", "Data from Local System", "Medium"], ["Exfiltration", "Exfiltration Over Web Service", "Critical"]
];
const areas = ["homepage", "login page", "checkout page", "customer dashboard", "search API", "payment webhook", "admin portal", "product catalog"];
const traffic = ["normal browsing traffic", "checkout rush traffic", "scheduled admin traffic", "partner API traffic", "marketing campaign traffic"];
const sources = ["WAF", "CDN logs", "SIEM", "Endpoint Agent", "Cloud monitor"];
const labels = ["True Positive", "False Positive", "False Negative", "True Negative"];
const words = ["secure", "billing", "auth", "verify", "promo", "account"];
const endings = [".com", ".net", ".org", ".co"];
const openStates = ["Open", "In Progress"];
const analysts = [
  { Name: "Farhan Tanvir", Role: "SOC Analyst", Email: "farhant@sims.com" },
  { Name: "Fahiyeen Nasser", Role: "Incident Responder", Email: "fahiyeenn@sims.com" },
  { Name: "Minh Nguyen", Role: "Threat Analyst", Email: "minhn@sims.com" },
  { Name: "Ava Patel", Role: "SOC Analyst", Email: "avap@sims.com" },
  { Name: "Jordan Lee", Role: "Threat Analyst", Email: "jordanl@sims.com" }
];

const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (list) => list[rand(0, list.length - 1)];
const stamp = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`;
const makeIp = () => `${rand(23, 212)}.${rand(1, 255)}.${rand(1, 255)}.${rand(1, 254)}`;
const makeHash = () => Array.from({ length: 32 }, () => pick("abcdef0123456789")).join("");
const makeDomain = () => `${pick(words)}-${pick(words)}-${rand(10, 999)}${pick(endings)}`;
const makeAssets = (index) => Array.from({ length: rand(1, 3) }, (_, i) => ({ Hostname: `web-${rand(1, 8)}-${index}-${i + 1}`, IP_Address: makeIp(), Source: pick(sources) }));
const makeIocs = () => [{ Type: "IP", Value: makeIp() }, { Type: "Hash", Value: makeHash() }, { Type: "Domain", Value: makeDomain() }].slice(0, rand(1, 3));
const makeNotes = (createdAt, label, tactic, technique) => [
  { Content: `Reviewed ${tactic} activity tied to ${technique}. Detection result was marked as ${label}.`, Time: createdAt },
  { Content: `${pick(analysts).Name} compared the event against normal site traffic and triage notes.`, Time: createdAt }
].slice(0, rand(1, 2));

function makeIncident(index) {
  const [tactic, technique, severity] = pick(mitre);
  const label = labels[index % labels.length];
  const area = pick(areas);
  const trafficType = pick(traffic);
  const created = new Date();
  created.setDate(created.getDate() - rand(0, 45));
  created.setHours(rand(0, 23), rand(0, 59), rand(0, 59), 0);

  const closed = new Date(created);
  closed.setHours(closed.getHours() + rand(2, 96));
  const isClosed = Math.random() > 0.45;
  const createdAt = stamp(created);

  return {
    IncidentID: index + 1,
    Title: `${technique} seen on ${area}`,
    Description: `${label}. ${tactic} behavior was observed on the ${area} during ${trafficType}. The site still had normal visitors and expected activity while this event was being reviewed.`,
    Created_At: createdAt,
    Closed_At: isClosed ? stamp(closed) : "",
    TTR: isClosed ? `${rand(2, 96)} hours` : "",
    Status: isClosed ? (label === "False Positive" ? "False Positive" : "Closed") : pick(openStates),
    Severity: severity,
    DetectionClassification: label,
    MITRE_Tactic: tactic,
    MITRE_Technique: technique,
    WebsiteArea: area,
    TrafficProfile: trafficType,
    Analyst: pick(analysts),
    Assets: makeAssets(index),
    IOCs: makeIocs(),
    Notes: makeNotes(createdAt, label, tactic, technique)
  };
}

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
  return response.json().catch(() => []);
}

async function post(url, body) {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
  return response.json().catch(() => ({}));
}

async function ensureAnalysts() {
  const existing = await getJson(urls.analysts);
  const map = new Map(existing.map((item) => [item.Email, item.AnalystID]));
  for (const analyst of analysts) {
    if (map.has(analyst.Email)) continue;
    const saved = await post(urls.analysts, analyst);
    map.set(analyst.Email, saved.AnalystID);
  }
  return map;
}

async function seedOne(incident, analystMap) {
  const savedIncident = await post(urls.incidents, { Title: incident.Title, Description: incident.Description, Status: incident.Status, Severity: incident.Severity });

  for (const asset of incident.Assets) {
    const savedAsset = await post(urls.assets, asset);
    await post(`${urls.incidents}/${savedIncident.IncidentID}/assets/${savedAsset.AssetID}`, {});
  }
  for (const ioc of incident.IOCs) {
    const savedIoc = await post(urls.iocs, ioc);
    await post(`${urls.incidents}/${savedIncident.IncidentID}/iocs/${savedIoc.IOCID}`, {});
  }

  const analystID = analystMap.get(incident.Analyst.Email);
  if (analystID) await post(`${urls.incidents}/${savedIncident.IncidentID}/analysts/${analystID}`, {});
  for (const note of incident.Notes) await post(`${urls.incidents}/${savedIncident.IncidentID}/notes`, { Content: note.Content });
}

async function main() {
  const data = Array.from({ length: count }, (_, i) => makeIncident(i));
  console.log(`Generated ${data.length} fake incident bundles for ${urls.incidents}`);
  if (exportOnly) return void console.log(JSON.stringify(data, null, 2));

  const analystMap = await ensureAnalysts();
  let sent = 0;
  for (const incident of data) {
    try {
      await seedOne(incident, analystMap);
      sent += 1;
      if (sent % 25 === 0 || sent === data.length) console.log(`Posted ${sent}/${data.length}`);
    } catch (error) {
      console.error(`Failed on IncidentID ${incident.IncidentID}: ${error.message}`);
    }
  }

  console.log("Done seeding incidents and their related records.");
  console.log(`Successfully posted ${sent}/${data.length} incident bundles.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
