const severityOrder = ['Low', 'Medium', 'High', 'Critical'];
const statusOrder = ['Open', 'In Progress', 'Closed', 'False Positive'];
let sortField = 'IncidentID';
let sortDirection = 'desc';
let logReviewQuery = '';
let logReviewPage = 1;
const logReviewPageSize = 20;

function updateSummary() {
  $("total-incidents").textContent = incidents.length;
  $("open-incidents").textContent = incidents.filter((item) => item.Status === "Open" || item.Status === "In Progress").length;
  $("high-incidents").textContent = incidents.filter((item) => item.Severity === "High" || item.Severity === "Critical").length;
}

function compareIncidents(a, b) {
  const left = a[sortField];
  const right = b[sortField];

  if (sortField === 'IncidentID') {
    return left - right;
  }

  if (sortField === 'Severity') {
    return severityOrder.indexOf(left) - severityOrder.indexOf(right);
  }

  if (sortField === 'Status') {
    return statusOrder.indexOf(left) - statusOrder.indexOf(right);
  }

  return String(left).localeCompare(String(right));
}

function sortedIncidents(rows) {
  return [...rows].sort((a, b) => {
    const comparison = compareIncidents(a, b);
    return sortDirection === 'asc' ? comparison : -comparison;
  });
}

function sortLabel(field, title) {
  if (sortField !== field) return title;
  return `${title}${sortDirection === 'asc' ? ' ▲' : ' ▼'}`;
}

function updateSortHeaders() {
  const fields = ['IncidentID', 'Title', 'Severity', 'Status'];
  fields.forEach((field) => {
    const header = document.getElementById(`sort-${field}`);
    if (header) {
      header.textContent = sortLabel(field, field);
    }
  });
}

function rowHtml(item) {
  return `<tr data-incident-id="${item.IncidentID}" onclick="selectIncident(${item.IncidentID})"><td>${item.IncidentID}</td><td>${escapeHtml(item.Title)}</td><td>${escapeHtml(item.Severity)}</td><td>${escapeHtml(item.Status)}</td></tr>`;
}

function highlightSelectedRow() {
  document.querySelectorAll("#incident-table-body tr").forEach((row) => {
    row.classList.toggle("selected-row", row.dataset.incidentId === String(currentIncidentID));
  });
}

function showTable() {
  if (loadingIncidents) {
    tableBody.innerHTML = '<tr><td colspan="4" class="muted">Loading incidents...</td></tr>';
    return;
  }

  const filter = $("filter").value;
  const rows = incidents.filter((item) => filter === "All" || item.Status === filter);
  const sorted = sortedIncidents(rows);
  tableBody.innerHTML = sorted.length ? sorted.map(rowHtml).join("") : '<tr><td colspan="4" class="muted">No incidents found.</td></tr>';
  updateSortHeaders();
  highlightSelectedRow();
}

function renderList(items, emptyText, renderItem) {
  if (!items.length) return `<p class="muted">${emptyText}</p>`;
  return `<ul class="details-list">${items.map((item) => `<li class="details-item">${renderItem(item)}</li>`).join("")}</ul>`;
}

const noteRow = (note, incidentID) => `<div class="details-row"><span>${escapeHtml(note.Content)} (${formatDate(note.Time, "No timestamp")})</span><button class="delete-button" onclick="deleteNote(${incidentID}, ${note.NoteID})">Delete</button></div>`;
const assetRow = (asset) => `<div class="details-row"><span>${escapeHtml(asset.Hostname)} (${escapeHtml(asset.IP_Address)}) - ${escapeHtml(asset.Source)}</span><button class="delete-button" onclick="unlinkAsset(${asset.AssetID})">Remove</button></div>`;
const iocRow = (ioc) => `<div class="details-row"><span>${escapeHtml(ioc.Type)}: ${escapeHtml(ioc.Value)}</span><button class="delete-button" onclick="unlinkIoc(${ioc.IOCID})">Remove</button></div>`;
const analystRow = (analyst) => `<div class="details-row"><span>${escapeHtml(analyst.Name)} - ${escapeHtml(analyst.Role)} - ${escapeHtml(analyst.Email)}</span><button class="delete-button" onclick="unassignAnalyst(${analyst.AnalystID})">Remove</button></div>`;

function selectHtml(items, idKey, label, selectId, placeholder) {
  const options = items.map((item) => `<option value="${item[idKey]}">${escapeHtml(label(item))}</option>`).join("");
  return `<select id="${selectId}"><option value="">${placeholder}</option>${options}</select>`;
}

