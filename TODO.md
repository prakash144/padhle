# TODO — things I couldn't run for you

> See also: `README.md` (overview + stack), `FEATURES.md` (what's built vs planned), `HOW_TO_USE.md` (student-facing walkthrough), `PLAN.md` (phase-by-phase roadmap).

## Why this file exists

This machine's network (Zscaler corporate proxy) returns `403 Forbidden` for
**every** `registry.npmjs.org` request — not specific to one package. I could
not run `npm create vite`, `npm install`, the `shadcn` CLI, `firebase` CLI, or
`gh-pages`. Everything below is hand-written source that assumes those tools
exist; you need to actually install/run them once you're off this network (or
have the corporate npm mirror configured).

## 1. Get the project running (do this first)

```bash
cd padhle
npm install                 # will pull in everything listed in package.json
cp .env.example .env        # then fill in your Firebase config (see step 2)
npm run dev                 # http://localhost:5173
```

If `npm install` still 403s: try a personal hotspot/VPN-off, or ask IT for the
UKG Artifactory npm mirror URL and set it via
`npm config set registry https://<mirror-url>` (or add it to `padhle/.npmrc`).

## 2. Create the Firebase project (manual, ~5 min)

1. https://console.firebase.google.com → **Add project** → name it `padhle` (or anything).
2. **Build → Authentication → Get started** → enable **Google** and **Email/Password** sign-in providers.
3. **Build → Firestore Database → Create database** → start in **production mode** (rules below lock it down anyway) → pick a region close to India (e.g. `asia-south1`).
4. **Project settings (gear icon) → General → Your apps → Add app → Web (`</>`)** → register app "Padhle Web" → copy the `firebaseConfig` values into `padhle/.env` (see `.env.example` for the mapping).
5. **Authentication → Settings → Authorized domains** → add `localhost` (usually already there) and, once you have a GitHub Pages URL, `<your-github-username>.github.io`.
6. Deploy rules & indexes once the Firebase CLI is installed:
   ```bash
   npm install -g firebase-tools   # or npx firebase-tools
   firebase login
   firebase use --add              # pick your padhle project
   firebase deploy --only firestore:rules,firestore:indexes
   ```

## 3. shadcn/ui components

I hand-wrote minimal versions of `Button`, `Card`, `Input` in
`src/components/ui/` in the shadcn style (using `class-variance-authority` +
`cn()`), so the app runs without the CLI. Once npm works, you can either:

- Keep the hand-written ones (they already follow shadcn conventions and pull
  in the same deps), or
- Run `npx shadcn@latest init` and `npx shadcn@latest add dialog checkbox tabs avatar sheet toast progress` to get the full official set (I already added the underlying `@radix-ui/*` packages to `package.json` for: dialog, checkbox, tabs, avatar — sheet/toast/progress need their Radix deps added when you pull those in).

## 4. GitHub repo + Pages deploy

1. Create a GitHub repo named `padhle` (the `base: '/padhle/'` in `vite.config.ts` assumes this repo name — change it if you name the repo differently).
2. Push this project.
3. Repo **Settings → Pages → Source → GitHub Actions** (the included `.github/workflows/deploy.yml` handles the rest).
4. Repo **Settings → Secrets and variables → Actions** → add these repository secrets (same values as your `.env`):
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
   - `VITE_API_NINJAS_KEY` (optional, Phase 6 — daily quote)
5. Run `npm run deploy:firestore` once to publish the included Firestore rules and indexes.
6. Push to `main` → Action builds + deploys → app live at `https://<username>.github.io/padhle/`.
6. Don't forget step 2.5 above (add the `.github.io` domain to Firebase Auth authorized domains) or Google/Email sign-in will silently fail in production.

## 5. Verify Phase 1 works end-to-end

Once `npm run dev` is up:
- [ ] Visit the app → redirected to `/#/login`.
- [ ] Sign up with email/password (or Google) → should bootstrap a `/users/{uid}` doc (check Firestore console) and land on Onboarding.
- [ ] Pick 1+ exams → pick dates → "Start studying" → should write `examGoals` docs + set `onboardedAt` on the user doc, then land on Today with an exam countdown card.
- [ ] Refresh the page mid-session → should stay logged in and skip onboarding (HashRouter + auth persistence).
- [ ] Resize to mobile width → bottom tab bar appears with a raised center Focus button; resize to desktop → left sidebar appears instead.
- [ ] Sign out from the avatar menu → back to `/#/login`.

