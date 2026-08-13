# Padhle — Build Plan & Roadmap

**Vision:** a preparation operating system for Class 10/12 Boards, JEE Main, JEE Advanced, and NEET students that answers one question — *"what should I study next?"* — keeps them focused while they do it, and shows whether they're actually getting exam-ready. Philosophy: *don't show me everything I need to do, show me what I need to do next.*

**Stack:** React + Vite + TypeScript + Tailwind + shadcn-style components + Framer Motion, Firebase (Auth + Firestore, free tier), deployed to GitHub Pages as a static SPA. No backend server.

Full original architecture/design spec (data model, brand system, screen-by-screen wireframes) lives in the planning doc this build started from; this file tracks what's actually shipped and what's next.

## Status at a glance

| Phase | Scope | Status |
|---|---|---|
| 1 | Scaffold, auth, app shell, onboarding | ✅ Done |
| 2 | Syllabus, Tasks, Planner, incremental counters | ✅ Done |
| 3 | Focus Timer, Sprints, daily check-in | ✅ Done |
| 4 | Mock Tests, Error Book, auto Mistakes Sprint | ✅ Done |
| — | **Gamification & Engagement** (added mid-build) | ✅ Done |
| 5 | Spaced Revision, Adaptive rollover, Backlog | ✅ Done |
| 6 | Reports/Focus Score, daily quote | ✅ Done |
| 7 | Light hardening (PWA manifest, rule validation) | ✅ Done (scoped down — see note) |
| 8 | Analytics, Smart Sprint boards, Notes, Help centre & trust features | ✅ Done |
| 9 | **Living app**: sprint retrospectives, today's Coach, personal bests | ✅ Done |
| 10 | Parent hub, richer snapshots & admin dashboard | ✅ Done |

Core planning phases (1–7) are functionally complete; Phases 8 added the "premium-but-simple" top layer, Phase 9 adds the "living app" layer described below, and Phase 10 rounds out the sharing/oversight features. What's left is verification in a real browser (see `TODO.md`).

## Phase 1 — Scaffold + Auth + Shell ✅

Vite/TS/Tailwind scaffold, full design-token system (colors, radii, shadows, motion, per-exam accent retinting), Firebase Auth (Google + Email/Password), protected routes, mobile bottom-tab / desktop-sidebar shell, onboarding (welcome → sign in → pick exam(s) → pick date(s)), GitHub Pages deploy workflow.

## Phase 2 — Syllabus + Tasks + Planner core ✅

Bundled syllabus datasets for all 5 exam types, auto-seeded on onboarding. Full Task CRUD (category, subject, chapter, priority, difficulty, estimate, target questions). Planner with Day/Week/Month views. **The spine of the whole app:** `src/lib/counters.ts` — every completion writes one atomic batch that updates day/week/month counter docs plus linked chapter/subject rollups, so every later dashboard is a cheap read, never a scan.

## Phase 3 — Focus Timer + Sprints + Check-in ✅

Task-linked Pomodoro wizard (subject → chapter → activity → duration) with a "quiet mode" full-screen timer and an automatic break phase. Study Sprints (7/14/30-day) with goal tracking and a "Day X of Y · Z%" progress display. Date-keyed daily check-in (top-3 goals) that auto-prompts once per day.

## Phase 4 — Tests & PYQs + Error Book ✅

Mock test logging with subject-wise breakdown and an auto-computed accuracy, plus a score trend chart. Error Book with 6 error types and review dates. The headline feature: **auto-generated Mistakes Revision Sprint** — one tap groups every open mistake by chapter and builds a focused 7-day sprint.

## Gamification & Engagement layer ✅ *(added by request, between Phase 4 and 5)*

Added on top of the existing data model with minimal new surface area — the Study Forest reuses `focusSessions` data rather than a new collection; XP/streak/badges are a handful of fields on the user doc.

