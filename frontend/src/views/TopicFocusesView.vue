<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import AppLayout from "@/layouts/AppLayout.vue";
import { api, getApiErrorMessage } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import type { BlogTopicFocus, ContentFormat, Website } from "@/types";

const auth = useAuthStore();
const websites = ref<Website[]>([]);
const topicFocuses = ref<BlogTopicFocus[]>([]);
const loading = ref(true);
const saving = ref(false);
const actionId = ref<string | null>(null);
const editingId = ref<string | null>(null);
const message = ref<{ type: "success" | "danger"; text: string } | null>(null);

const contentFormatOptions: Array<{
  value: ContentFormat;
  label: string;
  description: string;
}> = [
  {
    value: "AUTO",
    label: "Auto",
    description: "ให้ AI เลือกโครงสร้างที่เหมาะกับ search intent"
  },
  {
    value: "LIST_GUIDE",
    label: "List Guide",
    description: "เหมาะกับ Best, Top, Things to do และบทความแบบลิสต์"
  },
  {
    value: "DESTINATION_GUIDE",
    label: "Destination Guide",
    description: "เหมาะกับสถานที่ เกาะ ชายหาด และพื้นที่ท่องเที่ยว"
  },
  {
    value: "COMPARISON",
    label: "Comparison",
    description: "เหมาะกับ X vs Y หรือบทความช่วยเปรียบเทียบตัวเลือก"
  },
  {
    value: "PLANNING_GUIDE",
    label: "Planning Guide",
    description: "เหมาะกับ itinerary, how-to และการวางแผนทริป"
  }
];

const formatLabel = (format: ContentFormat) =>
  contentFormatOptions.find((item) => item.value === format)?.label || format;

const form = reactive({
  websiteId: "",
  title: "",
  focusTopic: "",
  keywordsText: "",
  angle: "",
  contentFormat: "AUTO" as ContentFormat,
  targetWordMin: 700,
  targetWordMax: 1000,
  suggestedSections: 8,
  priority: 5,
  active: true,
  startDate: "",
  endDate: "",
  notes: ""
});

const isEditing = computed(() => Boolean(editingId.value));

const normalizeDateOnly = (value: string | null) =>
  value ? value.slice(0, 10) : "";

const formatDateOnly = (value: string | null) => {
  if (!value) return "No limit";
  const [year, month, day] = value.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
};

const parseKeywords = (value: string) =>
  [...new Set(
    value
      .split(/[\n,]/)
      .map((item) => item.trim())
      .filter(Boolean)
  )];

const resetForm = () => {
  editingId.value = null;
  Object.assign(form, {
    websiteId: websites.value[0]?.id || "",
    title: "",
    focusTopic: "",
    keywordsText: "",
    angle: "",
    contentFormat: "AUTO" as ContentFormat,
    targetWordMin: 700,
    targetWordMax: 1000,
    suggestedSections: 8,
    priority: 5,
    active: true,
    startDate: "",
    endDate: "",
    notes: ""
  });
};

const loadData = async () => {
  loading.value = true;
  try {
    const [websiteResponse, focusResponse] = await Promise.all([
      api.get("/websites"),
      api.get("/topic-focuses")
    ]);

    websites.value = websiteResponse.data.data;
    topicFocuses.value = focusResponse.data.data;

    if (!form.websiteId && websites.value[0]) {
      form.websiteId = websites.value[0].id;
    }
  } catch (error) {
    message.value = {
      type: "danger",
      text: getApiErrorMessage(error, "Unable to load Blog Topic Focus data.")
    };
  } finally {
    loading.value = false;
  }
};

