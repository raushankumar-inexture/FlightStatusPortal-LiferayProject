(function () {
/* ==========================================================================
   SHARED COMPONENTS — Flight Status Portal
   Vanilla JS utilities: Toast, Modal, Skeleton, API wrapper, Mobile Menu
   ========================================================================== */

/* ── Escape HTML ── */
const esc = (v) =>
  String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));

/* ── Fetch Wrapper ── */
const getFetch = () =>
  window.Liferay && Liferay.Util && Liferay.Util.fetch
    ? Liferay.Util.fetch
    : fetch;

const faFetch = async (url, options = {}) => {
  const fetchFn = getFetch();
  const res = await fetchFn(url, {
    credentials: "include",
    ...options,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

/* ── Toast ── */
let faToastContainer = null;

const ensureToastContainer = () => {
  if (!faToastContainer) {
    faToastContainer = document.createElement("div");
    faToastContainer.className = "fa-toast-container";
    document.body.appendChild(faToastContainer);
  }
  return faToastContainer;
};

const showToast = (message, type = "info", duration = 5000) => {
  ensureToastContainer();
  const icons = {
    success: "✔",
    error: "✖",
    warning: "⚠",
    info: "ℹ",
  };

  const toast = document.createElement("div");
  toast.className = `fa-toast fa-toast--${type}`;
  toast.innerHTML = `
    <div class="fa-toast__icon">${icons[type] || icons.info}</div>
    <div class="fa-toast__message">${esc(message)}</div>
    <button class="fa-toast__close" aria-label="Dismiss">×</button>
  `;

  faToastContainer.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => {
    toast.classList.add("fa-toast--show");
  });

  const dismiss = () => {
    toast.classList.remove("fa-toast--show");
    setTimeout(() => toast.remove(), 200);
  };

  toast.querySelector(".fa-toast__close").addEventListener("click", dismiss);
  setTimeout(dismiss, duration);
};

/* ── Modal ── */
const createModal = ({ title, content, onClose, confirmLabel, onConfirm }) => {
  const overlay = document.createElement("div");
  overlay.className = "fa-modal-overlay";
  overlay.innerHTML = `
    <div class="fa-modal">
      <div class="fa-modal__header">
        <h2 class="fa-modal__title">${esc(title)}</h2>
        <button class="fa-modal__close" aria-label="Close">×</button>
      </div>
      <div class="fa-modal__body">${content}</div>
      ${
        confirmLabel
          ? `<div class="fa-modal__footer">
               <button class="fa-btn fa-btn--ghost fa-modal__cancel">Cancel</button>
               <button class="fa-btn fa-btn--primary fa-modal__confirm">${esc(confirmLabel)}</button>
             </div>`
          : ""
      }
    </div>
  `;

  const close = () => {
    overlay.classList.remove("fa-modal--open");
    setTimeout(() => overlay.remove(), 200);
  };

  overlay.querySelector(".fa-modal__close").addEventListener("click", close);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  if (confirmLabel && onConfirm) {
    overlay
      .querySelector(".fa-modal__confirm")
      .addEventListener("click", (e) => {
        e.stopPropagation();
        onConfirm();
        close();
      });
    overlay
      .querySelector(".fa-modal__cancel")
      .addEventListener("click", (e) => {
        e.stopPropagation();
        close();
      });
  }

  document.body.appendChild(overlay);
  requestAnimationFrame(() => {
    overlay.classList.add("fa-modal--open");
  });

  return { close };
};

/* ── Skeleton ── */
const createSkeleton = (type = "card") => {
  const el = document.createElement("div");
  el.className = `fa-skeleton fa-skeleton--${type}`;
  return el;
};

/* ── Format Time ── */
const fmtTime = (v) => {
  const d = new Date(String(v).replace(" ", "T") + "Z");
  if (isNaN(d)) return esc(v);
  return d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
};

/* ── Format Relative Time ── */
const fmtRelative = (v) => {
  const d = new Date(String(v).replace(" ", "T") + "Z");
  if (isNaN(d)) return esc(v);
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString([], { dateStyle: "medium" });
};

/* ── Status Badge Class ── */
const statusBadgeClass = (status) => {
  const s = String(status).toLowerCase().replace(/[^a-z]/g, "");
  const map = {
    ontime: "fa-badge--ontime",
    landed: "fa-badge--ontime",
    scheduled: "fa-badge--ontime",
    delayed: "fa-badge--delayed",
    boarding: "fa-badge--boarding",
    cancelled: "fa-badge--cancelled",
    div: "fa-badge--cancelled",
  };
  return map[s] || "fa-badge--info";
};

/* ── Mobile Menu ── */
const initMobileMenu = (burgerSelector, navSelector) => {
  const burger = document.querySelector(burgerSelector);
  const nav = document.querySelector(navSelector);
  if (!burger || !nav) return;

  let open = false;
  burger.addEventListener("click", () => {
    open = !open;
    burger.setAttribute("aria-expanded", open);
    nav.classList.toggle("fa-nav-links--open", open);
  });
};

/* ── Expose to window ── */
window.fa = {
  esc,
  getFetch,
  faFetch,
  showToast,
  createModal,
  createSkeleton,
  fmtTime,
  fmtRelative,
  statusBadgeClass,
  initMobileMenu,
};
})();
