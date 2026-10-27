<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import AppLayout from "@/layouts/AppLayout.vue";
import StatusBadge from "@/components/StatusBadge.vue";
import { api, getApiErrorMessage } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import type { ArticlePreview } from "@/types";

const route = useRoute();
const auth = useAuthStore();
const article = ref<ArticlePreview | null>(null);
const errorMessage = ref("");
const successMessage = ref("");
const writing = ref(false);
const checking = ref(false);
const revising = ref(false);
const savingWordPressDraft = ref(false);
const publishingWordPress = ref(false);

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

const runQualityReview = async () => {
  if (!article.value?.content || checking.value) return;

  checking.value = true;
  errorMessage.value = "";
  successMessage.value = "";

  try {
    const { data } = await api.post(`/articles/${route.params.id}/quality`);
    const decision = data.data.review?.decision;
    successMessage.value =
      decision === "PASS"
        ? "SEO & Quality Agent passed the article. It is ready for review."
        : "SEO & Quality Agent found changes for the Writer Agent.";
    await loadArticle();
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, "Unable to complete quality review.");
    await loadArticle();
  } finally {
    checking.value = false;
  }
};

const saveWordPressDraft = async () => {
  if (!article.value || savingWordPressDraft.value || article.value.status !== "READY") return;

  savingWordPressDraft.value = true;
  errorMessage.value = "";
  successMessage.value = "";

  try {
    const { data } = await api.post(`/articles/${route.params.id}/wordpress-draft`);
    successMessage.value =
      data.data.action === "updated"
        ? "WordPress draft updated successfully."
        : "WordPress draft created successfully.";
    await loadArticle();
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, "Unable to save WordPress draft.");
    await loadArticle();
  } finally {
    savingWordPressDraft.value = false;
  }
};

const publishWordPress = async () => {
  if (
    !article.value?.wordpressPostId ||
    publishingWordPress.value ||
    article.value.status !== "READY" ||
    !auth.isAdmin
  ) {
    return;
  }

  const confirmed = window.confirm(
    "Publish this article to the live WordPress website now?"
  );

  if (!confirmed) return;

  publishingWordPress.value = true;
  errorMessage.value = "";
  successMessage.value = "";

  try {
    await api.post(`/articles/${route.params.id}/publish`);
    successMessage.value = "Article published to WordPress successfully.";
    await loadArticle();
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, "Unable to publish article to WordPress.");
    await loadArticle();
  } finally {
    publishingWordPress.value = false;
  }
};

