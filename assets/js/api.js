// Umunara — API client (talks to the real Node.js backend)
import { CONFIG } from "./config.js";

const DEFAULT_TIMEOUT = 20000;

class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

function token() {
  return localStorage.getItem("umunara_token") || "";
}

export async function api(path, options = {}) {
  const url = `${CONFIG.apiBaseUrl}${path}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeout || DEFAULT_TIMEOUT);

  const isFormData = options.body instanceof FormData;
  const headers = {
    Accept: "application/json",
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
    ...(options.headers || {}),
  };

  try {
    const response = await fetch(url, { ...options, signal: controller.signal, headers });
    clearTimeout(timeout);

    const contentType = response.headers.get("content-type") || "";
    const data = contentType.includes("application/json") ? await response.json() : await response.text();

    if (!response.ok) {
      // The backend blocks every route with these 403s until the account
      // has completed setup (see requireAccountSetupComplete middleware —
      // email verification first, then password change). Broadcast them so
      // the router can force a redirect even if the client's cached user
      // object hasn't caught up yet (e.g. a stale tab, or a flag changing
      // server-side out of band).
      if (response.status === 403 && data && data.code === "password_change_required") {
        window.dispatchEvent(new CustomEvent("umunara:password-change-required"));
      }
      if (response.status === 403 && data && data.code === "email_verification_required") {
        window.dispatchEvent(new CustomEvent("umunara:email-verification-required"));
      }
      throw new ApiError((data && (data.error || data.message)) || response.statusText, response.status, data);
    }
    return data;
  } catch (error) {
    clearTimeout(timeout);
    if (error.name === "AbortError") {
      throw new ApiError("Request timed out. Is the Umunara backend running?", 408, null);
    }
    if (error instanceof ApiError) throw error;
    throw new ApiError(error.message || "Network error. Is the Umunara backend running?", 0, null);
  }
}

export function get(path, params) {
  const query = params ? "?" + new URLSearchParams(params).toString() : "";
  return api(path + query, { method: "GET" });
}

export function post(path, body) {
  return api(path, { method: "POST", body: JSON.stringify(body || {}) });
}

export function patch(path, body) {
  return api(path, { method: "PATCH", body: JSON.stringify(body || {}) });
}

export function del(path) {
  return api(path, { method: "DELETE" });
}

// DELETE with a JSON body — used for the guarded super-admin deletes that
// require a typed confirmation phrase in the request body.
export function delBody(path, body) {
  return api(path, { method: "DELETE", body: JSON.stringify(body || {}) });
}

// Downloads a report (e.g. an .xlsx export) as a Blob, sending the same
// auth header as every other request. Regular <a href> links can't attach
// an Authorization header, so report-export buttons use this instead.
export async function getBlob(path) {
  const url = `${CONFIG.apiBaseUrl}${path}`;
  const response = await fetch(url, {
    headers: token() ? { Authorization: `Bearer ${token()}` } : {},
  });
  if (!response.ok) {
    let data = null;
    try { data = await response.json(); } catch { /* not JSON */ }
    throw new ApiError((data && (data.error || data.message)) || response.statusText, response.status, data);
  }
  return response.blob();
}

// Triggers a browser download of a Blob under the given filename.
export function downloadBlob(blob, filename) {
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}

// For multipart/form-data uploads (notes, assignments, submissions).
export function postForm(path, formData) {
  return api(path, { method: "POST", body: formData });
}

export function patchForm(path, formData) {
  return api(path, { method: "PATCH", body: formData });
}

export { ApiError };
