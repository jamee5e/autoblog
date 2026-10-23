<script setup lang="ts">
import AppLayout from "@/layouts/AppLayout.vue";
</script>

<template>
  <AppLayout>
    <div class="page-header">
      <div>
        <p class="eyebrow">PLATFORM CONFIGURATION</p>
        <h1>Settings</h1>
        <p>Brand profile และ integration settings สำหรับแต่ละเว็บไซต์</p>
      </div>
      <span class="status-badge neutral">Prepared for next phases</span>
    </div>

    <section class="settings-grid">
      <article class="surface-card">
        <div class="card-heading">
          <div>
            <p class="eyebrow">BRAND PROFILE</p>
            <h2>Content Rules</h2>
          </div>
        </div>
        <div class="form-grid">
          <label>Language<input disabled value="English" /></label>
          <label>Tone of Voice<input disabled placeholder="Professional, natural, local expert" /></label>
          <label>Target Audience<input disabled placeholder="International travelers" /></label>
          <label>Default CTA<textarea disabled rows="3" placeholder="Book your Khao Sok experience..." /></label>
        </div>
        <div class="empty-inline">Brand Profile editing will be connected after the current WordPress phase.</div>
      </article>

      <article class="surface-card">
        <div class="card-heading">
          <div>
            <p class="eyebrow">NOTIFICATIONS</p>
            <h2>LINE Group Notification</h2>
          </div>
        </div>
        <div class="setting-row">
          <div>
            <strong>Ready for Review</strong>
            <small>Notify the content team when an article is ready.</small>
          </div>
          <span class="status-badge neutral">Future</span>
        </div>
        <div class="setting-row">
          <div>
            <strong>Published</strong>
            <small>Notify the team after successful WordPress publishing.</small>
          </div>
          <span class="status-badge neutral">Future</span>
        </div>
        <div class="setting-row">
          <div>
            <strong>System Error</strong>
            <small>Notify important integration failures.</small>
          </div>
          <span class="status-badge neutral">Future</span>
        </div>
        <div class="info-banner green">
          <strong>API keys are not shown in the frontend.</strong>
          <span>Secrets remain backend environment variables only.</span>
        </div>
      </article>
    </section>
  </AppLayout>
</template>
