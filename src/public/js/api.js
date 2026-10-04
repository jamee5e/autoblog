import { clearAuthSession, getToken } from "./auth.js";

const readErrorMessage = async (response) => {
  try {
    const payload = await response.json();
    return payload.message || "Request failed";
  } catch {
    return "Request failed";
  }
};

export const apiRequest = async (path, options = {}) => {
  const token = getToken();
  const headers = {
    ...(options.headers || {})
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (options.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(path, {
    ...options,
    headers
  });

  if (response.status === 401) {
    clearAuthSession();
    window.location.assign("/login");
    throw new Error("Unauthorized");
  }

  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new Error(message);
  }

  return response.json();
};
