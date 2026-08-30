// Umunara — SPA router + component loader
import { $, escapeHtml } from "./utils.js";
import { loadComponent } from "./loader.js";
import { getUser, isAuthenticated, initAuth, login } from "./auth.js";
import { CONFIG } from "./config.js";

const routes = {
  "/": () => importPage("home/index"),
  "/login": () => renderLogin(),
  "/reset-password": () => renderResetPassword(),
  "/change-password": () => renderChangePassword(),
  "/verify-email": () => renderVerifyEmail(),
  "/viewer": () => importPage("viewer"),
  "/profile": () => importPage("profile"),
  "/register": () => importPage("register"),
  "/library": () => importPage("library/index"),
  "/super-admin/registrations": () => loadRolePage("super_admin", "registrations"),
  "/students/home": () => loadRolePage("student", "home"),
  "/students/notes": () => loadRolePage("student", "notes"),
  "/students/assignments": () => loadRolePage("student", "assignments"),
  "/students/results": () => loadRolePage("student", "results"),
  "/students/ai": () => loadRolePage("student", "ai"),
  "/students/internships": () => loadRolePage("student", "internships/browse"),
  "/students/internships/detail": () => loadRolePage("student", "internships/detail"),
  "/students/internships/applications": () => loadRolePage("student", "internships/applications"),
  "/students/companies": () => loadRolePage("student", "companies/browse"),
  "/students/companies/detail": () => loadRolePage("student", "companies/detail"),
  "/teachers/home": () => loadRolePage("teacher", "home"),
  "/teachers/notes": () => loadRolePage("teacher", "notes"),
  "/teachers/assignments": () => loadRolePage("teacher", "assignments"),
  "/teachers/submissions": () => loadRolePage("teacher", "submissions"),
  "/teachers/results": () => loadRolePage("teacher", "results"),
  "/teachers/ai": () => loadRolePage("teacher", "ai"),
  "/admin/home": () => loadRolePage("admin", "home"),
  "/admin/users": () => loadRolePage("admin", "users"),
  "/admin/academics": () => loadRolePage("admin", "academics"),
  "/admin/notes": () => loadRolePage("admin", "notes"),
  "/admin/report": () => loadRolePage("admin", "report"),
  "/admin/internships": () => loadRolePage("admin", "internships/index"),
  "/admin/internships/applications": () => loadRolePage("admin", "internships/applications"),
  "/admin/companies": () => loadRolePage("admin", "internships/companies"),
  "/companies/home": () => loadRolePage("company", "home"),
  "/companies/profile": () => loadRolePage("company", "profile"),
  "/companies/internships": () => loadRolePage("company", "internships"),
  "/companies/applicants": () => loadRolePage("company", "applicants"),
  "/companies/reports": () => loadRolePage("company", "reports"),
  "/super-admin/home": () => loadRolePage("super_admin", "home"),
  "/super-admin/schools": () => loadRolePage("super_admin", "schools/index"),
  "/super-admin/schools/detail": () => loadRolePage("super_admin", "schools/detail"),
  "/super-admin/companies": () => loadRolePage("super_admin", "companies/index"),
  "/super-admin/companies/detail": () => loadRolePage("super_admin", "companies/detail"),
  "/super-admin/trades": () => loadRolePage("super_admin", "trades"),
  "/super-admin/report": () => loadRolePage("super_admin", "report"),
};

function normalizeRole(role) {
  if (!role) return null;
  const normalized = String(role).toLowerCase();
  if (normalized === "students") return "student";
  if (normalized === "teachers") return "teacher";
  if (normalized === "admins") return "admin";
  if (normalized === "companies") return "company";
  return normalized;
}

function dashboardForUser(user) {
  const role = normalizeRole(user?.role);
  return CONFIG.roles[role]?.home || "/";
}

export async function navigate(path, options = {}) {
  const resolved = resolvePath(path);
  if (!options.replace) {
    window.history.pushState({ path: resolved }, "", resolved);
  } else {
    window.history.replaceState({ path: resolved }, "", resolved);
  }
  await render(resolved);
}

function resolvePath(path) {
  const normalized = (path || "/").trim();
  if (!normalized || normalized === "/") return "/";
  const withoutTrailingSlash = normalized.replace(/\/+$/, "");
  if (routes[withoutTrailingSlash]) return withoutTrailingSlash;
  if (withoutTrailingSlash === "/students") return "/students/home";
  if (withoutTrailingSlash === "/teachers") return "/teachers/home";
  if (withoutTrailingSlash === "/admin") return "/admin/home";
  if (withoutTrailingSlash === "/companies") return "/companies/home";
  if (withoutTrailingSlash === "/super-admin") return "/super-admin/home";
  return "/";
}

