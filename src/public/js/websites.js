import { bindLogout, getCurrentUser, requireAuth } from "./auth.js";
import { apiRequest } from "./api.js";

const websitesBody = document.getElementById("websitesBody");
const websiteForm = document.getElementById("websiteForm");
const formTitle = document.getElementById("formTitle");
const saveButton = document.getElementById("saveWebsiteButton");
const message = document.getElementById("websiteMessage");
const clearEditButton = document.getElementById("clearEditButton");
const passwordInput = document.getElementById("wordpressApplicationPassword");
const passwordHelper = document.getElementById("passwordHelper");

const TEST_DRAFT_PAYLOAD = {
  title: "KSD Auto Blog Integration Test",
  slug: "ksd-auto-blog-integration-test",
  excerpt: "Test post created by KSD Auto Blog Platform.",
  content: "<p>This is a WordPress integration test from the KSD Auto Blog Platform.</p>"
};

let currentEditId = null;

const setMessage = (text, type = "success") => {
  message.textContent = text;
  message.className = `message ${type}`;
};

const resetForm = () => {
  currentEditId = null;
  formTitle.textContent = "Add Website";
  saveButton.textContent = "Add Website";
  clearEditButton.style.display = "none";
  websiteForm.reset();
  passwordInput.required = true;
  passwordHelper.textContent = "";
};

const fillEditForm = (website) => {
  currentEditId = website.id;
  formTitle.textContent = `Edit Website: ${website.name}`;
  saveButton.textContent = "Update Website";
  clearEditButton.style.display = "inline-block";
  document.getElementById("name").value = website.name;
  document.getElementById("wordpressUrl").value = website.wordpressUrl;
  document.getElementById("wordpressUsername").value = website.wordpressUsername;
  document.getElementById("defaultAuthor").value = website.defaultAuthor || "";
  document.getElementById("defaultCategory").value = website.defaultCategory || "";
  document.getElementById("wordpressApplicationPassword").value = "";
  passwordInput.required = false;
  passwordHelper.textContent = "Leave blank to keep existing credential.";
};

const renderWebsites = (websites) => {
  websitesBody.innerHTML = "";

  if (websites.length === 0) {
    websitesBody.innerHTML = `<tr><td colspan="6">No websites yet.</td></tr>`;
    return;
  }

  websites.forEach((website) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${website.name}</td>
      <td>${website.wordpressUrl}</td>
      <td><span class="status-pill">${website.status}</span></td>
      <td>${new Date(website.createdAt).toLocaleString()}</td>
      <td class="actions">
        <button type="button" data-action="edit" data-id="${website.id}" class="secondary">Edit</button>
        <button type="button" data-action="connection" data-id="${website.id}">Test Connection</button>
        <button type="button" data-action="draft" data-id="${website.id}">Create Test Draft</button>
      </td>
    `;
    websitesBody.appendChild(row);
  });
};

const loadWebsites = async () => {
  const response = await apiRequest("/api/websites");
  renderWebsites(response.data);
  return response.data;
};

const handleWebsiteAction = async (event, websites) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) {
    return;
  }

  const websiteId = target.dataset.id;
  const action = target.dataset.action;
  if (!websiteId || !action) {
    return;
  }

  const website = websites.find((item) => item.id === websiteId);
  if (!website) {
    return;
  }

  if (action === "edit") {
    fillEditForm(website);
    return;
  }

  if (action === "connection") {
    target.disabled = true;
    target.textContent = "Testing...";
    try {
      const response = await apiRequest(`/api/websites/${websiteId}/test-connection`, { method: "POST" });
      setMessage(response.message || "WordPress connection successful.", "success");
    } catch {
      setMessage("Unable to connect to WordPress. Check URL or credentials.", "error");
    } finally {
      target.disabled = false;
      target.textContent = "Test Connection";
    }
    return;
  }

  if (action === "draft") {
    target.disabled = true;
    target.textContent = "Creating...";
    try {
      const response = await apiRequest(`/api/websites/${websiteId}/test-draft`, {
        method: "POST",
        body: JSON.stringify(TEST_DRAFT_PAYLOAD)
      });
      setMessage(
        `Draft created successfully (Post ID: ${response.wordpressPostId}, Status: ${response.status}).`,
        "success"
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create draft.", "error");
    } finally {
      target.disabled = false;
      target.textContent = "Create Test Draft";
    }
  }
};

const submitForm = async (event) => {
  event.preventDefault();
  const currentUser = getCurrentUser();
  if (!currentUser) {
    window.location.assign("/login");
    return;
  }

  const payload = {
    companyId: currentUser.companyId,
    name: document.getElementById("name").value.trim(),
    wordpressUrl: document.getElementById("wordpressUrl").value.trim(),
    wordpressUsername: document.getElementById("wordpressUsername").value.trim(),
    defaultAuthor: document.getElementById("defaultAuthor").value.trim() || undefined,
    defaultCategory: document.getElementById("defaultCategory").value.trim() || undefined
  };

  const password = document.getElementById("wordpressApplicationPassword").value;
  if (password) {
    payload.wordpressApplicationPassword = password;
  }

  if (!currentEditId && !password) {
    setMessage("WordPress Application Password is required for new websites.", "error");
    return;
  }

  try {
    if (currentEditId) {
      await apiRequest(`/api/websites/${currentEditId}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });
      setMessage("Website updated successfully.", "success");
    } else {
      await apiRequest("/api/websites", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      setMessage("Website added successfully.", "success");
    }

    resetForm();
    const websites = await loadWebsites();
    websitesBody.onclick = (eventTarget) => void handleWebsiteAction(eventTarget, websites);
  } catch (error) {
    setMessage(error instanceof Error ? error.message : "Failed to save website.", "error");
  }
};

const init = async () => {
  await requireAuth();
  bindLogout();
  resetForm();
  websiteForm.addEventListener("submit", (event) => void submitForm(event));
  clearEditButton.addEventListener("click", resetForm);
  const websites = await loadWebsites();
  websitesBody.onclick = (eventTarget) => void handleWebsiteAction(eventTarget, websites);
};

void init();