## 6. Verify Phase 2 works end-to-end

- [ ] Complete onboarding → a "Setting up..." spinner briefly shows → Firestore console should now have `subjects` (4-5 docs) and `chapters` (~35-50 docs depending on exam) under your user, all `masteryStage: "not_started"`.
- [ ] Go to **Syllabus** tab → subject pills appear → chapters list with 5-segment mastery meters → tap "→ Learning" on a chapter → meter fills one segment and the button label advances; tap through to "Mastered" → the subject's mastered % updates.
- [ ] Go to **Planner** (Day view) → "+ Add task" → fill title, pick subject/chapter, save → task appears in the list.
- [ ] Check the checkbox on a task → task shows strikethrough; in Firestore console, `users/{uid}/counters/day_<today>` should now show `completedTasks: 1` and `focusMinutes` incremented by the task's estimated minutes (confirms the incremental counter write-path from `src/lib/counters.ts` is working — this is the foundation every later analytics screen reads from).
- [ ] Uncheck the same task → counters decrement back down (never go negative under normal use).
- [ ] Switch Planner to Week/Month view → today's date is outlined, days with tasks show a count/dot, tapping a date jumps back to Day view on that date.
- [ ] Go back to **Today** → the task you added should appear under "Do these next" (if not done) and the stat strip (Focus Time / Tasks / Questions / PYQs) should match the counters doc.
- [ ] Delete a task from Planner (hover → trash icon) → disappears immediately and `plannedTasks` in that day's counter decrements (only if it wasn't already done).

## 7. Verify Phase 3 works end-to-end

