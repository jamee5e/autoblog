import { bindLogout, requireAuth } from "./auth.js";
import { apiRequest } from "./api.js";

const titleField = document.getElementById("articleTitle");
const metaDescriptionField = document.getElementById("metaDescription");
const seoScoreField = document.getElementById("seoScore");
const contentField = document.getElementById("articleContent");
const statusField = document.getElementById("articleStatus");
const message = document.getElementById("previewMessage");

const setMessage = (text, type = "error") => {
  message.textContent = text;
  message.className = `message ${type}`;
};

const init = async () => {
  await requireAuth();
  bindLogout();
  const params = new URLSearchParams(window.location.search);
  const articleId = params.get("id");

  if (!articleId) {
    setMessage("No article selected. Open preview from the Articles page.");
    return;
  }

  try {
    const response = await apiRequest(`/api/articles/${articleId}`);
    const article = response.data;
    titleField.textContent = article.title || "(Untitled)";
    metaDescriptionField.textContent = article.metaDescription || "-";
    seoScoreField.textContent = article.seoScore ?? "-";
    contentField.innerHTML = article.content || "<p>No content available.</p>";
    statusField.textContent = article.status;
  } catch (error) {
    setMessage(error instanceof Error ? error.message : "Unable to load article preview.");
  }
};

void init();
