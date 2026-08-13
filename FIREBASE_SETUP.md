# 🔥 Padhle — Firebase Setup

Everything you need to connect Padhle to Firebase: create the project, wire the
app keys, deploy rules, and enable the **Admin dashboard**.

> Account needed: a Google account. Firebase free (Spark) plan is plenty for this app.

---

## 1. Create the Firebase project (console, ~5 min)

1. Go to **https://console.firebase.google.com** → **Add project** → name it `padhle` → click
   **Create** (analytics optional, not needed).
2. **Build → Authentication → Get started** → enable **Google** and **Email/Password**
   sign-in providers.
3. **Build → Firestore Database → Create database** → **Production mode** → pick a region close
   to your users, e.g. `asia-south1` (Mumbai).
4. **Build → Firestore → Rules** → replace the contents with this repo's `firestore.rules`
   (it already includes the admin rules) → **Publish**.
   - Or from the CLI once `firebase-tools` is installed (section 4 below):
     `firebase deploy --only firestore:rules`.

## 2. Register a web app + copy config

1. **Project settings (gear) → General → Your apps** (top) → **Add app → Web (`</>`)**.
2. Nickname: `Padhle Web` → **Register app**.
3. Copy the `firebaseConfig` object shown.

## 3. Fill `.env`

Open `padhle/.env` and replace the placeholder values (`VITE_FIREBASE_*`) with the copied
config (`.env.example` documents each field):

| Env var (in `.env`)              | From `firebaseConfig`        |
| -------------------------------- | ---------------------------- |
| `VITE_FIREBASE_API_KEY`          | `apiKey`                     |
| `VITE_FIREBASE_AUTH_DOMAIN`      | `authDomain` (e.g. `padhle.firebaseapp.com`) |
| `VITE_FIREBASE_PROJECT_ID`       | `projectId`                  |
| `VITE_FIREBASE_STORAGE_BUCKET`   | `storageBucket`              |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId`        |
| `VITE_FIREBASE_APP_ID`           | `appId`                      |

These values are safe in the client bundle — security comes from `firestore.rules`, not by
hiding the config.

Restart the dev server after editing: kill the old one (`lsof -ti:5173 | xargs kill`) then
`npm run dev`.

## 4. Authorize sign-in domains

**Authentication → Settings → Authorized domains** →
- `localhost` (usually pre-added — if Google/Email sign-in fails locally, add it),
- once you deploy to GitHub Pages: `<your-username>.github.io`.

## 5. Deploy to GitHub Pages (optional, for a live URL)

Pushed to `main`, `.github/workflows/deploy.yml` auto-builds and publishes. Prerequisites:

1. Add the same `VITE_FIREBASE_*` values as **repository secrets** in
   **Settings → Secrets and variables → Actions**.
2. **Settings → Pages → Source → GitHub Actions**.
3. Firebase CLI once for rules/indexes (only needs doing when they change):

   ```bash
   npm install -g firebase-tools
   firebase login
   firebase use --add        # pick your padhle project
   firebase deploy --only firestore:rules,firestore:indexes
   ```

---

## 6. Enable the Admin dashboard

The admin section is built into the app (`/admin` route, sidebar + ⌘K) and appears only for
accounts that have a doc in the `/admins` collection. To bootstrap the first admin:

1. Sign up / sign in at least once in the app (so your `/users/{uid}` doc exists).
2. Open **Authentication → Users** → copy your **UID** (the long id, not the email).
3. In **Firestore → `admins` → Add document**, set the **document id to your UID**, add:
   - `email`: `your@email.com` (string)
   - (optional) `grantedAt`: timestamp
4. **Publish the rules from step 1.4 **before** searching** — otherwise the dashboard renders
   but user reads are denied.
5. Reload the app → **Admin** appears in the sidebar.

From then on, admin management happens **in the app**:

- The dashboard lists every registered user with lifetime focus hours, questions, tasks, mocks,
  streak, and last-active date (summed from `month_*` counters), sorted by most recent activity.
- **Search** filters by name/email; **Needs attention** shows not-onboarded or inactive-7+-days
  users; **Admins** shows only admins.
- The **shield** button on any row grants/revokes admin access instantly by writing/deleting a
  real `/admins/{uid}` doc — you can still edit the same collection in the console. You can't
  revoke your own access (prevents lockout).
- The **eye** button opens that student's read-only snapshot (`/parent/:uid`) as admin.

> Admin is read-only by design: owners keep full write access to their own data; admins only
> read it.

**Admin not showing up?** Open the app, visit `/#/admin`, and use the **Re-check admin access**
button — it shows your signed-in UID and tells you exactly what's missing. The three usual causes:
rules not published (`firebase deploy --only firestore:rules`), a document id in `/admins` that
doesn't exactly match your UID, or `.env` pointing at a different project than the console.

## 7. Parent / mentor read-only shares

Students can grant read-only access to a parent or mentor from **Profile → Parents & mentors**
(profile page → add an email → copy the share link). The parent opens the link, signs in with
their **own Google account**, and lands on a **My students** hub (`/#/parent`) listing every
student who has shared with them; each row opens that student's read-only snapshot (weekly
focus score, focus trend, exam countdown, last-30-days totals, syllabus progress, recent
activity: focus sessions, tasks done, mock-test scores, check-ins).

The access check is entirely server-side and already shipped in this repo's `firestore.rules`
— nothing to add:

- `isGrantedParent(uid)` — the viewer's **verified email** is in `users/{uid}.parents`
  (students add emails via `src/lib/share.ts`, stored lowercased).
- `canReadUserData(uid) = isOwner(uid) || isAdmin() || isGrantedParent(uid)` — applied to the
  user doc **and** every subcollection a snapshot needs (counters, examGoals, focusSessions,
  subjects, …), so the hub's `parents array-contains` query and the snapshot reads all work.
- Parents are **read-only**: there are no write paths through the hub or snapshot page.

Notes:
- The share never exposes data publicly: the reader must be signed in with the exact email the
  student added, and the rules verify it server-side (not just the client).
- Publish rules with `firebase deploy --only firestore:rules` after editing.

## 8. Sanity checklist

- [ ] Login page loads, Google + Email sign-up works
- [ ] After sign-up you land on Onboarding, then Today
- [ ] Firestore console shows `users/{uid}`, `examGoals`, `subjects`, `chapters`
- [ ] Completing a task increments `users/{uid}/counters/day_<today>` (per `README`/`TODO.md`)
- [ ] `/admin` shows your account once you add yourself to `/admins`
- [ ] `/admin` shield button grants/revokes a real `/admins/{uid}` doc and the eye button opens that student's snapshot
- [ ] A parent with your email in `users/{uid}.parents` lands on `/#/parent` and sees your snapshot, read-only