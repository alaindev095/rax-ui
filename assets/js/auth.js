// Umunara — Authentication state
import { post } from "./api.js";

let currentUser = null;
const listeners = new Set();

export function onAuthChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  listeners.forEach((fn) => fn(currentUser));
}

function persist(token, user) {
  localStorage.setItem("umunara_token", token);
  localStorage.setItem("umunara_user", JSON.stringify(user));
}

// Merges a partial update (e.g. { must_change_password: false }) into the
// persisted user object and notifies listeners — used right after a
// successful change-password or verify-email call so the router's gating
// picks up the new state without needing a fresh login.
export function updateUserFlags(patch) {
  if (!currentUser) return;
  currentUser = { ...currentUser, ...patch };
  localStorage.setItem("umunara_user", JSON.stringify(currentUser));
  notify();
}

// The backend issues a JWT + user object at login time and has no /auth/me
// endpoint, so the session is restored straight from localStorage.
export async function initAuth() {
  const token = localStorage.getItem("umunara_token");
  const raw = localStorage.getItem("umunara_user");
  if (!token || !raw) return null;
  try {
    currentUser = JSON.parse(raw);
    notify();
    return currentUser;
  } catch {
      currentUser = null;
      localStorage.removeItem("umunara_token");
      localStorage.removeItem("umunara_user");
      return null;
  }
}

export async function login(email, password) {
  const { token, user, must_change_password, email_verified } = await post("/auth/login", { email, password });
  // The login response carries these two flags at the top level (not
  // nested in `user`) — fold them onto the persisted user object so the
  // router can gate on `getUser().must_change_password` /
  // `getUser().email_verified` the same way it reads any other user field.
  const fullUser = { ...user, must_change_password: !!must_change_password, email_verified: !!email_verified };
  persist(token, fullUser);
  currentUser = fullUser;
  notify();
  return fullUser;
}

// Accounts are created by admins (Admin_controller/Super_admin_controller);
// the new user gets their temporary password by email and is required to
// change it (and verify their email) on first login — see
// renderChangePassword/renderVerifyEmail in router.js. "Forgot your
// password?" on the login page remains available for later, normal
// password resets.

export function logout() {
  currentUser = null;
  localStorage.removeItem("umunara_token");
  localStorage.removeItem("umunara_user");
  notify();
}

export function getUser() {
  return currentUser;
}

export function isAuthenticated() {
  return !!currentUser;
}

export function hasRole(role) {
  return currentUser?.role === role;
}

export function requireRole(role) {
  if (!currentUser || currentUser.role !== role) {
    throw new Error(`Unauthorized: role ${role} required`);
  }
}
