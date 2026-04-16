$("incident-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  await runAction("Creating incident...", async () => {
    const savedIncident = await api(`${apiBase}/incidents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        Title: $("title").value,
        Description: $("description").value,
        Status: $("status").value,
        Severity: $("severity").value,
      }),
    });

    event.target.reset();
    await loadIncidents();
    await loadCorrelations();
    if (savedIncident?.IncidentID) await selectIncident(savedIncident.IncidentID);
  });
});

$("update-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentIncidentID) return;

  await runAction("Updating incident...", async () => {
    await api(`${apiBase}/incidents/${currentIncidentID}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        Status: $("update-status").value,
        Severity: $("update-severity").value,
      }),
    });

    await loadIncidents();
    await loadCorrelations();
    await refreshCurrentIncident();
  });
});

$("note-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentIncidentID) return;

  await runAction("Adding note...", async () => {
    await api(`${apiBase}/incidents/${currentIncidentID}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ Content: $("note-content").value }),
    });

    event.target.reset();
    await refreshCurrentIncident();
  });
});

$("asset-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  await createAsset();
});

$("ioc-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  await createIoc();
});

$("analyst-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  await createAnalyst();
});

$("log-import-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  await importLogs();
});

$("log-incident-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  await createIncidentFromLog();
});

$("filter").addEventListener("change", showTable);
window.selectIncident = selectIncident;
window.deleteNote = deleteNote;
window.linkAsset = linkAsset;
window.unlinkAsset = unlinkAsset;
window.linkIoc = linkIoc;
window.unlinkIoc = unlinkIoc;
window.assignAnalyst = assignAnalyst;
window.unassignAnalyst = unassignAnalyst;
window.deleteIncident = deleteIncident;
window.deleteAsset = deleteAsset;
window.deleteIoc = deleteIoc;
window.deleteAnalyst = deleteAnalyst;
window.deleteLog = deleteLog;
window.openLogIncidentDialog = openLogIncidentDialog;
window.closeLogIncidentDialog = closeLogIncidentDialog;
window.setSort = setSort;

Promise.all([loadIncidents(), loadAssets(), loadIocs(), loadAnalysts(), loadCorrelations(), loadLogs()]).catch(() => {
  detailsBox.textContent = "Could not load the API. Make sure the backend is running on localhost:3000.";
  if (correlationBox) correlationBox.textContent = "Could not load the API. Make sure the backend is running on localhost:3000.";
  if (assetListBox) assetListBox.textContent = "Could not load resources.";
  if (iocListBox) iocListBox.textContent = "Could not load resources.";
  if (analystListBox) analystListBox.textContent = "Could not load resources.";
});
