<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import AppLayout from "@/layouts/AppLayout.vue";
import StatusBadge from "@/components/StatusBadge.vue";
import { api, getApiErrorMessage } from "@/services/api";
import type { ArticlePreview } from "@/types";

const route = useRoute();
const article = ref<ArticlePreview | null>(null);
const errorMessage = ref("");

onMounted(async () => {
  try {
    const { data } = await api.get(`/articles/${route.params.id}`);
    article.value = data.data;
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, "Unable to load article preview.");
  }
});
</script>

<template>
  <AppLayout>
    <div class="page-header">
      <div>
        <p class="eyebrow">ARTICLE REVIEW</p>
        <h1>Article Preview</h1>
        <p>ตรวจสอบ Content และ SEO ก่อนส่งไป WordPress</p>
      </div>
      <RouterLink class="secondary-button" to="/articles">← Back to Articles</RouterLink>
    </div>

    <div v-if="errorMessage" class="alert danger">{{ errorMessage }}</div>
    <div v-else-if="!article" class="surface-card empty-state">Loading article...</div>

    <template v-else>
      <section class="article-summary-grid">
        <article class="surface-card">
          <span class="meta-label">SEO SCORE</span>
          <strong class="score-value">{{ article.seoScore ?? "—" }}</strong>
        </article>
        <article class="surface-card">
          <span class="meta-label">STATUS</span>
          <StatusBadge :status="article.status" />
        </article>
        <article class="surface-card wide">
          <span class="meta-label">META DESCRIPTION</span>
          <p>{{ article.metaDescription || "No meta description yet." }}</p>
        </article>
      </section>

      <section class="surface-card article-preview-card">
        <div class="card-heading">
          <div>
            <p class="eyebrow">CONTENT PREVIEW</p>
            <h2>{{ article.title || "(Untitled)" }}</h2>
          </div>
        </div>
        <div class="article-content" v-html="article.content || '<p>No content available.</p>'"></div>
      </section>

      <section class="surface-card">
        <div class="card-heading">
          <div>
            <p class="eyebrow">AI QUALITY</p>
            <h2>Quality Issues</h2>
          </div>
        </div>
        <div class="empty-inline">GPT SEO & Quality results will appear here in Phase 5.</div>
        <div class="button-row top-gap">
          <button class="secondary-button" disabled>Edit</button>
          <button class="secondary-button" disabled>Regenerate</button>
          <button class="outline-button" disabled>Save Draft</button>
          <button class="primary-button" disabled>Publish</button>
        </div>
      </section>
    </template>
  </AppLayout>
</template>
