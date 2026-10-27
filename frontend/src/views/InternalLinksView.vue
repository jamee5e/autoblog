<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import AppLayout from "@/layouts/AppLayout.vue";
import { api, getApiErrorMessage } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import type { InternalLink, Website } from "@/types";

const auth = useAuthStore();

const websites = ref<Website[]>([]);
const internalLinks = ref<InternalLink[]>([]);
const loading = ref(true);
const saving = ref(false);
const syncing = ref(false);
const actionId = ref<string | null>(null);
const editingId = ref<string | null>(null);
const message = ref<{ type: "success" | "danger"; text: string } | null>(null);

const selectedWebsiteId = ref("");
const searchText = ref("");
const sourceFilter = ref<"ALL" | "MANUAL" | "WORDPRESS">("ALL");
const statusFilter = ref<"ALL" | "ACTIVE" | "INACTIVE">("ALL");

const form = reactive({
  websiteId: "",
  pageTitle: "",
  url: "",
  targetKeywordsText: "",
  anchorSuggestionsText: "",
  contentType: "",
  priority: 5,
  active: true
});

const isEditing = computed(() => Boolean(editingId.value));

const splitList = (value: string) =>
  [...new Set(
    value
      .split(/[\n,]/)
      .map((item) => item.trim())
      .filter(Boolean)
  )];

const filteredLinks = computed(() => {
  const query = searchText.value.trim().toLowerCase();

  return internalLinks.value.filter((link) => {
    if (selectedWebsiteId.value && link.websiteId !== selectedWebsiteId.value) {
      return false;
    }

    if (sourceFilter.value !== "ALL" && link.source !== sourceFilter.value) {
      return false;
    }

    if (statusFilter.value === "ACTIVE" && !link.active) return false;
    if (statusFilter.value === "INACTIVE" && link.active) return false;

    if (!query) return true;

    return [
      link.pageTitle,
      link.url,
      link.contentType || "",
      link.targetKeywords.join(" "),
      link.anchorSuggestions.join(" ")
    ]
      .join(" ")
      .toLowerCase()
      .includes(query);
  });
});

const resetForm = () => {
  editingId.value = null;
  Object.assign(form, {
    websiteId: selectedWebsiteId.value || websites.value[0]?.id || "",
    pageTitle: "",
    url: "",
    targetKeywordsText: "",
    anchorSuggestionsText: "",
    contentType: "",
    priority: 5,
    active: true
  });
};

const loadData = async () => {
  loading.value = true;

  try {
    const [websiteResponse, linkResponse] = await Promise.all([
      api.get("/websites"),
      api.get("/internal-links")
    ]);

    websites.value = websiteResponse.data.data;
    internalLinks.value = linkResponse.data.data;

    if (!selectedWebsiteId.value && websites.value[0]) {
      selectedWebsiteId.value = websites.value[0].id;
    }

    if (!form.websiteId) {
      form.websiteId = selectedWebsiteId.value;
    }
  } catch (error) {
    message.value = {
      type: "danger",
      text: getApiErrorMessage(error, "Unable to load Internal Link Library.")
    };
  } finally {
    loading.value = false;
  }
};

const editLink = (link: InternalLink) => {
  editingId.value = link.id;
  selectedWebsiteId.value = link.websiteId;

  Object.assign(form, {
    websiteId: link.websiteId,
    pageTitle: link.pageTitle,
    url: link.url,
    targetKeywordsText: link.targetKeywords.join(", "),
    anchorSuggestionsText: link.anchorSuggestions.join(", "),
    contentType: link.contentType || "",
    priority: link.priority,
    active: link.active
  });

  window.scrollTo({ top: 0, behavior: "smooth" });
};

const saveLink = async () => {
  message.value = null;

  if (!form.websiteId || !form.pageTitle.trim() || !form.url.trim()) {
    message.value = {
      type: "danger",
      text: "Website, Page Title and URL are required."
    };
    return;
  }

  saving.value = true;

  const payload = {
    websiteId: form.websiteId,
    pageTitle: form.pageTitle.trim(),
    url: form.url.trim(),
    targetKeywords: splitList(form.targetKeywordsText),
    anchorSuggestions: splitList(form.anchorSuggestionsText),
    contentType: form.contentType.trim() || null,
    priority: Number(form.priority),
    active: form.active
  };

  try {
    if (editingId.value) {
      await api.put(`/internal-links/${editingId.value}`, payload);
      message.value = {
        type: "success",
        text: "Internal link updated successfully."
      };
    } else {
      await api.post("/internal-links", payload);
      message.value = {
        type: "success",
        text: "Internal link added successfully."
      };
    }

    selectedWebsiteId.value = form.websiteId;
    resetForm();
    await loadData();
  } catch (error) {
    message.value = {
      type: "danger",
      text: getApiErrorMessage(error, "Unable to save internal link.")
    };
  } finally {
    saving.value = false;
  }
};