- [ ] Go to **Focus** tab → wizard asks subject → chapter → activity (Lecture/Practice/PYQ/Revision) → duration (25/5, 50/10, 90/20, or Custom) → "Start focus" → screen goes quiet/dim with a 220px gradient countdown ring and MM:SS.
- [ ] Tap Pause → ring/clock stop; tap Play → resumes. Tap the square "End" button → jumps straight to the "Locked in" complete card (skips break).
- [ ] On the complete card, if you picked Practice/PYQ/Revision you should see a "How many questions?" field → enter a number → "Done" → in Firestore console, a new `focusSessions` doc appears, and `users/{uid}/counters/day_<today>` `focusMinutes`/`questionsDone`/`pyqsDone` increase accordingly (same write-path as Phase 2 tasks — confirms `src/lib/focusSessions.ts` is wired correctly).
- [ ] Let a short Custom session (e.g. 1 min focus / 1 min break) run to natural completion → after the focus ring finishes it should auto-advance to a teal **Break** screen with its own countdown and a "Skip break" button → after break, lands on the complete card.
- [ ] Go to **Sprints** tab → "New sprint" → name it, pick 7/14/30 days, set targets → "Start sprint" → card appears showing "Day 1 of 7 · 0% · N questions remaining".
- [ ] Tap the sprint card → detail page shows a progress ring, a day-dot timeline, and a breakdown of questions/PYQs/mocks/focus-hours vs targets.
- [ ] From Sprint detail, tap "Continue sprint → Focus Timer" → completes a focus session with questions logged → back on the sprint detail, `progress.questions`/`progress.focusMinutes` should have increased (confirms `bumpSprint` wiring in both `tasks.ts` and `focusSessions.ts`).
- [ ] Go to **Today** → on a fresh day (or clear today's `checkins/<date>` doc in Firestore console to re-test) the Check-In sheet should auto-open asking for top-3 goals; submit → dialog closes, a "Today's Goal" card appears at the top of Today showing your first goal, and `counters/day_<today>.checkinDone` becomes `1`. Reloading the page should NOT re-open the sheet (it already has goals saved).
- [ ] If there's an active sprint, its compact card should now also show on **Today**, below the stat strip.

## 8. Verify Phase 4 works end-to-end

- [ ] Go to **Tests & PYQs** → "Log test" → fill name/date/marks/attempted-correct-incorrect-unattempted (+ optional subject-wise breakdown if your subjects match the test's exam) → "Save test" → Firestore console shows a new `mockTests` doc with `accuracy` computed automatically, and `users/{uid}/counters/day_<date>.mockCount` incremented.
- [ ] With 2+ tests logged, the score trend chart renders with a filled area and the date pills below it let you switch which test's subject-breakdown/marks-lost you're viewing.
- [ ] "Review mistakes in Error Book" on a test navigates to `/errors`.
- [ ] Go to **Error Book** (reachable from the test page, or add it to your own nav testing) → "Log mistake" → pick subject (+ optional chapter), error type, why-wrong, review date → saves and appears in the "Open" filter.
- [ ] With 1+ open mistakes, an amber "Start Mistakes Sprint" banner appears → tap it → navigates to a new sprint detail page named "Mistakes Revision Sprint" with one revision task per distinct chapter now sitting in today's Planner; the mistakes used should have flipped from "Open" to "Reviewed" in the Error Book (so re-clicking the banner without new mistakes does nothing — banner disappears once open count is 0).
- [ ] Filter Error Book by Reviewed/Resolved/All to confirm the status segmented control and delete (trash icon) work.

## 9. Verify the Gamification & Engagement layer works end-to-end

- [ ] Complete a task or focus session → within a second or two (no page reload needed), the XP number and level bar on **Today**/**Profile** should visibly increase. If it doesn't move at all, check that `AuthContext.tsx`'s `onSnapshot` listener on `/users/{uid}` is actually attached (console → Firestore → confirm the doc's `xp` field is incrementing even if the UI isn't).
- [ ] Do enough activity today (complete 1 task, or finish 1 focus session) → `userDoc.lastActiveDate` becomes today and `streakCount` increments by 1 (or resets to 1 if you skipped a day) — the flame icon on Today/Profile updates and grows/warms in color at 3, 7, and 30 days.
- [ ] Complete your **first** focus session → a "First Sprout 🌱" toast pops in from the top with a confetti burst, and a tree emoji appears in "Your recent forest" on Today.
- [ ] Grow 10 sessions total → "Forest Starter 🌳" unlocks. Master your first chapter → "First Mastery ⭐" unlocks + 30 XP. Log your first mock test → "Test Pilot 📝" unlocks + 20 XP.
- [ ] On a Sprint's detail page (status Active), tap **"Mark sprint complete 🎉"** → confetti fires immediately, +100 XP lands on the user doc, and after ~1s you're returned to the Sprint list with the sprint now under the **Archive** tab. If that was your first completed sprint, "Sprint Finisher 🚀" should also unlock (two celebrations may overlap slightly — that's expected, not a bug).
- [ ] Go to **Profile** → confirms level/XP bar, streak + longest streak, full Study Forest grid, and the achievements grid (earned badges in color, locked ones grayed out with the emoji still visible).
- [ ] Un-checking a completed task should **not** reduce XP (only counters/rollups reverse) — this is intentional, confirm `xp` on the user doc doesn't decrease.
- [ ] Confirm confetti/toasts do **not** fire on routine task checkbox ticks — only on badge unlocks and sprint completion. If you see it firing constantly, something regressed (it's meant to stay rare so it feels special).

## 9b. Verify the UI/UX review fixes

- [ ] Disconnect network (or use Firestore emulator + kill it) and try adding a task/sprint/mistake/mock test/check-in → a red error toast should appear bottom-center instead of the dialog silently doing nothing.
- [ ] Go to **Profile** → toggle the dark/light switch → whole app repaints instantly; reload the page → theme persists (no flash of the wrong theme on load).
- [ ] With 2+ exams added, tap the exam chip top-left → dropdown lists all exams with a checkmark on the current primary → pick a different one → Today's countdown/accent color switches to it immediately.
- [ ] With only 1 exam, the chip should show no dropdown arrow and not be clickable (nothing to switch to).

## 12. Verify Phase 8 features end-to-end

**Smart Sprint board**
- [ ] Sprints → New sprint → open its detail → board shows 3 columns (To Do / In Progress / Done).
- [ ] Quick-add a task → lands in To Do with your chosen category; in Firestore, `tasks` doc has `sprintId` set and today's `plannedTasks` bumped.
- [ ] Drag a card To Do → In Progress (or use ◀/▶ buttons) → status updates instantly, no counters change.
- [ ] Drag a card to Done → task completes through the real counter path (`completedTasks` +1, XP awarded); drag it back → un-completes cleanly (XP not clawed back).
- [ ] Sprint health chip shows 🚀/🎯/⏳ depending on day-of-sprint vs progress.
- [ ] Sprints page: Active/Archive tabs — complete or abandon a sprint → it moves to Archive, still viewable.

**Notes**
- [ ] Notes → New note → type text, apply bold/italic/headings/bullets, change font size, text color and highlight → Save.
- [ ] Reload → note persists with formatting; card shows title + a text excerpt + color accent.
- [ ] Pin a note → it sorts to the top; change note color → card accent updates.
- [ ] Delete a note → gone from grid and Firestore. **Security spot-check:** paste `<img src=x onerror=alert(1)>` into the editor and save → the stored HTML is stripped of unsafe tags (see `sanitizeRichHtml`).

**Analytics**
- [ ] Analytics → switch Day → Week → Month → Year → Custom; year picker and from/to dates work.
- [ ] Donuts show time by subject and by activity; trend chart renders; previous-period chip shows a delta.
- [ ] With very few/no sessions in a period, empty-state card shows instead of broken charts.

**How to use**
- [ ] `/#/help` renders goal sections with numbered steps and flow charts; chips scroll to each section.
- [ ] Reachable from the avatar menu (mobile) and the sidebar (desktop).

## 13. Verify Phase 9 features end-to-end

**Sprint retrospective**
- [ ] Complete a sprint → landing page shows the "Sprint review": congrats banner, goal bars (achieved ✓ / missed), best & slowest day cards, subject-mix chips, What went well / What to fix chips, and "Next sprint, try to…" suggestions.
- [ ] The numbers match reality (spot-check against the counters for the sprint window — e.g. best day = max daily focus within start→end).
- [ ] Abandon a sprint → a review still shows (status acknowledges "ended early", suggestion nudges a lighter restart).
- [ ] A sprint with zero sessions → strengths show "Not enough data yet", suggestions steer to starting the Focus timer.

**Today's Coach**
- [ ] On Today, the Coach card appears above the goal card with an emoji, title, body and a day-goal % that matches today's focus.
- [ ] Morning (before noon) with no check-in yet → message prompts the daily check-in.
- [ ] Fresh day with a ≥3-day streak and no focus by mid-afternoon → "keep the streak alive" message.
- [ ] Monday → "fresh week" message referencing last week's focus hours.
- [ ] ≤14 days to primary exam + no focus yet → urgent "X days to <exam>" message.
- [ ] Evening after focus → wrap-up message with the actual minutes/questions; day-goal progress bar fills as today's focus grows.

**Run your best (Reports)**
- [ ] Reports → "Run your best" card shows best week of focus and best day of questions; this-week bar fills vs best.
- [ ] With no history the card hides entirely (returns null).

## 10. All 7 phases are now built — see `PLAN.md` for full detail

Phases 1-4 + Gamification were covered in earlier rounds (still summarized in git history / earlier TODO revisions). This round added:

- **Phase 5** — `src/lib/revisions.ts` (auto +1/3/7/15/30-day revision scheduling on chapter mastery, injected into the Planner), `src/lib/backlog.ts` + Backlog page, and an `OverdueRollover` card on Today (Today / Backlog / Drop for stale tasks). Skipped the throughput-prediction stretch goal — see `PLAN.md`.
- **Phase 6** — `src/lib/reports.ts` (Focus Score + suggestion, computed live from counters — no separate `reports` collection, simpler at this scale) and a Reports page (week/month toggle); `src/lib/quote.ts` + `QuoteCard` (cache-first, falls back to local quotes without an API key).
- **Phase 7** — PWA manifest, one Firestore rule tightening example (`tasks` enum validation). Deeper hardening (full field validation, offline multi-tab testing, Lighthouse) intentionally deferred — it needs a real browser, which hasn't been available in this environment.
- **UI/UX**: cross-page fade transition in `AppShell`, plus the checkbox pop/streak flame/level bar animations from the gamification round.

Nothing left on the original plan. Next real step is running it (see sections 1–9) and fixing whatever that surfaces.

## 11. Known placeholders / rough edges to revisit

- `TopBar.tsx` exam switcher — the chip + dropdown is built and functional (single exam → no arrow; multiple → switchable). Left as a nice-to-have: filtering Planner/Reports per exam isn't wired yet, so switching currently only changes Today's countdown/accent.
- App icon (`public/favicon.svg`) is a simple placeholder mark, not a final designed logo — revisit branding polish if it starts mattering.
- Picking **both JEE Main and JEE Advanced** in onboarding seeds two separate (duplicate) copies of the Physics/Chemistry/Maths syllabus, since subjects/chapters are scoped per `examType` in the schema. Harmless but redundant — worth a dedup pass in Phase 7 if that combo turns out to be common.
- Syllabus datasets in `src/data/syllabus/*.json` are a representative chapter list per exam (real NCERT/JEE/NEET chapter names with rough weightage), not an exhaustive official syllabus — treat as a good-enough v1 and refine later if needed.
- `useCountdown` (`src/lib/useCountdown.ts`) ticks via a 1-second `setInterval` and does not correct for background-tab throttling — on a phone with the screen locked mid-session, the timer can drift a few seconds. Fine for now; if it matters later, switch to comparing against a stored `Date.now()` start time instead of counting ticks.
- The Focus Timer's Pause button pauses the *displayed* countdown, but if the user leaves the page mid-pause without ending the session, nothing is saved (no session doc is written until "Done" on the complete card). This is intentional (avoids partial/abandoned session clutter) but worth a "resume in-progress session" affordance later if students report losing sessions on accidental navigation.
- No automated tests yet. Now that Phase 2/3's pure logic exists (`src/lib/dates.ts`, `src/lib/chapters.ts`, `src/lib/sprints.ts`, `src/lib/useCountdown.ts`), add Vitest + React Testing Library (`npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom`) — good candidates to test first: `weekKey`/`monthGrid` date math, `nextMasteryStage`, `sprintCompletionPct`/`sprintDayProgress`, and `computeNextStreak`/`computeEarnedBadgeIds` (both pure functions in `src/lib/gamification.ts`, written specifically to be easy to unit test).
- `useBadgeContext()` (`src/lib/hooks.ts`) reads up to 500 focusSessions + 500 mockTests documents just to count them, on every screen inside `AppShell` (via `useGamificationSync`). Totally fine at "1-10 students, one exam prep's worth of data" scale, but if a power user racks up thousands of sessions over years of use, switch this to Firestore's `getCountFromServer` aggregate queries instead of downloading full documents.
- Badge/streak/XP writes happen via plain `updateDoc`/batched `set(..., {merge:true})` calls triggered from a `useEffect` in `useGamificationSync` — they're guarded against re-entrancy (`badgeSyncInFlight` ref) and against double-counting the same day (`streakCheckedForDate` ref), but they are **not** wrapped in a Firestore transaction. At 1-10 users on one device at a time this is not a practical risk; if multi-device concurrent use becomes common, revisit with `runTransaction`.
- The Study Forest and badge/XP system award things but never take them away (beyond the un-check-doesn't-refund-XP rule already noted) — there's no "wilted tree cleanup" or badge-revocation logic, by design. Keep it that way; a gamification system that can un-reward a student is worse than one with none.

## 12b. Verify the Parent home & Admin improvements

**Parents & mentors hub (`/parent`, ParentHome.tsx)**
- [ ] Signed in with an email that appears in a student's `parents` array → visiting `/#/parent` lists that student with streak + last-active; each row opens the read-only snapshot.
- [ ] Signed in with no students shared → empty state explains the flow ("Profile → Parents & mentors").
- [ ] The back link on any snapshot (`ArrowLeft · My students`) returns to the `/parent` list.
- [ ] A granted parent still cannot mutate anything (rules: subcollection reads only; no writes) — confirm a write attempt fails in the emulator.

**Read-only snapshot (`/parent/:uid`, Parent.tsx)**
- [ ] Weekly Focus Score ring matches `computeFocusScore` on this week's `week_` counter.
- [ ] 4 stat tiles (Focus/Questions/Tasks/Mocks), a 6-week focus trend, exam countdown, last-30-days rolling sums (computed from `day_` counters over the trailing 30 days, including today's), syllabus progress, and a combined recent-activity feed (focus sessions, completed tasks, mock tests, check-ins) all match Firestore.
- [ ] Owner viewing their own link → full access; admin viewing any link → full access; an unauthorized signed-in user → "This snapshot is private" gate.

**Admin dashboard (Admin.tsx)**
- [ ] With a doc in `/admins`, `/admin` lists all users sorted by last-active, with lifetime totals (sum of `month_*` counters).
- [ ] Search box filters by name/email; "Needs attention" filter shows not-onboarded or inactive-7-days users; "Admins" filter shows only admins.
- [ ] Shield button on a row grants/revokes a real-time `/admins/{uid}` doc (self-revoke disabled); the Admins chips card updates immediately.
- [ ] The eye button on any row opens that student's snapshot (`/parent/:uid`) as admin.
- [ ] Non-admin signed-in user visiting `/admin` sees the "You don't have admin access" card.
