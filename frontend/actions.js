const refreshCurrentIncident = async () => { if (currentIncidentID) await selectIncident(currentIncidentID); };

async function selectIncident(incidentID) {
  currentIncidentID = incidentID;
  showTable();

  const incident = incidents.find((item) => item.IncidentID === incidentID);
  if (!incident) return;

  $("update-status").value = incident.Status;
  $("update-severity").value = incident.Severity;
  detailsBox.innerHTML = '<p class="muted">Loading incident details...</p>';

  try {
    const results = await Promise.allSettled([
      api(`${apiBase}/incidents/${incidentID}/notes`),
      api(`${apiBase}/incidents/${incidentID}/assets`),
      api(`${apiBase}/incidents/${incidentID}/iocs`),
      api(`${apiBase}/incidents/${incidentID}/analysts`),
      api(`${apiBase}/assets`),
      api(`${apiBase}/iocs`),
      api(`${apiBase}/analysts`)
    ]);

    const read = (index) => results[index].status === "fulfilled" ? results[index].value : [];
    showIncidentDetails(incident, read(0), read(1), read(2), read(3), read(4), read(5), read(6));
  } catch (error) {
    detailsBox.textContent = `Could not load incident details: ${error.message}`;
  }
}

async function changeLink(path, method, confirmText) {
  if (!confirmAction(confirmText)) return;
  await runAction("Saving changes...", async () => {
    await api(`${apiBase}${path}`, { method });
    await refreshCurrentIncident();
    await loadCorrelations();
  });
}

const deleteNote = (incidentID, noteID) => changeLink(`/incidents/${incidentID}/notes/${noteID}`, "DELETE", "Delete this note?");
const linkAsset = () => { const assetID = $("asset-link")?.value; if (currentIncidentID && assetID) return changeLink(`/incidents/${currentIncidentID}/assets/${assetID}`, "POST"); };
const unlinkAsset = (assetID) => currentIncidentID && changeLink(`/incidents/${currentIncidentID}/assets/${assetID}`, "DELETE", "Remove this asset from the incident?");
const linkIoc = () => { const iocID = $("ioc-link")?.value; if (currentIncidentID && iocID) return changeLink(`/incidents/${currentIncidentID}/iocs/${iocID}`, "POST"); };
const unlinkIoc = (iocID) => currentIncidentID && changeLink(`/incidents/${currentIncidentID}/iocs/${iocID}`, "DELETE", "Remove this IOC from the incident?");
const assignAnalyst = () => { const analystID = $("analyst-link")?.value; if (currentIncidentID && analystID) return changeLink(`/incidents/${currentIncidentID}/analysts/${analystID}`, "POST"); };
const unassignAnalyst = (analystID) => currentIncidentID && changeLink(`/incidents/${currentIncidentID}/analysts/${analystID}`, "DELETE", "Unassign this analyst from the incident?");

async function deleteIncident() {
  if (!currentIncidentID || !confirmAction("Delete this incident?")) return;
  await runAction("Deleting incident...", async () => {
    await api(`${apiBase}/incidents/${currentIncidentID}`, { method: "DELETE" });
    currentIncidentID = null;
    detailsBox.textContent = "Select an incident to see its details.";
    $("update-status").value = "Open";
    $("update-severity").value = "Low";
    await loadIncidents();
    await loadCorrelations();
  });
}

async function createAsset() {
  await runAction("Creating asset...", async () => {
    const body = {
      Hostname: $("asset-hostname").value,
      IP_Address: $("asset-ip").value,
      Source: $("asset-source").value,
    };
    await api(`${apiBase}/assets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    $("asset-form").reset();
    await loadAssets();
    await refreshCurrentIncident();
  });
}

async function deleteAsset(assetID) {
  if (!confirmAction("Delete this asset?")) return;
  await runAction("Deleting asset...", async () => {
    await api(`${apiBase}/assets/${assetID}`, { method: "DELETE" });
    await loadAssets();
    await refreshCurrentIncident();
  });
}

async function createIoc() {
  await runAction("Creating IOC...", async () => {
    const body = {
      Type: $("ioc-type").value,
      Value: $("ioc-value").value,
    };
    await api(`${apiBase}/iocs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    $("ioc-form").reset();
    await loadIocs();
    await refreshCurrentIncident();
  });
}

async function deleteIoc(iocID) {
  if (!confirmAction("Delete this IOC?")) return;
  await runAction("Deleting IOC...", async () => {
    await api(`${apiBase}/iocs/${iocID}`, { method: "DELETE" });
    await loadIocs();
    await refreshCurrentIncident();
  });
}

async function createAnalyst() {
  await runAction("Creating analyst...", async () => {
    const body = {
      Name: $("analyst-name").value,
      Role: $("analyst-role").value,
      Email: $("analyst-email").value,
    };
    await api(`${apiBase}/analysts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    $("analyst-form").reset();
    await loadAnalysts();
    await refreshCurrentIncident();
  });
}

async function deleteAnalyst(analystID) {
  if (!confirmAction("Delete this analyst?")) return;
  await runAction("Deleting analyst...", async () => {
    await api(`${apiBase}/analysts/${analystID}`, { method: "DELETE" });
    await loadAnalysts();
    await refreshCurrentIncident();
  });
}

async function importLogs() {
  await runAction("Importing logs...", async () => {
    const payload = {
      logText: $("log-text").value,
      sourceSystem: $("log-source-system").value || 'Frontend Import',
      limit: parseInt($("log-limit").value, 10) || undefined,
    };

    const result = await api(`${apiBase}/log-import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    importResultBox.textContent = `Imported ${result.ingested} of ${result.totalLines} lines. Skipped ${result.skipped}, failed ${result.failed}.`;
    $("log-import-form").reset();
    await Promise.all([loadIncidents(), loadAssets(), loadIocs(), loadAnalysts(), loadCorrelations(), loadLogs()]);
  });
}

async function deleteLog(logEventID) {
  if (!confirmAction("Delete this log?")) return;
  await runAction("Deleting log...", async () => {
    await api(`${apiBase}/logs/${logEventID}`, { method: "DELETE" });
    await loadLogs();
  });
}

async function createIncidentFromLog() {
  if (selectedLogID === null) return;

  const log = logs.find((item) => item.LogEventID === selectedLogID);
  if (!log) return;

  const title = $("log-incident-title").value;
  const description = $("log-incident-description").value;
  const severity = $("log-incident-severity").value;

  if (!title || !description) {
    showError(new Error("Title and description are required."));
    return;
  }

  await runAction("Creating incident from log...", async () => {
    const extractedIPs = {
      sourceIPs: log.SourceIP ? [log.SourceIP] : [],
      destinationIPs: log.DestinationIP ? [log.DestinationIP] : [],
    };

    await api(`${apiBase}/logs/${log.LogEventID}/create-incident`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ Title: title, Description: description, Severity: severity, extractedIPs }),
    });

    closeLogIncidentDialog();
    await Promise.all([loadIncidents(), loadLogs(), loadAssets(), loadCorrelations()]);
  });
}
