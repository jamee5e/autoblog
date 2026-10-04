import { bindLogout, requireAuth } from "./auth.js";
import { apiRequest } from "./api.js";

const form = document.getElementById("filtersForm");
const body = document.getElementById("logsBody");
const message = document.getElementById("logsMessage");

const setMessage = (text, type = "error") => {
  message.textContent = text;
  message.className = `message ${type}`;
};

const renderLogs = (logs) => {
  body.innerHTML = "";
  if (logs.length === 0) {
    body.innerHTML = `<tr><td colspan="4">No logs found.</td></tr>`;
    return;
  }

  logs.forEach((log) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${new Date(log.createdAt).toLocaleString()}</td>
      <td>${log.level}</td>
      <td>${log.module}</td>
      <td>${log.message}</td>
    `;
    body.appendChild(row);
  });
};

const loadLogs = async () => {
  const moduleValue = document.getElementById("module").value.trim();
  const levelValue = document.getElementById("level").value;
  const query = new URLSearchParams();
  if (moduleValue) {
    query.set("module", moduleValue);
  }

  if (levelValue) {
    query.set("level", levelValue);
  }

  const suffix = query.toString() ? `?${query.toString()}` : "";
  const response = await apiRequest(`/api/system-logs${suffix}`);
  renderLogs(response.data);
};

const init = async () => {
  await requireAuth();
  bindLogout();
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await loadLogs();
      setMessage("Logs loaded.", "success");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load logs.");
    }
  });

  try {
    await loadLogs();
  } catch (error) {
    setMessage(error instanceof Error ? error.message : "Unable to load logs.");
  }
};

void init();
