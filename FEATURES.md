# Features

Everything below marked ✅ is built and in the codebase today. Items marked 🔜 are on the roadmap (see `PLAN.md`) but not implemented yet — listed here so it's clear what Padhle is *becoming*, not just what it is right now.

## Onboarding

- ✅ Sign in with Google or Email/Password
- ✅ Pick one or more exams (Class 10 Boards, Class 12 Boards, JEE Main, JEE Advanced, NEET) — you can prep for Boards and JEE/NEET at the same time
- ✅ Set a target exam date per exam, used for countdowns
- ✅ Auto-generates your syllabus (subjects → chapters, with rough exam-weightage) from a bundled dataset the moment you finish onboarding

## Today (home screen)

- ✅ Today's Goal — the first thing you said you'd focus on, set during your daily check-in
- ✅ "Do these next" — your top 3 unfinished tasks for today, not a wall of everything
- ✅ One-tap "Start a focus session" into the Focus Timer
- ✅ Live stat strip: focus time, tasks done, questions done, PYQs done — all for today
- ✅ Your recent Study Forest (last 7 sessions) with a link to the full forest on your Profile
- ✅ Active Study Sprint card, if you have one running
- ✅ Exam countdown for your primary exam
- ✅ Streak flame and level badge, always visible
- ✅ Daily check-in prompt (top-3 goals) — asked once per day, automatically
- ✅ **A live Coach** right on Today — one message that changes with your day and mood: morning planning nudge, streak-at-risk heads-up, Monday "fresh week" kick-off with last week's numbers, exam-soon (≤14 days) urgency, evening wrap-up, and a daily-goal progress bar that pushes you gently to win the day. Rule-based on your own data, no server thinking required. See `src/lib/coach.ts`.

## Planner

- ✅ Day / Week / Month views
- ✅ Add tasks with category (JEE / Board / School / PYQ / Revision / Mock), subject, chapter, priority, difficulty, estimated time, and a target question count
- ✅ Check tasks off — completing a task updates every dashboard number in one shot (see "How the numbers work" below)
- ✅ Delete tasks
- ✅ Backlog Inbox for unfinished work, plus a daily rollover prompt on Today (send an overdue task to today / backlog / drop)
- 🔜 Predictive rescheduling based on your own historical pace (e.g. "you usually do ~38 Q/hour") — the mechanical reschedule loop is built, the prediction layer isn't yet

## Study Sprints

- ✅ Start a 7 / 14 / 30-day sprint with goals: target questions, PYQs, mock tests, and focus hours
- ✅ **Smart sprint board** (JIRA-style, simplified): To Do / In Progress / Done columns, drag & drop or tap-to-move, quick-add tasks per sprint, priority chips (P1/P2/P3)
- ✅ Sprint detail page: progress ring, day-by-day timeline, per-goal breakdown, and a **pace check** (🚀 ahead / 🎯 on track / ⏳ behind schedule)
- ✅ Active / **Archive** tabs — finished and abandoned sprints are kept, never deleted
- ✅ "Continue sprint → Focus Timer" deep-link that automatically credits the sprint
- ✅ Mark a sprint complete (🎉 + XP) or abandon it
- ✅ Auto-generated **Mistakes Revision Sprint** from your Error Book (see below)
- ✅ **Sprint review (retro)** — the moment a sprint ends, a full auto-summary appears: every goal achieved vs missed (with bars), your best & slowest days, the subject mix you actually studied, **what went well / what to fix**, and a personal congratulations line plus 2–4 plain-language "try this next sprint" improvement suggestions. Based on your real counters and sessions, no guesswork. See `src/lib/retro.ts`.

## Focus Timer

- ✅ Pick what you're studying: subject → chapter → activity type (Lecture / Practice / PYQ / Revision) → duration (25/5, 50/10, 90/20, or custom)
- ✅ A "quiet mode" full-screen timer — no notifications, no nav bar, just a countdown ring
- ✅ Automatic break timer after a completed session
- ✅ Every session (finished or ended early) is logged, grows a tree in your Study Forest, and earns XP for the minutes actually focused

## Syllabus & Chapter Mastery

- ✅ Subjects grouped by exam, each chapter tracked through: Not Started → Learning → Practicing → PYQs → Revised → Mastered
- ✅ Filter chapters by All / Weak (low accuracy) / Not started / Mastered
- ✅ Per-chapter accuracy once you've attempted questions in it
- ✅ Mastering a chapter earns XP and updates your subject's "% mastered" instantly
- ✅ Automatic spaced-revision scheduling once a chapter is mastered (+1/+3/+7/+15/+30 days), auto-injected into your Planner as tasks when due

## Tests & PYQs

- ✅ Log a mock test: overall marks, attempted/correct/incorrect/unattempted, time spent, percentile/rank, and an optional subject-wise breakdown
- ✅ Automatic accuracy calculation
- ✅ Score trend chart across your logged tests
- ✅ "Review mistakes" link straight into the Error Book

> Padhle doesn't host PYQ question banks or a test-taking interface — you solve PYQs from whatever source you already use (books, apps, coaching material) and log the *result* here as a Planner task (category: PYQ) or a mock test. Padhle's job is tracking what you planned vs. did, and learning from what went wrong — not replacing your question bank.

## Error Book