export async function render(path = window.location.pathname) {
  const resolved = resolvePath(path);
  const user = getUser();
  const currentRole = normalizeRole(user?.role);

  // Account-lifecycle gates: a user who still owes email verification (or
  // a password change) can't reach ANY page except the one screen that
  // resolves that gate — this mirrors the backend's
  // requireAccountSetupComplete middleware, so a user can't just bookmark
  // past it client-side either. Email verification is checked FIRST and
  // must complete before a password change is allowed — this proves
  // whoever is changing the password actually controls the inbox the
  // temporary password was emailed to, not just whoever is holding that
  // temporary password (see backend Auth_controller.changePassword for the
  // actual enforcement — this is only the UI following the same order).
  const gateExempt = resolved === "/change-password" || resolved === "/verify-email";
  if (user && !gateExempt) {
    if (!user.email_verified) {
      return navigate("/verify-email", { replace: true });
    }
    if (user.must_change_password) {
      return navigate("/change-password", { replace: true });
    }
  }
  if (user && gateExempt && !user.must_change_password && user.email_verified) {
    // Both gates already clear — /change-password and /verify-email don't
    // need to be shown, send them on to their dashboard instead.
    return navigate(dashboardForUser(user), { replace: true });
  }
  if (user && resolved === "/change-password" && !user.email_verified) {
    // Can't skip straight to /change-password before verifying — someone
    // could otherwise reach the form (even if the backend would still
    // reject the submission) just by typing the URL directly.
    return navigate("/verify-email", { replace: true });
  }

  if (user && (resolved === "/" || resolved === "/login" || resolved === "/reset-password" || resolved === "/register")) {
    return navigate(dashboardForUser(user), { replace: true });
  }

  // If no user and not on login/home/reset-password/register, show login
  if (!user && resolved !== "/login" && resolved !== "/reset-password" && resolved !== "/" && resolved !== "/register") {
    return navigate("/login", { replace: true });
  }
  // If a role tries to open another role's area, bounce them home.
  if (user && resolved.startsWith("/") && resolved !== "/" && resolved !== "/login" && resolved !== "/change-password" && resolved !== "/verify-email") {
    const section = resolved.split("/")[1];
    const sectionRole = section === "students" ? "student" : section === "teachers" ? "teacher" : section === "admin" ? "admin" : section === "companies" ? "company" : section === "super-admin" ? "super_admin" : null;
    if (sectionRole && currentRole && sectionRole !== currentRole) {
      return navigate(CONFIG.roles[currentRole]?.home || "/login", { replace: true });
    }
  }

  const handler = routes[resolved] || routes["/"];
  const content = $("#content");
  content.innerHTML = `<div class="loading-state">${loadingTemplate()}</div>`;

  const title = pageTitle(resolved);
  document.title = title;

  try {
    await loadLayout(user, title);
    const html = await handler();
    content.innerHTML = html;
    bindPageActions(content);
    executeScripts(content);
  } catch (error) {
    console.error("Routing error:", error);
    content.innerHTML = `<div class="empty-state"><h3>Page failed to load</h3><p>${error.message}</p></div>`;
  }
}

// innerHTML does not execute <script> tags, but several page fragments ship
// their own inline `<script type="module">` (see pages/teachers/*.html).
// Re-creating each script element forces the browser to run it.
function executeScripts(container) {
  container.querySelectorAll("script").forEach((old) => {
    const fresh = document.createElement("script");
    for (const attr of old.attributes) fresh.setAttribute(attr.name, attr.value);
    fresh.textContent = old.textContent;
    old.replaceWith(fresh);
  });
}

function closeSidebar() {
  $("#sidebar")?.classList.remove("open");
  $("#sidebar-overlay")?.classList.remove("open");
  document.body.classList.remove("sidebar-locked");
}

function openSidebar() {
  $("#sidebar")?.classList.add("open");
  $("#sidebar-overlay")?.classList.add("open");
  document.body.classList.add("sidebar-locked");
}

function toggleSidebar() {
  if ($("#sidebar")?.classList.contains("open")) closeSidebar();
  else openSidebar();
}

