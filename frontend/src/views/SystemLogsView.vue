<script setup lang="ts">
import { onMounted, ref } from "vue";
import AppLayout from "@/layouts/AppLayout.vue";
import { api, getApiErrorMessage } from "@/services/api";
import type { SystemLog } from "@/types";

const logs = ref<SystemLog[]>([]);
const loading = ref(false);
const moduleFilter = ref("");
const levelFilter = ref("");
const errorMessage = ref("");

const loadLogs = async () => {
  loading.value = true;
  errorMessage.value = "";
  try {
    const params = new URLSearchParams();
    if (moduleFilter.value.trim()) params.set("module", moduleFilter.value.trim());
    if (levelFilter.value) params.set("level", levelFilter.value);
    const suffix = params.toString() ? `?${params.toString()}` : "";
    const { data } = await api.get(`/system-logs${suffix}`);
    logs.value = data.data;
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, "Unable to load system logs.");
  } finally {
    loading.value = false;
  }
};

onMounted(loadLogs);
</script>

<template>
  <AppLayout>
    <div class="page-header">
      <div>
        <p class="eyebrow">ADMIN TOOLS</p>
        <h1>System Logs</h1>
        <p>ตรวจสอบสถานะระบบโดยไม่เปิดเผย credentials หรือ secret values</p>
      </div>
    </div>

    <section class="surface-card">
      <form class="filter-row" @submit.prevent="loadLogs">
        <input v-model="moduleFilter" placeholder="Filter module e.g. wordpress" />
        <select v-model="levelFilter">
          <option value="">All levels</option>
          <option value="DEBUG">DEBUG</option>
          <option value="INFO">INFO</option>
          <option value="WARN">WARN</option>
          <option value="ERROR">ERROR</option>
        </select>
        <button class="primary-button" type="submit" :disabled="loading">
          {{ loading ? "Loading..." : "Apply Filters" }}
        </button>
      </form>

      <div v-if="errorMessage" class="alert danger">{{ errorMessage }}</div>
      <div v-if="!loading && logs.length === 0" class="empty-state">No logs found.</div>
      <div v-else class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Date / Time</th>
              <th>Level</th>
              <th>Module</th>
              <th>Message</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="log in logs" :key="log.id">
              <td>{{ new Date(log.createdAt).toLocaleString() }}</td>
              <td><span class="log-level" :class="log.level.toLowerCase()">{{ log.level }}</span></td>
              <td>{{ log.module }}</td>
              <td>{{ log.message }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </AppLayout>
</template>
