# Bike Service & Marketplace System

Modern web app for browsing bikes and accessories, booking service appointments, and managing shop inventory with role-based access (customer, approved shop owner, admin).

## Stack

- React + TypeScript + Vite
- Tailwind CSS v4 (`@tailwindcss/vite`)
- React Router
- Firebase Authentication, Firestore, Storage
- React Hook Form + Zod + Sonner toasts

**New to Firebase?** Use the walkthrough: **[Firebase setup (step by step)](docs/FIREBASE_STEP_BY_STEP.md)**.

## Getting started

```bash
npm install
cp .env.example .env
```

Fill in Firebase web app keys from the Firebase console (Project settings → Your apps). Then:

```bash
npm run dev
```

To verify **Firestore** (database) is reachable with your `.env` config:

```bash
npm run check:firebase
```

You should see `OK — Firestore is reachable.` (it runs a tiny public read on the `bikes` collection).

### Demo login accounts (optional)

Fixed accounts for local testing (all use the same password **`DemoPass123!`**):

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@bikehub.demo` | `DemoPass123!` |
| Customer | `customer@bikehub.demo` | `DemoPass123!` |
| Shop owner (approved) | `owner@bikehub.demo` | `DemoPass123!` |

1. Deploy the latest [`firestore.rules`](firestore.rules) (includes a **demo-only** rule so `admin@bikehub.demo` can create an `admin` profile once).
2. With `VITE_FIREBASE_*` set in `.env`, run:

```bash
npm run bootstrap:demo-users
```

That also **writes real Firestore documents** (bikes, accessories, services from [`src/data/demo-seed.json`](src/data/demo-seed.json)) for `owner@bikehub.demo` the first time the demo owner has no bikes yet.

3. Sign in at **`/login`** with any row above.

Re-run the command if you need to attach a missing Firestore profile to an existing Auth user. **Change or remove the `admin@bikehub.demo` rule before production** if you do not want that bootstrap path.

#### `auth/configuration-not-found` when running `bootstrap:demo-users`

That comes from the **Identity Toolkit** (Auth) REST call, not from this repo’s script logic. Fix it by:

1. **Firebase Console → Authentication:** open **Authentication** for this project, then **Sign-in method** → enable **Email/Password**.
2. **Google Cloud Console → APIs & Services → Credentials:** open the **Browser key** that matches `VITE_FIREBASE_API_KEY`. If **Application restrictions** is set to **HTTP referrers**, Node.js has no referrer, so Auth fails. For local scripts use **None** (dev only), or **IP addresses** with your machine’s IP, or a **separate** key without referrer restrictions for CLI use.
3. **`.env`:** no quotes/spaces mistakes; `authDomain` should look like `your-project-id.firebaseapp.com` and match **Project settings → Your apps → Web**.

The bootstrap script prints the same hints when it catches this error.

### Demo data (optional)

- **Browse-only demos (no writes):** set `VITE_DEMO_DATA=true` in `.env` and restart the dev server. The app prepends sample bikes, accessories, and services (from [`src/data/demo-seed.json`](src/data/demo-seed.json)) for the landing page and public catalog. Demo services cannot be booked; sample booking cards appear on **Bookings** when you have none yet.
- **Real Firestore seed:** add `SEED_OWNER_EMAIL` / `SEED_OWNER_PASSWORD` for an **approved** shop owner, then run:

```bash
npm run seed:firestore
```

That creates the same items as real documents owned by that account (bookable with a customer account).

## Firebase setup

The app cannot create your Firebase project or read your secrets automatically. You still need to create the project in the console and paste web config into `.env`. After that, this repo can deploy **rules and indexes** for you via the Firebase CLI.

1. In [Firebase Console](https://console.firebase.google.com/), create a project and enable **Authentication** (Email/Password), **Firestore**, and **Storage**.
2. Project settings → Your apps → Web app → copy config into `.env` (see `.env.example`).
3. Link the CLI to that project:
   - Edit [`.firebaserc`](.firebaserc) and set `default` to your **project ID**, **or** run `npm run firebase:use` and pick the project.
   - One-time login: `npm run firebase:login` (opens the browser).
4. Deploy rules and indexes from this repo:

```bash
npm run firebase:deploy:rules
```

5. Optional: deploy the built site to Firebase Hosting:

```bash
npm run firebase:deploy:hosting
```

If you skip the CLI, you can still paste [`firestore.rules`](firestore.rules) and [`storage.rules`](storage.rules) in the console and add indexes from [`firestore.indexes.json`](firestore.indexes.json) (or use the “create index” links when a query fails).

## Bootstrap an admin user

There is no in-app promotion to `admin` (by design). After a user registers in Firebase Auth:

1. Create the matching Firestore document at `users/{uid}` (same `uid` as Authentication) **or** register normally and edit the document in the console.
2. Set:
   - `role: "admin"`
   - `email`, `displayName`, `createdAt`, `updatedAt` as needed (`createdAt`/`updatedAt` can be timestamps).

Admins can approve pending shop owners from **Admin → Users**.

## Scripts

- `npm run dev` — start Vite dev server
- `npm run build` — typecheck + production build
- `npm run preview` — preview the production build

## Customer forgot-password OTP (PHPMailer)

Customer login is at `/login/customer`. Forgot-password now supports OTP by email via PHP + PHPMailer:

1. Install mailer dependency on the PHP host (repo root):

```bash
composer require phpmailer/phpmailer
```

2. Configure PHP runtime env vars (SMTP + token secret), then expose:
   - `public/api/customer-password-otp.php`
3. Set client env in `.env`:
   - `VITE_PASSWORD_OTP_API_PATH=/api/customer-password-otp.php`
4. Set the same token secret in Firebase Functions and deploy functions:

```bash
firebase functions:secrets:set OTP_RESET_TOKEN_SECRET
npm run firebase:deploy:functions
```

Flow: request OTP -> verify OTP (mail code) -> reset password. The reset write is completed by callable function `resetCustomerPasswordWithOtp` (Firebase Admin SDK).

### Database (Firestore) from the terminal

Firestore has no separate “build” or migration step: collections appear when documents are written. Use this order after `.env` is filled and **Authentication + Firestore** are enabled in the console:

| Step | Command | What it does |
|------|---------|----------------|
| 1 | `npm run firebase:login` then `npm run firebase:use` (once) | Link Firebase CLI to your project (see `.firebaserc`). |
| 2 | `npm run firebase:deploy:rules` | Publishes **`firestore.rules`**, **`firestore.indexes.json`**, and **`storage.rules`** to Firebase. |
| 3 | `npm run check:firebase` | Sanity check: can the app config read Firestore (`bikes`)? |
| 4 | `npm run bootstrap:demo-users` | Creates demo Auth users + profiles and seeds **bikes / accessories / services** from `demo-seed.json` for `owner@bikehub.demo` (first run). |
| Alt | `npm run seed:firestore` | Same catalog seed, but signs in as **`SEED_OWNER_EMAIL`** / **`SEED_OWNER_PASSWORD`** (approved owner you already have). |

Then `npm run dev` and sign in at **`/login`**. For browse-only sample rows without writing to Firestore, set `VITE_DEMO_DATA=true` in `.env` and restart the dev server.

## Folder structure

See `src/` for `components/`, `pages/`, `layouts/`, `services/`, `context/`, `routes/`, `utils/`, and `types/`.