const syncWordPress = async () => {
  if (!selectedWebsiteId.value) return;

  syncing.value = true;
  message.value = null;

  try {
    const { data } = await api.post("/internal-links/sync", {
      websiteId: selectedWebsiteId.value
    });

    message.value = {
      type: "success",
      text:
        `WordPress sync complete: ${data.data.created} new, ` +
        `${data.data.updated} updated from ${data.data.totalFromWordPress} published items.`
    };

    await loadData();
  } catch (error) {
    message.value = {
      type: "danger",
      text: getApiErrorMessage(error, "Unable to sync WordPress content.")
    };
  } finally {
    syncing.value = false;
  }
};

const toggleActive = async (link: InternalLink) => {
  actionId.value = `toggle-${link.id}`;
  message.value = null;

  try {
    await api.put(`/internal-links/${link.id}`, {
      active: !link.active
    });
    await loadData();
  } catch (error) {
    message.value = {
      type: "danger",
      text: getApiErrorMessage(error, "Unable to update internal link status.")
    };
  } finally {
    actionId.value = null;
  }
};

const removeLink = async (link: InternalLink) => {
  if (!auth.isAdmin) return;

  const confirmed = window.confirm(
    `Delete "${link.pageTitle}" from the Internal Link Library?`
  );

  if (!confirmed) return;

  actionId.value = `delete-${link.id}`;
  message.value = null;

  try {
    await api.delete(`/internal-links/${link.id}`);

    if (editingId.value === link.id) {
      resetForm();
    }

    message.value = {
      type: "success",
      text: "Internal link deleted."
    };

    await loadData();
  } catch (error) {
    message.value = {
      type: "danger",
      text: getApiErrorMessage(error, "Unable to delete internal link.")
    };
  } finally {
    actionId.value = null;
  }
};

const formatDateTime = (value: string | null) =>
  value
    ? new Date(value).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short"
      })
    : "Never";

onMounted(loadData);
</script>