- **XP & Levels** — flat, explainable rewards (10 XP/task, 1 XP/focus-minute, 30 XP/chapter mastered, 20 XP/mock logged, 100 XP/sprint completed); 100 XP per level.
- **Streaks** — a pure, unit-testable `computeNextStreak` function; bumped once per day the first time there's real activity.
- **Study Forest** 🌳 — every focus session is a tree (bigger for longer/completed sessions, wilted if ended early); no new collection, just a view over existing session data.
- **Achievements** — 11 badges across forest, streak, mastery, mock test, sprint, and level milestones, computed client-side and diffed against what's stored so unlocking one triggers a toast + confetti exactly once.
- **Confetti & micro-animations** — a small dependency-free confetti component reserved for real milestones (never routine actions, so it doesn't become noise), a satisfying checkbox "pop," animated XP/streak bars.
- **Real Profile page** — level, streak, full forest, and achievement grid, replacing the earlier placeholder.

Design principle carried through all of this: **XP is only ever awarded, never clawed back** (unchecking a task doesn't dock points) — punishing a change of mind is exactly the kind of friction that makes a "gamified" app feel unfair to a student.

## Phase 5 — Spaced Revision + Adaptive rollover + Backlog ✅

- `src/lib/revisions.ts`: reaching "Mastered" queues 5 revision checkpoints (+1/3/7/15/30 days); `injectDueRevisions()` materializes due ones into today's Planner as tasks, idempotently.
- `src/lib/backlog.ts` + Backlog page: carry an unfinished task to the Backlog Inbox, then reschedule it to any date later.
- `OverdueRollover` on Today: surfaces yesterday-and-earlier still-`todo` tasks with one-tap Today / Backlog / Drop actions. **Scoped down from the original plan:** the throughput-based "realistic target" suggestion engine (e.g. "you usually do ~38 Q/hour, consider reducing tonight's target") was left out — the mechanical reschedule/backlog/drop loop is built, the predictive layer is a good future add once there's enough session history to make it meaningful.

## Phase 6 — Reports + Focus Score + daily quote ✅

- `src/lib/reports.ts`: Focus Score (0–100, same 30/25/20/15/10 weighting as originally planned) plus a single plain-language suggestion pointed at the weakest component. Reports page toggles week/month.
- `src/lib/quote.ts` + `QuoteCard`: cache-first daily quote (`/dailyQuote/{date}`), falls back to a small local quote list if no API Ninjas key is configured — never a network dependency for something this minor.
- **Simplified from the original plan:** reports are computed live from the counters doc on every view rather than persisted to a separate `reports` collection. At this data scale (one student, small counters) that's simpler and avoids idempotent-generation edge cases entirely, for the same result the student sees.

## Phase 7 — Hardening ✅ (scoped to what doesn't need a live browser)

- PWA manifest + link tag.
- Firestore rules: added explicit enum validation on the `tasks` collection (status/category) as a demonstration of tightening beyond per-user ownership, layered on top of the existing recursive per-user rule.
- **Left for later, honestly:** full field-level validation on every collection, offline multi-tab conflict testing, and a Lighthouse/accessibility pass — all of these need a real running app in a real browser to do properly, which hasn't been possible from this environment (see `TODO.md`).

## Phase 8 — Smart Sprints, Notes, Analytics & trust features ✅

The "premium but simple for a Class 10-12 / JEE / NEET student" layer, built on the existing data model (no new architectural shifts):

- **JIRA-style Study Sprint boards** — each sprint gets a To Do / In Progress / Done kanban (native drag & drop + tap buttons), quick-add tasks straight onto the board, priority chips, and a **pace check** (ahead / on track / behind) compared against the day-of-sprint. Sprint states already covered completed/abandoned → surfaced as an **Active / Archive** tab so no sprint is ever deleted.
- **Notes** — a rich-text study notebook (bold/italic/headings/lists, font size, text + highlight color) using the browser's native `execCommand` formatting, HTML sanitised on write (`src/lib/notes.ts`), per-note colors + pinning, stored as `/users/{uid}/notes/{noteId}` (covered by existing per-user rules).
- **Analytics** — a dedicated page (`src/lib/analytics.ts` pure aggregation + recharts): Day/Week/Month/Year/Custom periods, animated donuts by subject and by activity, a daily/monthly trend chart, previous-period deltas, and animated count-up KPIs. Lazy-loaded route keeps the initial bundle smaller.
- **Reports upgrades** — 30-day retro-pace card tied to the exam countdown, a "beat last week" nudge, CSV + Print/PDF export (print stylesheet isolates the report for "Save as PDF").
- **Trust & convenience** — forgot-password reset, parent/mentor **read-only shares** via the user doc `parents` array (enforced in Firestore rules, documented in `FIREBASE_SETUP.md`), daily browser-notification reminder, offline/stale-data banner, and dark/light toggle on the login screen.
- **How to use** — an in-app guide (`/help`) with goal-based sections, numbered steps, and simple flow charts, so a new student can self-serve instead of guessing.
- **Perf pass** — lazily-loaded Analytics + Admin routes (separate chunks), memoised aggregation, animated transitions on counters/rings/bars.

## Phase 9 — Living app: retrospectives, the Coach, personal bests ✅

The app starts *talking back* — every sprint, every day, every week it reacts to what the student actually did, with zero server-side thinking (all rule-based on existing counter/session data):

- **Sprint retrospectives** (`src/lib/retro.ts` + `SprintRetro`) — the moment a sprint ends (complete *or* abandoned) an auto-summary shows on the sprint page: each goal achieved/missed with bars, best & slowest days, the subject mix actually studied, **what went well / what to fix** chips, a personal congratulations line, and 2–4 plain-language "next sprint, try to…" suggestions (e.g. lighter targets after a <90% finish, protected weak days, smaller daily question targets). Reuses per-user counters + sessions; no new collection.
- **Today's Coach** (`src/lib/coach.ts` + `CoachCard`) — one message at the top of Today that changes with context: morning planning nudge, streak-at-risk, Monday "fresh week" with last week's actuals, ≤14-days-to-exam urgency, evening wrap-up, plus a live day-goal progress bar (≈86 min/day, from 10h/week ÷ 7). Pure `buildCoachMessage(ctx)` function = trivially testable.
- **Run your best** (`PersonalBests`) — Reports card comparing this week's focus against the all-time best week and showing the best single day of questions — a concrete number to beat.
- **Shared hooks** — `useAllCounters()` / `useAllFocusSessions()` in `src/lib/hooks.ts` let retro, coach, and bests all read the same small counter/session datasets.
- Completing/abandoning a sprint now lands on the sprint page itself so the review is the immediate reward, not the archive list.

## Phase 10 — Parent hub, richer snapshots & admin dashboard ✅

Built on the existing parent-share model — `firestore.rules` already allowed admin and
granted-parent reads, so no rule changes were needed this round:

- **Parents & mentors hub** (`src/pages/ParentHome.tsx`, `/#/parent`) — a signed-in parent/mentor
  sees every student whose `parents` array contains their email (one `array-contains` query),
  each opening a read-only snapshot. No more juggling separate share links; the back link on any
  snapshot returns to the hub.
- **Richer snapshot** (`src/pages/Parent.tsx`) — weekly Focus Score ring via `computeFocusScore`,
  week stat tiles, a 6-week focus trend, exam countdown, last-30-days rolling totals computed
  from `day_` counters, syllabus progress, and recent sessions. The counter fan-out was replaced
  with a single `month_*` range query, and admins can open any student's snapshot (`useAdmin`
  bypass of the parent check, read-only still).
- **Admin dashboard** (`src/pages/Admin.tsx`) — all users sorted by most-recent activity, lifetime
  totals summed from `month_*` counters (never a per-day scan), search by name/email,
  **Needs attention** / **Admins** filters, **in-app grant/revoke of admin** via real-time
  `/admins/{uid}` docs (self-revoke disabled), and an **eye** button that opens any student's
  snapshot as admin. All reading, never writing to a student's data.

## Working constraints worth knowing

- The project was originally written on a network that blocked `registry.npmjs.org`; since then `npm install`/`build` runs cleanly in a normal environment (verified). The Firebase CLI and real-browser verification remain TODO items (see `TODO.md`).
- Design intent: keep the data model boring and the UI expressive. New features should reuse existing collections/fields wherever the data already exists (as gamification did) before reaching for a new collection. Notes reused the `/users/{uid}` subtree; the sprint board reused existing `tasks.sprintId` + statuses; Analytics aggregates over existing `focusSessions`.