async function loadLayout(user, title) {
  const app = $("#app");
  if (!user) {
    app?.classList.add("shell-collapsed");
    $("#sidebar").innerHTML = "";
    $("#navbar").innerHTML = "";
    $("#footer").innerHTML = "";
    return;
  }
  app?.classList.remove("shell-collapsed");
  const normalizedRole = normalizeRole(user.role);
  const enrichedUser = {
    ...user,
    role: normalizedRole,
    avatar: (user.fullname || user.email || "?").trim().charAt(0).toUpperCase(),
    roleLabel: CONFIG.roles[normalizedRole]?.label || user.role,
  };
  await loadComponent("sidebar", "#sidebar", { user: enrichedUser });
  await loadComponent("navbar", "#navbar", { user: enrichedUser, title });
  await loadComponent("footer", "#footer");

  bindPageActions(document.getElementById("sidebar"));
  bindPageActions(document.getElementById("navbar"));
  bindPageActions(document.getElementById("footer"));
}

async function loadRolePage(role, page) {
  const user = getUser();
  if (!user) return navigate("/login");
  const normalizedRole = normalizeRole(role);
  if (normalizeRole(user.role) !== normalizedRole) {
    return `<div class="empty-state"><h3>Access denied</h3><p>You do not have permission to view this page.</p></div>`;
  }
  const section = normalizedRole === "student" ? "students" : normalizedRole === "teacher" ? "teachers" : normalizedRole === "admin" ? "admin" : normalizedRole === "company" ? "companies" : normalizedRole === "super_admin" ? "super-admin" : normalizedRole;
  return await importPage(`${section}/${page}`);
}

async function importPage(page) {
  const response = await fetch(`/pages/${page}.html`);
  if (!response.ok) throw new Error(`Page not found: ${page}`);
  return await response.text();
}

// Shared base styles for every auth-flow screen (login, reset-password,
// change-password, verify-email). Each render*() function returns a full
// standalone HTML string that completely replaces #app's content on every
// navigation (see render() -> content.innerHTML = html), so a <style>
// block defined in one page's output does NOT carry over to another page
// — every screen that uses .login-page/.login-card/etc. must embed this
// itself, or it renders with zero styling. Centralized here so all four
// stay visually identical and a future tweak only needs to happen once.
function authBaseStyles() {
  return `
    <style>
      .login-page {
        min-height: calc(100vh - 4rem);
        display: grid;
        place-items: center;
        padding: var(--space-8) var(--space-6);
      }

      .login-card {
        width: min(100%, 480px);
        padding: var(--space-8);
        border-radius: calc(var(--radius) + 6px);
        box-shadow: var(--shadow-xl);
      }

      .login-brand {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        margin-bottom: var(--space-6);
      }

      .login-brand .logo-icon {
        width: 3rem;
        height: 3rem;
        border-radius: var(--radius);
        background: var(--accent);
        color: var(--accent-foreground);
        display: grid;
        place-items: center;
        font-weight: 800;
        font-size: 1.125rem;
      }

      .login-brand .logo-text {
        font-family: var(--font-display);
        font-weight: 700;
        font-size: 1.25rem;
        letter-spacing: -0.03em;
      }

      .login-card h1 {
        font-size: clamp(1.5rem, 2.2vw, 2rem);
        margin-bottom: var(--space-2);
      }

      .login-card p {
        color: var(--foreground-muted);
        margin-bottom: var(--space-6);
      }

      .login-form {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
        margin: 0 0 var(--space-5);
      }

      .login-form .form-group {
        margin-bottom: 0;
      }

      .login-form input {
        width: 100%;
      }

      .login-hint {
        font-size: 0.95rem;
        color: var(--foreground-muted);
        margin-top: var(--space-3);
      }

      .login-hint a {
        color: var(--accent);
        font-weight: 600;
      }

      @media (max-width: 640px) {
        .login-page {
          padding: var(--space-5);
        }

        .login-card {
          padding: var(--space-6);
        }
      }
    </style>
  `;
}

