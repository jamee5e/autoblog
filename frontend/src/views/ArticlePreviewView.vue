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
const successMessage = ref("");
const writing = ref(false);

const loadArticle = async () => {
  try {
    const { data } = await api.get(`/articles/${route.params.id}`);
    article.value = data.data;
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, "Unable to load article preview.");
  }
};

const generateArticle = async () => {
  if (!article.value?.researchData || writing.value) return;

  writing.value = true;
  errorMessage.value = "";
  successMessage.value = "";

  try {
    await api.post(`/articles/${route.params.id}/write`);
    successMessage.value = "Writer Agent completed the article draft.";
    await loadArticle();
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, "Unable to generate article draft.");
    await loadArticle();
  } finally {
    writing.value = false;
  }
};

onMounted(loadArticle);
</script>

<template>
  <AppLayout>
    <div class="page-header">
      <div>
        <p class="eyebrow">ARTICLE REVIEW</p>
        <h1>Article Preview</h1>
        <p>ตรวจสอบ Research, Content และ SEO ก่อนส่งไป WordPress</p>
      </div>
      <RouterLink class="secondary-button" to="/articles">← Back to Articles</RouterLink>
    </div>

    <div v-if="errorMessage" class="alert danger">{{ errorMessage }}</div>
    <div v-if="successMessage" class="alert success">{{ successMessage }}</div>
    <div v-if="!article" class="surface-card empty-state">Loading article...</div>

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
          <span class="meta-label">WEBSITE / KEYWORD</span>
          <p>{{ article.website }} · {{ article.primaryKeyword }}</p>
        </article>
      </section>

      <section v-if="article.researchData" class="surface-card research-preview-card">
        <div class="research-result-header">
          <div>
            <p class="eyebrow">RESEARCH AGENT</p>
            <h2>{{ article.topic }}</h2>
            <p v-if="article.researchRun">
              {{ article.researchRun.model }}
              · {{ (article.researchRun.inputTokens ?? 0) + (article.researchRun.outputTokens ?? 0) }} tokens
              · Gemini
            </p>
          </div>
          <span class="status-badge success">Research Complete</span>
        </div>

        <div class="research-overview-grid">
          <div class="research-block">
            <span class="meta-label">SEARCH INTENT</span>
            <p>{{ article.researchData.searchIntent }}</p>
          </div>
          <div class="research-block">
            <span class="meta-label">TARGET AUDIENCE</span>
            <p>{{ article.researchData.targetAudience }}</p>
          </div>
          <div class="research-block">
            <span class="meta-label">CONTENT ANGLE</span>
            <p>{{ article.researchData.contentAngle }}</p>
          </div>
        </div>

        <div class="research-detail-grid">
          <div class="research-block">
            <span class="meta-label">KEY QUESTIONS</span>
            <ul class="research-list">
              <li v-for="question in article.researchData.keyQuestions" :key="question">
                {{ question }}
              </li>
            </ul>
          </div>

          <div class="research-block">
            <span class="meta-label">KEY FACTS</span>
            <div class="research-facts">
              <div
                v-for="fact in article.researchData.keyFacts"
                :key="fact.fact"
                class="research-fact"
              >
                <p>{{ fact.fact }}</p>
                <div class="research-fact-meta">
                  <span class="confidence-chip" :class="fact.confidence">
                    {{ fact.confidence }} confidence
                  </span>
                  <span v-if="fact.verificationNeeded" class="verify-chip">Verify</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="research-detail-grid">
          <div class="research-block">
            <span class="meta-label">RECOMMENDED SECTIONS</span>
            <div class="research-sections">
              <div
                v-for="(section, index) in article.researchData.recommendedSections"
                :key="section.heading"
                class="research-section-item"
              >
                <strong>{{ index + 1 }}. {{ section.heading }}</strong>
                <span>{{ section.purpose }}</span>
              </div>
            </div>
          </div>

          <div class="research-block">
            <span class="meta-label">WRITER NOTES</span>
            <ul class="research-list">
              <li v-for="note in article.researchData.notesForWriter" :key="note">
                {{ note }}
              </li>
            </ul>

            <span class="meta-label research-subheading">RELATED KEYWORDS</span>
            <div class="keyword-chips">
              <span v-for="keyword in article.researchData.relatedKeywords" :key="keyword">
                {{ keyword }}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section class="surface-card article-preview-card">
        <div class="card-heading">
          <div>
            <p class="eyebrow">WRITER AGENT</p>
            <h2>{{ article.title || article.topic }}</h2>
          </div>
          <div v-if="article.writerRun" class="writer-run-meta">
            <span class="status-badge success">Writer Complete</span>
            <small>{{ article.writerRun.model }} · Gemini</small>
          </div>
        </div>

        <div v-if="article.content">
          <p v-if="article.metaDescription" class="article-meta-description">
            {{ article.metaDescription }}
          </p>
          <div class="article-content" v-html="article.content"></div>
        </div>

        <div v-else class="writer-pending-state">
          <strong>Research is ready for the Writer Agent.</strong>
          <span>For the pilot workflow, the Writer Agent also uses Gemini.</span>
          <button
            class="primary-button top-gap"
            type="button"
            :disabled="writing || !article.researchData"
            @click="generateArticle"
          >
            {{ writing ? "Writer Agent is generating..." : "Generate Article Draft" }}
          </button>
        </div>
      </section>

      <section class="surface-card">
        <div class="card-heading">
          <div>
            <p class="eyebrow">SEO & QUALITY AGENT</p>
            <h2>Quality Review</h2>
          </div>
        </div>
        <div class="empty-inline">
          Quality review will be the next step. During the pilot it will also use Gemini.
        </div>
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
