import { computed, ref } from "vue";
import { defineStore } from "pinia";
import { api, authStorage } from "@/services/api";
import type { AuthUser } from "@/types";

const readUser = (): AuthUser | null => {
  const raw = sessionStorage.getItem(authStorage.userKey);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
};

export const useAuthStore = defineStore("auth", () => {
  const token = ref<string | null>(sessionStorage.getItem(authStorage.tokenKey));
  const user = ref<AuthUser | null>(readUser());
  const isAuthenticated = computed(() => Boolean(token.value));
  const isAdmin = computed(() => user.value?.role === "ADMIN");

  const setSession = (accessToken: string, authUser: AuthUser) => {
    token.value = accessToken;
    user.value = authUser;
    sessionStorage.setItem(authStorage.tokenKey, accessToken);
    sessionStorage.setItem(authStorage.userKey, JSON.stringify(authUser));
  };

  const clearSession = () => {
    token.value = null;
    user.value = null;
    sessionStorage.removeItem(authStorage.tokenKey);
    sessionStorage.removeItem(authStorage.userKey);
  };

  const login = async (email: string, password: string) => {
    const { data } = await api.post("/auth/login", { email, password });
    setSession(data.accessToken, data.user as AuthUser);
  };

  const hydrate = async () => {
    if (!token.value) return false;
    try {
      const { data } = await api.get("/auth/me");
      user.value = data.user as AuthUser;
      sessionStorage.setItem(authStorage.userKey, JSON.stringify(data.user));
      return true;
    } catch {
      clearSession();
      return false;
    }
  };

  return { token, user, isAuthenticated, isAdmin, login, hydrate, clearSession };
});
