<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import AppLayout from "@/layouts/AppLayout.vue";
import StatusBadge from "@/components/StatusBadge.vue";
import { api, getApiErrorMessage } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import type { Website } from "@/types";

const auth = useAuthStore();
const websites = ref<Website[]>([]);
const loading = ref(true);
const saving = ref(false);
const editingId = ref<string | null>(null);
const message = ref<{ type: "success" | "danger"; text: string } | null>(null);
const actionId = ref<string | null>(null);

const form = reactive({
  name: "",
  wordpressUrl: "",
  wordpressUsername: "",
  wordpressApplicationPassword: "",
  defaultAuthor: "",
  defaultCategory: ""
});

const isEditing = computed(() => Boolean(editingId.value));

const resetForm = () => {
  editingId.value = null;
  Object.assign(form, {
    name: "",
    wordpressUrl: "",
    wordpressUsername: "",
    wordpressApplicationPassword: "",
    defaultAuthor: "",
    defaultCategory: ""
  });
};

const loadWebsites = async () => {
  loading.value = true;
  try {
    const { data } = await api.get("/websites");
    websites.value = data.data;
  } finally {
    loading.value = false;
  }
};

const editWebsite = (website: Website) => {
  editingId.value = website.id;
  Object.assign(form, {
    name: website.name,
    wordpressUrl: website.wordpressUrl,
    wordpressUsername: website.wordpressUsername,
    wordpressApplicationPassword: "",
    defaultAuthor: website.defaultAuthor || "",
    defaultCategory: website.defaultCategory || ""
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
};

const saveWebsite = async () => {
  if (!auth.isAdmin) return;
  message.value = null;
  saving.value = true;

  const payload: Record<string, string | undefined> = {
    companyId: auth.user?.companyId,
    name: form.name.trim(),
    wordpressUrl: form.wordpressUrl.trim(),
    wordpressUsername: form.wordpressUsername.trim(),
    defaultAuthor: form.defaultAuthor.trim() || undefined,
    defaultCategory: form.defaultCategory.trim() || undefined
  };

  if (form.wordpressApplicationPassword) {
    payload.wordpressApplicationPassword = form.wordpressApplicationPassword;
  }

  try {
    if (editingId.value) {
      await api.put(`/websites/${editingId.value}`, payload);
      message.value = { type: "success", text: "Website updated successfully." };
    } else {
      await api.post("/websites", payload);
      message.value = { type: "success", text: "Website added successfully." };
    }
    resetForm();
    await loadWebsites();
  } catch (error) {
    message.value = { type: "danger", text: getApiErrorMessage(error, "Unable to save website.") };
  } finally {
    saving.value = false;
  }
};

const testConnection = async (website: Website) => {
  actionId.value = `connection-${website.id}`;
  message.value = null;
  try {
    const { data } = await api.post(`/websites/${website.id}/test-connection`);
    message.value = { type: "success", text: data.message || "WordPress connection successful." };
  } catch {
    message.value = { type: "danger", text: "Unable to connect. Check the WordPress URL and credentials." };
  } finally {
    actionId.value = null;
  }
};

const createDraft = async (website: Website) => {
  actionId.value = `draft-${website.id}`;
  message.value = null;
  try {
    const { data } = await api.post(`/websites/${website.id}/test-draft`, {
      title: "KSD Auto Blog Integration Test",
      slug: "ksd-auto-blog-integration-test",
      excerpt: "Test post created by KSD Auto Blog Platform.",
      content: "<p>This is a WordPress integration test from the KSD Auto Blog Platform.</p>"
    });
    message.value = {
      type: "success",
      text: `Draft created successfully · Post ID ${data.wordpressPostId} · ${data.status}`
    };
  } catch (error) {
    message.value = { type: "danger", text: getApiErrorMessage(error, "Unable to create test draft.") };
  } finally {
    actionId.value = null;
  }
};

onMounted(loadWebsites);
</script>

<template>
  <AppLayout>
    <div class="page-header">
      <div>
        <p class="eyebrow">WORDPRESS INTEGRATION</p>
        <h1>Websites</h1>
        <p>จัดการ WordPress websites และทดสอบการเชื่อมต่อจริงของ Phase 2</p>
      </div>
      <StatusBadge status="Phase 2 In Progress" />
    </div>

    <div v-if="message" class="alert" :class="message.type">{{ message.text }}</div>

    <section class="two-column-layout">
      <article class="surface-card form-card">
        <div class="card-heading">
          <div>
            <p class="eyebrow">{{ isEditing ? "EDIT WEBSITE" : "ADD WEBSITE" }}</p>
            <h2>{{ isEditing ? "Update WordPress Website" : "Connect WordPress Website" }}</h2>
          </div>
        </div>

        <div v-if="!auth.isAdmin" class="alert waiting">Editor accounts can view websites but only Admin can change credentials.</div>

        <form class="form-grid" @submit.prevent="saveWebsite">
          <label>
            Website Name
            <input v-model="form.name" :disabled="!auth.isAdmin" required />
          </label>
          <label>
            WordPress URL
            <input v-model="form.wordpressUrl" :disabled="!auth.isAdmin" placeholder="https://example.com" required />
          </label>
          <label>
            WordPress Username
            <input v-model="form.wordpressUsername" :disabled="!auth.isAdmin" required />
          </label>
          <label>
            WordPress Application Password
            <input
              v-model="form.wordpressApplicationPassword"
              :disabled="!auth.isAdmin"
              type="password"
              :required="!isEditing"
              autocomplete="new-password"
            />
            <small v-if="isEditing">Leave blank to keep the existing credential.</small>
          </label>
          <label>
            Default Author
            <input v-model="form.defaultAuthor" :disabled="!auth.isAdmin" />
          </label>
          <label>
            Default Category
            <input v-model="form.defaultCategory" :disabled="!auth.isAdmin" />
          </label>

          <div class="button-row">
            <button class="primary-button" type="submit" :disabled="saving || !auth.isAdmin">
              {{ saving ? "Saving..." : isEditing ? "Update Website" : "Add Website" }}
            </button>
            <button v-if="isEditing" class="secondary-button" type="button" @click="resetForm">Cancel</button>
          </div>
        </form>
      </article>

      <article class="surface-card">
        <div class="card-heading">
          <div>
            <p class="eyebrow">CONNECTED SITES</p>
            <h2>Website List</h2>
          </div>
          <span class="count-pill">{{ websites.length }} sites</span>
        </div>

        <div v-if="loading" class="empty-state">Loading websites...</div>
        <div v-else-if="websites.length === 0" class="empty-state">
          <strong>No WordPress websites connected yet.</strong>
          <span>Add Website #1 when KSD credentials are available.</span>
        </div>

        <div v-else class="website-list">
          <article v-for="website in websites" :key="website.id" class="website-item">
            <div class="website-topline">
              <div>
                <strong>{{ website.name }}</strong>
                <a :href="website.wordpressUrl" target="_blank" rel="noreferrer">{{ website.wordpressUrl }}</a>
              </div>
              <StatusBadge :status="website.status" />
            </div>
            <div class="website-meta">
              <span>Username: {{ website.wordpressUsername }}</span>
              <span>Created: {{ new Date(website.createdAt).toLocaleDateString() }}</span>
            </div>
            <div v-if="auth.isAdmin" class="button-row">
              <button class="secondary-button" type="button" @click="editWebsite(website)">Edit</button>
              <button
                class="outline-button"
                type="button"
                :disabled="actionId === `connection-${website.id}`"
                @click="testConnection(website)"
              >
                {{ actionId === `connection-${website.id}` ? "Testing..." : "Test Connection" }}
              </button>
              <button
                class="primary-button"
                type="button"
                :disabled="actionId === `draft-${website.id}`"
                @click="createDraft(website)"
              >
                {{ actionId === `draft-${website.id}` ? "Creating..." : "Create Test Draft" }}
              </button>
            </div>
          </article>
        </div>
      </article>
    </section>
  </AppLayout>
</template>
