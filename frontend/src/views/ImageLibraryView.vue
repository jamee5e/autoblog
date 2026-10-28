<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import AppLayout from "@/layouts/AppLayout.vue";
import { api, getApiErrorMessage } from "@/services/api";
import type { ImageAsset, Website } from "@/types";

const websites = ref<Website[]>([]);
const imageAssets = ref<ImageAsset[]>([]);
const loading = ref(true);
const saving = ref(false);
const syncing = ref(false);
const actionId = ref<string | null>(null);
const editingId = ref<string | null>(null);
const message = ref<{ type: "success" | "danger"; text: string } | null>(null);

const selectedWebsiteId = ref("");
const searchText = ref("");
const statusFilter = ref<"ALL" | "READY" | "ACTIVE" | "INACTIVE">("ALL");

const form = reactive({
  title: "",
  altText: "",
  keywordsText: "",
  priority: 5,
  active: true
});

const selectedImage = computed(() =>
  editingId.value
    ? imageAssets.value.find((item) => item.id === editingId.value) ?? null
    : null
);

const splitList = (value: string) =>
  [...new Set(
    value
      .split(/[\n,]/)
      .map((item) => item.trim())
      .filter(Boolean)
  )];

const filteredImages = computed(() => {
  const query = searchText.value.trim().toLowerCase();

  return imageAssets.value.filter((image) => {
    if (selectedWebsiteId.value && image.websiteId !== selectedWebsiteId.value) {
      return false;
    }

    if (
      statusFilter.value === "READY" &&
      (!image.active || !image.selectionReady)
    ) return false;
    if (statusFilter.value === "ACTIVE" && !image.active) return false;
    if (statusFilter.value === "INACTIVE" && image.active) return false;

    if (!query) return true;

    return [
      image.title,
      image.altText || "",
      image.sourceUrl,
      image.keywords.join(" ")
    ]
      .join(" ")
      .toLowerCase()
      .includes(query);
  });
});

const resetForm = () => {
  editingId.value = null;
  Object.assign(form, {
    title: "",
    altText: "",
    keywordsText: "",
    priority: 5,
    active: true
  });
};

const loadData = async () => {
  loading.value = true;

  try {
    const [websiteResponse, imageResponse] = await Promise.all([
      api.get("/websites"),
      api.get("/image-assets")
    ]);

    websites.value = websiteResponse.data.data;
    imageAssets.value = imageResponse.data.data;

    if (!selectedWebsiteId.value && websites.value[0]) {
      selectedWebsiteId.value = websites.value[0].id;
    }
  } catch (error) {
    message.value = {
      type: "danger",
      text: getApiErrorMessage(error, "Unable to load Image Library.")
    };
  } finally {
    loading.value = false;
  }
};

const editImage = (image: ImageAsset) => {
  editingId.value = image.id;
  selectedWebsiteId.value = image.websiteId;

  Object.assign(form, {
    title: image.title,
    altText: image.altText || "",
    keywordsText: image.keywords.join(", "),
    priority: image.priority,
    active: image.active
  });

  window.scrollTo({ top: 0, behavior: "smooth" });
};

