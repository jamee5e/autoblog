const TOKEN_KEY = "autoblog_dev_jwt";
const USER_KEY = "autoblog_dev_user";

export const getToken = () => sessionStorage.getItem(TOKEN_KEY);

export const setAuthSession = (accessToken, user) => {
  sessionStorage.setItem(TOKEN_KEY, accessToken);
  sessionStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const clearAuthSession = () => {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
};

export const getCurrentUser = () => {
  const value = sessionStorage.getItem(USER_KEY);
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

export const requireAuth = async () => {
  const token = getToken();
  if (!token) {
    window.location.assign("/login");
    return null;
  }

  return token;
};

export const bindLogout = (buttonId = "logoutButton") => {
  const logoutButton = document.getElementById(buttonId);
  if (!logoutButton) {
    return;
  }

  logoutButton.addEventListener("click", () => {
    clearAuthSession();
    window.location.assign("/login");
  });
};
