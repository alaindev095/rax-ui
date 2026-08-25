// Umunara — Utility helpers

// --- Markdown rendering for AI responses -----------------------------------
// Loads marked (markdown -> HTML) and DOMPurify (HTML sanitizer) from a CDN
// on first use, then reuses the cached, ready-to-use libraries afterwards.
// This is intentionally a lightweight <script> tag include rather than an
// npm dependency/bundle step, since it's the smallest way to get
// professional-looking AI output (headings, lists, code blocks, bold, etc.)
// rendered safely.
const MD_SCRIPTS = [
  "https://cdnjs.cloudflare.com/ajax/libs/marked/16.3.0/lib/marked.umd.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.4.11/purify.min.js",
];

let mdLoadPromise = null;

function loadScriptOnce(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

function ensureMarkdownLibs() {
  if (window.marked && window.DOMPurify) return Promise.resolve();
  if (!mdLoadPromise) {
    mdLoadPromise = Promise.all(MD_SCRIPTS.map(loadScriptOnce)).catch((err) => {
      mdLoadPromise = null; // allow a retry on the next call
      throw err;
    });
  }
  return mdLoadPromise;
}

// Converts markdown text into sanitized HTML safe to drop into innerHTML.
// Falls back to escaped plain text if the CDN libraries can't be loaded
// (e.g. offline), so AI output is never lost or left unsafely unescaped.
export async function markdownToSafeHtml(text) {
  try {
    await ensureMarkdownLibs();
    const rawHtml = window.marked.parse(String(text ?? ""), { breaks: true });
    return window.DOMPurify.sanitize(rawHtml);
  } catch {
    return escapeHtml(text).replace(/\n/g, "<br>");
  }
}

// --- PDF text extraction (for the AI chat's file-attachment feature) -------
// Loads pdf.js from a CDN on first use, same lazy-load pattern as the
// markdown libs above.
const PDFJS_SCRIPT = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.6.347/pdf.min.js";
const PDFJS_WORKER = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.6.347/pdf.worker.min.js";
let pdfjsLoadPromise = null;

function ensurePdfJs() {
  if (window.pdfjsLib) return Promise.resolve();
  if (!pdfjsLoadPromise) {
    pdfjsLoadPromise = loadScriptOnce(PDFJS_SCRIPT)
      .then(() => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER; })
      .catch((err) => { pdfjsLoadPromise = null; throw err; });
  }
  return pdfjsLoadPromise;
}

// Extracts plain text from a PDF File so it can be included in an AI
// prompt. Returns "" (rather than throwing) if the PDF has no extractable
// text (e.g. a scanned image PDF) or the library fails to load — callers
// should treat an empty result as "couldn't read this one" and continue
// gracefully rather than blocking the whole message.
export async function extractPdfText(file, { maxPages = 25, maxChars = 12000 } = {}) {
  try {
    await ensurePdfJs();
    const buffer = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: buffer }).promise;
    let text = "";
    const pageCount = Math.min(pdf.numPages, maxPages);
    for (let i = 1; i <= pageCount; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((it) => it.str).join(" ") + "\n";
      if (text.length >= maxChars) break;
    }
    return text.slice(0, maxChars).trim();
  } catch {
    return "";
  }
}

export function $(selector, context = document) {
  return context.querySelector(selector);
}

export function $$(selector, context = document) {
  return Array.from(context.querySelectorAll(selector));
}

export function generateId(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 11)}`;
}

export function formatDate(date, options = {}) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...options,
  }).format(d);
}

export function formatRelative(date) {
  const d = new Date(date);
  const now = new Date();
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return formatDate(d);
}

export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export function storage(key, value) {
  if (value === undefined) {
    try {
      return JSON.parse(localStorage.getItem(key));
    } catch {
      return localStorage.getItem(key);
    }
  }
  localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
}

export function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function setTheme(theme) {
  document.documentElement.classList.remove("light", "dark");
  document.documentElement.classList.add(theme);
  storage("theme", theme);
}

export function getTheme() {
  return storage("theme") || "light";
}

// Opens a file (note / assignment submission) inside the app's built-in
// PDF/document viewer instead of a new browser tab. Stashes the file info
// in sessionStorage (the viewer page reads it) along with the path to
// return to, then navigates to /viewer.
export async function openViewer(url, title, options = {}) {
  sessionStorage.setItem("umunara_viewer", JSON.stringify({
    url,
    title: title || "Document",
    back: window.location.pathname,
    // Library resources (curriculum, past papers, books) are view-only —
    // no download, no "open in new tab" shortcut around that. See
    // pages/viewer.html.
    noDownload: !!options.noDownload,
  }));
  const { navigate } = await import("./router.js");
  navigate("/viewer");
}

// Downloads a file to the user's device. Tries to fetch it as a blob so the
// browser always saves it (rather than navigating to it), falling back to a
// plain link click if the fetch is blocked (e.g. by CORS).
export async function downloadFile(url, filename) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Download failed");
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename || "download";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
  } catch {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || "download";
    a.target = "_blank";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
}