function renderLogin() {
  $("#sidebar").innerHTML = "";
  $("#navbar").innerHTML = "";
  $("#footer").innerHTML = "";
  return `
    <div class="login-page">
      <div class="login-card card">
        <div class="login-brand">
          <div class="logo-icon">U</div>
          <div class="logo-text">Umunara</div>
        </div>
        <h1 id="auth-heading">Welcome back</h1>
        <p id="auth-subtitle">Sign in with your Umunara account.</p>

        <form id="login-form" class="login-form">
          <div class="form-group">
            <label for="login-email">Email</label>
            <input type="email" id="login-email" required autocomplete="email" placeholder="you@school.edu" />
          </div>
          <div class="form-group">
            <label for="login-password">Password</label>
            <input type="password" id="login-password" required autocomplete="current-password" placeholder="••••••••" />
          </div>
          <button type="submit" class="btn btn-primary" id="login-submit" style="width:100%">Sign in</button>
        </form>

        <form id="forgot-form" class="login-form" style="display:none">
          <p style="margin:0 0 var(--space-2);color:var(--foreground-muted);font-size:0.875rem">Enter your account email and we'll send you a link to set a new password.</p>
          <div class="form-group">
            <label for="forgot-email">Email</label>
            <input type="email" id="forgot-email" required autocomplete="email" placeholder="you@school.edu" />
          </div>
          <button type="submit" class="btn btn-accent" id="forgot-submit" style="width:100%">Send reset link</button>
        </form>

        <p class="login-hint" id="auth-toggle-wrap">
          <a href="#" id="show-forgot">Forgot your password?</a>
        </p>
        <p class="login-hint" id="auth-toggle-back" style="display:none">
          <a href="#" id="show-login">Back to sign in</a>
        </p>
        <p class="login-hint">Accounts are created for you by your school or by Umunara — there's no self sign-up.</p>
      </div>
    </div>

    <script type="module">
      const { login } = await import("./assets/js/auth.js");
      const { navigate } = await import("./assets/js/router.js");
      const { toast } = await import("./assets/js/alerts.js");
      const { CONFIG } = await import("./assets/js/config.js");
      const { post } = await import("./assets/js/api.js");

      const loginForm = document.getElementById("login-form");
      const forgotForm = document.getElementById("forgot-form");

      document.getElementById("show-forgot").addEventListener("click", (e) => {
        e.preventDefault();
        loginForm.style.display = "none";
        forgotForm.style.display = "flex";
        document.getElementById("auth-toggle-wrap").style.display = "none";
        document.getElementById("auth-toggle-back").style.display = "block";
        document.getElementById("auth-heading").textContent = "Reset your password";
        document.getElementById("auth-subtitle").textContent = "We'll email you a link to choose a new one.";
      });
      document.getElementById("show-login").addEventListener("click", (e) => {
        e.preventDefault();
        forgotForm.style.display = "none";
        loginForm.style.display = "flex";
        document.getElementById("auth-toggle-wrap").style.display = "block";
        document.getElementById("auth-toggle-back").style.display = "none";
        document.getElementById("auth-heading").textContent = "Welcome back";
        document.getElementById("auth-subtitle").textContent = "Sign in with your Umunara account.";
      });

      loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const btn = document.getElementById("login-submit");
        btn.disabled = true;
        btn.textContent = "Signing in…";
        try {
          const email = document.getElementById("login-email").value.trim();
          const password = document.getElementById("login-password").value;
          const user = await login(email, password);
          toast(\`Welcome, \${user.fullname}\`, "success");
          if (!user.email_verified) navigate("/verify-email");
          else if (user.must_change_password) navigate("/change-password");
          else navigate(CONFIG.roles[user.role]?.home || "/login");
        } catch (err) {
          toast(err.message || "Login failed", "error");
        } finally {
          btn.disabled = false;
          btn.textContent = "Sign in";
        }
      });

      forgotForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const btn = document.getElementById("forgot-submit");
        btn.disabled = true;
        btn.textContent = "Sending…";
        try {
          const email = document.getElementById("forgot-email").value.trim();
          const r = await post("/auth/forgot-password", { email });
          toast(r.message || "If an account exists for that email, a reset link has been sent.", "success");
          forgotForm.reset();
        } catch (err) {
          toast(err.message || "Could not send reset link", "error");
        } finally {
          btn.disabled = false;
          btn.textContent = "Send reset link";
        }
      });
    </script>

    ${authBaseStyles()}
  `;
}

