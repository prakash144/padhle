# Padhle 🌳

**Your calm study coach for Class 10/12 Boards, JEE Main, JEE Advanced, and NEET.**

Plan → focus → practice → review → improve. Padhle doesn't try to show you everything you need to do — it shows you what to do *next*, keeps you focused while you do it, and turns consistency into something visible: a streak, a level, a forest of trees you've grown one focus session at a time.

Highlights: daily check-in + Planner, a Pomodoro **Focus Timer** with a Study Forest 🌳, **JIRA-style Study Sprint boards** (To Do → In Progress → Done with drag & drop), rich-text **Notes**, Tests + Error Book with auto **Mistakes Revision Sprints**, **Reports & Analytics** (day/week/month/year/custom time charts with exports), streaks/XP/badges gamification, parent/mentor read-only shares with a **My students hub**, and an in-app **admin dashboard** (searchable user list, admin grant/revoke, open-any-student snapshots), daily reminders, light/dark mode — and an in-app **How to use** guide with flow charts. It's a _living app_: **sprint retrospectives** auto-review what went well/wrong after each sprint with next-sprint suggestions, a rule-based **Coach** on Today talks to the student through the day (morning plans, streak saves, Monday kick-offs, exam countdown urgency, evening wrap-ups), and **Run your best** chases personal records.

📖 **Docs:**
- [`FEATURES.md`](./FEATURES.md) — everything the app does, organized by area
- [`HOW_TO_USE.md`](./HOW_TO_USE.md) — a student-friendly walkthrough
- [`PLAN.md`](./PLAN.md) — the build roadmap and current status
- [`FIREBASE_SETUP.md`](./FIREBASE_SETUP.md) — connect Firebase, enable Admin + parent shares, grant more admins from the dashboard
- [`TODO.md`](./TODO.md) — setup steps + a running list of what still needs a human's hand

## Stack

React + Vite + TypeScript + Tailwind + shadcn-style components + Framer Motion + recharts, Firebase (Auth + Firestore), deployed free to GitHub Pages.

## Local development

```bash
npm install
cp .env.example .env   # fill in Firebase config — see TODO.md section 2
npm run dev
```

## Deploy

Before the first release, deploy the bundled Firestore rules and indexes so the shared Academic Context can persist:

```bash
npm run deploy:firestore
```

Then push to `main` — `.github/workflows/deploy.yml` verifies the required `VITE_FIREBASE_*` secrets, builds, and publishes to GitHub Pages automatically. Set Pages source to "GitHub Actions". Full first-time setup steps are in `TODO.md`.

## Why it's built this way

- **No backend server** — Firebase Auth + Firestore only, so it's free to run for 1–10 students and deploys as a static site.
- **Counters, not scans** — every dashboard number (focus minutes, questions done, streak) is read from a small pre-aggregated counter doc, never computed by scanning your whole task history. See `src/lib/counters.ts`.
- **Gamification reuses data, not new collections** — the Study Forest is just a view over your existing focus sessions; XP and streaks are a couple of fields on your user doc. Nothing about "engagement" required a heavier data model.
