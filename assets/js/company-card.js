// Umunara — shared "company card" markup used by the admin, super-admin and
// student company listing pages so the card layout stays consistent
// (task: redesign company listings as cards with image, name, trades,
// location, internship date range, and action buttons).
import { escapeHtml, formatDate } from "./utils.js";
import { internshipInitials } from "./internships.js";

function tradesLine(trades) {
  if (!trades || !trades.length) return `<span class="company-card-muted">No trades listed</span>`;
  const shown = trades.slice(0, 3).map((t) => escapeHtml(t.name));
  const extra = trades.length > 3 ? ` +${trades.length - 3} more` : "";
  return shown.join(", ") + extra;
}

function dateRange(earliestStart, latestEnd) {
  if (!earliestStart && !latestEnd) return `<span class="company-card-muted">Dates to be confirmed</span>`;
  const start = earliestStart ? formatDate(earliestStart) : "TBC";
  const end = latestEnd ? formatDate(latestEnd) : "TBC";
  return `${start} &rarr; ${end}`;
}

// opts: { showApply, showVerify, showDetails (default true), showStatus }
export function companyCardHtml(c, opts = {}) {
  const showApply = !!opts.showApply;
  const showVerify = !!opts.showVerify;
  const showStatus = !!opts.showStatus;
  const verifiedBadge = c.verified
    ? `<span class="badge badge-success">Verified</span>`
    : `<span class="badge badge-warning">Unverified</span>`;
  const statusBadge = showStatus
    ? (c.is_active === false ? `<span class="badge badge-danger">Deactivated</span>` : `<span class="badge">Active</span>`)
    : "";

  return `
    <div class="card company-card" data-id="${c.id}">
      <div class="company-card-image">
        ${c.logo_url ? `<img src="${escapeHtml(c.logo_url)}" alt="" />` : `<span>${internshipInitials(c.name)}</span>`}
      </div>
      <div class="card-body company-card-body">
        <div class="company-card-head">
          <strong class="company-card-name">${escapeHtml(c.name)}</strong>
          <div style="display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end">${verifiedBadge}${statusBadge}</div>
        </div>
        <div class="company-card-row"><span class="company-card-label">Trades</span>${tradesLine(c.trades)}</div>
        <div class="company-card-row"><span class="company-card-label">Location</span>${escapeHtml(c.district || c.province || "Location TBC")}${c.district && c.province ? ", " + escapeHtml(c.province) : ""}</div>
        <div class="company-card-row"><span class="company-card-label">Internship dates</span>${dateRange(c.earliest_start, c.latest_end)}</div>
        <div class="company-card-footer">
          ${showVerify ? `<button class="btn btn-sm ${c.verified ? "btn-ghost" : "btn-primary"} verify-btn" data-id="${c.id}" data-verified="${c.verified}">${c.verified ? "Unverify" : "Verify"}</button>` : ""}
          <div class="company-card-actions">
            <button class="btn btn-ghost btn-sm details-btn" data-id="${c.id}">Details</button>
            ${showApply ? `<button class="btn btn-primary btn-sm apply-btn" data-id="${c.id}">Apply</button>` : ""}
          </div>
        </div>
      </div>
    </div>`;
}

export const companyCardStyles = `
  .company-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: var(--space-5); }
  .company-card { display: flex; flex-direction: column; overflow: hidden; }
  .company-card-image { width: 100%; height: 120px; background: var(--primary); color: var(--primary-foreground); display: grid; place-items: center; font-weight: 700; font-size: 1.75rem; overflow: hidden; flex-shrink: 0; }
  .company-card-image img { width: 100%; height: 100%; object-fit: cover; }
  .company-card-body { display: flex; flex-direction: column; gap: var(--space-2); flex: 1; }
  .company-card-head { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); }
  .company-card-name { font-size: 1.0625rem; }
  .company-card-row { font-size: 0.8125rem; color: var(--foreground); }
  .company-card-label { display: block; font-size: 0.6875rem; color: var(--foreground-muted); text-transform: uppercase; letter-spacing: 0.03em; margin-bottom: 1px; }
  .company-card-muted { color: var(--foreground-muted); }
  .company-card-footer { margin-top: auto; padding-top: var(--space-3); display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); flex-wrap: wrap; }
  .company-card-actions { display: flex; gap: var(--space-2); margin-left: auto; }
`;