// Landing page for the link sent by /auth/forgot-password. Reads the token
// straight from the URL query string (window.location.search — `render()`
// only ever passes the pathname around, so this can't come through the
// normal route-handler argument).
function renderResetPassword() {
  $("#sidebar").innerHTML = "";
  $("#navbar").innerHTML = "";
  $("#footer").innerHTML = "";
  const token = new URLSearchParams(window.location.search).get("token") || "";
  return `
    <div class="login-page">
      <div class="login-card card">
        <div class="login-brand">
          <div class="logo-icon">U</div>
          <div class="logo-text">Umunara</div>
        </div>
        <h1>Choose a new password</h1>
        <p>${token ? "Pick a new password for your account." : "This link is missing its reset token — open it from the email you were sent."}</p>

        ${token ? `
          <form id="reset-form" class="login-form">
            <div class="form-group">
              <label for="reset-password">New password</label>
              <input type="password" id="reset-password" required autocomplete="new-password" minlength="8" placeholder="At least 8 characters" />
            </div>
            <div class="form-group">
              <label for="reset-password-confirm">Confirm new password</label>
              <input type="password" id="reset-password-confirm" required autocomplete="new-password" minlength="8" placeholder="Retype the password" />
            </div>
            <button type="submit" class="btn btn-primary" id="reset-submit" style="width:100%">Set new password</button>
          </form>
        ` : ""}

        <p class="login-hint"><a href="#" id="back-to-login">Back to sign in</a></p>
      </div>
    </div>

    <script type="module">
      const { navigate } = await import("./assets/js/router.js");
      const { toast } = await import("./assets/js/alerts.js");
      const { post } = await import("./assets/js/api.js");

      document.getElementById("back-to-login").addEventListener("click", (e) => {
        e.preventDefault();
        navigate("/login");
      });

      const form = document.getElementById("reset-form");
      if (form) {
        form.addEventListener("submit", async (e) => {
          e.preventDefault();
          const password = document.getElementById("reset-password").value;
          const confirm = document.getElementById("reset-password-confirm").value;
          if (password !== confirm) return toast("Passwords don't match", "error");
          const btn = document.getElementById("reset-submit");
          btn.disabled = true;
          btn.textContent = "Saving…";
          try {
            const r = await post("/auth/reset-password", { token: ${JSON.stringify(token)}, password });
            toast(r.message || "Password updated", "success");
            navigate("/login");
          } catch (err) {
            toast(err.message || "Could not reset password", "error");
          } finally {
            btn.disabled = false;
            btn.textContent = "Set new password";
          }
        });
      }
    </script>

    ${authBaseStyles()}
  `;
}

// Shown right after login when the account's must_change_password flag is
// still set (every admin-created account starts this way). Requires the
// current — i.e. the temporary, emailed — password, same as any password
// change; the must_change_password flag alone is never treated as
// authorization on the backend, so this can't be skipped by tampering with
// local state.
function renderChangePassword() {
  $("#sidebar").innerHTML = "";
  $("#navbar").innerHTML = "";
  $("#footer").innerHTML = "";
  return `
    <div class="login-page">
      <div class="login-card card">
        <div class="login-brand">
          <div class="logo-icon">U</div>
          <div class="logo-text">Umunara</div>
        </div>
        <h1>Set a new password</h1>
        <p>Your account was just created. For your security, choose a new password before continuing — you won't be able to use the temporary one you were emailed again after this.</p>

        <form id="change-password-form" class="login-form">
          <div class="form-group">
            <label for="cp-current">Temporary password</label>
            <input type="password" id="cp-current" required autocomplete="current-password" placeholder="The password from your welcome email" />
          </div>
          <div class="form-group">
            <label for="cp-new">New password</label>
            <input type="password" id="cp-new" required autocomplete="new-password" minlength="8" placeholder="At least 8 characters" />
          </div>
          <div class="form-group">
            <label for="cp-confirm">Confirm new password</label>
            <input type="password" id="cp-confirm" required autocomplete="new-password" minlength="8" placeholder="Retype the password" />
          </div>
          <button type="submit" class="btn btn-primary" id="cp-submit" style="width:100%">Set new password</button>
        </form>

        <p class="login-hint"><a href="#" id="cp-logout">Not you? Sign out</a></p>
      </div>
    </div>

    <script type="module">
      const { navigate } = await import("./assets/js/router.js");
      const { toast } = await import("./assets/js/alerts.js");
      const { post } = await import("./assets/js/api.js");
      const { logout, updateUserFlags, getUser } = await import("./assets/js/auth.js");
      const { CONFIG } = await import("./assets/js/config.js");

      document.getElementById("cp-logout").addEventListener("click", (e) => {
        e.preventDefault();
        logout();
        navigate("/login");
      });

      document.getElementById("change-password-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const current_password = document.getElementById("cp-current").value;
        const new_password = document.getElementById("cp-new").value;
        const confirm = document.getElementById("cp-confirm").value;
        if (new_password !== confirm) return toast("Passwords don't match", "error");
        if (new_password === current_password) return toast("New password must be different from the temporary one", "error");
        const btn = document.getElementById("cp-submit");
        btn.disabled = true;
        btn.textContent = "Saving…";
        try {
          await post("/auth/change-password", { current_password, new_password });
          updateUserFlags({ must_change_password: false });
          toast("Password updated.", "success");
          const user = getUser();
          navigate(CONFIG.roles[user.role]?.home || "/login");
        } catch (err) {
          toast(err.message || "Could not change password", "error");
        } finally {
          btn.disabled = false;
          btn.textContent = "Set new password";
        }
      });
    </script>

    ${authBaseStyles()}
  `;
}

