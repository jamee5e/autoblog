<script setup lang="ts">
const props = defineProps<{ status: string }>();

const className = () => {
  const value = props.status.toLowerCase();
  if (["active", "connected", "complete", "published", "ready", "success"].includes(value)) return "success";
  if (["failed", "error"].includes(value)) return "danger";
  if (["waiting", "revision"].includes(value)) return "waiting";
  if (["researching", "writing", "checking", "publishing", "in progress"].includes(value)) return "progress";
  return "neutral";
};
</script>

<template>
  <span class="status-badge" :class="className()">{{ status }}</span>
</template>
