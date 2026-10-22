<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import AppLayout from "@/layouts/AppLayout.vue";
import { api, getApiErrorMessage } from "@/services/api";
import type {
  OrchestrationResponse,
  ResearchResponse,
  ScheduledJob,
  ScheduledJobAction,
  Website
} from "@/types";

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
const scheduledDate = ref("");
const scheduledTime = ref("");
const scheduleAction = ref<ScheduledJobAction>("GENERATE_AND_DRAFT");
const scheduling = ref(false);
const scheduleSuccess = ref("");
const schedules = ref<ScheduledJob[]>([]);
const loadingSchedules = ref(false);
const scheduleTimezone =
  Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Bangkok";
let scheduleRefreshTimer: number | null = null;

const briefIsValid = computed(
  () =>
    Boolean(selectedWebsite.value) &&
    topic.value.trim().length >= 3 &&
    keyword.value.trim().length > 0
);

const canResearch = computed(
  () => briefIsValid.value && !submitting.value && !scheduling.value
);

const canSchedule = computed(
  () =>
    briefIsValid.value &&
    Boolean(scheduledDate.value) &&
    Boolean(scheduledTime.value) &&
    !submitting.value &&
    !scheduling.value
);

const minScheduleDate = computed(() => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
});

const loadWebsites = async () => {
  try {
    const { data } = await api.get("/websites");
    websites.value = data.data;
    if (websites.value[0]) selectedWebsite.value = websites.value[0].id;
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, "Unable to load websites.");
  }
};

const loadSchedules = async (silent = false) => {
  if (!silent) loadingSchedules.value = true;

  try {
    const { data } = await api.get("/schedules");
    schedules.value = data.data;
  } catch (error) {
    if (!silent) {
      errorMessage.value = getApiErrorMessage(
        error,
        "Unable to load scheduled workflows."
      );
    }
  } finally {
    if (!silent) loadingSchedules.value = false;
  }
};

const scheduleFullArticle = async () => {
  if (!canSchedule.value) return;

  const localDateTime = new Date(
    `${scheduledDate.value}T${scheduledTime.value}:00`
  );

  if (
    Number.isNaN(localDateTime.getTime()) ||
    localDateTime.getTime() <= Date.now()
  ) {
    errorMessage.value = "Choose a future date and time for the scheduled workflow.";
    return;
  }

  scheduling.value = true;
  errorMessage.value = "";
  scheduleSuccess.value = "";

  try {
    await api.post("/schedules", {
      websiteId: selectedWebsite.value,
      topic: topic.value.trim(),
      primaryKeyword: keyword.value.trim(),
      additionalInstructions: instructions.value.trim() || undefined,
      scheduledAt: localDateTime.toISOString(),
      timezone: scheduleTimezone,
      action: scheduleAction.value
    });

    scheduleSuccess.value =
      scheduleAction.value === "GENERATE_AND_DRAFT"
        ? "Scheduled. The AI workflow will run automatically and save a WordPress draft after PASS."
        : "Scheduled. The AI workflow will run automatically at the selected time.";

    scheduledDate.value = "";
    scheduledTime.value = "";
    await loadSchedules();
  } catch (error) {
    errorMessage.value = getApiErrorMessage(
      error,
      "Unable to schedule the article workflow."
    );
  } finally {
    scheduling.value = false;
  }
};

const cancelSchedule = async (scheduledJobId: string) => {
  errorMessage.value = "";
  scheduleSuccess.value = "";

  try {
    await api.post(`/schedules/${scheduledJobId}/cancel`);
    scheduleSuccess.value = "Scheduled workflow cancelled.";
    await loadSchedules();
  } catch (error) {
    errorMessage.value = getApiErrorMessage(
      error,
      "Unable to cancel the scheduled workflow."
    );
  }
};

const formatScheduledAt = (value: string) =>
  new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  });

const scheduleActionLabel = (action: ScheduledJobAction) =>
  action === "GENERATE_AND_DRAFT"
    ? "AI + WordPress Draft"
    : "AI Workflow Only";


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

