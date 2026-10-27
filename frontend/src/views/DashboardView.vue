<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import AppLayout from "@/layouts/AppLayout.vue";
import StatusBadge from "@/components/StatusBadge.vue";
import { api } from "@/services/api";
import type { ArticleSummary, BlogTopicFocus, InternalLink, ScheduledJob, Website } from "@/types";

const websites = ref<Website[]>([]);
const articles = ref<ArticleSummary[]>([]);
const topicFocuses = ref<BlogTopicFocus[]>([]);
const schedules = ref<ScheduledJob[]>([]);
const internalLinks = ref<InternalLink[]>([]);
const loading = ref(true);

const publishedCount = computed(() => articles.value.filter((item) => item.status === "PUBLISHED").length);
const readyCount = computed(() => articles.value.filter((item) => item.status === "READY").length);
const failedCount = computed(() => articles.value.filter((item) => item.status === "FAILED").length);
const activeFocusCount = computed(() => topicFocuses.value.filter((item) => item.active).length);
const pendingScheduleCount = computed(() =>
  schedules.value.filter((item) => item.status === "PENDING" || item.status === "RUNNING").length
);
const activeInternalLinkCount = computed(() =>
  internalLinks.value.filter((item) => item.active).length
);

onMounted(async () => {
  try {
    const [websiteResponse, articleResponse, focusResponse, scheduleResponse, linkResponse] = await Promise.all([
      api.get("/websites"),
      api.get("/articles"),
      api.get("/topic-focuses"),
      api.get("/schedules"),
      api.get("/internal-links")
    ]);
    websites.value = websiteResponse.data.data;
    articles.value = articleResponse.data.data;
    topicFocuses.value = focusResponse.data.data;
    schedules.value = scheduleResponse.data.data;
    internalLinks.value = linkResponse.data.data;
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

    <section class="dashboard-automation-grid">
      <article class="surface-card">
        <div class="card-heading">
          <div>
            <p class="eyebrow">CONTENT STRATEGY</p>
            <h2>Blog Topic Focus</h2>
          </div>
          <RouterLink to="/topic-focuses">Manage</RouterLink>
        </div>
        <div class="automation-summary-row">
          <div>
            <strong>Active Focus</strong>
            <small>Campaigns currently available to AI workflows</small>
          </div>
          <strong>{{ activeFocusCount }}</strong>
        </div>
        <div class="automation-summary-row">
          <div>
            <strong>Total Focus</strong>
            <small>Across all connected websites</small>
          </div>
          <strong>{{ topicFocuses.length }}</strong>
        </div>
      </article>

      <article class="surface-card">
        <div class="card-heading">
          <div>
            <p class="eyebrow">AUTOMATION</p>
            <h2>Scheduled Workflows</h2>
          </div>
          <RouterLink to="/generate">Open Scheduler</RouterLink>
        </div>
        <div class="automation-summary-row">
          <div>
            <strong>Pending / Running</strong>
            <small>Jobs waiting for their scheduled date and time</small>
          </div>
          <strong>{{ pendingScheduleCount }}</strong>
        </div>
        <div class="automation-summary-row">
          <div>
            <strong>Total Scheduled</strong>
            <small>Recent schedule records in the system</small>
          </div>
          <strong>{{ schedules.length }}</strong>
        </div>
      </article>

      <article class="surface-card">
        <div class="card-heading">
          <div>
            <p class="eyebrow">SEO ASSETS</p>
            <h2>Internal Links</h2>
          </div>
          <RouterLink to="/internal-links">Manage</RouterLink>
        </div>
        <div class="automation-summary-row">
          <div>
            <strong>Active Links</strong>
            <small>Approved URLs available to Writer Agent</small>
          </div>
          <strong>{{ activeInternalLinkCount }}</strong>
        </div>
        <div class="automation-summary-row">
          <div>
            <strong>Total Links</strong>
            <small>Across all connected websites</small>
          </div>
          <strong>{{ internalLinks.length }}</strong>
        </div>
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
          <span>Create a Manual Topic or use Blog Topic Focus to generate the first article.</span>
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