// Shown after login/password-change until the account's email is verified.
// A code is emailed automatically at login (see backend Auth_controller);
// this screen is also where a fresh code can be requested if it expired or
// didn't arrive.
function renderVerifyEmail() {
  $("#sidebar").innerHTML = "";
  $("#navbar").innerHTML = "";
  $("#footer").innerHTML = "";
  const user = getUser();
  const email = user?.email || "your email";
  return `
    <div class="login-page">
      <div class="login-card card verify-card">
        <div class="verify-icon" aria-hidden="true">
          <svg viewBox="0 0 64 64" width="40" height="40" fill="none">
            <rect x="6" y="16" width="52" height="36" rx="6" fill="var(--surface)" stroke="var(--accent)" stroke-width="2.5"/>
            <path d="M8 19L30.2 35.4C31.3 36.2 32.7 36.2 33.8 35.4L56 19" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="49" cy="47" r="12" fill="var(--teal-500)"/>
            <path d="M43.5 47L47.3 50.8L54.5 43.5" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>

        <h1>Check your inbox</h1>
        <p>We sent a 6-digit code to <strong>${escapeHtml(email)}</strong>. Enter it below — it expires in 15 minutes.</p>

        <form id="verify-form" class="login-form">
          <div class="otp-group" id="otp-group" role="group" aria-label="Verification code">
            ${Array.from({ length: 6 }).map((_, i) => `<input type="text" class="otp-box" inputmode="numeric" pattern="[0-9]" maxlength="1" autocomplete="${i === 0 ? "one-time-code" : "off"}" data-otp-index="${i}" aria-label="Digit ${i + 1}" />`).join("")}
          </div>
          <button type="submit" class="btn btn-primary" id="verify-submit" style="width:100%" disabled>Verify email</button>
        </form>

        <p class="login-hint verify-resend-row">
          Didn't get it? <a href="#" id="verify-resend">Resend code</a><span id="verify-cooldown"></span>
        </p>
        <p class="login-hint verify-spam-hint">Check your spam or junk folder if you don't see it within a minute.</p>
        <p class="login-hint"><a href="#" id="verify-logout">Not you? Sign out</a></p>
      </div>
    </div>

    ${authBaseStyles()}
    <style>
      .verify-card { text-align: center; }
      .verify-card p { text-align: center; }
      .verify-icon {
        width: 4rem;
        height: 4rem;
        margin: 0 auto var(--space-5);
        border-radius: 50%;
        background: color-mix(in srgb, var(--accent) 14%, transparent);
        display: grid;
        place-items: center;
      }
      .otp-group {
        display: flex;
        justify-content: center;
        gap: var(--space-2);
        margin-bottom: var(--space-2);
      }
      .otp-box {
        width: 3rem;
        height: 3.5rem;
        text-align: center;
        font-family: var(--font-display);
        font-size: 1.5rem;
        font-weight: 700;
        border: 1.5px solid var(--border);
        border-radius: var(--radius);
        background: var(--surface);
        color: var(--foreground);
        transition: border-color 0.15s ease, box-shadow 0.15s ease;
      }
      .otp-box:focus {
        outline: none;
        border-color: var(--accent);
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 25%, transparent);
      }
      .otp-box.otp-filled { border-color: var(--teal-500); }
      .otp-box.otp-error { border-color: var(--danger); animation: otp-shake 0.3s; }
      @keyframes otp-shake {
        25% { transform: translateX(-4px); }
        75% { transform: translateX(4px); }
      }
      .verify-resend-row { position: relative; }
      #verify-cooldown { color: var(--foreground-muted); }
      .verify-spam-hint { font-size: 0.8125rem; opacity: 0.8; }
      @media (max-width: 400px) {
        .otp-box { width: 2.5rem; height: 3rem; font-size: 1.25rem; }
      }
    </style>

    <script type="module">
      const { navigate } = await import("./assets/js/router.js");
      const { toast } = await import("./assets/js/alerts.js");
      const { post } = await import("./assets/js/api.js");
      const { logout, updateUserFlags, getUser } = await import("./assets/js/auth.js");
      const { CONFIG } = await import("./assets/js/config.js");

      const boxes = Array.from(document.querySelectorAll(".otp-box"));
      const submitBtn = document.getElementById("verify-submit");
      const form = document.getElementById("verify-form");

      function currentCode() {
        return boxes.map((b) => b.value).join("");
      }
      function updateSubmitState() {
        submitBtn.disabled = currentCode().length !== 6;
      }
      function clearError() {
        boxes.forEach((b) => b.classList.remove("otp-error"));
      }

      boxes.forEach((box, i) => {
        box.addEventListener("input", () => {
          box.value = box.value.replace(/[^0-9]/g, "").slice(0, 1);
          clearError();
          box.classList.toggle("otp-filled", !!box.value);
          if (box.value && i < boxes.length - 1) boxes[i + 1].focus();
          updateSubmitState();
          if (currentCode().length === 6) form.requestSubmit();
        });
        box.addEventListener("keydown", (e) => {
          if (e.key === "Backspace" && !box.value && i > 0) {
            boxes[i - 1].focus();
          }
        });
        box.addEventListener("paste", (e) => {
          e.preventDefault();
          const digits = (e.clipboardData.getData("text") || "").replace(/[^0-9]/g, "").slice(0, 6).split("");
          digits.forEach((d, j) => { if (boxes[j]) { boxes[j].value = d; boxes[j].classList.add("otp-filled"); } });
          const next = boxes[Math.min(digits.length, boxes.length - 1)];
          next?.focus();
          updateSubmitState();
          if (currentCode().length === 6) form.requestSubmit();
        });
      });
      boxes[0]?.focus();

      document.getElementById("verify-logout").addEventListener("click", (e) => {
        e.preventDefault();
        logout();
        navigate("/login");
      });

      const resendLink = document.getElementById("verify-resend");
      const cooldownEl = document.getElementById("verify-cooldown");
      let cooldownTimer = null;
      function startCooldown(seconds) {
        resendLink.style.pointerEvents = "none";
        resendLink.style.opacity = "0.5";
        let remaining = seconds;
        cooldownEl.textContent = \` (\${remaining}s)\`;
        cooldownTimer = setInterval(() => {
          remaining -= 1;
          if (remaining <= 0) {
            clearInterval(cooldownTimer);
            cooldownEl.textContent = "";
            resendLink.style.pointerEvents = "";
            resendLink.style.opacity = "";
          } else {
            cooldownEl.textContent = \` (\${remaining}s)\`;
          }
        }, 1000);
      }

      resendLink.addEventListener("click", async (e) => {
        e.preventDefault();
        const original = resendLink.textContent;
        resendLink.textContent = "Sending…";
        try {
          const r = await post("/auth/resend-verification", {});
          toast(r.message || "Verification code sent.", "success");
          startCooldown(30);
        } catch (err) {
          toast(err.message || "Could not resend code", "error");
        } finally {
          resendLink.textContent = original;
        }
      });

      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const code = currentCode();
        if (code.length !== 6) return;
        submitBtn.disabled = true;
        submitBtn.textContent = "Verifying…";
        try {
          await post("/auth/verify-email", { code });
          updateUserFlags({ email_verified: true });
          toast("Email verified.", "success");
          const user = getUser();
          navigate(user.must_change_password ? "/change-password" : (CONFIG.roles[user.role]?.home || "/login"));
        } catch (err) {
          toast(err.message || "Invalid code", "error");
          boxes.forEach((b) => { b.classList.add("otp-error"); b.classList.remove("otp-filled"); b.value = ""; });
          boxes[0]?.focus();
          submitBtn.disabled = true;
        } finally {
          submitBtn.textContent = "Verify email";
        }
      });
    </script>
  `;
}

