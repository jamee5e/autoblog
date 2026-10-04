<script setup lang="ts">
import { onMounted, ref } from "vue";
import AppLayout from "@/layouts/AppLayout.vue";
import { api } from "@/services/api";
import type { Website } from "@/types";

const websites = ref<Website[]>([]);
const selectedWebsite = ref("");
const topic = ref("");
const keyword = ref("");
const instructions = ref("");

onMounted(async () => {
  const { data } = await api.get("/websites");
  websites.value = data.data;
  if (websites.value[0]) selectedWebsite.value = websites.value[0].id;
});
</script>

<template>
  <AppLayout>
    <div class="page-header">
      <div>
        <p class="eyebrow">AI CONTENT WORKFLOW</p>
        <h1>Generate Blog</h1>
        <p>หน้าเตรียมพร้อมสำหรับ Gemini → Claude → GPT workflow</p>
      </div>
      <span class="status-badge neutral">Phase 3 Pending</span>
    </div>

    <section class="generate-grid">
      <article class="surface-card">
        <div class="card-heading">
          <div>
            <p class="eyebrow">NEW ARTICLE</p>
            <h2>Content Brief</h2>
          </div>
        </div>
        <div class="form-grid">
          <label>
            Website
            <select v-model="selectedWebsite">
              <option value="" disabled>Select website</option>
              <option v-for="website in websites" :key="website.id" :value="website.id">{{ website.name }}</option>
            </select>
          </label>
          <label>
            Topic
            <input v-model="topic" placeholder="Best time to visit Khao Sok" />
          </label>
          <label>
            Primary Keyword
            <input v-model="keyword" placeholder="best time to visit khao sok" />
          </label>
          <label>
            Additional Instructions
            <textarea v-model="instructions" rows="6" placeholder="Optional writing direction..."></textarea>
          </label>
          <button class="primary-button full" disabled>Generate Blog — Available in Phase 3</button>
        </div>
      </article>

      <article class="surface-card">
        <div class="card-heading">
          <div>
            <p class="eyebrow">WORKFLOW</p>
            <h2>AI Agent Progress</h2>
          </div>
        </div>
        <div class="workflow-list">
          <div><span>1</span><div><strong>Gemini Research</strong><small>Research destination, intent and supporting facts</small></div></div>
          <div><span>2</span><div><strong>Claude Writer</strong><small>Create structured KSD content</small></div></div>
          <div><span>3</span><div><strong>GPT SEO & Quality</strong><small>Review SEO, quality and revision needs</small></div></div>
          <div><span>4</span><div><strong>Ready for Review</strong><small>Human approval before WordPress publishing</small></div></div>
        </div>
        <div class="info-banner amber">
          <strong>AI integrations are intentionally disabled.</strong>
          <span>Phase 2 WordPress acceptance must complete first.</span>
        </div>
      </article>
    </section>
  </AppLayout>
</template>
