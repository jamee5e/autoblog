<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import AppLayout from "@/layouts/AppLayout.vue";
import { api, getApiErrorMessage } from "@/services/api";
import type { OrchestrationResponse, ResearchResponse, Website } from "@/types";

const websites = ref<Website[]>([]);
const selectedWebsite = ref("");
const topic = ref("");
const keyword = ref("");
const instructions = ref("");
const submitting = ref(false);
const errorMessage = ref("");
const researchResult = ref<ResearchResponse | null>(null);
const orchestrationResult = ref<OrchestrationResponse | null>(null);
const activeAction = ref<"research" | "full" | null>(null);

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
  activeAction.value = "research";
  errorMessage.value = "";
  researchResult.value = null;
  orchestrationResult.value = null;

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
    activeAction.value = null;
  }
};

const generateFullArticle = async () => {
  if (!canResearch.value) return;

  submitting.value = true;
  activeAction.value = "full";
  errorMessage.value = "";
  researchResult.value = null;
  orchestrationResult.value = null;

  try {
    const { data } = await api.post("/articles/orchestrate", {
      websiteId: selectedWebsite.value,
      topic: topic.value.trim(),
      primaryKeyword: keyword.value.trim(),
      additionalInstructions: instructions.value.trim() || undefined
    });

    orchestrationResult.value = data.data;
  } catch (error) {
    errorMessage.value = getApiErrorMessage(
      error,
      "Unable to complete the full AI article workflow."
    );
  } finally {
    submitting.value = false;
    activeAction.value = null;
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
        <p>สร้างบทความแบบครบ Flow: Research → Writer → SEO & Quality → Ready for Review</p>
      </div>
      <span class="status-badge progress">Full AI Workflow Active</span>
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

        <form class="form-grid" @submit.prevent="generateFullArticle">
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

          <div class="button-row full">
            <button class="primary-button" type="submit" :disabled="!canResearch">
              {{
                activeAction === "full"
                  ? "AI workflow is running..."
                  : "Generate Full Article"
              }}
            </button>
            <button
              class="secondary-button"
              type="button"
              :disabled="!canResearch"
              @click="researchTopic"
            >
              {{
                activeAction === "research"
                  ? "Gemini is researching..."
                  : "Research Only"
              }}
            </button>
          </div>

          <div v-if="activeAction === 'full'" class="info-banner green full">
            <strong>Full workflow is running.</strong>
            <span>
              Research, Writer, and Quality agents are working in sequence. If needed,
              Writer revisions will run automatically up to 2 times.
            </span>
          </div>
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
          <strong>Full AI workflow is active.</strong>
          <span>
            One click can now run Research → Writer → Quality with up to 2 automatic revisions.
            WordPress Draft and Publish remain manual for human approval.
          </span>
        </div>
      </article>
    </section>


    <section v-if="orchestrationResult" class="surface-card research-result-card">
      <div class="research-result-header">
        <div>
          <p class="eyebrow">FULL WORKFLOW COMPLETE</p>
          <h2>{{ topic }}</h2>
          <p>
            {{ orchestrationResult.decision === "PASS" ? "Ready for Review" : "Manual Review Needed" }}
            · Revision {{ orchestrationResult.revisionCount }}/{{ orchestrationResult.maxRevisions }}
          </p>
        </div>
        <RouterLink class="primary-button" :to="`/articles/${orchestrationResult.articleId}`">
          Review Article →
        </RouterLink>
      </div>

      <div class="quality-score-grid">
        <div>
          <span class="meta-label">FINAL STATUS</span>
          <strong>{{ orchestrationResult.status }}</strong>
        </div>
        <div>
          <span class="meta-label">DECISION</span>
          <strong>{{ orchestrationResult.decision }}</strong>
        </div>
        <div>
          <span class="meta-label">SEO SCORE</span>
          <strong>{{ orchestrationResult.quality.review.seoScore }}/100</strong>
        </div>
        <div>
          <span class="meta-label">QUALITY SCORE</span>
          <strong>{{ orchestrationResult.quality.review.qualityScore }}/100</strong>
        </div>
      </div>

      <div class="research-overview-grid">
        <div class="research-block">
          <span class="meta-label">RESEARCH MODEL</span>
          <p>{{ orchestrationResult.research.model }}</p>
        </div>
        <div class="research-block">
          <span class="meta-label">WRITER MODEL</span>
          <p>{{ orchestrationResult.writer.model }}</p>
        </div>
        <div class="research-block">
          <span class="meta-label">QUALITY MODEL</span>
          <p>{{ orchestrationResult.quality.model }}</p>
        </div>
      </div>
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
