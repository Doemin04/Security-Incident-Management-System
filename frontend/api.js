const apiBase = "http://localhost:3000/api";
const $ = (id) => document.getElementById(id);
const tableBody = $("incident-table-body");
const detailsBox = $("incident-details");
const correlationBox = $("correlation-results");
const assetListBox = $("asset-list");
const iocListBox = $("ioc-list");
const analystListBox = $("analyst-list");
const importResultBox = $("import-result");
const logReviewContainer = $("log-review-container");

let incidents = [];
let assets = [];
let iocs = [];
let analysts = [];
let logs = [];
let currentIncidentID = null;
let loadingIncidents = false;
let loadingCorrelations = false;
let loadingAssets = false;
let loadingIocs = false;
let loadingAnalysts = false;
let loadingLogs = false;
let correlations = [];

const escapeHtml = (text) => String(text ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

const showError = (error) => window.alert(error.message || "Something went wrong.");
const confirmAction = (message) => !message || window.confirm(message);

function formatDate(value, emptyText = "Not closed") {
  if (!value) return emptyText;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return escapeHtml(String(value).replace("T", " ").replace(".000Z", ""));
  return date.toLocaleString("en-US", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
  }).replace(",", "");
}

async function api(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error((await response.text()) || `Request failed: ${response.status}`);
  return response.json().catch(() => []);
}

async function runAction(workText, task) {
  if (currentIncidentID) detailsBox.innerHTML = `<p class="muted">${workText}</p>`;
  try {
    await task();
  } catch (error) {
    showError(error);
    await refreshCurrentIncident();
  }
}

async function loadIncidents() {
  loadingIncidents = true;
  showTable();
  try {
    incidents = await api(`${apiBase}/incidents`);
    updateSummary();
  } finally {
    loadingIncidents = false;
    showTable();
  }
}

async function loadAssets() {
  loadingAssets = true;
  showAssetManagement();
  try {
    assets = await api(`${apiBase}/assets`);
  } finally {
    loadingAssets = false;
    showAssetManagement();
  }
}

async function loadIocs() {
  loadingIocs = true;
  showIocManagement();
  try {
    iocs = await api(`${apiBase}/iocs`);
  } finally {
    loadingIocs = false;
    showIocManagement();
  }
}

async function loadAnalysts() {
  loadingAnalysts = true;
  showAnalystManagement();
  try {
    analysts = await api(`${apiBase}/analysts`);
  } finally {
    loadingAnalysts = false;
    showAnalystManagement();
  }
}

async function loadCorrelations() {
  if (!correlationBox) return;
  loadingCorrelations = true;
  showCorrelations();
  try {
    correlations = await api(`${apiBase}/correlation/threats`);
  } catch (error) {
    correlations = [];
    correlationBox.innerHTML = `<p class="muted">Could not load threat correlation: ${escapeHtml(error.message)}</p>`;
    return;
  }
  loadingCorrelations = false;
  showCorrelations();
}

async function loadLogs() {
  loadingLogs = true;
  showLogReview();
  try {
    logs = await api(`${apiBase}/logs`);
  } finally {
    loadingLogs = false;
    showLogReview();
  }
}
