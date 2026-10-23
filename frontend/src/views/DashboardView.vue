<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import AppLayout from "@/layouts/AppLayout.vue";
import StatusBadge from "@/components/StatusBadge.vue";
import { api } from "@/services/api";
import type { ArticleSummary, Website } from "@/types";

const websites = ref<Website[]>([]);
const articles = ref<ArticleSummary[]>([]);
const loading = ref(true);

const publishedCount = computed(() => articles.value.filter((item) => item.status === "PUBLISHED").length);
const readyCount = computed(() => articles.value.filter((item) => item.status === "READY").length);
const failedCount = computed(() => articles.value.filter((item) => item.status === "FAILED").length);

onMounted(async () => {
  try {
    const [websiteResponse, articleResponse] = await Promise.all([
      api.get("/websites"),
      api.get("/articles")
    ]);
    websites.value = websiteResponse.data.data;
    articles.value = articleResponse.data.data;
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <AppLayout>
    <div class="page-header">
      <div>
        <p class="eyebrow">KSD AUTO BLOG PLATFORM</p>
        <h1>Dashboard</h1>
        <p>ภาพรวมระบบ Content Management และสถานะการทำงานล่าสุด</p>
      </div>
      <RouterLink class="primary-button" to="/generate">+ Generate Blog</RouterLink>
    </div>

    <section class="stat-grid">
      <article class="stat-card">
        <span>Articles</span>
        <strong>{{ articles.length }}</strong>
        <small>Total generated records</small>
      </article>
      <article class="stat-card">
        <span>Ready for Review</span>
        <strong>{{ readyCount }}</strong>
        <small>Waiting for content review</small>
      </article>
      <article class="stat-card">
        <span>Published</span>
        <strong>{{ publishedCount }}</strong>
        <small>Published articles</small>
      </article>
      <article class="stat-card">
        <span>Failed</span>
        <strong>{{ failedCount }}</strong>
        <small>Needs attention</small>
      </article>
    </section>

    <section class="dashboard-grid">
      <article class="surface-card">
        <div class="card-heading">
          <div>
            <p class="eyebrow">CONTENT</p>
            <h2>Recent Articles</h2>
          </div>
          <RouterLink to="/articles">View all</RouterLink>
        </div>
        <div v-if="loading" class="empty-state">Loading...</div>
        <div v-else-if="articles.length === 0" class="empty-state">
          <strong>No articles generated yet.</strong>
          <span>AI content generation will be enabled in Phase 3.</span>
        </div>
        <div v-else class="simple-list">
          <RouterLink
            v-for="article in articles.slice(0, 5)"
            :key="article.id"
            :to="`/articles/${article.id}`"
            class="simple-list-item"
          >
            <div>
              <strong>{{ article.title || "(Untitled)" }}</strong>
              <small>{{ article.website }} · {{ article.primaryKeyword }}</small>
            </div>
            <StatusBadge :status="article.status" />
          </RouterLink>
        </div>
      </article>

      <article class="surface-card">
        <div class="card-heading">
          <div>
            <p class="eyebrow">WORDPRESS</p>
            <h2>Website Status</h2>
          </div>
          <RouterLink to="/websites">Manage</RouterLink>
        </div>
        <div v-if="websites.length === 0" class="empty-state">
          <strong>No WordPress websites configured.</strong>
          <span>Add the KSD websites when credentials are available.</span>
        </div>
        <div v-else class="simple-list">
          <div v-for="website in websites" :key="website.id" class="simple-list-item">
            <div>
              <strong>{{ website.name }}</strong>
              <small>{{ website.wordpressUrl }}</small>
            </div>
            <StatusBadge :status="website.status" />
          </div>
        </div>
      </article>
    </section>
  </AppLayout>
</template>
