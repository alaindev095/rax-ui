// Umunara — Internship module shared helpers
// Used across the student / admin / company internship pages so the status
// vocabulary and formatting stay consistent in one place.

export const STATUS_LABELS = {
  pending_school: "Pending School Approval",
  rejected_by_school: "Rejected by School",
  approved_by_school: "Approved by School",
  waiting_payment: "Waiting Payment Confirmation",
  payment_confirmed: "Payment Confirmed",
  under_company_review: "Under Company Review",
  accepted: "Accepted",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

export const STATUS_BADGE_CLASS = {
  pending_school: "badge-warning",
  rejected_by_school: "badge-danger",
  approved_by_school: "badge-info",
  waiting_payment: "badge-warning",
  payment_confirmed: "badge-info",
  under_company_review: "badge-ai",
  accepted: "badge-success",
  rejected: "badge-danger",
  cancelled: "badge",
};

export function statusBadge(status) {
  const cls = STATUS_BADGE_CLASS[status] || "badge";
  const label = STATUS_LABELS[status] || status;
  return `<span class="badge ${cls}">${label}</span>`;
}

export function formatRWF(amount) {
  const n = Number(amount) || 0;
  return `${n.toLocaleString("en-US")} RWF`;
}

export function internshipInitials(name) {
  return (name || "?").trim().charAt(0).toUpperCase();
}