function linkBlock(title, selectMarkup, buttonText, action) {
  return `<div class="link-block"><p><b>${title}</b></p><div class="link-row">${selectMarkup}<button onclick="${action}()">${buttonText}</button></div></div>`;
}

function linkControls(allAssets, linkedAssets, allIocs, linkedIocs, allAnalysts, linkedAnalysts) {
  const freeAssets = allAssets.filter((item) => !linkedAssets.some((linked) => linked.AssetID === item.AssetID));
  const freeIocs = allIocs.filter((item) => !linkedIocs.some((linked) => linked.IOCID === item.IOCID));
  const freeAnalysts = allAnalysts.filter((item) => !linkedAnalysts.some((linked) => linked.AnalystID === item.AnalystID));

  return `<div class="link-grid">${
    linkBlock("Link Asset:", selectHtml(freeAssets, "AssetID", (item) => `${item.AssetID} - ${item.Hostname}`, "asset-link", "Choose an asset"), "Link Asset", "linkAsset") +
    linkBlock("Link IOC:", selectHtml(freeIocs, "IOCID", (item) => `${item.IOCID} - ${item.Type}: ${item.Value}`, "ioc-link", "Choose an IOC"), "Link IOC", "linkIoc") +
    linkBlock("Assign Analyst:", selectHtml(freeAnalysts, "AnalystID", (item) => `${item.AnalystID} - ${item.Name}`, "analyst-link", "Choose an analyst"), "Assign Analyst", "assignAnalyst")
  }</div>`;
}

function showIncidentDetails(incident, notes, linkedAssets, linkedIocs, linkedAnalysts, allAssets, allIocs, allAnalysts) {
  detailsBox.innerHTML = `
    <p><b>IncidentID:</b> ${incident.IncidentID}</p>
    <p><b>Title:</b> ${escapeHtml(incident.Title)}</p>
    <p><b>Description:</b> ${escapeHtml(incident.Description)}</p>
    <p><b>Created At:</b> ${formatDate(incident.Created_At, "Not available")}</p>
    <p><b>Closed At:</b> ${formatDate(incident.Closed_At)}</p>
    <p><b>TTR:</b> ${escapeHtml(incident.TTR ?? "Not available")}</p>
    <p><b>Status:</b> ${escapeHtml(incident.Status)}</p>
    <p><b>Severity:</b> ${escapeHtml(incident.Severity)}</p>
    <p><b>Assets:</b></p>${renderList(linkedAssets, "None", assetRow)}
    <p><b>Indicators of Compromise:</b></p>${renderList(linkedIocs, "None", iocRow)}
    <p><b>Analysts:</b></p>${renderList(linkedAnalysts, "None", analystRow)}
    ${linkControls(allAssets, linkedAssets, allIocs, linkedIocs, allAnalysts, linkedAnalysts)}
    <p><b>Notes:</b></p>${renderList(notes, "None", (note) => noteRow(note, incident.IncidentID))}
    <p><button class="delete-button" onclick="deleteIncident()">Delete Incident</button></p>
  `;
}

function showAssetManagement() {
  if (!assetListBox) return;
  if (loadingAssets) {
    assetListBox.innerHTML = '<p class="muted">Loading assets...</p>';
    return;
  }

  const searchHtml = `
    <div style="margin: 10px 0;">
      <input id="asset-search" type="text" placeholder="Search assets..." style="width: 100%; padding: 5px;">
      <div id="asset-results" style="margin-top: 10px; max-height: 200px; overflow-y: auto; border: 1px solid #ccc; padding: 5px;"></div>
    </div>
  `;

  assetListBox.innerHTML = searchHtml;

  const assetSearch = $("asset-search");
  const assetResults = $("asset-results");

  function filterAssets() {
    const query = assetSearch.value.toLowerCase();
    const filtered = assets.filter((a) =>
      a.Hostname.toLowerCase().includes(query) ||
      a.IP_Address.includes(query)
    );

    assetResults.innerHTML = filtered.length
      ? filtered.slice(0, 20).map((asset) => `
          <div class="details-row">
            <span>${escapeHtml(asset.Hostname)} (${escapeHtml(asset.IP_Address)})</span>
            <button class="delete-button" onclick="deleteAsset(${asset.AssetID})">Delete</button>
          </div>
        `).join('')
      : '<p class="muted">No assets found.</p>';
  }

  assetSearch.addEventListener("input", filterAssets);
  filterAssets();
}

