<script setup lang="ts">
import { ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { getApiErrorMessage } from "@/services/api";

const email = ref("");
const password = ref("");
const loading = ref(false);
const errorMessage = ref("");
const auth = useAuthStore();
const router = useRouter();
const route = useRoute();

const submit = async () => {
  errorMessage.value = "";
  loading.value = true;
  try {
    await auth.login(email.value.trim(), password.value);
    const redirect = typeof route.query.redirect === "string" ? route.query.redirect : "/dashboard";
    await router.push(redirect);
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, "Unable to sign in.");
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <div class="login-page">
    <section class="login-visual">
      <div class="login-brand">
        <div class="brand-logo large">KSD</div>
        <div>
          <p class="eyebrow light">KHAO SOK DISCOVERY</p>
          <h1>Auto Blog Platform</h1>
        </div>
      </div>
      <div class="login-copy">
        <span class="pill">Internal Content Workspace</span>
        <h2>Create, review and publish smarter travel content.</h2>
        <p>One workspace for KSD websites, WordPress publishing, AI content workflows and project progress.</p>
      </div>
    </section>

    <section class="login-panel">
      <form class="login-card" @submit.prevent="submit">
        <div>
          <p class="eyebrow">WELCOME BACK</p>
          <h2>Sign in to KSD Auto Blog</h2>
          <p class="muted">Use your internal admin or editor account.</p>
        </div>

        <label>
          Email
          <input v-model="email" type="email" autocomplete="email" placeholder="admin@ksd.local" required />
        </label>

        <label>
          Password
          <input v-model="password" type="password" autocomplete="current-password" placeholder="••••••••" required />
        </label>

        <div v-if="errorMessage" class="alert danger">{{ errorMessage }}</div>
        <button class="primary-button full" type="submit" :disabled="loading">
          {{ loading ? "Signing in..." : "Sign In" }}
        </button>
      </form>
    </section>
  </div>
</template>
