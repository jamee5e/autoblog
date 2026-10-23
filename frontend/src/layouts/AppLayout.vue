<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";

const auth = useAuthStore();
const router = useRouter();

const initials = computed(() =>
  (auth.user?.name || "KSD")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
);

const logout = async () => {
  auth.clearSession();
  await router.push("/login");
};
</script>

<template>
  <div class="app-shell">
    <aside class="app-sidebar">
      <div class="brand">
        <div class="brand-logo">KSD</div>
        <div>
          <strong>KSD Auto Blog</strong>
          <small>Content Platform</small>
        </div>
      </div>

      <nav class="app-nav">
        <RouterLink to="/dashboard">Dashboard</RouterLink>
        <RouterLink to="/generate">Generate Blog</RouterLink>
        <RouterLink to="/articles">Articles</RouterLink>
        <RouterLink to="/websites">Websites</RouterLink>
        <RouterLink to="/project-progress">Project Progress</RouterLink>
        <RouterLink v-if="auth.isAdmin" to="/system-logs">System Logs</RouterLink>
        <RouterLink to="/settings">Settings</RouterLink>
      </nav>

      <div class="sidebar-user">
        <div class="avatar">{{ initials }}</div>
        <div>
          <strong>{{ auth.user?.name || "KSD User" }}</strong>
          <small>{{ auth.user?.role || "USER" }} · KSD</small>
        </div>
        <button class="icon-button" type="button" title="Logout" @click="logout">↪</button>
      </div>
    </aside>

    <main class="app-main">
      <slot />
    </main>
  </div>
</template>