const editFocus = (focus: BlogTopicFocus) => {
  editingId.value = focus.id;
  Object.assign(form, {
    websiteId: focus.websiteId,
    title: focus.title,
    focusTopic: focus.focusTopic,
    keywordsText: focus.keywords.join(", "),
    angle: focus.angle || "",
    contentFormat: focus.contentFormat,
    targetWordMin: focus.targetWordMin,
    targetWordMax: focus.targetWordMax,
    suggestedSections: focus.suggestedSections ?? 8,
    priority: focus.priority,
    active: focus.active,
    startDate: normalizeDateOnly(focus.startDate),
    endDate: normalizeDateOnly(focus.endDate),
    notes: focus.notes || ""
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
};

const saveFocus = async () => {
  message.value = null;

  const keywords = parseKeywords(form.keywordsText);

  if (!form.websiteId || form.title.trim().length < 2 || form.focusTopic.trim().length < 2) {
    message.value = {
      type: "danger",
      text: "Website, Title and Focus Topic are required."
    };
    return;
  }

  if (form.targetWordMin > form.targetWordMax) {
    message.value = {
      type: "danger",
      text: "Minimum word target must be less than or equal to maximum."
    };
    return;
  }

  if (form.startDate && form.endDate && form.startDate > form.endDate) {
    message.value = {
      type: "danger",
      text: "Start Date must be before or equal to End Date."
    };
    return;
  }

  saving.value = true;

  const payload = {
    websiteId: form.websiteId,
    title: form.title.trim(),
    focusTopic: form.focusTopic.trim(),
    keywords,
    angle: form.angle.trim() || null,
    contentFormat: form.contentFormat,
    targetWordMin: Number(form.targetWordMin),
    targetWordMax: Number(form.targetWordMax),
    suggestedSections: form.suggestedSections
      ? Number(form.suggestedSections)
      : null,
    priority: Number(form.priority),
    active: form.active,
    startDate: form.startDate || null,
    endDate: form.endDate || null,
    notes: form.notes.trim() || null
  };

  try {
    if (editingId.value) {
      await api.put(`/topic-focuses/${editingId.value}`, payload);
      message.value = {
        type: "success",
        text: "Blog Topic Focus updated successfully."
      };
    } else {
      await api.post("/topic-focuses", payload);
      message.value = {
        type: "success",
        text: "Blog Topic Focus created successfully."
      };
    }

    resetForm();
    await loadData();
  } catch (error) {
    message.value = {
      type: "danger",
      text: getApiErrorMessage(error, "Unable to save Blog Topic Focus.")
    };
  } finally {
    saving.value = false;
  }
};

const toggleActive = async (focus: BlogTopicFocus) => {
  actionId.value = `toggle-${focus.id}`;
  message.value = null;

  try {
    await api.put(`/topic-focuses/${focus.id}`, {
      active: !focus.active
    });
    await loadData();
  } catch (error) {
    message.value = {
      type: "danger",
      text: getApiErrorMessage(error, "Unable to update active status.")
    };
  } finally {
    actionId.value = null;
  }
};

const removeFocus = async (focus: BlogTopicFocus) => {
  if (!auth.isAdmin) return;

  const confirmed = window.confirm(
    `Delete "${focus.title}"? This cannot be undone.`
  );

  if (!confirmed) return;

  actionId.value = `delete-${focus.id}`;
  message.value = null;

  try {
    await api.delete(`/topic-focuses/${focus.id}`);
    message.value = {
      type: "success",
      text: "Blog Topic Focus deleted."
    };
    if (editingId.value === focus.id) resetForm();
    await loadData();
  } catch (error) {
    message.value = {
      type: "danger",
      text: getApiErrorMessage(error, "Unable to delete Blog Topic Focus.")
    };
  } finally {
    actionId.value = null;
  }
};

onMounted(loadData);
</script>

<template>
  <AppLayout>
    <div class="page-header">
      <div>
        <p class="eyebrow">CONTENT STRATEGY</p>
        <h1>Blog Topic Focus</h1>
        <p>กำหนด Campaign, Focus Topic, Writing Format, Keywords และช่วงวันที่ให้ AI ใช้สร้างบทความ</p>
      </div>
      <span class="status-badge success">{{ topicFocuses.length }} Focus</span>
    </div>

    <div v-if="message" class="alert" :class="message.type">
      {{ message.text }}
    </div>

    <section class="two-column-layout topic-focus-layout">
      <article class="surface-card form-card">
        <div class="card-heading">
          <div>
            <p class="eyebrow">{{ isEditing ? "EDIT FOCUS" : "NEW FOCUS" }}</p>
            <h2>{{ isEditing ? "Update Blog Topic Focus" : "Create Blog Topic Focus" }}</h2>
          </div>
        </div>

        <form class="form-grid" @submit.prevent="saveFocus">
          <label>
            Site
            <select v-model="form.websiteId" required>
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

          <label>
            Title
            <input
              v-model="form.title"
              placeholder="Rainy Season Campaign"
              maxlength="160"
              required
            />
          </label>

          <label>
            Focus Topic
            <input
              v-model="form.focusTopic"
              placeholder="Khao Sok rainy season travel"
              maxlength="300"
              required
            />
          </label>

          <label>
            Keywords
            <textarea
              v-model="form.keywordsText"
              rows="3"
              placeholder="rainy season, Khao Sok weather, jungle, packing, Cheow Lan Lake"
            ></textarea>
            <small>คั่นด้วย comma หรือขึ้นบรรทัดใหม่</small>
          </label>

          <label>
            Angle
            <textarea
              v-model="form.angle"
              rows="4"
              maxlength="1500"
              placeholder="Help international travelers understand what to expect and decide whether visiting Khao Sok during rainy season is right for them."
            ></textarea>
          </label>

          <label>
            Content Format
            <select v-model="form.contentFormat">
              <option
                v-for="option in contentFormatOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>
            <small>
              {{
                contentFormatOptions.find((item) => item.value === form.contentFormat)?.description
              }}
            </small>
          </label>

          <div class="topic-focus-writing-grid">
            <label>
              Target Words Min
              <input
                v-model.number="form.targetWordMin"
                type="number"
                min="400"
                max="2500"
                step="50"
                required
              />
            </label>

            <label>
              Target Words Max
              <input
                v-model.number="form.targetWordMax"
                type="number"
                min="400"
                max="2500"
                step="50"
                required
              />
            </label>

            <label>
              Suggested Sections
              <input
                v-model.number="form.suggestedSections"
                type="number"
                min="3"
                max="20"
              />
            </label>
          </div>

          <div class="topic-focus-two-col">
            <label>
              Priority (1–10)
              <input
                v-model.number="form.priority"
                type="number"
                min="1"
                max="10"
                required
              />
            </label>

            <label class="topic-focus-active-field">
              Active
              <span class="topic-focus-switch-row">
                <input v-model="form.active" type="checkbox" />
                <strong>{{ form.active ? "Yes" : "No" }}</strong>
              </span>
            </label>
          </div>

          <div class="topic-focus-two-col">
            <label>
              Start Date
              <input v-model="form.startDate" type="date" />
            </label>

            <label>
              End Date
              <input v-model="form.endDate" type="date" />
            </label>
          </div>

          <label>
            Notes
            <textarea
              v-model="form.notes"
              rows="4"
              maxlength="2000"
              placeholder="Do not guarantee wildlife sightings. Do not invent exact rainfall or weather predictions."
            ></textarea>
          </label>

          <div class="button-row">
            <button class="primary-button" type="submit" :disabled="saving">
              {{ saving ? "Saving..." : isEditing ? "Update Topic Focus" : "Save Topic Focus" }}
            </button>
            <button
              v-if="isEditing"
              class="secondary-button"
              type="button"
              @click="resetForm"
            >
              Cancel
            </button>
          </div>
        </form>
      </article>

      <article class="surface-card">
        <div class="card-heading">
          <div>
            <p class="eyebrow">TOPIC LIBRARY</p>
            <h2>Campaign & Focus List</h2>
          </div>
          <span class="count-pill">{{ topicFocuses.length }} items</span>
        </div>

        <div v-if="loading" class="empty-state">Loading Blog Topic Focus...</div>

        <div v-else-if="topicFocuses.length === 0" class="empty-state">
          <strong>No Blog Topic Focus yet.</strong>
          <span>Create the first campaign for a connected website.</span>
        </div>

        <div v-else class="topic-focus-list">
          <article
            v-for="focus in topicFocuses"
            :key="focus.id"
            class="topic-focus-item"
            :class="{ inactive: !focus.active }"
          >
            <div class="topic-focus-head">
              <div>
                <div class="topic-focus-title-row">
                  <strong>{{ focus.title }}</strong>
                  <span class="priority-chip">P{{ focus.priority }}</span>
                  <span class="content-format-chip">{{ formatLabel(focus.contentFormat) }}</span>
                  <span
                    class="schedule-status"
                    :class="focus.active ? 'completed' : 'cancelled'"
                  >
                    {{ focus.active ? "ACTIVE" : "INACTIVE" }}
                  </span>
                </div>
                <span>{{ focus.website.name }}</span>
              </div>

              <div class="button-row">
                <button
                  class="secondary-button"
                  type="button"
                  @click="editFocus(focus)"
                >
                  Edit
                </button>
                <button
                  class="outline-button"
                  type="button"
                  :disabled="actionId === `toggle-${focus.id}`"
                  @click="toggleActive(focus)"
                >
                  {{ focus.active ? "Pause" : "Activate" }}
                </button>
                <button
                  v-if="auth.isAdmin"
                  class="outline-button"
                  type="button"
                  :disabled="actionId === `delete-${focus.id}`"
                  @click="removeFocus(focus)"
                >
                  Delete
                </button>
              </div>
            </div>

            <div class="topic-focus-block">
              <span class="meta-label">FOCUS TOPIC</span>
              <p>{{ focus.focusTopic }}</p>
            </div>

            <div v-if="focus.keywords.length" class="keyword-chips">
              <span v-for="keyword in focus.keywords" :key="keyword">
                {{ keyword }}
              </span>
            </div>

            <div v-if="focus.angle" class="topic-focus-block">
              <span class="meta-label">ANGLE</span>
              <p>{{ focus.angle }}</p>
            </div>

            <div class="topic-focus-writing-summary">
              <div>
                <span class="meta-label">FORMAT</span>
                <strong>{{ formatLabel(focus.contentFormat) }}</strong>
              </div>
              <div>
                <span class="meta-label">TARGET LENGTH</span>
                <strong>{{ focus.targetWordMin }}–{{ focus.targetWordMax }} words</strong>
              </div>
              <div>
                <span class="meta-label">SECTIONS</span>
                <strong>{{ focus.suggestedSections || "Flexible" }}</strong>
              </div>
            </div>

            <div class="topic-focus-meta-grid">
              <div>
                <span class="meta-label">START</span>
                <strong>{{ formatDateOnly(focus.startDate) }}</strong>
              </div>
              <div>
                <span class="meta-label">END</span>
                <strong>{{ formatDateOnly(focus.endDate) }}</strong>
              </div>
              <div>
                <span class="meta-label">USED</span>
                <strong>{{ focus.useCount }} times</strong>
              </div>
              <div>
                <span class="meta-label">LAST USED</span>
                <strong>
                  {{
                    focus.lastUsedAt
                      ? new Date(focus.lastUsedAt).toLocaleString()
                      : "Never"
                  }}
                </strong>
              </div>
            </div>

            <div v-if="focus.notes" class="topic-focus-notes">
              <span class="meta-label">NOTES</span>
              <p>{{ focus.notes }}</p>
            </div>
          </article>
        </div>
      </article>
    </section>
  </AppLayout>
</template>