const reviseFromQuality = async () => {
  if (!article.value?.qualityData || revising.value) return;

  revising.value = true;
  errorMessage.value = "";
  successMessage.value = "";

  try {
    await api.post(`/articles/${route.params.id}/revise`);
    successMessage.value =
      "Writer Agent completed the requested revision. Run the quality review again.";
    await loadArticle();
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, "Unable to revise article draft.");
    await loadArticle();
  } finally {
    revising.value = false;
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
          <span class="meta-label">QUALITY SCORE</span>
          <strong class="score-value">{{ article.qualityScore ?? "—" }}</strong>
        </article>
        <article class="surface-card wide">
          <span class="meta-label">STATUS / WEBSITE</span>
          <div class="summary-status-line">
            <StatusBadge :status="article.status" />
            <span>{{ article.website }} · {{ article.primaryKeyword }}</span>
          </div>
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
            <small>
              {{ article.writerRun.model }} · Gemini
              <template v-if="article.revisionCount > 0">
                · Revision {{ article.revisionCount }}/2
              </template>
            </small>
          </div>
        </div>

        <div v-if="article.content">
          <p v-if="article.excerpt" class="article-excerpt">{{ article.excerpt }}</p>
          <p v-if="article.metaDescription" class="article-meta-description">
            Meta: {{ article.metaDescription }}
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

      <section class="surface-card content-assets-card">
        <div class="card-heading">
          <div>
            <p class="eyebrow">CONTENT ASSETS</p>
            <h2>Internal Links</h2>
          </div>
          <RouterLink class="secondary-button" to="/internal-links">
            Manage Library
          </RouterLink>
        </div>

        <div v-if="!article.content" class="empty-inline">
          Internal links will be selected when the Writer Agent creates the article.
        </div>

        <div v-else-if="article.internalLinks.length === 0" class="empty-inline">
          No relevant approved internal link was used in this article.
        </div>

        <div v-else class="article-internal-links">
          <a
            v-for="item in article.internalLinks"
            :key="item.id"
            class="article-internal-link-item"
            :href="item.internalLink.url"
            target="_blank"
            rel="noopener noreferrer"
          >
            <div>
              <strong>{{ item.internalLink.pageTitle }}</strong>
              <span>{{ item.internalLink.url }}</span>
              <small v-if="item.anchorText">
                Anchor: {{ item.anchorText }}
              </small>
            </div>
            <span class="priority-chip">P{{ item.internalLink.priority }}</span>
          </a>
        </div>

        <div class="info-banner green top-gap">
          <strong>{{ article.internalLinks.length }} approved internal link(s)</strong>
          <span>
            Writer Agent can only keep URLs from the Internal Link Library. Unknown AI-generated links are removed.
          </span>
        </div>
      </section>

      <section class="surface-card quality-review-card">
        <div class="card-heading">
          <div>
            <p class="eyebrow">SEO & QUALITY AGENT</p>
            <h2>Quality Review</h2>
          </div>
          <div v-if="article.qualityRun" class="writer-run-meta">
            <span
              class="status-badge"
              :class="article.qualityData?.decision === 'PASS' ? 'success' : 'progress'"
            >
              {{ article.qualityData?.decision === "PASS" ? "Passed" : "Review Complete" }}
            </span>
            <small>{{ article.qualityRun.model }} · Gemini</small>
          </div>
        </div>

        <div v-if="!article.content" class="empty-inline">
          Complete the Writer Agent before running SEO & Quality.
        </div>

        <div v-else-if="!article.qualityData" class="quality-empty-state">
          <div>
            <strong>Article draft is ready for quality review.</strong>
            <span>
              Gemini will score SEO and quality, check research consistency, and return revision feedback.
            </span>
          </div>
          <button
            class="primary-button"
            type="button"
            :disabled="checking"
            @click="runQualityReview"
          >
            {{ checking ? "Quality Agent is reviewing..." : "Run SEO & Quality Review" }}
          </button>
        </div>

        <template v-else>
          <div class="quality-score-grid">
            <div>
              <span class="meta-label">DECISION</span>
              <strong
                class="quality-decision"
                :class="article.qualityData.decision === 'PASS' ? 'pass' : 'revise'"
              >
                {{ article.qualityData.decision === "PASS" ? "PASS" : "REVISION REQUIRED" }}
              </strong>
            </div>
            <div>
              <span class="meta-label">SEO SCORE</span>
              <strong>{{ article.qualityData.seoScore }}/100</strong>
            </div>
            <div>
              <span class="meta-label">QUALITY SCORE</span>
              <strong>{{ article.qualityData.qualityScore }}/100</strong>
            </div>
            <div>
              <span class="meta-label">REVISION</span>
              <strong>{{ article.revisionCount }}/2</strong>
            </div>
          </div>

          <div class="quality-summary">
            <span class="meta-label">REVIEW SUMMARY</span>
            <p>{{ article.qualityData.summary }}</p>
          </div>

          <div class="quality-summary">
            <span class="meta-label">META DESCRIPTION</span>
            <p>{{ article.qualityData.metaDescription }}</p>
          </div>

          <div v-if="article.qualityData.issues.length" class="quality-issues">
            <span class="meta-label">ISSUES</span>
            <div
              v-for="(issue, index) in article.qualityData.issues"
              :key="`${issue.category}-${index}`"
              class="quality-issue-item"
            >
              <div class="quality-issue-head">
                <strong>{{ issue.category }}</strong>
                <span class="severity-chip" :class="issue.severity.toLowerCase()">
                  {{ issue.severity }}
                </span>
              </div>
              <p>{{ issue.message }}</p>
              <small>{{ issue.suggestion }}</small>
            </div>
          </div>

          <div
            v-if="article.qualityData.decision === 'PASS'"
            class="info-banner green"
          >
            <strong>Ready for Review</strong>
            <span>The article passed the current SEO & Quality thresholds.</span>
          </div>

          <div
            v-else-if="article.revisionCount < 2"
            class="quality-action-panel"
          >
            <div>
              <strong>Writer revision available</strong>
              <span>
                The Writer Agent will revise only from the quality feedback. Maximum 2 revisions.
              </span>
            </div>
            <button
              class="primary-button"
              type="button"
              :disabled="revising"
              @click="reviseFromQuality"
            >
              {{ revising ? "Writer Agent is revising..." : `Revise with Writer (${article.revisionCount + 1}/2)` }}
            </button>
          </div>

          <div v-else class="info-banner amber">
            <strong>Maximum AI revisions reached.</strong>
            <span>Review the remaining issues manually before publishing.</span>
          </div>
        </template>

        <div v-if="article.wordpressPostId" class="wordpress-status-panel">
          <div>
            <span class="meta-label">WORDPRESS DRAFT</span>
            <strong>Post ID {{ article.wordpressPostId }}</strong>
            <small>
              {{ article.status === "PUBLISHED" ? "Published" : "Draft saved in WordPress" }}
            </small>
          </div>
          <a
            v-if="article.wordpressUrl"
            class="secondary-button"
            :href="article.wordpressUrl"
            target="_blank"
            rel="noopener noreferrer"
          >
            Open WordPress →
          </a>
        </div>

        <div class="button-row top-gap">
          <button class="secondary-button" disabled>Edit</button>
          <button
            class="secondary-button"
            type="button"
            :disabled="checking || !article.content || article.status === 'PUBLISHED'"
            @click="runQualityReview"
          >
            {{ article.qualityData ? "Run Review Again" : "Review" }}
          </button>

          <button
            class="outline-button"
            type="button"
            :disabled="
              savingWordPressDraft ||
              article.status !== 'READY'
            "
            @click="saveWordPressDraft"
          >
            {{
              savingWordPressDraft
                ? "Saving to WordPress..."
                : article.wordpressPostId
                  ? "Update WordPress Draft"
                  : "Save WordPress Draft"
            }}
          </button>

          <button
            class="primary-button"
            type="button"
            :disabled="
              publishingWordPress ||
              !auth.isAdmin ||
              !article.wordpressPostId ||
              article.status !== 'READY'
            "
            @click="publishWordPress"
          >
            {{
              publishingWordPress
                ? "Publishing..."
                : article.status === "PUBLISHED"
                  ? "Published"
                  : "Publish to WordPress"
            }}
          </button>
        </div>

        <div
          v-if="article.status === 'READY' && !auth.isAdmin"
          class="empty-inline top-gap"
        >
          Editors can prepare the WordPress draft. Final publishing is restricted to Admin.
        </div>
      </section>
    </template>
  </AppLayout>
</template>