function showIocManagement() {
  if (!iocListBox) return;
  if (loadingIocs) {
    iocListBox.innerHTML = '<p class="muted">Loading IOCs...</p>';
    return;
  }

  const searchHtml = `
    <div style="margin: 10px 0;">
      <input id="ioc-search" type="text" placeholder="Search IOCs..." style="width: 100%; padding: 5px;">
      <div id="ioc-results" style="margin-top: 10px; max-height: 200px; overflow-y: auto; border: 1px solid #ccc; padding: 5px;"></div>
    </div>
  `;

  iocListBox.innerHTML = searchHtml;

  const iocSearch = $("ioc-search");
  const iocResults = $("ioc-results");

  function filterIocs() {
    const query = iocSearch.value.toLowerCase();
    const filtered = iocs.filter((i) => i.Value.toLowerCase().includes(query) || i.Type.toLowerCase().includes(query));

    iocResults.innerHTML = filtered.length
      ? filtered.slice(0, 20).map((ioc) => `
          <div class="details-row">
            <span>${escapeHtml(ioc.Type)}: ${escapeHtml(ioc.Value)}</span>
            <button class="delete-button" onclick="deleteIoc(${ioc.IOCID})">Delete</button>
          </div>
        `).join('')
      : '<p class="muted">No IOCs found.</p>';
  }

  iocSearch.addEventListener("input", filterIocs);
  filterIocs();
}

function showAnalystManagement() {
  if (!analystListBox) return;
  if (loadingAnalysts) {
    analystListBox.innerHTML = '<p class="muted">Loading analysts...</p>';
    return;
  }

  const searchHtml = `
    <div style="margin: 10px 0;">
      <input id="analyst-search" type="text" placeholder="Search analysts..." style="width: 100%; padding: 5px;">
      <div id="analyst-results" style="margin-top: 10px; max-height: 200px; overflow-y: auto; border: 1px solid #ccc; padding: 5px;"></div>
    </div>
  `;

  analystListBox.innerHTML = searchHtml;

  const analystSearch = $("analyst-search");
  const analystResults = $("analyst-results");

  function filterAnalysts() {
    const query = analystSearch.value.toLowerCase();
    const filtered = analysts.filter((a) =>
      a.Name.toLowerCase().includes(query) ||
      a.Email.toLowerCase().includes(query) ||
      a.Role.toLowerCase().includes(query)
    );

    analystResults.innerHTML = filtered.length
      ? filtered.slice(0, 20).map((analyst) => `
          <div class="details-row">
            <span>${escapeHtml(analyst.Name)} (${escapeHtml(analyst.Role)})</span>
            <button class="delete-button" onclick="deleteAnalyst(${analyst.AnalystID})">Delete</button>
          </div>
        `).join('')
      : '<p class="muted">No analysts found.</p>';
  }

  analystSearch.addEventListener("input", filterAnalysts);
  filterAnalysts();
}

function showCorrelations() {
  if (!correlationBox) return;
  if (loadingCorrelations) {
    correlationBox.innerHTML = '<p class="muted">Loading threat correlation...</p>';
    return;
  }

  if (!correlations.length) {
    correlationBox.innerHTML = '<p class="muted">No shared threat campaigns found.</p>';
    return;
  }

  correlationBox.innerHTML = correlations.map((group) => `
    <div class="correlation-card">
      <p><b>${escapeHtml(group.IOC?.Type ?? "IOC")}:</b> ${escapeHtml(group.IOC?.Value ?? "Unknown")}</p>
      <p><b>Incident Count:</b> ${escapeHtml(group.IncidentCount ?? group.Incidents?.length ?? 0)}</p>
      ${renderList(group.Incidents ?? [], "No linked incidents.", (incident) => `<span>${incident.IncidentID} - ${escapeHtml(incident.Title)} (${escapeHtml(incident.Status)}, ${escapeHtml(incident.Severity)})</span>`) }
    </div>
  `).join('');
}

function setSort(field) {
  if (sortField === field) {
    sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    sortField = field;
    sortDirection = 'asc';
  }
  showTable();
}

