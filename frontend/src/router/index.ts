import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import LoginView from "@/views/LoginView.vue";
import DashboardView from "@/views/DashboardView.vue";
import WebsitesView from "@/views/WebsitesView.vue";
import ArticlesView from "@/views/ArticlesView.vue";
import ArticlePreviewView from "@/views/ArticlePreviewView.vue";
import ProjectProgressView from "@/views/ProjectProgressView.vue";
import SystemLogsView from "@/views/SystemLogsView.vue";
import GenerateBlogView from "@/views/GenerateBlogView.vue";
import SettingsView from "@/views/SettingsView.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", redirect: "/dashboard" },
    { path: "/login", name: "login", component: LoginView, meta: { public: true } },
    { path: "/dashboard", name: "dashboard", component: DashboardView },
    { path: "/generate", name: "generate", component: GenerateBlogView },
    { path: "/articles", name: "articles", component: ArticlesView },
    { path: "/articles/:id", name: "article-preview", component: ArticlePreviewView },
    { path: "/websites", name: "websites", component: WebsitesView },
    { path: "/project-progress", name: "project-progress", component: ProjectProgressView },
    { path: "/system-logs", name: "system-logs", component: SystemLogsView, meta: { adminOnly: true } },
    { path: "/settings", name: "settings", component: SettingsView }
  ]
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();

  if (to.meta.public) {
    if (to.name === "login" && auth.isAuthenticated) {
      return { name: "dashboard" };
    }
    return true;
  }

  if (!auth.isAuthenticated) {
    return { name: "login", query: { redirect: to.fullPath } };
  }

  if (!auth.user) {
    const valid = await auth.hydrate();
    if (!valid) return { name: "login" };
  }

  if (to.meta.adminOnly && !auth.isAdmin) {
    return { name: "dashboard" };
  }

  return true;
});

export default router;
