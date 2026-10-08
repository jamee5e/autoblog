<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import AppLayout from "@/layouts/AppLayout.vue";
import StatusBadge from "@/components/StatusBadge.vue";
import { api } from "@/services/api";
import type { ArticleSummary } from "@/types";

const articles = ref<ArticleSummary[]>([]);
const loading = ref(true);
const statusFilter = ref("");
const search = ref("");

const filteredArticles = computed(() =>
  articles.value.filter((article) => {
    const statusMatches = !statusFilter.value || article.status === statusFilter.value;
    const q = search.value.trim().toLowerCase();
    const textMatches =
      !q ||
      (article.title || "").toLowerCase().includes(q) ||
      article.topic.toLowerCase().includes(q) ||
      article.primaryKeyword.toLowerCase().includes(q) ||
      article.website.toLowerCase().includes(q);
    return statusMatches && textMatches;
  })
);

onMounted(async () => {
  try {
    const { data } = await api.get("/articles");
    articles.value = data.data;
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <AppLayout>
    <div class="page-header">
      <div>
        <p class="eyebrow">CONTENT LIBRARY</p>
        <h1>Articles</h1>
        <p>ดูสถานะบทความจากทุกเว็บไซต์ในระบบ</p>
      </div>
      <RouterLink class="primary-button" to="/generate">+ Generate Blog</RouterLink>
    </div>

    <section class="surface-card">
      <div class="filter-row">
        <input v-model="search" class="search-input" placeholder="Search title, keyword or website..." />
        <select v-model="statusFilter">
          <option value="">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="RESEARCHING">Researching</option>
          <option value="WRITING">Writing</option>
          <option value="CHECKING">Checking</option>
          <option value="REVISION">Revision</option>
          <option value="READY">Ready</option>
          <option value="PUBLISHED">Published</option>
          <option value="FAILED">Failed</option>
        </select>
      </div>

      <div v-if="loading" class="empty-state">Loading articles...</div>
      <div v-else-if="filteredArticles.length === 0" class="empty-state">
        <strong>No articles generated yet.</strong>
        <span>Article records will appear here when the AI workflow starts.</span>
      </div>

      <div v-else class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Website</th>
              <th>Primary Keyword</th>
              <th>SEO</th>
              <th>Status</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="article in filteredArticles" :key="article.id">
              <td>
                <strong>{{ article.title || article.topic }}</strong>
                <small v-if="!article.title" class="table-subtitle">Research brief</small>
              </td>
              <td>{{ article.website }}</td>
              <td>{{ article.primaryKeyword }}</td>
              <td>{{ article.seoScore ?? "—" }}</td>
              <td><StatusBadge :status="article.status" /></td>
              <td>{{ new Date(article.createdAt).toLocaleDateString() }}</td>
              <td><RouterLink :to="`/articles/${article.id}`">Preview →</RouterLink></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </AppLayout>
</template>