- ✅ Log a mistake: subject, chapter, error type (Concept / Formula / Calculation / Silly / Guessed / Time pressure), why you got it wrong, and a review-by date
- ✅ Filter by Open / Reviewed / Resolved
- ✅ **Auto Mistakes Revision Sprint** — one tap groups every open mistake by chapter, creates one focused revision task per chapter, and starts a 7-day sprint so mistakes actually get revisited instead of forgotten

## Reports & Analytics

- ✅ Week/month/30-day Reports page: Focus Score (0–100) ring, an animated component breakdown (task completion, focus time, practice, revision, planning), and one plain-language suggestion pointed at your weakest area
- ✅ Weekly "beat last week" nudge and a last-30-days retro-pace card tie-in with your exam countdown
- ✅ **Analytics page**: Day / Week / Month / Year / **Custom** periods, animated donut charts (time **by subject** and **by activity/goal**), a daily focus trend chart, and a previous-period comparison
- ✅ **Export**: CSV download + Print/PDF table (browser "Save as PDF")
- ✅ **Run your best** — a personal-records card comparing this week's focus against your all-time best week, and your best single day of questions, so you always know the number to beat
- ✅ Daily motivational quote on Today (cached once per day, works even without external API access)

## Notes

- ✅ Rich-text **Notes** page: style text with bold / italic / underline / headings / bullet & numbered lists
- ✅ **Font size**, **text color**, and **highlight color** options and a clear-formatting tool
- ✅ Per-note accent color and pinning; grid of note cards sorted with pins first
- ✅ Stored per-account (Firestore), synced, HTML sanitized on write (see `src/lib/notes.ts`)
- ✅ Simple editor = big, friendly toolbar; no shortcuts to memorise

## Account & trust

- ✅ **Profile photo** — upload a photo from the Profile page; it's cropped to a square and compressed client-side to fit the Firestore doc, then synced everywhere (header, admin, parent snapshots)
- ✅ **Personal details** on Profile — editable full name, school/college, class/grade, and address (street, city, state picker)
- ✅ **Forgot password** — email reset link from the login screen
- ✅ **Parents & mentors** — grant read-only access by email; they sign in with their own Google account and land on a **My students** hub (`/#/parent`) listing every student who shared with them, each opening a read-only snapshot with weekly focus score, focus trend, exam countdown, last-30-days totals, syllabus progress, and a recent-activity feed (focus, tasks, mocks, check-ins) (enforced in Firestore rules, see `FIREBASE_SETUP.md §7`)
- ✅ **Daily study reminder** — browser notification at a time you choose (Profile)
- ✅ **Offline banner** — warns when data may be stale; work keeps syncing
- ✅ Light + dark mode toggle available even on the login screen

## Admin dashboard

Built for a parent/guardian, tutor, or the person running the app for a few students. Only visible to accounts with a doc in the `/admins` collection (see `FIREBASE_SETUP.md §6`).

- ✅ Every registered user in one table: lifetime focus hours, questions, tasks, mocks, streak, stream/onboarded status, and last-active — sorted by most recent activity
- ✅ Search by name/email, plus **Needs attention** (not onboarded or inactive 7+ days) and **Admins** filters
- ✅ **Grant/revoke admin access in-app** from each row's shield button — writes a real-time `/admins/{uid}` doc (self-revoke disabled); the same collection can be managed in the Firebase console
- ✅ **Open any student's read-only snapshot** as admin from the eye button (same view parents get)
- ✅ Lifetime totals are summed from `month_*` counters, so the dashboard stays cheap no matter how much history a student racks up
- ✅ Read-only by design: admins can inspect any account but can't modify a student's data

## Help centre

- ✅ In-app **How to use** page (`/help`, avatar menu → How to use): goals-based sections with step-by-step bullet instructions and simple flow charts per feature

## Study Forest 🌳 (gamification)

Inspired by apps like Forest and Focus Keeper — but the "tree" is just a friendly view over a focus session you already logged, not a separate thing to manage.

- ✅ Every completed focus session plants a tree; a bigger tree for longer sessions, a small wilted one if you end early
- ✅ Your forest strip on Today (last 7) and full forest on your Profile
- ✅ XP for completing tasks, focusing, mastering chapters, logging mock tests, and finishing sprints — one flat, transparent rule per action (see `PLAN.md` for the exact numbers)
- ✅ Levels (100 XP per level) with an animated progress bar
- ✅ Daily study streak with a flame that grows warmer/bigger the longer it runs, plus your longest-ever streak
- ✅ 11 achievement badges (first tree, forest milestones, streak milestones, first chapter mastered, 10 chapters mastered, first mock test, sprint finisher, level 5) — unlocking one pops a toast + confetti
- ✅ Confetti is reserved for real milestones (badge unlock, sprint complete) — never fired on routine actions like checking off a task, so it stays special instead of annoying

## Design & feel

- ✅ Mobile-first: bottom tab bar (Today / Planner / Focus / Syllabus / Reports) with a raised gradient Focus button; desktop gets a full sidebar
- ✅ Light + dark mode, with a per-exam accent color (blue for JEE, green for NEET, amber for Boards)
- ✅ Motion used deliberately: cards fade up on load, checkboxes pop when ticked, the Focus Timer goes visually quiet while running, confetti only for milestones
- ✅ Respects `prefers-reduced-motion`

## How the numbers work (for the curious)

Every completed task, focus session, mastered chapter, or logged mock test updates a small **counter document** for that day/week/month in one atomic batch — the dashboards read those counters, they never re-scan your whole history. This is what keeps the app fast and free even as your data grows. See `src/lib/counters.ts` if you're curious about the implementation.