const saveImage = async () => {
  if (!editingId.value) return;

  message.value = null;

  if (!form.title.trim()) {
    message.value = {
      type: "danger",
      text: "Image title is required."
    };
    return;
  }

  saving.value = true;

  try {
    await api.put(`/image-assets/${editingId.value}`, {
      title: form.title.trim(),
      altText: form.altText.trim() || null,
      keywords: splitList(form.keywordsText),
      priority: Number(form.priority),
      active: form.active
    });

    message.value = {
      type: "success",
      text: "Image metadata updated successfully."
    };

    resetForm();
    await loadData();
  } catch (error) {
    message.value = {
      type: "danger",
      text: getApiErrorMessage(error, "Unable to update image metadata.")
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
    const { data } = await api.post("/image-assets/sync", {
      websiteId: selectedWebsiteId.value
    });

    message.value =
      data.data.totalFromWordPress > 0
        ? {
            type: "success",
            text:
              `WordPress image sync complete: ${data.data.created} new, ` +
              `${data.data.updated} updated, ${data.data.deactivated} deactivated ` +
              `from ${data.data.totalFromWordPress} images.`
          }
        : {
            type: "danger",
            text:
              "WordPress returned 0 image items. Check System Logs → image-library / wordpress for the sync details."
          };

    await loadData();
  } catch (error) {
    message.value = {
      type: "danger",
      text: getApiErrorMessage(error, "Unable to sync WordPress images.")
    };
  } finally {
    syncing.value = false;
  }
};

const toggleActive = async (image: ImageAsset) => {
  actionId.value = image.id;
  message.value = null;

  try {
    await api.put(`/image-assets/${image.id}`, {
      active: !image.active
    });
    await loadData();
  } catch (error) {
    message.value = {
      type: "danger",
      text: getApiErrorMessage(error, "Unable to update image status.")
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

watch(selectedWebsiteId, () => {
  if (editingId.value) {
    const image = selectedImage.value;
    if (image && image.websiteId !== selectedWebsiteId.value) {
      resetForm();
    }
  }
});

onMounted(loadData);
</script>

<template>
  <AppLayout>
    <div class="page-header">
      <div>
        <p class="eyebrow">CONTENT ASSETS</p>
        <h1>Image Library</h1>
        <p>ซิงก์รูปจาก WordPress Media Library แล้วกำหนด Keyword, Alt Text และ Priority ให้ระบบเลือกใช้กับบทความ</p>
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
          {{ syncing ? "Syncing..." : "Sync WordPress Images" }}
        </button>
      </div>
    </div>

    <div v-if="message" class="alert" :class="message.type">
      {{ message.text }}
    </div>

    <section class="two-column-layout image-library-layout">
      <article class="surface-card form-card">
        <div class="card-heading">
          <div>
            <p class="eyebrow">IMAGE METADATA</p>
            <h2>{{ selectedImage ? "Edit Image" : "Select an Image" }}</h2>
          </div>
        </div>

        <template v-if="selectedImage">
          <img
            class="image-editor-preview"
            :src="selectedImage.sourceUrl"
            :alt="selectedImage.altText || selectedImage.title"
          />

          <div class="image-dimension-line">
            WordPress Media #{{ selectedImage.wordpressMediaId }}
            · {{ selectedImage.width || "?" }}×{{ selectedImage.height || "?" }}
          </div>

          <form class="form-grid top-gap" @submit.prevent="saveImage">
            <label>
              Image Title
              <input v-model="form.title" maxlength="300" required />
            </label>

            <label>
              Alt Text
              <textarea
                v-model="form.altText"
                rows="3"
                maxlength="500"
                placeholder="Describe the image clearly for accessibility and SEO"
              ></textarea>
            </label>

            <label>
              Image Keywords
              <textarea
                v-model="form.keywordsText"
                rows="4"
                placeholder="Phi Phi Islands, Maya Bay, snorkeling, Phuket island tour"
              ></textarea>
              <small>
                ต้องใส่ Keyword อย่างน้อย 1 คำ รูปจึงจะพร้อมให้ระบบเลือกอัตโนมัติ
              </small>
            </label>

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

            <div
              class="info-banner"
              :class="splitList(form.keywordsText).length ? 'green' : 'amber'"
            >
              <strong>
                {{ splitList(form.keywordsText).length ? "Ready for Auto Selection" : "Needs Keywords" }}
              </strong>
              <span>
                การเลือกรูปใช้ Keyword + Priority + ขนาดรูปในระบบเรา
                และไม่เรียก AI API เพิ่ม
              </span>
            </div>

            <div class="button-row">
              <button class="primary-button" type="submit" :disabled="saving">
                {{ saving ? "Saving..." : "Save Image Metadata" }}
              </button>
              <button class="secondary-button" type="button" @click="resetForm">
                Cancel
              </button>
            </div>
          </form>
        </template>

        <div v-else class="empty-state">
          <strong>Select an image from the library.</strong>
          <span>กด Sync WordPress Images ก่อน หากยังไม่มีรูปในระบบ</span>
        </div>

        <div class="info-banner green top-gap">
          <strong>Curated keywords control image selection</strong>
          <span>
            WordPress เก็บไฟล์รูป ส่วนระบบเราเก็บ Keywords, Priority และ Active
            สำหรับเลือกภาพ โดยไม่ต้องส่งรูปไปวิเคราะห์กับ AI
          </span>
        </div>
      </article>

      <article class="surface-card">
        <div class="card-heading">
          <div>
            <p class="eyebrow">MEDIA LIBRARY</p>
            <h2>Website Images</h2>
          </div>
          <span class="count-pill">{{ filteredImages.length }} images</span>
        </div>

        <div class="image-library-filters">
          <input
            v-model="searchText"
            placeholder="Search title, alt text or keyword..."
          />
          <select v-model="statusFilter">
            <option value="ALL">All Status</option>
            <option value="READY">Ready for Auto Selection</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>

        <div v-if="loading" class="empty-state">
          Loading Image Library...
        </div>

        <div v-else-if="filteredImages.length === 0" class="empty-state">
          <strong>No WordPress images found.</strong>
          <span>กด Sync WordPress Images เพื่อดึง Media Library ของเว็บไซต์นี้</span>
        </div>

        <div v-else class="image-library-grid">
          <article
            v-for="image in filteredImages"
            :key="image.id"
            class="image-library-card"
            :class="{ inactive: !image.active, selected: editingId === image.id }"
          >
            <button
              class="image-card-preview-button"
              type="button"
              @click="editImage(image)"
            >
              <img
                :src="image.sourceUrl"
                :alt="image.altText || image.title"
                loading="lazy"
              />
            </button>

            <div class="image-card-body">
              <div class="topic-focus-title-row">
                <strong>{{ image.title }}</strong>
                <span class="priority-chip">P{{ image.priority }}</span>
              </div>

              <span class="image-card-meta">
                #{{ image.wordpressMediaId }}
                · {{ image.width || "?" }}×{{ image.height || "?" }}
                · Used {{ image.useCount }}
              </span>

              <span
                class="image-selection-chip"
                :class="image.active && image.selectionReady ? 'ready' : 'needs-keywords'"
              >
                {{
                  image.active && image.selectionReady
                    ? "READY FOR AUTO SELECTION"
                    : image.active
                      ? "NEEDS KEYWORDS"
                      : "INACTIVE"
                }}
              </span>

              <p v-if="image.altText">{{ image.altText }}</p>

              <div v-if="image.keywords.length" class="table-keywords">
                <span
                  v-for="keyword in image.keywords.slice(0, 4)"
                  :key="keyword"
                >
                  {{ keyword }}
                </span>
                <small v-if="image.keywords.length > 4">
                  +{{ image.keywords.length - 4 }}
                </small>
              </div>

              <div class="image-card-footer">
                <small>Last used: {{ formatDateTime(image.lastUsedAt) }}</small>
                <div class="button-row">
                  <button
                    class="secondary-button"
                    type="button"
                    @click="editImage(image)"
                  >
                    Edit
                  </button>
                  <button
                    class="outline-button"
                    type="button"
                    :disabled="actionId === image.id"
                    @click="toggleActive(image)"
                  >
                    {{ image.active ? "Pause" : "Activate" }}
                  </button>
                </div>
              </div>
            </div>
          </article>
        </div>
      </article>
    </section>
  </AppLayout>
</template>
