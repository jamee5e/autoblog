<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import AppLayout from "@/layouts/AppLayout.vue";
import { api, getApiErrorMessage } from "@/services/api";
import type {
  BlogTopicFocus,
  ContentFormat,
  OrchestrationResponse,
  ResearchResponse,
  ScheduledContentSource,
  ScheduledJob,
  ScheduledJobAction,
  Website
} from "@/types";

type ContentSourceMode = "TOPIC_FOCUS" | "MANUAL";

const formatLabel = (format: ContentFormat) => {
  const labels: Record<ContentFormat, string> = {
    AUTO: "Auto",
    LIST_GUIDE: "List Guide",
    DESTINATION_GUIDE: "Destination Guide",
    COMPARISON: "Comparison",
    PLANNING_GUIDE: "Planning Guide"
  };

  return labels[format];
};

const websites = ref<Website[]>([]);
const topicFocuses = ref<BlogTopicFocus[]>([]);
const schedules = ref<ScheduledJob[]>([]);

const contentSource = ref<ContentSourceMode>("TOPIC_FOCUS");
const selectedWebsite = ref("");
const selectedTopicFocusId = ref("__AUTO__");
const topic = ref("");
const keyword = ref("");
const instructions = ref("");

const scheduledDate = ref("");
const scheduledTime = ref("");
const scheduleAction = ref<ScheduledJobAction>("GENERATE_AND_DRAFT");

const submitting = ref(false);
const scheduling = ref(false);
const loadingSchedules = ref(false);
const errorMessage = ref("");
const successMessage = ref("");
const researchResult = ref<ResearchResponse | null>(null);
const orchestrationResult = ref<OrchestrationResponse | null>(null);
const activeAction = ref<"research" | "full" | null>(null);

const scheduleTimezone =
  Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Bangkok";

let scheduleRefreshTimer: number | null = null;

const websiteTopicFocuses = computed(() =>
  topicFocuses.value.filter(
    (focus) => focus.websiteId === selectedWebsite.value && focus.active
  )
);

const selectedTopicFocus = computed(() =>
  selectedTopicFocusId.value === "__AUTO__"
    ? null
    : websiteTopicFocuses.value.find(
        (focus) => focus.id === selectedTopicFocusId.value
      ) ?? null
);

const dateOnlyFromNow = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const isFocusEligibleForDate = (
  focus: BlogTopicFocus,
  dateValue: string
) => {
  const start = focus.startDate?.slice(0, 10) || null;
  const end = focus.endDate?.slice(0, 10) || null;

  if (start && dateValue < start) return false;
  if (end && dateValue > end) return false;
  return focus.active;
};

const eligibleFocusesToday = computed(() => {
  const today = dateOnlyFromNow();
  return websiteTopicFocuses.value.filter((focus) =>
    isFocusEligibleForDate(focus, today)
  );
});

const selectedFocusEligibleNow = computed(() => {
  if (selectedTopicFocusId.value === "__AUTO__") {
    return eligibleFocusesToday.value.length > 0;
  }

  return selectedTopicFocus.value
    ? isFocusEligibleForDate(selectedTopicFocus.value, dateOnlyFromNow())
    : false;
});

const manualBriefIsValid = computed(
  () =>
    Boolean(selectedWebsite.value) &&
    topic.value.trim().length >= 3 &&
    keyword.value.trim().length > 0
);

const focusBriefIsValid = computed(
  () =>
    Boolean(selectedWebsite.value) &&
    websiteTopicFocuses.value.length > 0 &&
    selectedFocusEligibleNow.value
);

const canGenerate = computed(
  () =>
    !submitting.value &&
    !scheduling.value &&
    (contentSource.value === "MANUAL"
      ? manualBriefIsValid.value
      : focusBriefIsValid.value)
);

const canResearchOnly = computed(
  () =>
    contentSource.value === "MANUAL" &&
    manualBriefIsValid.value &&
    !submitting.value &&
    !scheduling.value
);

const minScheduleDate = computed(() => dateOnlyFromNow());

