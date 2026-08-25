# Umunara — Frontend

The Umunara single-page app: student, teacher, and admin dashboards for
notes, assignments, results, and the AI tutor/assistant. Talks to the real
Umunara backend (see `../backend` and `../ai-service`) — no mock data.

## What's included

- **Single-page app (SPA)** — `index.html` is the entry point. `assets/js/router.js`
  loads role-based page fragments from `pages/` and shared `components/`.
- **Design system** — CSS variables, global utilities, and layout in `assets/css/`.
- **JavaScript modules** — router, auth, real API client, loader, alerts,
  and utilities in `assets/js/`.

## How to run

Because the app uses ES modules and `fetch()` for HTML fragments, serve it
from a local HTTP server rather than opening `index.html` directly.

```bash
cd frontend
python3 serve.py 8080
```

Don't use plain `python3 -m http.server` or `npx serve .` — this app uses
real client-side routes (`/students/home`, `/teachers/notes`, ...) via the
History API, and neither of those servers falls back to `index.html` for
unknown paths, so refreshing or deep-linking into any route 404s.
`serve.py` does that fallback (see `vercel.json` / `_redirects` for the
equivalent rule on Vercel / Netlify).

Then open http://localhost:8080. Make sure the backend
(`../backend`, default `http://localhost:5000/api`) and the AI service
(`../ai-service`, default `http://localhost:8080`... note: pick a different
port than this static server, e.g. 5173, if you run both on your machine)
are running too.

To point the frontend at a different API URL without editing code:

```js
localStorage.setItem('umunara_api_base', 'https://your-api.example.com/api');
```

## Accounts

- Students can create their own account from the login screen ("Create a
  student account").
- Teacher and admin accounts are created by an admin (see `../backend`
  README for how to seed the first admin).

## Features

- **Students** — dashboard, notes (view/copy link/ask AI), assignments
  (submit, track status, see marks), results, AI tutor chat.
- **Teachers** — dashboard, notes (upload/delete/copy link/ask AI),
  assignments (create/delete), submissions (grade), results (upload marks),
  AI assistant chat.
- **Admins** — dashboard, user management (create/delete), content library
  (all notes, delete), reports.
- Dark/light theme toggle, responsive sidebar, toast alerts, confirm dialogs.
- Notes are uploaded by teachers only — there's no "generate notes" button.
- No ranking/leaderboard anywhere in the app.
- Everyone can delete what they uploaded (teachers → their notes/assignments,
  admins → any note/assignment/user).
- Any note's link can be copied and pasted into the AI tutor/assistant as
  context, or sent there directly via "Explain with AI" / "Ask AI".
