import { bindLogout, getCurrentUser, requireAuth } from "./auth.js";

const init = async () => {
  await requireAuth();
  bindLogout();
  const user = getCurrentUser();
  const welcome = document.getElementById("welcome");
  if (welcome && user) {
    welcome.textContent = `Welcome, ${user.name} (${user.role})`;
  }
};

void init();
