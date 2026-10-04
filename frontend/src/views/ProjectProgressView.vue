<script setup lang="ts">
import { computed } from "vue";
import AppLayout from "@/layouts/AppLayout.vue";
import { projectPhases, type ProgressStatus } from "@/data/projectProgress";

const statusLabel: Record<ProgressStatus, string> = {
  complete: "Complete",
  progress: "In Progress",
  waiting: "Waiting",
  pending: "Pending"
};

const allTasks = computed(() => projectPhases.flatMap((phase) => phase.tasks));
const completedTasks = computed(() => allTasks.value.filter((task) => task.status === "complete").length);
const overallProgress = computed(() =>
  allTasks.value.length ? Math.round((completedTasks.value / allTasks.value.length) * 100) : 0
);
const currentPhase = computed(() => projectPhases.find((phase) => phase.status === "progress") || projectPhases[0]);

const phaseProgress = (phase: (typeof projectPhases)[number]) => {
  if (!phase.tasks.length) return 0;
  const done = phase.tasks.filter((task) => task.status === "complete").length;
  return Math.round((done / phase.tasks.length) * 100);
};
</script>

<template>
  <AppLayout>
    <div class="project-hero">
      <div>
        <p class="eyebrow">KSD AUTO BLOG PLATFORM</p>
        <h1>Project Development Progress</h1>
        <p>ติดตามสถานะงาน สิ่งที่เสร็จแล้ว สิ่งที่รอจาก KSD และขั้นตอนถัดไป</p>
      </div>
      <span class="project-date">Phase 2 · WordPress Integration</span>
    </div>

    <section class="stat-grid">
      <article class="stat-card progress-stat">
        <span>Overall Progress</span>
        <strong>{{ overallProgress }}%</strong>
        <div class="progress-track large"><span :style="{ width: overallProgress + '%' }"></span></div>
        <small>{{ completedTasks }} of {{ allTasks.length }} tasks completed</small>
      </article>
      <article class="stat-card">
        <span>Completed Tasks</span>
        <strong>{{ completedTasks }}</strong>
        <small>Development milestones complete</small>
      </article>
      <article class="stat-card">
        <span>Current Phase</span>
        <strong>Phase {{ currentPhase.id }}</strong>
        <small>{{ currentPhase.name }}</small>
      </article>
      <article class="stat-card">
        <span>Estimated Development</span>
        <strong>8–10</strong>
        <small>Working days</small>
      </article>
    </section>

    <section class="surface-card">
      <div class="card-heading">
        <div>
          <p class="eyebrow">ROADMAP</p>
          <h2>Project Phases</h2>
        </div>
        <div class="legend">
          <span><i class="dot complete"></i>Complete</span>
          <span><i class="dot progress"></i>In Progress</span>
          <span><i class="dot waiting"></i>Waiting</span>
          <span><i class="dot pending"></i>Pending</span>
        </div>
      </div>

      <div class="phase-grid">
        <article
          v-for="phase in projectPhases"
          :key="phase.id"
          class="phase-card"
          :class="{ current: phase.status === 'progress' }"
        >
          <div class="phase-head">
            <div>
              <span>PHASE {{ phase.id }}</span>
              <h3>{{ phase.name }}</h3>
            </div>
            <span class="phase-status" :class="phase.status">{{ statusLabel[phase.status] }}</span>
          </div>

          <div class="phase-progress">
            <div class="progress-track"><span :style="{ width: phaseProgress(phase) + '%' }"></span></div>
            <strong>{{ phaseProgress(phase) }}%</strong>
          </div>

          <ul class="phase-tasks">
            <li v-for="task in phase.tasks" :key="task.name" :class="task.status">
              <i>{{ task.status === "complete" ? "✓" : "○" }}</i>
              {{ task.name }}
            </li>
          </ul>
        </article>
      </div>
    </section>

    <section class="progress-info-grid">
      <article class="surface-card">
        <div class="card-heading">
          <div>
            <p class="eyebrow">LATEST UPDATE</p>
            <h2>Completed</h2>
          </div>
        </div>
        <ul class="check-list">
          <li>PostgreSQL + Prisma database foundation</li>
          <li>JWT authentication and role authorization</li>
          <li>WordPress adapter and encrypted credentials</li>
          <li>Website management APIs and real test actions</li>
          <li>Vue 3 frontend architecture migration</li>
          <li>Project Progress dashboard</li>
        </ul>
        <div class="info-banner amber">
          <strong>Currently Working On</strong>
          <span>Preparing both KSD websites for real WordPress acceptance testing.</span>
        </div>
      </article>

      <article class="surface-card">
        <div class="card-heading">
          <div>
            <p class="eyebrow">BLOCKERS</p>
            <h2>Waiting From KSD</h2>
          </div>
        </div>
        <ul class="waiting-list">
          <li>WordPress User — Website #1</li>
          <li>Application Password — Website #1</li>
          <li>WordPress User — Website #2</li>
          <li>Application Password — Website #2</li>
        </ul>
        <div class="info-banner red">
          <strong>Phase 2 is not complete yet.</strong>
          <span>Both real websites must connect and create a Draft successfully.</span>
        </div>
      </article>

      <article class="surface-card">
        <div class="card-heading">
          <div>
            <p class="eyebrow">NEXT</p>
            <h2>Next Steps</h2>
          </div>
        </div>
        <ol class="step-list">
          <li><span>1</span>Connect WordPress Website #1</li>
          <li><span>2</span>Create real Draft — Website #1</li>
          <li><span>3</span>Connect WordPress Website #2</li>
          <li><span>4</span>Create real Draft — Website #2</li>
          <li><span>5</span>Start Phase 3 — Gemini Research Agent</li>
        </ol>
      </article>
    </section>
  </AppLayout>
</template>