const scheduleHasEligibleFocus = computed(() => {
  if (contentSource.value !== "TOPIC_FOCUS" || !scheduledDate.value) {
    return true;
  }

  if (selectedTopicFocusId.value === "__AUTO__") {
    return websiteTopicFocuses.value.some((focus) =>
      isFocusEligibleForDate(focus, scheduledDate.value)
    );
  }

  return selectedTopicFocus.value
    ? isFocusEligibleForDate(selectedTopicFocus.value, scheduledDate.value)
    : false;
});

const canSchedule = computed(() => {
  if (
    submitting.value ||
    scheduling.value ||
    !selectedWebsite.value ||
    !scheduledDate.value ||
    !scheduledTime.value
  ) {
    return false;
  }

  if (contentSource.value === "MANUAL") {
    return manualBriefIsValid.value;
  }

  return websiteTopicFocuses.value.length > 0 && scheduleHasEligibleFocus.value;
});

const formatDateOnly = (value: string | null) => {
  if (!value) return "No limit";
  const [year, month, day] = value.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
};

const loadWebsites = async () => {
  const { data } = await api.get("/websites");
  websites.value = data.data;

  if (!selectedWebsite.value && websites.value[0]) {
    selectedWebsite.value = websites.value[0].id;
  }
};

const loadTopicFocuses = async () => {
  const { data } = await api.get("/topic-focuses");
  topicFocuses.value = data.data;
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

const generateFullArticle = async () => {
  if (!canGenerate.value) return;

  submitting.value = true;
  activeAction.value = "full";
  errorMessage.value = "";
  successMessage.value = "";
  researchResult.value = null;
  orchestrationResult.value = null;

  try {
    const { data } =
      contentSource.value === "TOPIC_FOCUS"
        ? await api.post("/articles/orchestrate-topic-focus", {
            websiteId: selectedWebsite.value,
            topicFocusId:
              selectedTopicFocusId.value === "__AUTO__"
                ? undefined
                : selectedTopicFocusId.value
          })
        : await api.post("/articles/orchestrate", {
            websiteId: selectedWebsite.value,
            topic: topic.value.trim(),
            primaryKeyword: keyword.value.trim(),
            additionalInstructions: instructions.value.trim() || undefined
          });

    orchestrationResult.value = data.data;
    successMessage.value =
      data.data.decision === "PASS"
        ? "Full AI workflow completed. The article is ready for review."
        : "Full AI workflow completed. Manual review is still required.";

    if (contentSource.value === "TOPIC_FOCUS") {
      await loadTopicFocuses();
    }
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

const researchTopic = async () => {
  if (!canResearchOnly.value) return;

  submitting.value = true;
  activeAction.value = "research";
  errorMessage.value = "";
  successMessage.value = "";
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
    successMessage.value = "Research Agent completed successfully.";
  } catch (error) {
    errorMessage.value = getApiErrorMessage(
      error,
      "Unable to complete Gemini research."
    );
  } finally {
    submitting.value = false;
    activeAction.value = null;
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
  successMessage.value = "";

  const scheduledContentSource: ScheduledContentSource =
    contentSource.value === "MANUAL"
      ? "MANUAL"
      : selectedTopicFocusId.value === "__AUTO__"
        ? "TOPIC_FOCUS_AUTO"
        : "TOPIC_FOCUS_SELECTED";

  const payload = {
    websiteId: selectedWebsite.value,
    contentSource: scheduledContentSource,
    topicFocusId:
      scheduledContentSource === "TOPIC_FOCUS_SELECTED"
        ? selectedTopicFocusId.value
        : undefined,
    topic:
      scheduledContentSource === "MANUAL"
        ? topic.value.trim()
        : undefined,
    primaryKeyword:
      scheduledContentSource === "MANUAL"
        ? keyword.value.trim()
        : undefined,
    additionalInstructions:
      scheduledContentSource === "MANUAL"
        ? instructions.value.trim() || undefined
        : undefined,
    scheduledAt: localDateTime.toISOString(),
    timezone: scheduleTimezone,
    action: scheduleAction.value
  };

  try {
    await api.post("/schedules", payload);
    successMessage.value =
      scheduleAction.value === "GENERATE_AND_DRAFT"
        ? "Scheduled successfully. After PASS, the system will also save a WordPress draft."
        : "Scheduled successfully. The system will stop at Ready for Review.";

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
  successMessage.value = "";

  try {
    await api.post(`/schedules/${scheduledJobId}/cancel`);
    successMessage.value = "Scheduled workflow cancelled.";
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

const scheduleSourceLabel = (job: ScheduledJob) => {
  if (job.contentSource === "MANUAL") {
    return `Manual · ${job.primaryKeyword || "No keyword"}`;
  }

  if (job.contentSource === "TOPIC_FOCUS_SELECTED") {
    return `Topic Focus · ${job.topicFocus?.title || "Selected Focus"}`;
  }

  return "Topic Focus · Auto Select";
};

watch(selectedWebsite, () => {
  selectedTopicFocusId.value = "__AUTO__";
});

watch(contentSource, () => {
  errorMessage.value = "";
  successMessage.value = "";
  orchestrationResult.value = null;
  researchResult.value = null;
});

onMounted(async () => {
  try {
    await Promise.all([
      loadWebsites(),
      loadTopicFocuses(),
      loadSchedules()
    ]);
  } catch (error) {
    errorMessage.value = getApiErrorMessage(
      error,
      "Unable to load Generate Blog data."
    );
  }

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
        <p>สร้างบทความจาก Content Strategy หรือกรอกหัวข้อเอง และตั้งเวลาให้ระบบทำงานอัตโนมัติ</p>
      </div>
      <span class="status-badge success">Automation Ready</span>
    </div>

    <div v-if="errorMessage" class="alert danger">{{ errorMessage }}</div>
    <div v-if="successMessage" class="alert success">{{ successMessage }}</div>

    <section class="surface-card content-source-card">
      <div class="content-source-heading">
        <div>
          <p class="eyebrow">CONTENT SOURCE</p>
          <h2>Choose how to create this article</h2>
        </div>
        <RouterLink class="secondary-button" to="/topic-focuses">
          Manage Topic Focus →
        </RouterLink>
      </div>

      <div class="source-switch">
        <button
          type="button"
          :class="{ active: contentSource === 'TOPIC_FOCUS' }"
          @click="contentSource = 'TOPIC_FOCUS'"
        >
          <strong>Blog Topic Focus</strong>
          <span>Use campaign strategy, keywords, angle and active date range</span>
        </button>
        <button
          type="button"
          :class="{ active: contentSource === 'MANUAL' }"
          @click="contentSource = 'MANUAL'"
        >
          <strong>Manual Topic</strong>
          <span>Enter a one-off topic and keyword manually</span>
        </button>
      </div>
    </section>

    <section class="generate-grid">
      <article class="surface-card">
        <div class="card-heading">
          <div>
            <p class="eyebrow">
              {{ contentSource === "TOPIC_FOCUS" ? "CONTENT STRATEGY" : "MANUAL BRIEF" }}
            </p>
            <h2>
              {{ contentSource === "TOPIC_FOCUS" ? "Blog Topic Focus" : "Content Brief" }}
            </h2>
          </div>
        </div>

        <div class="form-grid">
          <label>
            Website
            <select v-model="selectedWebsite" :disabled="submitting || scheduling">
              <option value="" disabled>Select website</option>
              <option
                v-for="website in websites"
                :key="website.id"
                :value="website.id"
              >
                {{ website.name }}
              </option>
            </select>
          </label>

          <template v-if="contentSource === 'TOPIC_FOCUS'">
            <label>
              Topic Focus
              <select
                v-model="selectedTopicFocusId"
                :disabled="submitting || scheduling || !selectedWebsite"
              >
                <option value="__AUTO__">Auto Select Best Focus</option>
                <option
                  v-for="focus in websiteTopicFocuses"
                  :key="focus.id"
                  :value="focus.id"
                >
                  {{ focus.title }} · {{ formatLabel(focus.contentFormat) }} · P{{ focus.priority }}
                </option>
              </select>
              <small>
                Auto Select ใช้ Priority + Active Date + Last Used + Use Count
              </small>
            </label>

            <div
              v-if="selectedTopicFocus"
              class="focus-preview"
              :class="{ warning: !selectedFocusEligibleNow }"
            >
              <div class="focus-preview-head">
                <div>
                  <span class="meta-label">SELECTED FOCUS</span>
                  <strong>{{ selectedTopicFocus.title }}</strong>
                </div>
                <span class="priority-chip">P{{ selectedTopicFocus.priority }}</span>
              </div>

              <div class="focus-preview-grid">
                <div>
                  <span class="meta-label">FOCUS TOPIC</span>
                  <p>{{ selectedTopicFocus.focusTopic }}</p>
                </div>
                <div>
                  <span class="meta-label">ACTIVE PERIOD</span>
                  <p>
                    {{ formatDateOnly(selectedTopicFocus.startDate) }}
                    →
                    {{ formatDateOnly(selectedTopicFocus.endDate) }}
                  </p>
                </div>
              </div>

              <div class="focus-writing-preview">
                <div>
                  <span class="meta-label">FORMAT</span>
                  <strong>{{ formatLabel(selectedTopicFocus.contentFormat) }}</strong>
                </div>
                <div>
                  <span class="meta-label">TARGET LENGTH</span>
                  <strong>
                    {{ selectedTopicFocus.targetWordMin }}–{{ selectedTopicFocus.targetWordMax }} words
                  </strong>
                </div>
                <div>
                  <span class="meta-label">SECTIONS</span>
                  <strong>{{ selectedTopicFocus.suggestedSections || "Flexible" }}</strong>
                </div>
              </div>

              <div v-if="selectedTopicFocus.keywords.length" class="keyword-chips">
                <span
                  v-for="focusKeyword in selectedTopicFocus.keywords"
                  :key="focusKeyword"
                >
                  {{ focusKeyword }}
                </span>
              </div>

              <div v-if="selectedTopicFocus.angle" class="focus-preview-copy">
                <span class="meta-label">ANGLE</span>
                <p>{{ selectedTopicFocus.angle }}</p>
              </div>

              <div v-if="!selectedFocusEligibleNow" class="empty-inline">
                Focus นี้ยังไม่อยู่ในช่วง Active วันนี้ แต่ยังสามารถตั้ง Schedule
                ให้ทำงานในช่วงวันที่ของ Campaign ได้
              </div>
            </div>

            <div
              v-else-if="selectedTopicFocusId === '__AUTO__'"
              class="focus-auto-preview"
            >
              <div>
                <span class="meta-label">AUTO SELECT</span>
                <strong>{{ eligibleFocusesToday.length }} eligible focus today</strong>
                <p>
                  ระบบจะเลือก Campaign ที่เหมาะสมที่สุดจาก Priority และประวัติการใช้งาน
                  แล้วใช้ Writing Profile ของ Focus นั้นอัตโนมัติ
                </p>
              </div>
              <RouterLink class="secondary-button" to="/topic-focuses">
                View Strategy
              </RouterLink>
            </div>

            <div v-if="websiteTopicFocuses.length === 0" class="empty-inline">
              Website นี้ยังไม่มี Active Blog Topic Focus
              <RouterLink to="/topic-focuses">สร้าง Topic Focus ก่อน →</RouterLink>
            </div>
          </template>

          <template v-else>
            <label>
              Topic
              <input
                v-model="topic"
                :disabled="submitting || scheduling"
                placeholder="Best time to visit Khao Sok"
                required
              />
            </label>

            <label>
              Primary Keyword
              <input
                v-model="keyword"
                :disabled="submitting || scheduling"
                placeholder="best time to visit khao sok"
                required
              />
            </label>

            <label>
              Additional Instructions
              <textarea
                v-model="instructions"
                :disabled="submitting || scheduling"
                rows="5"
                placeholder="Optional research direction..."
              ></textarea>
            </label>
          </template>

          <div class="button-row">
            <button
              class="primary-button"
              type="button"
              :disabled="!canGenerate"
              @click="generateFullArticle"
            >
              {{
                activeAction === "full"
                  ? "AI workflow is running..."
                  : "Generate Full Article"
              }}
            </button>

            <button
              v-if="contentSource === 'MANUAL'"
              class="secondary-button"
              type="button"
              :disabled="!canResearchOnly"
              @click="researchTopic"
            >
              {{
                activeAction === "research"
                  ? "Gemini is researching..."
                  : "Research Only"
              }}
            </button>
          </div>

          <div v-if="activeAction === 'full'" class="info-banner green">
            <strong>Full workflow is running.</strong>
            <span>
              Research → Writer → SEO & Quality → automatic revision up to 2 times.
            </span>
          </div>
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
          <div class="complete">
            <span>1</span>
            <div>
              <strong>Content Strategy</strong>
              <small>Topic Focus or Manual Brief</small>
            </div>
          </div>
          <div class="complete">
            <span>2</span>
            <div>
              <strong>Research Agent</strong>
              <small>Search intent, facts, sections and related keywords</small>
            </div>
          </div>
          <div class="complete">
            <span>3</span>
            <div>
              <strong>Writer Agent</strong>
              <small>Create the full structured article</small>
            </div>
          </div>
          <div class="complete">
            <span>4</span>
            <div>
              <strong>SEO & Quality</strong>
              <small>Score, review and auto revision up to 2 times</small>
            </div>
          </div>
          <div class="complete">
            <span>5</span>
            <div>
              <strong>Human Review</strong>
              <small>WordPress Draft can be automatic; live Publish stays manual</small>
            </div>
          </div>
        </div>

        <div class="info-banner green">
          <strong>
            {{ contentSource === "TOPIC_FOCUS" ? "Strategy-led generation" : "Manual generation" }}
          </strong>
          <span v-if="contentSource === 'TOPIC_FOCUS'">
            Topic Focus keeps every article aligned with the selected campaign and date range.
          </span>
          <span v-else>
            Manual Topic is best for one-off articles or urgent content requests.
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
            Schedule uses the current Content Source selected above.
          </p>
        </div>
        <span class="status-badge progress">{{ scheduleTimezone }}</span>
      </div>

      <div class="schedule-source-summary">
        <span class="meta-label">CONTENT SOURCE</span>
        <strong>
          {{
            contentSource === "MANUAL"
              ? "Manual Topic"
              : selectedTopicFocusId === "__AUTO__"
                ? "Blog Topic Focus · Auto Select"
                : `Blog Topic Focus · ${selectedTopicFocus?.title || "Selected"}`
          }}
        </strong>
        <small v-if="contentSource === 'TOPIC_FOCUS'">
          Focus จะถูกตรวจสอบกับ Active Date อีกครั้งเมื่อถึงเวลาทำงานจริง
        </small>
      </div>

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

      <div
        v-if="
          contentSource === 'TOPIC_FOCUS' &&
          scheduledDate &&
          !scheduleHasEligibleFocus
        "
        class="alert waiting top-gap"
      >
        ไม่มี Topic Focus ที่ใช้งานได้ในวันที่เลือก กรุณาเปลี่ยนวันที่หรือ Campaign
      </div>

      <div class="info-banner green top-gap">
        <strong>Live publishing remains manual.</strong>
        <span>
          Scheduler can generate the article and create a WordPress Draft after PASS,
          but Admin still approves the final Publish.
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
              <strong>
                {{ job.article?.title || job.topicFocus?.title || job.topic || "Scheduled Article" }}
              </strong>
              <span class="schedule-status" :class="job.status.toLowerCase()">
                {{ job.status }}
              </span>
            </div>
            <span>{{ job.website.name }} · {{ scheduleSourceLabel(job) }}</span>
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
          <h2>{{ orchestrationResult.topicFocus?.title || topic || "Generated Article" }}</h2>
          <p>
            {{ orchestrationResult.decision === "PASS" ? "Ready for Review" : "Manual Review Needed" }}
            · Revision {{ orchestrationResult.revisionCount }}/{{ orchestrationResult.maxRevisions }}
          </p>
        </div>
        <RouterLink
          class="primary-button"
          :to="`/articles/${orchestrationResult.articleId}`"
        >
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

      <div
        v-if="orchestrationResult.topicFocus"
        class="focus-result-banner"
      >
        <span class="meta-label">TOPIC FOCUS USED</span>
        <strong>{{ orchestrationResult.topicFocus.title }}</strong>
        <span>
          {{ orchestrationResult.topicFocus.focusTopic }}
          · {{ formatLabel(orchestrationResult.topicFocus.contentFormat) }}
          · {{ orchestrationResult.topicFocus.targetWordMin }}–{{ orchestrationResult.topicFocus.targetWordMax }} words
        </span>
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
        <RouterLink
          class="primary-button"
          :to="`/articles/${researchResult.articleId}`"
        >
          View Research →
        </RouterLink>
      </div>
    </section>
  </AppLayout>
</template>
