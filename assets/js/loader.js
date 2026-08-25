// Umunara — Component loader + template cache
import { $ } from "./utils.js";

const cache = new Map();

export async function loadComponent(name, target, data = {}) {
  const targetEl = typeof target === "string" ? $(target) : target;
  if (!targetEl) return;

  try {
    if (!cache.has(name)) {
      const response = await fetch(`/components/${name}.html`);
      if (!response.ok) throw new Error(`Component not found: ${name}`);
      cache.set(name, await response.text());
    }
    let html = cache.get(name);
    html = interpolate(html, data);
    targetEl.innerHTML = html;
    bindComponent(targetEl, data);
    return targetEl;
  } catch (error) {
    console.error(`Failed to load component ${name}:`, error);
    targetEl.innerHTML = `<!-- ${name} failed to load -->`;
  }
}

export function preloadComponents(names) {
  return Promise.all(names.map((name) => loadComponent(name, document.createElement("div"))));
}

function interpolate(template, data) {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, key) => {
    const value = key.split(".").reduce((obj, part) => obj?.[part], data);
    return value !== undefined && value !== null ? value : "";
  });
}

function bindComponent(container, data) {
  // Only show nav links that belong to the current user's role (sidebar is
  // shared across roles so it can keep one consistent design).
  if (data.user?.role) {
    const normalizedRole = String(data.user.role).toLowerCase();
    const roleKey = normalizedRole === "students" ? "student" : normalizedRole === "teachers" ? "teacher" : normalizedRole === "admins" ? "admin" : normalizedRole;
    container.querySelectorAll("[data-role]").forEach((el) => {
      el.style.display = el.dataset.role === roleKey ? "" : "none";
    });
    container.querySelectorAll("[data-nav]").forEach((el) => {
      const path = el.dataset.nav;
      el.classList.toggle("active", path && window.location.pathname === path);
    });
  }

  container.querySelectorAll("[data-toggle-theme]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const { getTheme, setTheme } = await import("./utils.js");
      setTheme(getTheme() === "dark" ? "light" : "dark");
    });
  });

  container.querySelectorAll("[data-logout]").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      const { logout } = await import("./auth.js");
      const { navigate } = await import("./router.js");
      logout();
      navigate("/login");
    });
  });
}
