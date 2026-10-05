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
        <p>ตรวจสอบ Research, Content และ SEO ก่อนส่งไป WordPress</p>
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
          <span class="meta-label">WEBSITE / KEYWORD</span>
          <p>{{ article.website }} · {{ article.primaryKeyword }}</p>
        </article>
      </section>

      <section v-if="article.researchData" class="surface-card research-preview-card">
        <div class="research-result-header">
          <div>
            <p class="eyebrow">GEMINI RESEARCH</p>
            <h2>{{ article.topic }}</h2>
            <p v-if="article.researchRun">
              {{ article.researchRun.model }}
              · {{ (article.researchRun.inputTokens ?? 0) + (article.researchRun.outputTokens ?? 0) }} tokens
              · Research complete
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

        <div class="info-banner amber">
          <strong>Next: Claude Writer</strong>
          <span>Research is ready. Article writing will be enabled in Phase 4.</span>
        </div>
      </section>

      <section class="surface-card article-preview-card">
        <div class="card-heading">
          <div>
            <p class="eyebrow">CONTENT PREVIEW</p>
            <h2>{{ article.title || article.topic }}</h2>
          </div>
        </div>

        <div v-if="article.content" class="article-content" v-html="article.content"></div>
        <div v-else class="writer-pending-state">
          <strong>Research complete — article content has not been written yet.</strong>
          <span>Claude Writer will generate the title and article body in Phase 4.</span>
        </div>
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
