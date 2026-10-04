import { bindLogout, requireAuth } from "./auth.js";
import { apiRequest } from "./api.js";

const body = document.getElementById("articlesBody");
const emptyState = document.getElementById("emptyState");

const renderArticles = (articles) => {
  body.innerHTML = "";
  if (articles.length === 0) {
    emptyState.style.display = "block";
    return;
  }

  emptyState.style.display = "none";
  articles.forEach((article) => {
    const row = document.createElement("tr");
    const titleText = article.title || "(Untitled)";
    row.innerHTML = `
      <td>${titleText}</td>
      <td>${article.website}</td>
      <td>${article.primaryKeyword}</td>
      <td>${article.seoScore ?? "-"}</td>
      <td>${article.status}</td>
      <td>${new Date(article.createdAt).toLocaleString()}</td>
      <td><a href="/articles/preview?id=${article.id}">Preview</a></td>
    `;
    body.appendChild(row);
  });
};

const init = async () => {
  await requireAuth();
  bindLogout();
  const response = await apiRequest("/api/articles");
  renderArticles(response.data);
};

void init();
