// Umunara — Toast / alert system
export function toast(message, type = "info", duration = 4000) {
  const container = document.getElementById("toast-root");
  if (!container) return;

  const el = document.createElement("div");
  el.className = `toast toast-${type}`;
  el.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      ${iconFor(type)}
    </svg>
    <span>${message}</span>
  `;

  container.appendChild(el);

  if (duration > 0) {
    setTimeout(() => {
      el.classList.add("leaving");
      el.addEventListener("animationend", () => el.remove());
    }, duration);
  }

  return el;
}

export function confirmDialog({ title, message, onConfirm, onCancel, confirmText = "Confirm", cancelText = "Cancel" }) {
  const root = document.getElementById("modal-root");
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <div class="modal-header">
        <h3>${title}</h3>
        <button class="icon-btn modal-close" aria-label="Close">×</button>
      </div>
      <div class="modal-body">
        <p>${message}</p>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost modal-cancel">${cancelText}</button>
        <button class="btn btn-danger modal-confirm">${confirmText}</button>
      </div>
    </div>
  `;
  root.appendChild(overlay);

  requestAnimationFrame(() => overlay.classList.add("open"));

  const close = () => {
    overlay.classList.remove("open");
    setTimeout(() => overlay.remove(), 200);
  };

  overlay.querySelector(".modal-close").addEventListener("click", () => {
    close();
    onCancel?.();
  });
  overlay.querySelector(".modal-cancel").addEventListener("click", () => {
    close();
    onCancel?.();
  });
  overlay.querySelector(".modal-confirm").addEventListener("click", () => {
    close();
    onConfirm?.();
  });
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      close();
      onCancel?.();
    }
  });
}

function iconFor(type) {
  switch (type) {
    case "success":
      return `<circle cx="10" cy="10" r="9"/><path d="M6 10l3 3 5-6"/>`;
    case "error":
      return `<circle cx="10" cy="10" r="9"/><path d="M7 7l6 6M13 7l-6 6"/>`;
    case "warning":
      return `<path d="M10 2l8 15H2L10 2z"/><path d="M10 7v5"/><circle cx="10" cy="15" r="1"/>`;
    default:
      return `<circle cx="10" cy="10" r="9"/><path d="M10 6v4M10 14h.01"/>`;
  }
}

window.toast = toast;
window.confirmDialog = confirmDialog;