<template>
  <AppLayout>
    <div class="page-header">
      <div>
        <p class="eyebrow">SEO CONTENT ASSETS</p>
        <h1>Internal Link Library</h1>
        <p>จัดการ URL ภายในของแต่ละเว็บไซต์ และให้ Writer Agent เลือกเฉพาะลิงก์ที่อนุญาต</p>
      </div>

      <div class="button-row">
        <select v-model="selectedWebsiteId" class="compact-select">
          <option value="" disabled>Select website</option>
          <option
            v-for="website in websites"
            :key="website.id"
            :value="website.id"
          >
            {{ website.name }}
          </option>
        </select>

        <button
          class="primary-button"
          type="button"
          :disabled="syncing || !selectedWebsiteId"
          @click="syncWordPress"
        >
          {{ syncing ? "Syncing..." : "Sync WordPress" }}
        </button>
      </div>
    </div>

    <div v-if="message" class="alert" :class="message.type">
      {{ message.text }}
    </div>

    <section class="two-column-layout internal-link-layout">
      <article class="surface-card form-card">
        <div class="card-heading">
          <div>
            <p class="eyebrow">{{ isEditing ? "EDIT LINK" : "ADD LINK" }}</p>
            <h2>{{ isEditing ? "Update Internal Link" : "Add Internal Link" }}</h2>
          </div>
        </div>

        <form class="form-grid" @submit.prevent="saveLink">
          <label>
            Website
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
            Page Title
            <input
              v-model="form.pageTitle"
              placeholder="Phi Phi Island Tour"
              maxlength="300"
              required
            />
          </label>

          <label>
            URL
            <input
              v-model="form.url"
              type="url"
              placeholder="https://www.example.com/phi-phi-island-tour/"
              required
            />
            <small>ต้องเป็น URL ภายใน Website ที่เลือกเท่านั้น</small>
          </label>

          <label>
            Target Keywords
            <textarea
              v-model="form.targetKeywordsText"
              rows="3"
              placeholder="Phi Phi Island, Phi Phi tour, island hopping, snorkeling"
            ></textarea>
            <small>คั่นด้วย comma หรือขึ้นบรรทัดใหม่</small>
          </label>

          <label>
            Anchor Suggestions
            <textarea
              v-model="form.anchorSuggestionsText"
              rows="3"
              placeholder="Phi Phi Island tour, day trip to Phi Phi, visit the Phi Phi Islands"
            ></textarea>
          </label>

          <div class="topic-focus-two-col">
            <label>
              Content Type
              <input
                v-model="form.contentType"
                placeholder="Tour, Blog, Guide, Page"
                maxlength="100"
              />
            </label>

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
          </div>

          <label class="topic-focus-active-field">
            Active
            <span class="topic-focus-switch-row">
              <input v-model="form.active" type="checkbox" />
              <strong>{{ form.active ? "Yes" : "No" }}</strong>
            </span>
          </label>

          <div class="button-row">
            <button class="primary-button" type="submit" :disabled="saving">
              {{ saving ? "Saving..." : isEditing ? "Update Link" : "Add Link" }}
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

        <div class="info-banner green top-gap">
          <strong>Safe internal linking</strong>
          <span>
            Writer Agent ใช้ URL จาก Library นี้เท่านั้น URL ที่ AI สร้างเองจะไม่ถูกเก็บไว้ในบทความ
          </span>
        </div>
      </article>

      <article class="surface-card">
        <div class="card-heading">
          <div>
            <p class="eyebrow">LINK LIBRARY</p>
            <h2>Website Internal Links</h2>
          </div>
          <span class="count-pill">{{ filteredLinks.length }} links</span>
        </div>

        <div class="internal-link-filters">
          <input
            v-model="searchText"
            placeholder="Search title, URL or keyword..."
          />
          <select v-model="sourceFilter">
            <option value="ALL">All Sources</option>
            <option value="WORDPRESS">WordPress</option>
            <option value="MANUAL">Manual</option>
          </select>
          <select v-model="statusFilter">
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>

        <div v-if="loading" class="empty-state">
          Loading Internal Link Library...
        </div>

        <div v-else-if="filteredLinks.length === 0" class="empty-state">
          <strong>No internal links found.</strong>
          <span>กด Sync WordPress หรือเพิ่ม URL เองจากฟอร์มด้านซ้าย</span>
        </div>

        <div v-else class="internal-link-list">
          <article
            v-for="link in filteredLinks"
            :key="link.id"
            class="internal-link-item"
            :class="{ inactive: !link.active }"
          >
            <div class="internal-link-head">
              <div>
                <div class="topic-focus-title-row">
                  <strong>{{ link.pageTitle }}</strong>
                  <span class="priority-chip">P{{ link.priority }}</span>
                  <span
                    class="source-chip"
                    :class="link.source.toLowerCase()"
                  >
                    {{ link.source }}
                  </span>
                  <span
                    class="schedule-status"
                    :class="link.active ? 'completed' : 'cancelled'"
                  >
                    {{ link.active ? "ACTIVE" : "INACTIVE" }}
                  </span>
                </div>

                <a
                  :href="link.url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="internal-link-url"
                >
                  {{ link.url }}
                </a>
              </div>

              <div class="button-row">
                <button
                  class="secondary-button"
                  type="button"
                  @click="editLink(link)"
                >
                  Edit
                </button>
                <button
                  class="outline-button"
                  type="button"
                  :disabled="actionId === `toggle-${link.id}`"
                  @click="toggleActive(link)"
                >
                  {{ link.active ? "Pause" : "Activate" }}
                </button>
                <button
                  v-if="auth.isAdmin"
                  class="outline-button"
                  type="button"
                  :disabled="actionId === `delete-${link.id}`"
                  @click="removeLink(link)"
                >
                  Delete
                </button>
              </div>
            </div>

            <div v-if="link.targetKeywords.length" class="keyword-chips">
              <span
                v-for="keyword in link.targetKeywords"
                :key="keyword"
              >
                {{ keyword }}
              </span>
            </div>

            <div
              v-if="link.anchorSuggestions.length"
              class="internal-anchor-block"
            >
              <span class="meta-label">ANCHOR SUGGESTIONS</span>
              <p>{{ link.anchorSuggestions.join(" · ") }}</p>
            </div>

            <div class="internal-link-meta-grid">
              <div>
                <span class="meta-label">TYPE</span>
                <strong>{{ link.contentType || "—" }}</strong>
              </div>
              <div>
                <span class="meta-label">USED</span>
                <strong>{{ link.useCount }} times</strong>
              </div>
              <div>
                <span class="meta-label">LAST USED</span>
                <strong>{{ formatDateTime(link.lastUsedAt) }}</strong>
              </div>
              <div>
                <span class="meta-label">LAST SYNC</span>
                <strong>{{ formatDateTime(link.lastSyncedAt) }}</strong>
              </div>
            </div>
          </article>
        </div>
      </article>
    </section>
  </AppLayout>
</template>
