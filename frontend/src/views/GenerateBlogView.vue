<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import AppLayout from "@/layouts/AppLayout.vue";
import { api, getApiErrorMessage } from "@/services/api";
import type { ResearchResponse, Website } from "@/types";

const websites = ref<Website[]>([]);
const selectedWebsite = ref("");
const topic = ref("");
const keyword = ref("");
const instructions = ref("");
const submitting = ref(false);
const errorMessage = ref("");
const researchResult = ref<ResearchResponse | null>(null);

const canResearch = computed(
  () =>
    Boolean(selectedWebsite.value) &&
    topic.value.trim().length >= 3 &&
    keyword.value.trim().length > 0 &&
    !submitting.value
);

const loadWebsites = async () => {
  try {
    const { data } = await api.get("/websites");
    websites.value = data.data;
    if (websites.value[0]) selectedWebsite.value = websites.value[0].id;
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, "Unable to load websites.");
  }
};

const researchTopic = async () => {
  if (!canResearch.value) return;

  submitting.value = true;
  errorMessage.value = "";
  researchResult.value = null;

  try {
    const { data } = await api.post("/articles/research", {
      websiteId: selectedWebsite.value,
      topic: topic.value.trim(),
      primaryKeyword: keyword.value.trim(),
      additionalInstructions: instructions.value.trim() || undefined
    });

    researchResult.value = data.data;
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, "Unable to complete Gemini research.");
  } finally {
    submitting.value = false;
  }
};

onMounted(loadWebsites);
</script>

<template>
  <AppLayout>
    <div class="page-header">
      <div>
        <p class="eyebrow">AI CONTENT WORKFLOW</p>
        <h1>Generate Blog</h1>
        <p>เริ่มจาก Research Agent ก่อนส่งต่อให้ Writer และ SEO & Quality Agent</p>
      </div>
      <span class="status-badge progress">Phase 3 Active</span>
    </div>

    <div v-if="errorMessage" class="alert danger">{{ errorMessage }}</div>

    <section class="generate-grid">
      <article class="surface-card">
        <div class="card-heading">
          <div>
            <p class="eyebrow">NEW ARTICLE</p>
            <h2>Content Brief</h2>
          </div>
        </div>

        <form class="form-grid" @submit.prevent="researchTopic">
          <label>
            Website
            <select v-model="selectedWebsite" :disabled="submitting">
              <option value="" disabled>Select website</option>
              <option v-for="website in websites" :key="website.id" :value="website.id">
                {{ website.name }}
              </option>
            </select>
          </label>

          <label>
            Topic
            <input
              v-model="topic"
              :disabled="submitting"
              placeholder="Best time to visit Khao Sok"
              required
            />
          </label>

          <label>
            Primary Keyword
            <input
              v-model="keyword"
              :disabled="submitting"
              placeholder="best time to visit khao sok"
              required
            />
          </label>

          <label>
            Additional Instructions
            <textarea
              v-model="instructions"
              :disabled="submitting"
              rows="6"
              placeholder="Optional research direction..."
            ></textarea>
          </label>

          <button class="primary-button full" type="submit" :disabled="!canResearch">
            {{ submitting ? "Gemini is researching..." : "Research Topic with Gemini" }}
          </button>
        </form>
      </article>

      <article class="surface-card">
        <div class="card-heading">
          <div>
            <p class="eyebrow">WORKFLOW</p>
            <h2>AI Agent Progress</h2>
          </div>
        </div>

        <div class="workflow-list">
          <div class="complete">
            <span>1</span>
            <div>
              <strong>Research Agent</strong>
              <small>Gemini · research intent, facts, sections and related keywords</small>
            </div>
          </div>
          <div>
            <span>2</span>
            <div>
              <strong>Writer Agent</strong>
              <small>Gemini pilot · create structured article content</small>
            </div>
          </div>
          <div>
            <span>3</span>
            <div>
              <strong>SEO & Quality Agent</strong>
              <small>Gemini pilot · review SEO, quality and revision needs</small>
            </div>
          </div>
          <div>
            <span>4</span>
            <div>
              <strong>Ready for Review</strong>
              <small>Human approval before WordPress publishing</small>
            </div>
          </div>
        </div>

        <div class="info-banner green">
          <strong>Gemini Research is active.</strong>
          <span>Research is active. Writer and Quality agents are being enabled next using Gemini for the pilot.</span>
        </div>
      </article>
    </section>

    <section v-if="researchResult" class="surface-card research-result-card">
      <div class="research-result-header">
        <div>
          <p class="eyebrow">RESEARCH COMPLETE</p>
          <h2>{{ topic }}</h2>
          <p>
            {{ researchResult.model }}
            · {{ researchResult.usage.totalTokens ?? "—" }} tokens
          </p>
        </div>
        <RouterLink class="primary-button" :to="`/articles/${researchResult.articleId}`">
          View Research →
        </RouterLink>
      </div>

      <div class="research-overview-grid">
        <div class="research-block">
          <span class="meta-label">SEARCH INTENT</span>
          <p>{{ researchResult.research.searchIntent }}</p>
        </div>
        <div class="research-block">
          <span class="meta-label">TARGET AUDIENCE</span>
          <p>{{ researchResult.research.targetAudience }}</p>
        </div>
        <div class="research-block">
          <span class="meta-label">CONTENT ANGLE</span>
          <p>{{ researchResult.research.contentAngle }}</p>
        </div>
      </div>

      <div class="research-detail-grid">
        <div class="research-block">
          <span class="meta-label">KEY QUESTIONS</span>
          <ul class="research-list">
            <li v-for="question in researchResult.research.keyQuestions" :key="question">
              {{ question }}
            </li>
          </ul>
        </div>

        <div class="research-block">
          <span class="meta-label">RECOMMENDED SECTIONS</span>
          <div class="research-sections">
            <div
              v-for="section in researchResult.research.recommendedSections"
              :key="section.heading"
              class="research-section-item"
            >
              <strong>{{ section.heading }}</strong>
              <span>{{ section.purpose }}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  </AppLayout>
</template>