onMounted(async () => {
  await Promise.all([loadWebsites(), loadSchedules()]);
  scheduleRefreshTimer = window.setInterval(() => {
    void loadSchedules(true);
  }, 30_000);
});

onBeforeUnmount(() => {
  if (scheduleRefreshTimer !== null) {
    window.clearInterval(scheduleRefreshTimer);
  }
});
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


    <section class="surface-card schedule-card">
      <div class="card-heading">
        <div>
          <p class="eyebrow">AUTOMATION</p>
          <h2>Schedule Full Workflow</h2>
          <p class="schedule-helper">
            เลือกวันและเวลาให้ระบบทำ Research → Writer → SEO & Quality อัตโนมัติ
          </p>
        </div>
        <span class="status-badge progress">{{ scheduleTimezone }}</span>
      </div>

      <div v-if="scheduleSuccess" class="alert success">{{ scheduleSuccess }}</div>

      <div class="schedule-form-grid">
        <label>
          Date
          <input
            v-model="scheduledDate"
            type="date"
            :min="minScheduleDate"
            :disabled="scheduling || submitting"
          />
        </label>

        <label>
          Time
          <input
            v-model="scheduledTime"
            type="time"
            :disabled="scheduling || submitting"
          />
        </label>

        <label>
          After AI Workflow
          <select
            v-model="scheduleAction"
            :disabled="scheduling || submitting"
          >
            <option value="GENERATE_AND_DRAFT">
              Save WordPress Draft after PASS
            </option>
            <option value="GENERATE_ONLY">
              Stop at Ready for Review
            </option>
          </select>
        </label>

        <button
          class="primary-button schedule-submit"
          type="button"
          :disabled="!canSchedule"
          @click="scheduleFullArticle"
        >
          {{ scheduling ? "Scheduling..." : "Schedule Automatic Run" }}
        </button>
      </div>

      <div class="info-banner green top-gap">
        <strong>Publishing remains manual.</strong>
        <span>
          Scheduled jobs can create a WordPress Draft automatically after PASS,
          but they will not publish live without Admin approval.
        </span>
      </div>

      <div class="schedule-list-head">
        <div>
          <span class="meta-label">SCHEDULED JOBS</span>
          <strong>Upcoming & Recent</strong>
        </div>
        <button
          class="secondary-button"
          type="button"
          :disabled="loadingSchedules"
          @click="loadSchedules()"
        >
          {{ loadingSchedules ? "Refreshing..." : "Refresh" }}
        </button>
      </div>

      <div v-if="!loadingSchedules && schedules.length === 0" class="empty-inline">
        No scheduled workflows yet.
      </div>

      <div v-else class="schedule-list">
        <article
          v-for="job in schedules"
          :key="job.id"
          class="schedule-item"
        >
          <div class="schedule-main">
            <div class="schedule-title-row">
              <strong>{{ job.topic }}</strong>
              <span class="schedule-status" :class="job.status.toLowerCase()">
                {{ job.status }}
              </span>
            </div>
            <span>{{ job.website.name }} · {{ job.primaryKeyword }}</span>
            <small>
              {{ formatScheduledAt(job.scheduledAt) }}
              · {{ job.timezone }}
              · {{ scheduleActionLabel(job.action) }}
            </small>
            <small v-if="job.lastError" class="schedule-error">
              {{ job.lastError }}
            </small>
          </div>

          <div class="schedule-actions">
            <RouterLink
              v-if="job.article"
              class="secondary-button"
              :to="`/articles/${job.article.id}`"
            >
              View Article
            </RouterLink>
            <a
              v-if="job.article?.wordpressUrl"
              class="secondary-button"
              :href="job.article.wordpressUrl"
              target="_blank"
              rel="noopener noreferrer"
            >
              WordPress
            </a>
            <button
              v-if="job.status === 'PENDING'"
              class="outline-button"
              type="button"
              @click="cancelSchedule(job.id)"
            >
              Cancel
            </button>
          </div>
        </article>
      </div>
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