function bindPageActions(container) {
  const root = container || document;

  root.querySelectorAll("[data-nav]").forEach((btn) => {
    if (btn.dataset.boundNav === "true") return;
    btn.dataset.boundNav = "true";
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      closeSidebar();
      navigate(btn.dataset.nav);
    });
    if (btn.getAttribute("role") === "button") {
      btn.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          closeSidebar();
          navigate(btn.dataset.nav);
        }
      });
    }
  });

  root.querySelectorAll("[data-menu-toggle]").forEach((btn) => {
    if (btn.dataset.boundMenu === "true") return;
    btn.dataset.boundMenu = "true";
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      toggleSidebar();
    });
  });

  root.querySelectorAll("[data-logout]").forEach((btn) => {
    if (btn.dataset.boundLogout === "true") return;
    btn.dataset.boundLogout = "true";
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      const { logout } = await import("./auth.js");
      logout();
      navigate("/login");
    });
  });

  root.querySelectorAll("[data-load]").forEach((el) => {
    if (el.dataset.boundLoad === "true") return;
    el.dataset.boundLoad = "true";
    loadComponent(el.dataset.load, el);
  });
}

function pageTitle(path) {
  const map = {
    "/": "Home",
    "/login": "Login",
    "/reset-password": "Reset Password",
    "/change-password": "Set New Password",
    "/verify-email": "Verify Email",
    "/viewer": "Document Viewer",
    "/profile": "My Profile",
    "/register": "Register your School or Company",
    "/library": "Library",
    "/students/home": "Student Dashboard",
    "/students/notes": "My Notes",
    "/students/assignments": "Assignments",
    "/students/results": "My Results",
    "/students/ai": "AI Tutor",
    "/students/internships": "Internships",
    "/students/internships/detail": "Internship Details",
    "/students/internships/applications": "My Applications",
    "/students/companies": "Companies",
    "/students/companies/detail": "Company Details",
    "/teachers/home": "Teacher Dashboard",
    "/teachers/notes": "Teaching Notes",
    "/teachers/assignments": "Assignments",
    "/teachers/submissions": "Submissions",
    "/teachers/results": "Class Results",
    "/teachers/ai": "AI Assistant",
    "/admin/home": "Admin Dashboard",
    "/admin/users": "User Management",
    "/admin/academics": "Academics",
    "/admin/notes": "Content Library",
    "/admin/report": "Reports",
    "/admin/internships": "Internship Administration",
    "/admin/internships/applications": "Internship Applications",
    "/admin/companies": "Companies",
    "/companies/home": "Company Dashboard",
    "/companies/profile": "Company Profile",
    "/companies/internships": "My Internships",
    "/companies/applicants": "Applicants",
    "/companies/reports": "Reports by School",
    "/super-admin/home": "Super Admin Dashboard",
    "/super-admin/schools": "Schools",
    "/super-admin/schools/detail": "School Details",
    "/super-admin/companies": "Companies",
    "/super-admin/companies/detail": "Company Details",
    "/super-admin/trades": "Trades",
    "/super-admin/report": "Reports",
    "/super-admin/registrations": "Registration Requests",
  };
  return `${map[path] || "Page"} — Umunara`;
}

