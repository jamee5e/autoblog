import { setAuthSession } from "./auth.js";

const form = document.getElementById("loginForm");
const message = document.getElementById("message");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  message.textContent = "";
  message.className = "message";

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
      const payload = await response.json();
      throw new Error(payload.message || "Login failed");
    }

    const payload = await response.json();
    setAuthSession(payload.accessToken, payload.user);
    window.location.assign("/dashboard");
  } catch (error) {
    message.textContent = error instanceof Error ? error.message : "Login failed";
    message.className = "message error";
  }
});