function filteredLogs() {
  const query = logReviewQuery.trim().toLowerCase();
  if (!query) return logs;
  return logs.filter((log) => {
    return [
      log.EventTime,
      log.SourceSystem,
      log.Message,
      log.SourceIP,
      log.DestinationIP,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
  });
}

function showLogReview() {
  const container = $("log-review-container");
  if (!container) return;

  if (loadingLogs) {
    container.innerHTML = '<p class="muted">Loading logs...</p>';
    return;
  }

  if (!logs.length) {
    container.innerHTML = '<p class="muted">No unrelated logs. Create incidents from logs in the Log Review section.</p>';
    return;
  }

  const filtered = filteredLogs();
  if (!filtered.length) {
    container.innerHTML = `
      <div style="margin-bottom: 10px; display: flex; gap: 8px; align-items: center;">
        <input id="log-review-search" type="search" placeholder="Search logs..." value="${escapeHtml(logReviewQuery)}" style="flex: 1; padding: 6px;">
        <span class="muted">0 of ${logs.length} logs</span>
      </div>
      <p class="muted">No logs match your search.</p>
    `;
    const searchInput = $("log-review-search");
    if (searchInput) searchInput.addEventListener("input", (event) => setLogReviewQuery(event.target.value));
    return;
  }

  const totalLogs = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalLogs / logReviewPageSize));
  logReviewPage = Math.min(logReviewPage, totalPages);
  const start = (logReviewPage - 1) * logReviewPageSize;
  const displayed = filtered.slice(start, start + logReviewPageSize);

  container.innerHTML = `
    <div style="margin-bottom: 10px; display: grid; grid-template-columns: 1fr auto; gap: 8px; align-items: center;">
      <input id="log-review-search" type="search" placeholder="Search logs..." value="${escapeHtml(logReviewQuery)}" style="padding: 6px; width: 100%;">
      <div style="text-align: right; font-size: 0.95rem; color: #444;">Showing ${displayed.length} of ${totalLogs}</div>
    </div>
    <div id="log-review-list"></div>
    <div id="log-review-pager" style="margin-top: 12px; display: flex; justify-content: space-between; align-items: center;">
      <button id="log-review-prev" ${logReviewPage <= 1 ? 'disabled' : ''}>Previous</button>
      <span>Page ${logReviewPage} / ${totalPages}</span>
      <button id="log-review-next" ${logReviewPage >= totalPages ? 'disabled' : ''}>Next</button>
    </div>
  `;

  const list = $("log-review-list");
  if (list) {
    list.innerHTML = displayed.map((log) => `
      <div style="margin: 15px 0; padding: 10px; border: 1px solid #ddd; border-radius: 4px; background: #fafafa;">
        <div><b>Time:</b> ${escapeHtml(log.EventTime)}</div>
        <div><b>Source System:</b> ${escapeHtml(log.SourceSystem)}</div>
        <div><b>Message:</b> ${escapeHtml(log.Message)}</div>
        ${log.SourceIP ? `<div><b>Source IP:</b> ${escapeHtml(log.SourceIP)}</div>` : ''}
        ${log.DestinationIP ? `<div><b>Destination IP:</b> ${escapeHtml(log.DestinationIP)}</div>` : ''}
        <div style="margin-top: 10px;">
          <button onclick="openLogIncidentDialog(${log.LogEventID})" style="margin-right: 5px;">Create Incident</button>
          <button onclick="deleteLog(${log.LogEventID})" class="delete-button">Delete Log</button>
        </div>
      </div>
    `).join('');
  }

  const searchInput = $("log-review-search");
  if (searchInput) {
    searchInput.addEventListener("input", (event) => setLogReviewQuery(event.target.value));
  }

  const prevButton = $("log-review-prev");
  const nextButton = $("log-review-next");
  if (prevButton) prevButton.addEventListener("click", () => setLogReviewPage(logReviewPage - 1));
  if (nextButton) nextButton.addEventListener("click", () => setLogReviewPage(logReviewPage + 1));
}

function setLogReviewQuery(value) {
  logReviewQuery = value || '';
  logReviewPage = 1;
  showLogReview();
}

function setLogReviewPage(page) {
  logReviewPage = Math.max(1, page);
  showLogReview();
}

let selectedLogID = null;

function openLogIncidentDialog(logEventID) {
  selectedLogID = logEventID;
  const log = logs.find((item) => item.LogEventID === logEventID);
  if (!log) return;
  
  $("log-incident-title").value = `Incident from log - ${log.SourceSystem}`;
  $("log-incident-description").value = log.Message;
  $("log-incident-severity").value = "Medium";

  const ipsDisplay = $("log-incident-ips-display");
  const ips = [];
  if (log.SourceIP) ips.push(`Source: ${log.SourceIP}`);
  if (log.DestinationIP) ips.push(`Destination: ${log.DestinationIP}`);
  
  ipsDisplay.textContent = ips.length 
    ? `Extracted IPs: ${ips.join(", ")}`
    : 'No IPs found in log';

  const dialog = $("log-incident-dialog");
  dialog.style.display = "block";
  dialog.scrollIntoView({ behavior: "smooth", block: "start" });
  $("log-incident-title").focus();
}

function closeLogIncidentDialog() {
  $("log-incident-dialog").style.display = "none";
  selectedLogID = null;
}