function loadingTemplate() {
  return `
    <div class="empty-state">
      <div class="skeleton" style="width:4rem;height:4rem;border-radius:50%;margin:0 auto var(--space-5)"></div>
      <div class="skeleton" style="width:12rem;height:1.25rem;margin:0 auto var(--space-2)"></div>
      <div class="skeleton" style="width:8rem;height:0.875rem;margin:0 auto"></div>
    </div>
  `;
}

// Bootstrap
window.addEventListener("popstate", () => render(window.location.pathname));
// Defense-in-depth: if any API call ever comes back with either
// account-setup-required 403 (backend's requireAccountSetupComplete
// middleware), force the redirect immediately rather than waiting for the
// next navigation — covers a stale tab, or a flag flipping server-side
// while a session is already open.
window.addEventListener("umunara:password-change-required", async () => {
  const { updateUserFlags } = await import("./auth.js");
  updateUserFlags({ must_change_password: true });
  navigate("/change-password");
});
window.addEventListener("umunara:email-verification-required", async () => {
  const { updateUserFlags } = await import("./auth.js");
  updateUserFlags({ email_verified: false });
  navigate("/verify-email");
});
window.addEventListener("DOMContentLoaded", async () => {
  const u = await import("./utils.js");
  u.setTheme(u.getTheme());
  await initAuth();
  render(window.location.pathname);

  $("#sidebar-overlay")?.addEventListener("click", closeSidebar);
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeSidebar();
  });
  window.addEventListener("resize", () => {
    if (window.innerWidth > 1024) closeSidebar();
  });
});

// Global navigate helper for inline onclick and legacy scripts
window.navigateTo = navigate;
